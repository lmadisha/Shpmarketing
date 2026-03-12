import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { BarChart3, FileText, ExternalLink } from "lucide-react";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";

const reports = [
  {
    id: 1,
    name: "Performance Report",
    description: "Fleet-wide performance metrics and KPIs",
    type: "Grafana Dashboard",
    lastUpdated: "2 minutes ago",
  },
  {
    id: 2,
    name: "Maintenance Report",
    description: "Temperature, power, and voltage compliance tracking",
    type: "Grafana Dashboard",
    lastUpdated: "5 minutes ago",
  },
  {
    id: 3,
    name: "Regional Analysis",
    description: "Geographic performance breakdown by province and city",
    type: "Grafana Dashboard",
    lastUpdated: "12 minutes ago",
  },
  {
    id: 4,
    name: "Tier Movement Report",
    description: "Historical tier changes and trending analysis",
    type: "Grafana Dashboard",
    lastUpdated: "1 hour ago",
  },
];

export function ReportsPage() {
  return (
    <div className="p-8 max-w-[1440px] mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-semibold text-gray-900 flex items-center gap-2">
          <BarChart3 className="w-8 h-8 text-blue-600" />
          Reports & Analytics
        </h1>
        <p className="text-gray-600 mt-1">
          Embedded Grafana dashboards and analytics reports
        </p>
      </div>

      {/* Report Cards Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {reports.map((report) => (
          <Card key={report.id}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-blue-50 rounded-lg">
                    <FileText className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">{report.name}</CardTitle>
                    <p className="text-sm text-gray-600 mt-1">
                      {report.description}
                    </p>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <Badge variant="outline">{report.type}</Badge>
                  <p className="text-xs text-gray-500 mt-2">
                    Updated {report.lastUpdated}
                  </p>
                </div>
                <Button size="sm" className="gap-2">
                  <ExternalLink className="w-4 h-4" />
                  Open Dashboard
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Embedded Dashboard Placeholders */}
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Performance Report (Embedded)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="bg-gray-100 rounded-lg h-96 flex items-center justify-center border-2 border-dashed border-gray-300">
              <div className="text-center text-gray-500">
                <BarChart3 className="w-16 h-16 mx-auto mb-3 opacity-30" />
                <p className="font-medium">Grafana Dashboard Embed Placeholder</p>
                <p className="text-sm mt-1">Performance Report iframe would load here</p>
                <p className="text-xs mt-2 text-gray-400">
                  Source: https://grafana.example.com/d/performance
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Maintenance Report (Embedded)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="bg-gray-100 rounded-lg h-96 flex items-center justify-center border-2 border-dashed border-gray-300">
              <div className="text-center text-gray-500">
                <FileText className="w-16 h-16 mx-auto mb-3 opacity-30" />
                <p className="font-medium">Grafana Dashboard Embed Placeholder</p>
                <p className="text-sm mt-1">Maintenance Report iframe would load here</p>
                <p className="text-xs mt-2 text-gray-400">
                  Source: https://grafana.example.com/d/maintenance
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
