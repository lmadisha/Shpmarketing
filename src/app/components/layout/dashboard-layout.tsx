import { Outlet, useMatches } from "react-router";
import { Sidebar } from "./sidebar";
import { FilterBar } from "./filter-bar";
import { useState } from "react";
import { AIAssistantDrawer } from "../dashboard/ai-assistant-drawer";

export function DashboardLayout() {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const matches = useMatches();
  const showFilterBar = matches.every((match) => {
    const routeHandle = match.handle as { showFilterBar?: boolean } | undefined;
    return routeHandle?.showFilterBar !== false;
  });

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        {showFilterBar ? <FilterBar /> : null}
        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
      <AIAssistantDrawer open={isDrawerOpen} onOpenChange={setIsDrawerOpen} />
    </div>
  );
}
