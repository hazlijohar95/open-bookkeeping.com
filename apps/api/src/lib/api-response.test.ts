import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import {
  success,
  created,
  deleted,
  list,
  notFound,
  badRequest,
  unauthorized,
  forbidden,
  conflict,
  validationError,
  internalError,
  parseIntSafe,
  HttpStatus,
  ErrorCode,
} from "./api-response";

describe("API Response Utilities", () => {
  let app: Hono;

  beforeEach(() => {
    app = new Hono();
  });

  describe("success()", () => {
    it("should return 200 OK with data", async () => {
      app.get("/test", (c) => {
        const testData = { id: "123", name: "Test" };
        return success(c, testData);
      });

      const res = await app.request("/test");
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.data).toEqual({ id: "123", name: "Test" });
      expect(body.meta).toHaveProperty("requestId");
      expect(body.meta).toHaveProperty("timestamp");
    });

    it("should allow custom status code", async () => {
      app.get("/test", (c) => {
        return success(c, { id: "123" }, HttpStatus.CREATED);
      });

      const res = await app.request("/test");
      expect(res.status).toBe(201);
    });
  });

  describe("created()", () => {
    it("should return 201 Created with data", async () => {
      app.post("/test", (c) => {
        const testData = { id: "new-123", name: "New Item" };
        return created(c, testData);
      });

      const res = await app.request("/test", { method: "POST" });
      expect(res.status).toBe(201);

      const body = await res.json();
      expect(body.data).toEqual({ id: "new-123", name: "New Item" });
    });
  });

  describe("deleted()", () => {
    it("should return 200 OK with deletion confirmation", async () => {
      app.delete("/test/:id", (c) => {
        return deleted(c);
      });

      const res = await app.request("/test/123", { method: "DELETE" });
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.data).toEqual({ deleted: true });
    });
  });

  describe("list()", () => {
    it("should return paginated list with metadata", async () => {
      app.get("/test", (c) => {
        const items = [{ id: "1" }, { id: "2" }, { id: "3" }];
        return list(c, items, { limit: 10, offset: 0, total: 100 });
      });

      const res = await app.request("/test");
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.data).toHaveLength(3);
      expect(body.pagination).toEqual({
        limit: 10,
        offset: 0,
        total: 100,
        hasMore: true,
      });
    });

    it("should set hasMore to false when no more items", async () => {
      app.get("/test", (c) => {
        const items = [{ id: "1" }, { id: "2" }];
        return list(c, items, { limit: 10, offset: 0, total: 2 });
      });

      const res = await app.request("/test");
      const body = await res.json();
      expect(body.pagination.hasMore).toBe(false);
    });

    it("should calculate hasMore without total using limit", async () => {
      app.get("/test", (c) => {
        const items = [{ id: "1" }, { id: "2" }, { id: "3" }];
        // 3 items returned with limit 3 means there might be more
        return list(c, items, { limit: 3, offset: 0 });
      });

      const res = await app.request("/test");
      const body = await res.json();
      expect(body.pagination.hasMore).toBe(true);
    });
  });

  describe("Error Responses", () => {
    describe("notFound()", () => {
      it("should return 404 with resource details", async () => {
        app.get("/test/:id", (c) => {
          return notFound(c, "customer", "cust-123");
        });

        const res = await app.request("/test/cust-123");
        expect(res.status).toBe(404);

        const body = await res.json();
        expect(body.error.code).toBe(ErrorCode.NOT_FOUND);
        expect(body.error.message).toContain("customer");
        expect(body.error.message).toContain("cust-123");
      });

      it("should return 404 without id", async () => {
        app.get("/test", (c) => {
          return notFound(c, "customer");
        });

        const res = await app.request("/test");
        const body = await res.json();
        expect(body.error.message).toBe("customer not found");
      });
    });

    describe("badRequest()", () => {
      it("should return 400 with error message", async () => {
        app.post("/test", (c) => {
          return badRequest(c, "Invalid input format");
        });

        const res = await app.request("/test", { method: "POST" });
        expect(res.status).toBe(400);

        const body = await res.json();
        expect(body.error.code).toBe(ErrorCode.INVALID_REQUEST);
        expect(body.error.message).toBe("Invalid input format");
      });

      it("should include details when provided", async () => {
        app.post("/test", (c) => {
          return badRequest(c, "Validation failed", { field: "email" });
        });

        const res = await app.request("/test", { method: "POST" });
        const body = await res.json();
        expect(body.error.details).toEqual({ field: "email" });
      });
    });

    describe("unauthorized()", () => {
      it("should return 401 with default message", async () => {
        app.get("/test", (c) => {
          return unauthorized(c);
        });

        const res = await app.request("/test");
        expect(res.status).toBe(401);

        const body = await res.json();
        expect(body.error.code).toBe(ErrorCode.UNAUTHORIZED);
        expect(body.error.message).toBe("Authentication required");
      });

      it("should return 401 with custom message", async () => {
        app.get("/test", (c) => {
          return unauthorized(c, "Token expired");
        });

        const res = await app.request("/test");
        const body = await res.json();
        expect(body.error.message).toBe("Token expired");
      });
    });

    describe("forbidden()", () => {
      it("should return 403 with default message", async () => {
        app.get("/test", (c) => {
          return forbidden(c);
        });

        const res = await app.request("/test");
        expect(res.status).toBe(403);

        const body = await res.json();
        expect(body.error.code).toBe(ErrorCode.INSUFFICIENT_PERMISSIONS);
        expect(body.error.message).toBe("Insufficient permissions");
      });

      it("should return 403 with custom message", async () => {
        app.get("/test", (c) => {
          return forbidden(c, "Cannot delete invoices");
        });

        const res = await app.request("/test");
        const body = await res.json();
        expect(body.error.message).toBe("Cannot delete invoices");
      });
    });

    describe("conflict()", () => {
      it("should return 409 with conflict message", async () => {
        app.post("/test", (c) => {
          return conflict(c, "Email already exists");
        });

        const res = await app.request("/test", { method: "POST" });
        expect(res.status).toBe(409);

        const body = await res.json();
        expect(body.error.code).toBe(ErrorCode.CONFLICT);
        expect(body.error.message).toBe("Email already exists");
      });
    });

    describe("validationError()", () => {
      it("should return 400 with validation details", async () => {
        app.post("/test", (c) => {
          const errors = [
            { path: "email", message: "Invalid email format" },
            { path: "name", message: "Name is required" },
          ];
          return validationError(c, errors);
        });

        const res = await app.request("/test", { method: "POST" });
        expect(res.status).toBe(400);

        const body = await res.json();
        expect(body.error.code).toBe(ErrorCode.VALIDATION_ERROR);
        expect(body.error.message).toBe("Validation failed");
        expect(body.error.details).toHaveLength(2);
      });
    });

    describe("internalError()", () => {
      it("should return 500 with default message", async () => {
        app.get("/test", (c) => {
          return internalError(c);
        });

        const res = await app.request("/test");
        expect(res.status).toBe(500);

        const body = await res.json();
        expect(body.error.code).toBe(ErrorCode.INTERNAL_ERROR);
        expect(body.error.message).toBe("An internal error occurred");
      });

      it("should return 500 with custom message", async () => {
        app.get("/test", (c) => {
          return internalError(c, "Database connection failed");
        });

        const res = await app.request("/test");
        const body = await res.json();
        expect(body.error.message).toBe("Database connection failed");
      });
    });
  });

  describe("parseIntSafe()", () => {
    it("should parse valid integer string", () => {
      expect(parseIntSafe("42", 10)).toBe(42);
    });

    it("should return default for undefined input", () => {
      expect(parseIntSafe(undefined, 10)).toBe(10);
    });

    it("should return default for null input", () => {
      expect(parseIntSafe(null, 10)).toBe(10);
    });

    it("should return default for empty string", () => {
      expect(parseIntSafe("", 10)).toBe(10);
    });

    it("should return default for whitespace string", () => {
      expect(parseIntSafe("   ", 10)).toBe(10);
    });

    it("should return default for NaN-producing input", () => {
      expect(parseIntSafe("abc", 10)).toBe(10);
    });

    it("should respect min constraint", () => {
      expect(parseIntSafe("5", 10, { min: 10 })).toBe(10);
    });

    it("should respect max constraint", () => {
      expect(parseIntSafe("100", 10, { max: 50 })).toBe(50);
    });

    it("should apply both min and max constraints", () => {
      expect(parseIntSafe("5", 10, { min: 1, max: 100 })).toBe(5);
      expect(parseIntSafe("0", 10, { min: 1, max: 100 })).toBe(1);
      expect(parseIntSafe("150", 10, { min: 1, max: 100 })).toBe(100);
    });

    it("should handle negative numbers", () => {
      expect(parseIntSafe("-5", 10)).toBe(-5);
    });

    it("should truncate decimal values", () => {
      expect(parseIntSafe("42.9", 10)).toBe(42);
    });
  });

  describe("HttpStatus enum", () => {
    it("should have correct status codes", () => {
      expect(HttpStatus.OK).toBe(200);
      expect(HttpStatus.CREATED).toBe(201);
      expect(HttpStatus.BAD_REQUEST).toBe(400);
      expect(HttpStatus.UNAUTHORIZED).toBe(401);
      expect(HttpStatus.FORBIDDEN).toBe(403);
      expect(HttpStatus.NOT_FOUND).toBe(404);
      expect(HttpStatus.CONFLICT).toBe(409);
      expect(HttpStatus.UNPROCESSABLE_ENTITY).toBe(422);
      expect(HttpStatus.TOO_MANY_REQUESTS).toBe(429);
      expect(HttpStatus.INTERNAL_SERVER_ERROR).toBe(500);
    });
  });

  describe("ErrorCode enum", () => {
    it("should have correct error codes", () => {
      expect(ErrorCode.UNAUTHORIZED).toBe("UNAUTHORIZED");
      expect(ErrorCode.NOT_FOUND).toBe("NOT_FOUND");
      expect(ErrorCode.INVALID_REQUEST).toBe("INVALID_REQUEST");
      expect(ErrorCode.VALIDATION_ERROR).toBe("VALIDATION_ERROR");
      expect(ErrorCode.CONFLICT).toBe("CONFLICT");
      expect(ErrorCode.INTERNAL_ERROR).toBe("INTERNAL_ERROR");
      expect(ErrorCode.INSUFFICIENT_PERMISSIONS).toBe("INSUFFICIENT_PERMISSIONS");
    });
  });
});
