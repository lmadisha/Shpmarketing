import { ArrowUp, ArrowDown, Minus } from "lucide-react";
import { Badge } from "../ui/badge";
import { cn } from "../ui/utils";

interface DeltaBadgeProps {
  value: number;
  format?: "number" | "percentage";
  className?: string;
}

export function DeltaBadge({ value, format = "number", className }: DeltaBadgeProps) {
  const isPositive = value > 0;
  const isNeutral = value === 0;
  
  const formattedValue = format === "percentage" 
    ? `${Math.abs(value)}%` 
    : Math.abs(value).toString();

  if (isNeutral) {
    return (
      <Badge variant="outline" className={cn("bg-gray-100 text-gray-600 border-gray-300", className)}>
        <Minus className="w-3 h-3 mr-0.5" />
        No change
      </Badge>
    );
  }

  return (
    <Badge
      variant="outline"
      className={cn(
        "font-medium text-xs",
        isPositive
          ? "bg-green-100 text-green-700 border-green-300"
          : "bg-red-100 text-red-700 border-red-300",
        className
      )}
    >
      {isPositive ? (
        <ArrowUp className="w-3 h-3 mr-0.5" />
      ) : (
        <ArrowDown className="w-3 h-3 mr-0.5" />
      )}
      {formattedValue}
    </Badge>
  );
}
