import React from "react";
import { Plus } from "@/components/ui/icons";
import { UsersIcon, ReceiptIcon, BookOpenIcon } from "@/assets/icons";
import { cn } from "@/lib/utils";

interface DashboardViewProps {
  formatAmount: (amount: number) => string;
}

const DashboardView = ({ formatAmount }: DashboardViewProps) => {
  return (
    <>
      <div className="flex-1 flex flex-col min-w-0 bg-background">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border/40">
          <div>
            <h1 className="text-lg font-semibold">Dashboard</h1>
            <p className="text-[11px] text-muted-foreground mt-0.5">Overview of your business</p>
          </div>
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
            <span>Last 30 days</span>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-4 divide-x divide-border/30 border-b border-border/40">
          {[
            { label: "Total Revenue", value: "65,500", change: "+18.2%", color: "emerald" },
            { label: "Outstanding", value: "21,750", change: "-5.4%", color: "amber" },
            { label: "Expenses", value: "12,300", change: "+3.1%", color: "red" },
            { label: "Net Profit", value: "53,200", change: "+22.8%", color: "emerald" },
          ].map((stat) => (
            <div key={stat.label} className="px-3 py-3">
              <span className="text-[9px] text-muted-foreground uppercase tracking-wide">{stat.label}</span>
              <div className="mt-1">
                <span className="text-[13px] font-bold tabular-nums">RM {stat.value}</span>
              </div>
              <span className={cn(
                "text-[9px] font-medium",
                stat.color === "emerald" && "text-emerald-600 dark:text-emerald-400",
                stat.color === "amber" && "text-amber-600 dark:text-amber-400",
                stat.color === "red" && "text-red-600 dark:text-red-400",
              )}>{stat.change}</span>
            </div>
          ))}
        </div>

        {/* Charts Section */}
        <div className="flex-1 p-5 overflow-y-auto">
          <div className="grid grid-cols-2 gap-4">
            {/* Revenue Chart */}
            <div className="border border-border/40 p-4">
              <div className="flex items-center justify-between mb-4">
                <span className="text-[12px] font-semibold">Revenue Overview</span>
                <span className="text-[10px] text-muted-foreground">Monthly</span>
              </div>
              <div className="flex items-end gap-2 h-32">
                {[45, 62, 55, 78, 65, 82, 70, 88, 75, 92, 85, 100].map((h, i) => (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1">
                    <div
                      className="w-full bg-primary/20 hover:bg-primary/40 transition-colors cursor-pointer"
                      style={{ height: `${h}%` }}
                    />
                    <span className="text-[8px] text-muted-foreground">
                      {["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"][i]}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Expense Breakdown */}
            <div className="border border-border/40 p-4">
              <div className="flex items-center justify-between mb-4">
                <span className="text-[12px] font-semibold">Expense Breakdown</span>
                <span className="text-[10px] text-muted-foreground">This month</span>
              </div>
              <div className="space-y-3">
                {[
                  { label: "Operations", amount: 4500, percent: 37, color: "bg-primary" },
                  { label: "Marketing", amount: 3200, percent: 26, color: "bg-amber-500" },
                  { label: "Software", amount: 2800, percent: 23, color: "bg-emerald-500" },
                  { label: "Other", amount: 1800, percent: 14, color: "bg-muted-foreground" },
                ].map((item) => (
                  <div key={item.label} className="space-y-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <span>{item.label}</span>
                      <span className="font-medium tabular-nums">{formatAmount(item.amount)}</span>
                    </div>
                    <div className="h-1.5 bg-muted overflow-hidden">
                      <div className={cn("h-full", item.color)} style={{ width: `${item.percent}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Recent Activity */}
            <div className="border border-border/40 p-4 col-span-2">
              <span className="text-[12px] font-semibold">Recent Activity</span>
              <div className="mt-3 space-y-2">
                {[
                  { action: "Invoice INV-2024-047 paid", time: "2 hours ago", icon: "✅" },
                  { action: "New customer added: KL Tech Hub", time: "5 hours ago", icon: "👤" },
                  { action: "Bill from Supplier A due in 3 days", time: "1 day ago", icon: "⚠️" },
                  { action: "Quotation QT-2024-015 accepted", time: "2 days ago", icon: "📝" },
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-3 py-2 border-b border-border/20 last:border-0">
                    <span className="text-[12px]">{item.icon}</span>
                    <span className="text-[11px] flex-1">{item.action}</span>
                    <span className="text-[10px] text-muted-foreground">{item.time}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right Panel - Quick Actions */}
      <div className="w-72 border-l border-border/40 bg-muted/5 flex flex-col">
        <div className="px-5 py-4 border-b border-border/30">
          <span className="text-[13px] font-semibold">Quick Actions</span>
        </div>
        <div className="p-4 space-y-2">
          {[
            { label: "Create Invoice", icon: Plus },
            { label: "Add Customer", icon: UsersIcon },
            { label: "Record Expense", icon: ReceiptIcon },
            { label: "Generate Report", icon: BookOpenIcon },
          ].map((action) => (
            <button
              key={action.label}
              className="w-full flex items-center gap-3 px-4 py-3 text-[11px] font-medium border border-border/50 text-muted-foreground hover:text-foreground hover:border-border hover:bg-muted/30 transition-colors cursor-pointer"
            >
              <action.icon className="size-4" />
              {action.label}
            </button>
          ))}
        </div>
        <div className="flex-1" />
        <div className="px-5 py-4 border-t border-border/30">
          <div className="text-[10px] text-muted-foreground mb-2">Cash Flow</div>
          <div className="flex items-center gap-4">
            <div>
              <div className="text-[10px] text-emerald-600 dark:text-emerald-400">In</div>
              <div className="text-[13px] font-bold tabular-nums">{formatAmount(47250)}</div>
            </div>
            <div className="h-8 w-px bg-border/40" />
            <div>
              <div className="text-[10px] text-red-600 dark:text-red-400">Out</div>
              <div className="text-[13px] font-bold tabular-nums">{formatAmount(12300)}</div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default React.memo(DashboardView);
