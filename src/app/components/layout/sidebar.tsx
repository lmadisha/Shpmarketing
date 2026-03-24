import { Link, useLocation } from "react-router";
import { useState } from "react";
import {
  LayoutDashboard,
  Trophy,
  FileBarChart,
  Wrench,
  MapPin,
  Map,
  Server,
  BarChart3,
  Settings,
  Refrigerator,
  Menu,
  X,
  LogOut,
} from "lucide-react";
import { cn } from "../ui/utils";
import { Button } from "../ui/button";
import { useAuth } from "../../auth/auth-context";

const navigation = [
  { name: "Overview", href: "/", icon: LayoutDashboard },
  { name: "Fleet Ranking", href: "/fleet-ranking", icon: Trophy },
  { name: "Performance Report", href: "/performance-report", icon: FileBarChart },
  { name: "Maintenance Report", href: "/maintenance-report", icon: Wrench },
  { name: "Regional Map", href: "/regional-map", icon: Map },
  { name: "Unit Detail", href: "/unit/MAC001", icon: Server },
  { name: "Asset Manager", href: "/admin/assets", icon: Refrigerator },
  { name: "Recommendations", href: "/recommendations", icon: MapPin, disabled: true },
  // { name: "Reports (Grafana)", href: "/reports", icon: BarChart3, disabled: true, hidden: true },
  { name: "Settings", href: "/settings", icon: Settings },
];

export function Sidebar() {
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const { session, logout } = useAuth();

  return (
    <>
      {/* Mobile Menu Button */}
      <Button
        variant="ghost"
        size="icon"
        className="fixed top-4 left-4 z-50 lg:hidden bg-white shadow-md"
        onClick={() => setIsOpen(!isOpen)}
      >
        {isOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
      </Button>

      {/* Overlay for mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "w-64 bg-white border-r border-gray-200 flex flex-col fixed lg:static inset-y-0 left-0 z-40 transition-transform duration-200",
          !isOpen && "-translate-x-full lg:translate-x-0"
        )}
      >
        <div className="h-16 flex items-center px-6 border-b border-gray-200">
          <h1 className="text-xl font-semibold text-gray-900">Frostlink</h1>
        </div>
        <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
          {navigation.map((item) => {
            const Icon = item.icon;
            const isActive =
              location.pathname === item.href ||
              (item.href !== "/" && location.pathname.startsWith(item.href));

            if (item.disabled) {
              return (
                <div
                  key={item.name}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-gray-400 cursor-not-allowed opacity-60"
                >
                  <Icon className="w-5 h-5" />
                  {item.name}
                </div>
              );
            }

            return (
              <Link
                key={item.name}
                to={item.href}
                onClick={() => setIsOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-sm",
                  isActive
                    ? "bg-blue-50 text-blue-700 font-medium"
                    : "text-gray-700 hover:bg-gray-100"
                )}
              >
                <Icon className="w-5 h-5" />
                {item.name}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-gray-200 p-4 space-y-3">
          <div>
            <p className="text-sm font-medium text-gray-900 truncate">{session?.user.full_name || session?.user.username}</p>
            <p className="text-xs text-gray-600">Role: {session?.user.permissions}</p>
          </div>
          <Button
            type="button"
            variant="outline"
            className="w-full justify-start"
            onClick={() => {
              logout();
              setIsOpen(false);
            }}
          >
            <LogOut className="w-4 h-4" />
            Sign out
          </Button>
        </div>
      </aside>
    </>
  );
}