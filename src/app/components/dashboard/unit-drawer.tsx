import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "../ui/sheet";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Separator } from "../ui/separator";
import { StatusBadge } from "./status-badge";
import { TierBadge } from "./tier-badge";
import { X, ExternalLink, MapPin, Calendar, Thermometer, Zap, DoorOpen, AlertCircle } from "lucide-react";
import { LineChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";

interface UnitDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  unit: {
    id: string;
    name: string;
    tier?: "gold" | "silver" | "bronze" | "insufficient";
    location: string;
    district: string;
    lastSync: string;
    tempStatus: "ok" | "bad" | "no-data";
    powerStatus: "ok" | "warn" | "bad" | "no-data";
    voltageStatus: "ok" | "med" | "high" | "no-data";
    avgTemp?: number;
    doorOpens?: number;
    flags?: string[];
  } | null;
}

export function UnitDrawer({ open, onOpenChange, unit }: UnitDrawerProps) {
  if (!unit) return null;

  // Mock trend data
  const trendData = [
    { time: "Mon", temp: 3.2, door: 45 },
    { time: "Tue", temp: 3.5, door: 52 },
    { time: "Wed", temp: 3.1, door: 48 },
    { time: "Thu", temp: 3.8, door: 61 },
    { time: "Fri", temp: 3.4, door: 55 },
    { time: "Sat", temp: 3.6, door: 58 },
    { time: "Sun", temp: 3.3, door: 50 },
  ];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span>{unit.name}</span>
                {unit.tier && <TierBadge tier={unit.tier} />}
              </div>
              <p className="text-sm font-normal text-gray-600 mt-1">{unit.id}</p>
            </div>
          </SheetTitle>
        </SheetHeader>

        <div className="space-y-6 mt-6">
          {/* Location Info */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <MapPin className="w-4 h-4" />
              <span>{unit.location}, {unit.district}</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Calendar className="w-4 h-4" />
              <span>Last sync: {unit.lastSync}</span>
            </div>
          </div>

          <Separator />

          {/* Status Flags */}
          <div>
            <h4 className="text-sm font-semibold text-gray-900 mb-3">Status Overview</h4>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Temperature</span>
                <StatusBadge
                  status={unit.tempStatus}
                  label={unit.tempStatus === "ok" ? "OK" : unit.tempStatus === "bad" ? "BAD" : "NO DATA"}
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Power</span>
                <StatusBadge
                  status={unit.powerStatus}
                  label={unit.powerStatus === "ok" ? "OK" : unit.powerStatus === "warn" ? "WARN" : unit.powerStatus === "bad" ? "BAD" : "NO DATA"}
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Voltage</span>
                <StatusBadge
                  status={unit.voltageStatus}
                  label={unit.voltageStatus === "ok" ? "OK" : unit.voltageStatus === "med" ? "MED" : unit.voltageStatus === "high" ? "HIGH" : "NO DATA"}
                />
              </div>
            </div>
          </div>

          <Separator />

          {/* Key Metrics */}
          <div>
            <h4 className="text-sm font-semibold text-gray-900 mb-3">Key Metrics</h4>
            <div className="grid grid-cols-2 gap-4">
              {unit.avgTemp && (
                <div className="p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-2 text-gray-600 mb-1">
                    <Thermometer className="w-4 h-4" />
                    <span className="text-xs">Avg Temp</span>
                  </div>
                  <p className="text-lg font-semibold text-gray-900">{unit.avgTemp}°C</p>
                </div>
              )}
              {unit.doorOpens && (
                <div className="p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-2 text-gray-600 mb-1">
                    <DoorOpen className="w-4 h-4" />
                    <span className="text-xs">Door Opens</span>
                  </div>
                  <p className="text-lg font-semibold text-gray-900">{unit.doorOpens}</p>
                </div>
              )}
            </div>
          </div>

          {/* Flags */}
          {unit.flags && unit.flags.length > 0 && (
            <>
              <Separator />
              <div>
                <h4 className="text-sm font-semibold text-gray-900 mb-3">Active Flags</h4>
                <div className="space-y-2">
                  {unit.flags.map((flag, index) => (
                    <div key={index} className="flex items-start gap-2 text-sm text-gray-700 p-2 bg-orange-50 border border-orange-200 rounded-md">
                      <AlertCircle className="w-4 h-4 text-orange-600 mt-0.5 flex-shrink-0" />
                      <span>{flag}</span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          <Separator />

          {/* 7-Day Trend */}
          <div>
            <h4 className="text-sm font-semibold text-gray-900 mb-3">7-Day Temperature Trend</h4>
            <ResponsiveContainer width="100%" height={160}>
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="time" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "white",
                    border: "1px solid #e5e7eb",
                    borderRadius: "8px",
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="temp"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  dot={{ fill: "#3b82f6" }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div>
            <h4 className="text-sm font-semibold text-gray-900 mb-3">7-Day Door Opens Trend</h4>
            <ResponsiveContainer width="100%" height={160}>
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="time" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "white",
                    border: "1px solid #e5e7eb",
                    borderRadius: "8px",
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="door"
                  stroke="#8b5cf6"
                  strokeWidth={2}
                  dot={{ fill: "#8b5cf6" }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <Separator />

          {/* AI Insights */}
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <h4 className="text-sm font-semibold text-blue-900 mb-2">AI Insights</h4>
            <p className="text-sm text-blue-800">
              Door open frequency is 23% higher than district average. Consider repositioning unit
              or educating staff on proper usage.
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1">
              <ExternalLink className="w-4 h-4 mr-2" />
              View Details
            </Button>
            <Button variant="default" className="flex-1">
              Export Report
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
