"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";

interface DashboardGreetingProps {
  userName: string;
  className?: string;
}

function getTimeOfDay(): "Morning" | "Afternoon" | "Evening" | "Night" {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return "Morning";
  if (hour >= 12 && hour < 17) return "Afternoon";
  if (hour >= 17 && hour < 21) return "Evening";
  return "Night";
}

export function DashboardGreeting({ userName, className }: DashboardGreetingProps) {
  const timeOfDay = useMemo(() => getTimeOfDay(), []);
  const firstName = userName.split(" ")[0] || "there";

  return (
    <div className={cn("flex flex-col", className)}>
      <h1 className="flex items-baseline gap-2 text-2xl md:text-3xl">
        <span className="instrument-serif italic text-muted-foreground">
          {timeOfDay}
        </span>
        <span className="instrument-serif font-normal">
          {firstName},
        </span>
      </h1>
      <p className="urbanist text-sm text-muted-foreground mt-1">
        here's a quick look at how things are going.
      </p>
    </div>
  );
}
