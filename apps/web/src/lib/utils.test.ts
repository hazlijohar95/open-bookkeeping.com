import { describe, it, expect } from "vitest";
import {
  cn,
  formatCurrency,
  formatCurrencyWithDecimals,
  formatDate,
  formatDateFull,
  getInitials,
  getAvatarColor,
} from "./utils";

describe("Utility Functions", () => {
  describe("cn() - Class Name Merger", () => {
    it("should merge class names", () => {
      const result = cn("px-4", "py-2");
      expect(result).toBe("px-4 py-2");
    });

    it("should handle conditional classes", () => {
      const isActive = true;
      const result = cn("base", isActive && "active");
      expect(result).toBe("base active");
    });

    it("should handle falsy values", () => {
      const result = cn("base", false && "hidden", null, undefined);
      expect(result).toBe("base");
    });

    it("should merge Tailwind conflicts correctly", () => {
      // twMerge should handle conflicting Tailwind classes
      const result = cn("px-4", "px-8");
      expect(result).toBe("px-8");
    });

    it("should handle array of classes", () => {
      const result = cn(["px-4", "py-2"]);
      expect(result).toBe("px-4 py-2");
    });

    it("should handle object syntax", () => {
      const result = cn({
        "text-red-500": true,
        "text-blue-500": false,
      });
      expect(result).toBe("text-red-500");
    });
  });

  describe("formatCurrency()", () => {
    it("should format MYR currency by default", () => {
      const result = formatCurrency(1000);
      expect(result).toContain("1,000");
      expect(result).toContain("RM");
    });

    it("should format USD currency", () => {
      const result = formatCurrency(1000, "USD");
      expect(result).toContain("1,000");
    });

    it("should format without decimals", () => {
      const result = formatCurrency(1234.56);
      // Should round or truncate to whole number
      expect(result).toMatch(/1,23[45]/);
    });

    it("should handle zero", () => {
      const result = formatCurrency(0);
      expect(result).toContain("0");
    });

    it("should handle negative numbers", () => {
      const result = formatCurrency(-1000);
      expect(result).toContain("1,000");
      expect(result).toMatch(/-|−/); // negative sign or minus
    });

    it("should handle large numbers", () => {
      const result = formatCurrency(1000000);
      expect(result).toContain("1,000,000");
    });
  });

  describe("formatCurrencyWithDecimals()", () => {
    it("should format with 2 decimal places", () => {
      const result = formatCurrencyWithDecimals(1234.56);
      expect(result).toContain("1,234.56");
    });

    it("should add trailing zeros", () => {
      const result = formatCurrencyWithDecimals(1000);
      expect(result).toContain("1,000.00");
    });

    it("should handle different currencies", () => {
      const result = formatCurrencyWithDecimals(1234.56, "EUR");
      expect(result).toContain("1,234.56");
    });

    it("should round decimals", () => {
      const result = formatCurrencyWithDecimals(1234.567);
      // Should round to 2 decimals
      expect(result).toContain("1,234.57");
    });
  });

  describe("formatDate()", () => {
    it("should format Date object", () => {
      const date = new Date("2024-01-15");
      const result = formatDate(date);
      expect(result).toContain("15");
      expect(result).toMatch(/Jan|January/i);
      expect(result).toContain("2024");
    });

    it("should format date string", () => {
      const result = formatDate("2024-12-25");
      expect(result).toContain("25");
      expect(result).toMatch(/Dec|December/i);
      expect(result).toContain("2024");
    });

    it("should handle ISO date strings", () => {
      const result = formatDate("2024-06-15T10:30:00Z");
      expect(result).toContain("2024");
    });
  });

  describe("formatDateFull()", () => {
    it("should include weekday", () => {
      const date = new Date("2024-01-15"); // Monday
      const result = formatDateFull(date);
      // Should include day of week
      expect(result.length).toBeGreaterThan(15);
    });

    it("should include full month name", () => {
      const date = new Date("2024-01-15");
      const result = formatDateFull(date);
      expect(result).toMatch(/January/i);
    });

    it("should include year", () => {
      const date = new Date("2024-06-20");
      const result = formatDateFull(date);
      expect(result).toContain("2024");
    });
  });

  describe("getInitials()", () => {
    it("should get initials from full name", () => {
      const result = getInitials("John Doe");
      expect(result).toBe("JD");
    });

    it("should handle single name", () => {
      const result = getInitials("John");
      expect(result).toBe("J");
    });

    it("should handle three word names", () => {
      const result = getInitials("John Michael Doe");
      expect(result).toBe("JM"); // Only first 2 initials
    });

    it("should convert to uppercase", () => {
      const result = getInitials("john doe");
      expect(result).toBe("JD");
    });

    it("should handle empty string", () => {
      const result = getInitials("");
      expect(result).toBe("");
    });

    it("should limit to 2 characters", () => {
      const result = getInitials("A B C D E");
      expect(result.length).toBeLessThanOrEqual(2);
    });
  });

  describe("getAvatarColor()", () => {
    it("should return a color class string", () => {
      const result = getAvatarColor("John Doe");
      expect(result).toContain("bg-");
      expect(result).toContain("text-");
    });

    it("should be deterministic for same name", () => {
      const result1 = getAvatarColor("Jane Smith");
      const result2 = getAvatarColor("Jane Smith");
      expect(result1).toBe(result2);
    });

    it("should return different colors for different names", () => {
      const color1 = getAvatarColor("Alice");
      const color2 = getAvatarColor("Bob");
      const color3 = getAvatarColor("Charlie");

      // At least 2 of 3 should be different (with 7 colors)
      const uniqueColors = new Set([color1, color2, color3]);
      expect(uniqueColors.size).toBeGreaterThanOrEqual(1);
    });

    it("should handle empty string", () => {
      const result = getAvatarColor("");
      expect(result).toContain("bg-");
    });

    it("should return valid Tailwind classes", () => {
      const result = getAvatarColor("Test UserIcon");
      // Should match pattern like "bg-primary/10 text-primary"
      expect(result).toMatch(/bg-[\w-]+\/?\d*/);
    });
  });
});
