import { describe, it, expect } from "vitest";
import {
  parseNumeric,
  roundTo,
  calculateLineItemAmount,
  calculateSubtotal,
  applyBillingDetail,
  calculateTotal,
  calculateDocumentTotals,
  calculateAmountDue,
  isFullyPaid,
  calculatePaymentProgress,
  calculateTaxAmount,
  calculateTaxBreakdown,
  calculatePercentage,
  calculatePercentageOf,
} from "@open-bookkeeping/shared";

describe("Calculation Utilities", () => {
  describe("parseNumeric", () => {
    it("should parse number", () => {
      expect(parseNumeric(100)).toBe(100);
    });

    it("should parse string number", () => {
      expect(parseNumeric("100.50")).toBe(100.5);
    });

    it("should return 0 for null", () => {
      expect(parseNumeric(null)).toBe(0);
    });

    it("should return 0 for undefined", () => {
      expect(parseNumeric(undefined)).toBe(0);
    });

    it("should return 0 for empty string", () => {
      expect(parseNumeric("")).toBe(0);
    });

    it("should return 0 for NaN", () => {
      expect(parseNumeric("abc")).toBe(0);
    });
  });

  describe("roundTo", () => {
    it("should round to 2 decimal places by default", () => {
      expect(roundTo(100.456)).toBe(100.46);
      expect(roundTo(100.454)).toBe(100.45);
    });

    it("should round to specified decimal places", () => {
      expect(roundTo(100.4567, 3)).toBe(100.457);
      expect(roundTo(100.5, 0)).toBe(101);
    });
  });

  describe("calculateLineItemAmount", () => {
    it("should calculate quantity × unit price", () => {
      expect(calculateLineItemAmount({ quantity: 2, unitPrice: 50 })).toBe(100);
    });

    it("should handle string values", () => {
      expect(
        calculateLineItemAmount({ quantity: "3", unitPrice: "33.33" })
      ).toBe(99.99);
    });

    it("should handle decimal quantities", () => {
      expect(calculateLineItemAmount({ quantity: 1.5, unitPrice: 100 })).toBe(
        150
      );
    });
  });

  describe("calculateSubtotal", () => {
    it("should sum all line items", () => {
      const items = [
        { quantity: 2, unitPrice: 50 },
        { quantity: 3, unitPrice: 30 },
      ];
      expect(calculateSubtotal(items)).toBe(190); // 100 + 90
    });

    it("should return 0 for empty array", () => {
      expect(calculateSubtotal([])).toBe(0);
    });

    it("should handle single item", () => {
      expect(calculateSubtotal([{ quantity: 1, unitPrice: 100 }])).toBe(100);
    });
  });

  describe("applyBillingDetail", () => {
    it("should apply percentage", () => {
      expect(applyBillingDetail(100, { type: "percentage", value: 10 })).toBe(
        10
      );
    });

    it("should apply fixed amount", () => {
      expect(applyBillingDetail(100, { type: "fixed", value: 15 })).toBe(15);
    });

    it("should handle string values", () => {
      expect(applyBillingDetail(100, { type: "percentage", value: "6" })).toBe(
        6
      );
    });
  });

  describe("calculateTotal", () => {
    it("should add taxes to subtotal", () => {
      const result = calculateTotal(100, [
        { type: "percentage", value: 10, isTax: true },
      ]);
      expect(result).toBe(110);
    });

    it("should subtract discounts from subtotal", () => {
      const result = calculateTotal(100, [
        { type: "percentage", value: 10, isTax: false },
      ]);
      expect(result).toBe(90);
    });

    it("should handle multiple billing details", () => {
      const result = calculateTotal(100, [
        { type: "percentage", value: 10, isTax: true }, // +10
        { type: "fixed", value: 5, isTax: false }, // -5
      ]);
      expect(result).toBe(105);
    });

    it("should not go below zero", () => {
      const result = calculateTotal(10, [
        { type: "fixed", value: 50, isTax: false },
      ]);
      expect(result).toBe(0);
    });

    it("should return subtotal when no billing details", () => {
      expect(calculateTotal(100)).toBe(100);
      expect(calculateTotal(100, [])).toBe(100);
    });
  });

  describe("calculateDocumentTotals", () => {
    it("should calculate all totals", () => {
      const items = [
        { quantity: 2, unitPrice: 50 },
        { quantity: 1, unitPrice: 100 },
      ];
      const billingDetails = [
        { type: "percentage" as const, value: 6, isTax: true }, // SST 6%
        { type: "fixed" as const, value: 10, isTax: false }, // Discount
      ];

      const result = calculateDocumentTotals(items, billingDetails);

      expect(result.subtotal).toBe(200);
      expect(result.taxTotal).toBe(12); // 6% of 200
      expect(result.discountTotal).toBe(10);
      expect(result.total).toBe(202); // 200 + 12 - 10
    });

    it("should handle no billing details", () => {
      const items = [{ quantity: 1, unitPrice: 100 }];
      const result = calculateDocumentTotals(items);

      expect(result.subtotal).toBe(100);
      expect(result.taxTotal).toBe(0);
      expect(result.discountTotal).toBe(0);
      expect(result.total).toBe(100);
    });
  });

  describe("calculateAmountDue", () => {
    it("should calculate remaining amount", () => {
      expect(calculateAmountDue(100, 30)).toBe(70);
    });

    it("should not go below zero", () => {
      expect(calculateAmountDue(100, 150)).toBe(0);
    });

    it("should handle string values", () => {
      expect(calculateAmountDue("100", "25")).toBe(75);
    });
  });

  describe("isFullyPaid", () => {
    it("should return true when fully paid", () => {
      expect(isFullyPaid(100, 100)).toBe(true);
    });

    it("should return true when overpaid", () => {
      expect(isFullyPaid(100, 150)).toBe(true);
    });

    it("should return false when partially paid", () => {
      expect(isFullyPaid(100, 50)).toBe(false);
    });

    it("should return false when unpaid", () => {
      expect(isFullyPaid(100, 0)).toBe(false);
    });
  });

  describe("calculatePaymentProgress", () => {
    it("should calculate percentage paid", () => {
      expect(calculatePaymentProgress(100, 50)).toBe(50);
    });

    it("should cap at 100%", () => {
      expect(calculatePaymentProgress(100, 150)).toBe(100);
    });

    it("should return 0 for no payment", () => {
      expect(calculatePaymentProgress(100, 0)).toBe(0);
    });

    it("should return 100 for zero total", () => {
      expect(calculatePaymentProgress(0, 0)).toBe(100);
    });
  });

  describe("calculateTaxAmount", () => {
    it("should calculate tax", () => {
      expect(calculateTaxAmount(100, 6)).toBe(6);
    });

    it("should handle decimal rates", () => {
      expect(calculateTaxAmount(100, 7.5)).toBe(7.5);
    });

    it("should handle string inputs", () => {
      expect(calculateTaxAmount("100", "10")).toBe(10);
    });
  });

  describe("calculateTaxBreakdown", () => {
    it("should break down tax-inclusive amount", () => {
      const result = calculateTaxBreakdown(106, 6);
      expect(result.baseAmount).toBe(100);
      expect(result.taxAmount).toBe(6);
    });

    it("should handle zero tax rate", () => {
      const result = calculateTaxBreakdown(100, 0);
      expect(result.baseAmount).toBe(100);
      expect(result.taxAmount).toBe(0);
    });

    it("should handle 10% tax", () => {
      const result = calculateTaxBreakdown(110, 10);
      expect(result.baseAmount).toBe(100);
      expect(result.taxAmount).toBe(10);
    });
  });

  describe("calculatePercentage", () => {
    it("should calculate percentage of value", () => {
      expect(calculatePercentage(200, 15)).toBe(30);
    });

    it("should handle string inputs", () => {
      expect(calculatePercentage("100", "20")).toBe(20);
    });
  });

  describe("calculatePercentageOf", () => {
    it("should calculate what percentage part is of whole", () => {
      expect(calculatePercentageOf(25, 100)).toBe(25);
    });

    it("should handle greater than 100%", () => {
      expect(calculatePercentageOf(150, 100)).toBe(150);
    });

    it("should return 0 for zero whole", () => {
      expect(calculatePercentageOf(50, 0)).toBe(0);
    });
  });
});
