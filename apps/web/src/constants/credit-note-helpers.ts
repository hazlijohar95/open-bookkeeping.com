import type { ZodCreateCreditNoteSchema } from "@/zod-schemas/credit-note/create-credit-note";

// Type for the minimum fields needed for total calculations
type CreditNoteTotalCalculationInput = Pick<ZodCreateCreditNoteSchema, 'items' | 'creditNoteDetails'>;

/**
 * Calculate the subtotal of all items in a credit note
 */
export const getCreditNoteSubTotalValue = (data: CreditNoteTotalCalculationInput): number => {
  return data.items.reduce((acc, item) => acc + item.quantity * item.unitPrice, 0);
};

/**
 * Calculate the total value of a credit note including all billing adjustments
 */
export const getCreditNoteTotalValue = (data: CreditNoteTotalCalculationInput): number => {
  const subtotal = getCreditNoteSubTotalValue(data);

  const billingAdjustments = data.creditNoteDetails.billingDetails.reduce((acc, detail) => {
    if (detail.type === "percentage") {
      return acc + (subtotal * detail.value) / 100;
    }
    return acc + detail.value;
  }, 0);

  return subtotal + billingAdjustments;
};
