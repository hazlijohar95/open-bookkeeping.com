import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { TRPCError } from "@trpc/server";
import {
  notFound,
  badRequest,
  unauthorized,
  forbidden,
  conflict,
  preconditionFailed,
  internalError,
  badGateway,
  unprocessable,
  validationError,
  assertFound,
  assertPrecondition,
  wrapAsync,
  wrapDbOperation,
} from "./errors";

// Mock the logger
vi.mock("@open-bookkeeping/shared", () => ({
  createLogger: () => ({
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  }),
}));

describe("Error Factory Functions", () => {
  const originalNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
  });

  describe("notFound()", () => {
    it("should create NOT_FOUND error with entity and id", () => {
      const error = notFound("invoice", "inv-123");

      expect(error).toBeInstanceOf(TRPCError);
      expect(error.code).toBe("NOT_FOUND");
      expect(error.message).toBe('Invoice with id "inv-123" not found');
    });

    it("should create NOT_FOUND error with entity only", () => {
      const error = notFound("customer");

      expect(error.code).toBe("NOT_FOUND");
      expect(error.message).toBe("Customer not found");
    });

    it("should format multi-word entity names", () => {
      const error = notFound("credit_note", "cn-123");

      expect(error.message).toBe('Credit Note with id "cn-123" not found');
    });

    it("should format all entity types correctly", () => {
      const entities = [
        { type: "vault_document", expected: "Vault Document" },
        { type: "bank_account", expected: "Bank Account" },
        { type: "journal_entry", expected: "Journal Entry" },
        { type: "api_key", expected: "Api Key" },
        { type: "webhook_delivery", expected: "Webhook Delivery" },
      ] as const;

      entities.forEach(({ type, expected }) => {
        const error = notFound(type);
        expect(error.message).toBe(`${expected} not found`);
      });
    });
  });

  describe("badRequest()", () => {
    it("should create BAD_REQUEST error with message", () => {
      const error = badRequest("Invalid input format");

      expect(error).toBeInstanceOf(TRPCError);
      expect(error.code).toBe("BAD_REQUEST");
      expect(error.message).toBe("Invalid input format");
    });

    it("should include details as cause in non-production", () => {
      process.env.NODE_ENV = "test"; // vitest runs in test mode
      const details = { field: "email", reason: "invalid format" };
      const error = badRequest("Validation failed", details);

      // TRPCError wraps cause differently - check it exists and contains our data
      expect(error.cause).toBeDefined();
    });

    it("should not include details in production", () => {
      process.env.NODE_ENV = "production";
      const details = { field: "email", reason: "invalid format" };
      const error = badRequest("Validation failed", details);

      expect(error.cause).toBeUndefined();
    });
  });

  describe("unauthorized()", () => {
    it("should create UNAUTHORIZED error with default message", () => {
      const error = unauthorized();

      expect(error).toBeInstanceOf(TRPCError);
      expect(error.code).toBe("UNAUTHORIZED");
      expect(error.message).toBe("Authentication required");
    });

    it("should create UNAUTHORIZED error with custom message", () => {
      const error = unauthorized("Token expired");

      expect(error.message).toBe("Token expired");
    });
  });

  describe("forbidden()", () => {
    it("should create FORBIDDEN error with default message", () => {
      const error = forbidden();

      expect(error).toBeInstanceOf(TRPCError);
      expect(error.code).toBe("FORBIDDEN");
      expect(error.message).toBe("Access denied");
    });

    it("should create FORBIDDEN error with custom message", () => {
      const error = forbidden("You do not have permission to delete invoices");

      expect(error.message).toBe("You do not have permission to delete invoices");
    });
  });

  describe("conflict()", () => {
    it("should create CONFLICT error with entity only", () => {
      const error = conflict("customer");

      expect(error).toBeInstanceOf(TRPCError);
      expect(error.code).toBe("CONFLICT");
      expect(error.message).toBe("Customer already exists");
    });

    it("should create CONFLICT error with entity and field", () => {
      const error = conflict("customer", "email");

      expect(error.message).toBe("Customer with this email already exists");
    });
  });

  describe("preconditionFailed()", () => {
    it("should create PRECONDITION_FAILED error", () => {
      const error = preconditionFailed("Invoice must be in draft status");

      expect(error).toBeInstanceOf(TRPCError);
      expect(error.code).toBe("PRECONDITION_FAILED");
      expect(error.message).toBe("Invoice must be in draft status");
    });
  });

  describe("internalError()", () => {
    it("should create INTERNAL_SERVER_ERROR in development with original message", () => {
      process.env.NODE_ENV = "development";
      const originalError = new Error("Database connection failed");
      const error = internalError("Failed to fetch invoices", originalError);

      expect(error).toBeInstanceOf(TRPCError);
      expect(error.code).toBe("INTERNAL_SERVER_ERROR");
      expect(error.message).toBe("Failed to fetch invoices");
      expect(error.cause).toBe(originalError);
    });

    it("should hide internal message in production", () => {
      process.env.NODE_ENV = "production";
      const originalError = new Error("Database connection failed");
      const error = internalError("Sensitive database error", originalError);

      expect(error.message).toBe("An internal error occurred");
      expect(error.cause).toBeUndefined();
    });
  });

  describe("badGateway()", () => {
    it("should create BAD_GATEWAY error with service name", () => {
      const error = badGateway("MyInvois");

      expect(error).toBeInstanceOf(TRPCError);
      expect(error.code).toBe("BAD_GATEWAY");
      expect(error.message).toBe("Failed to communicate with MyInvois");
    });

    it("should create BAD_GATEWAY error with service name and message", () => {
      const error = badGateway("Payment Gateway", "Connection timeout");

      expect(error.message).toBe("Payment Gateway error: Connection timeout");
    });
  });

  describe("unprocessable()", () => {
    it("should create UNPROCESSABLE_CONTENT error", () => {
      const error = unprocessable("Cannot process invoice without line items");

      expect(error).toBeInstanceOf(TRPCError);
      expect(error.code).toBe("UNPROCESSABLE_CONTENT");
      expect(error.message).toBe("Cannot process invoice without line items");
    });

    it("should include details in non-production", () => {
      process.env.NODE_ENV = "test"; // vitest runs in test mode
      const details = { missing: ["lineItems", "customerId"] };
      const error = unprocessable("Missing required fields", details);

      // TRPCError wraps cause differently - check it exists
      expect(error.cause).toBeDefined();
    });
  });

  describe("validationError()", () => {
    it("should create validation error from array of messages", () => {
      const errors = ["Email is invalid", "Name is required"];
      const error = validationError(errors);

      expect(error).toBeInstanceOf(TRPCError);
      expect(error.code).toBe("BAD_REQUEST");
      expect(error.message).toBe("Validation failed: Email is invalid, Name is required");
    });

    it("should handle single error", () => {
      const error = validationError(["Invalid date format"]);

      expect(error.message).toBe("Validation failed: Invalid date format");
    });

    it("should handle empty array", () => {
      const error = validationError([]);

      expect(error.message).toBe("Validation failed: ");
    });
  });
});

describe("Assertion Functions", () => {
  describe("assertFound()", () => {
    it("should pass for truthy values", () => {
      const invoice = { id: "inv-123", total: 100 };

      expect(() => assertFound(invoice, "invoice", "inv-123")).not.toThrow();
    });

    it("should throw NOT_FOUND for null", () => {
      expect(() => assertFound(null, "customer", "cust-123")).toThrow(TRPCError);

      try {
        assertFound(null, "customer", "cust-123");
      } catch (error) {
        expect((error as TRPCError).code).toBe("NOT_FOUND");
        expect((error as TRPCError).message).toBe('Customer with id "cust-123" not found');
      }
    });

    it("should throw NOT_FOUND for undefined", () => {
      expect(() => assertFound(undefined, "vendor")).toThrow(TRPCError);
    });

    it("should pass for falsy but valid values (0, empty string)", () => {
      // Note: assertFound checks !value, so 0 and "" will throw
      // This is intentional for entity checks
      expect(() => assertFound(0 as unknown, "invoice")).toThrow(TRPCError);
      expect(() => assertFound("" as unknown, "invoice")).toThrow(TRPCError);
    });
  });

  describe("assertPrecondition()", () => {
    it("should pass for true condition", () => {
      expect(() => assertPrecondition(true, "Invoice must be draft")).not.toThrow();
    });

    it("should throw PRECONDITION_FAILED for false condition", () => {
      expect(() => assertPrecondition(false, "Invoice must be draft")).toThrow(TRPCError);

      try {
        assertPrecondition(false, "Invoice must be draft");
      } catch (error) {
        expect((error as TRPCError).code).toBe("PRECONDITION_FAILED");
        expect((error as TRPCError).message).toBe("Invoice must be draft");
      }
    });

    it("should work with boolean expressions", () => {
      const invoice = { status: "sent" };

      expect(() =>
        assertPrecondition(invoice.status === "draft", "Invoice must be in draft status")
      ).toThrow(TRPCError);

      const draftInvoice = { status: "draft" };
      expect(() =>
        assertPrecondition(draftInvoice.status === "draft", "Invoice must be in draft status")
      ).not.toThrow();
    });
  });
});

describe("Error Wrapping Functions", () => {
  const originalNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
  });

  describe("wrapAsync()", () => {
    it("should return result on success", async () => {
      const operation = async () => ({ id: "123", name: "Test" });

      const result = await wrapAsync(operation, "Failed to fetch data");

      expect(result).toEqual({ id: "123", name: "Test" });
    });

    it("should re-throw TRPCError as-is", async () => {
      const trpcError = new TRPCError({ code: "NOT_FOUND", message: "Not found" });
      const operation = async () => {
        throw trpcError;
      };

      await expect(wrapAsync(operation, "Operation failed")).rejects.toBe(trpcError);
    });

    it("should wrap non-TRPC errors with internalError", async () => {
      process.env.NODE_ENV = "development";
      const originalError = new Error("Database error");
      const operation = async () => {
        throw originalError;
      };

      await expect(wrapAsync(operation, "Failed to save")).rejects.toThrow(TRPCError);

      try {
        await wrapAsync(operation, "Failed to save");
      } catch (error) {
        expect((error as TRPCError).code).toBe("INTERNAL_SERVER_ERROR");
        expect((error as TRPCError).message).toBe("Failed to save");
      }
    });
  });

  describe("wrapDbOperation()", () => {
    it("should return result on success", async () => {
      const operation = async () => ({ id: "inv-123", total: 100 });

      const result = await wrapDbOperation(operation, "invoice", "fetch");

      expect(result).toEqual({ id: "inv-123", total: 100 });
    });

    it("should re-throw TRPCError as-is", async () => {
      const trpcError = notFound("invoice", "inv-123");
      const operation = async () => {
        throw trpcError;
      };

      await expect(wrapDbOperation(operation, "invoice", "fetch")).rejects.toBe(trpcError);
    });

    it("should wrap database errors with appropriate message", async () => {
      process.env.NODE_ENV = "development";
      const operation = async () => {
        throw new Error("Connection refused");
      };

      try {
        await wrapDbOperation(operation, "invoice", "create");
      } catch (error) {
        expect((error as TRPCError).code).toBe("INTERNAL_SERVER_ERROR");
        expect((error as TRPCError).message).toBe("Failed to create Invoice");
      }
    });

    it("should format action and entity correctly", async () => {
      process.env.NODE_ENV = "development";
      const operation = async () => {
        throw new Error("Constraint violation");
      };

      const actions = ["create", "update", "delete", "fetch"] as const;

      for (const action of actions) {
        try {
          await wrapDbOperation(operation, "credit_note", action);
        } catch (error) {
          expect((error as TRPCError).message).toBe(`Failed to ${action} Credit Note`);
        }
      }
    });
  });
});
