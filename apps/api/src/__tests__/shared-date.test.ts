import { describe, it, expect } from "vitest";
import {
  formatDate,
  formatDateFull,
  formatDateRange,
  formatDateISO,
  differenceInDays,
  isPastDate,
  isToday,
  startOfMonth,
  endOfMonth,
  startOfYear,
  endOfYear,
  getMonthName,
  MONTH_NAMES,
  MONTH_NAMES_SHORT,
} from "@open-bookkeeping/shared";

describe("Date Utilities", () => {
  describe("formatDate", () => {
    it("should format a Date object", () => {
      const date = new Date("2024-12-15T00:00:00Z");
      const result = formatDate(date);
      expect(result).toMatch(/15.*Dec.*2024/);
    });

    it("should format an ISO string", () => {
      const result = formatDate("2024-12-15T00:00:00Z");
      expect(result).toMatch(/15.*Dec.*2024/);
    });

    it("should return empty string for null", () => {
      expect(formatDate(null)).toBe("");
    });

    it("should return empty string for undefined", () => {
      expect(formatDate(undefined)).toBe("");
    });

    it("should return empty string for invalid date", () => {
      expect(formatDate("invalid")).toBe("");
    });
  });

  describe("formatDateFull", () => {
    it("should format a date with weekday", () => {
      const date = new Date("2024-12-15T00:00:00Z");
      const result = formatDateFull(date);
      // Should include weekday, day, month, year
      expect(result).toMatch(/December.*2024/);
    });

    it("should return empty string for null", () => {
      expect(formatDateFull(null)).toBe("");
    });
  });

  describe("formatDateRange", () => {
    it("should format a date range", () => {
      const result = formatDateRange("2024-01-01", "2024-12-31");
      expect(result).toContain("-");
    });

    it("should handle missing start date", () => {
      const result = formatDateRange(null, "2024-12-31");
      expect(result).toMatch(/Until/);
    });

    it("should handle missing end date", () => {
      const result = formatDateRange("2024-01-01", null);
      expect(result).toMatch(/From/);
    });

    it("should return empty string when both dates missing", () => {
      expect(formatDateRange(null, null)).toBe("");
    });
  });

  describe("formatDateISO", () => {
    it("should format a date as YYYY-MM-DD", () => {
      const date = new Date("2024-12-15T10:30:00Z");
      const result = formatDateISO(date);
      expect(result).toBe("2024-12-15");
    });

    it("should handle ISO string input", () => {
      const result = formatDateISO("2024-12-15T10:30:00Z");
      expect(result).toBe("2024-12-15");
    });

    it("should return empty string for null", () => {
      expect(formatDateISO(null)).toBe("");
    });

    it("should return empty string for invalid date", () => {
      expect(formatDateISO("invalid")).toBe("");
    });
  });

  describe("differenceInDays", () => {
    it("should calculate positive difference", () => {
      const date1 = new Date("2024-12-01");
      const date2 = new Date("2024-12-15");
      expect(differenceInDays(date1, date2)).toBe(14);
    });

    it("should calculate negative difference", () => {
      const date1 = new Date("2024-12-15");
      const date2 = new Date("2024-12-01");
      expect(differenceInDays(date1, date2)).toBe(-14);
    });

    it("should return 0 for same date", () => {
      const date = new Date("2024-12-15");
      expect(differenceInDays(date, date)).toBe(0);
    });

    it("should return 0 for null input", () => {
      expect(differenceInDays(null, new Date())).toBe(0);
    });

    it("should handle string dates", () => {
      expect(differenceInDays("2024-12-01", "2024-12-15")).toBe(14);
    });
  });

  describe("isPastDate", () => {
    it("should return true for past date", () => {
      const pastDate = new Date("2020-01-01");
      expect(isPastDate(pastDate)).toBe(true);
    });

    it("should return false for future date", () => {
      const futureDate = new Date("2099-12-31");
      expect(isPastDate(futureDate)).toBe(false);
    });

    it("should return false for null", () => {
      expect(isPastDate(null)).toBe(false);
    });
  });

  describe("isToday", () => {
    it("should return true for today", () => {
      const today = new Date();
      expect(isToday(today)).toBe(true);
    });

    it("should return false for yesterday", () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      expect(isToday(yesterday)).toBe(false);
    });

    it("should return false for null", () => {
      expect(isToday(null)).toBe(false);
    });
  });

  describe("startOfMonth", () => {
    it("should return first day of month", () => {
      const date = new Date("2024-12-15");
      const result = startOfMonth(date);
      expect(result.getDate()).toBe(1);
      expect(result.getMonth()).toBe(11); // December
      expect(result.getFullYear()).toBe(2024);
    });
  });

  describe("endOfMonth", () => {
    it("should return last day of month", () => {
      const date = new Date("2024-12-15");
      const result = endOfMonth(date);
      expect(result.getDate()).toBe(31);
      expect(result.getMonth()).toBe(11); // December
    });

    it("should handle February in leap year", () => {
      const date = new Date("2024-02-15"); // 2024 is a leap year
      const result = endOfMonth(date);
      expect(result.getDate()).toBe(29);
    });

    it("should handle February in non-leap year", () => {
      const date = new Date("2023-02-15");
      const result = endOfMonth(date);
      expect(result.getDate()).toBe(28);
    });
  });

  describe("startOfYear", () => {
    it("should return January 1st", () => {
      const date = new Date("2024-06-15");
      const result = startOfYear(date);
      expect(result.getMonth()).toBe(0); // January
      expect(result.getDate()).toBe(1);
      expect(result.getFullYear()).toBe(2024);
    });
  });

  describe("endOfYear", () => {
    it("should return December 31st", () => {
      const date = new Date("2024-06-15");
      const result = endOfYear(date);
      expect(result.getMonth()).toBe(11); // December
      expect(result.getDate()).toBe(31);
      expect(result.getFullYear()).toBe(2024);
    });
  });

  describe("getMonthName", () => {
    it("should return full month name", () => {
      expect(getMonthName(1)).toBe("January");
      expect(getMonthName(12)).toBe("December");
    });

    it("should return short month name", () => {
      expect(getMonthName(1, true)).toBe("Jan");
      expect(getMonthName(12, true)).toBe("Dec");
    });

    it("should return empty string for invalid month", () => {
      expect(getMonthName(0)).toBe("");
      expect(getMonthName(13)).toBe("");
    });
  });

  describe("MONTH_NAMES", () => {
    it("should have 12 months", () => {
      expect(MONTH_NAMES.length).toBe(12);
    });

    it("should start with January", () => {
      expect(MONTH_NAMES[0]).toBe("January");
    });

    it("should end with December", () => {
      expect(MONTH_NAMES[11]).toBe("December");
    });
  });

  describe("MONTH_NAMES_SHORT", () => {
    it("should have 12 months", () => {
      expect(MONTH_NAMES_SHORT.length).toBe(12);
    });

    it("should have 3-character names", () => {
      MONTH_NAMES_SHORT.forEach((name) => {
        expect(name.length).toBe(3);
      });
    });
  });
});
