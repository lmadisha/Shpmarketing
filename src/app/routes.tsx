import { createBrowserRouter, Navigate } from "react-router";
import { DashboardLayout } from "./components/layout/dashboard-layout";
import { OverviewPage } from "./pages/overview";
import { FleetRankingPage } from "./pages/fleet-ranking";
import { PerformanceReportPage } from "./pages/performance-report";
import { MaintenanceReportPage } from "./pages/maintenance-report";
import { RegionalMapPage } from "./pages/regional-map";
import { RegionDetailPage } from "./pages/region-detail";
import { UnitDetailPage } from "./pages/unit-detail";
import { RedistributionPage } from "./pages/redistribution";
import { ReportsPage } from "./pages/reports";
import { SettingsPage } from "./pages/settings";
import { AdminAssetsLayout } from "./pages/admin-assets/layout";
import { AddFridgePage } from "./pages/admin-assets/add-fridge";
import { InventoryPage } from "./pages/admin-assets/inventory";
import { MismatchesPage } from "./pages/admin-assets/mismatches";
import { HistoryPage } from "./pages/admin-assets/history";
import { DeviceCheckerPage } from "./pages/admin-assets/device-checker";
import { LoginPage } from "./pages/login";
import { SignupPage } from "./pages/signup";
import { GuestRoute, ProtectedRoute } from "./auth/route-guards";

export const router = createBrowserRouter([
  {
    Component: GuestRoute,
    children: [
      { path: "/login", Component: LoginPage },
      { path: "/signup", Component: SignupPage },
    ],
  },
  {
    Component: ProtectedRoute,
    children: [
      {
        path: "/",
        Component: DashboardLayout,
        children: [
          { index: true, Component: OverviewPage },
          { path: "fleet-ranking", Component: FleetRankingPage },
          { path: "performance-report", Component: PerformanceReportPage },
          { path: "maintenance-report", Component: MaintenanceReportPage },
          { path: "regional-map", Component: RegionalMapPage },
          { path: "region/:regionId", Component: RegionDetailPage },
          { path: "unit/:unitId", Component: UnitDetailPage },
          { path: "redistribution", Component: RedistributionPage },
          { path: "reports", Component: ReportsPage },
          { path: "settings", Component: SettingsPage },
          {
            path: "admin/assets",
            Component: AdminAssetsLayout,
            children: [
              { index: true, element: <Navigate to="/admin/assets/inventory" replace /> },
              { path: "add", Component: AddFridgePage },
              { path: "inventory", Component: InventoryPage },
              { path: "mismatches", Component: MismatchesPage },
              { path: "history", Component: HistoryPage },
              { path: "device-checker", Component: DeviceCheckerPage },
            ],
          },
        ],
      },
    ],
  },
]);
