import { useState } from "react";
import { Calendar, ChevronDown, Search, Bell, Sparkles } from "lucide-react";
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

interface HeaderProps {
  onOpenAI: () => void;
}

export function Header({ onOpenAI }: HeaderProps) {
  const [dateRange, setDateRange] = useState("30d");

  return (
    <header className="h-16 bg-white border-b border-gray-200 px-4 lg:px-6 flex items-center gap-2 lg:gap-4 ml-0 lg:ml-0">
      {/* Date Range Selector - Hidden on mobile */}
      <div className="hidden md:flex items-center gap-2">
        <Calendar className="w-4 h-4 text-gray-500" />
        <Select value={dateRange} onValueChange={setDateRange}>
          <SelectTrigger className="w-36 h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7d">Last 7 days</SelectItem>
            <SelectItem value="30d">Last 30 days</SelectItem>
            <SelectItem value="90d">Last 90 days</SelectItem>
            <SelectItem value="custom">Custom range</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Region Filter - Hidden on mobile */}
      <Select defaultValue="all">
        <SelectTrigger className="w-32 md:w-40 h-9 hidden sm:flex">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Regions</SelectItem>
          <SelectItem value="western-cape">Western Cape</SelectItem>
          <SelectItem value="eastern-cape">Eastern Cape</SelectItem>
          <SelectItem value="northern-cape">Northern Cape</SelectItem>
          <SelectItem value="north-west">North West</SelectItem>
          <SelectItem value="free-state">Free State</SelectItem>
          <SelectItem value="gauteng">Gauteng</SelectItem>
          <SelectItem value="kwazulu-natal">KwaZulu-Natal</SelectItem>
          <SelectItem value="mpumalanga">Mpumalanga</SelectItem>
          <SelectItem value="limpopo">Limpopo</SelectItem>
        </SelectContent>
      </Select>

      {/* Tier Filter - Hidden on mobile */}
      <Select defaultValue="all">
        <SelectTrigger className="w-28 md:w-32 h-9 hidden sm:flex">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Tiers</SelectItem>
          <SelectItem value="gold">Gold</SelectItem>
          <SelectItem value="silver">Silver</SelectItem>
          <SelectItem value="bronze">Bronze</SelectItem>
        </SelectContent>
      </Select>

      {/* Search - Hidden on small screens */}
      <div className="relative flex-1 max-w-md hidden md:block">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <Input
          placeholder="Search by MAC or outlet..."
          className="pl-10 h-9"
        />
      </div>

      {/* Spacer */}
      <div className="flex-1 md:hidden" />

      {/* What's Changed Indicator */}
      <Button
        variant="outline"
        size="sm"
        className="gap-2 h-9"
        onClick={onOpenAI}
      >
        <Bell className="w-4 h-4" />
        <span className="hidden lg:inline">What's changed</span>
        <Badge variant="destructive" className="ml-1 px-1.5 py-0 text-xs">
          5
        </Badge>
      </Button>

      {/* AI Assistant */}
      <Button
        variant="default"
        size="sm"
        className="gap-2 h-9"
        onClick={onOpenAI}
      >
        <Sparkles className="w-4 h-4" />
        <span className="hidden md:inline">AI Assistant</span>
      </Button>
    </header>
  );
}