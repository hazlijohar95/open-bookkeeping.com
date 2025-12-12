import { useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { AnimatePresence } from "motion/react";
import { useAuth } from "@/providers/auth-provider";
import { useIsMobile } from "@/hooks/use-mobile";
import { DashboardSidebar } from "@/components/layout/sidebar/dashboard-sidebar";
import DashboardSidebarHeader from "@/components/layout/sidebar/dashboard-sidebar-header";
import { MobileBottomNav, MobileMenuDrawer } from "@/components/layout/mobile";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { LoginRequiredModal } from "@/components/auth/login-required-modal";
import { PageTransition } from "@/components/ui/page-transition";
import { cn } from "@/lib/utils";

export function DashboardLayout() {
  const { user, isLoading } = useAuth();
  const location = useLocation();
  const isMobile = useIsMobile();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <SidebarProvider>
      {/* Desktop sidebar - hidden on mobile */}
      <DashboardSidebar className="hidden md:flex" />

      <SidebarInset>
        <div className="dash-page h-full overflow-hidden">
          {/* Header */}
          <DashboardSidebarHeader />

          {/* Main content area */}
          <main
            className={cn(
              "dash-layout-page-content-height scroll-bar-hidden overflow-y-auto",
              // Add bottom padding on mobile for the bottom nav
              isMobile && "pb-20"
            )}
          >
            <AnimatePresence mode="popLayout" initial={false}>
              <PageTransition key={location.pathname}>
                <Outlet />
              </PageTransition>
            </AnimatePresence>
          </main>
        </div>
      </SidebarInset>

      {/* Mobile navigation */}
      <MobileBottomNav onMoreClick={() => setMobileMenuOpen(true)} />
      <MobileMenuDrawer
        open={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
      />

      {/* Login modal */}
      <LoginRequiredModal isOpen={!user && !isLoading} />
    </SidebarProvider>
  );
}
