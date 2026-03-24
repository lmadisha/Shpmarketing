import { Server, Activity, Thermometer, Zap, TrendingUp } from "lucide-react";
import { FilterBar } from "../components/layout/filter-bar";
import { KPICard } from "../components/dashboard/kpi-card";
import { InsightCard } from "../components/dashboard/insight-card";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Alert, AlertDescription } from "../components/ui/alert";
import { Badge } from "../components/ui/badge";

const doorOpensData = [
  { date: "Feb 3", opens: 12450 },
  { date: "Feb 10", opens: 13200 },
  { date: "Feb 17", opens: 14100 },
  { date: "Feb 24", opens: 15300 },
  { date: "Mar 2", opens: 16800 },
];

const dayOfWeekData = [
  { day: "Mon", opens: 2100 },
  { day: "Tue", opens: 2300 },
  { day: "Wed", opens: 2400 },
  { day: "Thu", opens: 2800 },
  { day: "Fri", opens: 3500 },
  { day: "Sat", opens: 4200 },
  { day: "Sun", opens: 3900 },
];

const tierDistributionData = [
  { name: "Gold", value: 156, color: "#fbbf24" },
  { name: "Silver", value: 234, color: "#9ca3af" },
  { name: "Bronze", value: 189, color: "#fb923c" },
  { name: "Insufficient", value: 45, color: "#e5e7eb" },
];

export function OverviewPage() {
  return (
    <>
      <FilterBar />
      <div className="p-4 md:p-6 lg:p-8 max-w-[1440px] mx-auto">
      {/* What's Changed Banner */}
      <Alert className="mb-6 bg-blue-50 border-blue-200">
        <AlertDescription>
          <div className="flex items-start justify-between flex-col md:flex-row gap-4">
            <div>
              <h3 className="font-semibold text-gray-900 mb-2">
                What's changed since your last visit
              </h3>
              <ul className="space-y-1 text-sm text-gray-700">
                <li>• 12 units moved from Bronze to Silver tier (+15% door activity)</li>
                <li>• 3 units flagged with voltage risk in KwaZulu-Natal region</li>
                <li>• Weekend performance up 18% - highest in Q1 2026</li>
                <li>• Temperature compliance improved to 94.5% (+2.3%)</li>
                <li>• 8 redistribution opportunities identified in Gauteng</li>
              </ul>
            </div>
            <Badge variant="outline" className="shrink-0">
              Last visit: Feb 27
            </Badge>
          </div>
        </AlertDescription>
      </Alert>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-6 md:mb-8">
        <KPICard
          title="Total Units"
          value="624"
          change={2.4}
          changeLabel="vs last month"
          icon={<Server className="w-5 h-5" />}
          sparklineData={[580, 590, 605, 615, 624]}
        />
        <KPICard
          title="Door Opens (30d)"
          value="487.2K"
          change={12.5}
          changeLabel="vs previous period"
          icon={<Activity className="w-5 h-5" />}
          sparklineData={[420000, 445000, 460000, 475000, 487200]}
        />
        <KPICard
          title="Temp Compliance"
          value="94.5%"
          change={2.3}
          changeLabel="vs last month"
          icon={<Thermometer className="w-5 h-5" />}
        />
        <KPICard
          title="Voltage Risk Units"
          value="18"
          change={-25}
          changeLabel="vs last month"
          icon={<Zap className="w-5 h-5" />}
        />
      </div>

      {/* Top Movers */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            Top Tier Movers (Last 30 Days)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <InsightCard
              type="positive"
              title="12 Units → Silver Tier"
              description="Upgraded from Bronze due to sustained door activity increases in Gauteng region"
            />
            <InsightCard
              type="positive"
              title="5 Units → Gold Tier"
              description="Exceptional performance in Western Cape coastal outlets"
            />
            <InsightCard
              type="warning"
              title="7 Units → Bronze Tier"
              description="Decreased activity in rural KwaZulu-Natal - redistribution candidates"
            />
          </div>
        </CardContent>
      </Card>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Door Opens Trend */}
        <Card>
          <CardHeader>
            <CardTitle>Door Opens Trend (Last 30 Days)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={doorOpensData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="date" stroke="#6b7280" fontSize={12} />
                <YAxis stroke="#6b7280" fontSize={12} />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey="opens"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  dot={{ fill: "#3b82f6", r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Day of Week Seasonality */}
        <Card>
          <CardHeader>
            <CardTitle>Day of Week Seasonality</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={dayOfWeekData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="day" stroke="#6b7280" fontSize={12} />
                <YAxis stroke="#6b7280" fontSize={12} />
                <Tooltip />
                <Bar dataKey="opens" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Tier Distribution */}
      <Card>
        <CardHeader>
          <CardTitle>Fleet Tier Distribution</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-8">
            <div className="flex-1">
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={tierDistributionData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) =>
                      `${name} ${(percent * 100).toFixed(0)}%`
                    }
                    outerRadius={100}
                    dataKey="value"
                  >
                    {tierDistributionData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-4">
              {tierDistributionData.map((tier) => (
                <div key={tier.name} className="flex items-center gap-3">
                  <div
                    className="w-4 h-4 rounded"
                    style={{ backgroundColor: tier.color }}
                  />
                  <div>
                    <p className="font-medium text-gray-900">{tier.name}</p>
                    <p className="text-sm text-gray-600">{tier.value} units</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
    </>
  );
}