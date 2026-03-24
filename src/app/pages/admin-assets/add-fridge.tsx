import { FormEvent, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { Button } from "../../components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "../../components/ui/table";
import { Download, Plus } from "lucide-react";
import { useAdminAssets } from "./admin-assets-context";
import { cleanHex12, cleanCNumber, downloadCsv } from "./utils";

export function AddFridgePage() {
  const { loadFridges, loadAllHistory, searchTerm, adminRequest } = useAdminAssets();

  const [createForm, setCreateForm] = useState({
    fridge_serial_number: "",
    mac_address: "",
    c_number: "",
  });
  const [createErrors, setCreateErrors] = useState<{ serial?: string; mac?: string; cNumber?: string }>({});
  const [creating, setCreating] = useState(false);
  const [createResult, setCreateResult] = useState("");

  const [bulkFile, setBulkFile] = useState<File | null>(null);
  const [bulkSubmitting, setBulkSubmitting] = useState(false);
  const [bulkPreviewLoading, setBulkPreviewLoading] = useState(false);
  const [bulkMessage, setBulkMessage] = useState("");
  const [bulkErrors, setBulkErrors] = useState<Array<{ rowNumber: number; reason: string; message: string; serial?: string }>>([]);
  const [bulkPreviewRows, setBulkPreviewRows] = useState<Array<{ rowNumber: number; fridge_serial_number: string; mac_address: string | null; c_number: string | null }>>([]);
  const [bulkPreviewSummary, setBulkPreviewSummary] = useState<{ totalRows: number; previewRows: number; excludedRows: number } | null>(null);

  const validateCreate = () => {
    const nextErrors: { serial?: string; mac?: string; cNumber?: string } = {};
    const serial = cleanHex12(createForm.fridge_serial_number);
    const mac = createForm.mac_address ? cleanHex12(createForm.mac_address) : "";
    const cNumber = createForm.c_number ? cleanCNumber(createForm.c_number) : "";

    if (serial.length !== 12) nextErrors.serial = "Serial must be exactly 12 hex characters.";
    if (mac && mac.length !== 12) nextErrors.mac = "MAC must be exactly 12 hex characters when provided.";
    if (cNumber.length > 10) nextErrors.cNumber = "C-number cannot exceed 10 characters.";

    setCreateErrors(nextErrors);
    return { isValid: Object.keys(nextErrors).length === 0, serial, mac, cNumber };
  };

  const submitCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const { isValid, serial, mac, cNumber } = validateCreate();
    if (!isValid) return;

    setCreating(true);
    setCreateResult("");
    try {
      await adminRequest("createFridge", "/newDevice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fridge_serial_number: serial, mac_address: mac, c_number: cNumber }),
      });
      setCreateForm({ fridge_serial_number: "", mac_address: "", c_number: "" });
      setCreateErrors({});
      setCreateResult("Fridge added successfully.");
      await loadFridges(searchTerm);
      await loadAllHistory();
    } catch {
      setCreateResult("Could not add fridge. Check duplicates and try again.");
    } finally {
      setCreating(false);
    }
  };

  const previewBulkUpload = async () => {
    if (!bulkFile) { setBulkMessage("Please choose a CSV or Excel file first."); return; }
    setBulkPreviewLoading(true);
    setBulkMessage("");
    setBulkErrors([]);
    setBulkPreviewRows([]);
    setBulkPreviewSummary(null);
    try {
      const formData = new FormData();
      formData.append("file", bulkFile);
      const response = await adminRequest<{
        summary: { totalRows: number; previewRows: number; excludedRows: number };
        rows: Array<{ rowNumber: number; fridge_serial_number: string; mac_address: string | null; c_number: string | null }>;
      }>("bulkPreview", "/newDevice/bulk/preview", { method: "POST", body: formData });
      setBulkPreviewRows(Array.isArray(response.rows) ? response.rows : []);
      setBulkPreviewSummary(response.summary);
      setBulkMessage(`Preview ready. Total: ${response.summary.totalRows}, Included: ${response.summary.previewRows}, Excluded(no serial): ${response.summary.excludedRows}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Bulk preview failed.";
      setBulkMessage(message);
    } finally {
      setBulkPreviewLoading(false);
    }
  };

  const submitBulkUpload = async () => {
    if (!bulkFile) { setBulkMessage("Please choose a CSV or Excel file first."); return; }
    setBulkSubmitting(true);
    setBulkMessage("");
    setBulkErrors([]);
    try {
      const formData = new FormData();
      formData.append("file", bulkFile);
      const response = await adminRequest<{
        summary: { totalRows: number; excludedRows?: number; validRows: number; insertedRows: number; failedRows: number };
        errors?: Array<{ rowNumber: number; reason: string; message: string; serial?: string }>;
      }>("bulkUpload", "/newDevice/bulk", { method: "POST", body: formData });
      const summary = response.summary;
      setBulkMessage(`Upload complete. Total: ${summary.totalRows}, Excluded(no serial): ${summary.excludedRows || 0}, Ready: ${summary.validRows}, Inserted: ${summary.insertedRows}, Failed: ${summary.failedRows}`);
      setBulkErrors(response.errors || []);
      await loadFridges(searchTerm);
      await loadAllHistory();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Bulk upload failed.";
      setBulkMessage(message);
    } finally {
      setBulkSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Single Fridge */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Add New Fridge
          </CardTitle>
          <CardDescription>Register a new device identity.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <p className="text-sm font-medium">Single Fridge</p>
            <form onSubmit={(e) => void submitCreate(e)} className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div className="space-y-1">
                <Input
                  value={createForm.fridge_serial_number}
                  onChange={(e) => setCreateForm((prev) => ({ ...prev, fridge_serial_number: cleanHex12(e.target.value) }))}
                  placeholder="Serial (12 hex chars)"
                  disabled={creating}
                  required
                />
                {createErrors.serial ? <p className="text-xs text-red-600">{createErrors.serial}</p> : null}
              </div>
              <div className="space-y-1">
                <Input
                  value={createForm.mac_address}
                  onChange={(e) => setCreateForm((prev) => ({ ...prev, mac_address: cleanHex12(e.target.value) }))}
                  placeholder="MAC (optional)"
                  disabled={creating}
                />
                {createErrors.mac ? <p className="text-xs text-red-600">{createErrors.mac}</p> : null}
              </div>
              <div className="space-y-1">
                <Input
                  value={createForm.c_number}
                  onChange={(e) => setCreateForm((prev) => ({ ...prev, c_number: cleanCNumber(e.target.value) }))}
                  placeholder="C-Number (optional)"
                  disabled={creating}
                />
                {createErrors.cNumber ? <p className="text-xs text-red-600">{createErrors.cNumber}</p> : null}
              </div>
              <Button type="submit" disabled={creating}>
                {creating ? "Adding..." : "Add Fridge"}
              </Button>
            </form>
            {createResult ? <p className="text-sm text-muted-foreground">{createResult}</p> : null}
          </div>
        </CardContent>
      </Card>

      {/* Bulk Upload */}
      <Card>
        <CardHeader>
          <CardTitle>Bulk Upload (CSV or Excel)</CardTitle>
          <CardDescription>
            Supported column names: fridge_serial_number or serial, optional mac_address and c_number.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col md:flex-row gap-3 md:items-center">
            <Input
              type="file"
              accept=".csv,.xls,.xlsx"
              onChange={(e) => {
                setBulkFile(e.target.files?.[0] || null);
                setBulkPreviewRows([]);
                setBulkPreviewSummary(null);
                setBulkErrors([]);
              }}
              disabled={bulkSubmitting}
            />
            <Button type="button" variant="outline" onClick={() => void previewBulkUpload()} disabled={bulkPreviewLoading || !bulkFile}>
              {bulkPreviewLoading ? "Previewing..." : "Preview File"}
            </Button>
            <Button type="button" onClick={() => void submitBulkUpload()} disabled={bulkSubmitting || !bulkFile}>
              {bulkSubmitting ? "Uploading..." : "Upload File"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => downloadCsv("fridge_bulk_template.csv", ["fridge_serial_number", "mac_address", "c_number"], [["A1B2C3D4E5F6", "001122AABBCC", "C10001"]])}
            >
              <Download className="h-4 w-4" />
              Download Template
            </Button>
          </div>

          {bulkMessage ? <p className="text-sm text-muted-foreground">{bulkMessage}</p> : null}

          {bulkErrors.length ? (
            <div className="max-h-40 overflow-auto rounded-md border p-2">
              {bulkErrors.slice(0, 20).map((item, index) => (
                <p key={`${item.rowNumber}-${item.reason}-${index}`} className="text-xs text-red-600">
                  Row {item.rowNumber}: {item.reason} {item.serial ? `(${item.serial})` : ""} - {item.message}
                </p>
              ))}
              {bulkErrors.length > 20 ? (
                <p className="text-xs text-muted-foreground mt-1">Showing first 20 errors of {bulkErrors.length}.</p>
              ) : null}
            </div>
          ) : null}

          {bulkPreviewSummary ? (
            <p className="text-xs text-muted-foreground">
              Preview rows included: {bulkPreviewSummary.previewRows} / {bulkPreviewSummary.totalRows} (excluded without serial: {bulkPreviewSummary.excludedRows})
            </p>
          ) : null}

          {bulkPreviewRows.length ? (
            <div className="rounded-md border overflow-auto max-h-60">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Row</TableHead>
                    <TableHead>Serial Number</TableHead>
                    <TableHead>MAC Address</TableHead>
                    <TableHead>C-Number</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {bulkPreviewRows.slice(0, 100).map((row) => (
                    <TableRow key={`${row.rowNumber}-${row.fridge_serial_number}`}>
                      <TableCell>{row.rowNumber}</TableCell>
                      <TableCell className="font-medium">{row.fridge_serial_number}</TableCell>
                      <TableCell>{row.mac_address || ""}</TableCell>
                      <TableCell>{row.c_number || ""}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {bulkPreviewRows.length > 100 ? (
                <p className="text-xs text-muted-foreground p-2 border-t">
                  Showing first 100 rows of {bulkPreviewRows.length}.
                </p>
              ) : null}
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
