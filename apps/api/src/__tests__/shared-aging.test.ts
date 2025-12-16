import { describe, it, expect } from "vitest";
import {
  AGING_BUCKET_KEYS,
  AGING_BUCKET_CONFIG,
  EMPTY_AGING_BUCKETS,
  calculateDaysOverdue,
  categorizeIntoBucket,
  getAgingBucketLabel,
  getAgingLabel,
  calculateAgingReport,
  createEmptyAgingBuckets,
  getAgingSeverity,
  getAgingColorClass,
  getAgingBucketColorClass,
} from "@open-bookkeeping/shared";

describe("Aging Utilities", () => {
  describe("AGING_BUCKET_KEYS", () => {
    it("should have 5 bucket keys", () => {
      expect(AGING_BUCKET_KEYS.length).toBe(5);
    });

    it("should contain expected keys", () => {
      expect(AGING_BUCKET_KEYS).toContain("current");
      expect(AGING_BUCKET_KEYS).toContain("days1to30");
      expect(AGING_BUCKET_KEYS).toContain("days31to60");
      expect(AGING_BUCKET_KEYS).toContain("days61to90");
      expect(AGING_BUCKET_KEYS).toContain("over90");
    });
  });

  describe("AGING_BUCKET_CONFIG", () => {
    it("should have configuration for each bucket", () => {
      expect(AGING_BUCKET_CONFIG.length).toBe(5);
    });

    it("should have labels for each bucket", () => {
      AGING_BUCKET_CONFIG.forEach((config) => {
        expect(config.label).toBeTruthy();
        expect(config.shortLabel).toBeTruthy();
      });
    });
  });

  describe("calculateDaysOverdue", () => {
    it("should return 0 for null due date", () => {
      expect(calculateDaysOverdue(null)).toBe(0);
    });

    it("should return 0 for undefined due date", () => {
      expect(calculateDaysOverdue(undefined)).toBe(0);
    });

    it("should return 0 for invalid date string", () => {
      expect(calculateDaysOverdue("invalid")).toBe(0);
    });

    it("should return positive days for past due date", () => {
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() - 10);
      expect(calculateDaysOverdue(dueDate)).toBe(10);
    });

    it("should return negative days for future due date", () => {
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 10);
      expect(calculateDaysOverdue(dueDate)).toBe(-10);
    });

    it("should return 0 for today", () => {
      const today = new Date();
      expect(calculateDaysOverdue(today)).toBe(0);
    });

    it("should handle string dates", () => {
      const referenceDate = new Date("2024-12-15");
      expect(calculateDaysOverdue("2024-12-10", referenceDate)).toBe(5);
    });

    it("should use custom reference date", () => {
      const dueDate = new Date("2024-12-01");
      const refDate = new Date("2024-12-11");
      expect(calculateDaysOverdue(dueDate, refDate)).toBe(10);
    });
  });

  describe("categorizeIntoBucket", () => {
    it("should categorize 0 days as current", () => {
      expect(categorizeIntoBucket(0)).toBe("current");
    });

    it("should categorize negative days as current", () => {
      expect(categorizeIntoBucket(-5)).toBe("current");
    });

    it("should categorize 1-30 days", () => {
      expect(categorizeIntoBucket(1)).toBe("days1to30");
      expect(categorizeIntoBucket(15)).toBe("days1to30");
      expect(categorizeIntoBucket(30)).toBe("days1to30");
    });

    it("should categorize 31-60 days", () => {
      expect(categorizeIntoBucket(31)).toBe("days31to60");
      expect(categorizeIntoBucket(45)).toBe("days31to60");
      expect(categorizeIntoBucket(60)).toBe("days31to60");
    });

    it("should categorize 61-90 days", () => {
      expect(categorizeIntoBucket(61)).toBe("days61to90");
      expect(categorizeIntoBucket(75)).toBe("days61to90");
      expect(categorizeIntoBucket(90)).toBe("days61to90");
    });

    it("should categorize over 90 days", () => {
      expect(categorizeIntoBucket(91)).toBe("over90");
      expect(categorizeIntoBucket(120)).toBe("over90");
      expect(categorizeIntoBucket(365)).toBe("over90");
    });
  });

  describe("getAgingBucketLabel", () => {
    it("should return full label", () => {
      expect(getAgingBucketLabel("current")).toBe("Current");
      expect(getAgingBucketLabel("days1to30")).toBe("1-30 Days");
      expect(getAgingBucketLabel("over90")).toBe("Over 90 Days");
    });

    it("should return short label", () => {
      expect(getAgingBucketLabel("current", true)).toBe("Current");
      expect(getAgingBucketLabel("days1to30", true)).toBe("1-30");
      expect(getAgingBucketLabel("over90", true)).toBe("90+");
    });
  });

  describe("getAgingLabel", () => {
    it("should return Current for 0 or less", () => {
      expect(getAgingLabel(0)).toBe("Current");
      expect(getAgingLabel(-5)).toBe("Current");
    });

    it("should return singular for 1 day", () => {
      expect(getAgingLabel(1)).toBe("1 day");
    });

    it("should return plural for multiple days", () => {
      expect(getAgingLabel(5)).toBe("5 days");
      expect(getAgingLabel(30)).toBe("30 days");
    });
  });

  describe("calculateAgingReport", () => {
    const referenceDate = new Date("2024-12-15");

    interface TestInvoice {
      dueDate: string;
      amount: number;
    }

    it("should calculate report for empty array", () => {
      const report = calculateAgingReport<TestInvoice>(
        [],
        (inv) => inv.dueDate,
        (inv) => inv.amount,
        referenceDate
      );

      expect(report.totals.count).toBe(0);
      expect(report.totals.amount).toBe(0);
    });

    it("should categorize items into buckets", () => {
      const invoices: TestInvoice[] = [
        { dueDate: "2024-12-20", amount: 100 }, // Current (future)
        { dueDate: "2024-12-10", amount: 200 }, // 5 days overdue (1-30)
        { dueDate: "2024-11-01", amount: 300 }, // 44 days overdue (31-60)
        { dueDate: "2024-09-15", amount: 400 }, // 91 days overdue (over90)
      ];

      const report = calculateAgingReport(
        invoices,
        (inv) => inv.dueDate,
        (inv) => inv.amount,
        referenceDate
      );

      expect(report.counts.current).toBe(1);
      expect(report.counts.days1to30).toBe(1);
      expect(report.counts.days31to60).toBe(1);
      expect(report.counts.over90).toBe(1);

      expect(report.amounts.current).toBe(100);
      expect(report.amounts.days1to30).toBe(200);
      expect(report.amounts.days31to60).toBe(300);
      expect(report.amounts.over90).toBe(400);

      expect(report.totals.count).toBe(4);
      expect(report.totals.amount).toBe(1000);
      expect(report.totals.overdueCount).toBe(3);
      expect(report.totals.overdueAmount).toBe(900);
    });

    it("should handle items with same bucket", () => {
      const invoices: TestInvoice[] = [
        { dueDate: "2024-12-10", amount: 100 },
        { dueDate: "2024-12-05", amount: 200 },
      ];

      const report = calculateAgingReport(
        invoices,
        (inv) => inv.dueDate,
        (inv) => inv.amount,
        referenceDate
      );

      expect(report.counts.days1to30).toBe(2);
      expect(report.amounts.days1to30).toBe(300);
    });
  });

  describe("createEmptyAgingBuckets", () => {
    it("should create buckets with all zeros", () => {
      const buckets = createEmptyAgingBuckets();

      expect(buckets.current).toBe(0);
      expect(buckets.days1to30).toBe(0);
      expect(buckets.days31to60).toBe(0);
      expect(buckets.days61to90).toBe(0);
      expect(buckets.over90).toBe(0);
    });

    it("should return a new object each time", () => {
      const buckets1 = createEmptyAgingBuckets();
      const buckets2 = createEmptyAgingBuckets();

      buckets1.current = 100;
      expect(buckets2.current).toBe(0);
    });
  });

  describe("getAgingSeverity", () => {
    it("should return normal for current", () => {
      expect(getAgingSeverity(0)).toBe("normal");
      expect(getAgingSeverity(-5)).toBe("normal");
    });

    it("should return warning for 1-30 days", () => {
      expect(getAgingSeverity(1)).toBe("warning");
      expect(getAgingSeverity(30)).toBe("warning");
    });

    it("should return danger for 31-60 days", () => {
      expect(getAgingSeverity(31)).toBe("danger");
      expect(getAgingSeverity(60)).toBe("danger");
    });

    it("should return critical for over 60 days", () => {
      expect(getAgingSeverity(61)).toBe("critical");
      expect(getAgingSeverity(100)).toBe("critical");
    });
  });

  describe("getAgingColorClass", () => {
    it("should return green for normal", () => {
      expect(getAgingColorClass(0)).toContain("green");
    });

    it("should return yellow for warning", () => {
      expect(getAgingColorClass(15)).toContain("yellow");
    });

    it("should return orange for danger", () => {
      expect(getAgingColorClass(45)).toContain("orange");
    });

    it("should return red for critical", () => {
      expect(getAgingColorClass(100)).toContain("red");
    });
  });

  describe("getAgingBucketColorClass", () => {
    it("should return correct colors for each bucket", () => {
      expect(getAgingBucketColorClass("current")).toContain("green");
      expect(getAgingBucketColorClass("days1to30")).toContain("yellow");
      expect(getAgingBucketColorClass("days31to60")).toContain("orange");
      expect(getAgingBucketColorClass("days61to90")).toContain("red-500");
      expect(getAgingBucketColorClass("over90")).toContain("red-700");
    });
  });

  describe("EMPTY_AGING_BUCKETS", () => {
    it("should be immutable reference", () => {
      // Verify the constant has correct structure
      expect(EMPTY_AGING_BUCKETS.current).toBe(0);
      expect(EMPTY_AGING_BUCKETS.days1to30).toBe(0);
      expect(EMPTY_AGING_BUCKETS.days31to60).toBe(0);
      expect(EMPTY_AGING_BUCKETS.days61to90).toBe(0);
      expect(EMPTY_AGING_BUCKETS.over90).toBe(0);
    });
  });
});
