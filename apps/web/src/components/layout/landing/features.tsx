import { motion } from "motion/react";
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

interface FeatureCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  index: number;
  className?: string;
  accentColor: string;
}

const FeatureCard = ({
  icon,
  title,
  description,
  index,
  className,
  accentColor,
}: FeatureCardProps) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.5,
        delay: index * 0.05,
        ease: [0.25, 0.4, 0.25, 1],
      }}
      className={cn(
        "group relative p-6 md:p-8 transition-all duration-500",
        "hover:bg-gradient-to-br hover:from-muted/50 hover:to-transparent",
        className
      )}
    >
      {/* Hover glow effect */}
      <div
        className={cn(
          "absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none",
          "bg-gradient-to-br from-transparent via-transparent to-transparent"
        )}
        style={{
          background: `radial-gradient(circle at 30% 30%, ${accentColor}08 0%, transparent 60%)`,
        }}
      />

      {/* Icon with animation */}
      <div className="relative mb-5">
        <motion.div
          className={cn(
            "inline-flex items-center justify-center size-10 rounded-xl transition-all duration-500",
            "bg-muted/50 group-hover:bg-gradient-to-br group-hover:shadow-lg",
          )}
          style={{
            ['--tw-shadow-color' as string]: `${accentColor}20`,
          }}
          whileHover={{ scale: 1.05 }}
          transition={{ duration: 0.2 }}
        >
          <div className="text-muted-foreground group-hover:text-foreground transition-colors duration-300">
            {icon}
          </div>
        </motion.div>
      </div>

      {/* Title */}
      <h3 className="text-foreground font-medium text-base mb-2.5 tracking-tight group-hover:text-foreground/90 transition-colors">
        {title}
      </h3>

      {/* Description */}
      <p className="text-muted-foreground text-sm leading-relaxed group-hover:text-muted-foreground/80 transition-colors">
        {description}
      </p>

      {/* Corner accent on hover */}
      <div
        className="absolute bottom-0 right-0 w-20 h-20 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
        style={{
          background: `radial-gradient(circle at 100% 100%, ${accentColor}06 0%, transparent 70%)`,
        }}
      />
    </motion.div>
  );
};

const features = [
  {
    icon: <ReceiptIcon className="size-5" />,
    title: "Beautiful Invoices",
    description:
      "Create professional invoices in seconds. Multiple templates, custom branding, instant PDF export.",
    accentColor: "#3b82f6", // blue
  },
  {
    icon: <FileFeatherIcon className="size-5" />,
    title: "Quotations",
    description:
      "SendIcon quotes, track acceptance, convert to invoices with one click.",
    accentColor: "#8b5cf6", // violet
  },
  {
    icon: <TruckIcon className="size-5" />,
    title: "Bills & Expenses",
    description:
      "Track what you owe. Manage vendor bills, never miss a payment.",
    accentColor: "#f97316", // orange
  },
  {
    icon: <UsersIcon className="size-5" />,
    title: "Contacts",
    description:
      "Customers and vendors in one place. Full transaction history.",
    accentColor: "#06b6d4", // cyan
  },
  {
    icon: <BookOpenIcon className="size-5" />,
    title: "Chart of Accounts",
    description:
      "Customizable accounts structure. Assets, liabilities, equity, revenue.",
    accentColor: "#10b981", // emerald
  },
  {
    icon: <OpenLedgerIcon className="size-5" />,
    title: "General Ledger",
    description:
      "Double-entry bookkeeping. Every transaction properly recorded.",
    accentColor: "#6366f1", // indigo
  },
  {
    icon: <GaugeIcon className="size-5" />,
    title: "Financial Reports",
    description:
      "Trial balance, P&L, balance sheet. Real-time, always accurate.",
    accentColor: "#ec4899", // pink
  },
  {
    icon: <SquareWandSparkleIcon className="size-5" />,
    title: "AI Assistant",
    description:
      "Natural language commands. Create invoices, query data, get insights.",
    accentColor: "#a855f7", // purple
  },
];

const Features = () => {
  return (
    <section className="relative py-24 md:py-32 overflow-hidden">
      {/* Subtle background decoration */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-6xl h-px bg-gradient-to-r from-transparent via-border/50 to-transparent" />
      </div>

      {/* Section Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.25, 0.4, 0.25, 1] }}
        className="text-center mb-16 md:mb-20 px-6"
      >
        <span className="inline-block text-xs tracking-[0.25em] uppercase text-muted-foreground mb-4 font-medium">
          Features
        </span>
        <h2 className="instrument-serif text-3xl md:text-4xl lg:text-5xl tracking-tight">
          Everything you need
        </h2>
        <p className="mt-4 text-muted-foreground text-lg max-w-md mx-auto">
          Professional tools, beautifully simple
        </p>
      </motion.div>

      {/* Features Grid */}
      <div className="max-w-6xl mx-auto px-6">
        <div className="relative">
          {/* Grid lines decoration */}
          <div className="absolute inset-0 pointer-events-none">
            {/* Horizontal lines */}
            <div className="absolute top-0 left-0 right-0 h-px bg-border/40" />
            <div className="absolute top-1/2 left-0 right-0 h-px bg-border/40 hidden lg:block" />
            <div className="absolute bottom-0 left-0 right-0 h-px bg-border/40" />
            {/* Vertical lines */}
            <div className="absolute top-0 bottom-0 left-0 w-px bg-border/40" />
            <div className="absolute top-0 bottom-0 left-1/2 w-px bg-border/40 hidden sm:block" />
            <div className="absolute top-0 bottom-0 left-1/4 w-px bg-border/40 hidden lg:block" />
            <div className="absolute top-0 bottom-0 left-3/4 w-px bg-border/40 hidden lg:block" />
            <div className="absolute top-0 bottom-0 right-0 w-px bg-border/40" />
          </div>

          {/* Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 relative">
            {features.map((feature, index) => (
              <FeatureCard
                key={feature.title}
                icon={feature.icon}
                title={feature.title}
                description={feature.description}
                index={index}
                accentColor={feature.accentColor}
                className={cn(
                  // Add bottom border for all except last row
                  index < 4 && "lg:border-b lg:border-border/40",
                  index < 6 && "sm:border-b sm:border-border/40 lg:border-b-0",
                  index < 7 && "border-b border-border/40 sm:border-b-0",
                  // Add right border for grid effect
                  "sm:border-r sm:border-border/40 sm:last:border-r-0",
                  "lg:border-r lg:border-border/40",
                  // Remove right border from last column
                  (index + 1) % 4 === 0 && "lg:border-r-0",
                  (index + 1) % 2 === 0 && "sm:border-r-0 lg:border-r lg:border-border/40",
                  index === 7 && "lg:border-r-0",
                )}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default Features;
