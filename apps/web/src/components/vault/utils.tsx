import { cn } from "@/lib/utils";
import {
  ImageSparkleIcon,
  FileFeatherIcon,
  ReceiptIcon,
  BoxIcon,
} from "@/assets/icons";
import {
  Loader2Icon,
  AlertCircleIcon,
  CheckCircle2Icon,
  ClockIcon,
  Brain,
  TrendingUp,
  TrendingDown,
  ChevronRightIcon,
} from "@/components/ui/icons";
import type { ProcessingStatus } from "@/types/common/vault";

/**
 * Format file size from bytes to human readable
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

/**
 * Get appropriate file icon based on mime type
 */
export function getFileIcon(mimeType: string, className = "size-8") {
  if (mimeType.startsWith("image/")) return <ImageSparkleIcon className={cn(className, "text-info")} />;
  if (mimeType === "application/pdf") return <FileFeatherIcon className={cn(className, "text-destructive")} />;
  if (mimeType.includes("word")) return <FileFeatherIcon className={cn(className, "text-primary")} />;
  if (mimeType.includes("excel") || mimeType.includes("spreadsheet"))
    return <ReceiptIcon className={cn(className, "text-success")} />;
  return <BoxIcon className={cn(className, "text-muted-foreground")} />;
}

/**
 * Get human readable document type label
 */
export function getDocumentTypeLabel(type: string) {
  switch (type) {
    case "bank_statement":
      return "Bank Statement";
    case "receipt":
      return "Receipt";
    case "invoice":
      return "Invoice";
    case "bill":
      return "Bill";
    default:
      return "Document";
  }
}

/**
 * Confidence ring indicator for AI extraction
 */
export function ConfidenceRing({ confidence, size = 48 }: { confidence: number; size?: number }) {
  const strokeWidth = 3;
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (confidence * circumference);

  const getColor = () => {
    if (confidence >= 0.9) return "stroke-success";
    if (confidence >= 0.7) return "stroke-warning";
    return "stroke-destructive";
  };

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg className="transform -rotate-90" width={size} height={size}>
        <circle
          className="stroke-muted"
          strokeWidth={strokeWidth}
          fill="none"
          r={radius}
          cx={size / 2}
          cy={size / 2}
        />
        <circle
          className={cn("transition-all duration-1000 ease-out", getColor())}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          fill="none"
          r={radius}
          cx={size / 2}
          cy={size / 2}
          style={{
            strokeDasharray: circumference,
            strokeDashoffset: offset,
          }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-xs font-semibold tabular-nums">{Math.round(confidence * 100)}%</span>
      </div>
    </div>
  );
}

/**
 * Processing status indicator badge
 */
export function ProcessingStatusIndicator({ status, className }: { status: ProcessingStatus; className?: string }) {
  switch (status) {
    case "unprocessed":
      return (
        <div className={cn("flex items-center gap-1.5 text-muted-foreground", className)}>
          <div className="size-2 rounded-full bg-muted-foreground/50" />
          <span className="text-xs">Not processed</span>
        </div>
      );
    case "queued":
      return (
        <div className={cn("flex items-center gap-1.5 text-warning", className)}>
          <ClockIcon className="size-3.5 animate-pulse" />
          <span className="text-xs font-medium">Queued</span>
        </div>
      );
    case "processing":
      return (
        <div className={cn("flex items-center gap-1.5 text-primary", className)}>
          <div className="relative">
            <Brain className="size-3.5 animate-pulse" />
            <span className="absolute -top-0.5 -right-0.5 size-1.5 bg-primary rounded-full animate-ping" />
          </div>
          <span className="text-xs font-medium">AI Processing...</span>
        </div>
      );
    case "processed":
      return (
        <div className={cn("flex items-center gap-1.5 text-success", className)}>
          <CheckCircle2Icon className="size-3.5" />
          <span className="text-xs font-medium">Processed</span>
        </div>
      );
    case "failed":
      return (
        <div className={cn("flex items-center gap-1.5 text-destructive", className)}>
          <AlertCircleIcon className="size-3.5" />
          <span className="text-xs font-medium">Failed</span>
        </div>
      );
  }
}

/**
 * Data card for displaying extracted values
 */
export function DataCard({ label, value, icon, trend }: { label: string; value: string; icon?: React.ReactNode; trend?: "up" | "down" }) {
  return (
    <div className="bg-gradient-to-br from-muted/50 to-muted/30 rounded-xl p-4 border border-border/50 hover:border-border transition-colors">
      <div className="flex items-start justify-between">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
        {icon}
      </div>
      <div className="mt-2 flex items-baseline gap-2">
        <p className="text-lg font-semibold">{value}</p>
        {trend && (
          trend === "up"
            ? <TrendingUp className="size-4 text-success" />
            : <TrendingDown className="size-4 text-destructive" />
        )}
      </div>
    </div>
  );
}

/**
 * Action button with icon and loading state
 */
export function ActionButton({ onClick, icon, label, variant = "default", disabled, loading }: {
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  variant?: "default" | "primary" | "success";
  disabled?: boolean;
  loading?: boolean;
}) {
  const variants = {
    default: "bg-muted hover:bg-muted/80 text-foreground",
    primary: "bg-primary hover:bg-primary/90 text-primary-foreground",
    success: "bg-success hover:bg-success/90 text-success-foreground",
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      className={cn(
        "flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium text-sm transition-all",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        "active:scale-[0.98]",
        variants[variant]
      )}
    >
      {loading ? <Loader2Icon className="size-4 animate-spin" /> : icon}
      <span>{label}</span>
      {!loading && <ChevronRightIcon className="size-4 opacity-50" />}
    </button>
  );
}
