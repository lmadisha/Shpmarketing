import { FormEvent, useEffect, useMemo, useState } from "react";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Checkbox } from "../components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog";
import { Input } from "../components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";
import { Textarea } from "../components/ui/textarea";
import { ArrowUpDown, ChevronLeft, ChevronRight, Clock3, Download, Plus, RefreshCw, Save, Search, Trash2 } from "lucide-react";
import { useApiClient } from "../auth/use-api-client";
import { useAuth } from "../auth/auth-context";

type Fridge = {
  fridge_serial_number: string;
  iot_mac_address: string | null;
  c_number: string | null;
  verified: boolean;
};

type MismatchStatus = "open" | "resolve" | "cancel" | "delete" | "all";

type Mismatch = {
  id: number;
  fridge_serial_number: string;
  received_mac: string | null;
  received_c_number: string | null;
  expected_mac?: string | null;
  expected_c_number?: string | null;
  db_mac?: string | null;
  db_c_number?: string | null;
  status: "open" | "resolve" | "cancel" | "delete";
  received_at: string;
  resolved_at: string | null;
  resolved_by: number | null;
  resolution_note: string | null;
};

type AuditLogRow = {
  log_id: number;
  fridge_serial_number: string;
  action_type: "INSERT" | "UPDATE" | "DELETE";
  old_mac: string | null;
  new_mac: string | null;
  old_c_num: string | null;
  new_c_num: string | null;
  changed_at: string;
  changed_by: number | null;
};

type BulkPreviewRow = {
  rowNumber: number;
  fridge_serial_number: string;
  mac_address: string | null;
  c_number: string | null;
};

type SortDirection = "asc" | "desc";
type InventorySortKey = "fridge_serial_number" | "iot_mac_address" | "c_number" | "verified";
type MismatchSortKey = "received_at" | "fridge_serial_number" | "received_mac" | "received_c_number" | "expected" | "status";
type HistorySortKey = "changed_at" | "action_type" | "fridge_serial_number" | "old_mac" | "new_mac" | "old_c_num" | "new_c_num" | "changed_by";
type AdminApiRequestOptions = Omit<RequestInit, "headers"> & {
  headers?: HeadersInit;
};

const PAGE_SIZE = 10;
const ADMIN_ASSETS_LOG_PREFIX = "[admin-assets:api]";

function cleanHex12(value: string) {
  return (value || "").replace(/[^a-fA-F0-9]/g, "").toUpperCase().slice(0, 12);
}

function cleanCNumber(value: string) {
  return (value || "").trim().toUpperCase().slice(0, 10);
}

function toCsvValue(value: unknown) {
  const raw = value == null ? "" : String(value);
  const escaped = raw.replace(/"/g, '""');
  return `"${escaped}"`;
}

function downloadCsv(filename: string, headers: string[], rows: Array<Array<unknown>>) {
  const lines = [
    headers.map(toCsvValue).join(","),
    ...rows.map((row) => row.map(toCsvValue).join(",")),
  ];
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function compareValues(left: unknown, right: unknown) {
  const a = left ?? "";
  const b = right ?? "";

  if (typeof a === "boolean" && typeof b === "boolean") {
    return Number(a) - Number(b);
  }

  if (typeof a === "number" && typeof b === "number") {
    return a - b;
  }

  const aDate = Date.parse(String(a));
  const bDate = Date.parse(String(b));
  if (!Number.isNaN(aDate) && !Number.isNaN(bDate)) {
    return aDate - bDate;
  }

  return String(a).localeCompare(String(b), undefined, { sensitivity: "base" });
}

function summarizeRequestBody(body?: BodyInit | null) {
  if (!body) {
    return null;
  }

  if (typeof body === "string") {
    try {
      return JSON.parse(body);
    } catch {
      return body;
    }
  }

  if (body instanceof FormData) {
    return Array.from(body.entries()).map(([key, value]) => ({
      field: key,
      value:
        value instanceof File
          ? { fileName: value.name, size: value.size, type: value.type || "application/octet-stream" }
          : String(value),
    }));
  }

  if (body instanceof URLSearchParams) {
    return body.toString();
  }

  if (body instanceof Blob) {
    return { size: body.size, type: body.type || "application/octet-stream" };
  }

  return String(body);
}

function summarizeResponsePayload(payload: unknown) {
  if (Array.isArray(payload)) {
    return { type: "array", count: payload.length };
  }

  if (payload && typeof payload === "object") {
    const record = payload as Record<string, unknown>;
    const summary: Record<string, unknown> = {
      type: "object",
      keys: Object.keys(record),
    };

    if ("summary" in record) {
      summary.summary = record.summary;
    }

    if ("message" in record) {
      summary.message = record.message;
    }

    if ("error" in record) {
      summary.error = record.error;
    }

    if ("ok" in record) {
      summary.ok = record.ok;
    }

    return summary;
  }

  return payload;
}

export function AdminAssetsPage() {
  const { request } = useApiClient();
  const { session } = useAuth();

  const [fridges, setFridges] = useState<Fridge[]>([]);
  const [fridgeLoading, setFridgeLoading] = useState(false);
  const [fridgeError, setFridgeError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  const [createForm, setCreateForm] = useState({
    fridge_serial_number: "",
    mac_address: "",
    c_number: "",
  });
  const [createErrors, setCreateErrors] = useState<{ serial?: string; mac?: string; cNumber?: string }>({});
  const [creating, setCreating] = useState(false);
  const [bulkFile, setBulkFile] = useState<File | null>(null);
  const [bulkSubmitting, setBulkSubmitting] = useState(false);
  const [bulkPreviewLoading, setBulkPreviewLoading] = useState(false);
  const [bulkMessage, setBulkMessage] = useState("");
  const [bulkErrors, setBulkErrors] = useState<Array<{ rowNumber: number; reason: string; message: string; serial?: string }>>([]);
  const [bulkPreviewRows, setBulkPreviewRows] = useState<BulkPreviewRow[]>([]);
  const [bulkPreviewSummary, setBulkPreviewSummary] = useState<{
    totalRows: number;
    previewRows: number;
    excludedRows: number;
  } | null>(null);

  const [inventorySort, setInventorySort] = useState<{ key: InventorySortKey; direction: SortDirection }>({
    key: "fridge_serial_number",
    direction: "asc",
  });
  const [mismatchSort, setMismatchSort] = useState<{ key: MismatchSortKey; direction: SortDirection }>({
    key: "received_at",
    direction: "desc",
  });
  const [historySort, setHistorySort] = useState<{ key: HistorySortKey; direction: SortDirection }>({
    key: "changed_at",
    direction: "desc",
  });

  const [inventoryPage, setInventoryPage] = useState(1);
  const [mismatchPage, setMismatchPage] = useState(1);
  const [historyPage, setHistoryPage] = useState(1);

  const [editingSerial, setEditingSerial] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ mac_address: "", c_number: "" });
  const [savingEdit, setSavingEdit] = useState(false);
  const [deletingSerial, setDeletingSerial] = useState<string | null>(null);

  const [allHistory, setAllHistory] = useState<AuditLogRow[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState("");

  const [deviceHistoryOpen, setDeviceHistoryOpen] = useState(false);
  const [deviceHistorySerial, setDeviceHistorySerial] = useState("");
  const [deviceHistoryRows, setDeviceHistoryRows] = useState<AuditLogRow[]>([]);
  const [deviceHistoryLoading, setDeviceHistoryLoading] = useState(false);
  const [deviceHistoryError, setDeviceHistoryError] = useState("");

  const [mismatches, setMismatches] = useState<Mismatch[]>([]);
  const [mismatchLoading, setMismatchLoading] = useState(false);
  const [mismatchError, setMismatchError] = useState("");
  const [mismatchFilters, setMismatchFilters] = useState<{
    status: MismatchStatus;
    serial: string;
    from: string;
    to: string;
  }>({
    status: "open",
    serial: "",
    from: "",
    to: "",
  });

  const [resolveModal, setResolveModal] = useState<{
    open: boolean;
    row: Mismatch | null;
    applyToFridge: boolean;
    setVerified: boolean;
    note: string;
    submitting: boolean;
  }>({
    open: false,
    row: null,
    applyToFridge: false,
    setVerified: true,
    note: "",
    submitting: false,
  });

  const [deleteMismatchModal, setDeleteMismatchModal] = useState<{
    open: boolean;
    row: Mismatch | null;
    note: string;
    submitting: boolean;
  }>({
    open: false,
    row: null,
    note: "",
    submitting: false,
  });

  const actor = session?.user.full_name || session?.user.username || "Unknown";

  async function adminRequest<T>(
    action: string,
    path: string,
    options: AdminApiRequestOptions = {},
  ): Promise<T> {
    const method = String(options.method || "GET").toUpperCase();
    const startedAt = performance.now();
    const requestSummary = summarizeRequestBody(options.body);

    console.info(`${ADMIN_ASSETS_LOG_PREFIX} ${action} ${method} ${path} started`, {
      actor,
      requestBody: requestSummary,
    });

    try {
      const data = await request<T>(path, options);
      const durationMs = Math.round(performance.now() - startedAt);

      console.info(`${ADMIN_ASSETS_LOG_PREFIX} ${action} ${method} ${path} succeeded in ${durationMs}ms`, {
        actor,
        response: summarizeResponsePayload(data),
      });

      return data;
    } catch (error) {
      const durationMs = Math.round(performance.now() - startedAt);
      const message = error instanceof Error ? error.message : String(error);

      console.error(`${ADMIN_ASSETS_LOG_PREFIX} ${action} ${method} ${path} failed in ${durationMs}ms: ${message}`, {
        actor,
        requestBody: requestSummary,
      });

      throw error;
    }
  }

  const fridgeRows = useMemo(() => {
    return [...fridges];
  }, [fridges]);

  const sortedFridgeRows = useMemo(() => {
    const rows = [...fridgeRows];
    rows.sort((a, b) => {
      const left = a[inventorySort.key];
      const right = b[inventorySort.key];
      const result = compareValues(left, right);
      return inventorySort.direction === "asc" ? result : -result;
    });
    return rows;
  }, [fridgeRows, inventorySort]);

  const sortedMismatches = useMemo(() => {
    const rows = [...mismatches];
    rows.sort((a, b) => {
      const left =
        mismatchSort.key === "expected"
          ? `${a.expected_mac ?? a.db_mac ?? ""}|${a.expected_c_number ?? a.db_c_number ?? ""}`
          : a[mismatchSort.key];
      const right =
        mismatchSort.key === "expected"
          ? `${b.expected_mac ?? b.db_mac ?? ""}|${b.expected_c_number ?? b.db_c_number ?? ""}`
          : b[mismatchSort.key];
      const result = compareValues(left, right);
      return mismatchSort.direction === "asc" ? result : -result;
    });
    return rows;
  }, [mismatches, mismatchSort]);

  const sortedHistory = useMemo(() => {
    const rows = [...allHistory];
    rows.sort((a, b) => {
      const left = a[historySort.key];
      const right = b[historySort.key];
      const result = compareValues(left, right);
      return historySort.direction === "asc" ? result : -result;
    });
    return rows;
  }, [allHistory, historySort]);

  const inventoryTotalPages = Math.max(1, Math.ceil(sortedFridgeRows.length / PAGE_SIZE));
  const mismatchTotalPages = Math.max(1, Math.ceil(sortedMismatches.length / PAGE_SIZE));
  const historyTotalPages = Math.max(1, Math.ceil(sortedHistory.length / PAGE_SIZE));

  const safeInventoryPage = Math.min(inventoryPage, inventoryTotalPages);
  const safeMismatchPage = Math.min(mismatchPage, mismatchTotalPages);
  const safeHistoryPage = Math.min(historyPage, historyTotalPages);

  const paginatedFridgeRows = useMemo(() => {
    const start = (safeInventoryPage - 1) * PAGE_SIZE;
    return sortedFridgeRows.slice(start, start + PAGE_SIZE);
  }, [safeInventoryPage, sortedFridgeRows]);

  const paginatedMismatches = useMemo(() => {
    const start = (safeMismatchPage - 1) * PAGE_SIZE;
    return sortedMismatches.slice(start, start + PAGE_SIZE);
  }, [safeMismatchPage, sortedMismatches]);

  const paginatedHistory = useMemo(() => {
    const start = (safeHistoryPage - 1) * PAGE_SIZE;
    return sortedHistory.slice(start, start + PAGE_SIZE);
  }, [safeHistoryPage, sortedHistory]);

  const inventoryCsvRows = useMemo(() => {
    return sortedFridgeRows.map((row) => [
      row.fridge_serial_number,
      row.iot_mac_address || "",
      row.c_number || "",
      row.verified ? "Verified" : "Not Verified",
    ]);
  }, [sortedFridgeRows]);

  const mismatchCsvRows = useMemo(() => {
    return sortedMismatches.map((row) => [
      row.received_at,
      row.fridge_serial_number,
      row.received_mac || "",
      row.expected_mac ?? row.db_mac ?? "",
      row.received_c_number || "",
      row.expected_c_number ?? row.db_c_number ?? "",
      row.status,
      row.resolved_at || "",
      row.resolved_by || "",
      row.resolution_note || "",
    ]);
  }, [sortedMismatches]);

  useEffect(() => {
    setInventoryPage(1);
  }, [fridgeRows.length]);

  useEffect(() => {
    setMismatchPage(1);
  }, [mismatches.length]);

  useEffect(() => {
    setHistoryPage(1);
  }, [allHistory.length]);

  const toggleInventorySort = (key: InventorySortKey) => {
    setInventorySort((prev) => ({
      key,
      direction: prev.key === key && prev.direction === "asc" ? "desc" : "asc",
    }));
  };

  const toggleMismatchSort = (key: MismatchSortKey) => {
    setMismatchSort((prev) => ({
      key,
      direction: prev.key === key && prev.direction === "asc" ? "desc" : "asc",
    }));
  };

  const toggleHistorySort = (key: HistorySortKey) => {
    setHistorySort((prev) => ({
      key,
      direction: prev.key === key && prev.direction === "asc" ? "desc" : "asc",
    }));
  };

  const validateCreate = () => {
    const nextErrors: { serial?: string; mac?: string; cNumber?: string } = {};
    const serial = cleanHex12(createForm.fridge_serial_number);
    const mac = createForm.mac_address ? cleanHex12(createForm.mac_address) : "";
    const cNumber = createForm.c_number ? cleanCNumber(createForm.c_number) : "";

    if (serial.length !== 12) {
      nextErrors.serial = "Serial must be exactly 12 hex characters.";
    }

    if (mac && mac.length !== 12) {
      nextErrors.mac = "MAC must be exactly 12 hex characters when provided.";
    }

    if (cNumber.length > 10) {
      nextErrors.cNumber = "C-number cannot exceed 10 characters.";
    }

    setCreateErrors(nextErrors);
    return { isValid: Object.keys(nextErrors).length === 0, serial, mac, cNumber };
  };

  const loadFridges = async (query?: string) => {
    setFridgeLoading(true);
    setFridgeError("");

    try {
      const term = (query ?? "").trim();
      const data = term
        ? await adminRequest<Fridge[]>("loadFridges.search", `/searchFridges?searchTerm=${encodeURIComponent(term)}`)
        : await adminRequest<Fridge[]>("loadFridges.list", "/getFridges");
      setFridges(Array.isArray(data) ? data : []);
    } catch {
      setFridgeError("Could not load fridge inventory.");
    } finally {
      setFridgeLoading(false);
    }
  };

  const loadAllHistory = async () => {
    setHistoryLoading(true);
    setHistoryError("");

    try {
      const data = await adminRequest<AuditLogRow[]>("loadHistory.global", "/auditLog");
      setAllHistory(Array.isArray(data) ? data : []);
    } catch {
      setHistoryError("Could not load change history.");
    } finally {
      setHistoryLoading(false);
    }
  };

  const loadDeviceHistory = async (serial: string) => {
    const normalizedSerial = serial.trim().toUpperCase();
    const cachedRows = allHistory.filter(
      (row) => String(row.fridge_serial_number || "").trim().toUpperCase() === normalizedSerial,
    );

    setDeviceHistoryLoading(true);
    setDeviceHistorySerial(serial);
    setDeviceHistoryRows(cachedRows);
    setDeviceHistoryError("");
    setDeviceHistoryOpen(true);

    try {
      const data = await adminRequest<AuditLogRow[]>(
        "loadHistory.device",
        `/auditLog/${encodeURIComponent(serial)}`,
      );
      setDeviceHistoryRows(Array.isArray(data) ? data : []);
    } catch {
      if (cachedRows.length) {
        setDeviceHistoryError("Showing cached device history. Live refresh failed.");
      } else {
        setDeviceHistoryError("Could not load device history.");
      }
    } finally {
      setDeviceHistoryLoading(false);
    }
  };

  const loadMismatches = async () => {
    setMismatchLoading(true);
    setMismatchError("");

    try {
      const params = new URLSearchParams();
      if (mismatchFilters.status) params.set("status", mismatchFilters.status);
      if (mismatchFilters.serial.trim()) params.set("serial", mismatchFilters.serial.trim());
      if (mismatchFilters.from) params.set("from", mismatchFilters.from);
      if (mismatchFilters.to) params.set("to", mismatchFilters.to);

      const data = await adminRequest<Mismatch[]>("loadMismatches", `/mismatches?${params.toString()}`);
      setMismatches(Array.isArray(data) ? data : []);
    } catch {
      setMismatchError("Could not load mismatches.");
    } finally {
      setMismatchLoading(false);
    }
  };

  useEffect(() => {
    void loadFridges();
    void loadAllHistory();
    void loadMismatches();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submitCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const { isValid, serial, mac, cNumber } = validateCreate();
    if (!isValid) return;

    setCreating(true);
    setFridgeError("");

    try {
      await adminRequest<Fridge>("createFridge", "/newDevice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fridge_serial_number: serial,
          mac_address: mac,
          c_number: cNumber,
        }),
      });

      setCreateForm({ fridge_serial_number: "", mac_address: "", c_number: "" });
      setCreateErrors({});
      await loadFridges(searchTerm);
      await loadAllHistory();
    } catch {
      setFridgeError("Could not add fridge. Check duplicates and try again.");
    } finally {
      setCreating(false);
    }
  };

  const submitBulkUpload = async () => {
    if (!bulkFile) {
      setBulkMessage("Please choose a CSV or Excel file first.");
      return;
    }

    setBulkSubmitting(true);
    setBulkMessage("");
    setBulkErrors([]);
    setFridgeError("");

    try {
      const formData = new FormData();
      formData.append("file", bulkFile);

      const response = await adminRequest<{
        summary: { totalRows: number; excludedRows?: number; validRows: number; insertedRows: number; failedRows: number };
        errors?: Array<{ rowNumber: number; reason: string; message: string; serial?: string }>;
      }>("bulkUpload", "/newDevice/bulk", {
        method: "POST",
        body: formData,
      });

      const summary = response.summary;
      setBulkMessage(
        `Upload complete. Total: ${summary.totalRows}, Excluded(no serial): ${summary.excludedRows || 0}, Ready: ${summary.validRows}, Inserted: ${summary.insertedRows}, Failed: ${summary.failedRows}`,
      );
      setBulkErrors(response.errors || []);

      await loadFridges(searchTerm);
      await loadAllHistory();
    } catch (error) {
      console.error(error);
      const message = error instanceof Error ? error.message : "Bulk upload failed.";
      setBulkMessage(message);
    } finally {
      setBulkSubmitting(false);
    }
  };

  const previewBulkUpload = async () => {
    if (!bulkFile) {
      setBulkMessage("Please choose a CSV or Excel file first.");
      return;
    }

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
        rows: BulkPreviewRow[];
      }>("bulkPreview", "/newDevice/bulk/preview", {
        method: "POST",
        body: formData,
      });

      setBulkPreviewRows(Array.isArray(response.rows) ? response.rows : []);
      setBulkPreviewSummary(response.summary);
      setBulkMessage(
        `Preview ready. Total: ${response.summary.totalRows}, Included: ${response.summary.previewRows}, Excluded(no serial): ${response.summary.excludedRows}`,
      );
    } catch (error) {
      console.error(error);
      const message = error instanceof Error ? error.message : "Bulk preview failed.";
      setBulkMessage(message);
    } finally {
      setBulkPreviewLoading(false);
    }
  };

  const startEdit = (row: Fridge) => {
    setEditingSerial(row.fridge_serial_number);
    setEditForm({
      mac_address: row.iot_mac_address || "",
      c_number: row.c_number || "",
    });
  };

  const cancelEdit = () => {
    setEditingSerial(null);
    setEditForm({ mac_address: "", c_number: "" });
  };

  const submitEdit = async (serial: string) => {
    const mac = editForm.mac_address ? cleanHex12(editForm.mac_address) : "";
    const cNumber = editForm.c_number ? cleanCNumber(editForm.c_number) : "";

    if (mac && mac.length !== 12) {
      setFridgeError("MAC must be exactly 12 hex characters when provided.");
      return;
    }

    setSavingEdit(true);
    setFridgeError("");

    try {
      await adminRequest<Fridge>("updateFridge", `/updateDevice/${encodeURIComponent(serial)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mac_address: mac, c_number: cNumber }),
      });

      cancelEdit();
      await loadFridges(searchTerm);
      await loadAllHistory();
    } catch {
      setFridgeError("Could not update fridge details.");
    } finally {
      setSavingEdit(false);
    }
  };

  const deleteFridge = async (serial: string) => {
    setDeletingSerial(serial);
    setFridgeError("");

    try {
      await adminRequest("deleteFridge", `/deleteDevice/${encodeURIComponent(serial)}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
      });

      await loadFridges(searchTerm);
      await loadAllHistory();
    } catch {
      setFridgeError("Could not delete fridge.");
    } finally {
      setDeletingSerial(null);
    }
  };

  const openResolveMismatch = (row: Mismatch) => {
    setResolveModal({
      open: true,
      row,
      applyToFridge: false,
      setVerified: true,
      note: "",
      submitting: false,
    });
  };

  const submitResolveMismatch = async () => {
    if (!resolveModal.row) return;

    setResolveModal((prev) => ({ ...prev, submitting: true }));
    setMismatchError("");

    try {
      await adminRequest("resolveMismatch", `/mismatches/${resolveModal.row.id}/resolve`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          applyToFridge: resolveModal.applyToFridge,
          setVerified: resolveModal.setVerified,
          note: resolveModal.note,
        }),
      });

      setResolveModal({
        open: false,
        row: null,
        applyToFridge: false,
        setVerified: true,
        note: "",
        submitting: false,
      });
      await loadMismatches();
      await loadFridges(searchTerm);
      await loadAllHistory();
    } catch {
      setMismatchError("Could not resolve mismatch.");
      setResolveModal((prev) => ({ ...prev, submitting: false }));
    }
  };

  const openDeleteMismatch = (row: Mismatch) => {
    setDeleteMismatchModal({ open: true, row, note: "", submitting: false });
  };

  const submitDeleteMismatch = async () => {
    if (!deleteMismatchModal.row) return;
    if (!deleteMismatchModal.note.trim()) {
      setMismatchError("Delete reason is required.");
      return;
    }

    setDeleteMismatchModal((prev) => ({ ...prev, submitting: true }));
    setMismatchError("");

    try {
      await adminRequest("deleteMismatch", `/mismatches/${deleteMismatchModal.row.id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: deleteMismatchModal.note.trim() }),
      });

      setDeleteMismatchModal({ open: false, row: null, note: "", submitting: false });
      await loadMismatches();
    } catch {
      setMismatchError("Could not delete mismatch.");
      setDeleteMismatchModal((prev) => ({ ...prev, submitting: false }));
    }
  };

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-[1440px] mx-auto space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Asset Manager</CardTitle>
          <CardDescription>
            This is where user are able to store, add, view, delete fridges.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="add-fridge" className="space-y-4">
            <TabsList className="w-full sm:w-auto grid grid-cols-4 sm:inline-flex">
              <TabsTrigger value="add-fridge">Add Fridge</TabsTrigger>
              <TabsTrigger value="inventory">Inventory</TabsTrigger>
              <TabsTrigger value="mismatches">Mismatches</TabsTrigger>
              <TabsTrigger value="history">History</TabsTrigger>
            </TabsList>

            <TabsContent value="add-fridge">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Plus className="h-4 w-4" />
                    Add New Fridge
                  </CardTitle>
                  <CardDescription>Register a new device identity.</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    <div className="space-y-3">
                      <p className="text-sm font-medium">Single Fridge</p>
                      <form onSubmit={submitCreate} className="grid grid-cols-1 md:grid-cols-4 gap-3">
                        <div className="space-y-1">
                          <Input
                            value={createForm.fridge_serial_number}
                            onChange={(event) =>
                              setCreateForm((prev) => ({
                                ...prev,
                                fridge_serial_number: cleanHex12(event.target.value),
                              }))
                            }
                            placeholder="Serial (12 hex chars)"
                            disabled={creating}
                            required
                          />
                          {createErrors.serial ? <p className="text-xs text-red-600">{createErrors.serial}</p> : null}
                        </div>

                        <div className="space-y-1">
                          <Input
                            value={createForm.mac_address}
                            onChange={(event) =>
                              setCreateForm((prev) => ({ ...prev, mac_address: cleanHex12(event.target.value) }))
                            }
                            placeholder="MAC (optional)"
                            disabled={creating}
                          />
                          {createErrors.mac ? <p className="text-xs text-red-600">{createErrors.mac}</p> : null}
                        </div>

                        <div className="space-y-1">
                          <Input
                            value={createForm.c_number}
                            onChange={(event) =>
                              setCreateForm((prev) => ({ ...prev, c_number: cleanCNumber(event.target.value) }))
                            }
                            placeholder="C-Number (optional)"
                            disabled={creating}
                          />
                          {createErrors.cNumber ? <p className="text-xs text-red-600">{createErrors.cNumber}</p> : null}
                        </div>

                        <Button type="submit" disabled={creating}>
                          {creating ? "Adding..." : "Add Fridge"}
                        </Button>
                      </form>
                    </div>

                    <div className="border-t pt-4 space-y-3">
                      <p className="text-sm font-medium">Bulk Upload (CSV or Excel)</p>
                      <p className="text-xs text-muted-foreground">
                        Supported column names: fridge_serial_number or serial, optional mac_address and c_number.
                      </p>
                      <div className="flex flex-col md:flex-row gap-3 md:items-center">
                        <Input
                          type="file"
                          accept=".csv,.xls,.xlsx"
                          onChange={(event) => {
                            setBulkFile(event.target.files?.[0] || null);
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
                          onClick={() =>
                            downloadCsv(
                              "fridge_bulk_template.csv",
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

                      {bulkErrors.length ? (
                        <div className="max-h-40 overflow-auto rounded-md border p-2">
                          {bulkErrors.slice(0, 20).map((item, index) => (
                            <p key={`${item.rowNumber}-${item.reason}-${index}`} className="text-xs text-red-600">
                              Row {item.rowNumber}: {item.reason} {item.serial ? `(${item.serial})` : ""} - {item.message}
                            </p>
                          ))}
                          {bulkErrors.length > 20 ? (
                            <p className="text-xs text-muted-foreground mt-1">
                              Showing first 20 errors of {bulkErrors.length}.
                            </p>
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
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="inventory">
              <Card>
                <CardHeader>
                  <CardTitle>Fridge Inventory</CardTitle>
                  <CardDescription>Search, update, delete, and inspect per-device history.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex flex-col lg:flex-row gap-3">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        value={searchTerm}
                        onChange={(event) => setSearchTerm(event.target.value)}
                        placeholder="Search by serial, MAC, or C-number"
                        className="pl-9"
                      />
                    </div>
                    <Button variant="outline" disabled={fridgeLoading} onClick={() => void loadFridges(searchTerm)}>
                      <Search className="h-4 w-4" />
                      Apply Search
                    </Button>
                    <Button
                      variant="outline"
                      disabled={fridgeLoading}
                      onClick={() => {
                        setSearchTerm("");
                        void loadFridges("");
                      }}
                    >
                      <RefreshCw className="h-4 w-4" />
                      Reset
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() =>
                        downloadCsv(
                          `fridges_${new Date().toISOString().slice(0, 10)}.csv`,
                          ["Serial Number", "MAC Address", "C-Number", "Verified"],
                          inventoryCsvRows,
                        )
                      }
                    >
                      <Download className="h-4 w-4" />
                      Download CSV
                    </Button>
                  </div>

                  {fridgeError ? <p className="text-sm text-red-600">{fridgeError}</p> : null}

                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>
                          <Button variant="ghost" size="sm" onClick={() => toggleInventorySort("fridge_serial_number")}>
                            Serial
                            <ArrowUpDown className="h-4 w-4" />
                          </Button>
                        </TableHead>
                        <TableHead>
                          <Button variant="ghost" size="sm" onClick={() => toggleInventorySort("iot_mac_address")}>
                            MAC
                            <ArrowUpDown className="h-4 w-4" />
                          </Button>
                        </TableHead>
                        <TableHead>
                          <Button variant="ghost" size="sm" onClick={() => toggleInventorySort("c_number")}>
                            C-Number
                            <ArrowUpDown className="h-4 w-4" />
                          </Button>
                        </TableHead>
                        <TableHead>
                          <Button variant="ghost" size="sm" onClick={() => toggleInventorySort("verified")}>
                            Verified
                            <ArrowUpDown className="h-4 w-4" />
                          </Button>
                        </TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedFridgeRows.map((row) => {
                        const isEditing = editingSerial === row.fridge_serial_number;
                        return (
                          <TableRow key={row.fridge_serial_number}>
                            <TableCell className="font-medium">{row.fridge_serial_number}</TableCell>
                            <TableCell>
                              {isEditing ? (
                                <Input
                                  value={editForm.mac_address}
                                  onChange={(event) =>
                                    setEditForm((prev) => ({
                                      ...prev,
                                      mac_address: cleanHex12(event.target.value),
                                    }))
                                  }
                                  placeholder="MAC"
                                />
                              ) : (
                                row.iot_mac_address || "-"
                              )}
                            </TableCell>
                            <TableCell>
                              {isEditing ? (
                                <Input
                                  value={editForm.c_number}
                                  onChange={(event) =>
                                    setEditForm((prev) => ({
                                      ...prev,
                                      c_number: cleanCNumber(event.target.value),
                                    }))
                                  }
                                  placeholder="C-number"
                                />
                              ) : (
                                row.c_number || "-"
                              )}
                            </TableCell>
                            <TableCell>
                              <Badge variant={row.verified ? "default" : "outline"}>
                                {row.verified ? "Verified" : "Not Verified"}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="inline-flex gap-2 flex-wrap justify-end">
                                {isEditing ? (
                                  <>
                                    <Button
                                      size="sm"
                                      onClick={() => void submitEdit(row.fridge_serial_number)}
                                      disabled={savingEdit}
                                    >
                                      <Save className="h-4 w-4" />
                                      Save
                                    </Button>
                                    <Button size="sm" variant="outline" onClick={cancelEdit}>
                                      Cancel
                                    </Button>
                                  </>
                                ) : (
                                  <Button size="sm" variant="outline" onClick={() => startEdit(row)}>
                                    Edit
                                  </Button>
                                )}

                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => void loadDeviceHistory(row.fridge_serial_number)}
                                  disabled={
                                    deviceHistoryLoading && deviceHistorySerial === row.fridge_serial_number
                                  }
                                >
                                  <Clock3 className="h-4 w-4" />
                                  History
                                </Button>

                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => void deleteFridge(row.fridge_serial_number)}
                                  disabled={deletingSerial === row.fridge_serial_number}
                                >
                                  <Trash2 className="h-4 w-4" />
                                  Delete
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}

                      {!fridgeLoading && sortedFridgeRows.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center text-muted-foreground py-10">
                            No fridge rows found.
                          </TableCell>
                        </TableRow>
                      ) : null}
                    </TableBody>
                  </Table>

                  <div className="flex items-center justify-end gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setInventoryPage((prev) => Math.max(1, prev - 1))}
                      disabled={safeInventoryPage <= 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-sm text-muted-foreground">
                      Page {safeInventoryPage} of {inventoryTotalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setInventoryPage((prev) => Math.min(inventoryTotalPages, prev + 1))}
                      disabled={safeInventoryPage >= inventoryTotalPages}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="mismatches">
              <Card>
                <CardHeader>
                  <CardTitle>Mismatches</CardTitle>
                  <CardDescription>
                    Resolve mobile scan discrepancies between received and expected values.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                    <Select
                      value={mismatchFilters.status}
                      onValueChange={(value) =>
                        setMismatchFilters((prev) => ({ ...prev, status: value as MismatchStatus }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="open">Open</SelectItem>
                        <SelectItem value="resolve">Resolve</SelectItem>
                        <SelectItem value="cancel">Cancel</SelectItem>
                        <SelectItem value="delete">Delete</SelectItem>
                        <SelectItem value="all">All</SelectItem>
                      </SelectContent>
                    </Select>

                    <Input
                      value={mismatchFilters.serial}
                      onChange={(event) =>
                        setMismatchFilters((prev) => ({ ...prev, serial: event.target.value }))
                      }
                      placeholder="Serial contains"
                    />

                    <Input
                      type="date"
                      value={mismatchFilters.from}
                      onChange={(event) =>
                        setMismatchFilters((prev) => ({ ...prev, from: event.target.value }))
                      }
                    />

                    <Input
                      type="date"
                      value={mismatchFilters.to}
                      onChange={(event) =>
                        setMismatchFilters((prev) => ({ ...prev, to: event.target.value }))
                      }
                    />

                    <div className="flex gap-2">
                      <Button className="flex-1" variant="outline" onClick={() => void loadMismatches()}>
                        <Search className="h-4 w-4" />
                        Apply
                      </Button>
                      <Button
                        className="flex-1"
                        variant="outline"
                        onClick={() => {
                          setMismatchFilters({ status: "open", serial: "", from: "", to: "" });
                          void loadMismatches();
                        }}
                      >
                        <RefreshCw className="h-4 w-4" />
                        Clear
                      </Button>
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <Button
                      variant="outline"
                      onClick={() =>
                        downloadCsv(
                          `mismatches_${new Date().toISOString().slice(0, 10)}_status_${mismatchFilters.status}.csv`,
                          [
                            "Received At",
                            "Serial",
                            "Received MAC",
                            "Expected MAC",
                            "Received C-Number",
                            "Expected C-Number",
                            "Status",
                            "Resolved At",
                            "Resolved By",
                            "Note",
                          ],
                          mismatchCsvRows,
                        )
                      }
                    >
                      <Download className="h-4 w-4" />
                      Download CSV
                    </Button>
                  </div>

                  {mismatchError ? <p className="text-sm text-red-600">{mismatchError}</p> : null}

                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>
                          <Button variant="ghost" size="sm" onClick={() => toggleMismatchSort("received_at")}>
                            Received At
                            <ArrowUpDown className="h-4 w-4" />
                          </Button>
                        </TableHead>
                        <TableHead>
                          <Button variant="ghost" size="sm" onClick={() => toggleMismatchSort("fridge_serial_number")}>
                            Serial
                            <ArrowUpDown className="h-4 w-4" />
                          </Button>
                        </TableHead>
                        <TableHead>
                          <Button variant="ghost" size="sm" onClick={() => toggleMismatchSort("received_mac")}>
                            Received MAC / C
                            <ArrowUpDown className="h-4 w-4" />
                          </Button>
                        </TableHead>
                        <TableHead>
                          <Button variant="ghost" size="sm" onClick={() => toggleMismatchSort("expected")}>
                            Expected MAC / C
                            <ArrowUpDown className="h-4 w-4" />
                          </Button>
                        </TableHead>
                        <TableHead>
                          <Button variant="ghost" size="sm" onClick={() => toggleMismatchSort("status")}>
                            Status
                            <ArrowUpDown className="h-4 w-4" />
                          </Button>
                        </TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedMismatches.map((row) => {
                        const expectedMac = row.expected_mac ?? row.db_mac ?? "-";
                        const expectedC = row.expected_c_number ?? row.db_c_number ?? "-";
                        const canMutate = row.status === "open";

                        return (
                          <TableRow key={row.id}>
                            <TableCell>{new Date(row.received_at).toLocaleString()}</TableCell>
                            <TableCell className="font-medium">{row.fridge_serial_number}</TableCell>
                            <TableCell>
                              <div className="text-sm">MAC: {row.received_mac || "-"}</div>
                              <div className="text-sm">C: {row.received_c_number || "-"}</div>
                            </TableCell>
                            <TableCell>
                              <div className="text-sm">MAC: {expectedMac}</div>
                              <div className="text-sm">C: {expectedC}</div>
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant={
                                  row.status === "open"
                                    ? "destructive"
                                    : row.status === "resolve"
                                      ? "default"
                                      : row.status === "cancel"
                                        ? "secondary"
                                        : "outline"
                                }
                              >
                                {row.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="inline-flex gap-2 flex-wrap justify-end">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  disabled={!canMutate}
                                  onClick={() => openResolveMismatch(row)}
                                >
                                  Resolve
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  disabled={!canMutate}
                                  onClick={() => openDeleteMismatch(row)}
                                >
                                  Delete
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}

                      {!mismatchLoading && sortedMismatches.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center text-muted-foreground py-10">
                            No mismatches found.
                          </TableCell>
                        </TableRow>
                      ) : null}
                    </TableBody>
                  </Table>

                  <div className="flex items-center justify-end gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setMismatchPage((prev) => Math.max(1, prev - 1))}
                      disabled={safeMismatchPage <= 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-sm text-muted-foreground">
                      Page {safeMismatchPage} of {mismatchTotalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setMismatchPage((prev) => Math.min(mismatchTotalPages, prev + 1))}
                      disabled={safeMismatchPage >= mismatchTotalPages}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="history">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Clock3 className="h-4 w-4" />
                    Global Change History
                  </CardTitle>
                  <CardDescription>Most recent device changes first.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-end">
                    <Button variant="outline" disabled={historyLoading} onClick={() => void loadAllHistory()}>
                      <RefreshCw className="h-4 w-4" />
                      Refresh
                    </Button>
                  </div>

                  {historyError ? <p className="text-sm text-red-600">{historyError}</p> : null}

                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>
                          <Button variant="ghost" size="sm" onClick={() => toggleHistorySort("changed_at")}>
                            Time
                            <ArrowUpDown className="h-4 w-4" />
                          </Button>
                        </TableHead>
                        <TableHead>
                          <Button variant="ghost" size="sm" onClick={() => toggleHistorySort("action_type")}>
                            Action
                            <ArrowUpDown className="h-4 w-4" />
                          </Button>
                        </TableHead>
                        <TableHead>
                          <Button variant="ghost" size="sm" onClick={() => toggleHistorySort("fridge_serial_number")}>
                            Serial
                            <ArrowUpDown className="h-4 w-4" />
                          </Button>
                        </TableHead>
                        <TableHead>
                          <Button variant="ghost" size="sm" onClick={() => toggleHistorySort("new_mac")}>
                            Old → New MAC
                            <ArrowUpDown className="h-4 w-4" />
                          </Button>
                        </TableHead>
                        <TableHead>
                          <Button variant="ghost" size="sm" onClick={() => toggleHistorySort("new_c_num")}>
                            Old → New C
                            <ArrowUpDown className="h-4 w-4" />
                          </Button>
                        </TableHead>
                        <TableHead>
                          <Button variant="ghost" size="sm" onClick={() => toggleHistorySort("changed_by")}>
                            User
                            <ArrowUpDown className="h-4 w-4" />
                          </Button>
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedHistory.map((entry) => (
                        <TableRow key={entry.log_id}>
                          <TableCell>{new Date(entry.changed_at).toLocaleString()}</TableCell>
                          <TableCell>
                            <Badge variant={entry.action_type === "UPDATE" ? "secondary" : "default"}>
                              {entry.action_type}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-medium">{entry.fridge_serial_number}</TableCell>
                          <TableCell>
                            {entry.old_mac || "-"} → {entry.new_mac || "-"}
                          </TableCell>
                          <TableCell>
                            {entry.old_c_num || "-"} → {entry.new_c_num || "-"}
                          </TableCell>
                          <TableCell>{entry.changed_by ?? "system"}</TableCell>
                        </TableRow>
                      ))}

                      {!historyLoading && sortedHistory.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center text-muted-foreground py-10">
                            No history entries found.
                          </TableCell>
                        </TableRow>
                      ) : null}
                    </TableBody>
                  </Table>

                  <div className="flex items-center justify-end gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setHistoryPage((prev) => Math.max(1, prev - 1))}
                      disabled={safeHistoryPage <= 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-sm text-muted-foreground">
                      Page {safeHistoryPage} of {historyTotalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setHistoryPage((prev) => Math.min(historyTotalPages, prev + 1))}
                      disabled={safeHistoryPage >= historyTotalPages}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <Dialog open={deviceHistoryOpen} onOpenChange={setDeviceHistoryOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Device History: {deviceHistorySerial}</DialogTitle>
            <DialogDescription>Per-device audit records ordered by newest first.</DialogDescription>
          </DialogHeader>

          {deviceHistoryError ? (
            <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
              {deviceHistoryError}
            </p>
          ) : null}

          <div className="max-h-[420px] overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Time</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Old → New MAC</TableHead>
                  <TableHead>Old → New C</TableHead>
                  <TableHead>User</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {deviceHistoryRows.map((entry) => (
                  <TableRow key={entry.log_id}>
                    <TableCell>{new Date(entry.changed_at).toLocaleString()}</TableCell>
                    <TableCell>{entry.action_type}</TableCell>
                    <TableCell>
                      {entry.old_mac || "-"} → {entry.new_mac || "-"}
                    </TableCell>
                    <TableCell>
                      {entry.old_c_num || "-"} → {entry.new_c_num || "-"}
                    </TableCell>
                    <TableCell>{entry.changed_by ?? "system"}</TableCell>
                  </TableRow>
                ))}

                {!deviceHistoryLoading && deviceHistoryRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                      No entries for this device.
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDeviceHistoryOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={resolveModal.open}
        onOpenChange={(open) => setResolveModal((prev) => ({ ...prev, open }))}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Resolve Mismatch</DialogTitle>
            <DialogDescription>
              Decide whether to apply incoming values back to the fridge record.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={resolveModal.applyToFridge}
                onCheckedChange={(checked) =>
                  setResolveModal((prev) => ({ ...prev, applyToFridge: checked === true }))
                }
              />
              Apply received values to fridge record
            </label>

            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={resolveModal.setVerified}
                disabled={!resolveModal.applyToFridge}
                onCheckedChange={(checked) =>
                  setResolveModal((prev) => ({ ...prev, setVerified: checked === true }))
                }
              />
              Mark fridge as verified
            </label>

            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Resolution note (optional)</p>
              <Textarea
                value={resolveModal.note}
                onChange={(event) =>
                  setResolveModal((prev) => ({ ...prev, note: event.target.value }))
                }
                placeholder="Reason or context for this resolution"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() =>
                setResolveModal({
                  open: false,
                  row: null,
                  applyToFridge: false,
                  setVerified: true,
                  note: "",
                  submitting: false,
                })
              }
            >
              Cancel
            </Button>
            <Button onClick={() => void submitResolveMismatch()} disabled={resolveModal.submitting}>
              {resolveModal.submitting ? "Resolving..." : "Resolve"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={deleteMismatchModal.open}
        onOpenChange={(open) => setDeleteMismatchModal((prev) => ({ ...prev, open }))}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Mismatch</DialogTitle>
            <DialogDescription>
              Soft-delete requires a reason that will be stored as resolution note.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Delete reason (required)</p>
            <Textarea
              value={deleteMismatchModal.note}
              onChange={(event) =>
                setDeleteMismatchModal((prev) => ({ ...prev, note: event.target.value }))
              }
              placeholder="Provide reason for deleting this mismatch"
            />
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteMismatchModal({ open: false, row: null, note: "", submitting: false })}
            >
              Cancel
            </Button>
            <Button onClick={() => void submitDeleteMismatch()} disabled={deleteMismatchModal.submitting}>
              {deleteMismatchModal.submitting ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
