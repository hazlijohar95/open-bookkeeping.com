import * as React from "react";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: string;
  description?: string;
  icon?: React.ComponentType<{ className?: string }>;
  action?: React.ReactNode;
  className?: string;
}

export function PageHeader({ title, description, icon: Icon, action, className }: PageHeaderProps) {
  return (
    <div
      className={cn(
        // Stack on mobile, row on desktop
        "flex flex-col gap-3",
        "sm:flex-row sm:items-center sm:justify-between",
        className
      )}
    >
      <div className="flex items-center gap-3">
        {Icon && (
          <div className="p-2 rounded-lg bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20">
            <Icon className="size-5 sm:size-6 text-primary" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <h1 className="instrument-serif text-xl sm:text-2xl font-semibold truncate">
            {title}
          </h1>
          {description && (
            <p className="text-muted-foreground text-xs sm:text-sm line-clamp-1">
              {description}
            </p>
          )}
        </div>
      </div>

      {/* Action button - full width on mobile */}
      {action && (
        <div className="flex-shrink-0 [&>a]:w-full [&>a>button]:w-full sm:[&>a]:w-auto sm:[&>a>button]:w-auto">
          {action}
        </div>
      )}
    </div>
  );
}
