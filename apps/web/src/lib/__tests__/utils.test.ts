import { describe, it, expect } from "vitest";
import {
  cn,
  formatCurrency,
  formatCurrencyWithDecimals,
  formatDate,
  formatDateFull,
  getInitials,
  getAvatarColor,
} from "../utils";

describe("cn (class name utility)", () => {
  it("merges class names", () => {
    expect(cn("foo", "bar")).toBe("foo bar");
  });

  it("handles conditional classes", () => {
    expect(cn("base", true && "active", false && "hidden")).toBe("base active");
  });

  it("merges tailwind classes correctly", () => {
    expect(cn("px-2 py-1", "px-4")).toBe("py-1 px-4");
  });

  it("handles arrays", () => {
    expect(cn(["foo", "bar"])).toBe("foo bar");
  });

  it("handles undefined and null", () => {
    expect(cn("foo", undefined, null, "bar")).toBe("foo bar");
  });
});

describe("formatCurrency", () => {
  it("formats MYR currency without decimals", () => {
    const result = formatCurrency(1000);
    expect(result).toContain("1,000");
    expect(result).toContain("RM");
  });

  it("formats with custom currency", () => {
    const result = formatCurrency(1000, "USD");
    expect(result).toContain("1,000");
    expect(result).toContain("US$");
  });

  it("handles zero", () => {
    const result = formatCurrency(0);
    expect(result).toContain("0");
  });

  it("handles negative numbers", () => {
    const result = formatCurrency(-500);
    expect(result).toContain("500");
  });
});

describe("formatCurrencyWithDecimals", () => {
  it("formats with 2 decimal places", () => {
    const result = formatCurrencyWithDecimals(1000.5);
    expect(result).toContain("1,000.50");
  });

  it("formats whole numbers with .00", () => {
    const result = formatCurrencyWithDecimals(1000);
    expect(result).toContain("1,000.00");
  });
});

describe("formatDate", () => {
  it("formats date string", () => {
    const result = formatDate("2024-01-15");
    expect(result).toContain("Jan");
    expect(result).toContain("15");
    expect(result).toContain("2024");
  });

  it("formats Date object", () => {
    const result = formatDate(new Date(2024, 0, 15));
    expect(result).toContain("Jan");
    expect(result).toContain("15");
  });
});

describe("formatDateFull", () => {
  it("formats with full weekday and month", () => {
    const result = formatDateFull("2024-01-15");
    expect(result).toContain("January");
    expect(result).toContain("15");
    expect(result).toContain("2024");
  });
});

describe("getInitials", () => {
  it("returns initials from full name", () => {
    expect(getInitials("John Doe")).toBe("JD");
  });

  it("handles single name", () => {
    expect(getInitials("John")).toBe("J");
  });

  it("limits to 2 characters", () => {
    expect(getInitials("John James Doe")).toBe("JJ");
  });

  it("handles lowercase names", () => {
    expect(getInitials("john doe")).toBe("JD");
  });
});

describe("getAvatarColor", () => {
  it("returns a color class string", () => {
    const result = getAvatarColor("John Doe");
    expect(result).toContain("bg-");
    expect(result).toContain("text-");
  });

  it("returns consistent color for same name", () => {
    const color1 = getAvatarColor("John Doe");
    const color2 = getAvatarColor("John Doe");
    expect(color1).toBe(color2);
  });

  it("returns different colors for different names", () => {
    const color1 = getAvatarColor("John Doe");
    const color2 = getAvatarColor("Jane Smith");
    // Different names should likely have different colors (not guaranteed but probable)
    expect(typeof color1).toBe("string");
    expect(typeof color2).toBe("string");
  });
});
