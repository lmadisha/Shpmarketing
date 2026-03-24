import { useParams } from "react-router";
import { FilterBar } from "../components/layout/filter-bar";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { TierBadge } from "../components/dashboard/tier-badge";
import { StatusBadge } from "../components/dashboard/status-badge";
import { InsightCard } from "../components/dashboard/insight-card";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "../components/ui/breadcrumb";
import { Link } from "react-router";
import { Server, MapPin } from "lucide-react";
import { Badge } from "../components/ui/badge";
import { Checkbox } from "../components/ui/checkbox";
import { Label } from "../components/ui/label";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

const doorOpensData = [
  { date: "Feb 3", opens: 95 },
  { date: "Feb 5", opens: 102 },
  { date: "Feb 7", opens: 98 },
  { date: "Feb 9", opens: 110 },
  { date: "Feb 11", opens: 115 },
  { date: "Feb 13", opens: 108 },
  { date: "Feb 15", opens: 120 },
  { date: "Feb 17", opens: 125 },
  { date: "Feb 19", opens: 118 },
  { date: "Feb 21", opens: 130 },
  { date: "Feb 23", opens: 135 },
  { date: "Feb 25", opens: 128 },
  { date: "Feb 27", opens: 140 },
  { date: "Mar 1", opens: 145 },
];

const tempData = [
  { date: "Feb 3", temp: 4.5 },
  { date: "Feb 5", temp: 4.3 },
  { date: "Feb 7", temp: 4.4 },
  { date: "Feb 9", temp: 4.2 },
  { date: "Feb 11", temp: 4.1 },
  { date: "Feb 13", temp: 4.3 },
  { date: "Feb 15", temp: 4.0 },
  { date: "Feb 17", temp: 4.2 },
  { date: "Feb 19", temp: 4.3 },
  { date: "Feb 21", temp: 4.1 },
  { date: "Feb 23", temp: 4.2 },
  { date: "Feb 25", temp: 4.0 },
  { date: "Feb 27", temp: 4.1 },
  { date: "Mar 1", temp: 4.2 },
];

const poweredData = [
  { date: "Feb 3", powered: 99.5 },
  { date: "Feb 5", powered: 99.8 },
  { date: "Feb 7", powered: 99.9 },
  { date: "Feb 9", powered: 99.7 },
  { date: "Feb 11", powered: 99.8 },
  { date: "Feb 13", powered: 99.6 },
  { date: "Feb 15", powered: 99.9 },
  { date: "Feb 17", powered: 100 },
  { date: "Feb 19", powered: 99.8 },
  { date: "Feb 21", powered: 99.9 },
  { date: "Feb 23", powered: 99.7 },
  { date: "Feb 25", powered: 99.8 },
  { date: "Feb 27", powered: 99.9 },
  { date: "Mar 1", powered: 99.8 },
];

const condenserData = [
  { date: "Feb 3", condenser: 38.2 },
  { date: "Feb 5", condenser: 37.8 },
  { date: "Feb 7", condenser: 38.1 },
  { date: "Feb 9", condenser: 37.5 },
  { date: "Feb 11", condenser: 37.3 },
  { date: "Feb 13", condenser: 37.9 },
  { date: "Feb 15", condenser: 37.0 },
  { date: "Feb 17", condenser: 37.4 },
  { date: "Feb 19", condenser: 37.6 },
  { date: "Feb 21", condenser: 37.2 },
  { date: "Feb 23", condenser: 37.5 },
  { date: "Feb 25", condenser: 37.0 },
  { date: "Feb 27", condenser: 37.3 },
  { date: "Mar 1", condenser: 37.5 },
];

export function UnitDetailPage() {
  const { unitId } = useParams();
  const [visibleMetrics, setVisibleMetrics] = useState({
    doorOpens: true,
    temperature: true,
    powered: true,
    condenser: true,
  });

  const toggleMetric = (metric: keyof typeof visibleMetrics) => {
    setVisibleMetrics((prev) => ({
      ...prev,
      [metric]: !prev[metric],
    }));
  };

  return (
    <>
      <FilterBar />
      <div className="p-8 max-w-[1440px] mx-auto">
      {/* Breadcrumbs */}
      <Breadcrumb className="mb-6">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link to="/">Overview</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link to="/fleet-ranking">Fleet Ranking</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{unitId}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Header */}
      <Card className="mb-8">
        <CardContent className="p-6">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-blue-50 rounded-lg">
                <Server className="w-8 h-8 text-blue-600" />
              </div>
              <div>
                <h1 className="text-3xl font-semibold text-gray-900 mb-2">
                  Unit {unitId}
                </h1>
                <div className="flex items-center gap-3 flex-wrap">
                  <TierBadge tier="gold" />
                  <Badge variant="outline" className="gap-1">
                    <MapPin className="w-3 h-3" />
                    Western Cape - Cape Town
                  </Badge>
                  <StatusBadge status="ok" label="Temp OK" />
                  <StatusBadge status="ok" label="Power OK" />
                  <StatusBadge status="ok" label="Voltage OK" />
                </div>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-600">Current Rank</p>
              <p className="text-3xl font-semibold text-gray-900">#1</p>
              <p className="text-sm text-green-600 font-medium mt-1">
                ↑ +1 from last period
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* AI Explanation */}
      <InsightCard
        type="positive"
        title="Why this unit moved to #1 (Gold Tier)"
        description="This unit showed a 32% increase in door activity over the last 30 days, correlating with increased foot traffic at the Cape Town Waterfront location. Temperature compliance remained excellent at 99.2%, and there were zero power interruptions. Weekend performance was particularly strong, with Friday-Sunday accounting for 58% of total activity. The unit benefits from high visibility placement and proximity to tourist attractions."
        className="mb-8"
      />

      {/* Evidence Block */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Supporting Evidence</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-sm text-green-800 font-medium mb-1">
                Door Activity
              </p>
              <p className="text-2xl font-semibold text-green-900">+32%</p>
              <p className="text-xs text-green-700 mt-1">
                From 2,620 to 3,456 opens
              </p>
            </div>
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-800 font-medium mb-1">
                Temp Compliance
              </p>
              <p className="text-2xl font-semibold text-blue-900">99.2%</p>
              <p className="text-xs text-blue-700 mt-1">
                Well above 95% target
              </p>
            </div>
            <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
              <p className="text-sm text-purple-800 font-medium mb-1">
                Uptime
              </p>
              <p className="text-2xl font-semibold text-purple-900">100%</p>
              <p className="text-xs text-purple-700 mt-1">
                Zero power interruptions
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Trend Charts */}
      <div className="mb-8">
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Filter Metrics</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="doorOpens"
                  checked={visibleMetrics.doorOpens}
                  onCheckedChange={() => toggleMetric("doorOpens")}
                />
                <Label htmlFor="doorOpens" className="font-medium cursor-pointer">
                  Door Opens
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="temperature"
                  checked={visibleMetrics.temperature}
                  onCheckedChange={() => toggleMetric("temperature")}
                />
                <Label htmlFor="temperature" className="font-medium cursor-pointer">
                  Temperature
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="powered"
                  checked={visibleMetrics.powered}
                  onCheckedChange={() => toggleMetric("powered")}
                />
                <Label htmlFor="powered" className="font-medium cursor-pointer">
                  Power Status
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="condenser"
                  checked={visibleMetrics.condenser}
                  onCheckedChange={() => toggleMetric("condenser")}
                />
                <Label htmlFor="condenser" className="font-medium cursor-pointer">
                  Condenser Temp
                </Label>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Trend Charts */}
      <div className="grid grid-cols-1 gap-6 mb-8">
        {visibleMetrics.doorOpens && (
          <Card>
            <CardHeader>
              <CardTitle>Door Opens Per Day (Last 30 Days)</CardTitle>
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
                    dot={{ fill: "#3b82f6", r: 3 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {visibleMetrics.temperature && (
          <Card>
            <CardHeader>
              <CardTitle>Average Temperature Per Day (°C)</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={tempData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="date" stroke="#6b7280" fontSize={12} />
                  <YAxis stroke="#6b7280" fontSize={12} domain={[3, 5]} />
                  <Tooltip />
                  <Line
                    type="monotone"
                    dataKey="temp"
                    stroke="#10b981"
                    strokeWidth={2}
                    dot={{ fill: "#10b981", r: 3 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {visibleMetrics.powered && (
          <Card>
            <CardHeader>
              <CardTitle>Powered Percentage Per Day (%)</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={poweredData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="date" stroke="#6b7280" fontSize={12} />
                  <YAxis stroke="#6b7280" fontSize={12} domain={[99, 100]} />
                  <Tooltip />
                  <Line
                    type="monotone"
                    dataKey="powered"
                    stroke="#8b5cf6"
                    strokeWidth={2}
                    dot={{ fill: "#8b5cf6", r: 3 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {visibleMetrics.condenser && (
          <Card>
            <CardHeader>
              <CardTitle>Condenser Temperature Per Day (°C)</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={condenserData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="date" stroke="#6b7280" fontSize={12} />
                  <YAxis stroke="#6b7280" fontSize={12} domain={[36, 39]} />
                  <Tooltip />
                  <Line
                    type="monotone"
                    dataKey="condenser"
                    stroke="#ea580c"
                    strokeWidth={2}
                    dot={{ fill: "#ea580c", r: 3 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
    </>
  );
}
