import React from "react";
import { motion } from "motion/react";
import { TrendingUp, ClockIcon, AlertTriangleIcon, Plus, Filter, MoreHorizontalIcon, ChevronRightIcon, Download, Eye } from "@/components/ui/icons";
import { cn } from "@/lib/utils";

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
            { label: "Pending", value: formatAmount(pendingAmount), icon: ClockIcon, color: "amber", sub: `${allInvoices.filter(i => i.status === "pending").length} invoices` },
            { label: "Overdue", value: formatAmount(overdueAmount), icon: AlertTriangleIcon, color: "red", sub: `${allInvoices.filter(i => i.status === "overdue").length} invoices` },
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
                    <MoreHorizontalIcon className="size-3.5 text-muted-foreground" />
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
                  <ChevronRightIcon className="size-4 text-muted-foreground" />
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
                  SendIcon
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

export default React.memo(InvoicesView);
