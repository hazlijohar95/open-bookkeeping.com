import { describe, it, expect } from "vitest";
import {
  formatCurrencyText,
  CURRENCIES,
  currenciesWithSymbols,
} from "./currency";

describe("Currency Utilities", () => {
  describe("formatCurrencyText()", () => {
    it("should format USD correctly", () => {
      const result = formatCurrencyText("USD", 1234.56);
      expect(result).toContain("1,234.56");
      expect(result).toContain("$");
    });

    it("should format EUR correctly", () => {
      const result = formatCurrencyText("EUR", 1234.56);
      expect(result).toContain("1.234,56"); // German locale uses . for thousands
      expect(result).toMatch(/€/);
    });

    it("should format GBP correctly", () => {
      const result = formatCurrencyText("GBP", 1234.56);
      expect(result).toContain("1,234.56");
      expect(result).toContain("£");
    });

    it("should format MYR correctly", () => {
      const result = formatCurrencyText("MYR", 1234.56);
      expect(result).toContain("1,234.56");
      // MYR might show RM
    });

    it("should format JPY correctly", () => {
      const result = formatCurrencyText("JPY", 1234);
      expect(result).toContain("1,234");
      // Yen symbol can be full-width (￥) or half-width (¥)
      expect(result).toMatch(/[¥￥]/);
    });

    it("should handle zero", () => {
      const result = formatCurrencyText("USD", 0);
      expect(result).toContain("0.00");
    });

    it("should handle negative amounts", () => {
      const result = formatCurrencyText("USD", -500);
      expect(result).toMatch(/-|−/); // Should contain negative sign
      expect(result).toContain("500.00");
    });

    it("should handle large amounts", () => {
      const result = formatCurrencyText("USD", 1000000);
      expect(result).toContain("1,000,000.00");
    });

    it("should handle unknown currencies gracefully", () => {
      // Should not throw, should fallback to simple formatting
      const result = formatCurrencyText("XYZ", 100);
      expect(result).toBeDefined();
    });

    it("should use appropriate locale for each currency", () => {
      // INR should use Indian numbering (lakh, crore)
      const inrResult = formatCurrencyText("INR", 100000);
      expect(inrResult).toMatch(/₹|INR/);

      // CHF should use Swiss formatting
      const chfResult = formatCurrencyText("CHF", 1234.56);
      expect(chfResult).toMatch(/CHF|Fr/i);
    });
  });

  describe("CURRENCIES array", () => {
    it("should contain common currencies", () => {
      const codes = CURRENCIES.map(c => c.code);
      expect(codes).toContain("USD");
      expect(codes).toContain("EUR");
      expect(codes).toContain("GBP");
      expect(codes).toContain("MYR");
    });

    it("should have unique currency codes", () => {
      const codes = CURRENCIES.map(c => c.code);
      const uniqueCodes = new Set(codes);
      expect(uniqueCodes.size).toBe(codes.length);
    });

    it("should have names for all currencies", () => {
      CURRENCIES.forEach(currency => {
        expect(currency.name).toBeDefined();
        expect(currency.name.length).toBeGreaterThan(0);
      });
    });

    it("should have valid 3-letter currency codes", () => {
      CURRENCIES.forEach(currency => {
        expect(currency.code).toMatch(/^[A-Z]{3}$/);
      });
    });

    it("should include Malaysian Ringgit for Malaysian market", () => {
      const myr = CURRENCIES.find(c => c.code === "MYR");
      expect(myr).toBeDefined();
      expect(myr?.name).toContain("Malaysian");
    });
  });

  describe("currenciesWithSymbols map", () => {
    it("should be a non-empty object", () => {
      expect(Object.keys(currenciesWithSymbols).length).toBeGreaterThan(0);
    });

    it("should contain common currency symbols", () => {
      expect(currenciesWithSymbols["USD"]).toBe("$");
      expect(currenciesWithSymbols["EUR"]).toBe("€");
      expect(currenciesWithSymbols["GBP"]).toBe("£");
      expect(currenciesWithSymbols["JPY"]).toBe("¥");
    });

    it("should have symbol for MYR", () => {
      expect(currenciesWithSymbols["MYR"]).toBeDefined();
    });
  });
});
