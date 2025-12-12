/**
 * Get the API base URL for the current environment
 * - Development: http://localhost:3001
 * - Production: same-origin (empty string, served via Netlify Functions)
 */
export function getApiUrl(): string {
  // First check for explicit API URL override
  const explicitApiUrl = import.meta.env.VITE_API_URL;
  if (explicitApiUrl) {
    return explicitApiUrl;
  }

  // In development mode, use the local Node.js API server
  if (import.meta.env.DEV) {
    return "http://localhost:3001";
  }

  // In production, use same-origin (API served via Netlify Functions)
  return "";
}

export const API_URL = getApiUrl();
