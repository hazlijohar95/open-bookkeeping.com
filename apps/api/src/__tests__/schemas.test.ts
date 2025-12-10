import { describe, it, expect } from "vitest";
import {
  paginationBaseSchema,
  documentStatusSchema,
  noteReasonSchema,
  metadataItemSchema,
  billingDetailSchema,
  themeSchema,
  documentItemSchema,
  companyDetailsSchema,
  clientDetailsSchema,
  dateRangeSchema,
} from "../schemas/common";

describe("Common Schemas", () => {
  describe("paginationBaseSchema", () => {
    it("should accept valid pagination params", () => {
      const result = paginationBaseSchema.safeParse({ limit: 20, offset: 0 });
      expect(result.success).toBe(true);
    });

    it("should use default values when not provided", () => {
      const result = paginationBaseSchema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.limit).toBe(50);
        expect(result.data.offset).toBe(0);
      }
    });

    it("should reject limit > 100", () => {
      const result = paginationBaseSchema.safeParse({ limit: 101 });
      expect(result.success).toBe(false);
    });

    it("should reject negative offset", () => {
      const result = paginationBaseSchema.safeParse({ offset: -1 });
      expect(result.success).toBe(false);
    });
  });

  describe("documentStatusSchema", () => {
    it("should accept valid statuses", () => {
      const validStatuses = ["draft", "pending", "paid", "overdue", "cancelled"];
      validStatuses.forEach((status) => {
        const result = documentStatusSchema.safeParse(status);
        expect(result.success).toBe(true);
      });
    });

    it("should reject invalid status", () => {
      const result = documentStatusSchema.safeParse("invalid");
      expect(result.success).toBe(false);
    });
  });

  describe("noteReasonSchema", () => {
    it("should accept valid reasons", () => {
      const validReasons = ["return", "discount", "pricing_error", "damaged_goods", "other"];
      validReasons.forEach((reason) => {
        const result = noteReasonSchema.safeParse(reason);
        expect(result.success).toBe(true);
      });
    });

    it("should reject invalid reason", () => {
      const result = noteReasonSchema.safeParse("invalid");
      expect(result.success).toBe(false);
    });
  });

  describe("metadataItemSchema", () => {
    it("should accept valid metadata item", () => {
      const result = metadataItemSchema.safeParse({
        label: "Tax ID",
        value: "123456789",
      });
      expect(result.success).toBe(true);
    });

    it("should reject missing label", () => {
      const result = metadataItemSchema.safeParse({ value: "123" });
      expect(result.success).toBe(false);
    });
  });

  describe("billingDetailSchema", () => {
    it("should accept valid fixed billing detail", () => {
      const result = billingDetailSchema.safeParse({
        label: "Shipping",
        type: "fixed",
        value: 10,
      });
      expect(result.success).toBe(true);
    });

    it("should accept valid percentage billing detail", () => {
      const result = billingDetailSchema.safeParse({
        label: "Tax",
        type: "percentage",
        value: 6,
      });
      expect(result.success).toBe(true);
    });

    it("should accept SST fields", () => {
      const result = billingDetailSchema.safeParse({
        label: "Service Tax",
        type: "percentage",
        value: 6,
        isSstTax: true,
        sstTaxType: "service_tax",
        sstRateCode: "ST6",
      });
      expect(result.success).toBe(true);
    });

    it("should reject invalid type", () => {
      const result = billingDetailSchema.safeParse({
        label: "Tax",
        type: "invalid",
        value: 10,
      });
      expect(result.success).toBe(false);
    });
  });

  describe("themeSchema", () => {
    it("should accept valid theme", () => {
      const result = themeSchema.safeParse({
        baseColor: "#2563EB",
        mode: "light",
        template: "default",
      });
      expect(result.success).toBe(true);
    });

    it("should accept theme without template", () => {
      const result = themeSchema.safeParse({
        baseColor: "#000000",
        mode: "dark",
      });
      expect(result.success).toBe(true);
    });

    it("should reject invalid mode", () => {
      const result = themeSchema.safeParse({
        baseColor: "#000",
        mode: "blue",
      });
      expect(result.success).toBe(false);
    });

    it("should reject invalid template", () => {
      const result = themeSchema.safeParse({
        baseColor: "#000",
        mode: "light",
        template: "invalid",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("documentItemSchema", () => {
    it("should accept valid item", () => {
      const result = documentItemSchema.safeParse({
        name: "Web Development",
        description: "Frontend development services",
        quantity: 10,
        unitPrice: 100,
      });
      expect(result.success).toBe(true);
    });

    it("should accept item without description", () => {
      const result = documentItemSchema.safeParse({
        name: "Consulting",
        quantity: 5,
        unitPrice: 150,
      });
      expect(result.success).toBe(true);
    });

    it("should reject non-positive quantity", () => {
      const result = documentItemSchema.safeParse({
        name: "Item",
        quantity: 0,
        unitPrice: 100,
      });
      expect(result.success).toBe(false);
    });

    it("should reject non-positive unitPrice", () => {
      const result = documentItemSchema.safeParse({
        name: "Item",
        quantity: 1,
        unitPrice: -10,
      });
      expect(result.success).toBe(false);
    });
  });

  describe("companyDetailsSchema", () => {
    it("should accept valid company details", () => {
      const result = companyDetailsSchema.safeParse({
        name: "Acme Corp",
        address: "123 Main St, City",
      });
      expect(result.success).toBe(true);
    });

    it("should accept company with optional fields", () => {
      const result = companyDetailsSchema.safeParse({
        name: "Acme Corp",
        address: "123 Main St",
        logo: "https://example.com/logo.png",
        signature: "https://example.com/signature.png",
        metadata: [{ label: "Tax ID", value: "12345" }],
      });
      expect(result.success).toBe(true);
    });

    it("should accept null logo/signature", () => {
      const result = companyDetailsSchema.safeParse({
        name: "Company",
        address: "Address",
        logo: null,
        signature: null,
      });
      expect(result.success).toBe(true);
    });
  });

  describe("clientDetailsSchema", () => {
    it("should accept valid client details", () => {
      const result = clientDetailsSchema.safeParse({
        name: "John Doe",
        address: "456 Customer Rd",
      });
      expect(result.success).toBe(true);
    });

    it("should accept client with metadata", () => {
      const result = clientDetailsSchema.safeParse({
        name: "Jane Doe",
        address: "789 Client Ave",
        metadata: [{ label: "Phone", value: "+60123456789" }],
      });
      expect(result.success).toBe(true);
    });
  });

  describe("dateRangeSchema", () => {
    it("should accept valid date range", () => {
      const result = dateRangeSchema.safeParse({
        startDate: "2024-01-01",
        endDate: "2024-12-31",
      });
      expect(result.success).toBe(true);
    });

    it("should accept empty date range", () => {
      const result = dateRangeSchema.safeParse({});
      expect(result.success).toBe(true);
    });

    it("should coerce string dates to Date objects", () => {
      const result = dateRangeSchema.safeParse({
        startDate: "2024-01-01",
      });
      expect(result.success).toBe(true);
      if (result.success && result.data.startDate) {
        expect(result.data.startDate).toBeInstanceOf(Date);
      }
    });
  });
});
