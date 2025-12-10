// Invoice status types
export type InvoiceStatus =
  | "pending"
  | "success"
  | "error"
  | "expired"
  | "refunded";

// Invoice type (storage location)
export type InvoiceType = "local" | "server";

// Image type for assets
export type ImageType = "logo" | "signature";

// User type
export interface User {
  id: string;
  supabaseId: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  allowedSavingData: boolean;
}

// Invoice type
export interface Invoice {
  id: string;
  userId: string;
  type: InvoiceType;
  status: InvoiceStatus;
  createdAt: Date;
  updatedAt: Date;
  paidAt: Date | null;
}

// Storage image type
export interface StorageImage {
  key: string;
  name: string;
  type: ImageType;
  url: string;
  createdAt: string;
}

// Blog post type
export interface BlogPost {
  slug: string;
  title: string;
  description: string;
  content: string;
  coverImage: string | null;
  date: string;
}

// Custom result type for error handling
export type Result<T, E = Error> =
  | { success: true; data: T }
  | { success: false; error: E };

// Result helper functions
export const ok = <T>(data: T): Result<T, never> => ({ success: true, data });
export const err = <E>(error: E): Result<never, E> => ({ success: false, error });

// API Response types (inspired by Tempo codebase patterns)
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    context?: Record<string, unknown>;
  };
  meta?: {
    timestamp: string;
    requestId?: string;
  };
}

// Helper to create API success response
export function apiSuccess<T>(data: T, requestId?: string): ApiResponse<T> {
  return {
    success: true,
    data,
    meta: {
      timestamp: new Date().toISOString(),
      ...(requestId && { requestId }),
    },
  };
}

// Helper to create API error response
export function apiError(
  code: string,
  message: string,
  context?: Record<string, unknown>,
  requestId?: string
): ApiResponse<never> {
  return {
    success: false,
    error: {
      code,
      message,
      ...(context && { context }),
    },
    meta: {
      timestamp: new Date().toISOString(),
      ...(requestId && { requestId }),
    },
  };
}

// Currency info
export interface CurrencyInfo {
  code: string;
  symbol: string;
  name: string;
}

// Common currencies
export const currencies: CurrencyInfo[] = [
  { code: "USD", symbol: "$", name: "US Dollar" },
  { code: "EUR", symbol: "€", name: "Euro" },
  { code: "GBP", symbol: "£", name: "British Pound" },
  { code: "JPY", symbol: "¥", name: "Japanese Yen" },
  { code: "CAD", symbol: "C$", name: "Canadian Dollar" },
  { code: "AUD", symbol: "A$", name: "Australian Dollar" },
  { code: "CHF", symbol: "Fr", name: "Swiss Franc" },
  { code: "CNY", symbol: "¥", name: "Chinese Yuan" },
  { code: "INR", symbol: "₹", name: "Indian Rupee" },
  { code: "MXN", symbol: "$", name: "Mexican Peso" },
  { code: "BRL", symbol: "R$", name: "Brazilian Real" },
  { code: "KRW", symbol: "₩", name: "South Korean Won" },
  { code: "SGD", symbol: "S$", name: "Singapore Dollar" },
  { code: "HKD", symbol: "HK$", name: "Hong Kong Dollar" },
  { code: "NOK", symbol: "kr", name: "Norwegian Krone" },
  { code: "SEK", symbol: "kr", name: "Swedish Krona" },
  { code: "DKK", symbol: "kr", name: "Danish Krone" },
  { code: "NZD", symbol: "NZ$", name: "New Zealand Dollar" },
  { code: "ZAR", symbol: "R", name: "South African Rand" },
  { code: "RUB", symbol: "₽", name: "Russian Ruble" },
];

// Format currency amount
export function formatCurrency(
  amount: number,
  currencyCode: string,
  locale = "en-US"
): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: currencyCode,
  }).format(amount);
}
