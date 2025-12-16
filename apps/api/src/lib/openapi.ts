/**
 * OpenAPI Specification Generator
 * Generates OpenAPI 3.0 spec from Zod schemas for API documentation
 */

import {
  OpenAPIRegistry,
  OpenApiGeneratorV3,
  extendZodWithOpenApi,
} from "@asteasolutions/zod-to-openapi";
import { z } from "zod";

// Extend Zod with OpenAPI methods
extendZodWithOpenApi(z);

// Create registry for all schemas
export const registry = new OpenAPIRegistry();

// ============================================
// COMMON SCHEMAS
// ============================================

const metaSchema = z
  .object({
    requestId: z.string().openapi({ example: "req_abc123def456" }),
    timestamp: z
      .string()
      .datetime()
      .openapi({ example: "2025-01-15T10:30:00.000Z" }),
  })
  .openapi("Meta");

const paginationSchema = z
  .object({
    total: z.number().optional().openapi({ example: 150 }),
    limit: z.number().openapi({ example: 20 }),
    offset: z.number().openapi({ example: 0 }),
    hasMore: z.boolean().openapi({ example: true }),
  })
  .openapi("Pagination");

const errorSchema = z
  .object({
    code: z.string().openapi({ example: "NOT_FOUND" }),
    message: z.string().openapi({ example: "Resource not found" }),
    details: z.unknown().optional(),
  })
  .openapi("Error");

// Register common schemas
registry.register("Meta", metaSchema);
registry.register("Pagination", paginationSchema);
registry.register("Error", errorSchema);

// ============================================
// CUSTOMER SCHEMAS
// ============================================

const customerSchema = z
  .object({
    id: z
      .string()
      .uuid()
      .openapi({ example: "550e8400-e29b-41d4-a716-446655440000" }),
    name: z.string().openapi({ example: "Acme Corporation Sdn Bhd" }),
    email: z
      .string()
      .email()
      .nullable()
      .openapi({ example: "contact@acme.com" }),
    phone: z.string().nullable().openapi({ example: "+60123456789" }),
    address: z
      .string()
      .nullable()
      .openapi({ example: "123 Jalan Bukit Bintang, 55100 Kuala Lumpur" }),
    taxId: z.string().nullable().openapi({ example: "C12345678901" }),
    createdAt: z
      .string()
      .datetime()
      .openapi({ example: "2025-01-01T00:00:00.000Z" }),
    updatedAt: z
      .string()
      .datetime()
      .openapi({ example: "2025-01-15T10:30:00.000Z" }),
  })
  .openapi("Customer");

const createCustomerSchema = z
  .object({
    name: z
      .string()
      .min(1)
      .max(255)
      .openapi({ example: "New Customer Sdn Bhd" }),
    email: z.string().email().max(255).optional().nullable(),
    phone: z.string().max(50).optional().nullable(),
    address: z.string().max(1000).optional().nullable(),
    taxId: z.string().max(50).optional().nullable(),
  })
  .openapi("CreateCustomer");

registry.register("Customer", customerSchema);
registry.register("CreateCustomer", createCustomerSchema);

// ============================================
// INVOICE SCHEMAS
// ============================================

const invoiceItemSchema = z
  .object({
    name: z.string().openapi({ example: "Web Development Services" }),
    description: z
      .string()
      .optional()
      .openapi({ example: "Frontend development for e-commerce site" }),
    quantity: z.number().openapi({ example: 10 }),
    unitPrice: z.number().openapi({ example: 500 }),
  })
  .openapi("InvoiceItem");

const invoiceThemeSchema = z
  .object({
    baseColor: z.string().openapi({ example: "#1a365d" }),
    mode: z.enum(["dark", "light"]).openapi({ example: "light" }),
    template: z
      .enum(["default", "cynco", "classic", "zen", "executive"])
      .optional(),
  })
  .openapi("InvoiceTheme");

const invoiceSchema = z
  .object({
    id: z.string().uuid(),
    invoiceNumber: z.string().openapi({ example: "INV-2025-0001" }),
    status: z.enum(["pending", "success", "error", "expired", "refunded"]),
    totalAmount: z.string().openapi({ example: "5000.00" }),
    currency: z.string().openapi({ example: "MYR" }),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .openapi("Invoice");

const createInvoiceSchema = z
  .object({
    customerId: z.string().uuid().optional(),
    companyDetails: z.object({
      name: z.string().openapi({ example: "My Company Sdn Bhd" }),
      address: z
        .string()
        .openapi({ example: "456 Business Park, 47800 Petaling Jaya" }),
      logo: z.string().url().optional().nullable(),
      signature: z.string().url().optional().nullable(),
    }),
    clientDetails: z.object({
      name: z.string().openapi({ example: "Client Company" }),
      address: z
        .string()
        .openapi({ example: "789 Client Street, 50450 Kuala Lumpur" }),
    }),
    invoiceDetails: z.object({
      theme: invoiceThemeSchema.optional(),
      currency: z.string().openapi({ example: "MYR" }),
      prefix: z.string().openapi({ example: "INV" }),
      serialNumber: z.string().openapi({ example: "2025-0001" }),
      date: z.string().datetime(),
      dueDate: z.string().datetime().optional().nullable(),
      paymentTerms: z.string().optional(),
    }),
    items: z.array(invoiceItemSchema).min(1),
    metadata: z
      .object({
        notes: z.string().optional(),
        terms: z.string().optional(),
      })
      .optional(),
  })
  .openapi("CreateInvoice");

registry.register("Invoice", invoiceSchema);
registry.register("InvoiceItem", invoiceItemSchema);
registry.register("CreateInvoice", createInvoiceSchema);

// ============================================
// VENDOR SCHEMAS
// ============================================

const vendorSchema = z
  .object({
    id: z.string().uuid(),
    name: z.string().openapi({ example: "Supplier Company Sdn Bhd" }),
    email: z.string().email().nullable(),
    phone: z.string().nullable(),
    address: z.string().nullable(),
    taxId: z.string().nullable(),
    bankAccountNumber: z.string().nullable().openapi({
      example: "****5678",
      description: "Masked bank account number (last 4 digits only)",
    }),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .openapi("Vendor");

const createVendorSchema = z
  .object({
    name: z.string().min(1).max(255),
    email: z.string().email().max(255).optional().nullable(),
    phone: z.string().max(50).optional().nullable(),
    address: z.string().max(1000).optional().nullable(),
    taxId: z.string().max(50).optional().nullable(),
    bankName: z.string().max(255).optional().nullable(),
    bankAccountNumber: z.string().max(50).optional().nullable(),
  })
  .openapi("CreateVendor");

registry.register("Vendor", vendorSchema);
registry.register("CreateVendor", createVendorSchema);

// ============================================
// QUOTATION SCHEMAS
// ============================================

const quotationSchema = z
  .object({
    id: z.string().uuid(),
    quotationNumber: z.string().openapi({ example: "QUO-2025-0001" }),
    status: z.enum([
      "draft",
      "sent",
      "accepted",
      "rejected",
      "expired",
      "converted",
    ]),
    totalAmount: z.string().openapi({ example: "3500.00" }),
    currency: z.string().openapi({ example: "MYR" }),
    validUntil: z.string().datetime().nullable(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .openapi("Quotation");

registry.register("Quotation", quotationSchema);

// ============================================
// BILL SCHEMAS
// ============================================

const billSchema = z
  .object({
    id: z.string().uuid(),
    billNumber: z.string().openapi({ example: "BILL-2025-0001" }),
    status: z.enum(["draft", "pending", "paid", "overdue", "cancelled"]),
    totalAmount: z.string().openapi({ example: "2500.00" }),
    currency: z.string().openapi({ example: "MYR" }),
    billDate: z.string().datetime(),
    dueDate: z.string().datetime().nullable(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .openapi("Bill");

registry.register("Bill", billSchema);

// ============================================
// ACCOUNT SCHEMAS
// ============================================

const accountSchema = z
  .object({
    id: z.string().uuid(),
    code: z.string().openapi({ example: "1100" }),
    name: z.string().openapi({ example: "Cash and Bank" }),
    accountType: z.enum(["asset", "liability", "equity", "revenue", "expense"]),
    normalBalance: z.enum(["debit", "credit"]),
    isActive: z.boolean(),
    parentId: z.string().uuid().nullable(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .openapi("Account");

const createAccountSchema = z
  .object({
    code: z.string().min(1).max(20).openapi({ example: "1150" }),
    name: z.string().min(1).max(255).openapi({ example: "Petty Cash" }),
    accountType: z.enum(["asset", "liability", "equity", "revenue", "expense"]),
    normalBalance: z.enum(["debit", "credit"]),
    parentId: z.string().uuid().optional(),
    description: z.string().max(500).optional(),
  })
  .openapi("CreateAccount");

registry.register("Account", accountSchema);
registry.register("CreateAccount", createAccountSchema);

// ============================================
// WEBHOOK SCHEMAS
// ============================================

const webhookSchema = z
  .object({
    id: z.string().uuid(),
    url: z
      .string()
      .url()
      .openapi({ example: "https://example.com/webhooks/open-bookkeeping" }),
    events: z.array(z.string()).openapi({
      example: ["invoice.created", "invoice.paid", "customer.created"],
    }),
    isActive: z.boolean(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .openapi("Webhook");

const createWebhookSchema = z
  .object({
    url: z.string().url().max(500),
    events: z
      .array(z.string())
      .min(1)
      .openapi({
        description: "List of event types to subscribe to",
        example: ["invoice.created", "invoice.paid"],
      }),
    description: z.string().max(500).optional(),
  })
  .openapi("CreateWebhook");

const webhookCreatedSchema = z
  .object({
    id: z.string().uuid(),
    url: z.string().url(),
    secret: z.string().openapi({
      example: "whsec_abc123def456...",
      description: "Webhook signing secret (only shown once on creation)",
    }),
    events: z.array(z.string()),
    isActive: z.boolean(),
    createdAt: z.string().datetime(),
    message: z
      .string()
      .openapi({
        example: "Store the secret securely - it will not be shown again",
      }),
  })
  .openapi("WebhookCreated");

registry.register("Webhook", webhookSchema);
registry.register("CreateWebhook", createWebhookSchema);
registry.register("WebhookCreated", webhookCreatedSchema);

// ============================================
// API PATHS
// ============================================

// Customers
registry.registerPath({
  method: "get",
  path: "/api/v1/customers",
  tags: ["Customers"],
  summary: "List customers",
  description: "Retrieve a paginated list of customers",
  security: [{ apiKey: [] }],
  request: {
    query: z.object({
      limit: z.coerce.number().min(1).max(100).default(20).optional(),
      offset: z.coerce.number().min(0).default(0).optional(),
    }),
  },
  responses: {
    200: {
      description: "Successful response",
      content: {
        "application/json": {
          schema: z.object({
            data: z.array(customerSchema),
            pagination: paginationSchema,
            meta: metaSchema,
          }),
        },
      },
    },
    401: {
      description: "Unauthorized - Invalid or missing API key",
    },
  },
});

registry.registerPath({
  method: "post",
  path: "/api/v1/customers",
  tags: ["Customers"],
  summary: "Create customer",
  description: "Create a new customer",
  security: [{ apiKey: [] }],
  request: {
    body: {
      content: {
        "application/json": {
          schema: createCustomerSchema,
        },
      },
    },
  },
  responses: {
    201: {
      description: "Customer created",
      content: {
        "application/json": {
          schema: z.object({
            data: customerSchema,
            meta: metaSchema,
          }),
        },
      },
    },
    400: {
      description: "Validation error",
    },
    401: {
      description: "Unauthorized",
    },
  },
});

registry.registerPath({
  method: "get",
  path: "/api/v1/customers/{id}",
  tags: ["Customers"],
  summary: "Get customer",
  description: "Retrieve a single customer by ID",
  security: [{ apiKey: [] }],
  request: {
    params: z.object({
      id: z.string().uuid(),
    }),
  },
  responses: {
    200: {
      description: "Successful response",
      content: {
        "application/json": {
          schema: z.object({
            data: customerSchema,
            meta: metaSchema,
          }),
        },
      },
    },
    404: {
      description: "Customer not found",
    },
  },
});

// Invoices
registry.registerPath({
  method: "get",
  path: "/api/v1/invoices",
  tags: ["Invoices"],
  summary: "List invoices",
  description: "Retrieve a paginated list of invoices",
  security: [{ apiKey: [] }],
  request: {
    query: z.object({
      limit: z.coerce.number().min(1).max(100).default(20).optional(),
      offset: z.coerce.number().min(0).default(0).optional(),
    }),
  },
  responses: {
    200: {
      description: "Successful response",
      content: {
        "application/json": {
          schema: z.object({
            data: z.array(invoiceSchema),
            pagination: paginationSchema,
            meta: metaSchema,
          }),
        },
      },
    },
  },
});

registry.registerPath({
  method: "post",
  path: "/api/v1/invoices",
  tags: ["Invoices"],
  summary: "Create invoice",
  description: "Create a new invoice with line items",
  security: [{ apiKey: [] }],
  request: {
    body: {
      content: {
        "application/json": {
          schema: createInvoiceSchema,
        },
      },
    },
  },
  responses: {
    201: {
      description: "Invoice created",
      content: {
        "application/json": {
          schema: z.object({
            data: z.object({
              invoiceId: z.string().uuid(),
              invoiceNumber: z.string(),
            }),
            meta: metaSchema,
          }),
        },
      },
    },
    400: {
      description: "Validation error",
    },
  },
});

registry.registerPath({
  method: "get",
  path: "/api/v1/invoices/{id}",
  tags: ["Invoices"],
  summary: "Get invoice",
  description: "Retrieve a single invoice with full details",
  security: [{ apiKey: [] }],
  request: {
    params: z.object({
      id: z.string().uuid(),
    }),
  },
  responses: {
    200: {
      description: "Successful response",
    },
    404: {
      description: "Invoice not found",
    },
  },
});

registry.registerPath({
  method: "patch",
  path: "/api/v1/invoices/{id}/status",
  tags: ["Invoices"],
  summary: "Update invoice status",
  description: "Update the status of an invoice",
  security: [{ apiKey: [] }],
  request: {
    params: z.object({
      id: z.string().uuid(),
    }),
    body: {
      content: {
        "application/json": {
          schema: z.object({
            status: z.enum([
              "pending",
              "success",
              "error",
              "expired",
              "refunded",
            ]),
          }),
        },
      },
    },
  },
  responses: {
    200: {
      description: "Status updated",
    },
    404: {
      description: "Invoice not found",
    },
  },
});

// Vendors
registry.registerPath({
  method: "get",
  path: "/api/v1/vendors",
  tags: ["Vendors"],
  summary: "List vendors",
  description: "Retrieve a paginated list of vendors (bank details are masked)",
  security: [{ apiKey: [] }],
  responses: {
    200: {
      description: "Successful response",
      content: {
        "application/json": {
          schema: z.object({
            data: z.array(vendorSchema),
            pagination: paginationSchema,
            meta: metaSchema,
          }),
        },
      },
    },
  },
});

registry.registerPath({
  method: "post",
  path: "/api/v1/vendors",
  tags: ["Vendors"],
  summary: "Create vendor",
  description: "Create a new vendor/supplier",
  security: [{ apiKey: [] }],
  request: {
    body: {
      content: {
        "application/json": {
          schema: createVendorSchema,
        },
      },
    },
  },
  responses: {
    201: {
      description: "Vendor created",
    },
  },
});

// Quotations
registry.registerPath({
  method: "get",
  path: "/api/v1/quotations",
  tags: ["Quotations"],
  summary: "List quotations",
  description: "Retrieve a paginated list of quotations",
  security: [{ apiKey: [] }],
  responses: {
    200: {
      description: "Successful response",
      content: {
        "application/json": {
          schema: z.object({
            data: z.array(quotationSchema),
            pagination: paginationSchema,
            meta: metaSchema,
          }),
        },
      },
    },
  },
});

registry.registerPath({
  method: "post",
  path: "/api/v1/quotations/{id}/convert",
  tags: ["Quotations"],
  summary: "Convert to invoice",
  description: "Convert an accepted quotation to an invoice",
  security: [{ apiKey: [] }],
  request: {
    params: z.object({
      id: z.string().uuid(),
    }),
  },
  responses: {
    200: {
      description: "Quotation converted",
      content: {
        "application/json": {
          schema: z.object({
            data: z.object({
              invoiceId: z.string().uuid(),
              quotationId: z.string().uuid(),
            }),
            meta: metaSchema,
          }),
        },
      },
    },
    400: {
      description:
        "Cannot convert quotation (not accepted or already converted)",
    },
    404: {
      description: "Quotation not found",
    },
  },
});

// Bills
registry.registerPath({
  method: "get",
  path: "/api/v1/bills",
  tags: ["Bills"],
  summary: "List bills",
  description: "Retrieve a paginated list of bills (accounts payable)",
  security: [{ apiKey: [] }],
  responses: {
    200: {
      description: "Successful response",
      content: {
        "application/json": {
          schema: z.object({
            data: z.array(billSchema),
            pagination: paginationSchema,
            meta: metaSchema,
          }),
        },
      },
    },
  },
});

// Accounts
registry.registerPath({
  method: "get",
  path: "/api/v1/accounts",
  tags: ["Accounts"],
  summary: "List accounts",
  description: "Retrieve chart of accounts",
  security: [{ apiKey: [] }],
  request: {
    query: z.object({
      type: z
        .enum(["asset", "liability", "equity", "revenue", "expense"])
        .optional(),
      active: z.string().optional(),
    }),
  },
  responses: {
    200: {
      description: "Successful response",
      content: {
        "application/json": {
          schema: z.object({
            data: z.array(accountSchema),
            pagination: paginationSchema,
            meta: metaSchema,
          }),
        },
      },
    },
  },
});

registry.registerPath({
  method: "get",
  path: "/api/v1/accounts/tree",
  tags: ["Accounts"],
  summary: "Get account tree",
  description: "Retrieve chart of accounts as hierarchical tree",
  security: [{ apiKey: [] }],
  responses: {
    200: {
      description: "Successful response with hierarchical account structure",
    },
  },
});

registry.registerPath({
  method: "post",
  path: "/api/v1/accounts",
  tags: ["Accounts"],
  summary: "Create account",
  description: "Create a new account in the chart of accounts",
  security: [{ apiKey: [] }],
  request: {
    body: {
      content: {
        "application/json": {
          schema: createAccountSchema,
        },
      },
    },
  },
  responses: {
    201: {
      description: "Account created",
    },
  },
});

// Webhooks
registry.registerPath({
  method: "get",
  path: "/api/v1/webhooks",
  tags: ["Webhooks"],
  summary: "List webhooks",
  description: "List all registered webhooks for your account",
  security: [{ apiKey: [] }],
  responses: {
    200: {
      description: "Successful response",
      content: {
        "application/json": {
          schema: z.object({
            data: z.array(webhookSchema),
            pagination: paginationSchema,
            meta: metaSchema,
          }),
        },
      },
    },
  },
});

registry.registerPath({
  method: "get",
  path: "/api/v1/webhooks/events",
  tags: ["Webhooks"],
  summary: "List available events",
  description: "Get list of all available webhook event types",
  security: [{ apiKey: [] }],
  responses: {
    200: {
      description: "Successful response",
      content: {
        "application/json": {
          schema: z.object({
            data: z.object({
              events: z.array(z.string()),
              grouped: z.record(z.string(), z.array(z.string())),
            }),
            meta: metaSchema,
          }),
        },
      },
    },
  },
});

registry.registerPath({
  method: "post",
  path: "/api/v1/webhooks",
  tags: ["Webhooks"],
  summary: "Create webhook",
  description:
    "Register a new webhook endpoint. The signing secret is only shown once.",
  security: [{ apiKey: [] }],
  request: {
    body: {
      content: {
        "application/json": {
          schema: createWebhookSchema,
        },
      },
    },
  },
  responses: {
    201: {
      description: "Webhook created (secret shown only once)",
      content: {
        "application/json": {
          schema: z.object({
            data: webhookCreatedSchema,
            meta: metaSchema,
          }),
        },
      },
    },
  },
});

registry.registerPath({
  method: "post",
  path: "/api/v1/webhooks/{id}/rotate-secret",
  tags: ["Webhooks"],
  summary: "Rotate webhook secret",
  description:
    "Generate a new signing secret for a webhook. The old secret will be invalidated.",
  security: [{ apiKey: [] }],
  request: {
    params: z.object({
      id: z.string().uuid(),
    }),
  },
  responses: {
    200: {
      description: "New secret generated",
      content: {
        "application/json": {
          schema: z.object({
            data: z.object({
              id: z.string().uuid(),
              secret: z.string(),
              message: z.string(),
            }),
            meta: metaSchema,
          }),
        },
      },
    },
    404: {
      description: "Webhook not found",
    },
  },
});

// ============================================
// SECURITY SCHEMES
// ============================================

registry.registerComponent("securitySchemes", "apiKey", {
  type: "apiKey",
  in: "header",
  name: "X-API-Key",
  description:
    "API key for authentication. Get your key from the Developer Portal.",
});

// Also support Bearer token format
registry.registerComponent("securitySchemes", "bearerAuth", {
  type: "http",
  scheme: "bearer",
  description: "API key as Bearer token: 'Bearer ob_live_xxxx'",
});

// ============================================
// GENERATE SPEC
// ============================================

export function generateOpenApiSpec() {
  const generator = new OpenApiGeneratorV3(registry.definitions);

  return generator.generateDocument({
    openapi: "3.0.3",
    info: {
      title: "Open Bookkeeping API",
      version: "1.0.0",
      description: `
## Overview

The Open Bookkeeping API provides programmatic access to invoicing, accounting, and bookkeeping functionality for Malaysian businesses.

## Authentication

All API requests require authentication via API key. You can pass your API key in one of two ways:

### Header (Recommended)
\`\`\`
X-API-Key: ob_live_xxxxxxxxxxxx
\`\`\`

### Bearer Token
\`\`\`
Authorization: Bearer ob_live_xxxxxxxxxxxx
\`\`\`

## Rate Limits

- **Default**: 1000 requests per hour
- **Burst**: 100 requests per minute

Rate limit headers are included in all responses:
- \`X-RateLimit-Limit\`: Request limit
- \`X-RateLimit-Remaining\`: Remaining requests
- \`X-RateLimit-Reset\`: Reset timestamp

## Response Format

All responses follow a consistent envelope format:

### Success Response
\`\`\`json
{
  "data": { ... },
  "meta": {
    "requestId": "req_abc123",
    "timestamp": "2025-01-15T10:30:00Z"
  }
}
\`\`\`

### List Response
\`\`\`json
{
  "data": [ ... ],
  "pagination": {
    "total": 150,
    "limit": 20,
    "offset": 0,
    "hasMore": true
  },
  "meta": { ... }
}
\`\`\`

### Error Response
\`\`\`json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Resource not found"
  },
  "meta": { ... }
}
\`\`\`

## Webhooks

Subscribe to real-time events for invoices, customers, and more. Webhook payloads are signed with HMAC-SHA256.

Verify webhook signatures:
\`\`\`
signature = HMAC-SHA256(webhook_secret, request_body)
\`\`\`

## Support

- Documentation: https://docs.open-bookkeeping.com
- Support: support@open-bookkeeping.com
      `.trim(),
      contact: {
        name: "Open Bookkeeping Support",
        email: "support@open-bookkeeping.com",
      },
      license: {
        name: "MIT",
        url: "https://opensource.org/licenses/MIT",
      },
    },
    servers: [
      {
        url: "http://localhost:3001",
        description: "Development server",
      },
      {
        url: "https://api.open-bookkeeping.com",
        description: "Production server",
      },
    ],
    tags: [
      { name: "Customers", description: "Customer management" },
      { name: "Invoices", description: "Invoice creation and management" },
      { name: "Vendors", description: "Vendor/supplier management" },
      { name: "Quotations", description: "Quotation management" },
      { name: "Bills", description: "Bills/accounts payable management" },
      {
        name: "Accounts",
        description: "Chart of accounts and journal entries",
      },
      { name: "Webhooks", description: "Webhook subscription management" },
    ],
    externalDocs: {
      description: "Full API Documentation",
      url: "https://docs.open-bookkeeping.com",
    },
  });
}

export const openApiSpec = generateOpenApiSpec();
