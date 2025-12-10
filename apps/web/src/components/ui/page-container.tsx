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
  if (noAnimation) {
    return (
      <div className={cn("flex flex-col gap-6 p-6", className)}>
        {children}
      </div>
    );
  }

  return (
    <motion.div
      className={cn("flex flex-col gap-6 p-6", className)}
      initial={motionVariants.pageEnter.initial}
      animate={motionVariants.pageEnter.animate}
      transition={motionVariants.pageEnter.transition}
    >
      {children}
    </motion.div>
  );
}
