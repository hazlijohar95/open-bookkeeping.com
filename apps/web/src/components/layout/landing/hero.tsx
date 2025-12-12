import { motion } from "motion/react";
import { useState } from "react";
import { CircleOpenArrowRight, Star, GaugeIcon, VersionsIcon, UsersIcon, TruckIcon, BookOpenIcon, ReceiptIcon, GearIcon, FolderFeatherIcon } from "@/assets/icons";
import { Button } from "@/components/ui/button";
import { LINKS } from "@/constants/links";
import { Link } from "react-router-dom";
import { LogoBrandMinimal } from "@/components/brand/logo-brand";
import ThemeSwitch from "@/components/table-columns/theme-switch";
import { TrendingUp } from "@/components/ui/icons";
import { cn } from "@/lib/utils";
import {
  DashboardView,
  InvoicesView,
  BillsView,
  CustomersView,
  VendorsView,
  ReportsView,
  VaultView,
} from "./views";

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

            {/* UserIcon & Settings */}
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
