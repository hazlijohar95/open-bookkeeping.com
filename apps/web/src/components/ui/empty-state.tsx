import * as React from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { type IconProps } from "@/types";
import { motionVariants } from "@/lib/design-tokens";

type CustomIconComponent = React.ComponentType<IconProps>;

interface EmptyStateProps {
  icon: CustomIconComponent;
  title: string;
  description: string;
  action?: React.ReactNode;
  className?: string;
  /** Size variant */
  size?: "sm" | "md" | "lg";
  /** Animate on mount */
  animate?: boolean;
}

const sizeConfig = {
  sm: {
    container: "py-8",
    iconWrapper: "size-12",
    icon: "size-5",
    title: "text-base font-medium",
    description: "text-sm max-w-xs mb-4",
  },
  md: {
    container: "py-12",
    iconWrapper: "size-16",
    icon: "size-8",
    title: "text-lg font-semibold",
    description: "text-sm max-w-sm mb-6",
  },
  lg: {
    container: "py-16",
    iconWrapper: "size-20",
    icon: "size-10",
    title: "text-xl font-semibold",
    description: "text-base max-w-md mb-8",
  },
};

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
  size = "md",
  animate = true,
}: EmptyStateProps) {
  const config = sizeConfig[size];

  const content = (
    <>
      <div className={cn(
        "mb-4 flex items-center justify-center rounded-none bg-muted transition-colors duration-200",
        config.iconWrapper
      )}>
        <Icon className={cn("text-muted-foreground", config.icon)} />
      </div>
      <h3 className={cn("mb-2 tracking-tight", config.title)}>{title}</h3>
      <p className={cn("text-muted-foreground text-center", config.description)}>{description}</p>
      {action}
    </>
  );

  if (animate) {
    return (
      <motion.div
        className={cn("flex flex-col items-center justify-center text-center", config.container, className)}
        initial={motionVariants.fadeIn.initial}
        animate={motionVariants.fadeIn.animate}
        transition={motionVariants.fadeIn.transition}
      >
        {content}
      </motion.div>
    );
  }

  return (
    <div className={cn("flex flex-col items-center justify-center text-center", config.container, className)}>
      {content}
    </div>
  );
}

// Compact inline variant for use inside cards/sections
export function EmptyStateInline({
  icon: Icon,
  message,
  action,
  className,
}: {
  icon: CustomIconComponent;
  message: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-3 py-4 px-4 rounded-none bg-muted/50", className)}>
      <Icon className="size-5 text-muted-foreground shrink-0" />
      <span className="text-sm text-muted-foreground flex-1">{message}</span>
      {action}
    </div>
  );
}
