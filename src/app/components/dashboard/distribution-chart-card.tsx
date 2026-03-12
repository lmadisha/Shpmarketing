import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";
import { cn } from "../ui/utils";

interface DistributionData {
  name: string;
  value: number;
  color: string;
}

interface DistributionChartCardProps {
  title: string;
  data: DistributionData[];
  type?: "donut" | "pie";
  className?: string;
  showLegend?: boolean;
}

export function DistributionChartCard({
  title,
  data,
  type = "donut",
  className,
  showLegend = true,
}: DistributionChartCardProps) {
  const total = data.reduce((sum, item) => sum + item.value, 0);

  return (
    <Card className={cn("shadow-sm", className)}>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={type === "donut" ? "60%" : 0}
                outerRadius="80%"
                fill="#8884d8"
                dataKey="value"
                label={false}
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip 
                formatter={(value: number) => [
                  `${value} (${((value / total) * 100).toFixed(1)}%)`,
                  ''
                ]}
              />
              {showLegend && <Legend />}
            </PieChart>
          </ResponsiveContainer>
        </div>
        
        {/* Legend with percentages */}
        <div className="mt-4 space-y-2">
          {data.map((item, index) => (
            <div key={index} className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-sm"
                  style={{ backgroundColor: item.color }}
                />
                <span className="text-gray-700">{item.name}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-medium text-gray-900">{item.value}</span>
                <span className="text-gray-500">
                  ({((item.value / total) * 100).toFixed(1)}%)
                </span>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
