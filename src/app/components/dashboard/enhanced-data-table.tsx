import { useState } from "react";
import { ChevronDown, ChevronUp, ChevronsUpDown, MoreHorizontal } from "lucide-react";
import { cn } from "../ui/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { Button } from "../ui/button";

export interface Column<T> {
  key: string;
  label: string;
  sortable?: boolean;
  render?: (row: T) => React.ReactNode;
  className?: string;
  headerClassName?: string;
}

interface EnhancedDataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  onRowClick?: (row: T) => void;
  rowActions?: (row: T) => {
    label: string;
    onClick: () => void;
    icon?: React.ReactNode;
  }[];
  stickyHeader?: boolean;
  className?: string;
  emptyMessage?: string;
}

type SortDirection = "asc" | "desc" | null;

export function EnhancedDataTable<T extends Record<string, any>>({
  columns,
  data,
  onRowClick,
  rowActions,
  stickyHeader = true,
  className,
  emptyMessage = "No data available",
}: EnhancedDataTableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);

  const handleSort = (key: string) => {
    if (sortKey === key) {
      if (sortDirection === "asc") {
        setSortDirection("desc");
      } else if (sortDirection === "desc") {
        setSortKey(null);
        setSortDirection(null);
      } else {
        setSortDirection("asc");
      }
    } else {
      setSortKey(key);
      setSortDirection("asc");
    }
  };

  const sortedData = [...data].sort((a, b) => {
    if (!sortKey || !sortDirection) return 0;

    const aVal = a[sortKey];
    const bVal = b[sortKey];

    if (aVal === bVal) return 0;

    const result = aVal > bVal ? 1 : -1;
    return sortDirection === "asc" ? result : -result;
  });

  if (data.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500 bg-white rounded-lg border border-gray-200">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className={cn("bg-white rounded-lg border border-gray-200 overflow-hidden", className)}>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead 
            className={cn(
              "bg-gray-50 border-b border-gray-200",
              stickyHeader && "sticky top-0 z-10"
            )}
          >
            <tr>
              {columns.map((column) => (
                <th
                  key={column.key}
                  className={cn(
                    "px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider",
                    column.sortable && "cursor-pointer hover:bg-gray-100",
                    column.headerClassName
                  )}
                  onClick={() => column.sortable && handleSort(column.key)}
                >
                  <div className="flex items-center gap-2">
                    {column.label}
                    {column.sortable && (
                      <span className="text-gray-400">
                        {sortKey === column.key ? (
                          sortDirection === "asc" ? (
                            <ChevronUp className="w-4 h-4" />
                          ) : (
                            <ChevronDown className="w-4 h-4" />
                          )
                        ) : (
                          <ChevronsUpDown className="w-4 h-4" />
                        )}
                      </span>
                    )}
                  </div>
                </th>
              ))}
              {rowActions && (
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 uppercase tracking-wider w-16">
                  Actions
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {sortedData.map((row, index) => (
              <tr
                key={index}
                className={cn(
                  "hover:bg-gray-50 transition-colors",
                  onRowClick && "cursor-pointer"
                )}
                onClick={() => onRowClick?.(row)}
              >
                {columns.map((column) => (
                  <td
                    key={column.key}
                    className={cn(
                      "px-4 py-3 text-sm text-gray-900",
                      column.className
                    )}
                  >
                    {column.render ? column.render(row) : row[column.key]}
                  </td>
                ))}
                {rowActions && (
                  <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {rowActions(row).map((action, i) => (
                          <DropdownMenuItem
                            key={i}
                            onClick={action.onClick}
                            className="gap-2"
                          >
                            {action.icon}
                            {action.label}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
