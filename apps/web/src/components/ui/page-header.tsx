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
    <div className={cn("flex items-center justify-between", className)}>
      <div className="flex items-center gap-3">
        {Icon && (
          <div className="p-2 rounded-none bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20">
            <Icon className="size-6 text-primary" />
          </div>
        )}
        <div>
          <h1 className="instrument-serif text-2xl font-semibold">{title}</h1>
          {description && (
            <p className="text-muted-foreground text-sm">{description}</p>
          )}
        </div>
      </div>
      {action}
    </div>
  );
}
