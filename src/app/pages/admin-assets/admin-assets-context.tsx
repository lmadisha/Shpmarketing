import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useApiClient } from "../../auth/use-api-client";
import { useAuth } from "../../auth/auth-context";
import {
  Fridge,
  Mismatch,
  AuditLogRow,
  MismatchStatus,
  InventorySortKey,
  MismatchSortKey,
  HistorySortKey,
  SortDirection,
  AdminApiRequestOptions,
  PAGE_SIZE,
  ADMIN_ASSETS_LOG_PREFIX,
} from "./types";
import { compareValues, summarizeRequestBody, summarizeResponsePayload, cleanHex12, cleanCNumber } from "./utils";

// ─── Context shape ────────────────────────────────────────────────────────────

type AdminAssetsContextValue = {
  // Fridges / Inventory
  fridges: Fridge[];
  fridgeLoading: boolean;
  fridgeError: string;
  searchTerm: string;
  setSearchTerm: (v: string) => void;
  loadFridges: (query?: string) => Promise<void>;

  // Sorting & pagination (inventory)
  inventorySort: { key: InventorySortKey; direction: SortDirection };
  toggleInventorySort: (key: InventorySortKey) => void;
  inventoryPage: number;
  setInventoryPage: (p: number) => void;
  sortedFridgeRows: Fridge[];
  paginatedFridgeRows: Fridge[];
  inventoryTotalPages: number;
  safeInventoryPage: number;

  // Edit / delete
  editingSerial: string | null;
  editForm: { mac_address: string; c_number: string };
  setEditForm: (f: { mac_address: string; c_number: string }) => void;
  savingEdit: boolean;
  deletingSerial: string | null;
  startEdit: (row: Fridge) => void;
  cancelEdit: () => void;
  submitEdit: (serial: string) => Promise<void>;
  deleteFridge: (serial: string) => Promise<void>;

  // History (global)
  allHistory: AuditLogRow[];
  historyLoading: boolean;
  historyError: string;
  loadAllHistory: () => Promise<void>;
  historySort: { key: HistorySortKey; direction: SortDirection };
  toggleHistorySort: (key: HistorySortKey) => void;
  historyPage: number;
  setHistoryPage: (p: number) => void;
  sortedHistory: AuditLogRow[];
  paginatedHistory: AuditLogRow[];
  historyTotalPages: number;
  safeHistoryPage: number;

  // Device history dialog (from inventory)
  deviceHistoryOpen: boolean;
  setDeviceHistoryOpen: (v: boolean) => void;
  deviceHistorySerial: string;
  deviceHistoryRows: AuditLogRow[];
  deviceHistoryLoading: boolean;
  deviceHistoryError: string;
  loadDeviceHistory: (serial: string) => Promise<void>;

  // Mismatches
  mismatches: Mismatch[];
  mismatchLoading: boolean;
  mismatchError: string;
  mismatchFilters: { status: MismatchStatus; serial: string; from: string; to: string };
  setMismatchFilters: (f: { status: MismatchStatus; serial: string; from: string; to: string }) => void;
  loadMismatches: () => Promise<void>;
  mismatchSort: { key: MismatchSortKey; direction: SortDirection };
  toggleMismatchSort: (key: MismatchSortKey) => void;
  mismatchPage: number;
  setMismatchPage: (p: number) => void;
  sortedMismatches: Mismatch[];
  paginatedMismatches: Mismatch[];
  mismatchTotalPages: number;
  safeMismatchPage: number;

  // Resolve mismatch modal
  resolveModal: {
    open: boolean;
    row: Mismatch | null;
    applyToFridge: boolean;
    setVerified: boolean;
    note: string;
    submitting: boolean;
  };
  setResolveModal: (v: AdminAssetsContextValue["resolveModal"]) => void;
  openResolveMismatch: (row: Mismatch) => void;
  submitResolveMismatch: () => Promise<void>;

  // Delete mismatch modal
  deleteMismatchModal: {
    open: boolean;
    row: Mismatch | null;
    note: string;
    submitting: boolean;
  };
  setDeleteMismatchModal: (v: AdminAssetsContextValue["deleteMismatchModal"]) => void;
  openDeleteMismatch: (row: Mismatch) => void;
  submitDeleteMismatch: () => Promise<void>;

  // CSV rows
  inventoryCsvRows: Array<Array<unknown>>;
  mismatchCsvRows: Array<Array<unknown>>;

  // Generic admin API helper
  adminRequest: <T>(action: string, path: string, options?: AdminApiRequestOptions) => Promise<T>;
};

// ─── Context ──────────────────────────────────────────────────────────────────

const AdminAssetsContext = createContext<AdminAssetsContextValue | null>(null);

export function useAdminAssets() {
  const ctx = useContext(AdminAssetsContext);
  if (!ctx) throw new Error("useAdminAssets must be used within AdminAssetsProvider");
  return ctx;
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function AdminAssetsProvider({ children }: { children: React.ReactNode }) {
  const { request } = useApiClient();
  const { session } = useAuth();
  const actor = session?.user.full_name || session?.user.username || "Unknown";

  // ── API helper ────────────────────────────────────────────────────────────
  async function adminRequest<T>(
    action: string,
    path: string,
    options: AdminApiRequestOptions = {},
  ): Promise<T> {
    const method = String(options.method || "GET").toUpperCase();
    const startedAt = performance.now();
    const requestSummary = summarizeRequestBody(options.body);

    console.info(`${ADMIN_ASSETS_LOG_PREFIX} ${action} ${method} ${path} started`, { actor, requestBody: requestSummary });

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

  // ── Fridges ───────────────────────────────────────────────────────────────
  const [fridges, setFridges] = useState<Fridge[]>([]);
  const [fridgeLoading, setFridgeLoading] = useState(false);
  const [fridgeError, setFridgeError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

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

  // ── History ───────────────────────────────────────────────────────────────
  const [allHistory, setAllHistory] = useState<AuditLogRow[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState("");

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

  // ── Device history dialog ─────────────────────────────────────────────────
  const [deviceHistoryOpen, setDeviceHistoryOpen] = useState(false);
  const [deviceHistorySerial, setDeviceHistorySerial] = useState("");
  const [deviceHistoryRows, setDeviceHistoryRows] = useState<AuditLogRow[]>([]);
  const [deviceHistoryLoading, setDeviceHistoryLoading] = useState(false);
  const [deviceHistoryError, setDeviceHistoryError] = useState("");

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
      const data = await adminRequest<AuditLogRow[]>("loadHistory.device", `/auditLog/${encodeURIComponent(serial)}`);
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

  // ── Mismatches ────────────────────────────────────────────────────────────
  const [mismatches, setMismatches] = useState<Mismatch[]>([]);
  const [mismatchLoading, setMismatchLoading] = useState(false);
  const [mismatchError, setMismatchError] = useState("");
  const [mismatchFilters, setMismatchFilters] = useState<{
    status: MismatchStatus;
    serial: string;
    from: string;
    to: string;
  }>({ status: "open", serial: "", from: "", to: "" });

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

  // ── Resolve mismatch modal ────────────────────────────────────────────────
  const [resolveModal, setResolveModal] = useState<{
    open: boolean;
    row: Mismatch | null;
    applyToFridge: boolean;
    setVerified: boolean;
    note: string;
    submitting: boolean;
  }>({ open: false, row: null, applyToFridge: false, setVerified: true, note: "", submitting: false });

  const openResolveMismatch = (row: Mismatch) => {
    setResolveModal({ open: true, row, applyToFridge: false, setVerified: true, note: "", submitting: false });
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
      setResolveModal({ open: false, row: null, applyToFridge: false, setVerified: true, note: "", submitting: false });
      await loadMismatches();
      await loadFridges(searchTerm);
      await loadAllHistory();
    } catch {
      setMismatchError("Could not resolve mismatch.");
      setResolveModal((prev) => ({ ...prev, submitting: false }));
    }
  };

  // ── Delete mismatch modal ─────────────────────────────────────────────────
  const [deleteMismatchModal, setDeleteMismatchModal] = useState<{
    open: boolean;
    row: Mismatch | null;
    note: string;
    submitting: boolean;
  }>({ open: false, row: null, note: "", submitting: false });

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

  // ── Edit / delete ─────────────────────────────────────────────────────────
  const [editingSerial, setEditingSerial] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ mac_address: "", c_number: "" });
  const [savingEdit, setSavingEdit] = useState(false);
  const [deletingSerial, setDeletingSerial] = useState<string | null>(null);

  const startEdit = (row: Fridge) => {
    setEditingSerial(row.fridge_serial_number);
    setEditForm({ mac_address: row.iot_mac_address || "", c_number: row.c_number || "" });
  };

  const cancelEdit = () => {
    setEditingSerial(null);
    setEditForm({ mac_address: "", c_number: "" });
  };

  const submitEdit = async (serial: string) => {
    const mac = editForm.mac_address ? cleanHex12(editForm.mac_address) : "";
    const cNumber = editForm.c_number ? cleanCNumber(editForm.c_number) : "";
    if (mac && mac.length !== 12) {
      return;
    }
    setSavingEdit(true);
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
      // error is set on fridgeError
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

  // ── Sorting ───────────────────────────────────────────────────────────────
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

  // ── Pagination ─────────────────────────────────────────────────────────────
  const [inventoryPage, setInventoryPage] = useState(1);
  const [mismatchPage, setMismatchPage] = useState(1);
  const [historyPage, setHistoryPage] = useState(1);

  // ── Sorted / paginated memos ───────────────────────────────────────────────
  const sortedFridgeRows = useMemo(() => {
    const rows = [...fridges];
    rows.sort((a, b) => {
      const result = compareValues(a[inventorySort.key], b[inventorySort.key]);
      return inventorySort.direction === "asc" ? result : -result;
    });
    return rows;
  }, [fridges, inventorySort]);

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
      const result = compareValues(a[historySort.key], b[historySort.key]);
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

  // Reset pages when data changes
  useEffect(() => { setInventoryPage(1); }, [fridges.length]);
  useEffect(() => { setMismatchPage(1); }, [mismatches.length]);
  useEffect(() => { setHistoryPage(1); }, [allHistory.length]);

  // CSV rows
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

  // ── Initial load ──────────────────────────────────────────────────────────
  useEffect(() => {
    void loadFridges();
    void loadAllHistory();
    void loadMismatches();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value: AdminAssetsContextValue = {
    fridges, fridgeLoading, fridgeError, searchTerm, setSearchTerm, loadFridges,
    inventorySort, toggleInventorySort, inventoryPage, setInventoryPage,
    sortedFridgeRows, paginatedFridgeRows, inventoryTotalPages, safeInventoryPage,
    editingSerial, editForm, setEditForm, savingEdit, deletingSerial,
    startEdit, cancelEdit, submitEdit, deleteFridge,
    allHistory, historyLoading, historyError, loadAllHistory,
    historySort, toggleHistorySort, historyPage, setHistoryPage,
    sortedHistory, paginatedHistory, historyTotalPages, safeHistoryPage,
    deviceHistoryOpen, setDeviceHistoryOpen, deviceHistorySerial,
    deviceHistoryRows, deviceHistoryLoading, deviceHistoryError, loadDeviceHistory,
    mismatches, mismatchLoading, mismatchError, mismatchFilters, setMismatchFilters, loadMismatches,
    mismatchSort, toggleMismatchSort, mismatchPage, setMismatchPage,
    sortedMismatches, paginatedMismatches, mismatchTotalPages, safeMismatchPage,
    resolveModal, setResolveModal, openResolveMismatch, submitResolveMismatch,
    deleteMismatchModal, setDeleteMismatchModal, openDeleteMismatch, submitDeleteMismatch,
    inventoryCsvRows, mismatchCsvRows,
    adminRequest,
  };

  return (
    <AdminAssetsContext.Provider value={value}>
      {children}
    </AdminAssetsContext.Provider>
  );
}
