import { useState } from "react";
import { 
  Wrench, 
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Eye,
  Download,
  CheckCircle,
  ExternalLink,
  Thermometer,
} from "lucide-react";
import { EnhancedKPICard } from "../components/dashboard/enhanced-kpi-card";
import { DistributionChartCard } from "../components/dashboard/distribution-chart-card";
import { EnhancedDataTable, Column } from "../components/dashboard/enhanced-data-table";
import { DataFreshnessBadge } from "../components/dashboard/data-freshness-badge";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { cn } from "../components/ui/utils";
import { Button } from "../components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "../components/ui/sheet";

type SeverityLevel = "OK" | "Low" | "Medium" | "High" | "Severe";

interface MaintenanceUnit {
  mac_address: string;
  c_code: string;
  district: string;
  severity: SeverityLevel;
  diffCon: number;
  calculated_diff_con: number;
  cabinet_temp: number;
  condenser_temp: number;
  evaporator_temp: number;
  priorityScore: number;
  trend: "up" | "down" | "stable";
}

export function MaintenanceReportPage() {
  const [selectedUnit, setSelectedUnit] = useState<MaintenanceUnit | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Mock KPI data
  const kpiData = {
    unitsMeasured: 1248,
    unitsNotMeasured: 52,
    severeCount: 18,
    avgDiffCon: 7.2,
    newSevereSinceLast: 3,
  };

  // Severity distribution data
  const severityDistribution = [
    { name: "OK", value: 892, color: "#10b981" },
    { name: "Low", value: 234, color: "#3b82f6" },
    { name: "Medium", value: 89, color: "#f59e0b" },
    { name: "High", value: 15, color: "#ef4444" },
    { name: "Severe", value: 18, color: "#7c2d12" },
  ];

  // Ranked severity list
  const rankedSeverity = [
    { severity: "Severe", count: 18, trend: "up", change: 3 },
    { severity: "High", count: 15, trend: "down", change: -2 },
    { severity: "Medium", count: 89, trend: "up", change: 7 },
    { severity: "Low", count: 234, trend: "stable", change: 0 },
    { severity: "OK", count: 892, trend: "down", change: -8 },
  ];

  // Maintenance priority queue data
  const maintenanceData: MaintenanceUnit[] = [
    {
      mac_address: "MAC5001",
      c_code: "CC501",
      district: "Cape Town CBD",
      severity: "Severe",
      diffCon: 28.4,
      calculated_diff_con: 32.1,
      cabinet_temp: 8.2,
      condenser_temp: 42.5,
      evaporator_temp: -5.1,
      priorityScore: 95,
      trend: "up",
    },
    {
      mac_address: "MAC5002",
      c_code: "CC502",
      district: "Johannesburg",
      severity: "Severe",
      diffCon: 26.8,
      calculated_diff_con: 29.9,
      cabinet_temp: 7.8,
      condenser_temp: 41.2,
      evaporator_temp: -4.8,
      priorityScore: 92,
      trend: "up",
    },
    {
      mac_address: "MAC5003",
      c_code: "CC503",
      district: "Durban",
      severity: "High",
      diffCon: 22.1,
      calculated_diff_con: 24.5,
      cabinet_temp: 6.9,
      condenser_temp: 38.7,
      evaporator_temp: -3.2,
      priorityScore: 87,
      trend: "stable",
    },
    {
      mac_address: "MAC5004",
      c_code: "CC504",
      district: "Pretoria",
      severity: "High",
      diffCon: 20.5,
      calculated_diff_con: 22.8,
      cabinet_temp: 6.2,
      condenser_temp: 37.1,
      evaporator_temp: -2.9,
      priorityScore: 84,
      trend: "down",
    },
    {
      mac_address: "MAC5005",
      c_code: "CC505",
      district: "Port Elizabeth",
      severity: "Medium",
      diffCon: 15.3,
      calculated_diff_con: 17.2,
      cabinet_temp: 5.1,
      condenser_temp: 32.4,
      evaporator_temp: -1.8,
      priorityScore: 68,
      trend: "stable",
    },
  ];

  const getSeverityColor = (severity: SeverityLevel) => {
    const colors = {
      "OK": "bg-green-100 text-green-800 border-green-300",
      "Low": "bg-blue-100 text-blue-800 border-blue-300",
      "Medium": "bg-orange-100 text-orange-800 border-orange-300",
      "High": "bg-red-100 text-red-800 border-red-300",
      "Severe": "bg-red-900 text-white border-red-900",
    };
    return colors[severity];
  };

  const columns: Column<MaintenanceUnit>[] = [
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
      className: "font-mono text-xs",
    },
    {
      key: "district",
      label: "District",
      sortable: true,
    },
    {
      key: "severity",
      label: "Severity",
      sortable: true,
      render: (row) => (
        <Badge variant="outline" className={cn("text-xs font-medium", getSeverityColor(row.severity))}>
          {row.severity}
        </Badge>
      ),
    },
    {
      key: "diffCon",
      label: "Diff Con",
      sortable: true,
      render: (row) => (
        <span className={cn(
          "font-medium",
          row.diffCon > 20 ? "text-red-600" : row.diffCon > 15 ? "text-orange-600" : "text-gray-900"
        )}>
          {row.diffCon.toFixed(1)}°C
        </span>
      ),
    },
    {
      key: "calculated_diff_con",
      label: "Calc Diff Con",
      sortable: true,
      render: (row) => (
        <span className="text-gray-700">{row.calculated_diff_con.toFixed(1)}°C</span>
      ),
    },
    {
      key: "cabinet_temp",
      label: "Cabinet",
      sortable: true,
      render: (row) => (
        <span className="text-sm">{row.cabinet_temp.toFixed(1)}°C</span>
      ),
    },
    {
      key: "condenser_temp",
      label: "Condenser",
      sortable: true,
      render: (row) => (
        <span className="text-sm">{row.condenser_temp.toFixed(1)}°C</span>
      ),
    },
    {
      key: "evaporator_temp",
      label: "Evaporator",
      sortable: true,
      render: (row) => (
        <span className="text-sm">{row.evaporator_temp.toFixed(1)}°C</span>
      ),
    },
    {
      key: "priorityScore",
      label: "Priority",
      sortable: true,
      render: (row) => (
        <div className="flex items-center gap-2">
          <span className={cn(
            "font-semibold",
            row.priorityScore >= 90 ? "text-red-600" : 
            row.priorityScore >= 80 ? "text-orange-600" : 
            "text-gray-900"
          )}>
            {row.priorityScore}
          </span>
          {row.trend === "up" && <TrendingUp className="w-3 h-3 text-red-500" />}
          {row.trend === "down" && <TrendingDown className="w-3 h-3 text-green-500" />}
        </div>
      ),
    },
  ];

  const handleRowClick = (row: MaintenanceUnit) => {
    setSelectedUnit(row);
    setDrawerOpen(true);
  };

  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-[1440px] mx-auto">
      {/* Page Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 mb-1">Maintenance Report</h1>
          <p className="text-sm text-gray-600">Refrigeration system diagnostics and priority queue</p>
        </div>
        <DataFreshnessBadge 
          generatedAt="2026-03-12 14:32:15"
          coverage={96.0}
        />
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <EnhancedKPICard
          title="Units Measured"
          value={kpiData.unitsMeasured.toLocaleString()}
          icon={<Wrench className="w-5 h-5" />}
        />
        <EnhancedKPICard
          title="Not Measured"
          value={kpiData.unitsNotMeasured}
          delta={{ value: 8, label: "vs prev", isPositiveGood: false }}
          icon={<AlertTriangle className="w-5 h-5" />}
        />
        <EnhancedKPICard
          title="Severe Count"
          value={kpiData.severeCount}
          delta={{ value: 3, label: "new", isPositiveGood: false }}
        />
        <EnhancedKPICard
          title="Avg Diff Con"
          value={`${kpiData.avgDiffCon}°C`}
          delta={{ value: 0.8, label: "vs prev", isPositiveGood: false }}
        />
        <EnhancedKPICard
          title="New Severe"
          value={kpiData.newSevereSinceLast}
          subtitle="Since last report"
        />
      </div>

      {/* Severity Distribution + Ranked List */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-1">
          <DistributionChartCard
            title="Severity Distribution"
            data={severityDistribution}
            showLegend={false}
          />
        </div>
        
        <div className="lg:col-span-2">
          <Card className="shadow-sm h-full">
            <CardHeader>
              <CardTitle className="text-base">Severity Breakdown with Trends</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {rankedSeverity.map((item) => (
                  <div key={item.severity} className="flex items-center justify-between pb-3 border-b border-gray-100 last:border-0">
                    <div className="flex items-center gap-3">
                      <Badge 
                        variant="outline" 
                        className={cn("w-20 justify-center", getSeverityColor(item.severity as SeverityLevel))}
                      >
                        {item.severity}
                      </Badge>
                      <span className="text-2xl font-semibold text-gray-900">{item.count}</span>
                      <span className="text-sm text-gray-600">units</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {item.trend === "up" && (
                        <>
                          <TrendingUp className="w-4 h-4 text-red-500" />
                          <span className="text-sm text-red-600 font-medium">+{item.change}</span>
                        </>
                      )}
                      {item.trend === "down" && (
                        <>
                          <TrendingDown className="w-4 h-4 text-green-500" />
                          <span className="text-sm text-green-600 font-medium">{item.change}</span>
                        </>
                      )}
                      {item.trend === "stable" && (
                        <span className="text-sm text-gray-500">No change</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Maintenance Priority Queue Table */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-medium text-gray-900">Maintenance Priority Queue</h2>
          <div className="flex items-center gap-2">
            <Badge variant="secondary">{maintenanceData.length} units in queue</Badge>
            <Button size="sm" variant="outline" className="gap-2">
              <Download className="w-4 h-4" />
              Export Queue
            </Button>
          </div>
        </div>
        <EnhancedDataTable
          columns={columns}
          data={maintenanceData}
          onRowClick={handleRowClick}
          rowActions={(row) => [
            {
              label: "View Details",
              onClick: () => handleRowClick(row),
              icon: <Eye className="w-4 h-4" />,
            },
            {
              label: "Mark Reviewed",
              onClick: () => console.log("Mark reviewed", row.mac_address),
              icon: <CheckCircle className="w-4 h-4" />,
            },
            {
              label: "Export Data",
              onClick: () => console.log("Export", row.mac_address),
              icon: <Download className="w-4 h-4" />,
            },
          ]}
        />
      </div>

      {/* Unit Detail Drawer */}
      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Unit Maintenance Details</SheetTitle>
          </SheetHeader>
          
          {selectedUnit && (
            <div className="mt-6 space-y-6">
              {/* Unit Summary */}
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-3">Unit Summary</h3>
                <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">MAC Address</span>
                    <span className="text-sm font-mono font-medium">{selectedUnit.mac_address}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">C_Code</span>
                    <span className="text-sm font-mono font-medium">{selectedUnit.c_code}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">District</span>
                    <span className="text-sm font-medium">{selectedUnit.district}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Severity</span>
                    <Badge variant="outline" className={cn("text-xs", getSeverityColor(selectedUnit.severity))}>
                      {selectedUnit.severity}
                    </Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Priority Score</span>
                    <span className={cn(
                      "text-sm font-semibold",
                      selectedUnit.priorityScore >= 90 ? "text-red-600" : "text-gray-900"
                    )}>
                      {selectedUnit.priorityScore}/100
                    </span>
                  </div>
                </div>
              </div>

              {/* Temperature Metrics */}
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-3">Temperature Metrics</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-blue-50 rounded-lg p-3">
                    <div className="text-xs text-blue-700 mb-1">Cabinet Temp</div>
                    <div className="text-xl font-semibold text-blue-900">{selectedUnit.cabinet_temp.toFixed(1)}°C</div>
                  </div>
                  <div className="bg-orange-50 rounded-lg p-3">
                    <div className="text-xs text-orange-700 mb-1">Condenser Temp</div>
                    <div className="text-xl font-semibold text-orange-900">{selectedUnit.condenser_temp.toFixed(1)}°C</div>
                  </div>
                  <div className="bg-cyan-50 rounded-lg p-3">
                    <div className="text-xs text-cyan-700 mb-1">Evaporator Temp</div>
                    <div className="text-xl font-semibold text-cyan-900">{selectedUnit.evaporator_temp.toFixed(1)}°C</div>
                  </div>
                  <div className="bg-red-50 rounded-lg p-3">
                    <div className="text-xs text-red-700 mb-1">Diff Con</div>
                    <div className="text-xl font-semibold text-red-900">{selectedUnit.diffCon.toFixed(1)}°C</div>
                  </div>
                </div>
              </div>

              {/* 7-Day Trend Charts Placeholder */}
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-3">7-Day Temperature Trends</h3>
                <div className="space-y-3">
                  <div className="h-32 bg-gray-100 rounded-lg flex items-center justify-center border border-gray-200">
                    <div className="text-center">
                      <Thermometer className="w-8 h-8 text-gray-400 mx-auto mb-1" />
                      <p className="text-xs text-gray-600">Cabinet temp trend chart</p>
                    </div>
                  </div>
                  <div className="h-32 bg-gray-100 rounded-lg flex items-center justify-center border border-gray-200">
                    <div className="text-center">
                      <Thermometer className="w-8 h-8 text-gray-400 mx-auto mb-1" />
                      <p className="text-xs text-gray-600">Condenser temp trend chart</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Likely Cause Insight */}
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-3">AI Insights</h3>
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-purple-600 mt-0.5" />
                    <div>
                      <h4 className="text-sm font-medium text-purple-900 mb-1">Likely Cause</h4>
                      <p className="text-sm text-purple-800">
                        High condenser temperature and elevated diffCon suggest possible compressor efficiency loss or refrigerant charge issue. 
                        Recommend immediate service inspection.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <Button className="flex-1" variant="outline">
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Mark as Reviewed
                </Button>
                <Button className="flex-1">
                  <Download className="w-4 h-4 mr-2" />
                  Export Report
                </Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
