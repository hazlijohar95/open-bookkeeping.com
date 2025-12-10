import { memo, useEffect, useState } from "react";
import { cn } from "@/lib/utils";

export type ComplianceStatus = "below" | "voluntary" | "approaching" | "exceeded" | "registered";

interface ComplianceProgressProps {
  percent: number;
  status: ComplianceStatus;
  className?: string;
  showPulse?: boolean;
  size?: "sm" | "md" | "lg";
}

const getProgressColor = (status: ComplianceStatus, percent: number) => {
  if (status === "registered") {
    return "bg-success";
  }
  if (percent >= 100) {
    return "bg-destructive";
  }
  if (percent >= 80) {
    return "bg-warning";
  }
  if (percent >= 50) {
    return "bg-info";
  }
  return "bg-success";
};

const getProgressGlow = (status: ComplianceStatus, percent: number) => {
  if (status === "registered") {
    return "shadow-success/30";
  }
  if (percent >= 100) {
    return "shadow-destructive/40";
  }
  if (percent >= 80) {
    return "shadow-warning/40";
  }
  return "";
};

export const ComplianceProgress = memo(function ComplianceProgress({
  percent,
  status,
  className,
  showPulse = true,
  size = "md",
}: ComplianceProgressProps) {
  const [animatedPercent, setAnimatedPercent] = useState(0);

  // Animate on mount
  useEffect(() => {
    const timer = setTimeout(() => {
      setAnimatedPercent(Math.min(percent, 100));
    }, 100);
    return () => clearTimeout(timer);
  }, [percent]);

  const heightClass = {
    sm: "h-1.5",
    md: "h-2.5",
    lg: "h-4",
  }[size];

  const progressColor = getProgressColor(status, percent);
  const glowEffect = getProgressGlow(status, percent);
  const shouldPulse = showPulse && percent >= 80 && status !== "registered";

  return (
    <div className={cn("relative w-full", className)}>
      {/* Background track */}
      <div
        className={cn(
          "w-full overflow-hidden rounded-full bg-muted",
          heightClass
        )}
      >
        {/* Progress fill */}
        <div
          className={cn(
            "h-full rounded-full transition-all duration-1000 ease-out",
            progressColor,
            shouldPulse && "animate-pulse",
            glowEffect && `shadow-lg ${glowEffect}`
          )}
          style={{ width: `${animatedPercent}%` }}
        />
      </div>

      {/* Threshold marker at 100% */}
      {percent < 100 && (
        <div
          className="absolute top-0 h-full w-0.5 bg-muted-foreground/30"
          style={{ left: "100%" }}
        />
      )}
    </div>
  );
});

// Status badge component
interface ComplianceStatusBadgeProps {
  status: ComplianceStatus;
  className?: string;
}

const statusConfig: Record<ComplianceStatus, { label: string; className: string }> = {
  below: {
    label: "Below Threshold",
    className: "bg-success/10 text-success",
  },
  voluntary: {
    label: "Voluntary Registration",
    className: "bg-info/10 text-info",
  },
  approaching: {
    label: "Approaching Threshold",
    className: "bg-warning/10 text-warning-foreground dark:text-warning",
  },
  exceeded: {
    label: "Registration Required",
    className: "bg-destructive/10 text-destructive",
  },
  registered: {
    label: "Registered",
    className: "bg-success/10 text-success",
  },
};

export const ComplianceStatusBadge = memo(function ComplianceStatusBadge({
  status,
  className,
}: ComplianceStatusBadgeProps) {
  const config = statusConfig[status];

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        config.className,
        className
      )}
    >
      {config.label}
    </span>
  );
});

// Status message helper
export const getComplianceMessage = (status: ComplianceStatus, _percent?: number): string => {
  switch (status) {
    case "registered":
      return "You are registered for SST";
    case "exceeded":
      return "You have exceeded the threshold and must register for SST";
    case "approaching":
      return "You are approaching the threshold - consider registering soon";
    case "voluntary":
      return "You can voluntarily register with Customs now";
    case "below":
    default:
      return "You are below the SST registration threshold";
  }
};

export const getComplianceMessageShort = (status: ComplianceStatus): string => {
  switch (status) {
    case "registered":
      return "SST Registered";
    case "exceeded":
      return "Must register for SST";
    case "approaching":
      return "Consider registering";
    case "voluntary":
      return "Can register voluntarily";
    case "below":
    default:
      return "Below threshold";
  }
};
