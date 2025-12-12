import { motion, useInView } from "motion/react";
import { cn } from "@/lib/utils";
import { useState, useRef } from "react";
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
import {
  TrendingUp,
  ClockIcon,
  AlertTriangleIcon,
  SendIcon,
  Check,
} from "@/components/ui/icons";

// ============================================================================
// BENTO CARD - Mobile-optimized wrapper
// ============================================================================

interface BentoCardProps {
  children: React.ReactNode;
  className?: string;
  index: number;
}

const BentoCard = ({ children, className, index }: BentoCardProps) => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-50px" });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 30 }}
      animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
      transition={{
        duration: 0.5,
        delay: index * 0.1,
        ease: [0.25, 0.4, 0.25, 1],
      }}
      className={cn(
        "group relative overflow-hidden",
        "border border-border/40 bg-card/30",
        "rounded-2xl sm:rounded-xl",
        "transition-all duration-300 ease-out",
        "hover:border-border/60 hover:bg-card/50",
        className
      )}
    >
      {children}
    </motion.div>
  );
};

// ============================================================================
// INVOICE TABLE MOCKUP - Simplified for mobile
// ============================================================================

const InvoiceTableMockup = () => {
  const [selectedRow, setSelectedRow] = useState<number | null>(null);

  const rows = [
    {
      storage: "local",
      num: "INV-042",
      total: "RM 5,200",
      items: 3,
      status: "paid",
    },
    {
      storage: "server",
      num: "INV-041",
      total: "RM 1,850",
      items: 2,
      status: "pending",
    },
    {
      storage: "server",
      num: "INV-040",
      total: "RM 3,400",
      items: 5,
      status: "paid",
    },
  ];

  return (
    <div className="bg-background border border-border/50 rounded-lg overflow-hidden text-[11px] select-none">
      {/* Table Header - Hidden on smallest screens */}
      <div className="hidden sm:grid grid-cols-5 gap-2 px-3 sm:px-4 py-2.5 border-b border-border/30 bg-muted/30 text-muted-foreground font-medium text-[10px] uppercase tracking-wide">
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
          className={cn(
            "grid grid-cols-2 sm:grid-cols-5 gap-2 px-3 sm:px-4 py-3 border-b border-border/20 last:border-b-0",
            "cursor-pointer transition-all duration-150",
            selectedRow === i && "bg-primary/5 border-l-2 border-l-primary",
            selectedRow !== i && "hover:bg-muted/40 active:bg-muted/60"
          )}
        >
          {/* Mobile: Row 1 */}
          <div className="sm:contents flex items-center justify-between col-span-2 sm:col-span-1">
            <span
              className={cn(
                "inline-flex items-center gap-1.5 px-2 py-1 text-[10px] w-fit font-medium",
                "rounded sm:rounded-none",
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
              <span className="hidden sm:inline">
                {row.storage === "local" ? "Local" : "Server"}
              </span>
            </span>
            <span
              className={cn(
                "text-foreground font-medium sm:hidden",
                selectedRow === i && "text-primary"
              )}
            >
              {row.num}
            </span>
          </div>

          {/* Desktop only columns */}
          <span
            className={cn(
              "hidden sm:block text-foreground font-medium",
              selectedRow === i && "text-primary"
            )}
          >
            {row.num}
          </span>
          <span className="hidden sm:block text-foreground tabular-nums font-semibold">
            {row.total}
          </span>
          <span className="hidden sm:flex items-center gap-1 text-muted-foreground">
            <BoxIcon className="size-3" />
            {row.items}
          </span>

          {/* Mobile: Row 2 */}
          <div className="sm:hidden flex items-center justify-between col-span-2">
            <span className="text-foreground tabular-nums font-semibold">
              {row.total}
            </span>
            <span
              className={cn(
                "inline-flex items-center gap-1 px-2 py-1 text-[10px] w-fit capitalize font-medium rounded",
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

          {/* Desktop status */}
          <span
            className={cn(
              "hidden sm:inline-flex items-center gap-1 px-2 py-1 text-[10px] w-fit capitalize font-medium",
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

// ============================================================================
// METRICS CARDS MOCKUP
// ============================================================================

const MetricsCardsMockup = () => {
  const [activeCard, setActiveCard] = useState<number | null>(null);

  const metrics = [
    {
      label: "This Month",
      value: "RM 12,450",
      sub: "8 invoices",
      icon: TrendingUp,
      color: "emerald",
    },
    {
      label: "Pending",
      value: "RM 3,200",
      sub: "Awaiting",
      icon: ClockIcon,
      color: "blue",
    },
    {
      label: "Overdue",
      value: "2",
      sub: "RM 1,800",
      icon: AlertTriangleIcon,
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
            "bg-background border border-border/50 p-2.5 sm:p-3 rounded-lg",
            "cursor-pointer transition-all duration-200 select-none",
            "active:scale-95 sm:active:scale-100",
            activeCard === i &&
              "ring-2 ring-primary/30 border-primary/50 scale-[1.02]",
            activeCard !== i && "hover:border-border hover:bg-muted/20"
          )}
        >
          <div className="flex items-center gap-1.5 mb-2">
            <div
              className={cn(
                "flex size-5 sm:size-6 items-center justify-center rounded",
                metric.color === "emerald" && "bg-emerald-100 dark:bg-emerald-900/40",
                metric.color === "blue" && "bg-blue-100 dark:bg-blue-900/40",
                metric.color === "amber" && "bg-amber-100 dark:bg-amber-900/40"
              )}
            >
              <metric.icon
                className={cn(
                  "size-2.5 sm:size-3",
                  metric.color === "emerald" &&
                    "text-emerald-600 dark:text-emerald-400",
                  metric.color === "blue" && "text-blue-600 dark:text-blue-400",
                  metric.color === "amber" && "text-amber-600 dark:text-amber-400"
                )}
              />
            </div>
          </div>
          <p className="text-xs sm:text-sm font-bold tabular-nums">{metric.value}</p>
          <p className="text-[9px] text-muted-foreground mt-0.5 truncate">
            {metric.sub}
          </p>
        </div>
      ))}
    </div>
  );
};

// ============================================================================
// AI CHAT MOCKUP - Simplified for mobile
// ============================================================================

const AIChatMockup = () => {
  const [inputValue, setInputValue] = useState("");

  return (
    <div className="space-y-3">
      {/* Chat messages */}
      <div className="space-y-2">
        <div className="flex justify-end">
          <div className="bg-primary text-primary-foreground text-[11px] px-3 py-2 rounded-2xl rounded-tr-sm max-w-[85%]">
            Create invoice for Acme Corp, RM 5000
          </div>
        </div>
        <div className="flex gap-2">
          <div className="flex size-6 shrink-0 items-center justify-center bg-primary/10 rounded-full">
            <SquareWandSparkleIcon className="size-3 text-primary" />
          </div>
          <div className="space-y-1">
            <span className="inline-flex items-center gap-1 text-[9px] px-2 py-0.5 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 font-medium rounded-full">
              <CircleCheckIcon className="size-2.5" />
              Created
            </span>
            <div className="bg-muted/50 text-foreground text-[11px] px-3 py-2 rounded-2xl rounded-tl-sm">
              Done! Invoice #INV-2024-043 created.
            </div>
          </div>
        </div>
      </div>
      {/* Input */}
      <div className="flex items-center gap-2 px-3 py-2.5 bg-background border border-border/50 rounded-full focus-within:border-border focus-within:ring-1 focus-within:ring-primary/20 transition-all">
        <SquareWandSparkleIcon className="size-3.5 text-muted-foreground shrink-0" />
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder="Ask anything..."
          className="flex-1 text-[11px] bg-transparent outline-none text-foreground placeholder:text-muted-foreground min-w-0"
        />
        <button
          className={cn(
            "p-1.5 rounded-full transition-colors shrink-0",
            inputValue
              ? "text-primary bg-primary/10"
              : "text-muted-foreground/40"
          )}
        >
          <SendIcon className="size-3.5" />
        </button>
      </div>
    </div>
  );
};

// ============================================================================
// SST REPORT MOCKUP
// ============================================================================

const SSTReportMockup = () => {
  const [downloadHovered, setDownloadHovered] = useState(false);

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold">SST Summary - Q4</span>
        <span className="text-[9px] px-2 py-0.5 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 font-medium rounded-full">
          Compliant
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {[
          { label: "Service Tax (6%)", value: "RM 2,847" },
          { label: "Sales Tax (10%)", value: "RM 1,240" },
        ].map((item) => (
          <div
            key={item.label}
            className="bg-background border border-border/50 p-2.5 rounded-lg"
          >
            <p className="text-[9px] text-muted-foreground mb-1 font-medium truncate">
              {item.label}
            </p>
            <p className="text-sm font-bold tabular-nums">{item.value}</p>
          </div>
        ))}
      </div>
      <div className="bg-background border border-border/50 p-2.5 rounded-lg">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[9px] text-muted-foreground font-medium">
            SST-02 Report
          </span>
          <button
            onMouseEnter={() => setDownloadHovered(true)}
            onMouseLeave={() => setDownloadHovered(false)}
            className={cn(
              "text-[9px] font-medium transition-all duration-150 flex items-center gap-1",
              downloadHovered ? "text-primary" : "text-primary/70"
            )}
          >
            {downloadHovered && <Check className="size-2.5" />}
            Download
          </button>
        </div>
        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-primary rounded-full"
            initial={{ width: 0 }}
            animate={{ width: "72%" }}
            transition={{ duration: 1, delay: 0.5, ease: "easeOut" }}
          />
        </div>
        <p className="text-[9px] text-muted-foreground mt-1.5">
          18 of 25 processed
        </p>
      </div>
    </div>
  );
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

const Showcase = () => {
  const headerRef = useRef(null);
  const isHeaderInView = useInView(headerRef, { once: true, margin: "-100px" });

  return (
    <section
      id="showcase"
      className="relative py-16 sm:py-24 md:py-32 px-4 sm:px-6 overflow-hidden"
    >
      {/* Background decoration */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-0 w-[300px] sm:w-[500px] h-[300px] sm:h-[500px] rounded-full bg-primary/[0.02] blur-3xl" />
        <div className="absolute bottom-1/4 right-0 w-[200px] sm:w-[400px] h-[200px] sm:h-[400px] rounded-full bg-violet-500/[0.02] blur-3xl" />
      </div>

      {/* Section Header */}
      <motion.div
        ref={headerRef}
        initial={{ opacity: 0, y: 30 }}
        animate={isHeaderInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
        transition={{ duration: 0.6, ease: [0.25, 0.4, 0.25, 1] }}
        className="text-center mb-10 sm:mb-16 md:mb-20 relative z-10"
      >
        <span className="inline-block text-[10px] sm:text-xs tracking-[0.2em] sm:tracking-[0.25em] uppercase text-muted-foreground mb-3 sm:mb-4 font-medium">
          Built for you
        </span>
        <h2 className="instrument-serif text-3xl sm:text-4xl lg:text-5xl tracking-tight">
          Powerful, yet simple
        </h2>
        <p className="mt-3 sm:mt-4 text-muted-foreground text-base sm:text-lg max-w-md mx-auto">
          See how it all comes together
        </p>
      </motion.div>

      {/* Bento Grid - Mobile optimized */}
      <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 relative z-10">
        {/* Invoice Management - Full width on mobile */}
        <BentoCard index={0} className="md:col-span-2 lg:col-span-2">
          <div className="relative h-full p-4 sm:p-5 md:p-6 flex flex-col">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-blue-500/10 rounded-lg">
                <ReceiptIcon className="size-4 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <span className="text-sm font-semibold block">
                  Invoice Management
                </span>
                <span className="text-xs text-muted-foreground">
                  Track all your invoices
                </span>
              </div>
            </div>
            <p className="text-muted-foreground text-sm mb-4 max-w-md">
              Local or cloud storage, real-time status updates, instant PDF
              export.
            </p>
            <div className="flex-1 flex flex-col justify-end">
              <InvoiceTableMockup />
            </div>
          </div>
        </BentoCard>

        {/* Dashboard Metrics */}
        <BentoCard index={1} className="min-h-[280px] sm:min-h-[320px]">
          <div className="relative h-full p-4 sm:p-5 md:p-6 flex flex-col">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-emerald-500/10 rounded-lg">
                <GaugeIcon className="size-4 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <span className="text-sm font-semibold block">Dashboard</span>
                <span className="text-xs text-muted-foreground">
                  Real-time metrics
                </span>
              </div>
            </div>
            <p className="text-muted-foreground text-sm mb-4">
              Know your business health at a glance.
            </p>
            <div className="flex-1 flex flex-col justify-end">
              <MetricsCardsMockup />
            </div>
          </div>
        </BentoCard>

        {/* AI Assistant */}
        <BentoCard index={2} className="min-h-[260px] sm:min-h-[300px]">
          <div className="relative h-full p-4 sm:p-5 md:p-6 flex flex-col">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-violet-500/10 rounded-lg">
                <SquareWandSparkleIcon className="size-4 text-violet-600 dark:text-violet-400" />
              </div>
              <div>
                <span className="text-sm font-semibold block">AI Assistant</span>
                <span className="text-xs text-muted-foreground">Just ask</span>
              </div>
            </div>
            <p className="text-muted-foreground text-sm mb-4">
              Create invoices and get insights with natural language.
            </p>
            <div className="flex-1 flex flex-col justify-end">
              <AIChatMockup />
            </div>
          </div>
        </BentoCard>

        {/* SST Malaysia */}
        <BentoCard index={3} className="md:col-span-2 lg:col-span-2">
          <div className="relative h-full p-4 sm:p-5 md:p-6 flex flex-col md:flex-row gap-4 md:gap-6">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 bg-amber-500/10 rounded-lg">
                  <DatabaseIcon className="size-4 text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <span className="text-sm font-semibold block">
                    SST Malaysia
                  </span>
                  <span className="text-xs text-muted-foreground">
                    Tax compliance
                  </span>
                </div>
              </div>
              <p className="text-muted-foreground text-sm mb-4">
                Built-in Malaysian tax compliance. Generate SST-compliant
                invoices and reports.
              </p>
              <div className="flex flex-wrap gap-1.5">
                {["6% Service", "10% Sales", "SST-02", "Auto-calc"].map(
                  (tag) => (
                    <span
                      key={tag}
                      className="text-[10px] px-2 py-1 bg-amber-500/10 text-amber-700 dark:text-amber-300 font-medium rounded-full"
                    >
                      {tag}
                    </span>
                  )
                )}
              </div>
            </div>
            <div className="flex-1 min-w-0 md:min-w-[200px]">
              <SSTReportMockup />
            </div>
          </div>
        </BentoCard>
      </div>
    </section>
  );
};

export default Showcase;
