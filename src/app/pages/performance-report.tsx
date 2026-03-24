import { useState } from "react";
import { 
  Server, 
  Thermometer, 
  Zap, 
  AlertTriangle,
  DoorOpen,
  Eye,
  Download,
  ExternalLink,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { EnhancedKPICard } from "../components/dashboard/enhanced-kpi-card";
import { DistributionChartCard } from "../components/dashboard/distribution-chart-card";
import { StackedBarChartCard } from "../components/dashboard/stacked-bar-chart-card";
import { EnhancedDataTable, Column } from "../components/dashboard/enhanced-data-table";
import { TempStatusBadge, PowerStatusBadge, VoltageStatusBadge } from "../components/dashboard/enhanced-status-badge";
import { TierBadge } from "../components/dashboard/tier-badge";
import { DataFreshnessBadge } from "../components/dashboard/data-freshness-badge";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { cn } from "../components/ui/utils";

/**
 * Performance Report Page - Frostlink Dashboard
 * 
 * Responsive breakpoints:
 * - Desktop: 1440px (xl) - Full layout with all columns
 * - Tablet: 834px (lg) - Stacked sections, fewer table columns
 * - Mobile: 390px (sm) - Single column, minimal table columns
 */

interface UnitData {
  mac_address: string;
  c_code: string;
  serial: string;
  district: string;
  tier: "gold" | "silver" | "bronze" | "insufficient";
  tempStatus: "ok" | "bad" | "no-data";
  powerStatus: "ok" | "warn" | "bad" | "no-data";
  voltageStatus: "ok" | "med" | "high" | "no-data";
  avgCaseTemp: number;
  doorOpens: number;
  lastSeen: string;
  deltaTemp?: number;
  deltaDoorOpens?: number;
}

export function PerformanceReportPage() {
  const [selectedUnit, setSelectedUnit] = useState<UnitData | null>(null);

  // Mock data
  const kpiData = {
    totalUnits: 1248,
    activePoweredOnPercent: 94.2,
    tempOkPercent: 87.5,
    highVoltageRisk: 23,
    avgCaseTemp: 3.8,
    avgDoorOpens: 847,
  };

  const sparklineData = [65, 68, 70, 72, 69, 71, 73, 75, 74, 76, 78, 77];

  const fleetStateData = [
    { name: "Fleet State", "Active & Powered ON": 1176, "Active but Powered OFF": 45, "Inactive": 27 },
  ];

  const tempFlagsData = [
    { name: "Temp OK", value: 1092, color: "#10b981" },
    { name: "Temp BAD", value: 129, color: "#ef4444" },
    { name: "NO DATA", value: 27, color: "#9ca3af" },
  ];

  const voltageFlagsData = [
    { name: "OK", value: 1178, color: "#10b981" },
    { name: "MED", value: 32, color: "#f97316" },
    { name: "HIGH", value: 23, color: "#ef4444" },
    { name: "NO DATA", value: 15, color: "#9ca3af" },
  ];

  const poweredFlagsData = [
    { name: "Powered ON", value: 1176, color: "#10b981" },
    { name: "Powered OFF", value: 45, color: "#ef4444" },
    { name: "NO DATA", value: 27, color: "#9ca3af" },
  ];

  const worstTempOffenders = [
    { mac: "MAC1234", c_code: "CC001", avgTemp: 12.4, delta: 3.2, district: "Cape Town CBD" },
    { mac: "MAC5678", c_code: "CC002", avgTemp: 11.8, delta: 2.9, district: "Johannesburg" },
    { mac: "MAC9012", c_code: "CC003", avgTemp: 11.2, delta: 2.5, district: "Durban" },
    { mac: "MAC3456", c_code: "CC004", avgTemp: 10.9, delta: 2.1, district: "Pretoria" },
    { mac: "MAC7890", c_code: "CC005", avgTemp: 10.5, delta: 1.8, district: "Port Elizabeth" },
  ];

  const highestDoorOpens = [
    { mac: "MAC2468", c_code: "CC101", opens: 2847, delta: 412, district: "Cape Town CBD" },
    { mac: "MAC1357", c_code: "CC102", opens: 2654, delta: 389, district: "Sandton" },
    { mac: "MAC9753", c_code: "CC103", opens: 2489, delta: 301, district: "Umhlanga" },
    { mac: "MAC8642", c_code: "CC104", opens: 2312, delta: 278, district: "Centurion" },
    { mac: "MAC7531", c_code: "CC105", opens: 2198, delta: 245, district: "Waterfront" },
  ];

  const newlyDegraded = [
    { mac: "MAC4321", c_code: "CC201", issue: "Temp exceeds threshold", was: "2.8°C", now: "8.4°C", district: "Stellenbosch" },
    { mac: "MAC8765", c_code: "CC202", issue: "Power instability", was: "OK", now: "WARN", district: "Paarl" },
    { mac: "MAC1098", c_code: "CC203", issue: "High voltage detected", was: "OK", now: "HIGH", district: "Somerset West" },
  ];

  const unitsData: UnitData[] = [
    {
      mac_address: "MAC001",
      c_code: "CC001",
      serial: "SN123456",
      district: "Cape Town CBD",
      tier: "gold",
      tempStatus: "ok",
      powerStatus: "ok",
      voltageStatus: "ok",
      avgCaseTemp: 3.2,
      doorOpens: 847,
      lastSeen: "2 min ago",
      deltaTemp: -0.3,
      deltaDoorOpens: 12,
    },
    {
      mac_address: "MAC002",
      c_code: "CC002",
      serial: "SN123457",
      district: "Johannesburg",
      tier: "silver",
      tempStatus: "bad",
      powerStatus: "warn",
      voltageStatus: "med",
      avgCaseTemp: 8.7,
      doorOpens: 1247,
      lastSeen: "5 min ago",
      deltaTemp: 2.1,
      deltaDoorOpens: -23,
    },
    {
      mac_address: "MAC003",
      c_code: "CC003",
      serial: "SN123458",
      district: "Durban",
      tier: "gold",
      tempStatus: "ok",
      powerStatus: "ok",
      voltageStatus: "high",
      avgCaseTemp: 2.9,
      doorOpens: 654,
      lastSeen: "1 min ago",
      deltaTemp: 0.1,
      deltaDoorOpens: 45,
    },
    {
      mac_address: "MAC004",
      c_code: "CC004",
      serial: "SN123459",
      district: "Pretoria",
      tier: "bronze",
      tempStatus: "ok",
      powerStatus: "ok",
      voltageStatus: "ok",
      avgCaseTemp: 4.1,
      doorOpens: 923,
      lastSeen: "3 min ago",
      deltaTemp: -0.2,
      deltaDoorOpens: 8,
    },
    {
      mac_address: "MAC005",
      c_code: "CC005",
      serial: "SN123460",
      district: "Port Elizabeth",
      tier: "silver",
      tempStatus: "no-data",
      powerStatus: "bad",
      voltageStatus: "no-data",
      avgCaseTemp: 0,
      doorOpens: 0,
      lastSeen: "2 days ago",
    },
  ];

  const columns: Column<UnitData>[] = [
    {
      key: "mac_address",
      label: "MAC Address",
      sortable: true,
      className: "font-mono text-xs",
    },
    {
      key: "c_code",
      label: "C_Code",
      sortable: true,
      className: "font-mono text-xs hidden lg:table-cell",
      headerClassName: "hidden lg:table-cell",
    },
    {
      key: "district",
      label: "District",
      sortable: true,
      className: "hidden md:table-cell",
      headerClassName: "hidden md:table-cell",
    },
    {
      key: "tier",
      label: "Tier",
      sortable: true,
      render: (row) => <TierBadge tier={row.tier} />,
      className: "hidden xl:table-cell",
      headerClassName: "hidden xl:table-cell",
    },
    {
      key: "tempStatus",
      label: "Temp Status",
      sortable: true,
      render: (row) => <TempStatusBadge status={row.tempStatus} />,
    },
    {
      key: "avgCaseTemp",
      label: "Avg Case Temp",
      sortable: true,
      className: "hidden sm:table-cell",
      headerClassName: "hidden sm:table-cell",
      render: (row) => (
        <div className="flex items-center gap-2">
          <span className={cn(
            "font-medium",
            row.avgCaseTemp > 6 ? "text-red-600" : "text-gray-900"
          )}>
            {row.avgCaseTemp.toFixed(1)}°C
          </span>
          {row.deltaTemp && (
            <span className={cn(
              "text-xs",
              row.deltaTemp > 0 ? "text-red-600" : "text-green-600"
            )}>
              ({row.deltaTemp > 0 ? "+" : ""}{row.deltaTemp.toFixed(1)})
            </span>
          )}
        </div>
      ),
    },
    {
      key: "powerStatus",
      label: "Power",
      sortable: true,
      render: (row) => <PowerStatusBadge status={row.powerStatus} />,
      headerClassName: "hidden lg:table-cell",
    },
    {
      key: "voltageStatus",
      label: "Voltage",
      sortable: true,
      render: (row) => <VoltageStatusBadge status={row.voltageStatus} />,
      className: "hidden xl:table-cell",
      headerClassName: "hidden xl:table-cell",
    },
    {
      key: "doorOpens",
      label: "Door Opens",
      sortable: true,
      className: "hidden md:table-cell",
      headerClassName: "hidden md:table-cell",
      render: (row) => (
        <div className="flex items-center gap-2">
          <span className="font-medium">{row.doorOpens.toLocaleString()}</span>
          {row.deltaDoorOpens && (
            <span className={cn(
              "text-xs",
              row.deltaDoorOpens > 0 ? "text-blue-600" : "text-gray-500"
            )}>
              ({row.deltaDoorOpens > 0 ? "+" : ""}{row.deltaDoorOpens})
            </span>
          )}
        </div>
      ),
    },
    {
      key: "lastSeen",
      label: "Last Seen",
      sortable: true,
      className: "text-gray-600 text-xs hidden sm:table-cell",
      headerClassName: "hidden sm:table-cell",
    },
  ];

  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-[1440px] mx-auto">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 mb-1">Performance Report</h1>
          <p className="text-sm text-gray-600">Fleet health and operational metrics</p>
        </div>
        <DataFreshnessBadge 
          generatedAt="2026-03-12 14:32:15"
          coverage={98.3}
        />
      </div>

      {/* Hero KPI Strip - Responsive grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 lg:gap-4">
        <EnhancedKPICard
          title="Total Units"
          value={kpiData.totalUnits.toLocaleString()}
          icon={<Server className="w-5 h-5" />}
        />
        <EnhancedKPICard
          title="Active & Powered ON"
          value={`${kpiData.activePoweredOnPercent}%`}
          delta={{ value: 1.2, label: "vs prev", isPositiveGood: true }}
          icon={<Zap className="w-5 h-5" />}
        />
        <EnhancedKPICard
          title="Temp OK Rate"
          value={`${kpiData.tempOkPercent}%`}
          delta={{ value: -2.3, label: "vs prev", isPositiveGood: true }}
          icon={<Thermometer className="w-5 h-5" />}
        />
        <EnhancedKPICard
          title="High Voltage Risk"
          value={kpiData.highVoltageRisk}
          delta={{ value: 4, label: "new", isPositiveGood: false }}
          icon={<AlertTriangle className="w-5 h-5" />}
        />
        <EnhancedKPICard
          title="Avg Case Temp"
          value={`${kpiData.avgCaseTemp}°C`}
          sparklineData={sparklineData}
        />
        <EnhancedKPICard
          title="Avg Door Opens"
          value={kpiData.avgDoorOpens.toLocaleString()}
          icon={<DoorOpen className="w-5 h-5" />}
        />
      </div>

      {/* Fleet Health Snapshot */}
      <div>
        <h2 className="text-lg font-medium text-gray-900 mb-4">Fleet Health Snapshot</h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-4">
          <StackedBarChartCard
            title="Fleet State"
            data={fleetStateData}
            stacks={[
              { dataKey: "Active & Powered ON", name: "Active & ON", fill: "#10b981" },
              { dataKey: "Active but Powered OFF", name: "Active but OFF", fill: "#f59e0b" },
              { dataKey: "Inactive", name: "Inactive", fill: "#ef4444" },
            ]}
            horizontal
            className="lg:col-span-1"
          />
          <DistributionChartCard
            title="Temperature Flags"
            data={tempFlagsData}
            showLegend={false}
          />
          <DistributionChartCard
            title="Voltage Risk"
            data={voltageFlagsData}
            showLegend={false}
          />
          <DistributionChartCard
            title="Power Status"
            data={poweredFlagsData}
            showLegend={false}
          />
        </div>
      </div>

      {/* Spotlight Section */}
      <div>
        <h2 className="text-lg font-medium text-gray-900 mb-4">Spotlight: Key Concerns</h2>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Top 10 Worst Temp Offenders */}
          <Card className="shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-red-600" />
                Top 5 Worst Temp Offenders
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {worstTempOffenders.map((item, index) => (
                  <div key={item.mac} className="flex items-start justify-between pb-3 border-b border-gray-100 last:border-0">
                    <div className="flex-1">
                      <div className="font-mono text-xs text-gray-600">{item.mac}</div>
                      <div className="text-sm text-gray-900">{item.district}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold text-red-600">{item.avgTemp}°C</div>
                      <div className="text-xs text-red-500">+{item.delta}°C</div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Highest Door Opens */}
          <Card className="shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <DoorOpen className="w-4 h-4 text-blue-600" />
                Top 5 Highest Door Opens
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {highestDoorOpens.map((item, index) => (
                  <div key={item.mac} className="flex items-start justify-between pb-3 border-b border-gray-100 last:border-0">
                    <div className="flex-1">
                      <div className="font-mono text-xs text-gray-600">{item.mac}</div>
                      <div className="text-sm text-gray-900">{item.district}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold text-blue-600">{item.opens.toLocaleString()}</div>
                      <div className="text-xs text-blue-500">+{item.delta}</div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Newly Degraded */}
          <Card className="shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingDown className="w-4 h-4 text-orange-600" />
                Newly Degraded Since Last Report
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {newlyDegraded.map((item, index) => (
                  <div key={item.mac} className="pb-3 border-b border-gray-100 last:border-0">
                    <div className="font-mono text-xs text-gray-600 mb-1">{item.mac}</div>
                    <div className="text-sm font-medium text-gray-900 mb-1">{item.issue}</div>
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-gray-600">{item.was}</span>
                      <span className="text-gray-400">→</span>
                      <span className="text-orange-600 font-medium">{item.now}</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Main Smart Table */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-medium text-gray-900">Unit Performance Details</h2>
          <Badge variant="secondary">{unitsData.length} units shown</Badge>
        </div>
        <EnhancedDataTable
          columns={columns}
          data={unitsData}
          onRowClick={(row) => setSelectedUnit(row)}
          rowActions={(row) => [
            {
              label: "View Details",
              onClick: () => console.log("View", row.mac_address),
              icon: <Eye className="w-4 h-4" />,
            },
            {
              label: "Export Data",
              onClick: () => console.log("Export", row.mac_address),
              icon: <Download className="w-4 h-4" />,
            },
          ]}
        />
      </div>

      {/* Optional Map Placeholder */}
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Flagged Units Map</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64 bg-gray-100 rounded-lg flex items-center justify-center border border-gray-200">
            <div className="text-center">
              <MapPin className="w-12 h-12 text-gray-400 mx-auto mb-2" />
              <p className="text-sm text-gray-600">Interactive map showing units with alerts</p>
              <p className="text-xs text-gray-500 mt-1">23 units flagged on map</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function MapPin(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}