"use client";

import * as React from "react";
import { Link, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  GaugeIcon,
  VersionsIcon,
  ReceiptIcon,
  UsersIcon,
  SidebarMenuIcon,
} from "@/assets/icons";

// ============================================================================
// TYPES
// ============================================================================

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  matchPaths?: string[];
}

interface MobileBottomNavProps {
  onMoreClick: () => void;
}

// ============================================================================
// NAV ITEMS
// ============================================================================

const NAV_ITEMS: NavItem[] = [
  {
    label: "Dashboard",
    href: "/dashboard",
    icon: <GaugeIcon className="size-5" />,
    matchPaths: ["/dashboard"],
  },
  {
    label: "Invoices",
    href: "/invoices",
    icon: <VersionsIcon className="size-5" />,
    matchPaths: ["/invoices", "/quotations", "/credit-notes", "/debit-notes", "/create/invoice", "/edit/invoice"],
  },
  {
    label: "Bills",
    href: "/bills",
    icon: <ReceiptIcon className="size-5" />,
    matchPaths: ["/bills"],
  },
  {
    label: "Contacts",
    href: "/customers",
    icon: <UsersIcon className="size-5" />,
    matchPaths: ["/customers", "/vendors"],
  },
];

// ============================================================================
// COMPONENT
// ============================================================================

export function MobileBottomNav({ onMoreClick }: MobileBottomNavProps) {
  const location = useLocation();
  const isMobile = useIsMobile();

  if (!isMobile) return null;

  const isActive = (item: NavItem) => {
    const paths = item.matchPaths ?? [item.href];
    return paths.some((path) => location.pathname.startsWith(path));
  };

  return (
    <nav
      className={cn(
        "fixed bottom-0 left-0 right-0 z-50",
        "bg-background/80 backdrop-blur-xl",
        "border-t border-border/50",
        "pb-[env(safe-area-inset-bottom)]",
        "md:hidden"
      )}
    >
      <div className="flex items-center justify-around h-16 px-2">
        {NAV_ITEMS.map((item) => {
          const active = isActive(item);
          return (
            <Link
              key={item.href}
              to={item.href}
              className={cn(
                "relative flex flex-col items-center justify-center",
                "min-w-[64px] h-full px-3 py-2",
                "transition-colors duration-200",
                "active:scale-95 transition-transform",
                active ? "text-primary" : "text-muted-foreground"
              )}
            >
              {/* Active indicator */}
              <AnimatePresence>
                {active && (
                  <motion.div
                    layoutId="mobile-nav-indicator"
                    className="absolute inset-x-3 top-1 h-0.5 bg-primary rounded-full"
                    initial={{ opacity: 0, scaleX: 0 }}
                    animate={{ opacity: 1, scaleX: 1 }}
                    exit={{ opacity: 0, scaleX: 0 }}
                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                  />
                )}
              </AnimatePresence>

              {/* Icon with subtle scale animation */}
              <motion.div
                animate={{ scale: active ? 1.1 : 1 }}
                transition={{ type: "spring", stiffness: 400, damping: 25 }}
              >
                {item.icon}
              </motion.div>

              {/* Label */}
              <span
                className={cn(
                  "text-[10px] font-medium mt-1 tracking-tight",
                  active ? "text-primary" : "text-muted-foreground"
                )}
              >
                {item.label}
              </span>
            </Link>
          );
        })}

        {/* More button */}
        <button
          onClick={onMoreClick}
          className={cn(
            "relative flex flex-col items-center justify-center",
            "min-w-[64px] h-full px-3 py-2",
            "text-muted-foreground",
            "transition-colors duration-200",
            "active:scale-95 transition-transform",
            "active:text-foreground"
          )}
        >
          <SidebarMenuIcon className="size-5" />
          <span className="text-[10px] font-medium mt-1 tracking-tight">
            More
          </span>
        </button>
      </div>
    </nav>
  );
}

export default MobileBottomNav;
