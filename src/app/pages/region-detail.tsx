import { useParams } from "react-router";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { KPICard } from "../components/dashboard/kpi-card";
import { TierBadge } from "../components/dashboard/tier-badge";
import { Button } from "../components/ui/button";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "../components/ui/breadcrumb";
import { Link } from "react-router";
import { ArrowRightLeft, Activity, Thermometer, Server } from "lucide-react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";

const doorOpensData = [
  { date: "Feb 3", opens: 156000 },
  { date: "Feb 10", opens: 162000 },
  { date: "Feb 17", opens: 171000 },
  { date: "Feb 24", opens: 183000 },
  { date: "Mar 2", opens: 195000 },
];

const tempComplianceData = [
  { date: "Feb 3", compliance: 92.5 },
  { date: "Feb 10", compliance: 93.2 },
  { date: "Feb 17", compliance: 94.1 },
  { date: "Feb 24", compliance: 93.8 },
  { date: "Mar 2", compliance: 94.5 },
];

const tierDistData = [
  { tier: "Gold", count: 45 },
  { tier: "Silver", count: 78 },
  { tier: "Bronze", count: 52 },
  { tier: "Insufficient", count: 12 },
];

const topUnits = [
  { mac: "MAC001", opens: 3456, tier: "gold" },
  { mac: "MAC123", opens: 3187, tier: "gold" },
  { mac: "MAC456", opens: 2654, tier: "silver" },
];

const bottomUnits = [
  { mac: "MAC789", opens: 456, tier: "bronze" },
  { mac: "MAC890", opens: 512, tier: "bronze" },
  { mac: "MAC901", opens: 598, tier: "bronze" },
];

export function RegionDetailPage() {
  const { regionId } = useParams();
  const regionName = regionId?.split("-").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ") || "Region";

  return (
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
              <Link to="/regional-map">Regional Map</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{regionName}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-semibold text-gray-900">
            {regionName}
          </h1>
          <p className="text-gray-600 mt-1">Regional performance overview</p>
        </div>
        <Button className="gap-2">
          <ArrowRightLeft className="w-4 h-4" />
          Generate Redistribution Recommendations
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <KPICard
          title="Total Units"
          value="187"
          change={3.2}
          changeLabel="vs last month"
          icon={<Server className="w-5 h-5" />}
        />
        <KPICard
          title="Door Opens (30d)"
          value="589.2K"
          change={15.8}
          changeLabel="vs previous period"
          icon={<Activity className="w-5 h-5" />}
        />
        <KPICard
          title="Temp Compliance"
          value="94.5%"
          change={2.0}
          changeLabel="vs last month"
          icon={<Thermometer className="w-5 h-5" />}
        />
        <KPICard
          title="Gold Tier Units"
          value="45"
          change={11.1}
          changeLabel="vs last month"
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <Card>
          <CardHeader>
            <CardTitle>Door Opens Trend</CardTitle>
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
                  dot={{ fill: "#3b82f6" }}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Temperature Compliance Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={tempComplianceData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="date" stroke="#6b7280" fontSize={12} />
                <YAxis stroke="#6b7280" fontSize={12} domain={[90, 100]} />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey="compliance"
                  stroke="#10b981"
                  strokeWidth={2}
                  dot={{ fill: "#10b981" }}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Tier Distribution */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Tier Distribution</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={tierDistData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="tier" stroke="#6b7280" fontSize={12} />
              <YAxis stroke="#6b7280" fontSize={12} />
              <Tooltip />
              <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Top/Bottom Units */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Top Performing Units</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Unit (MAC)</TableHead>
                  <TableHead className="text-right">Door Opens</TableHead>
                  <TableHead>Tier</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {topUnits.map((unit) => (
                  <TableRow key={unit.mac}>
                    <TableCell>
                      <Link
                        to={`/unit/${unit.mac}`}
                        className="text-blue-600 hover:underline font-medium"
                      >
                        {unit.mac}
                      </Link>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {unit.opens.toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <TierBadge tier={unit.tier as any} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Underperforming Units</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Unit (MAC)</TableHead>
                  <TableHead className="text-right">Door Opens</TableHead>
                  <TableHead>Tier</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bottomUnits.map((unit) => (
                  <TableRow key={unit.mac}>
                    <TableCell>
                      <Link
                        to={`/unit/${unit.mac}`}
                        className="text-blue-600 hover:underline font-medium"
                      >
                        {unit.mac}
                      </Link>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {unit.opens.toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <TierBadge tier={unit.tier as any} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
