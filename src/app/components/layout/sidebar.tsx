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
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { cn } from "../ui/utils";
import { Button } from "../ui/button";
import { useAuth } from "../../auth/auth-context";

type NavigationItem = {
  name: string;
  href: string;
  icon: React.ElementType;
  disabled?: boolean;
  hidden?: boolean;
};

const navigation: NavigationItem[] = [
  { name: "Overview", href: "/", icon: LayoutDashboard },
  // { name: "Fleet Ranking", href: "/fleet-ranking", icon: Trophy },
  { name: "Performance Report", href: "/performance-report", icon: FileBarChart },
  // { name: "Maintenance Report", href: "/maintenance-report", icon: Wrench },
  // { name: "Regional Map", href: "/regional-map", icon: Map },
  { name: "Unit Detail", href: "/unit/MAC001", icon: Server },
  { name: "Asset Manager", href: "/admin/assets", icon: Refrigerator },
  // { name: "Recommendations", href: "/recommendations", icon: MapPin, disabled: true },
  // { name: "Reports (Grafana)", href: "/reports", icon: BarChart3, disabled: true, hidden: true },
  { name: "Settings", href: "/settings", icon: Settings },
];

export function Sidebar() {
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
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
          "bg-white border-r border-gray-200 flex flex-col fixed lg:static inset-y-0 left-0 z-40 transition-all duration-300 ease-in-out shrink-0",
          !isOpen && "-translate-x-full lg:translate-x-0",
          isCollapsed ? "w-20" : "w-64"
        )}
      >
        <div className={cn("h-16 flex items-center border-b border-gray-200", isCollapsed ? "justify-center px-0" : "px-6 justify-between")}>
          {isCollapsed ? (
            <span className="font-bold text-xl text-blue-600">F</span>
          ) : (
            <h1 className="text-xl font-semibold text-gray-900 truncate pr-2">Frostlink</h1>
          )}
          <Button
            variant="ghost"
            size="icon"
            className={cn("hidden lg:flex shrink-0", isCollapsed ? "h-8 w-8" : "h-8 w-8 -mr-2")}
            onClick={() => setIsCollapsed(!isCollapsed)}
            title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
          >
            {isCollapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
          </Button>
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
                  className={cn(
                    "flex items-center rounded-lg text-sm text-gray-400 cursor-not-allowed opacity-60",
                    isCollapsed ? "justify-center p-3" : "gap-3 px-3 py-2.5"
                  )}
                  title={isCollapsed ? item.name : undefined}
                >
                  <Icon className={cn("shrink-0", isCollapsed ? "w-6 h-6" : "w-5 h-5")} />
                  {!isCollapsed && <span className="truncate">{item.name}</span>}
                </div>
              );
            }

            return (
              <Link
                key={item.name}
                to={item.href}
                onClick={() => setIsOpen(false)}
                className={cn(
                  "flex items-center rounded-lg transition-colors text-sm",
                  isActive
                    ? "bg-blue-50 text-blue-700 font-medium"
                    : "text-gray-700 hover:bg-gray-100",
                  isCollapsed ? "justify-center p-3" : "gap-3 px-3 py-2.5"
                )}
                title={isCollapsed ? item.name : undefined}
              >
                <Icon className={cn("shrink-0", isCollapsed ? "w-6 h-6" : "w-5 h-5")} />
                {!isCollapsed && <span className="truncate">{item.name}</span>}
              </Link>
            );
          })}
        </nav>
        <div className={cn("border-t border-gray-200 space-y-3", isCollapsed ? "p-3" : "p-4")}>
          {!isCollapsed && (
            <div>
              <p className="text-sm font-medium text-gray-900 truncate">{session?.user.full_name || session?.user.username}</p>
              <p className="text-xs text-gray-600 truncate">Role: {session?.user.permissions}</p>
            </div>
          )}
          <Button
            type="button"
            variant="outline"
            className={cn("w-full transition-all", isCollapsed ? "justify-center px-0" : "justify-start gap-2")}
            onClick={() => {
              logout();
              setIsOpen(false);
            }}
            title={isCollapsed ? "Sign out" : undefined}
          >
            <LogOut className="w-4 h-4 shrink-0" />
            {!isCollapsed && <span>Sign out</span>}
          </Button>
        </div>
      </aside>
    </>
  );
}