import { type ChangeEvent, FormEvent, useEffect, useRef, useState } from "react";
import { Camera, ScanLine, Upload } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../components/ui/dialog";
import { Input } from "../../components/ui/input";
import { AccessDeniedCard } from "../../components/auth/access-denied-card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../components/ui/tabs";
import { useAdminAssets } from "./admin-assets-context";
import { findExactSerialMatch, normalizeSerialCandidate } from "./serial-lookup";
import { decodeSerialFromImageFile, startCameraSerialScan, type CameraScannerSession } from "./serial-scanner";
import { Fridge } from "./types";
import { cleanCNumber, cleanHex12 } from "./utils";

type DeviceCheckForm = {
  fridge_serial_number: string;
  mac_address: string;
  c_number: string;
};

type DeviceCheckSuccess = {
  result: "VERIFIED" | "MISMATCH_CREATED";
  id?: number;
  fridge_serial_number: string;
};

type ScannerMode = "camera" | "upload";

type BluetoothDeviceRequest = {
  name?: string | null;
};

type BluetoothNavigator = Navigator & {
  bluetooth?: {
    requestDevice: (options: { filters: Array<{ namePrefix: string }> }) => Promise<BluetoothDeviceRequest>;
  };
};

function parsePenguinMacAddress(deviceName: string | null | undefined): string | null {
  const name = String(deviceName || "").trim();
  if (!name.startsWith("Penguin+")) {
    return null;
  }

  const parsedMac = cleanHex12(name.slice("Penguin+".length));
  return parsedMac.length === 12 ? parsedMac : null;
}

export function DeviceCheckerPage() {
  const { adminRequest, withOrganisationFilter, canSubmitDeviceCheck } = useAdminAssets();
  const bluetoothNavigator = typeof navigator !== "undefined" ? (navigator as BluetoothNavigator) : null;
  const isSecureContext = typeof window !== "undefined" && window.isSecureContext;
  const bluetoothSupported = isSecureContext && Boolean(bluetoothNavigator?.bluetooth);
  const bluetoothUnavailableReason = !isSecureContext
    ? "Bluetooth scan requires HTTPS or localhost."
    : !bluetoothNavigator?.bluetooth
      ? "Bluetooth scan is only supported in Chromium-based browsers."
      : "";

  const [serials, setSerials] = useState<Fridge[]>([]);
  const [serialsLoading, setSerialsLoading] = useState(false);
  const [serialSelectOpen, setSerialSelectOpen] = useState(false);
  const [serialQuery, setSerialQuery] = useState("");
  const serialQueryInputRef = useRef<HTMLInputElement | null>(null);
  const serialRequestIdRef = useRef(0);
  const [form, setForm] = useState<DeviceCheckForm>({
    fridge_serial_number: "",
    mac_address: "",
    c_number: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<DeviceCheckSuccess | null>(null);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scannerMode, setScannerMode] = useState<ScannerMode>("camera");
  const [scannerError, setScannerError] = useState<string | null>(null);
  const [scannerInfo, setScannerInfo] = useState<string>("Use Start Scan to read the serial barcode from camera.");
  const [scannerMatching, setScannerMatching] = useState(false);
  const [scannerDecodingImage, setScannerDecodingImage] = useState(false);
  const [cameraScanning, setCameraScanning] = useState(false);
  const [cameraRestartKey, setCameraRestartKey] = useState(0);
  const cameraVideoRef = useRef<HTMLVideoElement | null>(null);
  const scannerFileInputRef = useRef<HTMLInputElement | null>(null);
  const cameraSessionRef = useRef<CameraScannerSession | null>(null);
  const handleScannedSerialRef = useRef<(value: string) => Promise<void>>(async () => {});
  const [bluetoothBusy, setBluetoothBusy] = useState(false);
  const [bluetoothMessage, setBluetoothMessage] = useState<string | null>(null);
  const [bluetoothConfirm, setBluetoothConfirm] = useState<{
    open: boolean;
    deviceName: string;
    macAddress: string;
  }>({
    open: false,
    deviceName: "",
    macAddress: "",
  });

  useEffect(() => {
    const requestId = ++serialRequestIdRef.current;
    const timer = window.setTimeout(async () => {
      const query = serialQuery.trim();
      setSerialsLoading(true);

      try {
        const data = query
          ? await adminRequest<Fridge[]>(
              "loadDcSerials.search",
              withOrganisationFilter(`/searchFridges?searchTerm=${encodeURIComponent(query)}`),
            )
          : await adminRequest<Fridge[]>("loadDcSerials.list", withOrganisationFilter("/getFridges"));

        if (serialRequestIdRef.current !== requestId) {
          return;
        }

        setSerials(Array.isArray(data) ? data : []);
      } catch {
        if (serialRequestIdRef.current !== requestId) {
          return;
        }

        setSerials([]);
        setError("Could not load serial numbers.");
      } finally {
        if (serialRequestIdRef.current === requestId) {
          setSerialsLoading(false);
        }
      }
    }, 200);

    return () => window.clearTimeout(timer);
    // serialQuery drives this effect; adminRequest comes from context and is intentionally excluded.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serialQuery]);

  useEffect(() => {
    if (!serialSelectOpen) {
      return;
    }

    const timer = window.setTimeout(() => {
      serialQueryInputRef.current?.focus();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [serialSelectOpen]);

  const handleScannedSerial = async (candidate: string) => {
    const normalizedCandidate = normalizeSerialCandidate(candidate);
    if (!normalizedCandidate) {
      setScannerError("Could not read a valid serial number from barcode.");
      setScannerInfo("Try scanning again or use image upload.");
      return;
    }

    setScannerMatching(true);
    setScannerError(null);
    setScannerInfo(`Detected ${normalizedCandidate}. Validating...`);

    try {
      const data = await adminRequest<Fridge[]>(
        "deviceCheck:scanLookup",
        withOrganisationFilter(`/searchFridges?searchTerm=${encodeURIComponent(normalizedCandidate)}`),
      );
      const matchedSerial = findExactSerialMatch(normalizedCandidate, Array.isArray(data) ? data : []);

      if (!matchedSerial) {
        setScannerError(`Scanned serial ${normalizedCandidate} was not found in inventory.`);
        setScannerInfo("Scan again, upload another image, or select from the dropdown.");
        return;
      }

      setError(null);
      setSuccess(null);
      setForm((prev) => ({ ...prev, fridge_serial_number: matchedSerial }));
      setSerialQuery(matchedSerial);
      setScannerInfo(`Serial ${matchedSerial} selected.`);
      setScannerOpen(false);
    } catch (scanError) {
      setScannerError(scanError instanceof Error ? scanError.message : "Could not validate scanned serial.");
      setScannerInfo("Try again or select serial manually.");
    } finally {
      setScannerMatching(false);
    }
  };

  handleScannedSerialRef.current = handleScannedSerial;

  useEffect(() => {
    if (!scannerOpen || scannerMode !== "camera" || !cameraScanning) {
      cameraSessionRef.current?.stop();
      cameraSessionRef.current = null;
      return;
    }

    const video = cameraVideoRef.current;
    if (!video) {
      return;
    }

    setScannerError(null);
    setScannerInfo("Scanning live camera for barcode...");
    cameraSessionRef.current = startCameraSerialScan(video, {
      onDecode: (value) => {
        void handleScannedSerialRef.current(value);
      },
      onError: (message) => {
        setScannerError(message);
      },
    });

    return () => {
      cameraSessionRef.current?.stop();
      cameraSessionRef.current = null;
    };
  }, [cameraRestartKey, cameraScanning, scannerMode, scannerOpen]);

  useEffect(() => {
    if (scannerOpen) {
      return;
    }
    cameraSessionRef.current?.stop();
    cameraSessionRef.current = null;
  }, [scannerOpen]);

  const handleImageScanFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setScannerDecodingImage(true);
    setScannerError(null);
    setScannerInfo(`Decoding barcode from ${file.name}...`);

    try {
      const decoded = await decodeSerialFromImageFile(file);
      await handleScannedSerial(decoded);
    } catch (decodeError) {
      setScannerError(decodeError instanceof Error ? decodeError.message : "Could not decode barcode image.");
      setScannerInfo("Upload a clearer barcode image and try again.");
    } finally {
      setScannerDecodingImage(false);
      if (scannerFileInputRef.current) {
        scannerFileInputRef.current.value = "";
      }
    }
  };

  const resetScannerState = () => {
    setScannerError(null);
    setScannerInfo("Use Start Scan to read the serial barcode from camera.");
    setScannerMode("camera");
    setScannerDecodingImage(false);
    setScannerMatching(false);
    setCameraScanning(false);
    setCameraRestartKey((prev) => prev + 1);
  };

  const startCameraScan = () => {
    setScannerError(null);
    setScannerInfo("Scanning live camera for barcode...");
    setCameraScanning(true);
    setCameraRestartKey((prev) => prev + 1);
  };

  const stopCameraScan = () => {
    setCameraScanning(false);
    setScannerInfo("Camera scan stopped. Start scan again or upload an image.");
  };

  const submitDeviceCheck = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    setSubmitting(true);

    if (!canSubmitDeviceCheck) {
      setError("You do not have permission to submit device checks.");
      setSubmitting(false);
      return;
    }

    try {
      const result = await adminRequest<DeviceCheckSuccess>("deviceCheck:submit", "/mismatches/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      setSuccess(result);
      setForm({ fridge_serial_number: "", mac_address: "", c_number: "" });
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Submission failed.");
    } finally {
      setSubmitting(false);
    }
  };

  if (!canSubmitDeviceCheck) {
    return (
      <AccessDeniedCard
        title="Device Checker access denied"
        description="You do not have permission to run device checks."
      />
    );
  }

  const requestBluetoothMacAddress = async () => {
    setError(null);
    setSuccess(null);
    setBluetoothMessage(null);

    if (!bluetoothSupported || !bluetoothNavigator?.bluetooth) {
      setBluetoothMessage(bluetoothUnavailableReason || "Bluetooth is not available in this browser.");
      return;
    }

    setBluetoothBusy(true);
    try {
      const device = await bluetoothNavigator.bluetooth.requestDevice({
        filters: [{ namePrefix: "Penguin+" }],
      });

      const deviceName = String(device.name || "").trim();
      const parsedMacAddress = parsePenguinMacAddress(deviceName);

      if (!deviceName) {
        setBluetoothMessage("Selected Bluetooth device has no readable name.");
        return;
      }

      if (!parsedMacAddress) {
        setBluetoothMessage("Selected device name does not contain a valid Penguin+ MAC address.");
        return;
      }

      setBluetoothConfirm({
        open: true,
        deviceName,
        macAddress: parsedMacAddress,
      });
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : "Bluetooth device request failed.";
      if (message.includes("User cancelled") || message.includes("User canceled") || message.includes("cancelled")) {
        setBluetoothMessage("Bluetooth selection was cancelled.");
        return;
      }
      setBluetoothMessage(message);
    } finally {
      setBluetoothBusy(false);
    }
  };

  const confirmBluetoothMacAddress = () => {
    setForm((prev) => ({ ...prev, mac_address: bluetoothConfirm.macAddress }));
    setBluetoothMessage(`Loaded MAC address from ${bluetoothConfirm.deviceName}.`);
    setBluetoothConfirm({
      open: false,
      deviceName: "",
      macAddress: "",
    });
  };

  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle>Device Checker</CardTitle>
        <CardDescription>Submit a manual device check to verify or flag a mismatch.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={(event) => void submitDeviceCheck(event)} className="space-y-4">
          <div className="space-y-1">
            <div className="flex items-center justify-between gap-2">
              <label className="text-sm font-medium">Serial Number</label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1"
                disabled={submitting}
                onClick={() => {
                  setScannerOpen(true);
                  setScannerError(null);
                  setScannerInfo("Use Start Scan to read the serial barcode from camera.");
                }}
              >
                <ScanLine className="h-4 w-4" />
                Scan Serial
              </Button>
            </div>
            <Select
              open={serialSelectOpen}
              onOpenChange={(open) => {
                setSerialSelectOpen(open);
                if (!open) {
                  setSerialQuery("");
                }
              }}
              value={form.fridge_serial_number}
              onValueChange={(value) => {
                setError(null);
                setSuccess(null);
                setForm((prev) => ({ ...prev, fridge_serial_number: value }));
                setSerialSelectOpen(false);
              }}
              disabled={serialsLoading || submitting}
            >
              <SelectTrigger>
                <SelectValue placeholder={serialsLoading ? "Loading serials..." : "Select a serial number"} />
              </SelectTrigger>
              <SelectContent>
                <div className="sticky top-0 z-10 border-b bg-popover p-2">
                  <Input
                    ref={serialQueryInputRef}
                    value={serialQuery}
                    onChange={(event) => setSerialQuery(event.target.value)}
                    onKeyDown={(event) => event.stopPropagation()}
                    placeholder="Type to search serial..."
                    disabled={submitting}
                  />
                </div>
                {serials.map((fridge) => (
                  <SelectItem key={fridge.fridge_serial_number} value={fridge.fridge_serial_number}>
                    {fridge.fridge_serial_number}
                  </SelectItem>
                ))}
                {!serialsLoading && serials.length === 0 ? (
                  <div className="px-2 py-2 text-sm text-muted-foreground">No serial numbers found.</div>
                ) : null}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">MAC Address</label>
            <div className="flex gap-2">
              <Input
                value={form.mac_address}
                onChange={(event) => {
                  setError(null);
                  setSuccess(null);
                  setBluetoothMessage(null);
                  setForm((prev) => ({ ...prev, mac_address: cleanHex12(event.target.value) }));
                }}
                placeholder="MAC Address (12 hex chars)"
                disabled={submitting}
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => void requestBluetoothMacAddress()}
                disabled={submitting || bluetoothBusy || !bluetoothSupported}
              >
                {bluetoothBusy ? "Scanning..." : "Scan via Bluetooth"}
              </Button>
            </div>
            {!bluetoothSupported ? (
              <p className="text-xs text-muted-foreground">{bluetoothUnavailableReason}</p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Bluetooth scan only matches devices whose name starts with <span className="font-mono">Penguin+</span>.
              </p>
            )}
            {bluetoothMessage ? (
              <p className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-700">
                {bluetoothMessage}
              </p>
            ) : null}
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">C-Code / C-Number</label>
            <Input
              value={form.c_number}
              onChange={(event) => {
                setError(null);
                setSuccess(null);
                setForm((prev) => ({ ...prev, c_number: cleanCNumber(event.target.value) }));
              }}
              placeholder="C-Code / C-Number"
              disabled={submitting}
            />
          </div>

          {error ? (
            <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
              {error}
            </p>
          ) : null}

          {success ? (
            <p className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
              {success.result === "VERIFIED"
                ? `${success.fridge_serial_number} matched and was marked verified.`
                : `Mismatch #${success.id} submitted for ${success.fridge_serial_number}.`}
            </p>
          ) : null}

          <Button type="submit" disabled={submitting || !form.fridge_serial_number || !form.mac_address || !form.c_number}>
            {submitting ? "Submitting..." : `Submit ${form.fridge_serial_number}`}
          </Button>
        </form>

        <Dialog
          open={scannerOpen}
          onOpenChange={(open) => {
            setScannerOpen(open);
            if (!open) {
              resetScannerState();
            }
          }}
        >
          <DialogContent className="sm:max-w-xl">
            <DialogHeader>
              <DialogTitle>Scan Serial Number</DialogTitle>
              <DialogDescription>
                Use camera scan or upload a barcode image. Only serials in inventory can be selected.
              </DialogDescription>
            </DialogHeader>

            <Tabs
              value={scannerMode}
              onValueChange={(value) => {
                setScannerMode(value as ScannerMode);
                setScannerError(null);
                if (value !== "camera") {
                  setCameraScanning(false);
                  setScannerInfo("Upload a barcode image to detect the serial.");
                } else {
                  setScannerInfo("Use Start Scan to read the serial barcode from camera.");
                }
              }}
            >
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="camera" disabled={scannerDecodingImage || scannerMatching}>
                  <Camera className="h-4 w-4" />
                  Camera
                </TabsTrigger>
                <TabsTrigger value="upload" disabled={scannerDecodingImage || scannerMatching}>
                  <Upload className="h-4 w-4" />
                  Upload Image
                </TabsTrigger>
              </TabsList>

              <TabsContent value="camera" className="space-y-3">
                <div className="relative overflow-hidden rounded-md border bg-black">
                  <video
                    ref={cameraVideoRef}
                    className="h-64 w-full object-cover"
                    autoPlay
                    muted
                    playsInline
                  />
                  <div className="pointer-events-none absolute inset-0">
                    <div className="absolute inset-4 rounded-xl border border-white/30" />
                    {cameraScanning ? (
                      <>
                        <div className="absolute inset-6 rounded-lg border border-cyan-400/70 animate-pulse shadow-[0_0_0_1px_rgba(34,211,238,0.25),0_0_24px_rgba(34,211,238,0.2)]" />
                        <div className="absolute left-6 right-6 top-1/2 h-0.5 -translate-y-1/2 bg-gradient-to-r from-transparent via-cyan-300 to-transparent animate-pulse shadow-[0_0_18px_rgba(34,211,238,0.75)]" />
                        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-black/55 px-3 py-1 text-xs font-medium text-cyan-200 backdrop-blur-sm">
                          Scanning barcode...
                        </div>
                      </>
                    ) : (
                      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-black/55 px-3 py-1 text-xs font-medium text-white/85 backdrop-blur-sm">
                        Camera ready. Start scan when barcode is in view.
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs text-muted-foreground">
                    Position the barcode inside the frame, then start scanning.
                  </p>
                  <div className="flex gap-2">
                    {cameraScanning ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={scannerDecodingImage || scannerMatching}
                        onClick={stopCameraScan}
                      >
                        Stop Scan
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={scannerDecodingImage || scannerMatching}
                        onClick={startCameraScan}
                      >
                        Start Scan
                      </Button>
                    )}
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="upload" className="space-y-3">
                <Input
                  ref={scannerFileInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={(event) => void handleImageScanFile(event)}
                  disabled={scannerDecodingImage || scannerMatching}
                />
                <p className="text-xs text-muted-foreground">Upload a clear image where the barcode is visible.</p>
              </TabsContent>
            </Tabs>

            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">{scannerInfo}</p>
              {scannerError ? (
                <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
                  {scannerError}
                </p>
              ) : null}
              {(scannerMatching || scannerDecodingImage) ? (
                <p className="text-sm text-blue-700">
                  {scannerDecodingImage ? "Decoding image..." : "Validating scanned serial..."}
                </p>
              ) : null}
            </div>
          </DialogContent>
        </Dialog>
      </CardContent>

      <Dialog
        open={bluetoothConfirm.open}
        onOpenChange={(open) => {
          if (!open) {
            setBluetoothConfirm({
              open: false,
              deviceName: "",
              macAddress: "",
            });
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Bluetooth Device</DialogTitle>
            <DialogDescription>Use the MAC address parsed from the selected Penguin+ device?</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <div>
              <p className="font-medium">Device</p>
              <p className="text-muted-foreground">{bluetoothConfirm.deviceName}</p>
            </div>
            <div>
              <p className="font-medium">MAC Address</p>
              <p className="font-mono text-muted-foreground">{bluetoothConfirm.macAddress}</p>
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                setBluetoothConfirm({
                  open: false,
                  deviceName: "",
                  macAddress: "",
                })
              }
            >
              Cancel
            </Button>
            <Button type="button" onClick={confirmBluetoothMacAddress}>
              Use MAC Address
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
