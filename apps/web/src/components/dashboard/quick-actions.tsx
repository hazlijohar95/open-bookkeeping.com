"use client";

import { Link } from "react-router-dom";
import type { LucideIcon } from "@/components/ui/icons";
import {
  BarChart3,
  ArrowLeftRight,
  PieChart,
  Scale,
  TrendingUp,
  Calculator,
} from "@/components/ui/icons";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface QuickAction {
  icon: LucideIcon;
  label: string;
  href?: string;
  onClick?: () => void;
}

const QUICK_ACTIONS: QuickAction[] = [
  // Invoice Focused
  { icon: BarChart3, label: "Burn rate analysis", href: "/analytics" },
  { icon: ArrowLeftRight, label: "Latest transactions", href: "/transactions" },
  { icon: PieChart, label: "Expense Breakdown", href: "/analytics/expenses" },
  { icon: Scale, label: "Balance Sheet", href: "/reports" },
  { icon: TrendingUp, label: "Spending Analysis", href: "/analytics/spending" },
  { icon: Calculator, label: "Runway", href: "/analytics/runway" },
];

interface QuickActionsProps {
  className?: string;
}

export function QuickActions({ className }: QuickActionsProps) {
  return (
    <div className={cn("w-full", className)}>
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scroll-bar-hidden">
        {QUICK_ACTIONS.map((action) => {
          const Icon = action.icon;

          if (action.href) {
            return (
              <Button
                key={action.label}
                variant="outline"
                size="sm"
                asChild
                className="shrink-0 gap-2 rounded-full px-4 h-8 text-xs font-medium"
              >
                <Link to={action.href}>
                  <Icon className="size-3.5" />
                  {action.label}
                </Link>
              </Button>
            );
          }

          return (
            <Button
              key={action.label}
              variant="outline"
              size="sm"
              onClick={action.onClick}
              className="shrink-0 gap-2 rounded-full px-4 h-8 text-xs font-medium"
            >
              <Icon className="size-3.5" />
              {action.label}
            </Button>
          );
        })}
      </div>
    </div>
  );
}
