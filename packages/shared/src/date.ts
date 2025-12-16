/**
 * Shared Date Utilities
 *
 * Consolidated date formatting and calculation utilities.
 * Default locale is "en-MY" (Malaysian English) to match business requirements.
 */

// ============================================
// DATE FORMATTING
// ============================================

/**
 * Format a date in short format (e.g., "15 Dec 2024")
 *
 * @param date - Date to format (Date object or ISO string)
 * @param locale - Locale for formatting (default: "en-MY")
 * @returns Formatted date string
 *
 * @example
 * formatDate(new Date("2024-12-15")) // "15 Dec 2024"
 * formatDate("2024-12-15T00:00:00Z") // "15 Dec 2024"
 */
export function formatDate(
  date: Date | string | null | undefined,
  locale = "en-MY"
): string {
  if (!date) return "";

  const dateObj = typeof date === "string" ? new Date(date) : date;

  if (isNaN(dateObj.getTime())) return "";

  return dateObj.toLocaleDateString(locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/**
 * Format a date in full format with weekday (e.g., "Sunday, 15 December 2024")
 *
 * @param date - Date to format (Date object or ISO string)
 * @param locale - Locale for formatting (default: "en-MY")
 * @returns Formatted date string
 *
 * @example
 * formatDateFull(new Date("2024-12-15")) // "Sunday, 15 December 2024"
 */
export function formatDateFull(
  date: Date | string | null | undefined,
  locale = "en-MY"
): string {
  if (!date) return "";

  const dateObj = typeof date === "string" ? new Date(date) : date;

  if (isNaN(dateObj.getTime())) return "";

  return dateObj.toLocaleDateString(locale, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/**
 * Format a date range (e.g., "1 Jan 2024 - 31 Dec 2024")
 *
 * @param startDate - Start date (ISO string)
 * @param endDate - End date (ISO string)
 * @param locale - Locale for formatting (default: "en-MY")
 * @returns Formatted date range string
 *
 * @example
 * formatDateRange("2024-01-01", "2024-12-31") // "1 Jan 2024 - 31 Dec 2024"
 */
export function formatDateRange(
  startDate: string | null | undefined,
  endDate: string | null | undefined,
  locale = "en-MY"
): string {
  const start = formatDate(startDate, locale);
  const end = formatDate(endDate, locale);

  if (!start && !end) return "";
  if (!start) return `Until ${end}`;
  if (!end) return `From ${start}`;

  return `${start} - ${end}`;
}

/**
 * Format a date for ISO format (YYYY-MM-DD)
 *
 * @param date - Date to format
 * @returns ISO date string (YYYY-MM-DD)
 *
 * @example
 * formatDateISO(new Date("2024-12-15")) // "2024-12-15"
 */
export function formatDateISO(date: Date | string | null | undefined): string {
  if (!date) return "";

  const dateObj = typeof date === "string" ? new Date(date) : date;

  if (isNaN(dateObj.getTime())) return "";

  return dateObj.toISOString().split("T")[0] ?? "";
}

// ============================================
// DATE CALCULATIONS
// ============================================

/**
 * Calculate the difference in days between two dates
 *
 * @param date1 - First date
 * @param date2 - Second date (default: now)
 * @returns Number of days difference (positive if date1 is before date2)
 *
 * @example
 * differenceInDays(new Date("2024-12-01"), new Date("2024-12-15")) // 14
 */
export function differenceInDays(
  date1: Date | string | null | undefined,
  date2: Date | string | null | undefined = new Date()
): number {
  if (!date1 || !date2) return 0;

  const d1 = typeof date1 === "string" ? new Date(date1) : date1;
  const d2 = typeof date2 === "string" ? new Date(date2) : date2;

  if (isNaN(d1.getTime()) || isNaN(d2.getTime())) return 0;

  const diffTime = d2.getTime() - d1.getTime();
  return Math.floor(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Check if a date is in the past
 *
 * @param date - Date to check
 * @returns True if date is before today
 */
export function isPastDate(date: Date | string | null | undefined): boolean {
  if (!date) return false;

  const dateObj = typeof date === "string" ? new Date(date) : date;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return dateObj < today;
}

/**
 * Check if a date is today
 *
 * @param date - Date to check
 * @returns True if date is today
 */
export function isToday(date: Date | string | null | undefined): boolean {
  if (!date) return false;

  const dateObj = typeof date === "string" ? new Date(date) : date;
  const today = new Date();

  return (
    dateObj.getDate() === today.getDate() &&
    dateObj.getMonth() === today.getMonth() &&
    dateObj.getFullYear() === today.getFullYear()
  );
}

/**
 * Get the start of a month
 *
 * @param date - Reference date (default: now)
 * @returns Date object representing the first day of the month
 */
export function startOfMonth(date: Date = new Date()): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

/**
 * Get the end of a month
 *
 * @param date - Reference date (default: now)
 * @returns Date object representing the last day of the month
 */
export function endOfMonth(date: Date = new Date()): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

/**
 * Get the start of a year
 *
 * @param date - Reference date (default: now)
 * @returns Date object representing the first day of the year
 */
export function startOfYear(date: Date = new Date()): Date {
  return new Date(date.getFullYear(), 0, 1);
}

/**
 * Get the end of a year
 *
 * @param date - Reference date (default: now)
 * @returns Date object representing the last day of the year
 */
export function endOfYear(date: Date = new Date()): Date {
  return new Date(date.getFullYear(), 11, 31);
}

// ============================================
// MONTH NAMES (for reports)
// ============================================

export const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

export const MONTH_NAMES_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

/**
 * Get month name from month number (1-12)
 *
 * @param month - Month number (1-12)
 * @param short - Use short name (default: false)
 * @returns Month name
 */
export function getMonthName(month: number, short = false): string {
  const index = month - 1;
  if (index < 0 || index > 11) return "";
  return short ? (MONTH_NAMES_SHORT[index] ?? "") : (MONTH_NAMES[index] ?? "");
}
