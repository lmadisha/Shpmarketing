import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "../../components/ui/table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { ArrowUpDown, ChevronLeft, ChevronRight, Clock3, RefreshCw } from "lucide-react";
import { useAdminAssets } from "./admin-assets-context";

export function HistoryPage() {
  const {
    historyLoading, historyError,
    loadAllHistory,
    historySort, toggleHistorySort,
    historyPage, setHistoryPage,
    paginatedHistory, sortedHistory, historyTotalPages, safeHistoryPage,
  } = useAdminAssets();

  return (
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
            <RefreshCw className="h-4 w-4" /> Refresh
          </Button>
        </div>

        {historyError ? <p className="text-sm text-red-600">{historyError}</p> : null}

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>
                <Button variant="ghost" size="sm" onClick={() => toggleHistorySort("changed_at")}>
                  Time <ArrowUpDown className="h-4 w-4" />
                </Button>
              </TableHead>
              <TableHead>
                <Button variant="ghost" size="sm" onClick={() => toggleHistorySort("action_type")}>
                  Action <ArrowUpDown className="h-4 w-4" />
                </Button>
              </TableHead>
              <TableHead>
                <Button variant="ghost" size="sm" onClick={() => toggleHistorySort("fridge_serial_number")}>
                  Serial <ArrowUpDown className="h-4 w-4" />
                </Button>
              </TableHead>
              <TableHead>
                <Button variant="ghost" size="sm" onClick={() => toggleHistorySort("new_mac")}>
                  Old → New MAC <ArrowUpDown className="h-4 w-4" />
                </Button>
              </TableHead>
              <TableHead>
                <Button variant="ghost" size="sm" onClick={() => toggleHistorySort("new_c_num")}>
                  Old → New C <ArrowUpDown className="h-4 w-4" />
                </Button>
              </TableHead>
              <TableHead>
                <Button variant="ghost" size="sm" onClick={() => toggleHistorySort("changed_by")}>
                  User <ArrowUpDown className="h-4 w-4" />
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
                <TableCell>{entry.old_mac || "-"} → {entry.new_mac || "-"}</TableCell>
                <TableCell>{entry.old_c_num || "-"} → {entry.new_c_num || "-"}</TableCell>
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

        {/* Pagination */}
        <div className="flex items-center justify-end gap-2">
          <Button variant="outline" size="sm" onClick={() => setHistoryPage(Math.max(1, historyPage - 1))} disabled={safeHistoryPage <= 1}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm text-muted-foreground">Page {safeHistoryPage} of {historyTotalPages}</span>
          <Button variant="outline" size="sm" onClick={() => setHistoryPage(Math.min(historyTotalPages, historyPage + 1))} disabled={safeHistoryPage >= historyTotalPages}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
