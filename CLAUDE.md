# Open Bookkeeping

<div align="center">

**Full-stack open-source bookkeeping and invoicing platform for Malaysian businesses**

[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?logo=typescript)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react)](https://react.dev/)
[![Hono](https://img.shields.io/badge/Hono-4.0-orange)](https://hono.dev/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15-336791?logo=postgresql)](https://www.postgresql.org/)
[![License](https://img.shields.io/badge/License-MIT-green)](LICENSE)

</div>

---

## Quick Links

| Resource | Description |
|----------|-------------|
| [Features](#-features) | Platform capabilities |
| [PWA](#-progressive-web-app) | Installable offline-first app |
| [Mobile-First Design](#-mobile-first-design) | Responsive UI patterns |
| [AI Agent](#-ai-agent) | Intelligent automation |
| [API Reference](#-api-reference) | REST & tRPC endpoints |
| [Development](#-development) | Setup & commands |
| [Architecture](#-architecture) | System design |

---

## Tech Stack

| Layer | Technologies |
|-------|-------------|
| **Frontend** | React 19, Vite, TypeScript, Tailwind CSS 4, Radix UI, Jotai |
| **Backend** | Hono, tRPC 11, Node.js, AI SDK |
| **Database** | PostgreSQL (Supabase), Drizzle ORM |
| **Auth** | Supabase Auth + API Keys |
| **Queue** | BullMQ + Redis |
| **PDF** | @react-pdf/renderer |
| **PWA** | vite-plugin-pwa, Workbox |
| **Animation** | Motion (Framer Motion) |

---

## Features

### Core Accounting

```
+-------------------+-------------------+-------------------+
|      SALES        |    PURCHASES      |    ACCOUNTING     |
+-------------------+-------------------+-------------------+
| * Invoices        | * Bills           | * Chart of        |
| * Quotations      | * Vendors         |   Accounts        |
| * Credit Notes    | * Bill Payments   | * Journal Entries |
| * Debit Notes     |                   | * Fixed Assets    |
| * Statements      |                   | * Trial Balance   |
+-------------------+-------------------+-------------------+
```

### Financial Reports

| Report | Description |
|--------|-------------|
| **Profit & Loss** | Revenue, expenses, and net income |
| **Balance Sheet** | Assets, liabilities, and equity |
| **Trial Balance** | Account balances verification |
| **SST Reports** | Malaysian tax compliance |
| **Aging Report** | Outstanding receivables by age |

### Integrations

| Integration | Status | Description |
|------------|--------|-------------|
| MyInvois e-Invoice | Production | LHDN e-invoice submission |
| Bank Feeds | Active | Transaction import & matching |
| Document Vault | Active | Receipt & document storage |
| Webhooks | Active | Real-time event notifications |

---

## Progressive Web App

### Overview

The application is a fully-featured Progressive Web App (PWA) built with `vite-plugin-pwa` and Workbox. It provides native app-like experience with offline support, installability, and automatic updates.

```
+------------------------------------------------------------------------+
|                         PWA Architecture                               |
+------------------------------------------------------------------------+
|                                                                        |
|   +-------------+    +----------------+    +------------------+        |
|   |   Browser   |--->| Service Worker |--->|  Cache Storage   |        |
|   |   (React)   |    |   (Workbox)    |    |  (Assets/API)    |        |
|   +------+------+    +-------+--------+    +------------------+        |
|          |                   |                                         |
|          v                   v                                         |
|   +-------------+    +----------------+                                |
|   | Install     |    | Update         |                                |
|   | Prompt UI   |    | Notification   |                                |
|   +-------------+    +----------------+                                |
|                                                                        |
+------------------------------------------------------------------------+
```

### PWA Features

| Feature | Description |
|---------|-------------|
| **Installable** | Add to home screen on mobile/desktop |
| **Offline Support** | Core functionality works without internet |
| **Auto Updates** | Seamless background updates with user notification |
| **Native Feel** | Standalone window, splash screen, app icons |
| **iOS Support** | Apple-specific meta tags and splash screens |

### Caching Strategies

```typescript
// Workbox runtime caching configuration
runtimeCaching: [
  {
    // API calls - Network first, fallback to cache
    urlPattern: /^https:\/\/api\./i,
    handler: "NetworkFirst",
    options: {
      cacheName: "api-cache",
      expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 },
    },
  },
  {
    // Static assets - Cache first
    urlPattern: /\.(js|css|woff2?)$/i,
    handler: "CacheFirst",
    options: {
      cacheName: "static-assets",
      expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 * 30 },
    },
  },
  {
    // Images - Stale while revalidate
    urlPattern: /\.(png|jpg|jpeg|svg|webp)$/i,
    handler: "StaleWhileRevalidate",
    options: {
      cacheName: "image-cache",
      expiration: { maxEntries: 50, maxAgeSeconds: 60 * 60 * 24 * 7 },
    },
  },
]
```

### PWA Components

| Component | Location | Description |
|-----------|----------|-------------|
| `usePWA` | `hooks/use-pwa.ts` | Core PWA hook for install/update/offline status |
| `PWAProvider` | `components/pwa/pwa-provider.tsx` | Root provider integrating all PWA UI |
| `PWAInstallPrompt` | `components/pwa/pwa-install-prompt.tsx` | Beautiful install modal |
| `PWAUpdatePrompt` | `components/pwa/pwa-update-prompt.tsx` | Update notification toast |
| `PWAOfflineIndicator` | `components/pwa/pwa-offline-indicator.tsx` | Online/offline status banner |

### usePWA Hook

```typescript
import { usePWA } from "@/hooks/use-pwa";

function MyComponent() {
  const {
    isOnline,           // Network connectivity status
    isInstalled,        // App already installed
    isStandalone,       // Running as standalone app
    needRefresh,        // New version available
    offlineReady,       // Service worker ready for offline
    canInstall,         // Install prompt available
    installApp,         // Trigger install prompt
    updateApp,          // Apply pending update
    dismissUpdate,      // Dismiss update notification
  } = usePWA();
}
```

### PWA Configuration

```typescript
// vite.config.ts
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    VitePWA({
      registerType: "prompt",         // Show update prompt
      includeAssets: ["favicon.ico", "robots.txt", "icons/*.png"],
      manifest: {
        name: "Open Bookkeeping",
        short_name: "Bookkeeping",
        theme_color: "#0f172a",
        background_color: "#0f172a",
        display: "standalone",
        start_url: "/",
        icons: [
          { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [/^\/api/],
      },
    }),
  ],
});
```

---

## Mobile-First Design

### Design Philosophy

The application follows a **mobile-first** approach with progressive enhancement for larger screens. All components are designed for touch interaction first, then enhanced for mouse/keyboard.

```
+------------------+    +------------------+    +------------------+
|     MOBILE       |    |     TABLET       |    |    DESKTOP       |
|    (< 640px)     |    |   (640-1024px)   |    |    (> 1024px)    |
+------------------+    +------------------+    +------------------+
| - Single column  |    | - 2 columns      |    | - Multi-column   |
| - Larger touch   |    | - Medium touch   |    | - Hover states   |
|   targets (48px) |    |   targets (44px) |    | - Keyboard nav   |
| - Bottom sheets  |    | - Side panels    |    | - Dense layouts  |
| - Full-width     |    | - Cards grid     |    | - Sidebar        |
| - Swipe gestures |    | - Modal dialogs  |    | - Context menus  |
+------------------+    +------------------+    +------------------+
```

### Responsive Breakpoints

| Breakpoint | Prefix | Usage |
|------------|--------|-------|
| `< 640px` | (default) | Mobile phones |
| `>= 640px` | `sm:` | Large phones, small tablets |
| `>= 768px` | `md:` | Tablets |
| `>= 1024px` | `lg:` | Small laptops |
| `>= 1280px` | `xl:` | Desktops |
| `>= 1536px` | `2xl:` | Large monitors |

### Touch Optimization Patterns

```tsx
// Larger touch targets on mobile
<button className={cn(
  "min-h-[48px] sm:min-h-[40px]",        // Larger on mobile
  "py-3 sm:py-2",                         // More padding on mobile
  "active:scale-[0.98] sm:active:scale-100", // Touch feedback
  "active:bg-muted/30 sm:active:bg-transparent"
)}>
  Click me
</button>

// Touch-friendly spacing
<div className="gap-4 sm:gap-3">          // More space on mobile
  {items.map(item => (
    <div className="py-4 sm:py-3">        // Larger tap areas
      {item.name}
    </div>
  ))}
</div>

// Safe area support for notched devices
<footer className="pb-[env(safe-area-inset-bottom)]">
  {/* Footer content */}
</footer>
```

### Animation Patterns

```tsx
import { motion, useInView, AnimatePresence } from "motion/react";

// Scroll-triggered animations
const ref = useRef(null);
const isInView = useInView(ref, { once: true, margin: "-50px" });

<motion.div
  ref={ref}
  initial={{ opacity: 0, y: 30 }}
  animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
  transition={{ duration: 0.5, ease: [0.25, 0.4, 0.25, 1] }}
>
  {/* Content appears on scroll */}
</motion.div>

// Staggered children animations
{items.map((item, index) => (
  <motion.div
    key={item.id}
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay: index * 0.05 }}  // Stagger effect
  >
    {item.content}
  </motion.div>
))}
```

### Landing Page Components

| Component | Location | Description |
|-----------|----------|-------------|
| `Hero` | `components/layout/landing/hero.tsx` | Hero section with mobile nav drawer |
| `Features` | `components/layout/landing/features.tsx` | Feature cards grid (1→2→4 cols) |
| `Showcase` | `components/layout/landing/showcase.tsx` | Bento grid product showcase |
| `FAQ` | `components/layout/landing/faq.tsx` | Expandable FAQ accordion |
| `Footer` | `components/layout/landing/footer.tsx` | Footer with link sections |

### Mobile Navigation Pattern

```tsx
// Mobile drawer navigation in Hero component
const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

// Toggle button with animated icon
<button onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
  <AnimatePresence mode="wait">
    {mobileMenuOpen ? (
      <motion.div key="close" initial={{ rotate: -90 }} animate={{ rotate: 0 }}>
        <XIcon />
      </motion.div>
    ) : (
      <motion.div key="menu" initial={{ rotate: 90 }} animate={{ rotate: 0 }}>
        <MenuIcon />
      </motion.div>
    )}
  </AnimatePresence>
</button>

// Full-screen drawer with spring animation
<AnimatePresence>
  {mobileMenuOpen && (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ type: "spring", damping: 25, stiffness: 300 }}
      className="fixed inset-x-0 top-16 bottom-0 bg-background/98 backdrop-blur-xl"
    >
      {/* Navigation links */}
    </motion.div>
  )}
</AnimatePresence>
```

---

## AI Agent

### Overview

The AI Agent is an intelligent assistant built on the **ReAct (Reasoning + Acting)** framework. It can analyze data, create documents, and automate accounting tasks with full audit trails, approval workflows, and persistent memory systems.

```
+------------------------------------------------------------------------+
|                           AI AGENT (ReAct Framework)                   |
+------------------------------------------------------------------------+
|                                                                        |
|   +---------+    +----------+    +-----------+    +----------+         |
|   |  Chat   |--->| Session  |--->|  Think &  |--->|  Tools   |         |
|   |Interface|    | Memory   |    |   Plan    |    |  (29+)   |         |
|   +---------+    +----------+    +-----------+    +----+-----+         |
|                       |                                |               |
|                       v                                v               |
|              +----------------+              +------------------+      |
|              |  Long-term     |              |     Actions      |      |
|              |    Memory      |              |                  |      |
|              | (Preferences,  |              +--------+---------+      |
|              |  Facts, Rules) |                       |               |
|              +----------------+                       |               |
|                                     +-----------------+-------+       |
|                                     |                 |       |       |
|                                     v                 v       v       |
|                               +---------+      +----------+ +-----+   |
|                               |Approval |      |  Audit   | |Safety|  |
|                               | Queue   |      |   Logs   | |Ctrls |  |
|                               +---------+      +----------+ +-----+   |
|                                                                        |
+------------------------------------------------------------------------+
```

### ReAct Framework

The agent follows a structured reasoning-action loop:

```
User Input
    |
    v
+------------------+
|  1. THINK        |  <-- Analyze context, recall memories
|     - What is    |
|       being asked|
|     - What do I  |
|       know       |
+--------+---------+
         |
         v
+------------------+
|  2. PLAN         |  <-- Decide approach
|     - Which tools|
|     - What order |
|     - Validation |
+--------+---------+
         |
         v
+------------------+
|  3. ACT          |  <-- Execute tools
|     - Call tool  |
|     - Get result |
+--------+---------+
         |
         v
+------------------+
|  4. OBSERVE      |  <-- Process results
|     - Verify     |
|     - Learn      |
|     - Remember   |
+--------+---------+
         |
         v
    Response / Next Cycle
```

### Memory Systems

#### Session Memory (Conversation Persistence)

Sessions persist across browser refreshes and page reloads. Each session maintains:
- Full conversation history
- Tool execution context
- Pending approvals state

```typescript
// Session automatically created/restored
// Stored in localStorage + server-side database
X-Session-Id: "sess_abc123..."
```

#### Long-term Memory (Persistent Knowledge)

The agent learns and remembers across sessions:

| Memory Type | Description | Example |
|-------------|-------------|---------|
| `preference` | User preferences | "Always include SST at 6%" |
| `fact` | Business facts | "Main supplier is ABC Corp" |
| `pattern` | Usage patterns | "Usually invoices on Fridays" |
| `instruction` | Standing orders | "Auto-approve invoices under RM500" |

```typescript
// Agent can store memories
await rememberPreference({
  type: "preference",
  content: "User prefers payment terms of NET 30",
  context: "invoice_creation",
  importance: 8
});

// Agent can recall relevant memories
const memories = await recallMemories({
  query: "invoice creation preferences",
  limit: 5
});
```

### Available Tools

#### Reasoning Tools (ReAct)

| Tool | Description |
|------|-------------|
| `thinkStep` | Record explicit thinking/reasoning before acting |
| `validateAction` | Validate planned action before execution |

#### Memory Tools

| Tool | Description |
|------|-------------|
| `rememberPreference` | Store user preferences/facts/patterns |
| `recallMemories` | Retrieve relevant memories for context |
| `updateUserContext` | Update business context information |

#### Read Operations

| Tool | Description |
|------|-------------|
| `getDashboardStats` | Revenue, expenses, profit metrics |
| `listInvoices` | Query invoices with filters |
| `getInvoiceDetails` | Full invoice with line items |
| `getAgingReport` | Receivables aging analysis |
| `listCustomers` | Customer directory |
| `searchCustomers` | Find customers by name/email |
| `getCustomerInvoices` | Customer invoice history |
| `listQuotations` | Active quotations |
| `listBills` | Payables listing |
| `getBillDetails` | Full bill information |
| `listVendors` | Vendor directory |
| `getAccountBalance` | Account balances |
| `getTrialBalance` | Trial balance report |
| `getProfitLoss` | P&L statement |
| `getBalanceSheet` | Balance sheet report |
| `listAccounts` | Chart of accounts |

#### Write Operations

| Tool | Description | Approval |
|------|-------------|----------|
| `createInvoice` | Generate new invoice | Threshold |
| `updateInvoice` | Update existing invoice | Threshold |
| `createBill` | Record new bill | Threshold |
| `updateBill` | Update existing bill | Threshold |
| `createJournalEntry` | Manual journal entry | Threshold |
| `postJournalEntry` | Post to ledger | Required |
| `reverseJournalEntry` | Reverse posted entry | Required |
| `createCustomer` | Add new customer | Auto |
| `updateCustomer` | Update customer details | Auto |
| `createVendor` | Add new vendor | Auto |
| `updateVendor` | Update vendor details | Auto |
| `createQuotation` | Create price quotation | Auto |
| `updateQuotation` | Update quotation | Auto |
| `convertQuotation` | Convert quotation to invoice | Threshold |

### Approval Workflow

```
  User Request          AI Processes           Check Thresholds
       |                     |                       |
       v                     v                       v
  +---------+         +-----------+          +--------------+
  |  Chat   |-------->|  Execute  |--------->|   Amount >   |
  | Message |         |   Tool    |          |  Threshold?  |
  +---------+         +-----------+          +------+-------+
                                                    |
                           +------------------------+--------+
                           |                                 |
                           v                                 v
                    +-------------+                  +-------------+
                    |   Queue     |                  |   Auto      |
                    |  Approval   |                  |  Approve    |
                    +------+------+                  +------+------+
                           |                                |
                           v                                |
                    +-------------+                         |
                    |   Review    |                         |
                    |  & Decide   |                         |
                    +------+------+                         |
                           |                                |
                           v                                v
                    +-----------------------------------------+
                    |              Execute Action             |
                    |              + Audit Log                |
                    +-----------------------------------------+
```

### Safety Controls

| Control | Description |
|---------|-------------|
| **Emergency Stop** | Instantly halt all AI actions |
| **Daily Quotas** | Limit actions per day (invoices, bills, etc.) |
| **Amount Limits** | Maximum single transaction amount |
| **Token Limits** | Daily API token usage cap |
| **Rate Limits** | Actions per minute throttling |

### Configuration Options

```typescript
// Approval Settings
{
  requireApproval: boolean,        // Global approval toggle
  invoiceThreshold: string | null, // MYR amount for invoices
  billThreshold: string | null,    // MYR amount for bills
  journalEntryThreshold: string | null,
  autoApproveReadOnly: boolean,    // Skip approval for reads
  autoApproveRecurring: boolean,   // Auto-approve scheduled
  approvalTimeoutHours: string,    // Expiry for pending
}

// Quota Settings
{
  dailyInvoiceLimit: number,       // Max invoices per day
  dailyBillLimit: number,
  dailyJournalEntryLimit: number,
  dailyTokenLimit: number,         // AI token budget
  maxSingleInvoiceAmount: string,  // Per-invoice cap
  maxDailyTotalAmount: string,     // Total daily cap
}
```

---

## API Reference

### API Architecture

```
+-------------------------------------------------------------+
|                      API Gateway                            |
|                    (Hono Server)                            |
+-------------------------------------------------------------+
|                           |                                 |
|    +----------------------+----------------------+          |
|    |                      |                      |          |
|    v                      v                      v          |
| +----------+        +----------+          +----------+      |
| |  tRPC    |        |  REST    |          |   AI     |      |
| | /trpc/*  |        | /api/v1  |          | /api/ai  |      |
| +----+-----+        +----+-----+          +----+-----+      |
|      |                   |                      |           |
|      v                   v                      v           |
| +----------+        +----------+          +----------+      |
| | Supabase |        | API Key  |          | Bearer   |      |
| |  Auth    |        |  Auth    |          |  Token   |      |
| +----------+        +----------+          +----------+      |
|                                                             |
+-------------------------------------------------------------+
```

### Internal API (tRPC)

**Base Path:** `/trpc/*`
**Auth:** Supabase Bearer Token
**Used By:** Web app, Mobile app

#### Available Routers

| Router | Description |
|--------|-------------|
| `invoice` | Invoice CRUD, send, mark paid |
| `quotation` | Quotation management |
| `creditNote` | Credit note operations |
| `debitNote` | Debit note operations |
| `bill` | Bill management |
| `customer` | Customer CRUD |
| `vendor` | Vendor CRUD |
| `account` | Chart of accounts |
| `journalEntry` | Journal entries |
| `bankFeed` | Bank transaction import |
| `dashboard` | Analytics & stats |
| `settings` | User preferences |
| `agent` | AI agent operations |
| `apiKey` | API key management |
| `webhook` | Webhook configuration |
| `fixedAsset` | Asset management |

### Public REST API

**Base Path:** `/api/v1/*`
**Auth:** API Key (`Authorization: Bearer ob_live_xxx`)
**Docs:** `/api/docs` (Swagger UI)

#### Endpoints

| Method | Path | Description |
|--------|------|-------------|
| | **Invoices** | |
| `GET` | `/api/v1/invoices` | List invoices |
| `POST` | `/api/v1/invoices` | Create invoice |
| `GET` | `/api/v1/invoices/:id` | Get invoice |
| `PATCH` | `/api/v1/invoices/:id` | Update invoice |
| `DELETE` | `/api/v1/invoices/:id` | Delete invoice |
| `POST` | `/api/v1/invoices/:id/send` | Send invoice |
| `POST` | `/api/v1/invoices/:id/paid` | Mark as paid |
| `POST` | `/api/v1/invoices/:id/void` | Void invoice |
| | **Customers** | |
| `GET` | `/api/v1/customers` | List customers |
| `POST` | `/api/v1/customers` | Create customer |
| `GET` | `/api/v1/customers/:id` | Get customer |
| `PATCH` | `/api/v1/customers/:id` | Update customer |
| `DELETE` | `/api/v1/customers/:id` | Delete customer |
| | **Vendors** | |
| `GET` | `/api/v1/vendors` | List vendors |
| `POST` | `/api/v1/vendors` | Create vendor |
| `GET` | `/api/v1/vendors/:id` | Get vendor |
| `PATCH` | `/api/v1/vendors/:id` | Update vendor |
| `DELETE` | `/api/v1/vendors/:id` | Delete vendor |
| | **Quotations** | |
| `GET` | `/api/v1/quotations` | List quotations |
| `POST` | `/api/v1/quotations` | Create quotation |
| `POST` | `/api/v1/quotations/:id/convert` | Convert to invoice |
| | **Bills** | |
| `GET` | `/api/v1/bills` | List bills |
| `POST` | `/api/v1/bills` | Create bill |
| `POST` | `/api/v1/bills/:id/paid` | Mark as paid |
| | **Accounts** | |
| `GET` | `/api/v1/accounts` | Chart of accounts |
| | **Webhooks** | |
| `GET` | `/api/v1/webhooks` | List webhooks |
| `POST` | `/api/v1/webhooks` | Create webhook |
| `DELETE` | `/api/v1/webhooks/:id` | Delete webhook |

### Webhook Events

```
Invoice Events          Customer Events         Bill Events
+------------------+    +------------------+    +------------------+
| invoice.created  |    | customer.created |    | bill.created     |
| invoice.updated  |    | customer.updated |    | bill.updated     |
| invoice.deleted  |    | customer.deleted |    | bill.deleted     |
| invoice.sent     |    +------------------+    | bill.paid        |
| invoice.paid     |                            +------------------+
| invoice.voided   |    Vendor Events
+------------------+    +------------------+    Quotation Events
                        | vendor.created   |    +------------------+
                        | vendor.updated   |    | quotation.created|
                        | vendor.deleted   |    | quotation.updated|
                        +------------------+    | quotation.deleted|
                                                | quotation.accepted|
                                                +------------------+
```

### SDK Usage

```typescript
import { OpenBookkeeping } from '@open-bookkeeping/sdk';

// Initialize client
const client = new OpenBookkeeping({
  apiKey: 'ob_live_xxxxx',
  baseUrl: 'https://api.open-bookkeeping.com', // optional
});

// List invoices
const { data: invoices } = await client.invoices.list({
  status: 'unpaid',
  limit: 10,
});

// Create customer
const customer = await client.customers.create({
  name: 'Acme Corporation',
  email: 'billing@acme.com',
  phone: '+60123456789',
});

// Create invoice
const invoice = await client.invoices.create({
  customerId: customer.id,
  items: [
    { description: 'Consulting', quantity: 10, rate: 500 }
  ],
  dueDate: '2024-02-15',
});

// Send invoice
await client.invoices.send(invoice.id);

// Verify webhook signature
import { constructWebhookEvent } from '@open-bookkeeping/sdk/webhooks';

const event = await constructWebhookEvent(
  payload,
  signature,
  timestamp,
  webhookSecret
);
```

---

## Architecture

### Project Structure

```
invoicely-v2/
|
+-- apps/
|   |
|   +-- web/                    # React Frontend (port 5173)
|   |   +-- public/
|   |   |   +-- icons/          # PWA app icons (192, 512, maskable)
|   |   |   +-- offline.html    # Offline fallback page
|   |   |   +-- robots.txt      # SEO configuration
|   |   +-- src/
|   |       +-- api/            # React Query hooks (21 modules)
|   |       +-- assets/         # Icons, images
|   |       +-- components/
|   |       |   +-- agent/      # AI Agent UI components
|   |       |   +-- ui/         # Base UI (Radix)
|   |       |   +-- pdf/        # PDF templates
|   |       |   +-- pwa/        # PWA components (install, update, offline)
|   |       |   +-- layout/
|   |       |   |   +-- landing/  # Landing page (hero, features, etc.)
|   |       |   +-- [feature]/  # Feature components
|   |       +-- constants/      # Links, sidebar config
|   |       +-- global/
|   |       |   +-- atoms/      # Jotai state atoms
|   |       |   +-- indexdb/    # Offline storage
|   |       +-- hooks/          # Custom React hooks
|   |       |   +-- use-pwa.ts  # PWA functionality hook
|   |       +-- providers/      # React context providers
|   |       +-- routes/         # Page components
|   |       +-- types/          # TypeScript declarations
|   |       |   +-- pwa.d.ts    # PWA virtual module types
|   |       +-- zod-schemas/    # Validation schemas
|   |
|   +-- api/                    # Hono Backend (port 3001)
|       +-- src/
|           +-- routes/
|           |   +-- ai.ts       # AI chat endpoint
|           |   +-- v1/         # Public REST API
|           |   +-- [feature]/  # Feature routes
|           +-- trpc/
|           |   +-- router.ts   # Root router
|           |   +-- services/   # tRPC procedures
|           +-- services/       # Business logic
|           |   +-- approval.service.ts
|           |   +-- agent-audit.service.ts
|           |   +-- agent-safety.service.ts
|           |   +-- agent-memory.service.ts   # Session & long-term memory
|           |   +-- workflow-engine.service.ts
|           +-- middleware/     # Auth, rate limiting
|           +-- workers/        # Background jobs
|           +-- lib/            # Utilities
|
+-- packages/
|   |
|   +-- db/                     # Database Package
|   |   +-- src/
|   |   |   +-- schema/         # Drizzle schemas (21 files)
|   |   |   |   +-- agentMemory.ts  # Agent memory tables
|   |   |   +-- repositories/   # Data access layer
|   |   +-- migrations/         # SQL migrations
|   |
|   +-- sdk/                    # Public TypeScript SDK
|   |   +-- src/
|   |       +-- client.ts       # API client
|   |       +-- resources/      # Resource endpoints
|   |       +-- webhooks.ts     # Webhook utilities
|   |
|   +-- shared/                 # Shared utilities
|       +-- src/
|           +-- logger.ts
|           +-- types.ts
|
+-- .env.example                # Environment template
+-- CLAUDE.md                   # This file
+-- package.json                # Workspace root
```

### Data Flow

```
+-------------+    +-------------+    +-------------+
|   Browser   |--->|   Hono      |--->|  PostgreSQL |
|   (React)   |    |   Server    |    |  (Supabase) |
+-------------+    +------+------+    +-------------+
                          |
                          |
         +----------------+----------------+
         |                |                |
         v                v                v
   +----------+    +----------+    +----------+
   |   Redis  |    |  BullMQ  |    | Supabase |
   |  Cache   |    |  Queue   |    |  Storage |
   +----------+    +----------+    +----------+
```

---

## Development

### Prerequisites

- Node.js 20+
- Yarn 4+ (Corepack)
- PostgreSQL 15+ (or Supabase)
- Redis (for queues)

### Commands

| Command | Description |
|---------|-------------|
| `yarn dev` | Start all services (web + api) |
| `yarn dev:web` | Frontend only (port 5173) |
| `yarn dev:api` | Backend only (port 3001) |
| `yarn build` | Production build |
| `yarn check-types` | TypeScript validation |
| `yarn lint` | ESLint check |
| `yarn test:e2e` | Playwright tests |

### Database Commands

| Command | Description |
|---------|-------------|
| `yarn db:generate` | Generate migration from schema |
| `yarn db:migrate` | Apply migrations |
| `yarn db:push` | Direct schema sync (slow) |
| `yarn db:studio` | Open Drizzle Studio |

> **Note:** Always use `yarn db:generate` then `yarn db:migrate` instead of `yarn db:push`. The push command pulls the entire remote schema which is slow with Supabase.

### Environment Variables

```bash
# Supabase
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=xxx
DATABASE_URL=postgresql://...

# Redis (for rate limiting, queues)
UPSTASH_REDIS_REST_URL=https://xxx.upstash.io
UPSTASH_REDIS_REST_TOKEN=xxx

# AI (for agent features)
OPENAI_API_KEY=sk-xxx
# or
ANTHROPIC_API_KEY=sk-ant-xxx
```

---

## Key Patterns

### Form Validation

```typescript
// Zod schema in apps/web/src/zod-schemas/
const invoiceSchema = z.object({
  customerId: z.string().uuid(),
  items: z.array(lineItemSchema).min(1),
  dueDate: z.string().datetime(),
});

// Form with React Hook Form
const form = useForm({
  resolver: zodResolver(invoiceSchema),
});
```

### tRPC Service Pattern

```typescript
// apps/api/src/trpc/services/invoice.ts
export const invoiceRouter = router({
  list: protectedProcedure
    .input(z.object({ status: z.enum(['draft', 'sent', 'paid']).optional() }))
    .query(async ({ ctx, input }) => {
      return invoiceRepository.findMany({
        userId: ctx.user.id,
        status: input.status,
      });
    }),

  create: protectedProcedure
    .input(createInvoiceSchema)
    .mutation(async ({ ctx, input }) => {
      // Business logic here
    }),
});
```

### State Management

```typescript
// Jotai for UI state (apps/web/src/global/atoms/)
export const sidebarOpenAtom = atom(true);

// React Query for server state
const { data, isLoading } = useQuery({
  queryKey: ['invoices', filters],
  queryFn: () => api.invoices.list(filters),
});
```

### PDF Generation

```typescript
// apps/web/src/components/pdf/
import { Document, Page, Text, View } from '@react-pdf/renderer';

export function InvoicePDF({ invoice }) {
  return (
    <Document>
      <Page size="A4">
        <View>{/* Invoice content */}</View>
      </Page>
    </Document>
  );
}
```

---

## Database Schema

### Core Tables

| Table | Description |
|-------|-------------|
| `users` | User accounts |
| `organizations` | Business entities |
| `invoices` | Sales invoices |
| `invoice_items` | Invoice line items |
| `quotations` | Price quotations |
| `credit_notes` | Credit adjustments |
| `debit_notes` | Debit adjustments |
| `bills` | Purchase bills |
| `customers` | Customer records |
| `vendors` | Vendor records |
| `accounts` | Chart of accounts |
| `journal_entries` | Accounting entries |
| `journal_entry_lines` | Entry line items |
| `bank_feeds` | Bank transactions |
| `fixed_assets` | Asset register |

### AI Agent Tables

| Table | Description |
|-------|-------------|
| `agent_approval_settings` | User approval preferences |
| `agent_pending_approvals` | Actions awaiting approval |
| `agent_audit_logs` | Action history with reasoning |
| `agent_quotas` | Usage limits and safety settings |
| `agent_usage` | Daily usage tracking |
| `agent_workflows` | Multi-step workflow definitions |
| `agent_workflow_steps` | Workflow step configurations |
| `agent_sessions` | Chat session tracking |
| `agent_messages` | Conversation message history |
| `agent_memories` | Long-term memory storage (preferences, facts, patterns) |
| `agent_user_context` | Business context per user |

---

## Support

| Resource | Link |
|----------|------|
| GitHub Issues | [Report a bug](https://github.com/hazlijohar95/open-bookkeeping.com/issues) |
| Documentation | This file |
| API Docs | `/api/docs` (when running) |

---

<div align="center">

**Built with care for Malaysian businesses**

MIT License

</div>
