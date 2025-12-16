/**
 * Shared Calculation Utilities
 *
 * Consolidated calculation utilities for documents (invoices, bills, quotations, etc.)
 * All calculations use string decimals for precision and return numbers.
 */

// ============================================
// TYPES
// ============================================

/** Line item with quantity and unit price */
export interface LineItem {
  quantity: number | string;
  unitPrice: number | string;
}

/** Billing detail for calculations (tax, discount, etc.) */
export interface CalcBillingDetail {
  type: "percentage" | "fixed";
  value: number | string;
  /** Optional: treat as tax (adds to total) vs discount (subtracts) */
  isTax?: boolean;
}

/** Document totals */
export interface DocumentTotals {
  subtotal: number;
  taxTotal: number;
  discountTotal: number;
  total: number;
}

// ============================================
// CORE CALCULATION FUNCTIONS
// ============================================

/**
 * Parse a numeric value from string or number
 *
 * @param value - Value to parse
 * @returns Parsed number (0 if invalid)
 */
export function parseNumeric(
  value: number | string | null | undefined
): number {
  if (value === null || value === undefined || value === "") return 0;
  const num = typeof value === "string" ? parseFloat(value) : value;
  return isNaN(num) ? 0 : num;
}

/**
 * Round a number to specified decimal places
 *
 * @param value - Value to round
 * @param decimals - Number of decimal places (default: 2)
 * @returns Rounded number
 */
export function roundTo(value: number, decimals = 2): number {
  const multiplier = Math.pow(10, decimals);
  return Math.round(value * multiplier) / multiplier;
}

/**
 * Calculate line item amount (quantity × unit price)
 *
 * @param item - Line item
 * @returns Line item amount
 */
export function calculateLineItemAmount(item: LineItem): number {
  const quantity = parseNumeric(item.quantity);
  const unitPrice = parseNumeric(item.unitPrice);
  return roundTo(quantity * unitPrice);
}

/**
 * Calculate subtotal from line items
 *
 * @param items - Array of line items
 * @returns Subtotal (sum of all line item amounts)
 */
export function calculateSubtotal(items: LineItem[]): number {
  let subtotal = 0;
  for (const item of items) {
    subtotal += calculateLineItemAmount(item);
  }
  return roundTo(subtotal);
}

/**
 * Apply a billing detail to an amount
 *
 * @param baseAmount - Base amount to apply to
 * @param detail - Billing detail
 * @returns Calculated amount (positive for tax, negative for discount)
 */
export function applyBillingDetail(
  baseAmount: number,
  detail: CalcBillingDetail
): number {
  const value = parseNumeric(detail.value);

  let amount: number;
  if (detail.type === "percentage") {
    amount = roundTo((baseAmount * value) / 100);
  } else {
    amount = roundTo(value);
  }

  // If it's explicitly a tax, return positive; otherwise return as-is
  // (caller decides how to use it)
  return amount;
}

/**
 * Calculate total from subtotal and billing details
 *
 * @param subtotal - Base subtotal amount
 * @param billingDetails - Array of billing details (taxes, discounts)
 * @returns Final total
 *
 * @example
 * // Subtotal: 100, Tax: 10%, Discount: 5 (fixed)
 * calculateTotal(100, [
 *   { type: "percentage", value: 10, isTax: true },
 *   { type: "fixed", value: 5, isTax: false }
 * ])
 * // Returns: 100 + 10 - 5 = 105
 */
export function calculateTotal(
  subtotal: number,
  billingDetails: CalcBillingDetail[] = []
): number {
  let total = subtotal;

  for (const detail of billingDetails) {
    const amount = applyBillingDetail(subtotal, detail);
    if (detail.isTax) {
      total += amount;
    } else {
      total -= amount;
    }
  }

  return roundTo(Math.max(0, total)); // Ensure non-negative
}

/**
 * Calculate complete document totals
 *
 * @param items - Array of line items
 * @param billingDetails - Array of billing details
 * @returns Complete document totals
 */
export function calculateDocumentTotals(
  items: LineItem[],
  billingDetails: CalcBillingDetail[] = []
): DocumentTotals {
  const subtotal = calculateSubtotal(items);

  let taxTotal = 0;
  let discountTotal = 0;

  for (const detail of billingDetails) {
    const amount = applyBillingDetail(subtotal, detail);
    if (detail.isTax) {
      taxTotal += amount;
    } else {
      discountTotal += amount;
    }
  }

  const total = roundTo(Math.max(0, subtotal + taxTotal - discountTotal));

  return {
    subtotal: roundTo(subtotal),
    taxTotal: roundTo(taxTotal),
    discountTotal: roundTo(discountTotal),
    total,
  };
}

// ============================================
// INVOICE-SPECIFIC CALCULATIONS
// ============================================

/**
 * Calculate amount due (total minus paid)
 *
 * @param total - Total amount
 * @param amountPaid - Amount already paid
 * @returns Amount due
 */
export function calculateAmountDue(
  total: number | string,
  amountPaid: number | string
): number {
  const totalNum = parseNumeric(total);
  const paidNum = parseNumeric(amountPaid);
  return roundTo(Math.max(0, totalNum - paidNum));
}

/**
 * Check if an invoice is fully paid
 *
 * @param total - Total amount
 * @param amountPaid - Amount paid
 * @returns True if fully paid
 */
export function isFullyPaid(
  total: number | string,
  amountPaid: number | string
): boolean {
  return calculateAmountDue(total, amountPaid) <= 0;
}

/**
 * Calculate payment progress percentage
 *
 * @param total - Total amount
 * @param amountPaid - Amount paid
 * @returns Percentage (0-100)
 */
export function calculatePaymentProgress(
  total: number | string,
  amountPaid: number | string
): number {
  const totalNum = parseNumeric(total);
  const paidNum = parseNumeric(amountPaid);

  if (totalNum <= 0) return 100;
  if (paidNum <= 0) return 0;

  const progress = (paidNum / totalNum) * 100;
  return Math.min(100, Math.max(0, roundTo(progress)));
}

// ============================================
// TAX CALCULATIONS
// ============================================

/**
 * Calculate tax amount
 *
 * @param baseAmount - Amount to apply tax to
 * @param taxRate - Tax rate as percentage (e.g., 6 for 6%)
 * @returns Tax amount
 */
export function calculateTaxAmount(
  baseAmount: number | string,
  taxRate: number | string
): number {
  const base = parseNumeric(baseAmount);
  const rate = parseNumeric(taxRate);
  return roundTo((base * rate) / 100);
}

/**
 * Calculate tax-inclusive amount breakdown
 * Given a total that includes tax, calculate the base and tax portions
 *
 * @param taxInclusiveAmount - Amount including tax
 * @param taxRate - Tax rate as percentage
 * @returns Object with baseAmount and taxAmount
 */
export function calculateTaxBreakdown(
  taxInclusiveAmount: number | string,
  taxRate: number | string
): { baseAmount: number; taxAmount: number } {
  const total = parseNumeric(taxInclusiveAmount);
  const rate = parseNumeric(taxRate);

  if (rate <= 0) {
    return { baseAmount: total, taxAmount: 0 };
  }

  const baseAmount = roundTo(total / (1 + rate / 100));
  const taxAmount = roundTo(total - baseAmount);

  return { baseAmount, taxAmount };
}

// ============================================
// PERCENTAGE CALCULATIONS
// ============================================

/**
 * Calculate percentage of a value
 *
 * @param value - Base value
 * @param percentage - Percentage to calculate
 * @returns Calculated amount
 */
export function calculatePercentage(
  value: number | string,
  percentage: number | string
): number {
  const base = parseNumeric(value);
  const pct = parseNumeric(percentage);
  return roundTo((base * pct) / 100);
}

/**
 * Calculate what percentage one value is of another
 *
 * @param part - The part value
 * @param whole - The whole value
 * @returns Percentage (0-100+)
 */
export function calculatePercentageOf(
  part: number | string,
  whole: number | string
): number {
  const partNum = parseNumeric(part);
  const wholeNum = parseNumeric(whole);

  if (wholeNum === 0) return 0;

  return roundTo((partNum / wholeNum) * 100);
}
