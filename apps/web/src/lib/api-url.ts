/**
 * Get the API base URL for the current environment
 * Uses VITE_API_URL env var, which should be:
 * - Development: http://localhost:3001 (set in .env)
 * - Production: empty string (not set, defaults to same-origin)
 */
export function getApiUrl(): string {
  // VITE_API_URL should be set in .env for development
  // In production builds, if not set, it will be empty string (same-origin)
  return import.meta.env.VITE_API_URL ?? "";
}

export const API_URL = getApiUrl();
