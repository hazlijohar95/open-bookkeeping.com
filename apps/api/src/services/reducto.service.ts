/**
 * Reducto Service
 * Handles document parsing and data extraction using Reducto AI
 * @see https://docs.reducto.ai/overview
 */

import { createLogger } from "@open-bookkeeping/shared";

const logger = createLogger("reducto-service");

// Environment configuration
const REDUCTO_API_KEY = process.env.REDUCTO_API_KEY;
const REDUCTO_BASE_URL = process.env.REDUCTO_BASE_URL ?? "https://platform.reducto.ai";

/**
 * Document types supported for extraction
 */
export type DocumentType = "bill" | "invoice" | "receipt" | "bank_statement" | "unknown";

/**
 * Extracted invoice/bill data structure
 */
export interface ExtractedInvoiceData {
  documentType?: DocumentType;
  vendor: {
    name: string;
    address?: string;
    taxId?: string;
    email?: string;
    phone?: string;
    bankName?: string;
    bankAccountNumber?: string;
  };
  invoiceNumber?: string;
  invoiceDate?: string;
  dueDate?: string;
  currency?: string;
  subtotal?: number;
  taxRate?: number;
  taxAmount?: number;
  tax?: number; // Legacy, use taxAmount
  total?: number;
  lineItems?: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
    amount: number;
  }>;
  paymentTerms?: string;
  notes?: string;
}

/**
 * Extracted bank statement data structure
 */
export interface ExtractedBankStatementData {
  documentType: "bank_statement";
  bankName: string;
  accountNumber?: string;
  accountHolderName?: string;
  statementPeriod?: {
    startDate?: string;
    endDate?: string;
  };
  openingBalance?: number;
  closingBalance?: number;
  currency?: string;
  transactions: Array<{
    date: string;
    description: string;
    reference?: string;
    debit?: number;
    credit?: number;
    balance?: number;
  }>;
}

/**
 * Extracted receipt data structure
 */
export interface ExtractedReceiptData {
  documentType: "receipt";
  vendor: {
    name: string;
    address?: string;
  };
  receiptNumber?: string;
  date?: string;
  paymentMethod?: string;
  currency?: string;
  items?: Array<{
    description: string;
    quantity?: number;
    unitPrice?: number;
    amount: number;
  }>;
  subtotal?: number;
  tax?: number;
  total?: number;
}

/**
 * Union type for all extracted document data
 */
export type ExtractedDocumentData =
  | ExtractedInvoiceData
  | ExtractedBankStatementData
  | ExtractedReceiptData;

/**
 * Parse result from Reducto
 */
export interface ParseResult {
  jobId: string;
  text: string;
  tables: Array<{
    rows: string[][];
    headers?: string[];
  }>;
  metadata?: Record<string, unknown>;
}

/**
 * Reducto API error
 */
export class ReductoError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = "ReductoError";
  }
}

/**
 * Reducto Service class for document processing
 */
export class ReductoService {
  private readonly apiKey: string;
  private readonly baseUrl: string;

  constructor(config?: { apiKey?: string; baseUrl?: string }) {
    this.apiKey = config?.apiKey ?? REDUCTO_API_KEY ?? "";
    this.baseUrl = config?.baseUrl ?? REDUCTO_BASE_URL;

    if (!this.apiKey) {
      logger.warn("REDUCTO_API_KEY not configured - document processing will fail");
    }
  }

  /**
   * Check if Reducto is configured and available
   */
  isConfigured(): boolean {
    return !!this.apiKey;
  }

  /**
   * Parse a document to extract raw content (text + tables)
   */
  async parseDocument(documentUrl: string): Promise<ParseResult> {
    if (!this.isConfigured()) {
      throw new ReductoError("Reducto API key not configured");
    }

    logger.info({ documentUrl }, "Parsing document with Reducto");

    const startTime = Date.now();

    try {
      const response = await fetch(`${this.baseUrl}/parse`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          input: documentUrl,
          parsing: {
            settings: {
              ocr_system: "standard",
            },
            formatting: {
              table_output_format: "dynamic",
            },
          },
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger.error(
          { statusCode: response.status, error: errorText },
          "Reducto parse failed"
        );
        throw new ReductoError(
          `Reducto parse failed: ${response.statusText}`,
          response.status,
          errorText
        );
      }

      const result = await response.json();
      const duration = Date.now() - startTime;

      logger.info(
        { jobId: result.jobId, durationMs: duration },
        "Document parsed successfully"
      );

      return result as ParseResult;
    } catch (error) {
      if (error instanceof ReductoError) throw error;

      logger.error({ error }, "Failed to parse document");
      throw new ReductoError(
        `Failed to parse document: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  /**
   * Extract structured invoice/bill data from a document
   */
  async extractInvoiceData(documentUrl: string): Promise<ExtractedInvoiceData> {
    if (!this.isConfigured()) {
      throw new ReductoError("Reducto API key not configured");
    }

    logger.info({ documentUrl }, "Extracting invoice data with Reducto");

    const startTime = Date.now();

    // JSON Schema format for extraction - enhanced with tax rate and vendor bank info
    const invoiceSchema = {
      type: "object",
      properties: {
        documentType: {
          type: "string",
          enum: ["bill", "invoice", "receipt"],
          description: "Type of document: bill (from vendor), invoice (to customer), or receipt",
        },
        vendor: {
          type: "object",
          properties: {
            name: { type: "string", description: "Vendor or supplier company name" },
            address: { type: "string", description: "Vendor address" },
            taxId: { type: "string", description: "Tax ID, SST ID, or GST registration number" },
            email: { type: "string", description: "Vendor email address" },
            phone: { type: "string", description: "Vendor phone number" },
            bankName: { type: "string", description: "Vendor bank name for payments" },
            bankAccountNumber: { type: "string", description: "Vendor bank account number" },
          },
          required: ["name"],
        },
        invoiceNumber: { type: "string", description: "Invoice or bill number" },
        invoiceDate: { type: "string", description: "Invoice date in YYYY-MM-DD format" },
        dueDate: { type: "string", description: "Payment due date in YYYY-MM-DD format" },
        currency: { type: "string", description: "Currency code (e.g., MYR, USD, EUR)" },
        subtotal: { type: "number", description: "Subtotal before tax" },
        taxRate: { type: "number", description: "Tax rate as percentage (e.g., 6 for 6%)" },
        taxAmount: { type: "number", description: "Total tax amount" },
        total: { type: "number", description: "Total amount including tax" },
        lineItems: {
          type: "array",
          items: {
            type: "object",
            properties: {
              description: { type: "string", description: "Line item description" },
              quantity: { type: "number", description: "Quantity" },
              unitPrice: { type: "number", description: "Price per unit" },
              amount: { type: "number", description: "Line total (quantity * unitPrice)" },
            },
            required: ["description", "quantity", "unitPrice", "amount"],
          },
        },
        paymentTerms: { type: "string", description: "Payment terms or conditions" },
        notes: { type: "string", description: "Additional notes or remarks" },
      },
      required: ["vendor"],
    };

    try {
      const requestBody = {
        input: documentUrl,
        instructions: {
          schema: invoiceSchema,
          system_prompt:
            "Extract invoice or bill data precisely. " +
            "Use ISO 8601 date format (YYYY-MM-DD). " +
            "For currency, use the 3-letter ISO code (e.g., MYR, USD, EUR). " +
            "If vendor tax ID looks like Malaysian SST/GST registration, extract it. " +
            "Calculate line item amounts if not explicitly shown (quantity * unitPrice).",
        },
      };

      logger.info({ requestBody: JSON.stringify(requestBody).slice(0, 500) }, "Sending extract request to Reducto");

      const response = await fetch(`${this.baseUrl}/extract`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger.error(
          { statusCode: response.status, error: errorText },
          "Reducto extract failed"
        );
        throw new ReductoError(
          `Reducto extract failed: ${response.statusText}`,
          response.status,
          errorText
        );
      }

      const result = await response.json();
      const duration = Date.now() - startTime;

      // Log the full response structure to understand Reducto's format
      logger.info(
        {
          responseKeys: Object.keys(result),
          fullResponse: JSON.stringify(result).slice(0, 2000),
          durationMs: duration,
        },
        "Reducto raw response"
      );

      // Reducto /extract endpoint returns data in 'result' property
      // The result can be an array (for multi-page documents) or an object
      let extractedData = result.result || result;

      // If result is an array, take the first element
      if (Array.isArray(extractedData)) {
        logger.info({ arrayLength: extractedData.length }, "Reducto returned array, extracting first element");
        extractedData = extractedData[0] ?? {};
      }

      logger.info(
        {
          vendorName: extractedData?.vendor?.name,
          total: extractedData?.total,
          lineItems: extractedData?.lineItems?.length ?? 0,
          durationMs: duration,
        },
        "Invoice data extracted successfully"
      );

      return extractedData as ExtractedInvoiceData;
    } catch (error) {
      if (error instanceof ReductoError) throw error;

      logger.error({ error }, "Failed to extract invoice data");
      throw new ReductoError(
        `Failed to extract invoice data: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  /**
   * Classify a document into categories
   */
  async classifyDocument(
    documentUrl: string
  ): Promise<{
    category: string;
    confidence: number;
    suggestedCategory:
      | "invoices"
      | "bills"
      | "receipts"
      | "contracts"
      | "statements"
      | "tax_documents"
      | "other";
  }> {
    if (!this.isConfigured()) {
      throw new ReductoError("Reducto API key not configured");
    }

    logger.info({ documentUrl }, "Classifying document with Reducto");

    const classificationSchema = {
      type: "object",
      properties: {
        documentType: {
          type: "string",
          enum: ["invoice", "bill", "receipt", "contract", "statement", "tax_document", "other"],
          description: "The type of document",
        },
        confidence: {
          type: "number",
          description: "Confidence score between 0 and 1",
        },
      },
      required: ["documentType", "confidence"],
    };

    try {
      const response = await fetch(`${this.baseUrl}/extract`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          input: documentUrl,
          instructions: {
            schema: classificationSchema,
            system_prompt:
              "Classify this document into one of these categories: " +
              "invoice (customer-facing sales invoice), " +
              "bill (vendor invoice to pay), " +
              "receipt (payment proof), " +
              "contract (agreement/NDA), " +
              "statement (bank/account statement), " +
              "tax_document (tax form/receipt), " +
              "other. " +
              "Return the category and your confidence (0-1).",
          },
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger.error({ statusCode: response.status, error: errorText }, "Reducto classification failed");
        throw new ReductoError(
          `Classification failed: ${response.statusText}`,
          response.status,
          errorText
        );
      }

      const result = await response.json();

      // Extract from result property (can be array for multi-page)
      let extractedData = result.result || result;
      if (Array.isArray(extractedData)) {
        extractedData = extractedData[0] ?? {};
      }

      const docType = (extractedData?.documentType ?? "other").toLowerCase();

      // Map to our categories
      const categoryMap: Record<string, typeof suggestedCategory> = {
        invoice: "invoices",
        invoices: "invoices",
        bill: "bills",
        bills: "bills",
        receipt: "receipts",
        receipts: "receipts",
        contract: "contracts",
        contracts: "contracts",
        agreement: "contracts",
        statement: "statements",
        statements: "statements",
        tax: "tax_documents",
        tax_document: "tax_documents",
        tax_documents: "tax_documents",
      };

      type CategoryType =
        | "invoices"
        | "bills"
        | "receipts"
        | "contracts"
        | "statements"
        | "tax_documents"
        | "other";

      const suggestedCategory: CategoryType = categoryMap[docType] ?? "other";

      logger.info(
        { documentType: docType, suggestedCategory, confidence: extractedData?.confidence },
        "Document classified successfully"
      );

      return {
        category: docType,
        confidence: extractedData?.confidence ?? 0.5,
        suggestedCategory,
      };
    } catch (error) {
      if (error instanceof ReductoError) throw error;

      logger.error({ error }, "Failed to classify document");
      throw new ReductoError(
        `Failed to classify document: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  /**
   * Extract bank statement data from a document
   */
  async extractBankStatementData(documentUrl: string): Promise<ExtractedBankStatementData> {
    if (!this.isConfigured()) {
      throw new ReductoError("Reducto API key not configured");
    }

    logger.info({ documentUrl }, "Extracting bank statement data with Reducto");

    const startTime = Date.now();

    const bankStatementSchema = {
      type: "object",
      properties: {
        documentType: {
          type: "string",
          const: "bank_statement",
        },
        bankName: { type: "string", description: "Name of the bank" },
        accountNumber: { type: "string", description: "Bank account number (may be partially masked)" },
        accountHolderName: { type: "string", description: "Name of account holder" },
        statementPeriod: {
          type: "object",
          properties: {
            startDate: { type: "string", description: "Statement period start date YYYY-MM-DD" },
            endDate: { type: "string", description: "Statement period end date YYYY-MM-DD" },
          },
        },
        openingBalance: { type: "number", description: "Opening/beginning balance" },
        closingBalance: { type: "number", description: "Closing/ending balance" },
        currency: { type: "string", description: "Currency code (e.g., MYR, USD)" },
        transactions: {
          type: "array",
          items: {
            type: "object",
            properties: {
              date: { type: "string", description: "Transaction date YYYY-MM-DD" },
              description: { type: "string", description: "Transaction description" },
              reference: { type: "string", description: "Reference or check number" },
              debit: { type: "number", description: "Debit/withdrawal amount (money out)" },
              credit: { type: "number", description: "Credit/deposit amount (money in)" },
              balance: { type: "number", description: "Balance after transaction" },
            },
            required: ["date", "description"],
          },
        },
      },
      required: ["bankName", "transactions"],
    };

    try {
      const response = await fetch(`${this.baseUrl}/extract`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          input: documentUrl,
          instructions: {
            schema: bankStatementSchema,
            system_prompt:
              "Extract bank statement data precisely. " +
              "Use ISO 8601 date format (YYYY-MM-DD). " +
              "For each transaction, identify if it's a debit (money out) or credit (money in). " +
              "Extract all transactions from the statement chronologically. " +
              "Capture opening and closing balances if shown.",
          },
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger.error({ statusCode: response.status, error: errorText }, "Reducto bank statement extract failed");
        throw new ReductoError(`Reducto extract failed: ${response.statusText}`, response.status, errorText);
      }

      const result = await response.json();
      const duration = Date.now() - startTime;

      let extractedData = result.result || result;
      if (Array.isArray(extractedData)) {
        extractedData = extractedData[0] ?? {};
      }

      // Ensure documentType is set
      extractedData.documentType = "bank_statement";

      logger.info(
        {
          bankName: extractedData?.bankName,
          transactionCount: extractedData?.transactions?.length ?? 0,
          durationMs: duration,
        },
        "Bank statement data extracted successfully"
      );

      return extractedData as ExtractedBankStatementData;
    } catch (error) {
      if (error instanceof ReductoError) throw error;
      logger.error({ error }, "Failed to extract bank statement data");
      throw new ReductoError(
        `Failed to extract bank statement data: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  /**
   * Extract receipt data from a document
   */
  async extractReceiptData(documentUrl: string): Promise<ExtractedReceiptData> {
    if (!this.isConfigured()) {
      throw new ReductoError("Reducto API key not configured");
    }

    logger.info({ documentUrl }, "Extracting receipt data with Reducto");

    const startTime = Date.now();

    const receiptSchema = {
      type: "object",
      properties: {
        documentType: {
          type: "string",
          const: "receipt",
        },
        vendor: {
          type: "object",
          properties: {
            name: { type: "string", description: "Store/merchant name" },
            address: { type: "string", description: "Store address" },
          },
          required: ["name"],
        },
        receiptNumber: { type: "string", description: "Receipt or transaction number" },
        date: { type: "string", description: "Receipt date YYYY-MM-DD" },
        paymentMethod: { type: "string", description: "Payment method (cash, card, etc.)" },
        currency: { type: "string", description: "Currency code (e.g., MYR, USD)" },
        items: {
          type: "array",
          items: {
            type: "object",
            properties: {
              description: { type: "string", description: "Item description" },
              quantity: { type: "number", description: "Quantity purchased" },
              unitPrice: { type: "number", description: "Price per unit" },
              amount: { type: "number", description: "Line total" },
            },
            required: ["description", "amount"],
          },
        },
        subtotal: { type: "number", description: "Subtotal before tax" },
        tax: { type: "number", description: "Tax amount" },
        total: { type: "number", description: "Total amount paid" },
      },
      required: ["vendor"],
    };

    try {
      const response = await fetch(`${this.baseUrl}/extract`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          input: documentUrl,
          instructions: {
            schema: receiptSchema,
            system_prompt:
              "Extract receipt/payment data precisely. " +
              "Use ISO 8601 date format (YYYY-MM-DD). " +
              "Identify all purchased items with their prices. " +
              "Capture payment method if shown.",
          },
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger.error({ statusCode: response.status, error: errorText }, "Reducto receipt extract failed");
        throw new ReductoError(`Reducto extract failed: ${response.statusText}`, response.status, errorText);
      }

      const result = await response.json();
      const duration = Date.now() - startTime;

      let extractedData = result.result || result;
      if (Array.isArray(extractedData)) {
        extractedData = extractedData[0] ?? {};
      }

      // Ensure documentType is set
      extractedData.documentType = "receipt";

      logger.info(
        {
          vendorName: extractedData?.vendor?.name,
          total: extractedData?.total,
          itemCount: extractedData?.items?.length ?? 0,
          durationMs: duration,
        },
        "Receipt data extracted successfully"
      );

      return extractedData as ExtractedReceiptData;
    } catch (error) {
      if (error instanceof ReductoError) throw error;
      logger.error({ error }, "Failed to extract receipt data");
      throw new ReductoError(
        `Failed to extract receipt data: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  /**
   * Smart extraction: Classify document first, then extract with appropriate schema
   */
  async classifyAndExtract(
    documentUrl: string
  ): Promise<{
    documentType: DocumentType;
    data: ExtractedDocumentData;
    classification: {
      category: string;
      confidence: number;
    };
  }> {
    logger.info({ documentUrl }, "Starting classify-and-extract flow");

    // Step 1: Classify the document
    const classification = await this.classifyDocument(documentUrl);

    logger.info(
      {
        category: classification.category,
        suggestedCategory: classification.suggestedCategory,
        confidence: classification.confidence,
      },
      "Document classified"
    );

    // Step 2: Extract with appropriate schema based on classification
    let documentType: DocumentType;
    let data: ExtractedDocumentData;

    switch (classification.suggestedCategory) {
      case "statements":
        documentType = "bank_statement";
        data = await this.extractBankStatementData(documentUrl);
        break;

      case "receipts":
        documentType = "receipt";
        data = await this.extractReceiptData(documentUrl);
        break;

      case "bills":
      case "invoices":
      default:
        // Use invoice extraction for bills, invoices, and unknown documents
        documentType = classification.suggestedCategory === "invoices" ? "invoice" : "bill";
        const invoiceData = await this.extractInvoiceData(documentUrl);
        invoiceData.documentType = documentType;
        data = invoiceData;
        break;
    }

    logger.info(
      { documentType, hasData: !!data },
      "Classify-and-extract completed"
    );

    return {
      documentType,
      data,
      classification: {
        category: classification.category,
        confidence: classification.confidence,
      },
    };
  }
}

// Export singleton instance
export const reductoService = new ReductoService();
