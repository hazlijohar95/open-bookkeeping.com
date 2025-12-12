import * as React from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { motionVariants } from "@/lib/design-tokens";

interface PageContainerProps {
  children: React.ReactNode;
  className?: string;
  /** Disable entrance animation */
  noAnimation?: boolean;
}

export function PageContainer({ children, className, noAnimation = false }: PageContainerProps) {
  const containerClasses = cn(
    "flex flex-col",
    // Responsive padding: smaller on mobile, larger on desktop
    "px-4 py-4 gap-4",
    "sm:px-6 sm:py-6 sm:gap-6",
    className
  );

  if (noAnimation) {
    return (
      <div className={containerClasses}>
        {children}
      </div>
    );
  }

  return (
    <motion.div
      className={containerClasses}
      initial={motionVariants.pageEnter.initial}
      animate={motionVariants.pageEnter.animate}
      transition={motionVariants.pageEnter.transition}
    >
      {children}
    </motion.div>
  );
}
