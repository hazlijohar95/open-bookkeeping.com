/**
 * Shared types for SST tab components
 */

export type PeriodType = "current_month" | "last_month" | "quarter" | "year";
export type ChartPeriod = "6m" | "12m";
export type TaxTypeFilter = "all" | "sales_tax" | "service_tax";
export type DocumentTypeFilter = "all" | "invoice" | "credit_note" | "debit_note";
export type TabValue = "overview" | "transactions" | "sst02" | "compliance";

/**
 * Format period string (YYYY-MM) to human readable format
 */
export function formatPeriodLabel(period: string): string {
  const [year, month] = period.split("-");
  const date = new Date(Number(year), Number(month) - 1);
  return date.toLocaleDateString("en-MY", { month: "long", year: "numeric" });
}
