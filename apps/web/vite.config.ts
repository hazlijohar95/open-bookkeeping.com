import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  envDir: "../../",
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          // Core React - always needed
          if (id.includes("node_modules/react/") ||
              id.includes("node_modules/react-dom/") ||
              id.includes("node_modules/react-router")) {
            return "vendor-react";
          }
          // Data layer - always needed for API calls
          if (id.includes("@tanstack/react-query") ||
              id.includes("@trpc/client") ||
              id.includes("@trpc/react-query")) {
            return "vendor-query";
          }
          // PDF libraries - only load on create/edit pages (NOT in main bundle)
          // These will be code-split automatically via lazy routes
          if (id.includes("react-pdf") ||
              id.includes("@react-pdf") ||
              id.includes("pdfjs-dist")) {
            return "vendor-pdf";
          }
          // Charts - used on dashboard, SST pages
          if (id.includes("recharts")) {
            return "vendor-charts";
          }
          // Radix UI - commonly used, group together
          if (id.includes("@radix-ui/")) {
            return "vendor-radix";
          }
          // Framer Motion - animations
          if (id.includes("framer-motion") || id.includes("motion")) {
            return "vendor-motion";
          }
          // Date utilities
          if (id.includes("date-fns")) {
            return "vendor-date";
          }
        },
      },
    },
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
