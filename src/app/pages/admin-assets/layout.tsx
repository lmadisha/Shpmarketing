import { NavLink, Navigate, Outlet, useLocation } from "react-router";
import { Refrigerator } from "lucide-react";
import { AdminAssetsProvider, useAdminAssets } from "./admin-assets-context";
import { AccessDeniedCard } from "../../components/auth/access-denied-card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../components/ui/dialog";
import { Button } from "../../components/ui/button";
import { Textarea } from "../../components/ui/textarea";
import { Badge } from "../../components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../components/ui/table";
import { cn } from "../../components/ui/utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";

const subNavItems = [
  { label: "Add Fridge", to: "/admin/assets/add", permissionKey: "canCreateAssets" as const },
  { label: "Inventory", to: "/admin/assets/inventory", permissionKey: "canViewAssets" as const },
  { label: "Mismatches", to: "/admin/assets/mismatches", permissionKey: "canViewMismatches" as const },
  { label: "Device Checker", to: "/admin/assets/device-checker", permissionKey: "canSubmitDeviceCheck" as const },
  { label: "History", to: "/admin/assets/history", permissionKey: "canViewHistory" as const },
];

// Shared modals are rendered at this level so they're available from all child pages.
function SharedModals() {
  const {
    deviceHistoryOpen, setDeviceHistoryOpen, deviceHistorySerial,
    deviceHistoryRows, deviceHistoryLoading, deviceHistoryError,
    resolveModal, setResolveModal, submitResolveMismatch,
    deleteMismatchModal, setDeleteMismatchModal, submitDeleteMismatch,
  } = useAdminAssets();

  return (
    <>
      {/* Device History Dialog */}
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
                    <TableCell>
                      <Badge variant={entry.action_type === "UPDATE" ? "secondary" : "default"}>
                        {entry.action_type}
                      </Badge>
                    </TableCell>
                    <TableCell>{entry.old_mac || "-"} → {entry.new_mac || "-"}</TableCell>
                    <TableCell>{entry.old_c_num || "-"} → {entry.new_c_num || "-"}</TableCell>
                    <TableCell>{entry.changed_by_username ?? "system"}</TableCell>
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
            <Button variant="outline" onClick={() => setDeviceHistoryOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Resolve Mismatch Dialog */}
      <Dialog
        open={resolveModal.open}
        onOpenChange={(open) =>
          setResolveModal((prev) =>
            open
              ? { ...prev, open: true }
              : { open: false, row: null, note: "", submitting: false },
          )
        }
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Resolve Mismatch</DialogTitle>
            <DialogDescription>
              Resolving will apply received MAC/C-number to the fridge and mark it verified.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Resolution note (optional)</p>
              <Textarea
                value={resolveModal.note}
                onChange={(e) => setResolveModal((prev) => ({ ...prev, note: e.target.value }))}
                placeholder="Reason or context for this resolution"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setResolveModal({ open: false, row: null, note: "", submitting: false })}
            >
              Cancel
            </Button>
            <Button onClick={() => void submitResolveMismatch()} disabled={resolveModal.submitting}>
              {resolveModal.submitting ? "Resolving..." : "Resolve"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Mismatch Dialog */}
      <Dialog
        open={deleteMismatchModal.open}
        onOpenChange={(open) =>
          setDeleteMismatchModal((prev) =>
            open ? { ...prev, open: true } : { open: false, row: null, note: "", submitting: false },
          )
        }
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
              onChange={(e) => setDeleteMismatchModal((prev) => ({ ...prev, note: e.target.value }))}
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
    </>
  );
}

function AdminAssetsLayoutInner() {
  const location = useLocation();
  const {
    isOrganisationFilterEnabled,
    organisationFilter,
    setOrganisationFilter,
    organisationOptions,
    organisationsLoading,
    canCreateAssets,
    canViewAssets,
    canViewMismatches,
    canSubmitDeviceCheck,
    canViewHistory,
  } = useAdminAssets();
  const permissionByKey = {
    canCreateAssets,
    canViewAssets,
    canViewMismatches,
    canSubmitDeviceCheck,
    canViewHistory,
  };
  const visibleSubNavItems = subNavItems.filter((item) => permissionByKey[item.permissionKey]);
  const hasVisibleTab = visibleSubNavItems.length > 0;
  const currentPath = location.pathname;
  const currentPathIsAllowed = visibleSubNavItems.some(
    (item) => currentPath === item.to || currentPath.startsWith(`${item.to}/`),
  );

  if (!hasVisibleTab) {
    return (
      <div className="p-4 md:p-6 lg:p-8">
        <AccessDeniedCard
          title="Asset Manager access denied"
          description="You do not have permission to access any Asset Manager tabs."
        />
      </div>
    );
  }

  if (!currentPathIsAllowed) {
    return <Navigate to={visibleSubNavItems[0].to} replace />;
  }

  return (
    <div className="flex flex-col min-h-full">
      {/* Page Header */}
      <div className="border-b border-gray-200 bg-white px-4 md:px-6 lg:px-8 pt-6 pb-0">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <Refrigerator className="w-6 h-6 text-blue-600" />
            <div>
              <h1 className="text-2xl font-semibold text-gray-900">Asset Manager</h1>
              <p className="text-sm text-gray-500">Store, register, and manage fridge device identities</p>
            </div>
          </div>
          {isOrganisationFilterEnabled ? (
            <div className="min-w-[240px]">
              <Select value={organisationFilter || "all"} onValueChange={(value) => setOrganisationFilter(value === "all" ? "" : value)}>
                <SelectTrigger>
                  <SelectValue placeholder={organisationsLoading ? "Loading organisations..." : "Filter organisation"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All organisations</SelectItem>
                  {organisationOptions.map((org) => (
                    <SelectItem key={org.id} value={String(org.id)}>
                      {org.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}
        </div>

        {/* Sub-navigation tabs */}
        <nav className="flex gap-0 -mb-px">
          {visibleSubNavItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cn(
                  "px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap",
                  isActive
                    ? "border-blue-600 text-blue-600"
                    : "border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300"
                )
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </div>

      {/* Page content */}
      <div className="flex-1 p-4 md:p-6 lg:p-8">
        <Outlet />
      </div>

      <SharedModals />
    </div>
  );
}

export function AdminAssetsLayout() {
  return (
    <AdminAssetsProvider>
      <AdminAssetsLayoutInner />
    </AdminAssetsProvider>
  );
}
