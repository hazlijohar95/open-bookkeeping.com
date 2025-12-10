/**
 * Open Bookkeeping TypeScript SDK
 * Official SDK for the Open Bookkeeping API
 *
 * @example
 * ```typescript
 * import { OpenBookkeeping } from '@open-bookkeeping/sdk';
 *
 * const client = new OpenBookkeeping({
 *   apiKey: 'ob_live_xxxxx',
 * });
 *
 * // List invoices
 * const invoices = await client.invoices.list({ limit: 10 });
 *
 * // Create a customer
 * const customer = await client.customers.create({
 *   name: 'Acme Corp',
 *   email: 'billing@acme.com',
 * });
 * ```
 */

export * from "./types";
export { verifyWebhookSignature, constructWebhookEvent } from "./webhooks";

import {
  type OpenBookkeepingConfig,
  type RequestOptions,
  type PaginatedResponse,
  type Invoice,
  type CreateInvoiceInput,
  type UpdateInvoiceInput,
  type InvoiceFilters,
  type Customer,
  type CreateCustomerInput,
  type UpdateCustomerInput,
  type CustomerFilters,
  type Vendor,
  type CreateVendorInput,
  type UpdateVendorInput,
  type VendorFilters,
  type Quotation,
  type CreateQuotationInput,
  type UpdateQuotationInput,
  type QuotationFilters,
  type Bill,
  type CreateBillInput,
  type UpdateBillInput,
  type BillFilters,
  type Account,
  type CreateAccountInput,
  type UpdateAccountInput,
  type AccountFilters,
  type Product,
  type CreateProductInput,
  type UpdateProductInput,
  type ProductFilters,
  type CompanyProfile,
  type UpdateCompanyProfileInput,
  OpenBookkeepingError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ValidationError,
  RateLimitError,
} from "./types";

const DEFAULT_BASE_URL = "https://api.open-bookkeeping.com";
const DEFAULT_TIMEOUT = 30000;
const DEFAULT_RETRIES = 3;
const API_VERSION = "v1";

/**
 * Open Bookkeeping SDK Client
 */
export class OpenBookkeeping {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly timeout: number;
  private readonly retries: number;
  private readonly onError?: (error: OpenBookkeepingError) => void;

  public readonly invoices: InvoicesResource;
  public readonly customers: CustomersResource;
  public readonly vendors: VendorsResource;
  public readonly quotations: QuotationsResource;
  public readonly bills: BillsResource;
  public readonly accounts: AccountsResource;
  public readonly products: ProductsResource;
  public readonly company: CompanyResource;

  constructor(config: OpenBookkeepingConfig) {
    if (!config.apiKey) {
      throw new Error("API key is required");
    }

    this.apiKey = config.apiKey;
    this.baseUrl = (config.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, "");
    this.timeout = config.timeout ?? DEFAULT_TIMEOUT;
    this.retries = config.retries ?? DEFAULT_RETRIES;
    this.onError = config.onError;

    // Initialize resources
    this.invoices = new InvoicesResource(this);
    this.customers = new CustomersResource(this);
    this.vendors = new VendorsResource(this);
    this.quotations = new QuotationsResource(this);
    this.bills = new BillsResource(this);
    this.accounts = new AccountsResource(this);
    this.products = new ProductsResource(this);
    this.company = new CompanyResource(this);
  }

  /**
   * Make an authenticated request to the API
   */
  async request<T>(
    method: string,
    path: string,
    options?: {
      body?: unknown;
      query?: Record<string, string | number | boolean | undefined>;
      requestOptions?: RequestOptions;
    }
  ): Promise<T> {
    const url = new URL(`/api/${API_VERSION}${path}`, this.baseUrl);

    // Add query parameters
    if (options?.query) {
      for (const [key, value] of Object.entries(options.query)) {
        if (value !== undefined) {
          url.searchParams.set(key, String(value));
        }
      }
    }

    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.apiKey}`,
      "Content-Type": "application/json",
      "X-API-Version": API_VERSION,
    };

    const controller = new AbortController();
    const timeout = options?.requestOptions?.timeout ?? this.timeout;
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.retries; attempt++) {
      try {
        const response = await fetch(url.toString(), {
          method,
          headers,
          body: options?.body ? JSON.stringify(options.body) : undefined,
          signal: options?.requestOptions?.signal ?? controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const error = await this.handleErrorResponse(response);
          if (this.onError) {
            this.onError(error);
          }
          throw error;
        }

        const data = await response.json();
        return data as T;
      } catch (error) {
        lastError = error as Error;

        // Don't retry on certain errors
        if (
          error instanceof AuthenticationError ||
          error instanceof AuthorizationError ||
          error instanceof ValidationError ||
          error instanceof NotFoundError
        ) {
          throw error;
        }

        // Retry on rate limit with backoff
        if (error instanceof RateLimitError) {
          const delay = error.retryAfter
            ? error.retryAfter * 1000
            : Math.pow(2, attempt) * 1000;
          await this.sleep(delay);
          continue;
        }

        // Retry on network errors
        if (attempt < this.retries) {
          await this.sleep(Math.pow(2, attempt) * 1000);
          continue;
        }
      }
    }

    clearTimeout(timeoutId);
    throw lastError ?? new Error("Request failed after retries");
  }

  private async handleErrorResponse(
    response: Response
  ): Promise<OpenBookkeepingError> {
    let errorData: { code?: string; message?: string; details?: Record<string, unknown> } = {};

    try {
      errorData = await response.json();
    } catch {
      // Response body might not be JSON
    }

    const message = errorData.message ?? response.statusText;

    switch (response.status) {
      case 401:
        return new AuthenticationError(message);
      case 403:
        return new AuthorizationError(message);
      case 404:
        return new NotFoundError("Resource", "unknown");
      case 400:
      case 422:
        return new ValidationError(message, errorData.details);
      case 429:
        const retryAfter = response.headers.get("Retry-After");
        return new RateLimitError(retryAfter ? parseInt(retryAfter, 10) : undefined);
      default:
        return new OpenBookkeepingError(
          message,
          errorData.code ?? "UNKNOWN_ERROR",
          response.status,
          errorData.details
        );
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

/**
 * Base resource class with HTTP helper methods
 */
abstract class Resource {
  constructor(protected client: OpenBookkeeping) {}

  protected _get<T>(path: string, query?: Record<string, string | number | boolean | undefined>, options?: RequestOptions) {
    return this.client.request<T>("GET", path, { query, requestOptions: options });
  }

  protected _post<T>(path: string, body?: unknown, options?: RequestOptions) {
    return this.client.request<T>("POST", path, { body, requestOptions: options });
  }

  protected _put<T>(path: string, body?: unknown, options?: RequestOptions) {
    return this.client.request<T>("PUT", path, { body, requestOptions: options });
  }

  protected _patch<T>(path: string, body?: unknown, options?: RequestOptions) {
    return this.client.request<T>("PATCH", path, { body, requestOptions: options });
  }

  protected _delete<T>(path: string, options?: RequestOptions) {
    return this.client.request<T>("DELETE", path, { requestOptions: options });
  }
}

/**
 * Invoices Resource
 */
class InvoicesResource extends Resource {
  /**
   * List all invoices
   */
  async list(filters?: InvoiceFilters): Promise<PaginatedResponse<Invoice>> {
    return this._get<PaginatedResponse<Invoice>>("/invoices", filters as Record<string, string | number | boolean | undefined>);
  }

  /**
   * Get a single invoice by ID
   */
  async retrieve(id: string): Promise<Invoice> {
    return this._get<Invoice>(`/invoices/${id}`);
  }

  /**
   * Create a new invoice
   */
  async create(data: CreateInvoiceInput): Promise<Invoice> {
    return this._post<Invoice>("/invoices", data);
  }

  /**
   * Update an existing invoice
   */
  async update(id: string, data: UpdateInvoiceInput): Promise<Invoice> {
    return this._patch<Invoice>(`/invoices/${id}`, data);
  }

  /**
   * Delete an invoice
   */
  async del(id: string): Promise<void> {
    return this._delete<void>(`/invoices/${id}`);
  }

  /**
   * Send an invoice to the customer
   */
  async send(id: string, options?: { email?: string }): Promise<Invoice> {
    return this._post<Invoice>(`/invoices/${id}/send`, options);
  }

  /**
   * Mark an invoice as paid
   */
  async markPaid(id: string, paymentDetails?: { paymentDate?: string; paymentMethod?: string; reference?: string }): Promise<Invoice> {
    return this._post<Invoice>(`/invoices/${id}/mark-paid`, paymentDetails);
  }

  /**
   * Void an invoice
   */
  async void(id: string, reason?: string): Promise<Invoice> {
    return this._post<Invoice>(`/invoices/${id}/void`, { reason });
  }

  /**
   * Convert quotation to invoice
   */
  async createFromQuotation(quotationId: string): Promise<Invoice> {
    return this._post<Invoice>(`/invoices/from-quotation/${quotationId}`);
  }

  /**
   * Get invoice PDF download URL
   */
  async getPdfUrl(id: string): Promise<{ url: string; expiresAt: string }> {
    return this._get<{ url: string; expiresAt: string }>(`/invoices/${id}/pdf`);
  }
}

/**
 * Customers Resource
 */
class CustomersResource extends Resource {
  /**
   * List all customers
   */
  async list(filters?: CustomerFilters): Promise<PaginatedResponse<Customer>> {
    return this._get<PaginatedResponse<Customer>>("/customers", filters as Record<string, string | number | boolean | undefined>);
  }

  /**
   * Get a single customer by ID
   */
  async retrieve(id: string): Promise<Customer> {
    return this._get<Customer>(`/customers/${id}`);
  }

  /**
   * Create a new customer
   */
  async create(data: CreateCustomerInput): Promise<Customer> {
    return this._post<Customer>("/customers", data);
  }

  /**
   * Update an existing customer
   */
  async update(id: string, data: UpdateCustomerInput): Promise<Customer> {
    return this._patch<Customer>(`/customers/${id}`, data);
  }

  /**
   * Delete a customer
   */
  async del(id: string): Promise<void> {
    return this._delete<void>(`/customers/${id}`);
  }

  /**
   * Get customer's invoices
   */
  async getInvoices(id: string, filters?: InvoiceFilters): Promise<PaginatedResponse<Invoice>> {
    return this._get<PaginatedResponse<Invoice>>(`/customers/${id}/invoices`, filters as Record<string, string | number | boolean | undefined>);
  }

  /**
   * Get customer's quotations
   */
  async getQuotations(id: string, filters?: QuotationFilters): Promise<PaginatedResponse<Quotation>> {
    return this._get<PaginatedResponse<Quotation>>(`/customers/${id}/quotations`, filters as Record<string, string | number | boolean | undefined>);
  }
}

/**
 * Vendors Resource
 */
class VendorsResource extends Resource {
  /**
   * List all vendors
   */
  async list(filters?: VendorFilters): Promise<PaginatedResponse<Vendor>> {
    return this._get<PaginatedResponse<Vendor>>("/vendors", filters as Record<string, string | number | boolean | undefined>);
  }

  /**
   * Get a single vendor by ID
   */
  async retrieve(id: string): Promise<Vendor> {
    return this._get<Vendor>(`/vendors/${id}`);
  }

  /**
   * Create a new vendor
   */
  async create(data: CreateVendorInput): Promise<Vendor> {
    return this._post<Vendor>("/vendors", data);
  }

  /**
   * Update an existing vendor
   */
  async update(id: string, data: UpdateVendorInput): Promise<Vendor> {
    return this._patch<Vendor>(`/vendors/${id}`, data);
  }

  /**
   * Delete a vendor
   */
  async del(id: string): Promise<void> {
    return this._delete<void>(`/vendors/${id}`);
  }

  /**
   * Get vendor's bills
   */
  async getBills(id: string, filters?: BillFilters): Promise<PaginatedResponse<Bill>> {
    return this._get<PaginatedResponse<Bill>>(`/vendors/${id}/bills`, filters as Record<string, string | number | boolean | undefined>);
  }
}

/**
 * Quotations Resource
 */
class QuotationsResource extends Resource {
  /**
   * List all quotations
   */
  async list(filters?: QuotationFilters): Promise<PaginatedResponse<Quotation>> {
    return this._get<PaginatedResponse<Quotation>>("/quotations", filters as Record<string, string | number | boolean | undefined>);
  }

  /**
   * Get a single quotation by ID
   */
  async retrieve(id: string): Promise<Quotation> {
    return this._get<Quotation>(`/quotations/${id}`);
  }

  /**
   * Create a new quotation
   */
  async create(data: CreateQuotationInput): Promise<Quotation> {
    return this._post<Quotation>("/quotations", data);
  }

  /**
   * Update an existing quotation
   */
  async update(id: string, data: UpdateQuotationInput): Promise<Quotation> {
    return this._patch<Quotation>(`/quotations/${id}`, data);
  }

  /**
   * Delete a quotation
   */
  async del(id: string): Promise<void> {
    return this._delete<void>(`/quotations/${id}`);
  }

  /**
   * Send a quotation to the customer
   */
  async send(id: string, options?: { email?: string }): Promise<Quotation> {
    return this._post<Quotation>(`/quotations/${id}/send`, options);
  }

  /**
   * Mark quotation as accepted
   */
  async accept(id: string): Promise<Quotation> {
    return this._post<Quotation>(`/quotations/${id}/accept`);
  }

  /**
   * Mark quotation as rejected
   */
  async reject(id: string, reason?: string): Promise<Quotation> {
    return this._post<Quotation>(`/quotations/${id}/reject`, { reason });
  }

  /**
   * Convert quotation to invoice
   */
  async convertToInvoice(id: string): Promise<Invoice> {
    return this._post<Invoice>(`/quotations/${id}/convert-to-invoice`);
  }

  /**
   * Get quotation PDF download URL
   */
  async getPdfUrl(id: string): Promise<{ url: string; expiresAt: string }> {
    return this._get<{ url: string; expiresAt: string }>(`/quotations/${id}/pdf`);
  }
}

/**
 * Bills Resource
 */
class BillsResource extends Resource {
  /**
   * List all bills
   */
  async list(filters?: BillFilters): Promise<PaginatedResponse<Bill>> {
    return this._get<PaginatedResponse<Bill>>("/bills", filters as Record<string, string | number | boolean | undefined>);
  }

  /**
   * Get a single bill by ID
   */
  async retrieve(id: string): Promise<Bill> {
    return this._get<Bill>(`/bills/${id}`);
  }

  /**
   * Create a new bill
   */
  async create(data: CreateBillInput): Promise<Bill> {
    return this._post<Bill>("/bills", data);
  }

  /**
   * Update an existing bill
   */
  async update(id: string, data: UpdateBillInput): Promise<Bill> {
    return this._patch<Bill>(`/bills/${id}`, data);
  }

  /**
   * Delete a bill
   */
  async del(id: string): Promise<void> {
    return this._delete<void>(`/bills/${id}`);
  }

  /**
   * Mark a bill as paid
   */
  async markPaid(id: string, paymentDetails?: { paymentDate?: string; paymentMethod?: string; reference?: string }): Promise<Bill> {
    return this._post<Bill>(`/bills/${id}/mark-paid`, paymentDetails);
  }
}

/**
 * Accounts (Chart of Accounts) Resource
 */
class AccountsResource extends Resource {
  /**
   * List all accounts
   */
  async list(filters?: AccountFilters): Promise<PaginatedResponse<Account>> {
    return this._get<PaginatedResponse<Account>>("/accounts", filters as Record<string, string | number | boolean | undefined>);
  }

  /**
   * Get a single account by ID
   */
  async retrieve(id: string): Promise<Account> {
    return this._get<Account>(`/accounts/${id}`);
  }

  /**
   * Create a new account
   */
  async create(data: CreateAccountInput): Promise<Account> {
    return this._post<Account>("/accounts", data);
  }

  /**
   * Update an existing account
   */
  async update(id: string, data: UpdateAccountInput): Promise<Account> {
    return this._patch<Account>(`/accounts/${id}`, data);
  }

  /**
   * Delete an account
   */
  async del(id: string): Promise<void> {
    return this._delete<void>(`/accounts/${id}`);
  }

  /**
   * Get account balance
   */
  async getBalance(id: string, asOf?: string): Promise<{ balance: number; asOf: string }> {
    return this._get<{ balance: number; asOf: string }>(`/accounts/${id}/balance`, { asOf });
  }

  /**
   * Get account transactions
   */
  async getTransactions(id: string, filters?: { fromDate?: string; toDate?: string; limit?: number; offset?: number }): Promise<PaginatedResponse<unknown>> {
    return this._get<PaginatedResponse<unknown>>(`/accounts/${id}/transactions`, filters as Record<string, string | number | boolean | undefined>);
  }
}

/**
 * Products Resource
 */
class ProductsResource extends Resource {
  /**
   * List all products
   */
  async list(filters?: ProductFilters): Promise<PaginatedResponse<Product>> {
    return this._get<PaginatedResponse<Product>>("/products", filters as Record<string, string | number | boolean | undefined>);
  }

  /**
   * Get a single product by ID
   */
  async retrieve(id: string): Promise<Product> {
    return this._get<Product>(`/products/${id}`);
  }

  /**
   * Create a new product
   */
  async create(data: CreateProductInput): Promise<Product> {
    return this._post<Product>("/products", data);
  }

  /**
   * Update an existing product
   */
  async update(id: string, data: UpdateProductInput): Promise<Product> {
    return this._patch<Product>(`/products/${id}`, data);
  }

  /**
   * Delete a product
   */
  async del(id: string): Promise<void> {
    return this._delete<void>(`/products/${id}`);
  }
}

/**
 * Company Profile Resource
 */
class CompanyResource extends Resource {
  /**
   * Get company profile
   */
  async retrieve(): Promise<CompanyProfile> {
    return this._get<CompanyProfile>("/company");
  }

  /**
   * Update company profile
   */
  async update(data: UpdateCompanyProfileInput): Promise<CompanyProfile> {
    return this._patch<CompanyProfile>("/company", data);
  }

  /**
   * Upload company logo
   */
  async uploadLogo(file: Blob): Promise<{ logoUrl: string }> {
    const formData = new FormData();
    formData.append("logo", file);

    // This requires a special request that doesn't use JSON
    const url = new URL(`/api/${API_VERSION}/company/logo`, (this.client as unknown as { baseUrl: string }).baseUrl);

    const response = await fetch(url.toString(), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${(this.client as unknown as { apiKey: string }).apiKey}`,
      },
      body: formData,
    });

    if (!response.ok) {
      throw new OpenBookkeepingError(
        "Failed to upload logo",
        "UPLOAD_ERROR",
        response.status
      );
    }

    return response.json();
  }
}

// Default export
export default OpenBookkeeping;
