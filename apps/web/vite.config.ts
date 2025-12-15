import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";
import path from "path";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "prompt", // Show update prompt to user
      includeAssets: [
        "favicon.svg",
        "favicon.ico",
        "apple-touch-icon.png",
        "mask-icon.svg",
        "robots.txt",
      ],
      manifest: {
        name: "Open Bookkeeping",
        short_name: "Bookkeeping",
        description:
          "Free open-source bookkeeping and invoicing platform. Create unlimited invoices, quotations, and financial documents with professional PDF generation.",
        theme_color: "#EE5F00", // Primary color (Monk orange)
        background_color: "#FBFBF9", // Warm off-white
        display: "standalone",
        orientation: "portrait-primary",
        scope: "/",
        start_url: "/",
        id: "/",
        categories: ["business", "finance", "productivity"],
        icons: [
          {
            src: "/pwa-64x64.png",
            sizes: "64x64",
            type: "image/png",
          },
          {
            src: "/pwa-192x192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "/pwa-512x512.png",
            sizes: "512x512",
            type: "image/png",
          },
          {
            src: "/pwa-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "/maskable-icon-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
        screenshots: [
          {
            src: "/screenshots/dashboard-wide.png",
            sizes: "1280x720",
            type: "image/png",
            form_factor: "wide",
            label: "Dashboard - Overview of your business",
          },
          {
            src: "/screenshots/invoices-narrow.png",
            sizes: "750x1334",
            type: "image/png",
            form_factor: "narrow",
            label: "Invoices - Manage your invoices on mobile",
          },
        ],
        shortcuts: [
          {
            name: "Create Invoice",
            short_name: "New Invoice",
            description: "Create a new invoice",
            url: "/create/invoice",
            icons: [{ src: "/shortcuts/invoice.png", sizes: "192x192" }],
          },
          {
            name: "View Dashboard",
            short_name: "Dashboard",
            description: "View your business dashboard",
            url: "/dashboard",
            icons: [{ src: "/shortcuts/dashboard.png", sizes: "192x192" }],
          },
          {
            name: "AI Assistant",
            short_name: "AI Agent",
            description: "Chat with AI assistant",
            url: "/agent",
            icons: [{ src: "/shortcuts/agent.png", sizes: "192x192" }],
          },
        ],
        related_applications: [],
        prefer_related_applications: false,
      },
      workbox: {
        // Clean up old caches on activate
        cleanupOutdatedCaches: true,
        // Skip waiting for activation
        skipWaiting: false, // We want user to control when to update
        clientsClaim: false,
        // Precache all assets
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff,woff2}"],
        // Runtime caching strategies
        runtimeCaching: [
          {
            // Cache Google Fonts stylesheets
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "google-fonts-cache",
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            // Cache Google Fonts webfonts
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "gstatic-fonts-cache",
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            // Cache API responses with network-first strategy
            urlPattern: /^https?:\/\/.*\/api\/.*/i,
            handler: "NetworkFirst",
            options: {
              cacheName: "api-cache",
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 5, // 5 minutes
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
              networkTimeoutSeconds: 10,
            },
          },
          {
            // Cache images with stale-while-revalidate
            urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp)$/i,
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "images-cache",
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
              },
            },
          },
        ],
        // Offline fallback
        navigateFallback: "/offline.html",
        navigateFallbackDenylist: [/^\/api\//, /^\/trpc\//],
      },
      // Development options - DISABLED to prevent caching localhost URLs
      // which causes issues when switching between dev and production
      devOptions: {
        enabled: false,
      },
    }),
  ],
  envDir: "../../",
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    // NOTE: Manual chunking (manualChunks) has been removed.
    // It was causing runtime errors in production:
    // - "can't access lexical declaration 'S' before initialization" (d3/recharts circular deps)
    // - "can't access property 'createContext' of undefined" (React not available for @react-pdf)
    // Vite's automatic code splitting handles dependency order correctly.
    chunkSizeWarningLimit: 500,
  },
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:3001",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ""),
      },
    },
  },
});
