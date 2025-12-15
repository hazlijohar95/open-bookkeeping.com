import { useState, useEffect } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { AnimatePresence } from "motion/react";
import { useAuth } from "@/providers/auth-provider";
import { useIsMobile } from "@/hooks/use-mobile";
import { useDataPrefetch } from "@/hooks/use-data-prefetch";
import { DashboardSidebar } from "@/components/layout/sidebar/dashboard-sidebar";
import DashboardSidebarHeader from "@/components/layout/sidebar/dashboard-sidebar-header";
import { MobileBottomNav, MobileMenuDrawer } from "@/components/layout/mobile";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { PageTransition } from "@/components/ui/page-transition";
import { cn } from "@/lib/utils";
import { TrialBanner, FreeTierBanner } from "@/components/subscription";

export function DashboardLayout() {
  const { user, isLoading } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Prefetch commonly needed data in background for instant navigation
  useDataPrefetch();

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!isLoading && !user) {
      // Save the current path to redirect back after login
      const returnUrl = encodeURIComponent(location.pathname + location.search);
      void navigate(`/login?returnUrl=${returnUrl}`, { replace: true });
    }
  }, [user, isLoading, location, navigate]);

  // Show nothing while checking auth or redirecting
  if (isLoading || !user) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <SidebarProvider>
      {/* Desktop sidebar - hidden on mobile */}
      <DashboardSidebar className="hidden md:flex" />

      <SidebarInset>
        <div className="dash-page h-full overflow-hidden">
          {/* Header */}
          <DashboardSidebarHeader />

          {/* Subscription banners */}
          <TrialBanner />
          <FreeTierBanner />

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
    </SidebarProvider>
  );
}
