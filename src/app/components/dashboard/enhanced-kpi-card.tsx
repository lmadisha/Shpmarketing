import { Card, CardContent } from "../ui/card";
import { cn } from "../ui/utils";
import { DeltaBadge } from "./delta-badge";

interface EnhancedKPICardProps {
  title: string;
  value: string | number;
  delta?: {
    value: number;
    label: string;
    isPositiveGood?: boolean;
  };
  sparklineData?: number[];
  icon?: React.ReactNode;
  subtitle?: string;
  className?: string;
}

export function EnhancedKPICard({
  title,
  value,
  delta,
  sparklineData,
  icon,
  subtitle,
  className,
}: EnhancedKPICardProps) {
  return (
    <Card className={cn("shadow-sm hover:shadow-md transition-shadow", className)}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1">
            <p className="text-xs text-gray-600 mb-1">{title}</p>
            <p className="text-2xl font-semibold text-gray-900">{value}</p>
            {subtitle && (
              <p className="text-xs text-gray-500 mt-1">{subtitle}</p>
            )}
          </div>
          {icon && (
            <div className="p-2.5 bg-blue-50 rounded-lg text-blue-600">
              {icon}
            </div>
          )}
        </div>
        
        {delta && (
          <div className="mb-3">
            <DeltaBadge
              value={delta.value}
              label={delta.label}
              isPositiveGood={delta.isPositiveGood}
            />
          </div>
        )}

        {sparklineData && sparklineData.length > 0 && (
          <div className="mt-3">
            <MiniSparkline data={sparklineData} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function MiniSparkline({ data }: { data: number[] }) {
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;

  return (
    <div className="flex items-end gap-0.5 h-10">
      {data.map((value, i) => {
        const height = ((value - min) / range) * 100;
        return (
          <div
            key={i}
            className="flex-1 bg-blue-200 rounded-sm transition-all hover:bg-blue-300"
            style={{ height: `${height}%`, minHeight: "2px" }}
          />
        );
      })}
    </div>
  );
}
