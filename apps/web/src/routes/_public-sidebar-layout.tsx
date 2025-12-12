import { useState } from "react";
import { Outlet } from "react-router-dom";
import { DashboardSidebar } from "@/components/layout/sidebar/dashboard-sidebar";
import DashboardSidebarHeader from "@/components/layout/sidebar/dashboard-sidebar-header";
import { MobileBottomNav, MobileMenuDrawer } from "@/components/layout/mobile";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

export function PublicSidebarLayout() {
  const isMobile = useIsMobile();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <SidebarProvider>
      {/* Desktop sidebar - hidden on mobile */}
      <DashboardSidebar className="hidden md:flex" />

      <SidebarInset>
        <div className="dash-page h-full overflow-hidden">
          <DashboardSidebarHeader />
          <main
            className={cn(
              "dash-layout-page-content-height scroll-bar-hidden overflow-y-auto",
              isMobile && "pb-20"
            )}
          >
            <Outlet />
          </main>
        </div>
      </SidebarInset>

      {/* Mobile navigation */}
      <MobileBottomNav onMoreClick={() => setMobileMenuOpen(true)} />
      <MobileMenuDrawer
        open={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
      />
    </SidebarProvider>
  );
}
