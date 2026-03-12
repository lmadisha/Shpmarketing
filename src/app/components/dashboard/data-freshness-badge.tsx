import { Clock, Database } from "lucide-react";
import { Badge } from "../ui/badge";
import { cn } from "../ui/utils";

interface DataFreshnessBadgeProps {
  generatedAt: string;
  coverage?: number;
  className?: string;
}

export function DataFreshnessBadge({
  generatedAt,
  coverage,
  className,
}: DataFreshnessBadgeProps) {
  return (
    <div className={cn("flex flex-wrap items-center gap-2 text-sm", className)}>
      <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
        <Clock className="w-3 h-3 mr-1" />
        Generated at {generatedAt}
      </Badge>
      {coverage !== undefined && (
        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
          <Database className="w-3 h-3 mr-1" />
          Coverage {coverage}%
        </Badge>
      )}
    </div>
  );
}
