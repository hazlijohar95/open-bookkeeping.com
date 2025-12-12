import type { ZodCreateQuotationSchema } from "@/zod-schemas/quotation/create-quotation";

export const getQuotationSubTotalValue = (data: ZodCreateQuotationSchema) => {
  return data.items.reduce((acc, item) => acc + item.quantity * item.unitPrice, 0);
};

export const getQuotationTotalValue = (data: ZodCreateQuotationSchema) => {
  const subtotal = getQuotationSubTotalValue(data);

  const billingRates = data.quotationDetails.billingDetails;

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
