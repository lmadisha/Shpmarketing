export type MismatchActionEnum = "open" | "resolve" | "cancel" | "delete";

export type FridgeImage = {
  id: number | string; // BigInt returned as string from API
  fridge_serial_number: string;
  mismatch_action?: MismatchActionEnum | null;
  created_at: string; // ISO timestamp
  created_by?: number | null;
};

export type Fridge = {
  fridge_serial_number: string;
  iot_mac_address: string | null;
  c_number: string | null;
  verified: boolean;
  organisation_id?: number | null;
  latitude?: number | null;
  longitude?: number | null;
  image_id?: number | string | null;
  placed: boolean;
};

export type OrganisationOption = {
  id: number;
  name: string;
  domin: string | null;
};

export type MismatchStatus = "open" | "resolve" | "cancel" | "delete" | "all";

export type Mismatch = {
  id: number | string; // BigInt returned as string from API
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
  latitude?: number | null;
  longitude?: number | null;
  image_id?: number | string | null;
};

export type HistoryActionType =
  | "INSERT"
  | "UPDATE"
  | "VERIFY"
  | "UNVERIFY"
  | "DELETE"
  | "MISMATCH_INSERT"
  | "MISMATCH_UPDATE"
  | "MISMATCH_RESOLVE"
  | "MISMATCH_DELETE";

export type HistoryActionFilter = HistoryActionType | "all";

export type AuditLogRow = {
  log_id: number;
  fridge_serial_number: string;
  action_type: HistoryActionType;
  old_mac: string | null;
  new_mac: string | null;
  old_c_num: string | null;
  new_c_num: string | null;
  changed_at: string;
  changed_by: number | null;
  changed_by_username: string | null;
  deletion_reason?: string | null;
  resolution_note?: string | null;
  metadata?: Record<string, unknown> | null;
};

export type BulkPreviewRow = {
  rowNumber: number;
  fridge_serial_number: string;
  mac_address: string | null;
  c_number: string | null;
};

export type BulkOperationResult = {
  succeeded: string[];
  notFound: string[];
  errors: { serial: string; message: string }[];
};

export type SortDirection = "asc" | "desc";
export type InventorySortKey = "fridge_serial_number" | "iot_mac_address" | "c_number" | "verified";
export type MismatchSortKey = "received_at" | "fridge_serial_number" | "received_mac" | "received_c_number" | "expected" | "status";
export type HistorySortKey = "changed_at" | "action_type" | "fridge_serial_number" | "old_mac" | "new_mac" | "old_c_num" | "new_c_num" | "changed_by_username";
export type AdminApiRequestOptions = Omit<RequestInit, "headers"> & {
  headers?: HeadersInit;
};

export const PAGE_SIZE = 10;
export const ADMIN_ASSETS_LOG_PREFIX = "[admin-assets:api]";
