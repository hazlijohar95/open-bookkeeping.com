/**
 * Shared Aging Report Utilities
 *
 * Consolidated aging calculation utilities for AR (Accounts Receivable)
 * and AP (Accounts Payable) reports.
 *
 * Standard aging buckets:
 * - Current: Not yet due
 * - 1-30 days: 1 to 30 days past due
 * - 31-60 days: 31 to 60 days past due
 * - 61-90 days: 61 to 90 days past due
 * - Over 90 days: More than 90 days past due
 */

// ============================================
// TYPES
// ============================================

/** Standard aging bucket keys */
export const AGING_BUCKET_KEYS = [
  "current",
  "days1to30",
  "days31to60",
  "days61to90",
  "over90",
] as const;

export type AgingBucketKey = (typeof AGING_BUCKET_KEYS)[number];

/** Aging bucket amounts/counts */
export interface AgingBuckets {
  current: number;
  days1to30: number;
  days31to60: number;
  days61to90: number;
  over90: number;
}

/** Complete aging report for a single entity */
export interface AgingReport {
  /** Number of items in each bucket */
  counts: AgingBuckets;
  /** Total amounts in each bucket */
  amounts: AgingBuckets;
  /** Overall totals */
  totals: {
    count: number;
    amount: number;
    overdueCount: number;
    overdueAmount: number;
  };
}

/** Configuration for aging bucket labels */
export interface AgingBucketConfig {
  key: AgingBucketKey;
  label: string;
  shortLabel: string;
  minDays: number;
  maxDays: number | null; // null = no upper limit
}

// ============================================
// CONSTANTS
// ============================================

/** Standard aging bucket configuration */
export const AGING_BUCKET_CONFIG: AgingBucketConfig[] = [
  {
    key: "current",
    label: "Current",
    shortLabel: "Current",
    minDays: -Infinity,
    maxDays: 0,
  },
  {
    key: "days1to30",
    label: "1-30 Days",
    shortLabel: "1-30",
    minDays: 1,
    maxDays: 30,
  },
  {
    key: "days31to60",
    label: "31-60 Days",
    shortLabel: "31-60",
    minDays: 31,
    maxDays: 60,
  },
  {
    key: "days61to90",
    label: "61-90 Days",
    shortLabel: "61-90",
    minDays: 61,
    maxDays: 90,
  },
  {
    key: "over90",
    label: "Over 90 Days",
    shortLabel: "90+",
    minDays: 91,
    maxDays: null,
  },
];

/** Default empty aging buckets */
export const EMPTY_AGING_BUCKETS: AgingBuckets = {
  current: 0,
  days1to30: 0,
  days31to60: 0,
  days61to90: 0,
  over90: 0,
};

// ============================================
// CORE FUNCTIONS
// ============================================

/**
 * Calculate days overdue from a due date
 *
 * @param dueDate - The due date to check
 * @param referenceDate - Reference date for calculation (default: now)
 * @returns Number of days overdue (negative if not yet due, 0 if due today)
 *
 * @example
 * // Due date was 10 days ago
 * calculateDaysOverdue(new Date("2024-12-01")) // 10 (if today is Dec 11)
 *
 * // Due date is in the future
 * calculateDaysOverdue(new Date("2024-12-31")) // -20 (if today is Dec 11)
 */
export function calculateDaysOverdue(
  dueDate: Date | string | null | undefined,
  referenceDate: Date = new Date()
): number {
  if (!dueDate) return 0;

  const due = typeof dueDate === "string" ? new Date(dueDate) : dueDate;

  if (isNaN(due.getTime())) return 0;

  // Normalize to start of day for consistent comparison
  const dueDay = new Date(due.getFullYear(), due.getMonth(), due.getDate());
  const refDay = new Date(
    referenceDate.getFullYear(),
    referenceDate.getMonth(),
    referenceDate.getDate()
  );

  const diffTime = refDay.getTime() - dueDay.getTime();
  return Math.floor(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Categorize days overdue into an aging bucket
 *
 * @param daysOverdue - Number of days overdue
 * @returns The aging bucket key
 *
 * @example
 * categorizeIntoBucket(0)   // "current"
 * categorizeIntoBucket(15)  // "days1to30"
 * categorizeIntoBucket(45)  // "days31to60"
 * categorizeIntoBucket(75)  // "days61to90"
 * categorizeIntoBucket(120) // "over90"
 */
export function categorizeIntoBucket(daysOverdue: number): AgingBucketKey {
  if (daysOverdue <= 0) return "current";
  if (daysOverdue <= 30) return "days1to30";
  if (daysOverdue <= 60) return "days31to60";
  if (daysOverdue <= 90) return "days61to90";
  return "over90";
}

/**
 * Get the label for an aging bucket
 *
 * @param bucket - The aging bucket key
 * @param short - Use short label (default: false)
 * @returns The bucket label
 */
export function getAgingBucketLabel(
  bucket: AgingBucketKey,
  short = false
): string {
  const config = AGING_BUCKET_CONFIG.find((c) => c.key === bucket);
  return config ? (short ? config.shortLabel : config.label) : bucket;
}

/**
 * Get a display label for days overdue
 *
 * @param daysOverdue - Number of days overdue
 * @returns Human-readable label
 *
 * @example
 * getAgingLabel(0)   // "Current"
 * getAgingLabel(5)   // "5 days"
 * getAgingLabel(30)  // "30 days"
 * getAgingLabel(100) // "100 days"
 */
export function getAgingLabel(daysOverdue: number): string {
  if (daysOverdue <= 0) return "Current";
  if (daysOverdue === 1) return "1 day";
  return `${daysOverdue} days`;
}

// ============================================
// REPORT GENERATION
// ============================================

/**
 * Calculate aging report for a list of items
 *
 * @param items - Array of items to analyze
 * @param getDueDate - Function to extract due date from item
 * @param getAmount - Function to extract amount from item
 * @param referenceDate - Reference date for calculation (default: now)
 * @returns Complete aging report
 *
 * @example
 * const invoices = [
 *   { dueDate: "2024-12-01", total: 1000 },
 *   { dueDate: "2024-11-15", total: 500 },
 * ];
 *
 * const report = calculateAgingReport(
 *   invoices,
 *   (inv) => inv.dueDate,
 *   (inv) => inv.total
 * );
 */
export function calculateAgingReport<T>(
  items: T[],
  getDueDate: (item: T) => Date | string | null | undefined,
  getAmount: (item: T) => number,
  referenceDate: Date = new Date()
): AgingReport {
  const counts: AgingBuckets = { ...EMPTY_AGING_BUCKETS };
  const amounts: AgingBuckets = { ...EMPTY_AGING_BUCKETS };
  let totalCount = 0;
  let totalAmount = 0;
  let overdueCount = 0;
  let overdueAmount = 0;

  for (const item of items) {
    const dueDate = getDueDate(item);
    const amount = getAmount(item);
    const daysOverdue = calculateDaysOverdue(dueDate, referenceDate);
    const bucket = categorizeIntoBucket(daysOverdue);

    counts[bucket]++;
    amounts[bucket] += amount;
    totalCount++;
    totalAmount += amount;

    if (daysOverdue > 0) {
      overdueCount++;
      overdueAmount += amount;
    }
  }

  return {
    counts,
    amounts,
    totals: {
      count: totalCount,
      amount: totalAmount,
      overdueCount,
      overdueAmount,
    },
  };
}

/**
 * Create empty aging buckets
 *
 * @returns Fresh aging buckets with all zeros
 */
export function createEmptyAgingBuckets(): AgingBuckets {
  return { ...EMPTY_AGING_BUCKETS };
}

// ============================================
// STYLING HELPERS (for UI components)
// ============================================

/** Severity level based on days overdue */
export type AgingSeverity = "normal" | "warning" | "danger" | "critical";

/**
 * Get severity level based on days overdue
 *
 * @param daysOverdue - Number of days overdue
 * @returns Severity level
 */
export function getAgingSeverity(daysOverdue: number): AgingSeverity {
  if (daysOverdue <= 0) return "normal";
  if (daysOverdue <= 30) return "warning";
  if (daysOverdue <= 60) return "danger";
  return "critical";
}

/**
 * Get CSS color class based on days overdue
 *
 * @param daysOverdue - Number of days overdue
 * @returns Tailwind color class
 */
export function getAgingColorClass(daysOverdue: number): string {
  const severity = getAgingSeverity(daysOverdue);
  switch (severity) {
    case "normal":
      return "text-green-600 dark:text-green-400";
    case "warning":
      return "text-yellow-600 dark:text-yellow-400";
    case "danger":
      return "text-orange-600 dark:text-orange-400";
    case "critical":
      return "text-red-600 dark:text-red-400";
  }
}

/**
 * Get background color class for aging bucket
 *
 * @param bucket - Aging bucket key
 * @returns Tailwind background color class
 */
export function getAgingBucketColorClass(bucket: AgingBucketKey): string {
  switch (bucket) {
    case "current":
      return "bg-green-500";
    case "days1to30":
      return "bg-yellow-500";
    case "days31to60":
      return "bg-orange-500";
    case "days61to90":
      return "bg-red-500";
    case "over90":
      return "bg-red-700";
  }
}
