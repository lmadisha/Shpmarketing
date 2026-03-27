import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "../../components/ui/table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { ArrowUpDown, ChevronLeft, ChevronRight, Clock3, Download, RefreshCw, Save, Search, Trash2 } from "lucide-react";
import { AccessDeniedCard } from "../../components/auth/access-denied-card";
import { useAdminAssets } from "./admin-assets-context";
import { downloadExcel, normalizeHexIdentifier, normalizeCNumber } from "./utils";
import { Fridge } from "./types";

export function InventoryPage() {
  const {
    fridgeLoading, fridgeError,
    searchTerm, setSearchTerm, loadFridges,
    toggleInventorySort,
    inventoryPage, setInventoryPage,
    paginatedFridgeRows, sortedFridgeRows, inventoryTotalPages, safeInventoryPage,
    inventoryExportRows,
    editingSerial, editForm, editFormErrors, setEditForm, savingEdit, deletingSerial,
    startEdit, cancelEdit, submitEdit, deleteFridge,
    loadDeviceHistory, deviceHistoryLoading, deviceHistorySerial,
    canViewAssets, canEditAssets, canDeleteAssets, canViewHistory,
  } = useAdminAssets();

  if (!canViewAssets) {
    return (
      <AccessDeniedCard
        title="Inventory access denied"
        description="You do not have permission to view fridge inventory."
      />
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Fridge Inventory</CardTitle>
        <CardDescription>Search, update, delete, and inspect per-device history.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Controls */}
        <div className="flex flex-col lg:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by serial, MAC, or C-number"
              className="pl-9"
            />
          </div>
          <Button variant="outline" disabled={fridgeLoading} onClick={() => void loadFridges(searchTerm)}>
            <Search className="h-4 w-4" />
            Apply Search
          </Button>
          <Button variant="outline" disabled={fridgeLoading} onClick={() => { setSearchTerm(""); void loadFridges(""); }}>
            <RefreshCw className="h-4 w-4" />
            Reset
          </Button>
          <Button
            variant="outline"
            onClick={() =>
              downloadExcel(
                `fridges_${new Date().toISOString().slice(0, 10)}.xls`,
                "Inventory",
                ["Serial Number", "MAC Address", "C-Number", "Verified"],
                inventoryExportRows,
              )
            }
          >
            <Download className="h-4 w-4" />
            Download Excel
          </Button>
        </div>

        {fridgeError ? <p className="text-sm text-red-600">{fridgeError}</p> : null}

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>
                <Button variant="ghost" size="sm" onClick={() => toggleInventorySort("fridge_serial_number")}>
                  Serial <ArrowUpDown className="h-4 w-4" />
                </Button>
              </TableHead>
              <TableHead>
                <Button variant="ghost" size="sm" onClick={() => toggleInventorySort("iot_mac_address")}>
                  MAC <ArrowUpDown className="h-4 w-4" />
                </Button>
              </TableHead>
              <TableHead>
                <Button variant="ghost" size="sm" onClick={() => toggleInventorySort("c_number")}>
                  C-Number <ArrowUpDown className="h-4 w-4" />
                </Button>
              </TableHead>
              <TableHead>
                <Button variant="ghost" size="sm" onClick={() => toggleInventorySort("verified")}>
                  Verified <ArrowUpDown className="h-4 w-4" />
                </Button>
              </TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedFridgeRows.map((row: Fridge) => {
              const isEditing = editingSerial === row.fridge_serial_number;
              return (
                <TableRow key={row.fridge_serial_number}>
                  <TableCell className="font-medium">{row.fridge_serial_number}</TableCell>
                  <TableCell>
                    {isEditing ? (
                      <Input
                        value={editForm.mac_address}
                        onChange={(e) => setEditForm({ ...editForm, mac_address: normalizeHexIdentifier(e.target.value) })}
                        placeholder="MAC"
                      />
                    ) : (
                      row.iot_mac_address || "-"
                    )}
                    {isEditing && editFormErrors.mac_address ? <p className="text-xs text-red-600 mt-1">{editFormErrors.mac_address}</p> : null}
                  </TableCell>
                  <TableCell>
                    {isEditing ? (
                      <Input
                        value={editForm.c_number}
                        onChange={(e) => setEditForm({ ...editForm, c_number: normalizeCNumber(e.target.value) })}
                        placeholder="C-number"
                      />
                    ) : (
                      row.c_number || "-"
                    )}
                    {isEditing && editFormErrors.c_number ? <p className="text-xs text-red-600 mt-1">{editFormErrors.c_number}</p> : null}
                  </TableCell>
                  <TableCell>
                    <Badge variant={row.verified ? "default" : "outline"}>
                      {row.verified ? "Verified" : "Not Verified"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="inline-flex gap-2 flex-wrap justify-end">
                      {canEditAssets ? (
                        isEditing ? (
                          <>
                            <Button size="sm" onClick={() => void submitEdit(row.fridge_serial_number)} disabled={savingEdit}>
                              <Save className="h-4 w-4" /> Save
                            </Button>
                            <Button size="sm" variant="outline" onClick={cancelEdit}>Cancel</Button>
                          </>
                        ) : (
                          <Button size="sm" variant="outline" onClick={() => startEdit(row)}>Edit</Button>
                        )
                      ) : null}
                      {canViewHistory ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => void loadDeviceHistory(row.fridge_serial_number)}
                          disabled={deviceHistoryLoading && deviceHistorySerial === row.fridge_serial_number}
                        >
                          <Clock3 className="h-4 w-4" /> History
                        </Button>
                      ) : null}
                      {canDeleteAssets ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => void deleteFridge(row.fridge_serial_number)}
                          disabled={deletingSerial === row.fridge_serial_number}
                        >
                          <Trash2 className="h-4 w-4" /> Delete
                        </Button>
                      ) : null}
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

        {/* Pagination */}
        <div className="flex items-center justify-end gap-2">
          <Button variant="outline" size="sm" onClick={() => setInventoryPage(Math.max(1, inventoryPage - 1))} disabled={safeInventoryPage <= 1}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm text-muted-foreground">Page {safeInventoryPage} of {inventoryTotalPages}</span>
          <Button variant="outline" size="sm" onClick={() => setInventoryPage(Math.min(inventoryTotalPages, inventoryPage + 1))} disabled={safeInventoryPage >= inventoryTotalPages}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
