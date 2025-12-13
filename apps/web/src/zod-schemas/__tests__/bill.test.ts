import { describe, it, expect } from "vitest";
import { billStatusSchema, billItemSchema, createBillSchema } from "../bill";

describe("billStatusSchema", () => {
  it("accepts valid statuses", () => {
    const statuses = ["draft", "pending", "paid", "overdue", "cancelled"];
    statuses.forEach((status) => {
      const result = billStatusSchema.safeParse(status);
      expect(result.success).toBe(true);
    });
  });

  it("rejects invalid status", () => {
    const result = billStatusSchema.safeParse("invalid");
    expect(result.success).toBe(false);
  });
});

describe("billItemSchema", () => {
  it("validates valid item", () => {
    const result = billItemSchema.safeParse({
      description: "Office Supplies",
      quantity: "10",
      unitPrice: "50.00",
    });
    expect(result.success).toBe(true);
  });

  it("requires description", () => {
    const result = billItemSchema.safeParse({
      description: "",
      quantity: "10",
      unitPrice: "50.00",
    });
    expect(result.success).toBe(false);
  });

  it("requires positive quantity", () => {
    const result = billItemSchema.safeParse({
      description: "Office Supplies",
      quantity: "-5",
      unitPrice: "50.00",
    });
    expect(result.success).toBe(false);
  });

  it("requires non-negative unit price", () => {
    const result = billItemSchema.safeParse({
      description: "Office Supplies",
      quantity: "10",
      unitPrice: "-50.00",
    });
    expect(result.success).toBe(false);
  });

  it("allows zero unit price", () => {
    const result = billItemSchema.safeParse({
      description: "Free Sample",
      quantity: "1",
      unitPrice: "0",
    });
    expect(result.success).toBe(true);
  });
});

describe("createBillSchema", () => {
  const validBill = {
    billNumber: "BILL-001",
    billDate: new Date("2024-01-15"),
    items: [
      {
        description: "Office Supplies",
        quantity: "10",
        unitPrice: "50.00",
      },
    ],
  };

  it("validates valid bill", () => {
    const result = createBillSchema.safeParse(validBill);
    expect(result.success).toBe(true);
  });

  it("requires bill number", () => {
    const result = createBillSchema.safeParse({
      ...validBill,
      billNumber: "",
    });
    expect(result.success).toBe(false);
  });

  it("requires at least one item", () => {
    const result = createBillSchema.safeParse({
      ...validBill,
      items: [],
    });
    expect(result.success).toBe(false);
  });

  it("defaults currency to MYR", () => {
    const result = createBillSchema.safeParse(validBill);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.currency).toBe("MYR");
    }
  });

  it("defaults status to pending", () => {
    const result = createBillSchema.safeParse(validBill);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status).toBe("pending");
    }
  });

  it("validates vendor ID as UUID", () => {
    const result = createBillSchema.safeParse({
      ...validBill,
      vendorId: "invalid-uuid",
    });
    expect(result.success).toBe(false);
  });

  it("accepts valid vendor UUID", () => {
    const result = createBillSchema.safeParse({
      ...validBill,
      vendorId: "123e4567-e89b-12d3-a456-426614174000",
    });
    expect(result.success).toBe(true);
  });

  it("accepts nullable vendor ID", () => {
    const result = createBillSchema.safeParse({
      ...validBill,
      vendorId: null,
    });
    expect(result.success).toBe(true);
  });

  it("validates multiple items", () => {
    const result = createBillSchema.safeParse({
      ...validBill,
      items: [
        { description: "Item 1", quantity: "5", unitPrice: "100" },
        { description: "Item 2", quantity: "10", unitPrice: "50" },
      ],
    });
    expect(result.success).toBe(true);
  });
});
