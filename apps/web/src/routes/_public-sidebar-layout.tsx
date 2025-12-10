import { Outlet } from "react-router-dom";
import { DashboardSidebar } from "@/components/layout/sidebar/dashboard-sidebar";
import DashboardSidebarHeader from "@/components/layout/sidebar/dashboard-sidebar-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";

export function PublicSidebarLayout() {
  return (
    <SidebarProvider>
      <DashboardSidebar />
      <SidebarInset>
        <div className="dash-page h-full overflow-hidden">
          <DashboardSidebarHeader />
          <main className="dash-layout-page-content-height scroll-bar-hidden overflow-y-scroll">
            <Outlet />
          </main>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
