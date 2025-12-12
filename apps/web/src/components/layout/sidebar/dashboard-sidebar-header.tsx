import ThemeSwitch from "@/components/table-columns/theme-switch";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { AnimatePresence, motion } from "motion/react";
import { Separator } from "@/components/ui/separator";
import { SIDEBAR_ITEMS } from "@/constants/sidebar";
import { useLocation } from "react-router-dom";
import { useIsMobile } from "@/hooks/use-mobile";
import type { ISidebarHeader } from "@/types";
import { cn } from "@/lib/utils";

const DashboardSidebarHeader = ({ children }: ISidebarHeader) => {
  const location = useLocation();
  const pathname = location.pathname;
  const isMobile = useIsMobile();

  // Get Route details from sidebar items via pathname
  const route = Object.values(SIDEBAR_ITEMS)
    .flat()
    .find((item) => item.url === pathname);

  return (
    <header
      className={cn(
        "bg-background/80 backdrop-blur-xl sticky top-0 z-40",
        "flex shrink-0 items-center justify-between gap-2",
        "border-b border-border/50",
        "transition-[width,height] ease-linear select-none",
        // Mobile: taller, more padding
        isMobile ? "h-14 px-4" : "h-12 px-4",
        "group-has-[[data-collapsible=icon]]/sidebar-wrapper:h-12"
      )}
    >
      <div className="flex items-center gap-2">
        {/* Desktop: Sidebar trigger */}
        {!isMobile && <SidebarTrigger className="-ml-1" />}

        {route && !isMobile && (
          <Separator orientation="vertical" className="mr-2 min-h-4" />
        )}

        <AnimatePresence mode="wait">
          {route ? (
            <motion.div
              key={route.name}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.15, ease: "easeOut" }}
              className="flex flex-row items-center justify-between"
            >
              <div className="flex flex-row items-center gap-2.5">
                <div
                  className={cn(
                    "from-light-primary to-primary rounded-lg bg-gradient-to-br text-white",
                    // Larger icon container on mobile
                    isMobile ? "p-2 [&>svg]:size-4" : "p-[7px] [&>svg]:size-3.5"
                  )}
                >
                  {route.icon}
                </div>
                <div
                  className={cn(
                    "instrument-serif font-semibold",
                    // Larger text on mobile
                    isMobile ? "text-xl" : "text-xl"
                  )}
                >
                  {route.name}
                </div>
              </div>
              <>{children}</>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>

      {/* Desktop: Theme switch */}
      {!isMobile && (
        <div className="flex items-center gap-2">
          <ThemeSwitch />
        </div>
      )}
    </header>
  );
};

export default DashboardSidebarHeader;
