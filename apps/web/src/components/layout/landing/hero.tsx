import { motion } from "motion/react";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { LINKS } from "@/constants/links";
import { Link } from "react-router-dom";
import { LogoBrandMinimal } from "@/components/brand/logo-brand";
import ThemeSwitch from "@/components/table-columns/theme-switch";
import { cn } from "@/lib/utils";
import {
  TrendingUp,
  CheckIcon,
  FileTextIcon,
  UsersIcon,
  BarChart3,
  XIcon,
} from "@/components/ui/icons";
import { CircleOpenArrowRight, Star, SidebarMenuIcon } from "@/assets/icons";

// ============================================================================
// FLOATING METRIC CARD - Works beautifully on mobile
// ============================================================================

interface MetricCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  trend?: string;
  trendUp?: boolean;
  delay: number;
  className?: string;
}

const MetricCard = ({
  icon,
  label,
  value,
  trend,
  trendUp,
  delay,
  className,
}: MetricCardProps) => (
  <motion.div
    initial={{ opacity: 0, y: 20, scale: 0.95 }}
    animate={{ opacity: 1, y: 0, scale: 1 }}
    transition={{
      duration: 0.6,
      delay,
      ease: [0.25, 0.4, 0.25, 1],
    }}
    className={cn(
      "bg-card/80 backdrop-blur-xl border border-border/50",
      "shadow-xl shadow-black/5 dark:shadow-black/20",
      "p-4 sm:p-5",
      className
    )}
  >
    <div className="flex items-center gap-3 mb-2">
      <div className="p-2 bg-primary/10 rounded-lg">{icon}</div>
      <span className="text-xs sm:text-sm text-muted-foreground font-medium">
        {label}
      </span>
    </div>
    <div className="flex items-baseline gap-2">
      <span className="text-xl sm:text-2xl font-bold tabular-nums tracking-tight">
        {value}
      </span>
      {trend && (
        <span
          className={cn(
            "text-xs font-medium flex items-center gap-0.5",
            trendUp ? "text-emerald-600 dark:text-emerald-400" : "text-red-500"
          )}
        >
          {trendUp && <TrendingUp className="size-3" />}
          {trend}
        </span>
      )}
    </div>
  </motion.div>
);

// ============================================================================
// FLOATING INVOICE PREVIEW - Mobile-optimized
// ============================================================================

const InvoicePreview = () => (
  <motion.div
    initial={{ opacity: 0, x: 20, rotateY: -10 }}
    animate={{ opacity: 1, x: 0, rotateY: 0 }}
    transition={{ duration: 0.8, delay: 0.5, ease: [0.25, 0.4, 0.25, 1] }}
    className={cn(
      "bg-card/90 backdrop-blur-xl border border-border/50",
      "shadow-2xl shadow-black/10 dark:shadow-black/30",
      "p-4 sm:p-5 w-full max-w-[280px] sm:max-w-[320px]"
    )}
  >
    {/* Invoice Header */}
    <div className="flex items-center justify-between mb-4">
      <div>
        <p className="text-[10px] sm:text-xs text-muted-foreground">Invoice</p>
        <p className="text-sm sm:text-base font-bold">#INV-2024-047</p>
      </div>
      <span className="text-[10px] sm:text-xs px-2 py-1 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-medium rounded-full flex items-center gap-1">
        <CheckIcon className="size-3" />
        Paid
      </span>
    </div>

    {/* Invoice Details */}
    <div className="space-y-2 mb-4">
      <div className="flex justify-between text-xs sm:text-sm">
        <span className="text-muted-foreground">Client</span>
        <span className="font-medium">Acme Corporation</span>
      </div>
      <div className="flex justify-between text-xs sm:text-sm">
        <span className="text-muted-foreground">Date</span>
        <span className="font-medium">Dec 12, 2024</span>
      </div>
    </div>

    {/* Invoice Total */}
    <div className="pt-3 border-t border-border/50">
      <div className="flex justify-between items-center">
        <span className="text-xs sm:text-sm text-muted-foreground">Total</span>
        <span className="text-lg sm:text-xl font-bold text-primary">
          RM 12,500.00
        </span>
      </div>
    </div>
  </motion.div>
);

// ============================================================================
// TRUST BADGES - Mobile-friendly
// ============================================================================

const TrustBadges = () => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.5, delay: 0.6 }}
    className="flex flex-wrap items-center justify-center lg:justify-start gap-3 sm:gap-4"
  >
    {[
      { icon: "✓", text: "Free forever" },
      { icon: "✓", text: "No credit card" },
      { icon: "✓", text: "Open source" },
    ].map((badge) => (
      <span
        key={badge.text}
        className="flex items-center gap-1.5 text-xs sm:text-sm text-muted-foreground"
      >
        <span className="size-4 sm:size-5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] sm:text-xs font-bold">
          {badge.icon}
        </span>
        {badge.text}
      </span>
    ))}
  </motion.div>
);

// ============================================================================
// MOBILE NAVIGATION
// ============================================================================

const MobileNav = ({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) => (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: isOpen ? 1 : 0 }}
    transition={{ duration: 0.2 }}
    className={cn(
      "fixed inset-0 z-50 lg:hidden",
      isOpen ? "pointer-events-auto" : "pointer-events-none"
    )}
  >
    {/* Backdrop */}
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: isOpen ? 1 : 0 }}
      className="absolute inset-0 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    />

    {/* Menu Panel */}
    <motion.div
      initial={{ x: "100%" }}
      animate={{ x: isOpen ? 0 : "100%" }}
      transition={{ type: "spring", damping: 30, stiffness: 300 }}
      className="absolute right-0 top-0 bottom-0 w-[280px] bg-card border-l border-border shadow-2xl"
    >
      {/* Close Button */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        <LogoBrandMinimal size="sm" />
        <button
          onClick={onClose}
          className="p-2 rounded-lg hover:bg-muted transition-colors"
        >
          <XIcon className="size-5" />
        </button>
      </div>

      {/* Menu Items */}
      <nav className="p-4 space-y-1">
        {[
          { label: "Features", href: "#features" },
          { label: "Showcase", href: "#showcase" },
          { label: "FAQ", href: "#faq" },
          { label: "GitHub", href: LINKS.SOCIALS.GITHUB, external: true },
        ].map((item) =>
          item.external ? (
            <a
              key={item.label}
              href={item.href}
              target="_blank"
              rel="noopener noreferrer"
              className="block px-4 py-3 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
              onClick={onClose}
            >
              {item.label}
            </a>
          ) : (
            <a
              key={item.label}
              href={item.href}
              className="block px-4 py-3 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
              onClick={onClose}
            >
              {item.label}
            </a>
          )
        )}
      </nav>

      {/* CTA */}
      <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-border bg-card safe-bottom">
        <Link to={LINKS.LOGIN} onClick={onClose}>
          <Button className="w-full h-12 gap-2">
            Get Started
            <CircleOpenArrowRight className="-rotate-45 size-4" />
          </Button>
        </Link>
      </div>
    </motion.div>
  </motion.div>
);

// ============================================================================
// MAIN HERO COMPONENT
// ============================================================================

const Hero = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  // Track scroll for nav background
  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <section className="relative min-h-screen overflow-hidden bg-background">
      {/* Background Gradient Mesh */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {/* Primary gradient blob */}
        <div
          className="absolute -top-1/4 -right-1/4 w-[80vw] h-[80vw] md:w-[60vw] md:h-[60vw] rounded-full opacity-30 dark:opacity-20 blur-3xl"
          style={{
            background:
              "radial-gradient(circle, hsl(var(--primary) / 0.4) 0%, transparent 70%)",
          }}
        />
        {/* Secondary accent */}
        <div
          className="absolute top-1/2 -left-1/4 w-[60vw] h-[60vw] rounded-full opacity-20 dark:opacity-10 blur-3xl"
          style={{
            background:
              "radial-gradient(circle, hsl(280 70% 60% / 0.3) 0%, transparent 70%)",
          }}
        />
        {/* Noise texture overlay */}
        <div
          className="absolute inset-0 opacity-[0.015] dark:opacity-[0.03]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
          }}
        />
      </div>

      {/* Navigation */}
      <motion.nav
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className={cn(
          "fixed top-0 left-0 right-0 z-40 transition-all duration-300 safe-top",
          scrolled
            ? "bg-background/80 backdrop-blur-xl border-b border-border/50"
            : "bg-transparent"
        )}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 sm:h-20">
            <LogoBrandMinimal size="md" />

            {/* Desktop Nav */}
            <div className="hidden lg:flex items-center gap-8">
              <a
                href="#features"
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Features
              </a>
              <a
                href="#showcase"
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Showcase
              </a>
              <a
                href="#faq"
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                FAQ
              </a>
            </div>

            <div className="flex items-center gap-2 sm:gap-3">
              <ThemeSwitch />
              <Link to={LINKS.LOGIN} className="hidden sm:block">
                <Button size="sm" className="gap-1.5">
                  Login
                  <CircleOpenArrowRight className="-rotate-45 size-3.5" />
                </Button>
              </Link>
              {/* Mobile Menu Button */}
              <button
                onClick={() => setMobileMenuOpen(true)}
                className="lg:hidden p-2 rounded-lg hover:bg-muted transition-colors"
              >
                <SidebarMenuIcon className="size-5" />
              </button>
            </div>
          </div>
        </div>
      </motion.nav>

      {/* Mobile Navigation */}
      <MobileNav
        isOpen={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
      />

      {/* Main Content */}
      <div className="relative z-10 pt-24 sm:pt-28 lg:pt-32 pb-16 sm:pb-20 lg:pb-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            {/* Left - Content */}
            <div className="text-center lg:text-left">
              {/* Badge */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="inline-flex items-center gap-2 px-3 py-1.5 mb-6 bg-primary/10 rounded-full"
              >
                <span className="size-2 bg-primary rounded-full animate-pulse" />
                <span className="text-xs sm:text-sm font-medium text-primary">
                  Open Source Accounting
                </span>
              </motion.div>

              {/* Headline */}
              <motion.h1
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.1 }}
                className="instrument-serif text-4xl sm:text-5xl md:text-6xl lg:text-7xl tracking-tight leading-[1.1]"
              >
                <span className="text-muted-foreground/60 dark:text-muted-foreground/50">
                  Bookkeeping
                </span>
                <br />
                <span className="text-foreground">made simple.</span>
              </motion.h1>

              {/* Subheadline */}
              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.2 }}
                className="mt-5 sm:mt-6 text-base sm:text-lg text-muted-foreground leading-relaxed max-w-md mx-auto lg:mx-0"
              >
                Open source invoicing, accounting, and financial reporting.
                Everything you need, nothing you don't.
              </motion.p>

              {/* CTA Buttons */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.3 }}
                className="mt-8 sm:mt-10 flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-3 sm:gap-4"
              >
                <Link to={LINKS.LOGIN} className="w-full sm:w-auto">
                  <Button
                    size="lg"
                    className="w-full sm:w-auto h-12 sm:h-14 px-6 sm:px-8 text-sm sm:text-base font-medium gap-2"
                  >
                    Try now — it's free
                    <CircleOpenArrowRight className="-rotate-45 size-4" />
                  </Button>
                </Link>
                <a
                  href={LINKS.SOCIALS.GITHUB}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full sm:w-auto"
                >
                  <Button
                    variant="outline"
                    size="lg"
                    className="w-full sm:w-auto h-12 sm:h-14 px-6 sm:px-8 text-sm sm:text-base font-medium gap-2 group"
                  >
                    <Star className="size-4 transition-colors group-hover:text-amber-500 group-hover:fill-amber-500" />
                    Star on GitHub
                  </Button>
                </a>
              </motion.div>

              {/* Trust Badges */}
              <div className="mt-8 sm:mt-10">
                <TrustBadges />
              </div>
            </div>

            {/* Right - Visual Elements */}
            <div className="relative">
              {/* Floating Elements Container */}
              <div className="relative h-[400px] sm:h-[450px] lg:h-[500px]">
                {/* Main Invoice Card */}
                <div className="absolute right-0 top-0 sm:right-4 lg:right-0">
                  <InvoicePreview />
                </div>

                {/* Metric Cards */}
                <div className="absolute left-0 top-1/3 sm:left-0 lg:-left-4">
                  <MetricCard
                    icon={<FileTextIcon className="size-4 text-primary" />}
                    label="Invoices Sent"
                    value="247"
                    trend="+12%"
                    trendUp={true}
                    delay={0.6}
                    className="w-[160px] sm:w-[180px]"
                  />
                </div>

                <div className="absolute right-4 bottom-1/4 sm:right-8 lg:right-4">
                  <MetricCard
                    icon={<UsersIcon className="size-4 text-primary" />}
                    label="Active Clients"
                    value="86"
                    delay={0.7}
                    className="w-[140px] sm:w-[160px]"
                  />
                </div>

                <div className="absolute left-8 bottom-8 sm:left-12 lg:left-8">
                  <MetricCard
                    icon={<BarChart3 className="size-4 text-primary" />}
                    label="Revenue"
                    value="RM 125K"
                    trend="+23%"
                    trendUp={true}
                    delay={0.8}
                    className="w-[150px] sm:w-[170px]"
                  />
                </div>

                {/* Decorative Elements */}
                <motion.div
                  initial={{ opacity: 0, scale: 0 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.5, delay: 1 }}
                  className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 size-32 sm:size-40 lg:size-48 rounded-full border border-primary/20 dark:border-primary/10"
                />
                <motion.div
                  initial={{ opacity: 0, scale: 0 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.5, delay: 1.1 }}
                  className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 size-48 sm:size-56 lg:size-64 rounded-full border border-primary/10 dark:border-primary/5"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Scroll Indicator - Mobile Only */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.5 }}
        className="absolute bottom-8 left-1/2 -translate-x-1/2 lg:hidden"
      >
        <motion.div
          animate={{ y: [0, 8, 0] }}
          transition={{ duration: 1.5, repeat: Infinity }}
          className="flex flex-col items-center gap-2 text-muted-foreground"
        >
          <span className="text-xs">Scroll to explore</span>
          <div className="w-5 h-8 rounded-full border-2 border-muted-foreground/30 flex justify-center pt-1">
            <motion.div
              animate={{ y: [0, 8, 0] }}
              transition={{ duration: 1.5, repeat: Infinity }}
              className="w-1 h-2 rounded-full bg-muted-foreground/50"
            />
          </div>
        </motion.div>
      </motion.div>
    </section>
  );
};

export default Hero;
