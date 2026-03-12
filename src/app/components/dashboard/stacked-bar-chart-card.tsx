import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { cn } from "../ui/utils";

interface StackedBarData {
  name: string;
  [key: string]: string | number;
}

interface StackConfig {
  dataKey: string;
  name: string;
  fill: string;
}

interface StackedBarChartCardProps {
  title: string;
  data: StackedBarData[];
  stacks: StackConfig[];
  className?: string;
  horizontal?: boolean;
}

export function StackedBarChartCard({
  title,
  data,
  stacks,
  className,
  horizontal = false,
}: StackedBarChartCardProps) {
  return (
    <Card className={cn("shadow-sm", className)}>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data}
              layout={horizontal ? "vertical" : "horizontal"}
              margin={{ top: 10, right: 10, left: horizontal ? 100 : 10, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              {horizontal ? (
                <>
                  <XAxis type="number" />
                  <YAxis type="category" dataKey="name" width={90} />
                </>
              ) : (
                <>
                  <XAxis dataKey="name" />
                  <YAxis />
                </>
              )}
              <Tooltip />
              <Legend />
              {stacks.map((stack) => (
                <Bar
                  key={stack.dataKey}
                  dataKey={stack.dataKey}
                  name={stack.name}
                  fill={stack.fill}
                  stackId="a"
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
