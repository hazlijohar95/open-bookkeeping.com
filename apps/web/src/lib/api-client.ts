/**
 * REST API Client for Supabase Edge Functions
 * Replaces tRPC client for API calls
 */

import { getAccessToken } from "@/providers/auth-provider";

// Import the centralized API URL helper
import { getApiUrl } from "./api-url";

// Get the API base URL - delegates to centralized helper
function getApiBaseUrl(): string {
  return getApiUrl();
}

export const API_BASE_URL = getApiBaseUrl();

// API Error class for structured error handling
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string,
    public details?: unknown
  ) {
    super(message);
    this.name = "ApiError";
  }
}

// Request options type
interface RequestOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
  params?: Record<string, string | number | boolean | undefined | null>;
}

/**
 * Base API client for making authenticated requests
 */
export async function apiRequest<T>(
  endpoint: string,
  options: RequestOptions = {}
): Promise<T> {
  const { body, params, headers: customHeaders, ...fetchOptions } = options;

  // Build URL with query params
  let url = `${API_BASE_URL}${endpoint}`;
  if (params) {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        searchParams.append(key, String(value));
      }
    });
    const queryString = searchParams.toString();
    if (queryString) {
      url += `?${queryString}`;
    }
  }

  // Get auth token
  const token = getAccessToken();

  // Build headers
  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...customHeaders,
  };

  if (token) {
    (headers as Record<string, string>)["Authorization"] = `Bearer ${token}`;
  }

  // Make request
  const response = await fetch(url, {
    ...fetchOptions,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  // Handle non-OK responses
  if (!response.ok) {
    let errorData: { error?: string; message?: string; details?: unknown } = {};
    try {
      errorData = await response.json();
    } catch {
      // Response might not be JSON
    }

    throw new ApiError(
      errorData.error || errorData.message || `Request failed with status ${response.status}`,
      response.status,
      undefined,
      errorData.details
    );
  }

  // Handle empty responses
  const contentType = response.headers.get("content-type");
  if (!contentType?.includes("application/json")) {
    return {} as T;
  }

  return response.json();
}

// Convenience methods for common HTTP methods
export const api = {
  get: <T>(endpoint: string, params?: RequestOptions["params"]) =>
    apiRequest<T>(endpoint, { method: "GET", params }),

  post: <T>(endpoint: string, body?: unknown) =>
    apiRequest<T>(endpoint, { method: "POST", body }),

  put: <T>(endpoint: string, body?: unknown) =>
    apiRequest<T>(endpoint, { method: "PUT", body }),

  patch: <T>(endpoint: string, body?: unknown) =>
    apiRequest<T>(endpoint, { method: "PATCH", body }),

  delete: <T>(endpoint: string, body?: unknown) =>
    apiRequest<T>(endpoint, { method: "DELETE", body }),
};

// Type helpers for pagination
export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

export interface PaginationParams {
  limit?: number;
  offset?: number;
}
