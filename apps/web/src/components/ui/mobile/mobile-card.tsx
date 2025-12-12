"use client";

import * as React from "react";
import { motion, useMotionValue, useTransform, type PanInfo } from "motion/react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ChevronRightIcon } from "@/components/ui/icons";

// ============================================================================
// TYPES
// ============================================================================

export interface SwipeAction {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  color: "destructive" | "success" | "primary" | "warning";
  onAction: () => void;
}

export interface MobileCardProps {
  // Content
  title: string;
  subtitle?: string;
  meta?: string;

  // Right side content
  amount?: {
    value: number;
    currency?: string;
    prefix?: string;
  };
  status?: {
    label: string;
    variant: "default" | "success" | "warning" | "destructive" | "secondary";
  };

  // Avatar
  avatar?: {
    name: string;
    image?: string;
  };

  // Interactions
  onTap?: () => void;
  leftActions?: SwipeAction[]; // Swipe right to reveal
  rightActions?: SwipeAction[]; // Swipe left to reveal

  // Styling
  className?: string;
  showChevron?: boolean;
  isLoading?: boolean;
  children?: React.ReactNode;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const SWIPE_THRESHOLD = 80; // pixels to trigger action
const SWIPE_VELOCITY_THRESHOLD = 500; // px/s
const ACTION_WIDTH = 80; // width of each action button

const colorMap = {
  destructive: "bg-destructive",
  success: "bg-success",
  primary: "bg-primary",
  warning: "bg-warning",
};

// ============================================================================
// COMPONENT
// ============================================================================

export function MobileCard({
  title,
  subtitle,
  meta,
  amount,
  status,
  avatar,
  onTap,
  leftActions = [],
  rightActions = [],
  className,
  showChevron = true,
  isLoading = false,
  children,
}: MobileCardProps) {
  const x = useMotionValue(0);
  const [isRevealed, setIsRevealed] = React.useState<"left" | "right" | null>(null);

  // Transform for background action visibility
  const leftActionsWidth = leftActions.length * ACTION_WIDTH;
  const rightActionsWidth = rightActions.length * ACTION_WIDTH;

  const leftOpacity = useTransform(x, [0, leftActionsWidth], [0, 1]);
  const rightOpacity = useTransform(x, [-rightActionsWidth, 0], [1, 0]);

  // Format currency
  const formatAmount = (value: number, currency = "MYR") => {
    return new Intl.NumberFormat("en-MY", {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
    }).format(value);
  };

  // Handle pan end
  const handlePanEnd = (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    const velocity = info.velocity.x;
    const offset = info.offset.x;

    // Fast swipe triggers action immediately
    if (Math.abs(velocity) > SWIPE_VELOCITY_THRESHOLD) {
      if (velocity > 0 && leftActions.length > 0) {
        leftActions[0]?.onAction();
        x.set(0);
        return;
      }
      if (velocity < 0 && rightActions.length > 0) {
        rightActions[0]?.onAction();
        x.set(0);
        return;
      }
    }

    // Slow swipe reveals actions
    if (offset > SWIPE_THRESHOLD && leftActions.length > 0) {
      setIsRevealed("left");
      x.set(leftActionsWidth);
    } else if (offset < -SWIPE_THRESHOLD && rightActions.length > 0) {
      setIsRevealed("right");
      x.set(-rightActionsWidth);
    } else {
      setIsRevealed(null);
      x.set(0);
    }
  };

  // Close revealed actions on tap outside
  const handleTap = () => {
    if (isRevealed) {
      setIsRevealed(null);
      x.set(0);
    } else {
      onTap?.();
    }
  };

  if (isLoading) {
    return <MobileCardSkeleton />;
  }

  return (
    <div className={cn("relative overflow-hidden", className)}>
      {/* Left Actions (revealed on swipe right) */}
      {leftActions.length > 0 && (
        <motion.div
          className="absolute inset-y-0 left-0 flex"
          style={{ opacity: leftOpacity }}
        >
          {leftActions.map((action, index) => (
            <button
              key={index}
              onClick={action.onAction}
              className={cn(
                "flex flex-col items-center justify-center text-white",
                colorMap[action.color]
              )}
              style={{ width: ACTION_WIDTH }}
            >
              <action.icon className="size-5 mb-1" />
              <span className="text-xs font-medium">{action.label}</span>
            </button>
          ))}
        </motion.div>
      )}

      {/* Right Actions (revealed on swipe left) */}
      {rightActions.length > 0 && (
        <motion.div
          className="absolute inset-y-0 right-0 flex"
          style={{ opacity: rightOpacity }}
        >
          {rightActions.map((action, index) => (
            <button
              key={index}
              onClick={action.onAction}
              className={cn(
                "flex flex-col items-center justify-center text-white",
                colorMap[action.color]
              )}
              style={{ width: ACTION_WIDTH }}
            >
              <action.icon className="size-5 mb-1" />
              <span className="text-xs font-medium">{action.label}</span>
            </button>
          ))}
        </motion.div>
      )}

      {/* Main Card Content */}
      <motion.div
        className={cn(
          "relative flex items-center gap-3 bg-card p-4 border-b",
          "active:bg-accent/50 transition-colors",
          "touch-pan-y no-select"
        )}
        style={{ x }}
        drag="x"
        dragConstraints={{
          left: rightActions.length > 0 ? -rightActionsWidth : 0,
          right: leftActions.length > 0 ? leftActionsWidth : 0,
        }}
        dragElastic={0.1}
        onDragEnd={handlePanEnd}
        onTap={handleTap}
        whileTap={{
          scale: leftActions.length === 0 && rightActions.length === 0 ? 0.98 : 1,
        }}
      >
        {/* Avatar */}
        {avatar && (
          <Avatar className="size-10 shrink-0">
            <AvatarImage src={avatar.image} alt={avatar.name} />
            <AvatarFallback className="text-sm font-medium">
              {avatar.name
                .split(" ")
                .map((n) => n[0])
                .join("")
                .slice(0, 2)}
            </AvatarFallback>
          </Avatar>
        )}

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p className="font-medium text-sm leading-tight truncate">{title}</p>
              {subtitle && (
                <p className="text-xs text-muted-foreground truncate mt-0.5">
                  {subtitle}
                </p>
              )}
            </div>

            {/* Amount */}
            {amount && (
              <p className="text-sm font-semibold tabular-nums shrink-0">
                {amount.prefix}
                {formatAmount(amount.value, amount.currency)}
              </p>
            )}
          </div>

          {/* Bottom row */}
          <div className="flex items-center justify-between mt-1.5">
            {meta && <p className="text-xs text-muted-foreground">{meta}</p>}
            {status && (
              <Badge variant={status.variant} className="text-[10px] h-5">
                {status.label}
              </Badge>
            )}
          </div>

          {/* Custom children */}
          {children}
        </div>

        {/* Chevron */}
        {showChevron && onTap && !leftActions.length && !rightActions.length && (
          <ChevronRightIcon className="size-4 text-muted-foreground shrink-0" />
        )}
      </motion.div>
    </div>
  );
}

// ============================================================================
// SKELETON
// ============================================================================

export function MobileCardSkeleton() {
  return (
    <div className="flex items-center gap-3 p-4 border-b animate-pulse">
      <div className="size-10 rounded-full bg-muted" />
      <div className="flex-1 space-y-2">
        <div className="h-4 bg-muted rounded w-3/4" />
        <div className="h-3 bg-muted rounded w-1/2" />
      </div>
      <div className="h-4 bg-muted rounded w-20" />
    </div>
  );
}

// ============================================================================
// MOBILE LIST
// ============================================================================

interface MobileListProps<T> {
  items: T[];
  renderItem: (item: T, index: number) => React.ReactNode;
  keyExtractor: (item: T, index: number) => string;
  isLoading?: boolean;
  emptyState?: React.ReactNode;
  className?: string;
}

export function MobileList<T>({
  items,
  renderItem,
  keyExtractor,
  isLoading = false,
  emptyState,
  className,
}: MobileListProps<T>) {
  if (isLoading) {
    return (
      <div className={cn("border rounded-md overflow-hidden", className)}>
        {Array.from({ length: 5 }).map((_, i) => (
          <MobileCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (items.length === 0 && emptyState) {
    return <>{emptyState}</>;
  }

  return (
    <motion.div
      className={cn("border rounded-md overflow-hidden", className)}
      initial="hidden"
      animate="visible"
      variants={{
        visible: { transition: { staggerChildren: 0.05 } },
      }}
    >
      {items.map((item, index) => (
        <motion.div
          key={keyExtractor(item, index)}
          variants={{
            hidden: { opacity: 0, y: 20 },
            visible: { opacity: 1, y: 0 },
          }}
        >
          {renderItem(item, index)}
        </motion.div>
      ))}
    </motion.div>
  );
}
