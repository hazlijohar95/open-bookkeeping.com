import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

import { cn } from "@/lib/utils";

const alertVariants = cva(
  "relative w-full rounded-none px-3 py-3 text-sm grid has-[>svg]:grid-cols-[calc(var(--spacing)*4)_1fr] grid-cols-[0_1fr] has-[>svg]:gap-x-3 gap-y-0.5 items-start [&>svg]:size-4 [&>svg]:translate-y-0.5 [&>svg]:text-current border-l-4",
  {
    variants: {
      variant: {
        default: "bg-primary/5 border-l-primary text-primary dark:bg-primary/10",
        destructive: "bg-destructive/5 border-l-destructive text-destructive dark:bg-destructive/10",
        warning: "bg-warning/5 border-l-warning text-warning-foreground dark:bg-warning/10 dark:text-warning",
        success: "bg-success/5 border-l-success text-success dark:bg-success/10",
        info: "bg-info/5 border-l-info text-info dark:bg-info/10",
        secondary: "bg-secondary/50 border-l-muted-foreground text-secondary-foreground dark:bg-secondary/30",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

function Alert({ className, variant, ...props }: React.ComponentProps<"div"> & VariantProps<typeof alertVariants>) {
  return <div data-slot="alert" role="alert" className={cn(alertVariants({ variant }), className)} {...props} />;
}

function AlertTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-title"
      className={cn("col-start-2 line-clamp-1 min-h-4 text-sm font-medium tracking-tight", className)}
      {...props}
    />
  );
}

function AlertButtonGroup({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="alert-button-group" className={cn("mt-1 flex flex-row gap-2", className)} {...props} />;
}

function AlertDescription({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-description"
      className={cn(
        "text-muted-foreground col-start-2 grid justify-items-start gap-1 text-xs [&_p]:leading-relaxed",
        className,
      )}
      {...props}
    />
  );
}

export { Alert, AlertTitle, AlertDescription, AlertButtonGroup };
