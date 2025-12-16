/**
 * Invoice Status Utilities (V2)
 *
 * Provides utilities for working with the V2 invoice status system.
 *
 * Stored Statuses:
 * - draft: Being prepared, fully editable
 * - open: Finalized and awaiting payment
 * - paid: Fully paid (terminal state)
 * - void: Cancelled/voided (terminal state)
 * - uncollectible: Bad debt, unlikely to be paid
 * - refunded: Payment refunded (terminal state)
 *
 * Calculated Display States (not stored, computed at runtime):
 * - overdue: Open invoice past due date
 * - partial: Open invoice with partial payment
 */

// V2 stored status type
export type InvoiceStatusV2 =
  | "draft"
  | "open"
  | "paid"
  | "void"
  | "uncollectible"
  | "refunded";

// Display status includes calculated states
export type InvoiceDisplayStatus = InvoiceStatusV2 | "overdue" | "partial";

// Status badge colors for UI
export interface StatusBadgeConfig {
  label: string;
  variant:
    | "default"
    | "secondary"
    | "destructive"
    | "outline"
    | "success"
    | "warning";
  className?: string;
}

// Valid status transitions following Stripe's invoice lifecycle
const VALID_TRANSITIONS: Record<InvoiceStatusV2, InvoiceStatusV2[]> = {
  draft: ["open", "void"],
  open: ["paid", "void", "uncollectible"],
  paid: ["refunded"],
  void: [], // Terminal state
  uncollectible: ["void", "paid"], // Can recover or write off
  refunded: [], // Terminal state
};

/**
 * Get the display status for an invoice (includes calculated states)
 */
export function getDisplayStatus(
  status: InvoiceStatusV2,
  dueDate: Date | null | undefined,
  amountDue: number | string,
  amountPaid: number | string
): InvoiceDisplayStatus {
  // Only open invoices can be overdue or partial
  if (status !== "open") {
    return status;
  }

  const due = typeof amountDue === "string" ? parseFloat(amountDue) : amountDue;
  const paid =
    typeof amountPaid === "string" ? parseFloat(amountPaid) : amountPaid;

  // Check for partial payment (some paid, but not all)
  if (paid > 0 && due > 0) {
    return "partial";
  }

  // Check for overdue
  if (dueDate && new Date(dueDate) < new Date()) {
    return "overdue";
  }

  return status;
}

/**
 * Get badge configuration for a status
 */
export function getStatusBadgeConfig(
  status: InvoiceDisplayStatus
): StatusBadgeConfig {
  switch (status) {
    case "draft":
      return {
        label: "Draft",
        variant: "secondary",
      };
    case "open":
      return {
        label: "Open",
        variant: "default",
      };
    case "paid":
      return {
        label: "Paid",
        variant: "success",
      };
    case "void":
      return {
        label: "Void",
        variant: "outline",
        className: "text-muted-foreground",
      };
    case "uncollectible":
      return {
        label: "Uncollectible",
        variant: "destructive",
      };
    case "refunded":
      return {
        label: "Refunded",
        variant: "outline",
      };
    case "overdue":
      return {
        label: "Overdue",
        variant: "destructive",
      };
    case "partial":
      return {
        label: "Partial",
        variant: "warning",
      };
    default:
      return {
        label: status,
        variant: "secondary",
      };
  }
}

/**
 * Check if a status transition is valid
 */
export function isValidStatusTransition(
  from: InvoiceStatusV2,
  to: InvoiceStatusV2
): boolean {
  if (from === to) return true;
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

/**
 * Get valid next statuses for a given status
 */
export function getValidNextStatuses(
  status: InvoiceStatusV2
): InvoiceStatusV2[] {
  return VALID_TRANSITIONS[status] ?? [];
}

/**
 * Check if an invoice is editable (only draft invoices are fully editable)
 */
export function isInvoiceEditable(status: InvoiceStatusV2): boolean {
  return status === "draft";
}

/**
 * Check if an invoice is in a terminal state (cannot transition)
 */
export function isTerminalStatus(status: InvoiceStatusV2): boolean {
  return VALID_TRANSITIONS[status]?.length === 0;
}

/**
 * Check if an invoice can be deleted (only draft and void)
 */
export function canDeleteInvoice(status: InvoiceStatusV2): boolean {
  return status === "draft" || status === "void";
}

/**
 * Check if an invoice can receive payments
 */
export function canReceivePayment(status: InvoiceStatusV2): boolean {
  return status === "open" || status === "uncollectible";
}

/**
 * Get status description for tooltips/help text
 */
export function getStatusDescription(status: InvoiceDisplayStatus): string {
  switch (status) {
    case "draft":
      return "This invoice is a draft and hasn't been issued yet. You can edit all details.";
    case "open":
      return "This invoice has been issued and is awaiting payment.";
    case "paid":
      return "This invoice has been fully paid.";
    case "void":
      return "This invoice has been cancelled/voided and is no longer valid.";
    case "uncollectible":
      return "This invoice is marked as uncollectible. Payment is unlikely.";
    case "refunded":
      return "The payment for this invoice has been refunded.";
    case "overdue":
      return "This invoice is past its due date and requires attention.";
    case "partial":
      return "This invoice has received partial payment. Some amount is still due.";
    default:
      return "";
  }
}

/**
 * Get action labels for status transitions
 */
export function getStatusActionLabel(
  currentStatus: InvoiceStatusV2,
  targetStatus: InvoiceStatusV2
): string {
  if (currentStatus === "draft" && targetStatus === "open") {
    return "Issue Invoice";
  }
  if (targetStatus === "paid") {
    return "Mark as Paid";
  }
  if (targetStatus === "void") {
    return "Void Invoice";
  }
  if (targetStatus === "uncollectible") {
    return "Mark as Uncollectible";
  }
  if (targetStatus === "refunded") {
    return "Record Refund";
  }
  return `Change to ${targetStatus}`;
}

/**
 * Map legacy V1 status to V2 status (for migration/compatibility)
 */
export function mapV1StatusToV2(v1Status: string): InvoiceStatusV2 {
  switch (v1Status) {
    case "pending":
      return "open";
    case "success":
      return "paid";
    case "error":
      return "void";
    case "expired":
      return "uncollectible";
    case "refunded":
      return "refunded";
    default:
      return "draft";
  }
}

/**
 * Get the CSS color variable for a status
 */
export function getStatusColor(status: InvoiceDisplayStatus): string {
  switch (status) {
    case "draft":
      return "hsl(var(--muted-foreground))";
    case "open":
      return "hsl(var(--primary))";
    case "paid":
      return "hsl(var(--success))";
    case "void":
      return "hsl(var(--muted-foreground))";
    case "uncollectible":
      return "hsl(var(--destructive))";
    case "refunded":
      return "hsl(var(--muted-foreground))";
    case "overdue":
      return "hsl(var(--destructive))";
    case "partial":
      return "hsl(var(--warning))";
    default:
      return "hsl(var(--muted-foreground))";
  }
}

/**
 * Calculate days overdue for an open invoice
 */
export function getDaysOverdue(
  dueDate: Date | null | undefined
): number | null {
  if (!dueDate) return null;

  const due = new Date(dueDate);
  const now = new Date();

  if (now <= due) return null;

  const diffTime = Math.abs(now.getTime() - due.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  return diffDays;
}

/**
 * Format payment progress for partial payments
 */
export function formatPaymentProgress(
  amountPaid: number | string,
  total: number | string,
  _currency: string = "MYR"
): string {
  const paid =
    typeof amountPaid === "string" ? parseFloat(amountPaid) : amountPaid;
  const totalAmount = typeof total === "string" ? parseFloat(total) : total;

  if (totalAmount === 0) return "0%";

  const percentage = Math.round((paid / totalAmount) * 100);
  return `${percentage}% paid`;
}
