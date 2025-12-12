"use client";

import * as React from "react";
import { Link, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "@/lib/utils";
import { LogoBrandBracket } from "@/components/brand/logo-brand";
import { NavigationUser } from "@/components/layout/sidebar/navigation-user";
import { SIDEBAR_ITEMS } from "@/constants/sidebar";
import { XIcon, ChevronRightIcon } from "@/components/ui/icons";
import ThemeSwitch from "@/components/table-columns/theme-switch";

// ============================================================================
// TYPES
// ============================================================================

interface MobileMenuDrawerProps {
  open: boolean;
  onClose: () => void;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function MobileMenuDrawer({ open, onClose }: MobileMenuDrawerProps) {
  const location = useLocation();

  // Close on route change
  React.useEffect(() => {
    onClose();
  }, [location.pathname, onClose]);

  // Prevent body scroll when open
  React.useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  // Get all menu items except Overview (which is in bottom nav)
  const { Overview, ...menuSections } = SIDEBAR_ITEMS;

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm md:hidden"
            onClick={onClose}
          />

          {/* Drawer */}
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className={cn(
              "fixed inset-y-0 right-0 z-50 w-[85vw] max-w-sm",
              "bg-background",
              "flex flex-col",
              "shadow-2xl",
              "md:hidden"
            )}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 h-14 border-b border-border/50">
              <LogoBrandBracket asLink={false} />
              <div className="flex items-center gap-2">
                <ThemeSwitch />
                <button
                  onClick={onClose}
                  className={cn(
                    "p-2 -mr-2 rounded-full",
                    "text-muted-foreground hover:text-foreground",
                    "hover:bg-muted/50 active:bg-muted",
                    "transition-colors"
                  )}
                >
                  <XIcon className="size-5" />
                </button>
              </div>
            </div>

            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto overscroll-contain">
              <div className="px-3 py-4 space-y-6">
                {Object.entries(menuSections).map(([section, items]) => (
                  <div key={section}>
                    {/* Section header */}
                    <h3 className="px-3 mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      {section}
                    </h3>

                    {/* Items */}
                    <div className="space-y-1">
                      {items.map((item) => {
                        const isActive = location.pathname === item.url;
                        const hasChildren = item.children && item.children.length > 0;

                        return (
                          <div key={item.url}>
                            <Link
                              to={item.url}
                              onClick={onClose}
                              className={cn(
                                "flex items-center gap-3 px-3 py-3 rounded-xl",
                                "transition-all duration-200",
                                "active:scale-[0.98]",
                                isActive
                                  ? "bg-primary/10 text-primary"
                                  : "text-foreground hover:bg-muted/50 active:bg-muted"
                              )}
                            >
                              <div
                                className={cn(
                                  "flex items-center justify-center size-9 rounded-lg",
                                  isActive
                                    ? "bg-primary text-primary-foreground"
                                    : "bg-muted text-muted-foreground"
                                )}
                              >
                                <div className="[&>svg]:size-4">
                                  {item.icon}
                                </div>
                              </div>
                              <span className="flex-1 font-medium">
                                {item.name}
                              </span>
                              {hasChildren && (
                                <ChevronRightIcon className="size-4 text-muted-foreground" />
                              )}
                            </Link>

                            {/* Children */}
                            {hasChildren && (
                              <div className="ml-12 mt-1 space-y-1">
                                {item.children!.map((child) => {
                                  const isChildActive = location.pathname === child.url;
                                  return (
                                    <Link
                                      key={child.url}
                                      to={child.url}
                                      onClick={onClose}
                                      className={cn(
                                        "flex items-center gap-2 px-3 py-2.5 rounded-lg",
                                        "text-sm transition-colors",
                                        "active:scale-[0.98]",
                                        isChildActive
                                          ? "text-primary bg-primary/5"
                                          : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
                                      )}
                                    >
                                      <div className="[&>svg]:size-3.5">
                                        {child.icon}
                                      </div>
                                      <span>{child.name}</span>
                                    </Link>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Footer - User section */}
            <div className="border-t border-border/50 p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
              <NavigationUser />
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

export default MobileMenuDrawer;
