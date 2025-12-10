# MyInvois Gateway Integration

This document tracks the implementation progress of Malaysia's MyInvois e-invoicing system integration into Open Bookkeeping.

## Overview

MyInvois is Malaysia's mandatory e-invoicing system operated by LHDN (Lembaga Hasil Dalam Negeri). This integration uses [myinvois-gateway](https://github.com/farhan-syah/myinvois-gateway) to simplify the complex UBL format requirements by accepting simple JSON and handling conversion, signing, and submission automatically.

---

## Implementation Status

### Completed

| Component | Status | Description |
|-----------|--------|-------------|
| Database Schema | ✅ Done | Tables for settings and submission tracking |
| Gateway Client | ✅ Done | HTTP client for MyInvois Gateway API |
| Data Transformer | ✅ Done | Convert invoices to MyInvois format |
| tRPC Router | ✅ Done | API endpoints for e-invoice operations |
| Settings UI | ✅ Done | E-Invoice configuration form in settings |
| Submission UI | ✅ Done | Status badges, submit buttons, history |
| Docker Compose | ✅ Done | Gateway deployment configuration |

### Pending / Next Steps

| Task | Priority | Description |
|------|----------|-------------|
| Deploy Gateway | High | Run the myinvois-gateway Docker container |
| Obtain Credentials | High | Get sandbox CLIENT_ID/SECRET from MyInvois |
| Digital Certificates | High | Obtain and configure signing certificates |
| Invoice Detail Integration | Medium | Add e-invoice UI to invoice detail page |
| PDF QR Code | Medium | Embed QR code in PDF invoice templates |
| Sandbox Testing | Medium | Test full flow in sandbox environment |
| Auto-submit Hook | Low | Trigger submission on invoice creation |
| Production Migration | Low | Switch from sandbox to production |

---

## File Structure

### Database Layer (`packages/db/`)

```
packages/db/
├── src/
│   ├── schema/
│   │   └── einvoice.ts          # E-invoice tables and enums
│   └── repositories/
│       └── einvoice.repository.ts  # CRUD operations
└── migrations/
    └── 0004_optimal_franklin_richards.sql  # Migration applied
```

**Schema Tables:**
- `einvoice_settings` - User's MyInvois configuration
- `einvoice_submissions` - Submission history and tracking
- `invoices.einvoice_status` - Quick status reference on invoices

### Backend API (`apps/api/`)

```
apps/api/src/
├── services/
│   ├── myinvois-gateway.ts      # Gateway HTTP client
│   └── einvoice-transformer.ts  # Data transformation
└── trpc/services/
    └── einvoice.ts              # tRPC router endpoints
```

**Key Services:**

1. **MyInvoisGatewayClient** (`myinvois-gateway.ts`)
   - Handles all HTTP communication with the gateway
   - Supports all document types: invoices, credit notes, debit notes, refund notes
   - Supports self-billed variants
   - Methods: `submitInvoice()`, `getSubmissionStatus()`, `cancelDocument()`, etc.

2. **Transformer** (`einvoice-transformer.ts`)
   - `transformInvoiceToMyInvois()` - Convert invoice to gateway format
   - `transformToCreditNote()` / `transformToDebitNote()`
   - `validateInvoiceForEInvoice()` - Pre-submission validation
   - `validateEInvoiceSettings()` - Settings validation

### Frontend (`apps/web/`)

```
apps/web/src/
├── components/
│   ├── settings/
│   │   └── einvoice-settings-form.tsx  # Settings configuration
│   └── einvoice/
│       ├── index.ts
│       ├── submission-status-badge.tsx  # Status indicator
│       ├── submit-button.tsx            # Submit/cancel actions
│       ├── submission-history.tsx       # History accordion
│       └── qr-code-display.tsx          # QR code for valid invoices
└── routes/
    └── settings.tsx                     # Updated with E-Invoice tab
```

### Infrastructure

```
/
├── docker-compose.myinvois.yml  # Gateway deployment
├── .env.example                 # Environment variables
└── certs/                       # Certificate directory (create this)
    ├── private_key.pem          # Signing private key
    └── certificate_base64.txt   # Certificate in Base64
```

---

## API Reference

### tRPC Endpoints

All endpoints require authentication (`protectedProcedure`).

#### Settings

```typescript
// Get current settings
trpc.einvoice.getSettings.useQuery()

// Update settings
trpc.einvoice.updateSettings.useMutation({
  enabled: boolean,
  autoSubmit: boolean,
  tin: string,
  brn: string,
  identificationScheme: "NRIC" | "BRN" | "PASSPORT" | "ARMY",
  msicCode: string,      // 5-digit code
  msicDescription: string,
  sstRegistration?: string,
  tourismTaxRegistration?: string,
})

// Validate settings completeness
trpc.einvoice.validateSettings.useQuery()
```

#### Submission

```typescript
// Submit invoice to MyInvois
trpc.einvoice.submitInvoice.useMutation({
  invoiceId: string,
  customerDetails?: {
    tin?: string,
    brn?: string,
    identificationScheme?: string,
    phone?: string,
    email?: string,
  },
  dryRun?: boolean,  // Test without actual submission
})

// Submit credit note (requires original invoice reference)
trpc.einvoice.submitCreditNote.useMutation({
  invoiceId: string,
  originalInvoiceRef: {
    id: string,        // Original invoice number
    uuid?: string,     // MyInvois UUID if available
    issueDate?: string,
  },
  customerDetails?: {...},
  dryRun?: boolean,
})

// Submit debit note (same structure as credit note)
trpc.einvoice.submitDebitNote.useMutation({...})

// Bulk submit multiple invoices
trpc.einvoice.bulkSubmit.useMutation({
  invoiceIds: string[],
  dryRun?: boolean,
})
```

#### Status & History

```typescript
// Get submission status from MyInvois
trpc.einvoice.getSubmissionStatus.useQuery({
  submissionUid: string,
})

// Get document details
trpc.einvoice.getDocumentDetails.useQuery({
  documentUuid: string,
})

// Get submission history for an invoice
trpc.einvoice.getSubmissionHistory.useQuery({
  invoiceId: string,
})
```

#### Document Management

```typescript
// Cancel a validated document
trpc.einvoice.cancelDocument.useMutation({
  invoiceId: string,
  reason: string,
})

// Validate invoice before submission
trpc.einvoice.validateInvoice.useQuery({
  invoiceId: string,
})
```

---

## Configuration

### Environment Variables

Add to your `.env` file:

```bash
# MyInvois Gateway Configuration
MYINVOIS_GATEWAY_URL="http://localhost:3002"
MYINVOIS_GATEWAY_API_KEY="your-secure-api-key"
MYINVOIS_ENVIRONMENT="SANDBOX"  # SANDBOX or PROD

# For Docker Compose (gateway container)
MYINVOIS_CLIENT_ID="your-client-id"
MYINVOIS_CLIENT_SECRET="your-client-secret"
```

### Required Business Information

Users must configure these in Settings > E-Invoice:

| Field | Description | Example |
|-------|-------------|---------|
| TIN | Tax Identification Number | C1234567890 |
| BRN | Business Registration Number | 202001012345 |
| Identification Scheme | Type of ID used | BRN |
| MSIC Code | 5-digit industry code | 62020 |
| MSIC Description | Business activity | Computer programming |
| SST Registration | Optional tax registration | - |

---

## Deployment Guide

### 1. Start the Gateway

```bash
# Create certificates directory
mkdir -p certs

# Add your certificates
# - certs/private_key.pem (PKCS#8 private key)
# - certs/certificate_base64.txt (DER certificate in Base64)

# Start gateway with Redis
docker-compose -f docker-compose.myinvois.yml up -d

# Verify it's running
curl http://localhost:3002/docs/api
```

### 2. Configure Environment

```bash
# Copy example and edit
cp .env.example .env

# Set your credentials
MYINVOIS_GATEWAY_URL=http://localhost:3002
MYINVOIS_GATEWAY_API_KEY=your-api-key
MYINVOIS_CLIENT_ID=your-sandbox-client-id
MYINVOIS_CLIENT_SECRET=your-sandbox-secret
```

### 3. Run Database Migration

The migration has already been generated and applied. If needed:

```bash
yarn db:migrate
```

### 4. Test in Sandbox

1. Register at https://sdk.myinvois.hasil.gov.my
2. Get sandbox CLIENT_ID and CLIENT_SECRET
3. Use test TIN: `C1234567890`
4. Submit test invoices with `dryRun: true` first

---

## Usage Examples

### Adding E-Invoice to Invoice Detail Page

```tsx
import {
  SubmissionStatusBadge,
  EInvoiceSubmitButton,
  SubmissionHistory,
  QRCodeDisplay,
} from "@/components/einvoice";

function InvoiceDetail({ invoice }) {
  const { data: submissions } = trpc.einvoice.getSubmissionHistory.useQuery({
    invoiceId: invoice.id,
  });

  const latestSubmission = submissions?.[0];

  return (
    <div>
      {/* Status Badge */}
      <SubmissionStatusBadge status={invoice.einvoiceStatus} />

      {/* Submit Button */}
      <EInvoiceSubmitButton
        invoiceId={invoice.id}
        status={invoice.einvoiceStatus}
      />

      {/* QR Code for Valid Invoices */}
      {latestSubmission?.longId && (
        <QRCodeDisplay
          longId={latestSubmission.longId}
          invoiceNumber={invoice.number}
        />
      )}

      {/* Submission History */}
      <SubmissionHistory invoiceId={invoice.id} />
    </div>
  );
}
```

### Programmatic Submission

```typescript
// In your invoice creation flow
const createInvoice = async (data) => {
  const result = await trpc.invoice.insert.mutate(data);

  // Check if auto-submit is enabled
  const settings = await trpc.einvoice.getSettings.query();

  if (settings.enabled && settings.autoSubmit) {
    await trpc.einvoice.submitInvoice.mutate({
      invoiceId: result.invoiceId,
    });
  }

  return result;
};
```

---

## Data Mapping Reference

### Tax Category Codes

| Code | Description |
|------|-------------|
| 01 | Sales Tax |
| 02 | Service Tax |
| 03 | Tourism Tax |
| 04 | High-Value Goods Tax |
| 05 | Sales Tax on Low Value Goods |
| 06 | Not Applicable |
| E | Exempt |

### Malaysia State Codes

| State | Code |
|-------|------|
| Johor | 01 |
| Kedah | 02 |
| Kelantan | 03 |
| Melaka | 04 |
| Negeri Sembilan | 05 |
| Pahang | 06 |
| Pulau Pinang | 07 |
| Perak | 08 |
| Perlis | 09 |
| Selangor | 10 |
| Terengganu | 11 |
| Sabah | 12 |
| Sarawak | 13 |
| Kuala Lumpur | 14 |
| Labuan | 15 |
| Putrajaya | 16 |

---

## Troubleshooting

### Common Issues

**Gateway not reachable**
```bash
# Check if container is running
docker ps | grep myinvois

# Check logs
docker logs myinvois-gateway
```

**Submission rejected**
- Verify TIN format (C followed by 10 digits)
- Check MSIC code is exactly 5 digits
- Ensure all required fields are filled
- Use `dryRun: true` to test without submission

**Certificate errors**
- Ensure private key is PKCS#8 format
- Certificate should be DER format in Base64
- Check file permissions in certs/ directory

---

## Resources

- [MyInvois Portal](https://myinvois.hasil.gov.my/)
- [Developer Sandbox](https://sdk.myinvois.hasil.gov.my/)
- [myinvois-gateway GitHub](https://github.com/farhan-syah/myinvois-gateway)
- [MSIC Classification Guide](https://www.dosm.gov.my/v1/uploads/files/4_Portal%20Content/3_Methods%20%26%20Classifications/2_Classifications/MSIC2008%20Malay/MSIC_2008_COMPLETE_BOOK_MALAY.pdf)

---

## Changelog

### 2024-12-02
- Initial implementation completed
- Database schema with migrations
- Backend services (gateway client, transformer, tRPC router)
- Frontend components (settings form, submission UI)
- Docker Compose configuration

---

*Last updated: December 2, 2024*
