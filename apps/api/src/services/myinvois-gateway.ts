/**
 * MyInvois Gateway Client Service
 * Handles communication with the myinvois-gateway for Malaysia e-Invoice submission
 */

// ============================================
// TYPE DEFINITIONS
// ============================================

export type IdentificationScheme = "NRIC" | "BRN" | "PASSPORT" | "ARMY";

export type TaxCategoryCode =
  | "01" // Sales Tax
  | "02" // Service Tax
  | "03" // Tourism Tax
  | "04" // High-Value Goods Tax
  | "05" // Sales Tax on Low Value Goods
  | "06" // Not Applicable
  | "E"; // Exempt

export type DocumentType =
  | "invoice"
  | "credit_note"
  | "debit_note"
  | "refund_note"
  | "self_billed_invoice"
  | "self_billed_credit_note"
  | "self_billed_debit_note"
  | "self_billed_refund_note";

export interface Address {
  addressLines: string[];
  cityName: string;
  countrySubentityCode: string; // State code (e.g., "14" for Kuala Lumpur)
  countryCode: string; // ISO 3166-1 alpha-3 (e.g., "MYS")
  postalZone?: string;
}

export interface Supplier {
  TIN: string;
  legalName: string;
  identificationNumber: string;
  identificationScheme: IdentificationScheme;
  telephone: string;
  industryClassificationCode: string; // 5-digit MSIC code
  industryClassificationName: string;
  address: Address;
  electronicMail?: string;
  sstRegistrationNumber?: string;
  tourismTaxRegistrationNumber?: string;
  additionalAccountId?: string;
}

export interface Customer {
  TIN: string;
  legalName: string;
  identificationNumber: string;
  identificationScheme: IdentificationScheme;
  telephone: string;
  address: Address;
  electronicMail?: string;
  sstRegistrationNumber?: string;
  tourismTaxRegistrationNumber?: string;
  additionalAccountId?: string;
}

export interface TaxSubtotal {
  taxableAmount: number;
  taxAmount: number;
  taxCategoryCode: TaxCategoryCode;
  percent?: number;
  taxExemptReason?: string;
}

export interface TaxTotal {
  totalTaxAmount: number;
  taxSubtotals: TaxSubtotal[];
  roundingAmount?: number;
}

export interface LineTaxTotal {
  taxAmount: number;
  taxSubtotals: TaxSubtotal[];
}

export interface AllowanceCharge {
  isCharge: boolean;
  reason: string;
  amount: number;
}

export interface InvoiceLine {
  id: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  itemDescription: string;
  itemCommodityClassification: {
    code: string;
    listID?: string;
  };
  unitCode?: string;
  lineTaxTotal?: LineTaxTotal;
  allowanceCharges?: AllowanceCharge[];
}

export interface LegalMonetaryTotal {
  lineExtensionAmount: number;
  taxExclusiveAmount: number;
  taxInclusiveAmount: number;
  payableAmount: number;
  allowanceTotalAmount?: number;
  chargeTotalAmount?: number;
  prepaidAmount?: number;
  payableRoundingAmount?: number;
}

export interface InvoicePeriod {
  startDate?: string;
  endDate?: string;
  description?: string;
}

export interface AdditionalDocumentReference {
  id: string;
  documentType?: string;
  documentDescription?: string;
}

export interface PaymentMeans {
  paymentMeansCode: string; // 01-Cash, 02-Cheque, 03-Transfer, etc.
  payeeFinancialAccount?: {
    id: string;
  };
}

export interface PaymentTerms {
  note: string;
}

export interface PrepaidPayment {
  id: string;
  paidAmount: number;
  paidDate?: string;
  paidTime?: string;
}

// Base document structure
export interface BaseDocument {
  id: string;
  issueDate: string; // YYYY-MM-DD
  issueTime: string; // HH:mm:ssZ
  documentCurrencyCode: string;
  taxCurrencyCode?: string;
  supplier: Supplier;
  customer: Customer;
  taxTotal: TaxTotal;
  legalMonetaryTotal: LegalMonetaryTotal;
  invoicePeriod?: InvoicePeriod[];
  additionalDocumentReferences?: AdditionalDocumentReference[];
  paymentMeans?: PaymentMeans[];
  paymentTerms?: PaymentTerms[];
  prepaidPayments?: PrepaidPayment[];
  allowanceCharges?: AllowanceCharge[];
}

export interface InvoiceDocument extends BaseDocument {
  invoiceLines: InvoiceLine[];
}

export interface CreditNoteDocument extends BaseDocument {
  creditNoteLines: InvoiceLine[];
  billingReferences: BillingReference[];
}

export interface DebitNoteDocument extends BaseDocument {
  debitNoteLines: InvoiceLine[];
  billingReferences: BillingReference[];
}

export interface RefundNoteDocument extends BaseDocument {
  refundNoteLines: InvoiceLine[];
  billingReferences: BillingReference[];
}

export interface BillingReference {
  id: string;
  uuid?: string;
  issueDate?: string;
}

// Self-billed variants have supplier and customer swapped roles
export type SelfBilledInvoiceDocument = InvoiceDocument;
export type SelfBilledCreditNoteDocument = CreditNoteDocument;
export type SelfBilledDebitNoteDocument = DebitNoteDocument;
export type SelfBilledRefundNoteDocument = RefundNoteDocument;

// Submit options
export interface SubmitOptions {
  dryRun?: boolean;
  sign?: boolean;
  taxpayerTIN?: string;
}

// Response types
export interface SubmissionResponse {
  submissionUid: string;
  acceptedDocuments: AcceptedDocument[];
  rejectedDocuments: RejectedDocument[];
}

export interface AcceptedDocument {
  uuid: string;
  invoiceCodeNumber: string;
}

export interface RejectedDocument {
  invoiceCodeNumber: string;
  error: {
    code: string;
    message: string;
    target?: string;
    details?: Array<{
      code: string;
      message: string;
      target?: string;
    }>;
  };
}

export interface SubmissionStatus {
  submissionUid: string;
  documentCount: number;
  dateTimeReceived: string;
  overallStatus: "InProgress" | "Valid" | "Invalid" | "PartiallyValid";
  documentSummary: DocumentSummary[];
}

export interface DocumentSummary {
  uuid: string;
  submissionUid: string;
  longId?: string;
  internalId: string;
  typeName: string;
  typeVersionName: string;
  issuerTin: string;
  issuerName: string;
  receiverId?: string;
  receiverName?: string;
  dateTimeIssued: string;
  dateTimeReceived: string;
  dateTimeValidated?: string;
  totalExcludingTax: number;
  totalDiscount: number;
  totalNetAmount: number;
  totalPayableAmount: number;
  status: "Submitted" | "Valid" | "Invalid" | "Cancelled" | "Rejected";
  cancelDateTime?: string;
  rejectRequestDateTime?: string;
  documentStatusReason?: string;
  createdByUserId?: string;
  validationResults?: ValidationResult;
}

export interface ValidationResult {
  status: string;
  validationSteps: ValidationStep[];
}

export interface ValidationStep {
  status: string;
  name: string;
  error?: {
    code: string;
    message: string;
    target?: string;
    propertyPath?: string;
    details?: Array<{
      code: string;
      message: string;
      target?: string;
      propertyPath?: string;
    }>;
  };
}

export interface DocumentDetails extends DocumentSummary {
  uuid: string;
  publicUrl?: string;
  qrCodeUrl?: string;
}

export interface CancelResponse {
  uuid: string;
  status: string;
}

export interface RejectResponse {
  uuid: string;
  status: string;
}

export interface SearchFilters {
  submissionDateFrom?: string;
  submissionDateTo?: string;
  issueDateFrom?: string;
  issueDateTo?: string;
  direction?: "Sent" | "Received";
  status?: string;
  documentType?: string;
  receiverIdType?: string;
  receiverId?: string;
  receiverTin?: string;
  issuerTin?: string;
  pageNo?: number;
  pageSize?: number;
}

export interface SearchResponse {
  result: DocumentSummary[];
  metadata: {
    totalPages: number;
    totalCount: number;
  };
}

export interface RecentDocumentsResponse {
  result: DocumentSummary[];
  metadata: {
    totalPages: number;
    totalCount: number;
  };
}

// ============================================
// GATEWAY CLIENT CLASS
// ============================================

export class MyInvoisGatewayClient {
  private baseUrl: string;
  private apiKey: string;

  constructor(config: { gatewayUrl: string; apiKey: string }) {
    this.baseUrl = config.gatewayUrl.replace(/\/$/, "");
    this.apiKey = config.apiKey;
  }

  private async request<T>(
    method: string,
    endpoint: string,
    options?: {
      body?: unknown;
      query?: Record<string, string | number | boolean | undefined>;
    }
  ): Promise<T> {
    const url = new URL(`${this.baseUrl}${endpoint}`);

    if (options?.query) {
      Object.entries(options.query).forEach(([key, value]) => {
        if (value !== undefined) {
          url.searchParams.set(key, String(value));
        }
      });
    }

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (this.apiKey) {
      headers["X-API-KEY"] = this.apiKey;
    }

    const response = await fetch(url.toString(), {
      method,
      headers,
      body: options?.body ? JSON.stringify(options.body) : undefined,
    });

    if (!response.ok) {
      const errorBody = await response.text();
      let errorMessage: string;
      try {
        const errorJson = JSON.parse(errorBody);
        errorMessage = errorJson.message || errorJson.error || errorBody;
      } catch {
        errorMessage = errorBody;
      }
      throw new MyInvoisGatewayError(
        `Gateway request failed: ${response.status} - ${errorMessage}`,
        response.status,
        errorBody
      );
    }

    return response.json() as Promise<T>;
  }

  // ============================================
  // STANDARD DOCUMENTS
  // ============================================

  async submitInvoice(
    documents: InvoiceDocument[],
    options?: SubmitOptions
  ): Promise<SubmissionResponse> {
    return this.request<SubmissionResponse>(
      "POST",
      "/documents/submit/invoice",
      {
        body: { documents },
        query: {
          dryRun: options?.dryRun,
          sign: options?.sign,
          taxpayerTIN: options?.taxpayerTIN,
        },
      }
    );
  }

  async submitCreditNote(
    documents: CreditNoteDocument[],
    options?: SubmitOptions
  ): Promise<SubmissionResponse> {
    return this.request<SubmissionResponse>(
      "POST",
      "/documents/submit/credit-note",
      {
        body: { documents },
        query: {
          dryRun: options?.dryRun,
          sign: options?.sign,
          taxpayerTIN: options?.taxpayerTIN,
        },
      }
    );
  }

  async submitDebitNote(
    documents: DebitNoteDocument[],
    options?: SubmitOptions
  ): Promise<SubmissionResponse> {
    return this.request<SubmissionResponse>(
      "POST",
      "/documents/submit/debit-note",
      {
        body: { documents },
        query: {
          dryRun: options?.dryRun,
          sign: options?.sign,
          taxpayerTIN: options?.taxpayerTIN,
        },
      }
    );
  }

  async submitRefundNote(
    documents: RefundNoteDocument[],
    options?: SubmitOptions
  ): Promise<SubmissionResponse> {
    return this.request<SubmissionResponse>(
      "POST",
      "/documents/submit/refund-note",
      {
        body: { documents },
        query: {
          dryRun: options?.dryRun,
          sign: options?.sign,
          taxpayerTIN: options?.taxpayerTIN,
        },
      }
    );
  }

  // ============================================
  // SELF-BILLED DOCUMENTS
  // ============================================

  async submitSelfBilledInvoice(
    documents: SelfBilledInvoiceDocument[],
    options?: SubmitOptions
  ): Promise<SubmissionResponse> {
    return this.request<SubmissionResponse>(
      "POST",
      "/documents/submit/self-billed-invoice",
      {
        body: { documents },
        query: {
          dryRun: options?.dryRun,
          sign: options?.sign,
          taxpayerTIN: options?.taxpayerTIN,
        },
      }
    );
  }

  async submitSelfBilledCreditNote(
    documents: SelfBilledCreditNoteDocument[],
    options?: SubmitOptions
  ): Promise<SubmissionResponse> {
    return this.request<SubmissionResponse>(
      "POST",
      "/documents/submit/self-billed-credit-note",
      {
        body: { documents },
        query: {
          dryRun: options?.dryRun,
          sign: options?.sign,
          taxpayerTIN: options?.taxpayerTIN,
        },
      }
    );
  }

  async submitSelfBilledDebitNote(
    documents: SelfBilledDebitNoteDocument[],
    options?: SubmitOptions
  ): Promise<SubmissionResponse> {
    return this.request<SubmissionResponse>(
      "POST",
      "/documents/submit/self-billed-debit-note",
      {
        body: { documents },
        query: {
          dryRun: options?.dryRun,
          sign: options?.sign,
          taxpayerTIN: options?.taxpayerTIN,
        },
      }
    );
  }

  async submitSelfBilledRefundNote(
    documents: SelfBilledRefundNoteDocument[],
    options?: SubmitOptions
  ): Promise<SubmissionResponse> {
    return this.request<SubmissionResponse>(
      "POST",
      "/documents/submit/self-billed-refund-note",
      {
        body: { documents },
        query: {
          dryRun: options?.dryRun,
          sign: options?.sign,
          taxpayerTIN: options?.taxpayerTIN,
        },
      }
    );
  }

  // ============================================
  // DOCUMENT MANAGEMENT
  // ============================================

  async getSubmissionStatus(submissionUid: string): Promise<SubmissionStatus> {
    return this.request<SubmissionStatus>(
      "GET",
      `/submissions/${submissionUid}`
    );
  }

  async getDocument(documentUuid: string): Promise<DocumentDetails> {
    return this.request<DocumentDetails>("GET", `/documents/${documentUuid}`);
  }

  async getRecentDocuments(
    pageNo?: number,
    pageSize?: number
  ): Promise<RecentDocumentsResponse> {
    const query: Record<string, number | undefined> = {};
    if (pageNo !== undefined) query.pageNo = pageNo;
    if (pageSize !== undefined) query.pageSize = pageSize;

    return this.request<RecentDocumentsResponse>("GET", "/documents/", {
      query,
    });
  }

  async cancelDocument(
    documentUuid: string,
    reason: string
  ): Promise<CancelResponse> {
    return this.request<CancelResponse>(
      "PUT",
      `/documents/${documentUuid}/cancel`,
      {
        body: { reason },
      }
    );
  }

  async rejectDocument(
    documentUuid: string,
    reason: string
  ): Promise<RejectResponse> {
    return this.request<RejectResponse>(
      "PUT",
      `/documents/${documentUuid}/reject`,
      {
        body: { reason },
      }
    );
  }

  async searchDocuments(filters: SearchFilters): Promise<SearchResponse> {
    return this.request<SearchResponse>("PUT", "/documents/search", {
      body: filters,
    });
  }
}

// ============================================
// CUSTOM ERROR CLASS
// ============================================

export class MyInvoisGatewayError extends Error {
  public statusCode: number;
  public responseBody: string;

  constructor(message: string, statusCode: number, responseBody: string) {
    super(message);
    this.name = "MyInvoisGatewayError";
    this.statusCode = statusCode;
    this.responseBody = responseBody;
  }
}

// ============================================
// SINGLETON INSTANCE
// ============================================

let gatewayClient: MyInvoisGatewayClient | null = null;

export function getGatewayClient(): MyInvoisGatewayClient {
  if (!gatewayClient) {
    const gatewayUrl = process.env.MYINVOIS_GATEWAY_URL;
    const apiKey = process.env.MYINVOIS_GATEWAY_API_KEY;

    if (!gatewayUrl) {
      throw new Error("MYINVOIS_GATEWAY_URL environment variable is not set");
    }

    gatewayClient = new MyInvoisGatewayClient({
      gatewayUrl,
      apiKey: apiKey ?? "",
    });
  }

  return gatewayClient;
}
