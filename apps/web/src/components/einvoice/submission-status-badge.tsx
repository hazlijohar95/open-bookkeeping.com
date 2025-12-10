import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  CircleCheckIcon,
  HourglassStartIcon,
  TriangleWarningIcon,
  FileBanIcon,
  SyncIcon,
} from "@/assets/icons";
import { cn } from "@/lib/utils";

export type EInvoiceStatus =
  | "pending"
  | "submitted"
  | "valid"
  | "invalid"
  | "cancelled"
  | null
  | undefined;

interface SubmissionStatusBadgeProps {
  status: EInvoiceStatus;
  className?: string;
  showTooltip?: boolean;
}

const statusConfig: Record<
  NonNullable<EInvoiceStatus>,
  {
    label: string;
    variant: "default" | "secondary" | "destructive" | "outline";
    icon: React.ComponentType<{ className?: string }>;
    description: string;
  }
> = {
  pending: {
    label: "Pending",
    variant: "secondary",
    icon: HourglassStartIcon,
    description: "E-invoice submission is pending",
  },
  submitted: {
    label: "Submitted",
    variant: "outline",
    icon: SyncIcon,
    description: "Submitted to MyInvois, awaiting validation",
  },
  valid: {
    label: "Valid",
    variant: "default",
    icon: CircleCheckIcon,
    description: "Validated and accepted by MyInvois",
  },
  invalid: {
    label: "Invalid",
    variant: "destructive",
    icon: TriangleWarningIcon,
    description: "Rejected by MyInvois due to validation errors",
  },
  cancelled: {
    label: "Cancelled",
    variant: "secondary",
    icon: FileBanIcon,
    description: "E-invoice has been cancelled",
  },
};

export function SubmissionStatusBadge({
  status,
  className,
  showTooltip = true,
}: SubmissionStatusBadgeProps) {
  if (!status) {
    return (
      <Badge variant="outline" className={cn("gap-1", className)}>
        Not Submitted
      </Badge>
    );
  }

  const config = statusConfig[status];

  if (!config) {
    return null;
  }

  const Icon = config.icon;

  const badge = (
    <Badge variant={config.variant} className={cn("gap-1", className)}>
      <Icon className="size-3" />
      {config.label}
    </Badge>
  );

  if (!showTooltip) {
    return badge;
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>{badge}</TooltipTrigger>
        <TooltipContent>
          <p>{config.description}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
