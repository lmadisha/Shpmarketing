import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "../../components/ui/table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { ArrowUpDown, ChevronLeft, ChevronRight, Download, RefreshCw, Search } from "lucide-react";
import { useAdminAssets } from "./admin-assets-context";
import { downloadCsv } from "./utils";
import { Mismatch, MismatchStatus } from "./types";

export function MismatchesPage() {
  const {
    mismatchLoading, mismatchError,
    mismatchFilters, setMismatchFilters, loadMismatches,
    mismatchSort, toggleMismatchSort,
    mismatchPage, setMismatchPage,
    paginatedMismatches, sortedMismatches, mismatchTotalPages, safeMismatchPage,
    mismatchCsvRows,
    openResolveMismatch, openDeleteMismatch,
  } = useAdminAssets();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Mismatches</CardTitle>
        <CardDescription>Resolve mobile scan discrepancies between received and expected values.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          <Select
            value={mismatchFilters.status}
            onValueChange={(value) => setMismatchFilters({ ...mismatchFilters, status: value as MismatchStatus })}
          >
            <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
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
            onChange={(e) => setMismatchFilters({ ...mismatchFilters, serial: e.target.value })}
            placeholder="Serial contains"
          />

          <Input
            type="date"
            value={mismatchFilters.from}
            onChange={(e) => setMismatchFilters({ ...mismatchFilters, from: e.target.value })}
          />

          <Input
            type="date"
            value={mismatchFilters.to}
            onChange={(e) => setMismatchFilters({ ...mismatchFilters, to: e.target.value })}
          />

          <div className="flex gap-2">
            <Button className="flex-1" variant="outline" onClick={() => void loadMismatches()}>
              <Search className="h-4 w-4" /> Apply
            </Button>
            <Button
              className="flex-1"
              variant="outline"
              onClick={() => { setMismatchFilters({ status: "open", serial: "", from: "", to: "" }); void loadMismatches(); }}
            >
              <RefreshCw className="h-4 w-4" /> Clear
            </Button>
          </div>
        </div>

        <div className="flex justify-end">
          <Button
            variant="outline"
            onClick={() =>
              downloadCsv(
                `mismatches_${new Date().toISOString().slice(0, 10)}_status_${mismatchFilters.status}.csv`,
                ["Received At", "Serial", "Received MAC", "Expected MAC", "Received C-Number", "Expected C-Number", "Status", "Resolved At", "Resolved By", "Note"],
                mismatchCsvRows,
              )
            }
          >
            <Download className="h-4 w-4" /> Download CSV
          </Button>
        </div>

        {mismatchError ? <p className="text-sm text-red-600">{mismatchError}</p> : null}

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>
                <Button variant="ghost" size="sm" onClick={() => toggleMismatchSort("received_at")}>
                  Received At <ArrowUpDown className="h-4 w-4" />
                </Button>
              </TableHead>
              <TableHead>
                <Button variant="ghost" size="sm" onClick={() => toggleMismatchSort("fridge_serial_number")}>
                  Serial <ArrowUpDown className="h-4 w-4" />
                </Button>
              </TableHead>
              <TableHead>
                <Button variant="ghost" size="sm" onClick={() => toggleMismatchSort("received_mac")}>
                  Received MAC / C <ArrowUpDown className="h-4 w-4" />
                </Button>
              </TableHead>
              <TableHead>
                <Button variant="ghost" size="sm" onClick={() => toggleMismatchSort("expected")}>
                  Expected MAC / C <ArrowUpDown className="h-4 w-4" />
                </Button>
              </TableHead>
              <TableHead>
                <Button variant="ghost" size="sm" onClick={() => toggleMismatchSort("status")}>
                  Status <ArrowUpDown className="h-4 w-4" />
                </Button>
              </TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedMismatches.map((row: Mismatch) => {
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
                      <Button size="sm" variant="outline" disabled={!canMutate} onClick={() => openResolveMismatch(row)}>
                        Resolve
                      </Button>
                      <Button size="sm" variant="outline" disabled={!canMutate} onClick={() => openDeleteMismatch(row)}>
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

        {/* Pagination */}
        <div className="flex items-center justify-end gap-2">
          <Button variant="outline" size="sm" onClick={() => setMismatchPage(Math.max(1, mismatchPage - 1))} disabled={safeMismatchPage <= 1}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm text-muted-foreground">Page {safeMismatchPage} of {mismatchTotalPages}</span>
          <Button variant="outline" size="sm" onClick={() => setMismatchPage(Math.min(mismatchTotalPages, mismatchPage + 1))} disabled={safeMismatchPage >= mismatchTotalPages}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
