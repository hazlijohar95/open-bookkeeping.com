import { describe, it, expect } from "vitest";
import { TRPCError } from "@trpc/server";
import {
  notFound,
  forbidden,
  badRequest,
  unauthorized,
  internalError,
  assertFound,
  conflict,
  preconditionFailed,
} from "../lib/errors";

describe("Error Utilities", () => {
  describe("notFound", () => {
    it("should create a NOT_FOUND error with entity type", () => {
      const error = notFound("invoice");
      expect(error).toBeInstanceOf(TRPCError);
      expect(error.code).toBe("NOT_FOUND");
      expect(error.message).toBe("Invoice not found");
    });

    it("should create a NOT_FOUND error with entity type and id", () => {
      const error = notFound("invoice", "123");
      expect(error.message).toBe('Invoice with id "123" not found');
    });

    it("should format entity names with underscores", () => {
      const error = notFound("credit_note");
      expect(error.message).toBe("Credit Note not found");
    });
  });

  describe("forbidden", () => {
    it("should create a FORBIDDEN error with default message", () => {
      const error = forbidden();
      expect(error).toBeInstanceOf(TRPCError);
      expect(error.code).toBe("FORBIDDEN");
      expect(error.message).toBe("Access denied");
    });

    it("should create a FORBIDDEN error with custom message", () => {
      const error = forbidden("You cannot edit this invoice");
      expect(error.message).toBe("You cannot edit this invoice");
    });
  });

  describe("badRequest", () => {
    it("should create a BAD_REQUEST error with message", () => {
      const error = badRequest("Invalid date format");
      expect(error).toBeInstanceOf(TRPCError);
      expect(error.code).toBe("BAD_REQUEST");
      expect(error.message).toBe("Invalid date format");
    });

    it("should include details as cause in non-production", () => {
      const error = badRequest("Validation failed", { field: "email" });
      expect(error.code).toBe("BAD_REQUEST");
    });
  });

  describe("unauthorized", () => {
    it("should create an UNAUTHORIZED error with default message", () => {
      const error = unauthorized();
      expect(error).toBeInstanceOf(TRPCError);
      expect(error.code).toBe("UNAUTHORIZED");
      expect(error.message).toBe("Authentication required");
    });

    it("should create an UNAUTHORIZED error with custom message", () => {
      const error = unauthorized("Session expired");
      expect(error.message).toBe("Session expired");
    });
  });

  describe("internalError", () => {
    it("should create an INTERNAL_SERVER_ERROR with message", () => {
      const error = internalError("Database connection failed");
      expect(error).toBeInstanceOf(TRPCError);
      expect(error.code).toBe("INTERNAL_SERVER_ERROR");
      expect(error.message).toBe("Database connection failed");
    });

    it("should include cause when provided", () => {
      const originalError = new Error("Original error");
      const error = internalError("Wrapped error", originalError);
      expect(error.cause).toBe(originalError);
    });
  });

  describe("conflict", () => {
    it("should create a CONFLICT error for duplicate entity", () => {
      const error = conflict("invoice");
      expect(error).toBeInstanceOf(TRPCError);
      expect(error.code).toBe("CONFLICT");
      expect(error.message).toBe("Invoice already exists");
    });

    it("should create a CONFLICT error with field", () => {
      const error = conflict("customer", "email");
      expect(error.message).toBe("Customer with this email already exists");
    });
  });

  describe("preconditionFailed", () => {
    it("should create a PRECONDITION_FAILED error", () => {
      const error = preconditionFailed("Invoice is already paid");
      expect(error).toBeInstanceOf(TRPCError);
      expect(error.code).toBe("PRECONDITION_FAILED");
      expect(error.message).toBe("Invoice is already paid");
    });
  });

  describe("assertFound", () => {
    it("should not throw when value exists", () => {
      const value = { id: "123", name: "Test" };
      expect(() => assertFound(value, "invoice", "123")).not.toThrow();
    });

    it("should throw NOT_FOUND when value is null", () => {
      expect(() => assertFound(null, "invoice", "123")).toThrow(TRPCError);
      try {
        assertFound(null, "invoice", "123");
      } catch (error) {
        expect((error as TRPCError).code).toBe("NOT_FOUND");
        expect((error as TRPCError).message).toBe('Invoice with id "123" not found');
      }
    });

    it("should throw NOT_FOUND when value is undefined", () => {
      expect(() => assertFound(undefined, "customer")).toThrow(TRPCError);
      try {
        assertFound(undefined, "customer");
      } catch (error) {
        expect((error as TRPCError).code).toBe("NOT_FOUND");
        expect((error as TRPCError).message).toBe("Customer not found");
      }
    });
  });
});
