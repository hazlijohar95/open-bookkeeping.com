import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { zodResolver as originalZodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import type { Resolver } from "react-hook-form";

// Zod v4 compatible zodResolver wrapper
// @hookform/resolvers is typed for Zod v3, this bypasses the type incompatibility
 
export function zodResolver<T extends z.ZodType<any, any, any>>(
  schema: T,
  schemaOptions?: Parameters<typeof originalZodResolver>[1],
  resolverOptions?: Parameters<typeof originalZodResolver>[2]
   
): Resolver<any> {
   
  return originalZodResolver(schema as any, schemaOptions, resolverOptions);
}

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Shared formatting utilities - used across dashboard, invoices, statements, etc.
export const formatCurrency = (value: number, currency: string = "MYR") => {
  return new Intl.NumberFormat("en-MY", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

export const formatCurrencyWithDecimals = (value: number, currency: string = "MYR") => {
  return new Intl.NumberFormat("en-MY", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(value);
};

export const formatDate = (date: Date | string) => {
  return new Date(date).toLocaleDateString("en-MY", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

export const formatDateFull = (date: Date | string) => {
  return new Date(date).toLocaleDateString("en-MY", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
};

// Avatar utilities
export const getInitials = (name: string): string => {
  return name
    .split(" ")
    .map((word) => word[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
};

export const getAvatarColor = (name: string): string => {
  // Use design system semantic colors for consistent theming
  const colors = [
    "bg-primary/10 text-primary",
    "bg-info/10 text-info",
    "bg-success/10 text-success",
    "bg-warning/10 text-warning-foreground dark:text-warning",
    "bg-destructive/10 text-destructive",
    "bg-primary/20 text-primary",
    "bg-info/20 text-info",
  ];
  const index = name.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return colors[index % colors.length] ?? "bg-muted text-muted-foreground";
};
