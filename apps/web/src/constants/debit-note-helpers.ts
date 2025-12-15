import type { ZodCreateDebitNoteSchema } from "@/zod-schemas/debit-note/create-debit-note";

// Type for the minimum fields needed for total calculations
type DebitNoteTotalCalculationInput = Pick<ZodCreateDebitNoteSchema, 'items' | 'debitNoteDetails'>;

/**
 * Calculate the subtotal of all items in a debit note
 */
export const getDebitNoteSubTotalValue = (data: DebitNoteTotalCalculationInput): number => {
  return data.items.reduce((acc, item) => acc + item.quantity * item.unitPrice, 0);
};

/**
 * Calculate the total value of a debit note including all billing adjustments
 */
export const getDebitNoteTotalValue = (data: DebitNoteTotalCalculationInput): number => {
  const subtotal = getDebitNoteSubTotalValue(data);

  const billingAdjustments = data.debitNoteDetails.billingDetails.reduce((acc, detail) => {
    if (detail.type === "percentage") {
      return acc + (subtotal * detail.value) / 100;
    }
    return acc + detail.value;
  }, 0);

  return subtotal + billingAdjustments;
};
