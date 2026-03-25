import { FormEvent, useEffect, useRef, useState } from "react";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { useAdminAssets } from "./admin-assets-context";
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

export function DeviceCheckerPage() {
  const { adminRequest } = useAdminAssets();

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

  useEffect(() => {
    const requestId = ++serialRequestIdRef.current;
    const timer = window.setTimeout(async () => {
      const query = serialQuery.trim();
      setSerialsLoading(true);

      try {
        const data = query
          ? await adminRequest<Fridge[]>("loadDcSerials.search", `/searchFridges?searchTerm=${encodeURIComponent(query)}`)
          : await adminRequest<Fridge[]>("loadDcSerials.list", "/getFridges");

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

  const submitDeviceCheck = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    setSubmitting(true);

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

  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle>Device Checker</CardTitle>
        <CardDescription>Submit a manual device check to verify or flag a mismatch.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={(event) => void submitDeviceCheck(event)} className="space-y-4">
          <div className="space-y-1">
            <label className="text-sm font-medium">Serial Number</label>
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
      </CardContent>
    </Card>
  );
}
