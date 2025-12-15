import { motion, useInView } from "motion/react";
import { useRef } from "react";
import {
  ReceiptIcon,
  FileFeatherIcon,
  TruckIcon,
  UsersIcon,
  BookOpenIcon,
  OpenLedgerIcon,
  GaugeIcon,
  SquareWandSparkleIcon,
} from "@/assets/icons";
import { cn } from "@/lib/utils";

// ============================================================================
// TYPES
// ============================================================================

interface FeatureCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  index: number;
  accentColor: string;
}

// ============================================================================
// FEATURE CARD - Mobile-optimized with touch feedback
// ============================================================================

const FeatureCard = ({
  icon,
  title,
  description,
  index,
  accentColor,
}: FeatureCardProps) => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-50px" });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 30 }}
      animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
      transition={{
        duration: 0.5,
        delay: index * 0.05,
        ease: [0.25, 0.4, 0.25, 1],
      }}
      className={cn(
        "group relative p-5 sm:p-6 md:p-8",
        "bg-card/30 hover:bg-card/60",
        "border border-border/30 hover:border-border/50",
        "rounded-2xl sm:rounded-xl",
        "transition-all duration-300 ease-out",
        "active:scale-[0.98] sm:active:scale-100", // Touch feedback on mobile
        "cursor-default"
      )}
    >
      {/* Hover/Active glow effect */}
      <div
        className={cn(
          "absolute inset-0 rounded-2xl sm:rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
        )}
        style={{
          background: `radial-gradient(circle at 30% 30%, ${accentColor}10 0%, transparent 60%)`,
        }}
      />

      {/* Icon */}
      <div className="relative mb-4 sm:mb-5">
        <motion.div
          className={cn(
            "inline-flex items-center justify-center size-12 sm:size-11 rounded-xl sm:rounded-lg",
            "bg-muted/50 group-hover:bg-muted transition-colors duration-300"
          )}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <div
            className="text-muted-foreground group-hover:text-foreground transition-colors duration-300"
            style={{ color: accentColor }}
          >
            {icon}
          </div>
        </motion.div>
      </div>

      {/* Title */}
      <h3 className="text-foreground font-semibold text-base sm:text-[15px] mb-2 tracking-tight">
        {title}
      </h3>

      {/* Description */}
      <p className="text-muted-foreground text-sm leading-relaxed">
        {description}
      </p>
    </motion.div>
  );
};

// ============================================================================
// FEATURES DATA
// ============================================================================

const features = [
  {
    icon: <ReceiptIcon className="size-5 sm:size-[18px]" />,
    title: "Beautiful Invoices",
    description:
      "Create professional invoices in seconds. Multiple templates, custom branding, instant PDF.",
    accentColor: "#EE5F00", // Monk orange
  },
  {
    icon: <FileFeatherIcon className="size-5 sm:size-[18px]" />,
    title: "Quotations",
    description:
      "Send quotes, track acceptance, convert to invoices with one click.",
    accentColor: "#D95400", // Darker orange
  },
  {
    icon: <TruckIcon className="size-5 sm:size-[18px]" />,
    title: "Bills & Expenses",
    description:
      "Track what you owe. Manage vendor bills, never miss a payment.",
    accentColor: "#F97316", // Warm orange
  },
  {
    icon: <UsersIcon className="size-5 sm:size-[18px]" />,
    title: "Contacts",
    description:
      "Customers and vendors in one place. Full transaction history.",
    accentColor: "#EA580C", // Orange-red
  },
  {
    icon: <BookOpenIcon className="size-5 sm:size-[18px]" />,
    title: "Chart of Accounts",
    description:
      "Customizable accounts structure. Assets, liabilities, equity, revenue.",
    accentColor: "#C2410C", // Deep orange
  },
  {
    icon: <OpenLedgerIcon className="size-5 sm:size-[18px]" />,
    title: "General Ledger",
    description:
      "Double-entry bookkeeping. Every transaction properly recorded.",
    accentColor: "#EE5F00", // Monk orange
  },
  {
    icon: <GaugeIcon className="size-5 sm:size-[18px]" />,
    title: "Financial Reports",
    description:
      "Trial balance, P&L, balance sheet. Real-time, always accurate.",
    accentColor: "#FB923C", // Light orange
  },
  {
    icon: <SquareWandSparkleIcon className="size-5 sm:size-[18px]" />,
    title: "AI Assistant",
    description:
      "Natural language commands. Create invoices, query data, get insights.",
    accentColor: "#F59E0B", // Amber (AI warmth)
  },
];

// ============================================================================
// MAIN COMPONENT
// ============================================================================

const Features = () => {
  const headerRef = useRef(null);
  const isHeaderInView = useInView(headerRef, { once: true, margin: "-100px" });

  return (
    <section id="features" className="relative py-16 sm:py-24 md:py-32 overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-6xl h-px bg-gradient-to-r from-transparent via-border/50 to-transparent" />
      </div>

      {/* Section Header */}
      <motion.div
        ref={headerRef}
        initial={{ opacity: 0, y: 30 }}
        animate={isHeaderInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
        transition={{ duration: 0.6, ease: [0.25, 0.4, 0.25, 1] }}
        className="text-center mb-10 sm:mb-16 md:mb-20 px-4 sm:px-6"
      >
        <span className="inline-block text-[10px] sm:text-xs tracking-[0.2em] sm:tracking-[0.25em] uppercase text-muted-foreground mb-3 sm:mb-4 font-medium">
          Features
        </span>
        <h2 className="instrument-serif text-3xl sm:text-4xl lg:text-5xl tracking-tight">
          Everything you need
        </h2>
        <p className="mt-3 sm:mt-4 text-muted-foreground text-base sm:text-lg max-w-md mx-auto">
          Professional tools, beautifully simple
        </p>
      </motion.div>

      {/* Features Grid - Mobile optimized */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {features.map((feature, index) => (
            <FeatureCard
              key={feature.title}
              icon={feature.icon}
              title={feature.title}
              description={feature.description}
              index={index}
              accentColor={feature.accentColor}
            />
          ))}
        </div>
      </div>

      {/* Mobile scroll hint */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1 }}
        className="mt-8 text-center sm:hidden"
      >
        <p className="text-xs text-muted-foreground/60">
          Swipe up to see more
        </p>
      </motion.div>
    </section>
  );
};

export default Features;
