import { Outlet } from "react-router";
import { Sidebar } from "./sidebar";
import { useState } from "react";
import { AIAssistantDrawer } from "../dashboard/ai-assistant-drawer";

export function DashboardLayout() {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <main className="flex-1 overflow-auto relative">
          <Outlet />
        </main>
      </div>
      <AIAssistantDrawer open={isDrawerOpen} onOpenChange={setIsDrawerOpen} />
    </div>
  );
}
