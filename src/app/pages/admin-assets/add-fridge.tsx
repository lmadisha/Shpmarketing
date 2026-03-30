import { FormEvent, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { Button } from "../../components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "../../components/ui/table";
import { Download, Plus } from "lucide-react";
import { useAuth } from "../../auth/auth-context";
import { AccessDeniedCard } from "../../components/auth/access-denied-card";
import { validateAssetIdentifiers } from "../../lib/organisation-asset-validation";
import { useAdminAssets } from "./admin-assets-context";
import { normalizeHexIdentifier, normalizeCNumber, downloadExcel } from "./utils";

type BulkSkippedRow = {
  rowNumber: number;
  reason: string;
  message: string;
  serial?: string;
  upload_mac_address?: string | null;
  upload_c_number?: string | null;
  db_serial?: string | null;
  db_mac_address?: string | null;
  db_c_number?: string | null;
};

export function AddFridgePage() {
  const { session } = useAuth();
  const {
    loadFridges,
    loadAllHistory,
    searchTerm,
    adminRequest,
    canCreateAssets,
    canViewAssets,
    canViewHistory,
    actorOrganisationValidationRules,
    actorOrganisationValidationLoading,
  } = useAdminAssets();
  const organisationId = session?.user.organisation_id ?? null;

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
  const [bulkSkippedRows, setBulkSkippedRows] = useState<BulkSkippedRow[]>([]);
  const [skippedModalOpen, setSkippedModalOpen] = useState(false);
  const [bulkPreviewRows, setBulkPreviewRows] = useState<Array<{ rowNumber: number; fridge_serial_number: string; mac_address: string | null; c_number: string | null }>>([]);
  const [bulkPreviewSummary, setBulkPreviewSummary] = useState<{ totalRows: number; previewRows: number; excludedRows: number } | null>(null);

  const validateCreate = () => {
    const nextErrors: { serial?: string; mac?: string; cNumber?: string } = {};
    const serial = normalizeHexIdentifier(createForm.fridge_serial_number);
    const mac = createForm.mac_address ? normalizeHexIdentifier(createForm.mac_address) : "";
    const cNumber = createForm.c_number ? normalizeCNumber(createForm.c_number) : "";

    if (!actorOrganisationValidationRules) {
      setCreateErrors({ serial: "Could not load organisation validation rules." });
      return { isValid: false, serial, mac, cNumber };
    }

    const validationErrors = validateAssetIdentifiers(
      {
        fridge_serial_number: serial,
        mac_address: mac,
        c_number: cNumber,
      },
      actorOrganisationValidationRules,
      { requireSerial: true },
    );

    if (validationErrors.fridge_serial_number) nextErrors.serial = validationErrors.fridge_serial_number;
    if (validationErrors.mac_address) nextErrors.mac = validationErrors.mac_address;
    if (validationErrors.c_number) nextErrors.cNumber = validationErrors.c_number;

    setCreateErrors(nextErrors);
    return { isValid: Object.keys(nextErrors).length === 0, serial, mac, cNumber };
  };

  const submitCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (actorOrganisationValidationLoading) {
      setCreateResult("Validation rules are still loading. Please wait.");
      return;
    }
    const { isValid, serial, mac, cNumber } = validateCreate();
    if (!isValid) return;
    if (!organisationId) {
      setCreateResult("Could not add fridge. Your account has no organisation assigned.");
      return;
    }

    setCreating(true);
    setCreateResult("");
    try {
      await adminRequest("createFridge", "/newDevice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fridge_serial_number: serial,
          mac_address: mac,
          c_number: cNumber,
          organisation_id: organisationId,
        }),
      });
      setCreateForm({ fridge_serial_number: "", mac_address: "", c_number: "" });
      setCreateErrors({});
      setCreateResult("Fridge added successfully.");
      if (canViewAssets) {
        await loadFridges(searchTerm);
      }
      if (canViewHistory) {
        await loadAllHistory();
      }
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
    setBulkSkippedRows([]);
    setSkippedModalOpen(false);
    setBulkPreviewRows([]);
    setBulkPreviewSummary(null);
    try {
      const formData = new FormData();
      formData.append("file", bulkFile);
      if (organisationId) {
        formData.append("organisation_id", String(organisationId));
      }
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
    setBulkSkippedRows([]);
    setSkippedModalOpen(false);
    try {
      const formData = new FormData();
      formData.append("file", bulkFile);
      if (organisationId) {
        formData.append("organisation_id", String(organisationId));
      }
      const response = await adminRequest<{
        summary: { totalRows: number; excludedRows?: number; validRows: number; insertedRows: number; skippedRows?: number; failedRows: number };
        skippedRows?: BulkSkippedRow[];
        errors?: Array<{ rowNumber: number; reason: string; message: string; serial?: string }>;
      }>("bulkUpload", "/newDevice/bulk", { method: "POST", body: formData });
      const summary = response.summary;
      setBulkMessage(`Upload complete. Total: ${summary.totalRows}, Excluded(no serial): ${summary.excludedRows || 0}, Ready: ${summary.validRows}, Inserted: ${summary.insertedRows}, Skipped(existing): ${summary.skippedRows || 0}, Failed: ${summary.failedRows}`);
      const skipped = response.skippedRows || [];
      setBulkSkippedRows(skipped);
      if (skipped.length) {
        setSkippedModalOpen(true);
      }
      setBulkErrors(response.errors || []);
      if (canViewAssets) {
        await loadFridges(searchTerm);
      }
      if (canViewHistory) {
        await loadAllHistory();
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Bulk upload failed.";
      setBulkMessage(message);
    } finally {
      setBulkSubmitting(false);
    }
  };

  const downloadSkippedRowsReport = () => {
    if (!bulkSkippedRows.length) {
      return;
    }

    downloadExcel(
      `fridge_bulk_skipped_rows_${new Date().toISOString().slice(0, 10)}.xls`,
      "Skipped Rows",
      [
        "Upload Row",
        "Upload Serial",
        "Upload MAC Address",
        "Upload C-Number",
        "Database Serial",
        "Database MAC Address",
        "Database C-Number",
        "Reason",
        "Message",
      ],
      bulkSkippedRows.map((row) => [
        row.rowNumber,
        row.serial || "",
        row.upload_mac_address || "",
        row.upload_c_number || "",
        row.db_serial || "",
        row.db_mac_address || "",
        row.db_c_number || "",
        row.reason,
        row.message,
      ]),
    );
  };

  if (!canCreateAssets) {
    return (
      <AccessDeniedCard
        title="Add Fridge access denied"
        description="You do not have permission to create fridge records."
      />
    );
  }

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
                  onChange={(e) => {
                    setCreateErrors((prev) => ({ ...prev, serial: undefined }));
                    setCreateForm((prev) => ({ ...prev, fridge_serial_number: normalizeHexIdentifier(e.target.value) }));
                  }}
                  placeholder="Serial"
                  maxLength={actorOrganisationValidationRules?.serial_max_length}
                  disabled={creating || actorOrganisationValidationLoading}
                  required
                />
                {createErrors.serial ? <p className="text-xs text-red-600">{createErrors.serial}</p> : null}
              </div>
              <div className="space-y-1">
                <Input
                  value={createForm.mac_address}
                  onChange={(e) => {
                    setCreateErrors((prev) => ({ ...prev, mac: undefined }));
                    setCreateForm((prev) => ({ ...prev, mac_address: normalizeHexIdentifier(e.target.value) }));
                  }}
                  placeholder="MAC (optional)"
                  maxLength={actorOrganisationValidationRules?.mac_max_length}
                  disabled={creating || actorOrganisationValidationLoading}
                />
                {createErrors.mac ? <p className="text-xs text-red-600">{createErrors.mac}</p> : null}
              </div>
              <div className="space-y-1">
                <Input
                  value={createForm.c_number}
                  onChange={(e) => {
                    setCreateErrors((prev) => ({ ...prev, cNumber: undefined }));
                    setCreateForm((prev) => ({ ...prev, c_number: normalizeCNumber(e.target.value) }));
                  }}
                  placeholder="C-Number (optional)"
                  maxLength={actorOrganisationValidationRules?.c_number_max_length}
                  disabled={creating || actorOrganisationValidationLoading}
                />
                {createErrors.cNumber ? <p className="text-xs text-red-600">{createErrors.cNumber}</p> : null}
              </div>
              <Button type="submit" disabled={creating || actorOrganisationValidationLoading}>
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
                setBulkSkippedRows([]);
                setSkippedModalOpen(false);
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
              onClick={() =>
                downloadExcel(
                  "fridge_bulk_template.xls",
                  "Template",
                  ["fridge_serial_number", "mac_address", "c_number"],
                  [["A1B2C3D4E5F6", "001122AABBCC", "C10001"]],
                )
              }
            >
              <Download className="h-4 w-4" />
              Download Template
            </Button>
          </div>

          {bulkMessage ? <p className="text-sm text-muted-foreground">{bulkMessage}</p> : null}
          {actorOrganisationValidationLoading ? (
            <p className="text-xs text-muted-foreground">Loading organisation validation rules...</p>
          ) : null}

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

          {bulkSkippedRows.length ? (
            <div className="flex justify-end">
              <Button type="button" variant="outline" onClick={() => setSkippedModalOpen(true)}>
                View Skipped Rows ({bulkSkippedRows.length})
              </Button>
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

      <Dialog open={skippedModalOpen} onOpenChange={setSkippedModalOpen}>
        <DialogContent className="max-w-6xl">
          <DialogHeader>
            <DialogTitle>Skipped Rows Report</DialogTitle>
            <DialogDescription>
              These rows already exist in the database. Review the uploaded values against the database values, then download the report if needed.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[420px] overflow-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Row</TableHead>
                  <TableHead>Upload Serial</TableHead>
                  <TableHead>Upload MAC</TableHead>
                  <TableHead>Upload C-Number</TableHead>
                  <TableHead>DB Serial</TableHead>
                  <TableHead>DB MAC</TableHead>
                  <TableHead>DB C-Number</TableHead>
                  <TableHead>Reason</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bulkSkippedRows.map((item, index) => (
                  <TableRow key={`${item.rowNumber}-${item.serial || ""}-${index}`}>
                    <TableCell>{item.rowNumber}</TableCell>
                    <TableCell>{item.serial || "-"}</TableCell>
                    <TableCell>{item.upload_mac_address || "-"}</TableCell>
                    <TableCell>{item.upload_c_number || "-"}</TableCell>
                    <TableCell>{item.db_serial || "-"}</TableCell>
                    <TableCell>{item.db_mac_address || "-"}</TableCell>
                    <TableCell>{item.db_c_number || "-"}</TableCell>
                    <TableCell>{item.message}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={downloadSkippedRowsReport}>
              <Download className="h-4 w-4" />
              Download Report
            </Button>
            <Button type="button" variant="outline" onClick={() => setSkippedModalOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
