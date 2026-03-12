import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { TierBadge, TierType } from "../components/dashboard/tier-badge";
import { StatusBadge } from "../components/dashboard/status-badge";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";
import { TrendingUp, TrendingDown, Minus, Trophy } from "lucide-react";
import { Link } from "react-router";
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
import { Switch } from "../components/ui/switch";
import { Label } from "../components/ui/label";

const fleetData = [
  {
    rank: 1,
    mac: "MAC001",
    region: "Western Cape",
    doorOpens: 3456,
    avgTemp: 4.2,
    poweredPct: 99.8,
    voltageRisk: "low",
    tier: "gold" as TierType,
    trend: "up",
    previousRank: 2,
  },
  {
    rank: 2,
    mac: "MAC045",
    region: "Gauteng",
    doorOpens: 3298,
    avgTemp: 4.5,
    poweredPct: 99.5,
    voltageRisk: "low",
    tier: "gold" as TierType,
    trend: "up",
    previousRank: 5,
  },
  {
    rank: 3,
    mac: "MAC123",
    region: "Western Cape",
    doorOpens: 3187,
    avgTemp: 4.1,
    poweredPct: 99.9,
    voltageRisk: "low",
    tier: "gold" as TierType,
    trend: "same",
    previousRank: 3,
  },
  {
    rank: 4,
    mac: "MAC089",
    region: "KwaZulu-Natal",
    doorOpens: 2945,
    avgTemp: 5.8,
    poweredPct: 98.2,
    voltageRisk: "medium",
    tier: "silver" as TierType,
    trend: "down",
    previousRank: 1,
  },
  {
    rank: 5,
    mac: "MAC234",
    region: "Gauteng",
    doorOpens: 2876,
    avgTemp: 4.3,
    poweredPct: 99.7,
    voltageRisk: "low",
    tier: "silver" as TierType,
    trend: "up",
    previousRank: 8,
  },
  {
    rank: 6,
    mac: "MAC456",
    region: "Western Cape",
    doorOpens: 2654,
    avgTemp: 4.0,
    poweredPct: 99.8,
    voltageRisk: "low",
    tier: "silver" as TierType,
    trend: "same",
    previousRank: 6,
  },
  {
    rank: 7,
    mac: "MAC567",
    region: "Eastern Cape",
    doorOpens: 1987,
    avgTemp: 6.2,
    poweredPct: 97.5,
    voltageRisk: "high",
    tier: "bronze" as TierType,
    trend: "down",
    previousRank: 4,
  },
  {
    rank: 8,
    mac: "MAC678",
    region: "Gauteng",
    doorOpens: 1854,
    avgTemp: 4.6,
    poweredPct: 98.9,
    voltageRisk: "low",
    tier: "bronze" as TierType,
    trend: "same",
    previousRank: 8,
  },
];

const percentileCurveData = [
  { percentile: 0, opens: 450 },
  { percentile: 25, opens: 1200 },
  { percentile: 50, opens: 2000 },
  { percentile: 75, opens: 2800 },
  { percentile: 90, opens: 3200 },
  { percentile: 100, opens: 3500 },
];

const dayOfWeekData = [
  { day: "Mon", gold: 420, silver: 380, bronze: 180 },
  { day: "Tue", gold: 450, silver: 390, bronze: 190 },
  { day: "Wed", gold: 480, silver: 410, bronze: 200 },
  { day: "Thu", gold: 520, silver: 450, bronze: 220 },
  { day: "Fri", gold: 640, silver: 580, bronze: 280 },
  { day: "Sat", gold: 780, silver: 680, bronze: 340 },
  { day: "Sun", gold: 720, silver: 620, bronze: 310 },
];

export function FleetRankingPage() {
  const [compareMode, setCompareMode] = useState(false);

  const goldCount = fleetData.filter((d) => d.tier === "gold").length;
  const silverCount = fleetData.filter((d) => d.tier === "silver").length;
  const bronzeCount = fleetData.filter((d) => d.tier === "bronze").length;

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-[1440px] mx-auto">
      {/* Header */}
      <div className="flex items-start md:items-center justify-between mb-6 flex-col md:flex-row gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold text-gray-900 flex items-center gap-2">
            <Trophy className="w-6 h-6 md:w-8 md:h-8 text-yellow-500" />
            Fleet Ranking - Door Activity Tiers
          </h1>
          <p className="text-sm md:text-base text-gray-600 mt-1">
            Units ranked by door opens over the last 30 days
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Switch
            id="compare-mode"
            checked={compareMode}
            onCheckedChange={setCompareMode}
          />
          <Label htmlFor="compare-mode" className="text-sm">
            Compare to previous period
          </Label>
        </div>
      </div>

      {/* Tier Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6 md:mb-8">
        <Card className="border-2 border-yellow-200 bg-yellow-50">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-yellow-800 mb-1">Gold Tier</p>
                <p className="text-3xl font-semibold text-yellow-900">
                  {goldCount}
                </p>
                <p className="text-xs text-yellow-700 mt-1">Top performers</p>
              </div>
              <Trophy className="w-10 h-10 text-yellow-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-2 border-gray-300 bg-gray-50">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-800 mb-1">Silver Tier</p>
                <p className="text-3xl font-semibold text-gray-900">
                  {silverCount}
                </p>
                <p className="text-xs text-gray-700 mt-1">Above average</p>
              </div>
              <Trophy className="w-10 h-10 text-gray-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-2 border-orange-200 bg-orange-50">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-orange-800 mb-1">Bronze Tier</p>
                <p className="text-3xl font-semibold text-orange-900">
                  {bronzeCount}
                </p>
                <p className="text-xs text-orange-700 mt-1">Needs attention</p>
              </div>
              <Trophy className="w-10 h-10 text-orange-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-2 border-gray-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Insufficient Data</p>
                <p className="text-3xl font-semibold text-gray-900">45</p>
                <p className="text-xs text-gray-600 mt-1">Monitoring</p>
              </div>
              <Trophy className="w-10 h-10 text-gray-300" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <Card>
          <CardHeader>
            <CardTitle>Percentile Distribution Curve</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={percentileCurveData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis
                  dataKey="percentile"
                  stroke="#6b7280"
                  fontSize={12}
                  label={{ value: "Percentile", position: "insideBottom", offset: -5 }}
                />
                <YAxis
                  stroke="#6b7280"
                  fontSize={12}
                  label={{ value: "Door Opens", angle: -90, position: "insideLeft" }}
                />
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
            <CardTitle>Seasonal Trends (Day of Week)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={dayOfWeekData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="day" stroke="#6b7280" fontSize={12} />
                <YAxis stroke="#6b7280" fontSize={12} />
                <Tooltip />
                <Bar dataKey="gold" stackId="a" fill="#fbbf24" />
                <Bar dataKey="silver" stackId="a" fill="#9ca3af" />
                <Bar dataKey="bronze" stackId="a" fill="#fb923c" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Ranking Table */}
      <Card>
        <CardHeader>
          <CardTitle>Fleet Rankings</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">Rank</TableHead>
                  <TableHead>Unit (MAC)</TableHead>
                  <TableHead>Region</TableHead>
                  <TableHead className="text-right">Door Opens</TableHead>
                  <TableHead className="text-right">Avg Temp (°C)</TableHead>
                  <TableHead className="text-right">Powered %</TableHead>
                  <TableHead>Voltage Risk</TableHead>
                  <TableHead>Tier</TableHead>
                  <TableHead className="text-center">Trend</TableHead>
                  {compareMode && <TableHead className="text-right">Δ Rank</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {fleetData.map((unit) => (
                  <TableRow key={unit.mac}>
                    <TableCell className="font-medium">#{unit.rank}</TableCell>
                    <TableCell>
                      <Link
                        to={`/unit/${unit.mac}`}
                        className="text-blue-600 hover:underline font-medium"
                      >
                        {unit.mac}
                      </Link>
                    </TableCell>
                    <TableCell>{unit.region}</TableCell>
                    <TableCell className="text-right font-medium">
                      {unit.doorOpens.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right">{unit.avgTemp.toFixed(1)}</TableCell>
                    <TableCell className="text-right">{unit.poweredPct}%</TableCell>
                    <TableCell>
                      <StatusBadge
                        status={unit.voltageRisk === "low" ? "ok" : unit.voltageRisk === "medium" ? "med" : "high"}
                        label={unit.voltageRisk.toUpperCase()}
                      />
                    </TableCell>
                    <TableCell>
                      <TierBadge tier={unit.tier} />
                    </TableCell>
                    <TableCell className="text-center">
                      {unit.trend === "up" && (
                        <TrendingUp className="w-5 h-5 text-green-600 mx-auto" />
                      )}
                      {unit.trend === "down" && (
                        <TrendingDown className="w-5 h-5 text-red-600 mx-auto" />
                      )}
                      {unit.trend === "same" && (
                        <Minus className="w-5 h-5 text-gray-400 mx-auto" />
                      )}
                    </TableCell>
                    {compareMode && (
                      <TableCell className="text-right">
                        {unit.previousRank < unit.rank ? (
                          <Badge variant="destructive">
                            -{unit.rank - unit.previousRank}
                          </Badge>
                        ) : unit.previousRank > unit.rank ? (
                          <Badge className="bg-green-100 text-green-800">
                            +{unit.previousRank - unit.rank}
                          </Badge>
                        ) : (
                          <Badge variant="outline">—</Badge>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}