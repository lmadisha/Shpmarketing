import { type ChangeEvent, FormEvent, useEffect, useRef, useState } from "react";
import { Camera, ScanLine, Upload } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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

export function DeviceCheckerPage() {
  const { adminRequest, withOrganisationFilter, canSubmitDeviceCheck } = useAdminAssets();

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
  const [scannerInfo, setScannerInfo] = useState<string>("Point your camera at the serial barcode.");
  const [scannerMatching, setScannerMatching] = useState(false);
  const [scannerDecodingImage, setScannerDecodingImage] = useState(false);
  const [cameraRestartKey, setCameraRestartKey] = useState(0);
  const cameraVideoRef = useRef<HTMLVideoElement | null>(null);
  const scannerFileInputRef = useRef<HTMLInputElement | null>(null);
  const cameraSessionRef = useRef<CameraScannerSession | null>(null);
  const handleScannedSerialRef = useRef<(value: string) => Promise<void>>(async () => {});

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
    if (!scannerOpen || scannerMode !== "camera") {
      cameraSessionRef.current?.stop();
      cameraSessionRef.current = null;
      return;
    }

    const video = cameraVideoRef.current;
    if (!video) {
      return;
    }

    setScannerError(null);
    setScannerInfo("Point your camera at the serial barcode.");
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
  }, [cameraRestartKey, scannerMode, scannerOpen]);

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
    setScannerInfo("Point your camera at the serial barcode.");
    setScannerMode("camera");
    setScannerDecodingImage(false);
    setScannerMatching(false);
    setCameraRestartKey((prev) => prev + 1);
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
                  setScannerInfo("Point your camera at the serial barcode.");
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
            <Input
              value={form.mac_address}
              onChange={(event) => {
                setError(null);
                setSuccess(null);
                setForm((prev) => ({ ...prev, mac_address: cleanHex12(event.target.value) }));
              }}
              placeholder="MAC Address (12 hex chars)"
              disabled={submitting}
            />
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

            <Tabs value={scannerMode} onValueChange={(value) => setScannerMode(value as ScannerMode)}>
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
                <video
                  ref={cameraVideoRef}
                  className="h-64 w-full rounded-md border bg-black object-cover"
                  autoPlay
                  muted
                  playsInline
                />
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs text-muted-foreground">If scanning does not start, restart the camera.</p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={scannerDecodingImage || scannerMatching}
                    onClick={() => {
                      setScannerError(null);
                      setCameraRestartKey((prev) => prev + 1);
                    }}
                  >
                    Restart Camera
                  </Button>
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
    </Card>
  );
}
