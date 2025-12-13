import { describe, it, expect } from "vitest";
import {
  createCustomerSchema,
  updateCustomerSchema,
  customerMetadataSchema,
} from "../customer";

describe("customerMetadataSchema", () => {
  it("validates valid metadata", () => {
    const result = customerMetadataSchema.safeParse({
      label: "Company",
      value: "Acme Corp",
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty label", () => {
    const result = customerMetadataSchema.safeParse({
      label: "",
      value: "Acme Corp",
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty value", () => {
    const result = customerMetadataSchema.safeParse({
      label: "Company",
      value: "",
    });
    expect(result.success).toBe(false);
  });
});

describe("createCustomerSchema", () => {
  it("validates valid customer data", () => {
    const result = createCustomerSchema.safeParse({
      name: "John Doe",
      email: "john@example.com",
      phone: "+60123456789",
      address: "123 Main St",
    });
    expect(result.success).toBe(true);
  });

  it("requires name", () => {
    const result = createCustomerSchema.safeParse({
      email: "john@example.com",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toContain("name");
    }
  });

  it("rejects empty name", () => {
    const result = createCustomerSchema.safeParse({
      name: "",
    });
    expect(result.success).toBe(false);
  });

  it("validates email format", () => {
    const result = createCustomerSchema.safeParse({
      name: "John Doe",
      email: "invalid-email",
    });
    expect(result.success).toBe(false);
  });

  it("allows empty email", () => {
    const result = createCustomerSchema.safeParse({
      name: "John Doe",
      email: "",
    });
    expect(result.success).toBe(true);
  });

  it("allows optional fields to be omitted", () => {
    const result = createCustomerSchema.safeParse({
      name: "John Doe",
    });
    expect(result.success).toBe(true);
  });

  it("validates metadata array", () => {
    const result = createCustomerSchema.safeParse({
      name: "John Doe",
      metadata: [
        { label: "Company", value: "Acme Corp" },
        { label: "Department", value: "Sales" },
      ],
    });
    expect(result.success).toBe(true);
  });
});

describe("updateCustomerSchema", () => {
  it("validates valid update data", () => {
    const result = updateCustomerSchema.safeParse({
      id: "123e4567-e89b-12d3-a456-426614174000",
      name: "Jane Doe",
    });
    expect(result.success).toBe(true);
  });

  it("requires valid UUID for id", () => {
    const result = updateCustomerSchema.safeParse({
      id: "invalid-uuid",
      name: "Jane Doe",
    });
    expect(result.success).toBe(false);
  });

  it("allows partial updates", () => {
    const result = updateCustomerSchema.safeParse({
      id: "123e4567-e89b-12d3-a456-426614174000",
      phone: "+60123456789",
    });
    expect(result.success).toBe(true);
  });
});
