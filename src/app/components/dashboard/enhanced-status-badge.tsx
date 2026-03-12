import { Badge } from "../ui/badge";
import { cn } from "../ui/utils";

// Temperature status
export type TempStatus = "ok" | "bad" | "no-data";

// Power status
export type PowerStatus = "ok" | "warn" | "bad" | "no-data";

// Voltage status
export type VoltageStatus = "ok" | "med" | "high" | "no-data";

interface TempStatusBadgeProps {
  status: TempStatus;
  className?: string;
}

export function TempStatusBadge({ status, className }: TempStatusBadgeProps) {
  const config = {
    "ok": { label: "Temp OK", className: "bg-green-100 text-green-800 border-green-300" },
    "bad": { label: "Temp BAD", className: "bg-red-100 text-red-800 border-red-300" },
    "no-data": { label: "NO DATA", className: "bg-gray-100 text-gray-600 border-gray-300" },
  };

  const { label, className: statusClass } = config[status];

  return (
    <Badge
      variant="outline"
      className={cn("text-xs font-medium", statusClass, className)}
    >
      {label}
    </Badge>
  );
}

interface PowerStatusBadgeProps {
  status: PowerStatus;
  className?: string;
}

export function PowerStatusBadge({ status, className }: PowerStatusBadgeProps) {
  const config = {
    "ok": { label: "Power OK", className: "bg-green-100 text-green-800 border-green-300" },
    "warn": { label: "Power WARN", className: "bg-yellow-100 text-yellow-800 border-yellow-300" },
    "bad": { label: "Power BAD", className: "bg-red-100 text-red-800 border-red-300" },
    "no-data": { label: "NO DATA", className: "bg-gray-100 text-gray-600 border-gray-300" },
  };

  const { label, className: statusClass } = config[status];

  return (
    <Badge
      variant="outline"
      className={cn("text-xs font-medium", statusClass, className)}
    >
      {label}
    </Badge>
  );
}

interface VoltageStatusBadgeProps {
  status: VoltageStatus;
  className?: string;
}

export function VoltageStatusBadge({ status, className }: VoltageStatusBadgeProps) {
  const config = {
    "ok": { label: "OK", className: "bg-green-100 text-green-800 border-green-300" },
    "med": { label: "MED", className: "bg-orange-100 text-orange-800 border-orange-300" },
    "high": { label: "HIGH", className: "bg-red-100 text-red-800 border-red-300" },
    "no-data": { label: "NO DATA", className: "bg-gray-100 text-gray-600 border-gray-300" },
  };

  const { label, className: statusClass } = config[status];

  return (
    <Badge
      variant="outline"
      className={cn("text-xs font-medium", statusClass, className)}
    >
      {label}
    </Badge>
  );
}
