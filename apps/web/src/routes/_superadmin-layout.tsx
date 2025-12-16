import { useEffect } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { AnimatePresence } from "motion/react";
import { ShieldAlertIcon } from "@/components/ui/icons";
import { useAuth } from "@/providers/auth-provider";
import { useIsSuperadmin } from "@/hooks/use-user-role";
import { SuperadminSidebar } from "@/components/layout/sidebar/superadmin-sidebar";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { PageTransition } from "@/components/ui/page-transition";
import { Separator } from "@/components/ui/separator";
import { Breadcrumb, BreadcrumbItem, BreadcrumbList, BreadcrumbPage } from "@/components/ui/breadcrumb";
import { SUPERADMIN_SIDEBAR } from "@/constants/superadmin-sidebar";
import { cn } from "@/lib/utils";

/**
 * Get the page title from the sidebar config based on current path
 */
function getPageTitle(pathname: string): string {
  for (const section of Object.values(SUPERADMIN_SIDEBAR)) {
    for (const item of section) {
      if (item.url === pathname) {
        return item.name;
      }
    }
  }
  return "Superadmin";
}

export function SuperadminLayout() {
  const { user, isLoading: authLoading } = useAuth();
  const { isSuperadmin, isLoading: roleLoading } = useIsSuperadmin();
  const location = useLocation();
  const navigate = useNavigate();

  const isLoading = authLoading || roleLoading;
  const pageTitle = getPageTitle(location.pathname);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      const returnUrl = encodeURIComponent(location.pathname + location.search);
      void navigate(`/login?returnUrl=${returnUrl}`, { replace: true });
    }
  }, [user, authLoading, location, navigate]);

  // Redirect to dashboard if not superadmin
  useEffect(() => {
    if (!isLoading && user && !isSuperadmin) {
      void navigate("/dashboard", { replace: true });
    }
  }, [isSuperadmin, isLoading, user, navigate]);

  // Show loading state
  if (isLoading || !user) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  // Show access denied if not superadmin (brief flash before redirect)
  if (!isSuperadmin) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4">
        <ShieldAlertIcon className="size-16 text-destructive" />
        <h1 className="text-2xl font-bold">Access Denied</h1>
        <p className="text-muted-foreground">You do not have superadmin privileges.</p>
      </div>
    );
  }

  return (
    <SidebarProvider>
      {/* Desktop sidebar */}
      <SuperadminSidebar className="hidden md:flex" />

      <SidebarInset>
        <div className="h-full overflow-hidden">
          {/* Header */}
          <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
            <SidebarTrigger className="-ml-1 md:hidden" />
            <Separator orientation="vertical" className="mr-2 h-4 md:hidden" />
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbPage className="text-sm font-medium">
                    {pageTitle}
                  </BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </header>

          {/* Main content area */}
          <main className={cn("h-[calc(100vh-3.5rem)] overflow-y-auto")}>
            <AnimatePresence mode="popLayout" initial={false}>
              <PageTransition key={location.pathname}>
                <Outlet />
              </PageTransition>
            </AnimatePresence>
          </main>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
