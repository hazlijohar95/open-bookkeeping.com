import { Outlet, useLocation } from "react-router-dom";
import { AnimatePresence } from "motion/react";
import { useAuth } from "@/providers/auth-provider";
import { DashboardSidebar } from "@/components/layout/sidebar/dashboard-sidebar";
import DashboardSidebarHeader from "@/components/layout/sidebar/dashboard-sidebar-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { LoginRequiredModal } from "@/components/auth/login-required-modal";
import { PageTransition } from "@/components/ui/page-transition";

export function DashboardLayout() {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  // Always show layout shell - pages handle their own loading states
  return (
    <SidebarProvider>
      <DashboardSidebar />
      <SidebarInset>
        <div className="dash-page h-full overflow-hidden">
          <DashboardSidebarHeader />
          <main className="dash-layout-page-content-height scroll-bar-hidden overflow-y-scroll">
            <AnimatePresence mode="popLayout" initial={false}>
              <PageTransition key={location.pathname}>
                <Outlet />
              </PageTransition>
            </AnimatePresence>
          </main>
        </div>
      </SidebarInset>
      <LoginRequiredModal isOpen={!user && !isLoading} />
    </SidebarProvider>
  );
}
