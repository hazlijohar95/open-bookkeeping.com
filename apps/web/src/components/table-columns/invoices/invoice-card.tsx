"use client";

import { MobileCard, type SwipeAction } from "@/components/ui/mobile";
import type { Invoice, InvoiceStatusType } from "@/types/common/invoice";
import { getTotalValue } from "@/constants/pdf-helpers";
import { FilePenIcon } from "@/assets/icons";
import { Trash2Icon, CheckIcon, EyeIcon } from "@/components/ui/icons";
import { format } from "date-fns";
import { useNavigate } from "react-router-dom";

// Status variant type matching MobileCard expectations
type MobileStatusVariant = "default" | "success" | "warning" | "destructive" | "secondary";

// ============================================================================
// TYPES
// ============================================================================

interface InvoiceCardProps {
  invoice: Invoice;
  onView?: (invoice: Invoice) => void;
  onDelete?: (invoice: Invoice) => void;
  onMarkPaid?: (invoice: Invoice) => void;
}

// ============================================================================
// HELPERS
// ============================================================================

const getStatusBadgeVariant = (status: InvoiceStatusType): MobileStatusVariant => {
  switch (status) {
    case "pending":
      return "warning";
    case "success":
      return "success";
    case "error":
      return "destructive";
    case "expired":
      return "secondary";
    case "refunded":
      return "default";
    default:
      return "secondary";
  }
};

const getStatusLabel = (status: InvoiceStatusType): string => {
  switch (status) {
    case "pending":
      return "Pending";
    case "success":
      return "Paid";
    case "error":
      return "Error";
    case "expired":
      return "Expired";
    case "refunded":
      return "Refunded";
    default:
      return status;
  }
};

// ============================================================================
// COMPONENT
// ============================================================================

export function InvoiceCard({ invoice, onView, onDelete, onMarkPaid }: InvoiceCardProps) {
  const navigate = useNavigate();

  // Build serial number string
  const serialNumber = `${invoice.invoiceFields.invoiceDetails.prefix}${invoice.invoiceFields.invoiceDetails.serialNumber}`;

  // Get client name
  const clientName = invoice.invoiceFields.clientDetails.name;

  // Get total amount
  const totalAmount = getTotalValue(invoice.invoiceFields);
  const currency = invoice.invoiceFields.invoiceDetails.currency;

  // Format date
  const createdDate = format(new Date(invoice.createdAt), "dd MMM yyyy");

  // Build swipe actions
  const leftActions: SwipeAction[] = [];
  const rightActions: SwipeAction[] = [];

  // Left swipe (swipe right to reveal): View and Mark Paid
  if (onView) {
    leftActions.push({
      icon: EyeIcon,
      label: "View",
      color: "primary",
      onAction: () => onView(invoice),
    });
  }

  if (onMarkPaid && invoice.status === "pending") {
    leftActions.push({
      icon: CheckIcon,
      label: "Paid",
      color: "success",
      onAction: () => onMarkPaid(invoice),
    });
  }

  // Right swipe (swipe left to reveal): Edit and Delete
  rightActions.push({
    icon: FilePenIcon,
    label: "Edit",
    color: "primary",
    onAction: () => navigate(`/edit/${invoice.type}/${invoice.id}`),
  });

  if (onDelete) {
    rightActions.push({
      icon: Trash2Icon,
      label: "Delete",
      color: "destructive",
      onAction: () => onDelete(invoice),
    });
  }

  return (
    <MobileCard
      title={serialNumber}
      subtitle={clientName}
      meta={createdDate}
      amount={{
        value: totalAmount,
        currency: currency,
      }}
      status={{
        label: getStatusLabel(invoice.status),
        variant: getStatusBadgeVariant(invoice.status),
      }}
      avatar={{
        name: clientName,
      }}
      onTap={() => onView?.(invoice)}
      leftActions={leftActions}
      rightActions={rightActions}
      showChevron={false}
    />
  );
}

// ============================================================================
// RENDER FUNCTION FOR DATA TABLE
// ============================================================================

/**
 * Factory function to create a renderCard function for DataTable
 * This allows passing callbacks while maintaining the render function signature
 */
export function createInvoiceCardRenderer(options?: {
  onView?: (invoice: Invoice) => void;
  onDelete?: (invoice: Invoice) => void;
  onMarkPaid?: (invoice: Invoice) => void;
}) {
  return (invoice: Invoice) => (
    <InvoiceCard
      invoice={invoice}
      onView={options?.onView}
      onDelete={options?.onDelete}
      onMarkPaid={options?.onMarkPaid}
    />
  );
}

/**
 * Key extractor for invoice cards
 */
export function invoiceKeyExtractor(invoice: Invoice): string {
  return invoice.id;
}

export default InvoiceCard;
