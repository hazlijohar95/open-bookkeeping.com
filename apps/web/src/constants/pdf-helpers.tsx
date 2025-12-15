import type { ZodCreateInvoiceSchema } from "@/zod-schemas/invoice/create-invoice";

// Type for invoice fields with optional metadata (from API)
type InvoiceFieldsWithOptionalMetadata = Omit<ZodCreateInvoiceSchema, 'metadata'> & {
  metadata?: ZodCreateInvoiceSchema['metadata'] | null;
};

// Type for the minimum fields needed for total calculations
type TotalCalculationInput = Pick<ZodCreateInvoiceSchema, 'items' | 'invoiceDetails'>;

export const getSubTotalValue = (data: TotalCalculationInput) => {
  return data.items.reduce((acc, item) => acc + item.quantity * item.unitPrice, 0);
};

export const getTotalValue = (data: TotalCalculationInput) => {
  const subtotal = getSubTotalValue(data);

  const billingRates = data.invoiceDetails.billingDetails ?? [];

  // Calculate the total value based of fixed/percentage billing rates also value can be positive or negative
  let total = subtotal;

  billingRates.forEach((rate) => {
    if (rate.type === "fixed") {
      // Add or subtract the fixed amount directly
      total += rate.value;
    } else if (rate.type === "percentage") {
      // Calculate percentage of subtotal and add/subtract
      const percentageValue = (subtotal * rate.value) / 100;
      total += percentageValue;
    }
  });

  return total;
};

// Re-export for backward compatibility
export type { InvoiceFieldsWithOptionalMetadata };
