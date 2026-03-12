import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { TierBadge } from "../components/dashboard/tier-badge";
import { Button } from "../components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import { Map, MapPin } from "lucide-react";
import { KPICard } from "../components/dashboard/kpi-card";
import { Badge } from "../components/ui/badge";

const regionData = [
  { name: "Western Cape", units: 187, doorOpens: 589234, tier: "gold", lat: -33.9, lng: 18.4 },
  { name: "Gauteng", units: 245, doorOpens: 768921, tier: "gold", lat: -26.2, lng: 28.0 },
  { name: "KwaZulu-Natal", units: 156, doorOpens: 412876, tier: "silver", lat: -29.8, lng: 31.0 },
  { name: "Eastern Cape", units: 89, doorOpens: 187654, tier: "bronze", lat: -32.9, lng: 27.8 },
];

const topUnits = [
  { mac: "MAC001", region: "Western Cape", opens: 3456 },
  { mac: "MAC045", region: "Gauteng", opens: 3298 },
  { mac: "MAC123", region: "Western Cape", opens: 3187 },
  { mac: "MAC234", region: "Gauteng", opens: 2876 },
  { mac: "MAC456", region: "Western Cape", opens: 2654 },
];

const bottomUnits = [
  { mac: "MAC789", region: "Eastern Cape", opens: 456 },
  { mac: "MAC890", region: "KwaZulu-Natal", opens: 512 },
  { mac: "MAC901", region: "Eastern Cape", opens: 598 },
  { mac: "MAC012", region: "KwaZulu-Natal", opens: 623 },
  { mac: "MAC345", region: "Eastern Cape", opens: 687 },
];

export function RegionalMapPage() {
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null);

  return (
    <div className="p-8 max-w-[1440px] mx-auto">
      <h1 className="text-3xl font-semibold text-gray-900 flex items-center gap-2 mb-6">
        <Map className="w-8 h-8 text-blue-600" />
        Regional Map Performance
      </h1>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left Filter Panel */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Filters</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">
                Province
              </label>
              <Select>
                <SelectTrigger>
                  <SelectValue placeholder="All Provinces" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Provinces</SelectItem>
                  <SelectItem value="western-cape">Western Cape</SelectItem>
                  <SelectItem value="gauteng">Gauteng</SelectItem>
                  <SelectItem value="kwazulu-natal">KwaZulu-Natal</SelectItem>
                  <SelectItem value="eastern-cape">Eastern Cape</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">
                City
              </label>
              <Select>
                <SelectTrigger>
                  <SelectValue placeholder="All Cities" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Cities</SelectItem>
                  <SelectItem value="cape-town">Cape Town</SelectItem>
                  <SelectItem value="johannesburg">Johannesburg</SelectItem>
                  <SelectItem value="durban">Durban</SelectItem>
                  <SelectItem value="pretoria">Pretoria</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">
                Tier Filter
              </label>
              <Select>
                <SelectTrigger>
                  <SelectValue placeholder="All Tiers" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Tiers</SelectItem>
                  <SelectItem value="gold">Gold</SelectItem>
                  <SelectItem value="silver">Silver</SelectItem>
                  <SelectItem value="bronze">Bronze</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button className="w-full">Apply Filters</Button>
            <Button variant="outline" className="w-full">
              Reset
            </Button>

            {/* Map Legend */}
            <div className="pt-4 border-t">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">
                Map Legend
              </h3>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-full bg-yellow-400" />
                  <span className="text-sm text-gray-700">Gold Tier</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-full bg-gray-400" />
                  <span className="text-sm text-gray-700">Silver Tier</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-full bg-orange-400" />
                  <span className="text-sm text-gray-700">Bronze Tier</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse" />
                  <span className="text-sm text-gray-700">Critical Alert</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Map Panel */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Interactive Map</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="relative bg-gray-100 rounded-lg h-[600px] flex items-center justify-center">
              {/* Placeholder map with markers */}
              <div className="absolute inset-0 bg-gradient-to-br from-blue-100 to-blue-50 rounded-lg">
                {/* Simple visual representation */}
                {regionData.map((region, i) => (
                  <div
                    key={region.name}
                    className="absolute cursor-pointer group"
                    style={{
                      left: `${30 + i * 15}%`,
                      top: `${20 + i * 20}%`,
                    }}
                    onClick={() => setSelectedRegion(region.name)}
                  >
                    <div className="relative">
                      <MapPin
                        className={`w-8 h-8 ${
                          region.tier === "gold"
                            ? "text-yellow-500"
                            : region.tier === "silver"
                            ? "text-gray-500"
                            : "text-orange-500"
                        } drop-shadow-lg`}
                        fill="currentColor"
                      />
                      <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                        <div className="bg-white rounded-lg shadow-lg p-3 whitespace-nowrap border border-gray-200">
                          <p className="font-semibold text-sm">{region.name}</p>
                          <p className="text-xs text-gray-600">
                            {region.units} units
                          </p>
                          <p className="text-xs text-gray-600">
                            {region.doorOpens.toLocaleString()} opens
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="text-center text-gray-500 relative z-0">
                <Map className="w-16 h-16 mx-auto mb-2 opacity-30" />
                <p className="text-sm">Interactive map visualization</p>
                <p className="text-xs mt-1">Click markers for region details</p>
              </div>
            </div>

            {selectedRegion && (
              <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <h3 className="font-semibold text-blue-900 mb-2">
                  {selectedRegion} Selected
                </h3>
                <Button size="sm" asChild>
                  <a href={`/region/${selectedRegion.toLowerCase().replace(" ", "-")}`}>
                    View Region Details
                  </a>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Right Info Panel */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Regional KPIs</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <p className="text-sm text-gray-600 mb-1">Total Regions</p>
              <p className="text-2xl font-semibold text-gray-900">4</p>
            </div>

            <div>
              <p className="text-sm text-gray-600 mb-1">Total Units</p>
              <p className="text-2xl font-semibold text-gray-900">677</p>
            </div>

            <div>
              <p className="text-sm text-gray-600 mb-1">Total Door Opens</p>
              <p className="text-2xl font-semibold text-gray-900">1.96M</p>
            </div>

            <div className="pt-4 border-t">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">
                Top 5 Units
              </h3>
              <div className="space-y-2">
                {topUnits.map((unit) => (
                  <div
                    key={unit.mac}
                    className="flex items-center justify-between text-sm"
                  >
                    <span className="text-blue-600 font-medium">
                      {unit.mac}
                    </span>
                    <Badge variant="outline" className="text-xs">
                      {unit.opens.toLocaleString()}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-4 border-t">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">
                Bottom 5 Units
              </h3>
              <div className="space-y-2">
                {bottomUnits.map((unit) => (
                  <div
                    key={unit.mac}
                    className="flex items-center justify-between text-sm"
                  >
                    <span className="text-orange-600 font-medium">
                      {unit.mac}
                    </span>
                    <Badge variant="outline" className="text-xs">
                      {unit.opens.toLocaleString()}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
