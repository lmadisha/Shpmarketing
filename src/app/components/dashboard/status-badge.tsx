import { Badge } from "../ui/badge";
import { cn } from "../ui/utils";

export type StatusType = "ok" | "warn" | "bad" | "med" | "high";

interface StatusBadgeProps {
  status: StatusType;
  label: string;
  className?: string;
}

export function StatusBadge({ status, label, className }: StatusBadgeProps) {
  const config = {
    ok: "bg-green-100 text-green-800 border-green-300",
    warn: "bg-yellow-100 text-yellow-800 border-yellow-300",
    bad: "bg-red-100 text-red-800 border-red-300",
    med: "bg-orange-100 text-orange-800 border-orange-300",
    high: "bg-red-100 text-red-800 border-red-300",
  };

  return (
    <Badge
      variant="outline"
      className={cn("font-medium text-xs", config[status], className)}
    >
      {label}
    </Badge>
  );
}
