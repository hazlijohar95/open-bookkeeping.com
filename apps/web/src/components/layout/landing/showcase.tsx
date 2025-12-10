import { motion } from "motion/react";
import { cn } from "@/lib/utils";
import { useState } from "react";
import {
  ReceiptIcon,
  GaugeIcon,
  SquareWandSparkleIcon,
  DatabaseIcon,
  HardDriveIcon,
  BoxIcon,
  FileCheckIcon,
  HourglassStartIcon,
  CircleCheckIcon,
} from "@/assets/icons";
import { TrendingUp, Clock, AlertTriangle, Send, Check } from "@/components/ui/icons";

interface BentoCardProps {
  children: React.ReactNode;
  className?: string;
  index: number;
}

const BentoCard = ({ children, className, index }: BentoCardProps) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.5,
        delay: index * 0.08,
        ease: [0.25, 0.4, 0.25, 1] as const,
      }}
      className={cn(
        "group relative overflow-hidden border border-border/40 bg-card/30",
        "transition-all duration-300 ease-out",
        "hover:border-border/60 hover:bg-card/50",
        className
      )}
    >
      {children}
    </motion.div>
  );
};

// Interactive Invoice Table
const InvoiceTableMockup = () => {
  const [selectedRow, setSelectedRow] = useState<number | null>(null);
  const [hoveredRow, setHoveredRow] = useState<number | null>(null);

  const rows = [
    { storage: "local", num: "INV-2024-042", total: "RM 5,200", items: 3, status: "paid" },
    { storage: "server", num: "INV-2024-041", total: "RM 1,850", items: 2, status: "pending" },
    { storage: "server", num: "INV-2024-040", total: "RM 3,400", items: 5, status: "paid" },
  ];

  return (
    <div className="bg-background border border-border/50 overflow-hidden text-[11px] select-none">
      {/* Table Header */}
      <div className="grid grid-cols-5 gap-2 px-4 py-2.5 border-b border-border/30 bg-muted/30 text-muted-foreground font-medium text-[10px] uppercase tracking-wide">
        <span>Storage</span>
        <span>Invoice #</span>
        <span>Total</span>
        <span>Items</span>
        <span>Status</span>
      </div>
      {/* Table Rows */}
      {rows.map((row, i) => (
        <div
          key={i}
          onClick={() => setSelectedRow(selectedRow === i ? null : i)}
          onMouseEnter={() => setHoveredRow(i)}
          onMouseLeave={() => setHoveredRow(null)}
          className={cn(
            "grid grid-cols-5 gap-2 px-4 py-3 border-b border-border/20 last:border-b-0 cursor-pointer transition-all duration-150",
            selectedRow === i && "bg-primary/5 border-l-2 border-l-primary",
            hoveredRow === i && selectedRow !== i && "bg-muted/40"
          )}
        >
          <span
            className={cn(
              "inline-flex items-center gap-1.5 px-2 py-1 text-[10px] w-fit font-medium transition-colors",
              row.storage === "local"
                ? "bg-slate-100 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400"
                : "bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400"
            )}
          >
            {row.storage === "local" ? (
              <HardDriveIcon className="size-3" />
            ) : (
              <DatabaseIcon className="size-3" />
            )}
            {row.storage === "local" ? "Local" : "Server"}
          </span>
          <span className={cn(
            "text-foreground font-medium transition-colors",
            selectedRow === i && "text-primary"
          )}>{row.num}</span>
          <span className="text-foreground tabular-nums font-semibold">{row.total}</span>
          <span className="inline-flex items-center gap-1 text-muted-foreground">
            <BoxIcon className="size-3" />
            {row.items}
          </span>
          <span
            className={cn(
              "inline-flex items-center gap-1 px-2 py-1 text-[10px] w-fit capitalize font-medium",
              row.status === "paid"
                ? "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400"
                : "bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400"
            )}
          >
            {row.status === "paid" ? (
              <FileCheckIcon className="size-3" />
            ) : (
              <HourglassStartIcon className="size-3" />
            )}
            {row.status}
          </span>
        </div>
      ))}
    </div>
  );
};

// Interactive Metrics Cards
const MetricsCardsMockup = () => {
  const [activeCard, setActiveCard] = useState<number | null>(null);

  const metrics = [
    {
      label: "This Month",
      value: "RM 12,450",
      sub: "8 invoices paid",
      icon: TrendingUp,
      color: "emerald",
    },
    {
      label: "Pending",
      value: "RM 3,200",
      sub: "Awaiting payment",
      icon: Clock,
      color: "blue",
    },
    {
      label: "Overdue",
      value: "2",
      sub: "RM 1,800",
      icon: AlertTriangle,
      color: "amber",
    },
  ];

  return (
    <div className="grid grid-cols-3 gap-2">
      {metrics.map((metric, i) => (
        <div
          key={i}
          onClick={() => setActiveCard(activeCard === i ? null : i)}
          className={cn(
            "bg-background border border-border/50 p-3 cursor-pointer transition-all duration-200 select-none",
            activeCard === i && "ring-2 ring-primary/30 border-primary/50 scale-[1.02]",
            activeCard !== i && "hover:border-border hover:bg-muted/20"
          )}
        >
          <div className="flex items-center gap-1.5 mb-2">
            <div
              className={cn(
                "flex size-6 items-center justify-center transition-colors",
                metric.color === "emerald" && "bg-emerald-100 dark:bg-emerald-900/40",
                metric.color === "blue" && "bg-blue-100 dark:bg-blue-900/40",
                metric.color === "amber" && "bg-amber-100 dark:bg-amber-900/40"
              )}
            >
              <metric.icon
                className={cn(
                  "size-3",
                  metric.color === "emerald" && "text-emerald-600 dark:text-emerald-400",
                  metric.color === "blue" && "text-blue-600 dark:text-blue-400",
                  metric.color === "amber" && "text-amber-600 dark:text-amber-400"
                )}
              />
            </div>
            <span className="text-[10px] text-muted-foreground font-medium">{metric.label}</span>
          </div>
          <p className="text-sm font-bold tabular-nums">{metric.value}</p>
          <p className="text-[9px] text-muted-foreground mt-0.5">{metric.sub}</p>
        </div>
      ))}
    </div>
  );
};

// Interactive AI Chat
const AIChatMockup = () => {
  const [inputValue, setInputValue] = useState("");
  const [activePrompt, setActivePrompt] = useState<string | null>(null);

  const prompts = ["Revenue this month?", "Overdue invoices"];

  return (
    <div className="space-y-3">
      {/* Quick prompts */}
      <div className="flex gap-1.5">
        {prompts.map((prompt) => (
          <button
            key={prompt}
            onClick={() => setActivePrompt(activePrompt === prompt ? null : prompt)}
            className={cn(
              "text-[10px] px-2.5 py-1.5 border transition-all duration-150",
              activePrompt === prompt
                ? "bg-primary/10 border-primary/30 text-primary"
                : "bg-background border-border/50 text-muted-foreground hover:border-border hover:text-foreground"
            )}
          >
            {prompt}
          </button>
        ))}
      </div>
      {/* Chat messages */}
      <div className="space-y-2">
        <div className="flex justify-end">
          <div className="bg-primary text-primary-foreground text-[11px] px-3 py-2 max-w-[85%]">
            Create invoice for Acme Corp, RM 5000
          </div>
        </div>
        <div className="flex gap-2">
          <div className="flex size-6 shrink-0 items-center justify-center bg-primary/10">
            <SquareWandSparkleIcon className="size-3 text-primary" />
          </div>
          <div className="space-y-1">
            <span className="inline-flex items-center gap-1 text-[9px] px-2 py-0.5 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 font-medium">
              <CircleCheckIcon className="size-2.5" />
              Created
            </span>
            <div className="bg-muted/50 text-foreground text-[11px] px-3 py-2">
              Done! Invoice #INV-2024-043 created for Acme Corp.
            </div>
          </div>
        </div>
      </div>
      {/* Input */}
      <div className="flex items-center gap-2 px-3 py-2 bg-background border border-border/50 focus-within:border-border focus-within:ring-1 focus-within:ring-primary/20 transition-all">
        <SquareWandSparkleIcon className="size-3.5 text-muted-foreground" />
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder="Ask anything..."
          className="flex-1 text-[11px] bg-transparent outline-none text-foreground placeholder:text-muted-foreground"
        />
        <button
          className={cn(
            "p-1 transition-colors",
            inputValue ? "text-primary hover:bg-primary/10" : "text-muted-foreground/40"
          )}
        >
          <Send className="size-3.5" />
        </button>
      </div>
    </div>
  );
};

// Interactive SST Report
const SSTReportMockup = () => {
  const [downloadHovered, setDownloadHovered] = useState(false);

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold">SST Summary - Q4 2024</span>
        <span className="text-[9px] px-2 py-0.5 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 font-medium">
          Compliant
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {[
          { label: "Service Tax (6%)", value: "RM 2,847.00" },
          { label: "Sales Tax (10%)", value: "RM 1,240.00" },
        ].map((item) => (
          <div
            key={item.label}
            className="bg-background border border-border/50 p-2.5 hover:border-border transition-colors cursor-default"
          >
            <p className="text-[9px] text-muted-foreground mb-1 font-medium">{item.label}</p>
            <p className="text-sm font-bold tabular-nums">{item.value}</p>
          </div>
        ))}
      </div>
      <div className="bg-background border border-border/50 p-2.5">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[9px] text-muted-foreground font-medium">SST-02 Report</span>
          <button
            onMouseEnter={() => setDownloadHovered(true)}
            onMouseLeave={() => setDownloadHovered(false)}
            className={cn(
              "text-[9px] font-medium transition-all duration-150 flex items-center gap-1",
              downloadHovered ? "text-primary" : "text-primary/70"
            )}
          >
            {downloadHovered && <Check className="size-2.5" />}
            Download PDF
          </button>
        </div>
        <div className="h-1.5 bg-muted overflow-hidden">
          <motion.div
            className="h-full bg-primary"
            initial={{ width: 0 }}
            animate={{ width: "72%" }}
            transition={{ duration: 1, delay: 0.5, ease: "easeOut" }}
          />
        </div>
        <p className="text-[9px] text-muted-foreground mt-1.5">18 of 25 invoices processed</p>
      </div>
    </div>
  );
};

const Showcase = () => {
  return (
    <section className="relative py-24 md:py-32 px-6 overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-0 w-[500px] h-[500px] rounded-full bg-primary/[0.015] blur-3xl" />
        <div className="absolute bottom-1/4 right-0 w-[400px] h-[400px] rounded-full bg-violet-500/[0.015] blur-3xl" />
      </div>

      {/* Section Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.25, 0.4, 0.25, 1] as const }}
        className="text-center mb-16 md:mb-20 relative z-10"
      >
        <span className="inline-block text-xs tracking-[0.25em] uppercase text-muted-foreground mb-4 font-medium">
          Built for you
        </span>
        <h2 className="instrument-serif text-3xl md:text-4xl lg:text-5xl tracking-tight">
          Powerful, yet simple
        </h2>
        <p className="mt-4 text-muted-foreground text-lg max-w-md mx-auto">
          See how it all comes together
        </p>
      </motion.div>

      {/* Bento Grid */}
      <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4 relative z-10">
        {/* Invoice Preview - Large Card */}
        <BentoCard index={0} className="lg:col-span-2 min-h-[320px]">
          <div className="relative h-full p-5 md:p-6 flex flex-col">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-blue-500/10">
                <ReceiptIcon className="size-4 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <span className="text-sm font-semibold block">Invoice Management</span>
                <span className="text-xs text-muted-foreground">Track all your invoices</span>
              </div>
            </div>
            <p className="text-muted-foreground text-sm mb-4 max-w-md">
              Local or cloud storage, real-time status updates, instant PDF export.
            </p>
            <div className="flex-1 flex flex-col justify-end">
              <InvoiceTableMockup />
            </div>
          </div>
        </BentoCard>

        {/* Dashboard Metrics */}
        <BentoCard index={1} className="min-h-[320px]">
          <div className="relative h-full p-5 md:p-6 flex flex-col">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-emerald-500/10">
                <GaugeIcon className="size-4 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <span className="text-sm font-semibold block">Dashboard</span>
                <span className="text-xs text-muted-foreground">Real-time metrics</span>
              </div>
            </div>
            <p className="text-muted-foreground text-sm mb-4">
              Know your business health at a glance with live updates.
            </p>
            <div className="flex-1 flex flex-col justify-end">
              <MetricsCardsMockup />
            </div>
          </div>
        </BentoCard>

        {/* AI Assistant */}
        <BentoCard index={2} className="min-h-[300px]">
          <div className="relative h-full p-5 md:p-6 flex flex-col">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-violet-500/10">
                <SquareWandSparkleIcon className="size-4 text-violet-600 dark:text-violet-400" />
              </div>
              <div>
                <span className="text-sm font-semibold block">AI Assistant</span>
                <span className="text-xs text-muted-foreground">Just ask</span>
              </div>
            </div>
            <p className="text-muted-foreground text-sm mb-4">
              Create invoices, query data, and get insights with natural language.
            </p>
            <div className="flex-1 flex flex-col justify-end">
              <AIChatMockup />
            </div>
          </div>
        </BentoCard>

        {/* SST Malaysia */}
        <BentoCard index={3} className="min-h-[300px] lg:col-span-2">
          <div className="relative h-full p-5 md:p-6 flex flex-col md:flex-row gap-5 md:gap-6">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 bg-amber-500/10">
                  <DatabaseIcon className="size-4 text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <span className="text-sm font-semibold block">SST Malaysia</span>
                  <span className="text-xs text-muted-foreground">Tax compliance</span>
                </div>
              </div>
              <p className="text-muted-foreground text-sm mb-4">
                Built-in Malaysian tax compliance. Generate SST-compliant invoices and reports
                automatically.
              </p>
              <div className="flex flex-wrap gap-1.5">
                {["6% Service Tax", "10% Sales Tax", "SST-02 Reports", "Auto-calculate"].map(
                  (tag) => (
                    <span
                      key={tag}
                      className="text-[10px] px-2 py-1 bg-amber-500/10 text-amber-700 dark:text-amber-300 font-medium"
                    >
                      {tag}
                    </span>
                  )
                )}
              </div>
            </div>
            <div className="flex-1 min-w-[200px]">
              <SSTReportMockup />
            </div>
          </div>
        </BentoCard>
      </div>
    </section>
  );
};

export default Showcase;
