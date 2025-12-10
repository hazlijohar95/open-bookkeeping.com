import { motion } from "motion/react";
import { useState } from "react";
import { CircleOpenArrowRight, Star, GaugeIcon, VersionsIcon, UsersIcon, TruckIcon, BookOpenIcon, ReceiptIcon, GearIcon, FolderFeatherIcon } from "@/assets/icons";
import { Button } from "@/components/ui/button";
import { LINKS } from "@/constants/links";
import { Link } from "react-router-dom";
import { LogoBrandMinimal } from "@/components/brand/logo-brand";
import ThemeSwitch from "@/components/table-columns/theme-switch";
import { TrendingUp, Clock, AlertTriangle, Plus, Filter, MoreHorizontal, ChevronRight, Download, Eye, FileText, Upload, Search } from "@/components/ui/icons";
import { cn } from "@/lib/utils";

// ============================================
// Dashboard View
// ============================================
const DashboardView = ({ formatAmount }: { formatAmount: (amount: number) => string }) => {
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

// ============================================
// Invoices View (existing, extracted)
// ============================================
interface InvoiceData {
  id: string;
  customer: string;
  email: string;
  amount: number;
  status: string;
  date: string;
  dueDate: string;
  items: number;
  description: string;
}

interface InvoicesViewProps {
  invoices: InvoiceData[];
  allInvoices: InvoiceData[];
  selectedInvoice: number;
  setSelectedInvoice: (i: number) => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  filterOpen: boolean;
  setFilterOpen: (open: boolean) => void;
  selectedFilter: string | null;
  setSelectedFilter: (filter: string | null) => void;
  hoveredRow: number | null;
  setHoveredRow: (row: number | null) => void;
  showNewInvoiceTooltip: boolean;
  setShowNewInvoiceTooltip: (show: boolean) => void;
  formatAmount: (amount: number) => string;
  getStatusColor: (status: string) => string;
  totalRevenue: number;
  pendingAmount: number;
  overdueAmount: number;
  selectedInvoiceData: InvoiceData | undefined;
}

const InvoicesView = ({
  invoices,
  allInvoices,
  selectedInvoice,
  setSelectedInvoice,
  activeTab,
  setActiveTab,
  filterOpen,
  setFilterOpen,
  selectedFilter,
  setSelectedFilter,
  hoveredRow,
  setHoveredRow,
  showNewInvoiceTooltip,
  setShowNewInvoiceTooltip,
  formatAmount,
  getStatusColor,
  totalRevenue,
  pendingAmount,
  overdueAmount,
  selectedInvoiceData,
}: InvoicesViewProps) => {
  const tabs = [
    { id: "all", label: "All" },
    { id: "paid", label: "Paid" },
    { id: "pending", label: "Pending" },
    { id: "overdue", label: "Overdue" },
    { id: "draft", label: "Draft" },
  ];

  return (
    <>
      <div className="flex-1 flex flex-col min-w-0 bg-background">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border/40">
          <div>
            <h1 className="text-lg font-semibold">Invoices</h1>
            <p className="text-[11px] text-muted-foreground mt-0.5">Manage and track your invoices</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <button
                onClick={() => setFilterOpen(!filterOpen)}
                className={cn(
                  "flex items-center gap-2 px-3 py-2 text-[11px] border transition-all duration-150 cursor-pointer",
                  filterOpen || selectedFilter
                    ? "border-primary/50 bg-primary/5 text-foreground"
                    : "border-border/50 text-muted-foreground hover:text-foreground hover:border-border"
                )}
              >
                <Filter className="size-3.5" />
                {selectedFilter ? `Status: ${selectedFilter}` : "Filter"}
              </button>
              {filterOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="absolute top-full right-0 mt-1 w-40 bg-background border border-border/60 shadow-lg z-50"
                >
                  <div className="p-1">
                    {["All", "Paid", "Pending", "Overdue", "Draft"].map((filter) => (
                      <button
                        key={filter}
                        onClick={() => {
                          setSelectedFilter(filter === "All" ? null : filter);
                          setActiveTab(filter.toLowerCase());
                          setFilterOpen(false);
                          setSelectedInvoice(0);
                        }}
                        className={cn(
                          "w-full text-left px-3 py-2 text-[11px] transition-colors cursor-pointer",
                          (selectedFilter === filter || (filter === "All" && !selectedFilter))
                            ? "bg-primary/10 text-foreground"
                            : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                        )}
                      >
                        {filter}
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </div>
            <div className="relative">
              <button
                className="flex items-center gap-2 px-4 py-2 text-[11px] font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-all duration-150 hover:shadow-md"
                onMouseEnter={() => setShowNewInvoiceTooltip(true)}
                onMouseLeave={() => setShowNewInvoiceTooltip(false)}
              >
                <Plus className="size-3.5" />
                New Invoice
              </button>
              {showNewInvoiceTooltip && (
                <motion.div
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="absolute top-full left-1/2 -translate-x-1/2 mt-2 px-2 py-1 bg-foreground text-background text-[10px] whitespace-nowrap"
                >
                  Create a new invoice
                </motion.div>
              )}
            </div>
          </div>
        </div>

        {/* Stats Bar */}
        <div className="grid grid-cols-3 divide-x divide-border/30 border-b border-border/40 bg-muted/5">
          {[
            { label: "Total Revenue", value: formatAmount(totalRevenue), icon: TrendingUp, color: "emerald", change: "+12.5%" },
            { label: "Pending", value: formatAmount(pendingAmount), icon: Clock, color: "amber", sub: `${allInvoices.filter(i => i.status === "pending").length} invoices` },
            { label: "Overdue", value: formatAmount(overdueAmount), icon: AlertTriangle, color: "red", sub: `${allInvoices.filter(i => i.status === "overdue").length} invoices` },
          ].map((stat, index) => (
            <motion.div
              key={stat.label}
              className="px-5 py-4 cursor-pointer hover:bg-muted/30 transition-colors"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 + index * 0.1 }}
              onClick={() => {
                if (stat.color === "emerald") setActiveTab("paid");
                if (stat.color === "amber") setActiveTab("pending");
                if (stat.color === "red") setActiveTab("overdue");
                setSelectedInvoice(0);
              }}
            >
              <div className="flex items-center gap-2 mb-1.5">
                <stat.icon className={cn(
                  "size-3.5",
                  stat.color === "emerald" && "text-emerald-600 dark:text-emerald-400",
                  stat.color === "amber" && "text-amber-600 dark:text-amber-400",
                  stat.color === "red" && "text-red-600 dark:text-red-400",
                )} />
                <span className="text-[10px] text-muted-foreground uppercase tracking-wide">{stat.label}</span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-lg font-bold tabular-nums">{stat.value}</span>
                {stat.change && <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">{stat.change}</span>}
                {stat.sub && <span className="text-[10px] text-muted-foreground">{stat.sub}</span>}
              </div>
            </motion.div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 px-5 py-2 border-b border-border/40 bg-muted/5 overflow-x-auto scrollbar-none">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id);
                setSelectedInvoice(0);
                setSelectedFilter(tab.id === "all" ? null : tab.label);
              }}
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 text-[11px] font-medium transition-all duration-150 whitespace-nowrap cursor-pointer",
                activeTab === tab.id
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              )}
            >
              {tab.label}
              <span className={cn(
                "text-[10px] tabular-nums px-1.5 py-0.5",
                activeTab === tab.id ? "bg-primary/20 text-primary" : "bg-muted"
              )}>
                {tab.id === "all" ? allInvoices.length : allInvoices.filter(i => i.status === tab.id).length}
              </span>
            </button>
          ))}
        </div>

        {/* Table */}
        <div className="flex-1 overflow-hidden flex flex-col">
          <div className="grid grid-cols-[1fr_140px_110px_80px_40px] gap-3 px-5 py-2.5 border-b border-border/40 bg-muted/20 text-[10px] font-medium text-muted-foreground uppercase tracking-wide sticky top-0">
            <span>Invoice</span>
            <span>Customer</span>
            <span className="text-right">Amount</span>
            <span>Status</span>
            <span></span>
          </div>
          <div className="flex-1 overflow-y-auto scrollbar-thin divide-y divide-border/20">
            {invoices.length === 0 ? (
              <div className="flex items-center justify-center h-32 text-[12px] text-muted-foreground">No invoices found</div>
            ) : (
              invoices.map((invoice, i) => (
                <motion.div
                  key={invoice.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.05 * i }}
                  onClick={() => setSelectedInvoice(i)}
                  onMouseEnter={() => setHoveredRow(i)}
                  onMouseLeave={() => setHoveredRow(null)}
                  className={cn(
                    "grid grid-cols-[1fr_140px_110px_80px_40px] gap-3 px-5 py-3 cursor-pointer transition-all duration-100 items-center",
                    selectedInvoice === i ? "bg-primary/5 border-l-2 border-l-primary" : "hover:bg-muted/40 border-l-2 border-l-transparent"
                  )}
                >
                  <div className="min-w-0">
                    <span className={cn("text-[12px] font-medium block truncate", selectedInvoice === i && "text-primary")}>{invoice.id}</span>
                    <p className="text-[10px] text-muted-foreground truncate">{invoice.date}</p>
                  </div>
                  <div className="min-w-0">
                    <span className="text-[12px] block truncate">{invoice.customer}</span>
                    <p className="text-[10px] text-muted-foreground truncate">{invoice.email}</p>
                  </div>
                  <span className="text-[12px] font-semibold tabular-nums text-right">{formatAmount(invoice.amount)}</span>
                  <span className={cn("px-2 py-1 text-[9px] font-medium uppercase tracking-wide w-fit", getStatusColor(invoice.status))}>{invoice.status}</span>
                  <button className={cn("p-1.5 transition-colors", hoveredRow === i ? "bg-muted" : "hover:bg-muted")}>
                    <MoreHorizontal className="size-3.5 text-muted-foreground" />
                  </button>
                </motion.div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Detail Panel */}
      <motion.div
        key={selectedInvoiceData?.id}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.15 }}
        className="w-72 border-l border-border/40 bg-muted/5 flex flex-col"
      >
        {selectedInvoiceData ? (
          <>
            <div className="px-5 py-4 border-b border-border/30">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[14px] font-semibold">{selectedInvoiceData.id}</span>
                <button className="p-1 hover:bg-muted transition-colors">
                  <ChevronRight className="size-4 text-muted-foreground" />
                </button>
              </div>
              <span className={cn("inline-block px-2.5 py-1 text-[10px] font-medium uppercase tracking-wide", getStatusColor(selectedInvoiceData.status))}>
                {selectedInvoiceData.status}
              </span>
            </div>
            <div className="flex-1 overflow-y-auto scrollbar-thin px-5 py-4 space-y-5">
              <div>
                <span className="text-[10px] text-muted-foreground uppercase tracking-wide block mb-1">Customer</span>
                <p className="text-[13px] font-medium">{selectedInvoiceData.customer}</p>
                <p className="text-[11px] text-muted-foreground">{selectedInvoiceData.email}</p>
              </div>
              <div>
                <span className="text-[10px] text-muted-foreground uppercase tracking-wide block mb-1">Amount</span>
                <p className="text-2xl font-bold tabular-nums">{formatAmount(selectedInvoiceData.amount)}</p>
              </div>
              <div>
                <span className="text-[10px] text-muted-foreground uppercase tracking-wide block mb-2">Description</span>
                <p className="text-[12px] text-muted-foreground leading-relaxed">{selectedInvoiceData.description}</p>
              </div>
              <div>
                <span className="text-[10px] text-muted-foreground uppercase tracking-wide block mb-2">Details</span>
                <div className="space-y-2">
                  {[
                    { label: "Issue Date", value: selectedInvoiceData.date },
                    { label: "Due Date", value: selectedInvoiceData.dueDate },
                    { label: "Line Items", value: `${selectedInvoiceData.items} items` },
                    { label: "Payment Terms", value: "Net 30" },
                  ].map((item) => (
                    <div key={item.label} className="flex justify-between text-[11px]">
                      <span className="text-muted-foreground">{item.label}</span>
                      <span className="font-medium">{item.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="px-5 py-4 border-t border-border/30 space-y-2">
              <button className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-[11px] font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-all duration-150 hover:shadow-md">
                <Eye className="size-3.5" />
                View Invoice
              </button>
              <div className="grid grid-cols-2 gap-2">
                <button className="flex items-center justify-center gap-1.5 px-3 py-2 text-[11px] font-medium border border-border/50 text-muted-foreground hover:text-foreground hover:border-border hover:bg-muted/30 transition-colors">
                  <Download className="size-3" />
                  PDF
                </button>
                <button className="flex items-center justify-center gap-1.5 px-3 py-2 text-[11px] font-medium border border-border/50 text-muted-foreground hover:text-foreground hover:border-border hover:bg-muted/30 transition-colors">
                  Send
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-[12px] text-muted-foreground">Select an invoice</div>
        )}
      </motion.div>
    </>
  );
};

// ============================================
// Bills View
// ============================================
const BillsView = ({ formatAmount, getStatusColor }: { formatAmount: (amount: number) => string; getStatusColor: (status: string) => string }) => {
  const [selectedBill, setSelectedBill] = useState(0);

  const bills = [
    { id: "BILL-001", vendor: "Office Supplies Co", amount: 1250, status: "pending", date: "Dec 8, 2024", dueDate: "Dec 22, 2024" },
    { id: "BILL-002", vendor: "Cloud Services Ltd", amount: 2400, status: "paid", date: "Dec 5, 2024", dueDate: "Dec 19, 2024" },
    { id: "BILL-003", vendor: "Marketing Agency", amount: 5500, status: "overdue", date: "Nov 25, 2024", dueDate: "Dec 9, 2024" },
    { id: "BILL-004", vendor: "IT Hardware Shop", amount: 3200, status: "pending", date: "Dec 1, 2024", dueDate: "Dec 15, 2024" },
    { id: "BILL-005", vendor: "Insurance Provider", amount: 1800, status: "paid", date: "Nov 30, 2024", dueDate: "Dec 14, 2024" },
  ];

  const selectedBillData = bills[selectedBill]!;

  return (
    <>
      <div className="flex-1 flex flex-col min-w-0 bg-background">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border/40">
          <div>
            <h1 className="text-lg font-semibold">Bills</h1>
            <p className="text-[11px] text-muted-foreground mt-0.5">Track your expenses and payables</p>
          </div>
          <button className="flex items-center gap-2 px-4 py-2 text-[11px] font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors">
            <Plus className="size-3.5" />
            Add Bill
          </button>
        </div>

        <div className="grid grid-cols-3 divide-x divide-border/30 border-b border-border/40 bg-muted/5">
          {[
            { label: "Total Due", value: formatAmount(9950), color: "text-foreground" },
            { label: "Paid This Month", value: formatAmount(4200), color: "text-emerald-600 dark:text-emerald-400" },
            { label: "Overdue", value: formatAmount(5500), color: "text-red-600 dark:text-red-400" },
          ].map((stat) => (
            <div key={stat.label} className="px-5 py-4">
              <span className="text-[10px] text-muted-foreground uppercase tracking-wide">{stat.label}</span>
              <p className={cn("text-lg font-bold tabular-nums mt-1", stat.color)}>{stat.value}</p>
            </div>
          ))}
        </div>

        <div className="flex-1 overflow-hidden flex flex-col">
          <div className="grid grid-cols-[1fr_120px_100px_80px] gap-3 px-5 py-2.5 border-b border-border/40 bg-muted/20 text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
            <span>Bill</span>
            <span>Vendor</span>
            <span className="text-right">Amount</span>
            <span>Status</span>
          </div>
          <div className="flex-1 overflow-y-auto divide-y divide-border/20">
            {bills.map((bill, i) => (
              <div
                key={bill.id}
                onClick={() => setSelectedBill(i)}
                className={cn(
                  "grid grid-cols-[1fr_120px_100px_80px] gap-3 px-5 py-3 cursor-pointer transition-colors items-center",
                  selectedBill === i ? "bg-primary/5 border-l-2 border-l-primary" : "hover:bg-muted/40 border-l-2 border-l-transparent"
                )}
              >
                <div>
                  <span className={cn("text-[12px] font-medium", selectedBill === i && "text-primary")}>{bill.id}</span>
                  <p className="text-[10px] text-muted-foreground">{bill.date}</p>
                </div>
                <span className="text-[12px] truncate">{bill.vendor}</span>
                <span className="text-[12px] font-semibold tabular-nums text-right">{formatAmount(bill.amount)}</span>
                <span className={cn("px-2 py-1 text-[9px] font-medium uppercase tracking-wide w-fit", getStatusColor(bill.status))}>{bill.status}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="w-72 border-l border-border/40 bg-muted/5 flex flex-col">
        <div className="px-5 py-4 border-b border-border/30">
          <span className="text-[14px] font-semibold">{selectedBillData.id}</span>
          <div className="mt-2">
            <span className={cn("px-2.5 py-1 text-[10px] font-medium uppercase tracking-wide", getStatusColor(selectedBillData.status))}>
              {selectedBillData.status}
            </span>
          </div>
        </div>
        <div className="flex-1 px-5 py-4 space-y-4">
          <div>
            <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Vendor</span>
            <p className="text-[13px] font-medium mt-1">{selectedBillData.vendor}</p>
          </div>
          <div>
            <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Amount</span>
            <p className="text-2xl font-bold tabular-nums mt-1">{formatAmount(selectedBillData.amount)}</p>
          </div>
          <div>
            <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Due Date</span>
            <p className="text-[13px] font-medium mt-1">{selectedBillData.dueDate}</p>
          </div>
        </div>
        <div className="px-5 py-4 border-t border-border/30">
          <button className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-[11px] font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors">
            Mark as Paid
          </button>
        </div>
      </div>
    </>
  );
};

// ============================================
// Customers View
// ============================================
const CustomersView = () => {
  const [selectedCustomer, setSelectedCustomer] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");

  const customers = [
    { id: 1, name: "Acme Corporation", email: "billing@acme.com", phone: "+60 12-345 6789", totalSpent: 45000, invoices: 12, status: "active" },
    { id: 2, name: "TechStart Sdn Bhd", email: "accounts@techstart.my", phone: "+60 13-456 7890", totalSpent: 28500, invoices: 8, status: "active" },
    { id: 3, name: "Global Trading Co", email: "finance@globaltrading.com", phone: "+60 14-567 8901", totalSpent: 15200, invoices: 5, status: "inactive" },
    { id: 4, name: "Marina Bay Hotel", email: "ap@marinabay.com", phone: "+60 15-678 9012", totalSpent: 62000, invoices: 15, status: "active" },
    { id: 5, name: "Sunrise Cafe", email: "owner@sunrisecafe.my", phone: "+60 16-789 0123", totalSpent: 8400, invoices: 4, status: "active" },
    { id: 6, name: "Digital Agency MY", email: "finance@digitalagency.my", phone: "+60 17-890 1234", totalSpent: 34600, invoices: 9, status: "active" },
  ];

  const filteredCustomers = customers.filter(c =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const selectedCustomerData = filteredCustomers[selectedCustomer] || filteredCustomers[0];

  return (
    <>
      <div className="flex-1 flex flex-col min-w-0 bg-background">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border/40">
          <div>
            <h1 className="text-lg font-semibold">Customers</h1>
            <p className="text-[11px] text-muted-foreground mt-0.5">Manage your customer relationships</p>
          </div>
          <button className="flex items-center gap-2 px-4 py-2 text-[11px] font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors">
            <Plus className="size-3.5" />
            Add Customer
          </button>
        </div>

        {/* Search */}
        <div className="px-5 py-3 border-b border-border/40">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search customers..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-[12px] bg-muted/30 border border-border/40 focus:border-primary/50 focus:outline-none transition-colors"
            />
          </div>
        </div>

        <div className="flex-1 overflow-hidden flex flex-col">
          <div className="grid grid-cols-[1fr_140px_100px_80px] gap-3 px-5 py-2.5 border-b border-border/40 bg-muted/20 text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
            <span>Customer</span>
            <span>Contact</span>
            <span className="text-right">Total Spent</span>
            <span>Status</span>
          </div>
          <div className="flex-1 overflow-y-auto divide-y divide-border/20">
            {filteredCustomers.map((customer, i) => (
              <div
                key={customer.id}
                onClick={() => setSelectedCustomer(i)}
                className={cn(
                  "grid grid-cols-[1fr_140px_100px_80px] gap-3 px-5 py-3 cursor-pointer transition-colors items-center",
                  selectedCustomer === i ? "bg-primary/5 border-l-2 border-l-primary" : "hover:bg-muted/40 border-l-2 border-l-transparent"
                )}
              >
                <div>
                  <span className={cn("text-[12px] font-medium", selectedCustomer === i && "text-primary")}>{customer.name}</span>
                  <p className="text-[10px] text-muted-foreground">{customer.invoices} invoices</p>
                </div>
                <span className="text-[11px] text-muted-foreground truncate">{customer.email}</span>
                <span className="text-[12px] font-semibold tabular-nums text-right">RM {customer.totalSpent.toLocaleString()}</span>
                <span className={cn(
                  "px-2 py-1 text-[9px] font-medium uppercase tracking-wide w-fit",
                  customer.status === "active" ? "bg-emerald-500/10 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" : "bg-muted text-muted-foreground"
                )}>
                  {customer.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="w-72 border-l border-border/40 bg-muted/5 flex flex-col">
        {selectedCustomerData && (
          <>
            <div className="px-5 py-4 border-b border-border/30">
              <div className="size-12 bg-primary/10 flex items-center justify-center text-[16px] font-bold text-primary mb-3">
                {selectedCustomerData.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
              </div>
              <span className="text-[14px] font-semibold">{selectedCustomerData.name}</span>
              <span className={cn(
                "ml-2 px-2 py-0.5 text-[9px] font-medium uppercase",
                selectedCustomerData.status === "active" ? "bg-emerald-500/10 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" : "bg-muted text-muted-foreground"
              )}>
                {selectedCustomerData.status}
              </span>
            </div>
            <div className="flex-1 px-5 py-4 space-y-4 overflow-y-auto">
              <div>
                <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Email</span>
                <p className="text-[12px] mt-1">{selectedCustomerData.email}</p>
              </div>
              <div>
                <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Phone</span>
                <p className="text-[12px] mt-1">{selectedCustomerData.phone}</p>
              </div>
              <div>
                <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Total Spent</span>
                <p className="text-xl font-bold tabular-nums mt-1">RM {selectedCustomerData.totalSpent.toLocaleString()}</p>
              </div>
              <div>
                <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Invoices</span>
                <p className="text-[13px] font-medium mt-1">{selectedCustomerData.invoices} total</p>
              </div>
            </div>
            <div className="px-5 py-4 border-t border-border/30 space-y-2">
              <button className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-[11px] font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors">
                Create Invoice
              </button>
              <button className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-[11px] font-medium border border-border/50 text-muted-foreground hover:text-foreground hover:border-border transition-colors">
                View History
              </button>
            </div>
          </>
        )}
      </div>
    </>
  );
};

// ============================================
// Vendors View
// ============================================
const VendorsView = () => {
  const [selectedVendor, setSelectedVendor] = useState(0);

  const vendors = [
    { id: 1, name: "Office Supplies Co", email: "sales@officesupplies.com", category: "Office", totalPaid: 15600, bills: 8 },
    { id: 2, name: "Cloud Services Ltd", email: "billing@cloudservices.com", category: "Software", totalPaid: 28800, bills: 12 },
    { id: 3, name: "Marketing Agency", email: "accounts@marketing.com", category: "Marketing", totalPaid: 45000, bills: 6 },
    { id: 4, name: "IT Hardware Shop", email: "sales@ithardware.my", category: "Hardware", totalPaid: 22400, bills: 4 },
    { id: 5, name: "Insurance Provider", email: "claims@insurance.com", category: "Insurance", totalPaid: 21600, bills: 12 },
  ];

  const selectedVendorData = vendors[selectedVendor]!;

  return (
    <>
      <div className="flex-1 flex flex-col min-w-0 bg-background">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border/40">
          <div>
            <h1 className="text-lg font-semibold">Vendors</h1>
            <p className="text-[11px] text-muted-foreground mt-0.5">Manage your suppliers and vendors</p>
          </div>
          <button className="flex items-center gap-2 px-4 py-2 text-[11px] font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors">
            <Plus className="size-3.5" />
            Add Vendor
          </button>
        </div>

        <div className="flex-1 overflow-hidden flex flex-col">
          <div className="grid grid-cols-[1fr_100px_100px_80px] gap-3 px-5 py-2.5 border-b border-border/40 bg-muted/20 text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
            <span>Vendor</span>
            <span>Category</span>
            <span className="text-right">Total Paid</span>
            <span>Bills</span>
          </div>
          <div className="flex-1 overflow-y-auto divide-y divide-border/20">
            {vendors.map((vendor, i) => (
              <div
                key={vendor.id}
                onClick={() => setSelectedVendor(i)}
                className={cn(
                  "grid grid-cols-[1fr_100px_100px_80px] gap-3 px-5 py-3 cursor-pointer transition-colors items-center",
                  selectedVendor === i ? "bg-primary/5 border-l-2 border-l-primary" : "hover:bg-muted/40 border-l-2 border-l-transparent"
                )}
              >
                <div>
                  <span className={cn("text-[12px] font-medium", selectedVendor === i && "text-primary")}>{vendor.name}</span>
                  <p className="text-[10px] text-muted-foreground">{vendor.email}</p>
                </div>
                <span className="text-[11px] px-2 py-0.5 bg-muted w-fit">{vendor.category}</span>
                <span className="text-[12px] font-semibold tabular-nums text-right">RM {vendor.totalPaid.toLocaleString()}</span>
                <span className="text-[12px] text-muted-foreground">{vendor.bills} bills</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="w-72 border-l border-border/40 bg-muted/5 flex flex-col">
        <div className="px-5 py-4 border-b border-border/30">
          <div className="size-12 bg-muted flex items-center justify-center text-[16px] font-bold text-muted-foreground mb-3">
            {selectedVendorData.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
          </div>
          <span className="text-[14px] font-semibold">{selectedVendorData.name}</span>
          <span className="ml-2 px-2 py-0.5 text-[9px] font-medium uppercase bg-muted">{selectedVendorData.category}</span>
        </div>
        <div className="flex-1 px-5 py-4 space-y-4">
          <div>
            <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Email</span>
            <p className="text-[12px] mt-1">{selectedVendorData.email}</p>
          </div>
          <div>
            <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Total Paid</span>
            <p className="text-xl font-bold tabular-nums mt-1">RM {selectedVendorData.totalPaid.toLocaleString()}</p>
          </div>
          <div>
            <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Bills</span>
            <p className="text-[13px] font-medium mt-1">{selectedVendorData.bills} total</p>
          </div>
        </div>
        <div className="px-5 py-4 border-t border-border/30">
          <button className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-[11px] font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors">
            Add Bill
          </button>
        </div>
      </div>
    </>
  );
};

// ============================================
// Reports View
// ============================================
const ReportsView = ({ formatAmount }: { formatAmount: (amount: number) => string }) => {
  const [selectedReport, setSelectedReport] = useState("profit-loss");

  const reports = [
    { id: "profit-loss", name: "Profit & Loss", description: "Income and expense summary" },
    { id: "balance-sheet", name: "Balance Sheet", description: "Assets, liabilities, equity" },
    { id: "cash-flow", name: "Cash Flow", description: "Money in and out" },
    { id: "aged-receivables", name: "Aged Receivables", description: "Outstanding customer payments" },
    { id: "aged-payables", name: "Aged Payables", description: "Outstanding vendor bills" },
    { id: "tax-summary", name: "Tax Summary", description: "SST and tax obligations" },
  ];

  return (
    <>
      <div className="flex-1 flex flex-col min-w-0 bg-background">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border/40">
          <div>
            <h1 className="text-lg font-semibold">Reports</h1>
            <p className="text-[11px] text-muted-foreground mt-0.5">Financial reports and analytics</p>
          </div>
          <button className="flex items-center gap-2 px-4 py-2 text-[11px] font-medium border border-border/50 hover:border-border transition-colors">
            <Download className="size-3.5" />
            Export All
          </button>
        </div>

        <div className="flex-1 p-5 overflow-y-auto">
          <div className="grid grid-cols-2 gap-3">
            {reports.map((report) => (
              <button
                key={report.id}
                onClick={() => setSelectedReport(report.id)}
                className={cn(
                  "p-4 border text-left transition-all cursor-pointer",
                  selectedReport === report.id
                    ? "border-primary bg-primary/5"
                    : "border-border/40 hover:border-border hover:bg-muted/30"
                )}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-[13px] font-medium">{report.name}</span>
                    <p className="text-[11px] text-muted-foreground mt-1">{report.description}</p>
                  </div>
                  <FileText className="size-4 text-muted-foreground" />
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="w-72 border-l border-border/40 bg-muted/5 flex flex-col">
        <div className="px-5 py-4 border-b border-border/30">
          <span className="text-[14px] font-semibold">
            {reports.find(r => r.id === selectedReport)?.name}
          </span>
          <p className="text-[11px] text-muted-foreground mt-1">December 2024</p>
        </div>
        <div className="flex-1 px-5 py-4 space-y-4">
          {selectedReport === "profit-loss" && (
            <>
              <div>
                <span className="text-[10px] text-muted-foreground uppercase">Revenue</span>
                <p className="text-lg font-bold tabular-nums text-emerald-600 dark:text-emerald-400 mt-1">{formatAmount(65500)}</p>
              </div>
              <div>
                <span className="text-[10px] text-muted-foreground uppercase">Expenses</span>
                <p className="text-lg font-bold tabular-nums text-red-600 dark:text-red-400 mt-1">{formatAmount(12300)}</p>
              </div>
              <div className="pt-3 border-t border-border/30">
                <span className="text-[10px] text-muted-foreground uppercase">Net Profit</span>
                <p className="text-xl font-bold tabular-nums mt-1">{formatAmount(53200)}</p>
              </div>
            </>
          )}
          {selectedReport !== "profit-loss" && (
            <div className="text-[12px] text-muted-foreground">
              Select to view report details
            </div>
          )}
        </div>
        <div className="px-5 py-4 border-t border-border/30 space-y-2">
          <button className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-[11px] font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors">
            <Eye className="size-3.5" />
            View Full Report
          </button>
          <button className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-[11px] font-medium border border-border/50 text-muted-foreground hover:text-foreground hover:border-border transition-colors">
            <Download className="size-3.5" />
            Download PDF
          </button>
        </div>
      </div>
    </>
  );
};

// ============================================
// Vault View
// ============================================
const VaultView = () => {
  const [selectedFile, setSelectedFile] = useState(0);

  const files = [
    { id: 1, name: "Invoice-INV-2024-047.pdf", type: "Invoice", size: "245 KB", date: "Dec 10, 2024" },
    { id: 2, name: "Receipt-Acme-Corp.pdf", type: "Receipt", size: "128 KB", date: "Dec 8, 2024" },
    { id: 3, name: "Contract-TechStart.pdf", type: "Contract", size: "1.2 MB", date: "Dec 5, 2024" },
    { id: 4, name: "Tax-Return-2024.pdf", type: "Tax", size: "856 KB", date: "Dec 1, 2024" },
    { id: 5, name: "Bank-Statement-Nov.pdf", type: "Statement", size: "324 KB", date: "Nov 30, 2024" },
  ];

  const selectedFileData = files[selectedFile]!;

  return (
    <>
      <div className="flex-1 flex flex-col min-w-0 bg-background">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border/40">
          <div>
            <h1 className="text-lg font-semibold">Vault</h1>
            <p className="text-[11px] text-muted-foreground mt-0.5">Secure document storage</p>
          </div>
          <button className="flex items-center gap-2 px-4 py-2 text-[11px] font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors">
            <Upload className="size-3.5" />
            Upload File
          </button>
        </div>

        <div className="grid grid-cols-4 divide-x divide-border/30 border-b border-border/40 bg-muted/5">
          {[
            { label: "Total Files", value: "247" },
            { label: "Storage Used", value: "1.8 GB" },
            { label: "This Month", value: "23" },
            { label: "Shared", value: "12" },
          ].map((stat) => (
            <div key={stat.label} className="px-5 py-3">
              <span className="text-[10px] text-muted-foreground uppercase tracking-wide">{stat.label}</span>
              <p className="text-[14px] font-bold mt-0.5">{stat.value}</p>
            </div>
          ))}
        </div>

        <div className="flex-1 overflow-hidden flex flex-col">
          <div className="grid grid-cols-[1fr_80px_80px_100px] gap-3 px-5 py-2.5 border-b border-border/40 bg-muted/20 text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
            <span>Name</span>
            <span>Type</span>
            <span>Size</span>
            <span>Date</span>
          </div>
          <div className="flex-1 overflow-y-auto divide-y divide-border/20">
            {files.map((file, i) => (
              <div
                key={file.id}
                onClick={() => setSelectedFile(i)}
                className={cn(
                  "grid grid-cols-[1fr_80px_80px_100px] gap-3 px-5 py-3 cursor-pointer transition-colors items-center",
                  selectedFile === i ? "bg-primary/5 border-l-2 border-l-primary" : "hover:bg-muted/40 border-l-2 border-l-transparent"
                )}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <FileText className="size-4 text-muted-foreground shrink-0" />
                  <span className={cn("text-[12px] font-medium truncate", selectedFile === i && "text-primary")}>{file.name}</span>
                </div>
                <span className="text-[11px] px-2 py-0.5 bg-muted w-fit">{file.type}</span>
                <span className="text-[11px] text-muted-foreground">{file.size}</span>
                <span className="text-[11px] text-muted-foreground">{file.date}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="w-72 border-l border-border/40 bg-muted/5 flex flex-col">
        <div className="px-5 py-4 border-b border-border/30">
          <div className="size-12 bg-muted flex items-center justify-center mb-3">
            <FileText className="size-6 text-muted-foreground" />
          </div>
          <span className="text-[13px] font-semibold block truncate">{selectedFileData.name}</span>
          <span className="text-[11px] text-muted-foreground">{selectedFileData.type}</span>
        </div>
        <div className="flex-1 px-5 py-4 space-y-4">
          <div>
            <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Size</span>
            <p className="text-[13px] font-medium mt-1">{selectedFileData.size}</p>
          </div>
          <div>
            <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Uploaded</span>
            <p className="text-[13px] font-medium mt-1">{selectedFileData.date}</p>
          </div>
          <div>
            <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Type</span>
            <p className="text-[13px] font-medium mt-1">{selectedFileData.type} Document</p>
          </div>
        </div>
        <div className="px-5 py-4 border-t border-border/30 space-y-2">
          <button className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-[11px] font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors">
            <Eye className="size-3.5" />
            Preview
          </button>
          <button className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-[11px] font-medium border border-border/50 text-muted-foreground hover:text-foreground hover:border-border transition-colors">
            <Download className="size-3.5" />
            Download
          </button>
        </div>
      </div>
    </>
  );
};

// Fully Interactive App Window Mockup
const AppWindowMockup = () => {
  const [selectedInvoice, setSelectedInvoice] = useState<number>(0);
  const [activeNav, setActiveNav] = useState("invoices");
  const [activeTab, setActiveTab] = useState("all");
  const [hoveredRow, setHoveredRow] = useState<number | null>(null);
  const [showNewInvoiceTooltip, setShowNewInvoiceTooltip] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState<string | null>(null);

  const navItems = [
    { id: "dashboard", label: "Dashboard", icon: GaugeIcon },
    { id: "invoices", label: "Invoices", icon: VersionsIcon, badge: 24 },
    { id: "bills", label: "Bills", icon: ReceiptIcon, badge: 8 },
    { id: "customers", label: "Customers", icon: UsersIcon },
    { id: "vendors", label: "Vendors", icon: TruckIcon },
    { id: "reports", label: "Reports", icon: BookOpenIcon },
    { id: "vault", label: "Vault", icon: FolderFeatherIcon },
  ];

  const allInvoices = [
    { id: "INV-2024-047", customer: "Acme Corporation", email: "billing@acme.com", amount: 12500, status: "paid", date: "Dec 10, 2024", dueDate: "Jan 9, 2025", items: 5, description: "Web development services" },
    { id: "INV-2024-046", customer: "TechStart Sdn Bhd", email: "accounts@techstart.my", amount: 8200, status: "pending", date: "Dec 9, 2024", dueDate: "Jan 8, 2025", items: 3, description: "UI/UX Design package" },
    { id: "INV-2024-045", customer: "Global Trading Co", email: "finance@globaltrading.com", amount: 3750, status: "overdue", date: "Dec 5, 2024", dueDate: "Dec 5, 2024", items: 2, description: "Consulting services" },
    { id: "INV-2024-044", customer: "Marina Bay Hotel", email: "ap@marinabay.com", amount: 15000, status: "paid", date: "Dec 4, 2024", dueDate: "Jan 3, 2025", items: 8, description: "Annual software license" },
    { id: "INV-2024-043", customer: "Sunrise Cafe", email: "owner@sunrisecafe.my", amount: 2400, status: "draft", date: "Dec 3, 2024", dueDate: "Jan 2, 2025", items: 4, description: "POS system setup" },
    { id: "INV-2024-042", customer: "Digital Agency MY", email: "finance@digitalagency.my", amount: 6800, status: "paid", date: "Dec 2, 2024", dueDate: "Jan 1, 2025", items: 3, description: "Marketing automation" },
    { id: "INV-2024-041", customer: "Petaling Hardware", email: "accounts@petalinghw.com", amount: 4200, status: "pending", date: "Dec 1, 2024", dueDate: "Dec 31, 2024", items: 6, description: "Inventory system" },
    { id: "INV-2024-040", customer: "KL Tech Hub", email: "admin@kltechhub.com", amount: 9500, status: "paid", date: "Nov 28, 2024", dueDate: "Dec 28, 2024", items: 4, description: "Cloud migration" },
    { id: "INV-2024-039", customer: "Johor Supplies Ltd", email: "finance@johorsupplies.my", amount: 5600, status: "pending", date: "Nov 25, 2024", dueDate: "Dec 25, 2024", items: 7, description: "ERP implementation" },
    { id: "INV-2024-038", customer: "Penang Delights", email: "owner@penangdelights.com", amount: 1800, status: "overdue", date: "Nov 20, 2024", dueDate: "Dec 20, 2024", items: 2, description: "Website maintenance" },
    { id: "INV-2024-037", customer: "Selangor Motors", email: "ap@selangormotors.my", amount: 22000, status: "paid", date: "Nov 18, 2024", dueDate: "Dec 18, 2024", items: 12, description: "Fleet management system" },
    { id: "INV-2024-036", customer: "Ipoh Ceramics", email: "accounts@ipohceramics.com", amount: 3200, status: "pending", date: "Nov 15, 2024", dueDate: "Dec 15, 2024", items: 3, description: "E-commerce platform" },
  ];

  // Filter invoices based on active tab
  const invoices = activeTab === "all"
    ? allInvoices
    : allInvoices.filter(inv => inv.status === activeTab);

  const selectedInvoiceData = invoices[selectedInvoice] || invoices[0];

  const formatAmount = (amount: number) => `RM ${amount.toLocaleString('en-MY', { minimumFractionDigits: 2 })}`;

  const getStatusColor = (status: string) => {
    switch (status) {
      case "paid": return "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400";
      case "pending": return "bg-amber-500/10 text-amber-600 dark:text-amber-400";
      case "overdue": return "bg-red-500/10 text-red-600 dark:text-red-400";
      case "draft": return "bg-muted text-muted-foreground";
      default: return "bg-muted text-muted-foreground";
    }
  };

  // Calculate stats
  const totalRevenue = allInvoices.filter(i => i.status === "paid").reduce((sum, i) => sum + i.amount, 0);
  const pendingAmount = allInvoices.filter(i => i.status === "pending").reduce((sum, i) => sum + i.amount, 0);
  const overdueAmount = allInvoices.filter(i => i.status === "overdue").reduce((sum, i) => sum + i.amount, 0);

  return (
    <div className="relative h-full flex flex-col">
      {/* Rough Brush Stroke Background */}
      <div className="absolute -left-12 -top-6 bottom-0 w-[calc(100%+60px)] -z-10">
        {/* SVG Filters for brush texture */}
        <svg className="absolute inset-0 w-0 h-0">
          <defs>
            {/* Noise filter for texture */}
            <filter id="brushNoise" x="0%" y="0%" width="100%" height="100%">
              <feTurbulence
                type="fractalNoise"
                baseFrequency="0.04"
                numOctaves="5"
                seed="15"
                result="noise"
              />
              <feDisplacementMap
                in="SourceGraphic"
                in2="noise"
                scale="8"
                xChannelSelector="R"
                yChannelSelector="G"
              />
            </filter>

            {/* Grain overlay filter */}
            <filter id="grainTexture">
              <feTurbulence
                type="fractalNoise"
                baseFrequency="0.8"
                numOctaves="4"
                stitchTiles="stitch"
              />
              <feColorMatrix type="saturate" values="0" />
            </filter>
          </defs>
        </svg>

        {/* Main brush stroke shape - organic ink appearance */}
        <div
          className="absolute inset-0"
          style={{
            background: `
              radial-gradient(ellipse 120% 100% at 60% 50%, hsl(var(--primary)) 0%, hsl(var(--primary) / 0.95) 30%, hsl(var(--primary) / 0.7) 50%, hsl(var(--primary) / 0.3) 70%, transparent 85%),
              radial-gradient(ellipse 80% 120% at 70% 30%, hsl(var(--primary) / 0.6) 0%, transparent 60%),
              radial-gradient(ellipse 60% 80% at 40% 70%, hsl(var(--primary) / 0.4) 0%, transparent 50%)
            `,
          }}
        />

        {/* Secondary brush marks for organic variation */}
        <div
          className="absolute inset-0 opacity-60"
          style={{
            background: `
              radial-gradient(ellipse 100% 60% at 50% 20%, hsl(var(--primary) / 0.5) 0%, transparent 70%),
              radial-gradient(ellipse 70% 90% at 80% 60%, hsl(var(--primary) / 0.3) 0%, transparent 60%),
              radial-gradient(ellipse 50% 70% at 30% 80%, hsl(var(--primary) / 0.25) 0%, transparent 50%)
            `,
          }}
        />

        {/* Noise grain overlay - gives it that rough, seasoned texture */}
        <svg className="absolute inset-0 w-full h-full opacity-[0.5] mix-blend-overlay dark:mix-blend-soft-light dark:opacity-[0.3]">
          <rect width="100%" height="100%" filter="url(#grainTexture)" />
        </svg>

        {/* Edge fading - left */}
        <div
          className="absolute left-0 top-0 bottom-0 w-32"
          style={{
            background: 'linear-gradient(to right, hsl(var(--background)) 0%, transparent 100%)',
          }}
        />

        {/* Edge fading - right (subtle) */}
        <div
          className="absolute right-0 top-0 bottom-0 w-16 opacity-50"
          style={{
            background: 'linear-gradient(to left, hsl(var(--background)) 0%, transparent 100%)',
          }}
        />

        {/* Top edge softening */}
        <div
          className="absolute top-0 left-0 right-0 h-24"
          style={{
            background: 'linear-gradient(to bottom, hsl(var(--background) / 0.4) 0%, transparent 100%)',
          }}
        />

        {/* Subtle speckle/stipple effect for ink-like appearance */}
        <div
          className="absolute inset-0 opacity-[0.15]"
          style={{
            backgroundImage: `
              radial-gradient(circle at 20% 30%, hsl(var(--primary)) 1px, transparent 1px),
              radial-gradient(circle at 80% 20%, hsl(var(--primary)) 0.5px, transparent 0.5px),
              radial-gradient(circle at 40% 70%, hsl(var(--primary)) 1px, transparent 1px),
              radial-gradient(circle at 60% 90%, hsl(var(--primary)) 0.5px, transparent 0.5px),
              radial-gradient(circle at 10% 60%, hsl(var(--primary)) 1px, transparent 1px)
            `,
            backgroundSize: '50px 50px, 30px 30px, 40px 40px, 25px 25px, 35px 35px',
          }}
        />
      </div>

      {/* App Window */}
      <motion.div
        initial={{ opacity: 0, y: 60, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.8, delay: 0.2, ease: [0.25, 0.4, 0.25, 1] }}
        className="relative bg-background border border-border/60 dark:border-border/40 shadow-2xl shadow-black/15 dark:shadow-black/50 overflow-hidden h-full flex flex-col"
      >
        {/* Window Chrome */}
        <div className="h-10 bg-muted/50 border-b border-border/40 flex items-center px-4">
          <div className="flex items-center gap-2">
            <button className="size-3 bg-red-500 hover:bg-red-600 transition-colors" />
            <button className="size-3 bg-yellow-500 hover:bg-yellow-600 transition-colors" />
            <button className="size-3 bg-green-500 hover:bg-green-600 transition-colors" />
          </div>
          <div className="flex-1 flex justify-center">
            <div className="flex items-center gap-2 px-4 py-1.5 bg-background/50 border border-border/40 text-[11px] text-muted-foreground">
              <span className="size-3 bg-emerald-500/20 flex items-center justify-center text-[8px] text-emerald-600">🔒</span>
              <span>app.open-bookkeeping.com</span>
            </div>
          </div>
          <div className="w-14" />
        </div>

        {/* App Layout */}
        <div className="flex flex-1 min-h-0">
          {/* Sidebar */}
          <div className="w-56 border-r border-border/40 bg-muted/10 flex flex-col">
            {/* Logo */}
            <div className="px-5 py-5 border-b border-border/30">
              <span className="instrument-serif text-[15px] font-semibold text-foreground">
                Open<span className="text-primary/40 font-light mx-0.5">—</span>Bookkeeping
              </span>
            </div>

            {/* Navigation */}
            <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto scrollbar-thin">
              {navItems.map((navItem) => (
                <button
                  key={navItem.id}
                  onClick={() => {
                    setActiveNav(navItem.id);
                    setSelectedInvoice(0);
                  }}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2.5 text-[12px] font-medium transition-all duration-150 group cursor-pointer",
                    activeNav === navItem.id
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                  )}
                >
                  <navItem.icon className={cn(
                    "size-4 transition-transform duration-150",
                    activeNav !== navItem.id && "group-hover:scale-110"
                  )} />
                  <span>{navItem.label}</span>
                  {navItem.badge && (
                    <span className={cn(
                      "ml-auto text-[10px] px-2 py-0.5 tabular-nums font-medium",
                      activeNav === navItem.id
                        ? "bg-primary/20 text-primary"
                        : "bg-muted text-muted-foreground"
                    )}>
                      {navItem.badge}
                    </span>
                  )}
                </button>
              ))}
            </nav>

            {/* User & Settings */}
            <div className="border-t border-border/30">
              <button className="w-full flex items-center gap-3 px-6 py-4 text-[12px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors cursor-pointer">
                <GearIcon className="size-4" />
                <span>Settings</span>
              </button>
              <div className="px-5 pb-4">
                <div className="flex items-center gap-3 px-3 py-2 bg-muted/40">
                  <div className="size-8 bg-primary/10 flex items-center justify-center text-[11px] font-bold text-primary">
                    HA
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-medium truncate">Hazli Ahmad</p>
                    <p className="text-[10px] text-muted-foreground truncate">hazli@company.my</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Main Content Area - Changes based on activeNav */}
          {activeNav === "dashboard" && (
            <DashboardView formatAmount={formatAmount} />
          )}

          {activeNav === "invoices" && (
            <InvoicesView
              invoices={invoices}
              allInvoices={allInvoices}
              selectedInvoice={selectedInvoice}
              setSelectedInvoice={setSelectedInvoice}
              activeTab={activeTab}
              setActiveTab={setActiveTab}
              filterOpen={filterOpen}
              setFilterOpen={setFilterOpen}
              selectedFilter={selectedFilter}
              setSelectedFilter={setSelectedFilter}
              hoveredRow={hoveredRow}
              setHoveredRow={setHoveredRow}
              showNewInvoiceTooltip={showNewInvoiceTooltip}
              setShowNewInvoiceTooltip={setShowNewInvoiceTooltip}
              formatAmount={formatAmount}
              getStatusColor={getStatusColor}
              totalRevenue={totalRevenue}
              pendingAmount={pendingAmount}
              overdueAmount={overdueAmount}
              selectedInvoiceData={selectedInvoiceData}
            />
          )}

          {activeNav === "bills" && (
            <BillsView formatAmount={formatAmount} getStatusColor={getStatusColor} />
          )}

          {activeNav === "customers" && (
            <CustomersView />
          )}

          {activeNav === "vendors" && (
            <VendorsView />
          )}

          {activeNav === "reports" && (
            <ReportsView formatAmount={formatAmount} />
          )}

          {activeNav === "vault" && (
            <VaultView />
          )}
        </div>
      </motion.div>
    </div>
  );
};

const Hero = () => {
  return (
    <section className="relative h-screen overflow-hidden bg-background flex flex-col">
      {/* Navigation - Fixed at top, full width */}
      <motion.nav
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.25, 0.4, 0.25, 1] }}
        className="relative z-20 w-full flex items-center justify-between px-6 md:px-10 lg:px-16 py-5 max-w-[1600px] mx-auto shrink-0"
      >
        <LogoBrandMinimal size="md" />

        <div className="flex items-center gap-1 sm:gap-2">
          <ThemeSwitch />
          <Link to={LINKS.LOGIN} className="cursor-pointer">
            <Button size="sm" className="ml-1 sm:ml-2 gap-1.5 cursor-pointer">
              Login
              <CircleOpenArrowRight className="-rotate-45 size-3.5" />
            </Button>
          </Link>
        </div>
      </motion.nav>

      {/* Main Content - Full Height */}
      <div className="relative z-10 flex-1 flex">
        <div className="flex-1 grid lg:grid-cols-[420px_1fr] gap-12 lg:gap-16 max-w-[1600px] mx-auto px-6 md:px-10 lg:px-16 pt-12 lg:pt-20">

          {/* Left Side - Content */}
          <div className="pt-4">
            {/* Main Headline */}
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1, duration: 0.5 }}
              className="instrument-serif text-5xl sm:text-6xl lg:text-7xl tracking-tight leading-[1.05]"
            >
              <span className="text-muted-foreground/50 dark:text-muted-foreground/60">Bookkeeping</span>
              <br />
              <span className="text-foreground">made simple.</span>
            </motion.h1>

            {/* Subheadline */}
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.5 }}
              className="mt-6 text-muted-foreground text-lg leading-relaxed max-w-sm"
            >
              Open source invoicing, accounting, and financial reporting.
              Everything you need, nothing you don't.
            </motion.p>

            {/* CTA Buttons */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.5 }}
              className="mt-10 flex flex-wrap items-center gap-4"
            >
              <Link to={LINKS.DASHBOARD} className="cursor-pointer">
                <Button
                  size="lg"
                  className="h-12 px-8 text-sm font-medium gap-2 cursor-pointer"
                >
                  Try now
                  <CircleOpenArrowRight className="-rotate-45 size-4" />
                </Button>
              </Link>
              <a
                href={LINKS.SOCIALS.GITHUB}
                target="_blank"
                rel="noopener noreferrer"
                className="cursor-pointer"
              >
                <Button
                  variant="outline"
                  size="lg"
                  className="h-12 px-6 text-sm font-medium gap-2 border-border/60 hover:border-border dark:border-border/50 dark:hover:border-border/80 dark:hover:bg-muted/50 group cursor-pointer"
                >
                  <Star className="size-4 transition-colors group-hover:text-amber-500 group-hover:fill-amber-500" />
                  Star us on GitHub
                </Button>
              </a>
            </motion.div>

            {/* Trust Indicators */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.5 }}
              className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-muted-foreground"
            >
              <span>Free forever</span>
              <span className="size-1 bg-border" />
              <span>No credit card</span>
              <span className="size-1 bg-border" />
              <span>Open source</span>
            </motion.div>

            {/* Decorative Chart Graphic */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5, duration: 0.6 }}
              className="mt-12 hidden lg:block"
            >
              <div className="relative">
                {/* Chart Card */}
                <div className="bg-background border border-border/60 dark:border-border/40 shadow-lg dark:shadow-black/30 p-5 max-w-[340px]">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-[13px] font-semibold">Revenue vs Expenses</span>
                    <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                      <span className="flex items-center gap-1.5">
                        <span className="size-2 bg-primary" />
                        Revenue
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span className="size-2 bg-amber-500/60 dark:bg-amber-400/70" />
                        Expenses
                      </span>
                    </div>
                  </div>

                  {/* Mini Chart */}
                  <div className="relative h-28">
                    {/* Grid lines */}
                    <div className="absolute inset-0 flex flex-col justify-between">
                      {[0, 1, 2, 3].map((i) => (
                        <div key={i} className="border-t border-border/30" />
                      ))}
                    </div>

                    {/* Chart Area */}
                    <svg className="absolute inset-0 w-full h-full" preserveAspectRatio="none">
                      {/* Revenue area - light blue gradient */}
                      <defs>
                        <linearGradient id="revenueGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                          <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.2" />
                          <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0.02" />
                        </linearGradient>
                        <linearGradient id="expenseGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                          <stop offset="0%" stopColor="hsl(45 93% 58%)" stopOpacity="0.15" />
                          <stop offset="100%" stopColor="hsl(45 93% 58%)" stopOpacity="0.02" />
                        </linearGradient>
                      </defs>
                      {/* Revenue area */}
                      <path
                        d="M0,90 C30,85 60,70 90,55 C120,40 150,35 180,30 C210,25 240,20 270,15 C300,10 330,8 340,5 L340,112 L0,112 Z"
                        fill="url(#revenueGradient)"
                      />
                      {/* Revenue line */}
                      <path
                        d="M0,90 C30,85 60,70 90,55 C120,40 150,35 180,30 C210,25 240,20 270,15 C300,10 330,8 340,5"
                        fill="none"
                        stroke="hsl(var(--primary))"
                        strokeWidth="2"
                      />
                      {/* Expenses area */}
                      <path
                        d="M0,100 C30,98 60,95 90,92 C120,89 150,88 180,85 C210,82 240,80 270,78 C300,76 330,75 340,74 L340,112 L0,112 Z"
                        fill="url(#expenseGradient)"
                      />
                      {/* Expenses line */}
                      <path
                        d="M0,100 C30,98 60,95 90,92 C120,89 150,88 180,85 C210,82 240,80 270,78 C300,76 330,75 340,74"
                        fill="none"
                        stroke="hsl(45 93% 58% / 0.7)"
                        strokeWidth="1.5"
                      />
                    </svg>
                  </div>

                  {/* Month labels */}
                  <div className="flex justify-between mt-2 text-[9px] text-muted-foreground">
                    <span>Jan</span>
                    <span>Mar</span>
                    <span>May</span>
                    <span>Jul</span>
                    <span>Sep</span>
                    <span>Nov</span>
                  </div>
                </div>

                {/* Floating notification card */}
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.8, duration: 0.4 }}
                  className="absolute right-8 top-6 bg-background border border-border/60 dark:border-border/40 shadow-lg dark:shadow-black/30 p-3 max-w-[180px]"
                >
                  <div className="flex items-start gap-2.5">
                    <div className="size-7 bg-emerald-500/10 dark:bg-emerald-500/15 flex items-center justify-center shrink-0">
                      <TrendingUp className="size-3.5 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <div>
                      <p className="text-[11px] font-medium">Revenue up 23%</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">vs last quarter</p>
                    </div>
                  </div>
                </motion.div>

                {/* Second floating element */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 1, duration: 0.4 }}
                  className="absolute -left-3 -bottom-3 bg-background border border-border/60 dark:border-border/40 shadow-lg dark:shadow-black/30 px-3 py-2"
                >
                  <div className="flex items-center gap-2">
                    <div className="size-6 bg-primary/10 flex items-center justify-center">
                      <span className="text-[10px] font-bold text-primary">RM</span>
                    </div>
                    <div>
                      <p className="text-[12px] font-bold tabular-nums">65,500.00</p>
                      <p className="text-[9px] text-muted-foreground">Net profit</p>
                    </div>
                  </div>
                </motion.div>
              </div>
            </motion.div>
          </div>

          {/* Right Side - App Window - Full Height */}
          <div className="relative hidden lg:block -mr-16 xl:-mr-32 self-stretch">
            {/* Dashboard container - stretches full height */}
            <div className="sticky top-0 h-screen pt-8">
              <div className="relative h-full">
                <AppWindowMockup />

                {/* Fade out gradient at bottom */}
                <div className="absolute bottom-0 left-0 right-0 h-48 bg-gradient-to-t from-background via-background/80 to-transparent pointer-events-none z-20" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;
