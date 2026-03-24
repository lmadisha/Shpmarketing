import { useState } from "react";
import { Calendar, Search, Download, GitCompare, ChevronDown, X } from "lucide-react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { Badge } from "../ui/badge";
import { cn } from "../ui/utils";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "../ui/popover";

export function FilterBar() {
  const [compareMode, setCompareMode] = useState(false);
  const [selectedTenants, setSelectedTenants] = useState<string[]>(["all"]);
  const [selectedRegions, setSelectedRegions] = useState<string[]>([]);
  const [selectedTiers, setSelectedTiers] = useState<string[]>([]);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

  const tenants = ["All Tenants", "DigitalTwin", "SignalHill"];
  const regions = [
    "Western Cape",
    "Eastern Cape",
    "Northern Cape",
    "North West",
    "Free State",
    "Gauteng",
    "KwaZulu-Natal",
    "Mpumalanga",
    "Limpopo",
  ];
  const tiers = ["Gold", "Silver", "Bronze"];
  const statuses = ["Temp OK", "Temp BAD", "Power OK", "Power WARN"];

  const clearAllFilters = () => {
    setSelectedTenants(["all"]);
    setSelectedRegions([]);
    setSelectedTiers([]);
    setSelectedStatuses([]);
    setSearchQuery("");
    setCompareMode(false);
  };

  const hasActiveFilters = selectedRegions.length > 0 || selectedTiers.length > 0 || 
    selectedStatuses.length > 0 || searchQuery !== "" || compareMode;

  return (
    <div className="sticky top-0 z-30 bg-white border-b border-gray-200 shadow-sm">
      {/* Main Filter Row */}
      <div className="px-4 lg:px-6 py-3">
        <div className="flex flex-wrap items-center gap-2 lg:gap-3">
          {/* Mobile: Show fewer filters, hide on very small screens */}
          
          {/* Tenant Multi-Select - Desktop only */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="h-9 gap-2 hidden lg:flex">
                <span className="text-sm">
                  {selectedTenants.includes("all") ? "All Tenants" : `${selectedTenants.length} Tenants`}
                </span>
                <ChevronDown className="w-4 h-4 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-56 p-3" align="start">
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={selectedTenants.includes("all")}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedTenants(["all"]);
                      } else {
                        setSelectedTenants([]);
                      }
                    }}
                    className="rounded"
                  />
                  All Tenants
                </label>
                {tenants.slice(1).map((tenant) => (
                  <label key={tenant} className="flex items-center gap-2 text-sm cursor-pointer">
                    <input 
                      type="checkbox"
                      disabled={selectedTenants.includes("all")}
                      className="rounded"
                    />
                    {tenant}
                  </label>
                ))}
              </div>
            </PopoverContent>
          </Popover>

          {/* Date Picker */}
          <Select defaultValue="latest">
            <SelectTrigger className="w-48 h-9 hidden md:flex">
              <Calendar className="w-4 h-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="latest">Latest available (Mar 12, 2026)</SelectItem>
              <SelectItem value="yesterday">Yesterday</SelectItem>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="custom">Custom range...</SelectItem>
            </SelectContent>
          </Select>

          {/* Region/District Filter */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="h-9 gap-2 hidden sm:flex">
                <span className="text-sm">
                  {selectedRegions.length === 0 ? "All Regions" : `${selectedRegions.length} Regions`}
                </span>
                <ChevronDown className="w-4 h-4 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-56 p-3" align="start">
              <div className="space-y-2">
                {regions.map((region) => (
                  <label key={region} className="flex items-center gap-2 text-sm cursor-pointer">
                    <input 
                      type="checkbox"
                      checked={selectedRegions.includes(region)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedRegions([...selectedRegions, region]);
                        } else {
                          setSelectedRegions(selectedRegions.filter(r => r !== region));
                        }
                      }}
                      className="rounded"
                    />
                    {region}
                  </label>
                ))}
              </div>
            </PopoverContent>
          </Popover>

          {/* Tier Filter */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="h-9 gap-2 hidden lg:flex">
                <span className="text-sm">
                  {selectedTiers.length === 0 ? "All Tiers" : `${selectedTiers.length} Tiers`}
                </span>
                <ChevronDown className="w-4 h-4 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-48 p-3" align="start">
              <div className="space-y-2">
                {tiers.map((tier) => (
                  <label key={tier} className="flex items-center gap-2 text-sm cursor-pointer">
                    <input 
                      type="checkbox"
                      checked={selectedTiers.includes(tier)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedTiers([...selectedTiers, tier]);
                        } else {
                          setSelectedTiers(selectedTiers.filter(t => t !== tier));
                        }
                      }}
                      className="rounded"
                    />
                    {tier}
                  </label>
                ))}
              </div>
            </PopoverContent>
          </Popover>

          {/* Search */}
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="MAC, Serial, C_Code..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 h-9 w-full"
            />
          </div>

          {/* Spacer */}
          <div className="flex-1 hidden xl:block" />

          {/* Compare Toggle */}
          <Button
            variant={compareMode ? "default" : "outline"}
            size="sm"
            className="gap-2 h-9 hidden lg:flex"
            onClick={() => setCompareMode(!compareMode)}
          >
            <GitCompare className="w-4 h-4" />
            <span>Compare</span>
          </Button>

          {/* Export */}
          <Button variant="outline" size="sm" className="gap-2 h-9">
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">Export</span>
          </Button>

          {/* Clear Filters */}
          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              className="gap-2 h-9 text-gray-600"
              onClick={clearAllFilters}
            >
              <X className="w-4 h-4" />
              <span className="hidden sm:inline">Clear</span>
            </Button>
          )}
        </div>
      </div>

      {/* Active Filters Pills Row */}
      {hasActiveFilters && (
        <div className="px-4 lg:px-6 pb-3 flex flex-wrap gap-2">
          {selectedRegions.map((region) => (
            <Badge key={region} variant="secondary" className="gap-1">
              {region}
              <X 
                className="w-3 h-3 cursor-pointer" 
                onClick={() => setSelectedRegions(selectedRegions.filter(r => r !== region))}
              />
            </Badge>
          ))}
          {selectedTiers.map((tier) => (
            <Badge key={tier} variant="secondary" className="gap-1">
              {tier}
              <X 
                className="w-3 h-3 cursor-pointer" 
                onClick={() => setSelectedTiers(selectedTiers.filter(t => t !== tier))}
              />
            </Badge>
          ))}
          {compareMode && (
            <Badge variant="secondary" className="gap-1">
              Compare mode active
              <X 
                className="w-3 h-3 cursor-pointer" 
                onClick={() => setCompareMode(false)}
              />
            </Badge>
          )}
        </div>
      )}
    </div>
  );
}