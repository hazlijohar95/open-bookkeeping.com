# Open Bookkeeping SDK

<div align="center">

![npm version](https://img.shields.io/npm/v/@open-bookkeeping/sdk)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue)
![License](https://img.shields.io/badge/license-MIT-green)

**Official TypeScript SDK for the Open Bookkeeping API**

[Getting Started](#getting-started) •
[API Reference](#api-reference) •
[Webhooks](#webhooks) •
[Error Handling](#error-handling) •
[Examples](#examples)

</div>

---

## Installation

```bash
# npm
npm install @open-bookkeeping/sdk

# yarn
yarn add @open-bookkeeping/sdk

# pnpm
pnpm add @open-bookkeeping/sdk
```

---

## Getting Started

```typescript
import { OpenBookkeeping } from '@open-bookkeeping/sdk';

const client = new OpenBookkeeping({
  apiKey: 'ob_live_xxxxxxxxxxxxxxxxxxxxxxxx',
});

// List your invoices
const { data: invoices } = await client.invoices.list({ limit: 10 });

// Create a customer
const customer = await client.customers.create({
  name: 'Acme Corporation',
  email: 'billing@acme.com',
});
```

---

## Configuration

```typescript
const client = new OpenBookkeeping({
  // Required: Your API key from the Developer Portal
  apiKey: 'ob_live_xxxxxxxxxxxxxxxxxxxxxxxx',

  // Optional: Custom base URL (default: https://api.open-bookkeeping.com)
  baseUrl: 'https://api.open-bookkeeping.com',

  // Optional: Request timeout in ms (default: 30000)
  timeout: 30000,

  // Optional: Number of retries for failed requests (default: 3)
  retries: 3,

  // Optional: Error callback for logging/monitoring
  onError: (error) => {
    console.error('API Error:', error.code, error.message);
  },
});
```

---

## API Reference

### Invoices

```typescript
// List invoices with filters
const { data, pagination } = await client.invoices.list({
  status: 'draft',
  customerId: 'cust_xxx',
  fromDate: '2024-01-01',
  toDate: '2024-12-31',
  limit: 20,
  offset: 0,
});

// Get a single invoice
const invoice = await client.invoices.retrieve('inv_xxx');

// Create an invoice
const invoice = await client.invoices.create({
  invoiceNumber: 'INV-001',
  customerId: 'cust_xxx',
  issueDate: '2024-01-15',
  dueDate: '2024-02-15',
  lineItems: [
    { description: 'Web Development', quantity: 10, unitPrice: 150 },
    { description: 'Hosting (Annual)', quantity: 1, unitPrice: 500 },
  ],
});

// Update an invoice
const updated = await client.invoices.update('inv_xxx', {
  notes: 'Updated payment terms',
});

// Delete an invoice
await client.invoices.del('inv_xxx');

// Send invoice to customer
await client.invoices.send('inv_xxx', { email: 'customer@example.com' });

// Mark as paid
await client.invoices.markPaid('inv_xxx', {
  paymentDate: '2024-01-20',
  paymentMethod: 'bank_transfer',
  reference: 'TXN-12345',
});

// Void an invoice
await client.invoices.void('inv_xxx', 'Customer requested cancellation');

// Get PDF download URL
const { url, expiresAt } = await client.invoices.getPdfUrl('inv_xxx');
```

### Customers

```typescript
// List customers
const { data } = await client.customers.list({ search: 'Acme' });

// Get customer
const customer = await client.customers.retrieve('cust_xxx');

// Create customer
const customer = await client.customers.create({
  name: 'Acme Corporation',
  email: 'billing@acme.com',
  phone: '+60123456789',
  taxId: 'C12345678',
  address: '123 Business Street',
  city: 'Kuala Lumpur',
  state: 'Wilayah Persekutuan',
  postalCode: '50000',
  country: 'Malaysia',
});

// Update customer
await client.customers.update('cust_xxx', { email: 'new@acme.com' });

// Delete customer
await client.customers.del('cust_xxx');

// Get customer's invoices
const { data } = await client.customers.getInvoices('cust_xxx');

// Get customer's quotations
const { data } = await client.customers.getQuotations('cust_xxx');
```

### Vendors

```typescript
// List vendors
const { data } = await client.vendors.list({ isActive: true });

// Get vendor
const vendor = await client.vendors.retrieve('vnd_xxx');

// Create vendor
const vendor = await client.vendors.create({
  name: 'Office Supplies Co.',
  email: 'accounts@supplies.com',
  paymentTerms: 'Net 30',
});

// Update vendor
await client.vendors.update('vnd_xxx', { paymentTerms: 'Net 45' });

// Delete vendor
await client.vendors.del('vnd_xxx');

// Get vendor's bills
const { data } = await client.vendors.getBills('vnd_xxx');
```

### Quotations

```typescript
// List quotations
const { data } = await client.quotations.list({ status: 'sent' });

// Get quotation
const quotation = await client.quotations.retrieve('quo_xxx');

// Create quotation
const quotation = await client.quotations.create({
  quotationNumber: 'QUO-001',
  customerId: 'cust_xxx',
  issueDate: '2024-01-15',
  expiryDate: '2024-02-15',
  lineItems: [
    { description: 'Consulting Services', quantity: 20, unitPrice: 200 },
  ],
});

// Send quotation
await client.quotations.send('quo_xxx');

// Mark as accepted
await client.quotations.accept('quo_xxx');

// Mark as rejected
await client.quotations.reject('quo_xxx', 'Budget constraints');

// Convert to invoice
const invoice = await client.quotations.convertToInvoice('quo_xxx');
```

### Bills

```typescript
// List bills
const { data } = await client.bills.list({ status: 'draft' });

// Get bill
const bill = await client.bills.retrieve('bill_xxx');

// Create bill
const bill = await client.bills.create({
  billNumber: 'BILL-001',
  vendorId: 'vnd_xxx',
  issueDate: '2024-01-15',
  dueDate: '2024-02-15',
  lineItems: [
    { description: 'Office Supplies', quantity: 1, unitPrice: 250 },
  ],
});

// Mark as paid
await client.bills.markPaid('bill_xxx', {
  paymentDate: '2024-01-20',
  paymentMethod: 'bank_transfer',
});
```

### Accounts (Chart of Accounts)

```typescript
// List accounts
const { data } = await client.accounts.list({ type: 'expense' });

// Get account
const account = await client.accounts.retrieve('acc_xxx');

// Create account
const account = await client.accounts.create({
  code: '5100',
  name: 'Marketing Expenses',
  type: 'expense',
  description: 'All marketing related costs',
});

// Get account balance
const { balance, asOf } = await client.accounts.getBalance('acc_xxx');

// Get account transactions
const { data } = await client.accounts.getTransactions('acc_xxx', {
  fromDate: '2024-01-01',
  toDate: '2024-12-31',
});
```

### Products

```typescript
// List products
const { data } = await client.products.list({ category: 'Services' });

// Get product
const product = await client.products.retrieve('prod_xxx');

// Create product
const product = await client.products.create({
  name: 'Web Development',
  description: 'Custom web development services',
  unitPrice: 150,
  unit: 'hour',
  taxRate: 6,
});

// Update product
await client.products.update('prod_xxx', { unitPrice: 175 });
```

### Company Profile

```typescript
// Get company profile
const company = await client.company.retrieve();

// Update company profile
await client.company.update({
  name: 'My Company Sdn Bhd',
  taxId: 'C12345678',
  defaultCurrency: 'MYR',
});

// Upload company logo
const logoFile = new Blob([...], { type: 'image/png' });
const { logoUrl } = await client.company.uploadLogo(logoFile);
```

---

## Webhooks

Receive real-time notifications when events occur in your account.

### Verifying Webhook Signatures

```typescript
import {
  constructWebhookEvent,
  verifyWebhookSignature
} from '@open-bookkeeping/sdk/webhooks';

// Express.js example
app.post('/webhooks', express.raw({ type: 'application/json' }), async (req, res) => {
  const signature = req.headers['x-webhook-signature'];
  const timestamp = req.headers['x-webhook-timestamp'];

  try {
    const event = await constructWebhookEvent(
      req.body,
      signature,
      timestamp,
      process.env.WEBHOOK_SECRET
    );

    // Handle the event
    switch (event.event) {
      case 'invoice.created':
        console.log('Invoice created:', event.data.id);
        break;
      case 'invoice.paid':
        console.log('Invoice paid:', event.data.id);
        break;
      case 'customer.created':
        console.log('Customer created:', event.data.id);
        break;
    }

    res.json({ received: true });
  } catch (err) {
    console.error('Webhook verification failed:', err.message);
    res.status(400).json({ error: 'Invalid signature' });
  }
});
```

### Using the Event Router

```typescript
import {
  constructWebhookEvent,
  createWebhookRouter
} from '@open-bookkeeping/sdk/webhooks';

// Define handlers for each event type
const router = createWebhookRouter({
  'invoice.created': async (event) => {
    await notifyTeam(`New invoice: ${event.data.invoiceNumber}`);
  },
  'invoice.paid': async (event) => {
    await updateCRM(event.data.customerId, 'payment_received');
  },
  'customer.created': async (event) => {
    await sendWelcomeEmail(event.data.email);
  },
});

// In your webhook handler
app.post('/webhooks', async (req, res) => {
  const event = await constructWebhookEvent(
    req.body,
    req.headers['x-webhook-signature'],
    req.headers['x-webhook-timestamp'],
    process.env.WEBHOOK_SECRET
  );

  await router(event);
  res.json({ received: true });
});
```

### Available Events

| Event | Description |
|-------|-------------|
| `invoice.created` | New invoice created |
| `invoice.updated` | Invoice modified |
| `invoice.deleted` | Invoice deleted |
| `invoice.sent` | Invoice sent to customer |
| `invoice.paid` | Invoice marked as paid |
| `customer.created` | New customer created |
| `customer.updated` | Customer modified |
| `customer.deleted` | Customer deleted |
| `vendor.created` | New vendor created |
| `vendor.updated` | Vendor modified |
| `vendor.deleted` | Vendor deleted |
| `quotation.created` | New quotation created |
| `quotation.updated` | Quotation modified |
| `quotation.deleted` | Quotation deleted |
| `quotation.accepted` | Quotation accepted by customer |
| `bill.created` | New bill created |
| `bill.updated` | Bill modified |
| `bill.deleted` | Bill deleted |
| `bill.paid` | Bill marked as paid |

---

## Error Handling

The SDK provides typed errors for different scenarios:

```typescript
import {
  OpenBookkeeping,
  OpenBookkeepingError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ValidationError,
  RateLimitError,
} from '@open-bookkeeping/sdk';

try {
  const invoice = await client.invoices.retrieve('inv_xxx');
} catch (error) {
  if (error instanceof AuthenticationError) {
    // Invalid or expired API key
    console.error('Please check your API key');
  } else if (error instanceof AuthorizationError) {
    // Insufficient permissions
    console.error('API key lacks required permissions');
  } else if (error instanceof NotFoundError) {
    // Resource doesn't exist
    console.error('Invoice not found');
  } else if (error instanceof ValidationError) {
    // Invalid input data
    console.error('Validation failed:', error.details);
  } else if (error instanceof RateLimitError) {
    // Too many requests
    console.error(`Rate limited. Retry after ${error.retryAfter} seconds`);
  } else if (error instanceof OpenBookkeepingError) {
    // Other API error
    console.error(`Error ${error.code}: ${error.message}`);
  }
}
```

### Error Properties

| Property | Type | Description |
|----------|------|-------------|
| `message` | `string` | Human-readable error message |
| `code` | `string` | Error code (e.g., `INVOICE_NOT_FOUND`) |
| `status` | `number` | HTTP status code |
| `details` | `object` | Additional error details (validation errors) |

---

## Examples

### Create Invoice with Line Items

```typescript
const invoice = await client.invoices.create({
  invoiceNumber: 'INV-2024-001',
  customerId: 'cust_abc123',
  issueDate: '2024-01-15',
  dueDate: '2024-02-15',
  currency: 'MYR',
  notes: 'Thank you for your business!',
  terms: 'Payment due within 30 days',
  lineItems: [
    {
      description: 'Web Development Services',
      quantity: 40,
      unitPrice: 150,
      taxRate: 6,
    },
    {
      description: 'Domain & Hosting (Annual)',
      quantity: 1,
      unitPrice: 500,
      taxRate: 6,
    },
    {
      description: 'SSL Certificate',
      quantity: 1,
      unitPrice: 100,
      taxRate: 6,
    },
  ],
});

console.log(`Created invoice ${invoice.invoiceNumber}`);
console.log(`Total: ${invoice.currency} ${invoice.total}`);
```

### Paginate Through All Customers

```typescript
async function* getAllCustomers() {
  let offset = 0;
  const limit = 100;

  while (true) {
    const { data, pagination } = await client.customers.list({ limit, offset });

    for (const customer of data) {
      yield customer;
    }

    if (!pagination.hasMore) break;
    offset += limit;
  }
}

// Usage
for await (const customer of getAllCustomers()) {
  console.log(customer.name);
}
```

### Handle Webhook Events with Type Safety

```typescript
import type { WebhookPayload, Invoice, Customer } from '@open-bookkeeping/sdk';
import { constructWebhookEvent, isEventType } from '@open-bookkeeping/sdk/webhooks';

async function handleWebhook(payload: string, signature: string, timestamp: string) {
  const event = await constructWebhookEvent(payload, signature, timestamp, SECRET);

  if (isEventType(event, 'invoice.paid')) {
    // event.data is typed as Invoice
    const invoice = event.data as Invoice;
    await recordPayment(invoice.id, invoice.total);
  }

  if (isEventType(event, 'customer.created')) {
    // event.data is typed as Customer
    const customer = event.data as Customer;
    await sendWelcomeEmail(customer.email);
  }
}
```

---

## TypeScript Support

This SDK is written in TypeScript and provides full type definitions:

```typescript
import type {
  Invoice,
  Customer,
  Vendor,
  Quotation,
  Bill,
  Account,
  Product,
  CompanyProfile,
  CreateInvoiceInput,
  UpdateCustomerInput,
  InvoiceFilters,
  PaginatedResponse,
  WebhookPayload,
  WebhookEventType,
} from '@open-bookkeeping/sdk';
```

---

## Requirements

- Node.js 18+ or modern browser with `fetch` support
- TypeScript 4.7+ (optional, for type definitions)

---

## License

MIT © [Open Bookkeeping](https://open-bookkeeping.com)
