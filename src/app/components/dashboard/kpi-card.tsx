import { Card, CardContent } from "../ui/card";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "../ui/utils";

interface KPICardProps {
  title: string;
  value: string | number;
  change?: number;
  changeLabel?: string;
  sparklineData?: number[];
  icon?: React.ReactNode;
  className?: string;
}

export function KPICard({
  title,
  value,
  change,
  changeLabel,
  sparklineData,
  icon,
  className,
}: KPICardProps) {
  const isPositive = change && change > 0;
  const isNegative = change && change < 0;

  return (
    <Card className={cn("", className)}>
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <p className="text-sm text-gray-600 mb-1">{title}</p>
            <p className="text-3xl font-semibold text-gray-900">{value}</p>
            {change !== undefined && (
              <div className="flex items-center gap-1 mt-2">
                {isPositive && (
                  <TrendingUp className="w-4 h-4 text-green-600" />
                )}
                {isNegative && (
                  <TrendingDown className="w-4 h-4 text-red-600" />
                )}
                {!isPositive && !isNegative && (
                  <Minus className="w-4 h-4 text-gray-400" />
                )}
                <span
                  className={cn(
                    "text-sm font-medium",
                    isPositive && "text-green-600",
                    isNegative && "text-red-600",
                    !isPositive && !isNegative && "text-gray-500"
                  )}
                >
                  {change > 0 ? "+" : ""}
                  {change}%
                </span>
                {changeLabel && (
                  <span className="text-sm text-gray-500 ml-1">
                    {changeLabel}
                  </span>
                )}
              </div>
            )}
          </div>
          {icon && (
            <div className="p-3 bg-blue-50 rounded-lg text-blue-600">
              {icon}
            </div>
          )}
        </div>
        {sparklineData && sparklineData.length > 0 && (
          <div className="mt-4">
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
    <div className="flex items-end gap-0.5 h-12">
      {data.map((value, i) => {
        const height = ((value - min) / range) * 100;
        return (
          <div
            key={i}
            className="flex-1 bg-blue-200 rounded-sm"
            style={{ height: `${height}%`, minHeight: "2px" }}
          />
        );
      })}
    </div>
  );
}
