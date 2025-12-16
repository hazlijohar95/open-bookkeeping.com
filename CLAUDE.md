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
| [Agentic UX](#agentic-ux-components) | Thinking visibility, approvals, memory |
| [API Reference](#-api-reference) | REST & tRPC endpoints |
| [Development](#-development) | Setup & commands |
| [Architecture](#-architecture) | System design |

---

## Tech Stack

| Layer | Technologies |
|-------|-------------|
| **Frontend** | React 19, Vite, TypeScript, Tailwind CSS 4, Radix UI, Jotai |
| **Backend** | Hono, tRPC 11, Node.js |
| **AI** | Vercel AI SDK 5, OpenAI GPT-4o/GPT-4o-mini |
| **Database** | PostgreSQL (Supabase), Drizzle ORM |
| **Auth** | Supabase Auth + API Keys |
| **Queue** | BullMQ + Redis |
| **PDF** | @react-pdf/renderer |
| **PWA** | vite-plugin-pwa, Workbox |
| **Animation** | Motion (Framer Motion) |

---

## System Overview

```
╔═══════════════════════════════════════════════════════════════════════════════╗
║                           OPEN BOOKKEEPING PLATFORM                           ║
╠═══════════════════════════════════════════════════════════════════════════════╣
║                                                                               ║
║  ┌─────────────────────────────────────────────────────────────────────────┐  ║
║  │                         🌐 FRONTEND (React 19)                          │  ║
║  ├─────────────────────────────────────────────────────────────────────────┤  ║
║  │                                                                         │  ║
║  │   ┌───────────┐  ┌───────────┐  ┌───────────┐  ┌───────────┐           │  ║
║  │   │ Dashboard │  │ Invoicing │  │  Payroll  │  │    AI     │           │  ║
║  │   │  Charts   │  │   Forms   │  │  Module   │  │   Agent   │           │  ║
║  │   └───────────┘  └───────────┘  └───────────┘  └───────────┘           │  ║
║  │                                                                         │  ║
║  │   ┌─────────────────────────────────────────────────────────────────┐  │  ║
║  │   │                    📱 PWA + Mobile-First                        │  │  ║
║  │   │   Install Prompt • Offline Support • Push Notifications        │  │  ║
║  │   └─────────────────────────────────────────────────────────────────┘  │  ║
║  │                                                                         │  ║
║  └───────────────────────────────────┬─────────────────────────────────────┘  ║
║                                      │                                        ║
║                                      │ tRPC / REST                            ║
║                                      ▼                                        ║
║  ┌─────────────────────────────────────────────────────────────────────────┐  ║
║  │                         ⚙️ BACKEND (Hono + tRPC)                         │  ║
║  ├─────────────────────────────────────────────────────────────────────────┤  ║
║  │                                                                         │  ║
║  │   ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                 │  ║
║  │   │   tRPC API   │  │   REST API   │  │   AI Routes  │                 │  ║
║  │   │   /trpc/*    │  │   /api/v1/*  │  │   /api/ai/*  │                 │  ║
║  │   └──────────────┘  └──────────────┘  └──────────────┘                 │  ║
║  │                                                                         │  ║
║  │   ┌─────────────────────────────────────────────────────────────────┐  │  ║
║  │   │                      🤖 AI AGENT (ReAct)                        │  │  ║
║  │   │   Memory • Reasoning • Tools • Approvals • Safety Controls     │  │  ║
║  │   └─────────────────────────────────────────────────────────────────┘  │  ║
║  │                                                                         │  ║
║  └───────────────────────────────────┬─────────────────────────────────────┘  ║
║                                      │                                        ║
║        ┌─────────────────────────────┼─────────────────────────────┐         ║
║        │                             │                             │         ║
║        ▼                             ▼                             ▼         ║
║  ┌───────────┐                ┌───────────┐                ┌───────────┐     ║
║  │ PostgreSQL│                │   Redis   │                │  Supabase │     ║
║  │ (Drizzle) │                │  (Cache)  │                │  Storage  │     ║
║  └───────────┘                └───────────┘                └───────────┘     ║
║                                                                               ║
╚═══════════════════════════════════════════════════════════════════════════════╝
```

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
|   +---------+    +------------+    +-----------+    +----------+       |
|   |  Chat   |--->|   Intent   |--->|  Think &  |--->|  Tools   |       |
|   |Interface|    |  Detection |    |   Plan    |    |  (113+)  |       |
|   +---------+    +------+-----+    +-----------+    +----+-----+       |
|                         |                                |             |
|            +------------+------------+                   |             |
|            |                         |                   v             |
|            v                         v          +------------------+   |
|     +------------+           +------------+     |     Actions      |   |
|     | Fast Path  |           | Full Agent |     |                  |   |
|     | (gpt-4o-   |           | (gpt-4o +  |     +--------+---------+   |
|     |   mini)    |           |   tools)   |              |             |
|     +------------+           +------------+              |             |
|                                     |      +-------------+-------+    |
|                                     v      |             |       |    |
|                              +---------+ +----------+ +-----+        |
|                              |Approval | |  Audit   | |Safety|        |
|                              | Queue   | |   Logs   | |Ctrls |        |
|                              +---------+ +----------+ +-----+        |
|                                                                        |
+------------------------------------------------------------------------+
```

### Performance Optimization

The AI agent uses **intent detection** to route messages efficiently:

| Message Type | Model | Tools | Response Time |
|--------------|-------|-------|---------------|
| Greetings ("hey", "hi", "hello") | GPT-4o-mini | None | ~1-2s |
| Thanks/acknowledgments | GPT-4o-mini | None | ~1-2s |
| Help requests | GPT-4o-mini | None | ~1-2s |
| Business queries | GPT-4o | 113 tools | ~3-12s |

**Fast Path Detection** (`apps/api/src/routes/ai.ts`):
- Messages under 50 characters matching greeting/thanks patterns skip tool loading
- Uses GPT-4o-mini for faster, cheaper responses
- Only loads last 3 messages for context
- Reduces token usage from ~10,000 to ~200 tokens

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

### Available Tools (113+)

The agent has access to 113+ tools organized by category:

#### Tool Categories

| Category | Count | Description |
|----------|-------|-------------|
| **Dashboard & Stats** | 5 | Revenue metrics, aging reports, statements |
| **Invoices** | 12 | CRUD, status updates, aging, posting |
| **Quotations** | 8 | CRUD, conversion to invoice |
| **Credit/Debit Notes** | 10 | Create from invoice, void, status updates |
| **Bills** | 10 | CRUD, aging, payment tracking |
| **Customers** | 8 | CRUD, search, statements, invoice history |
| **Vendors** | 8 | CRUD, search, statements, bill history |
| **Accounts** | 8 | Chart of accounts, balances, CRUD |
| **Journal Entries** | 6 | Create, post, reverse, list |
| **Smart Accounting** | 5 | Auto-posting: sales, expenses, payments |
| **Bank Transactions** | 6 | List, match, reconcile, unmatch |
| **Fixed Assets** | 8 | CRUD, depreciation, disposal |
| **Payroll** | 12 | Employees, runs, pay slips, statutory |
| **Documents** | 5 | Vault processing, OCR extraction |
| **Migration** | 6 | Opening balances, account mapping |
| **Memory** | 3 | Remember, recall, update context |
| **Reasoning** | 2 | Think step, validate action |

#### Key Tools by Function

**Read Operations:**
- `getDashboardStats`, `getAgingReport`, `getTrialBalance`, `getProfitAndLoss`, `getBalanceSheet`
- `listInvoices`, `listBills`, `listCustomers`, `listVendors`, `listQuotations`
- `getCustomerStatement`, `getVendorStatement`, `getSSTReport`

**Smart Accounting (Auto-posting):**
- `recordSalesRevenue` - Auto DR/CR for sales
- `recordExpense` - Auto DR/CR for expenses
- `recordPaymentReceived` - Customer payment with correct entries
- `recordPaymentMade` - Vendor payment with correct entries
- `postInvoiceToLedger` - Invoice to accounting entries

**Write Operations:**

| Tool | Approval |
|------|----------|
| `createInvoice`, `createBill` | Threshold-based |
| `createJournalEntry`, `postJournalEntry` | Required |
| `createCustomer`, `createVendor` | Auto |
| `createQuotation`, `updateQuotation` | Auto |

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

## Agentic UX Components

### Overview

The platform features a sophisticated **Agentic UX** system that provides transparency, control, and trust for AI-assisted operations. These components make the AI's reasoning visible, allow inline approvals, and provide intelligent error recovery.

```
+------------------------------------------------------------------------+
|                        AGENTIC UX ARCHITECTURE                         |
+------------------------------------------------------------------------+
|                                                                        |
|  +------------------+  +------------------+  +------------------+       |
|  |   THINKING       |  |   APPROVAL       |  |   MEMORY         |      |
|  |   VISIBILITY     |  |   WORKFLOW       |  |   BROWSER        |      |
|  +--------+---------+  +--------+---------+  +--------+---------+      |
|           |                     |                     |                |
|           v                     v                     v                |
|  +------------------+  +------------------+  +------------------+       |
|  | ThinkingStep     |  | ApprovalInline   |  | MemoryPanel      |      |
|  | - Reasoning      |  | - Quick actions  |  | - View memories  |      |
|  | - Steps          |  | - Review details |  | - Edit/delete    |      |
|  | - Confidence     |  | - Approve/reject |  | - Filter/search  |      |
|  +------------------+  +------------------+  +------------------+       |
|                                                                        |
|  +---------------------------------------------------------------------+
|  |                       ERROR RECOVERY                                |
|  +---------------------------------------------------------------------+
|  | ErrorRecovery - Smart classification, suggestions, retry actions    |
|  +---------------------------------------------------------------------+
|                                                                        |
+------------------------------------------------------------------------+
```

### Component Reference

| Component | Location | Purpose |
|-----------|----------|---------|
| `ThinkingStep` | `components/agent/thinking-step.tsx` | Display AI reasoning process |
| `ApprovalInline` | `components/agent/approval-inline.tsx` | Inline approval cards |
| `MemoryPanel` | `components/agent/memory-panel.tsx` | Memory browser & editor |
| `ErrorRecovery` | `components/agent/error-recovery.tsx` | Smart error handling |

---

### ThinkingStep Component

Displays the AI's step-by-step reasoning process, making the "black box" transparent to users.

```
┌─────────────────────────────────────────────────────────────────────┐
│  ◐ Thinking...                                          [Collapse] │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─ Step 1 ─────────────────────────────────────────────────────┐  │
│  │ ✓ Analyzing Request                                          │  │
│  │   Understanding what the user wants to accomplish            │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  ┌─ Step 2 ─────────────────────────────────────────────────────┐  │
│  │ ⟳ Gathering Data                                              │  │
│  │   Fetching customer and invoice information                  │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  ┌─ Step 3 ─────────────────────────────────────────────────────┐  │
│  │ ○ Planning Action                                             │  │
│  │   Determining the best approach to create the invoice        │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  Confidence: ████████░░ 85%                                        │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

#### Features

| Feature | Description |
|---------|-------------|
| **Step Visualization** | Shows each reasoning step with status (complete, in-progress, pending) |
| **Confidence Indicator** | Visual confidence bar (0-100%) |
| **Collapsible** | Expand/collapse for space efficiency |
| **Animated Transitions** | Smooth step-by-step reveal |

#### Usage

```tsx
import { ThinkingStep, ThinkingStepItem } from "@/components/agent/thinking-step";

const steps: ThinkingStepItem[] = [
  { id: "1", content: "Analyzing request", status: "complete" },
  { id: "2", content: "Fetching customer data", status: "in_progress" },
  { id: "3", content: "Creating invoice", status: "pending" },
];

<ThinkingStep
  steps={steps}
  confidence={85}
  isThinking={true}
  onCollapse={() => {}}
/>
```

---

### ApprovalInline Component

Enables users to approve or reject AI actions directly within the conversation flow.

```
┌─────────────────────────────────────────────────────────────────────┐
│  ⚠ Action Awaiting Approval                                        │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │ 📄 Create Invoice                                             │  │
│  │                                                               │  │
│  │ Customer:  Acme Corporation                                   │  │
│  │ Amount:    RM 5,000.00                                        │  │
│  │ Due Date:  15 Jan 2025                                        │  │
│  │                                                               │  │
│  │ ┌─────────────────────────────────────────────────────────┐  │  │
│  │ │ Line Items                                               │  │  │
│  │ │ • Consulting Services (10 hrs × RM 500)                 │  │  │
│  │ └─────────────────────────────────────────────────────────┘  │  │
│  │                                                               │  │
│  │ [Approve]  [Reject]  [Review Details →]                      │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  Expires in 23h 45m                                                 │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

#### Features

| Feature | Description |
|---------|-------------|
| **Quick Actions** | One-click approve/reject buttons |
| **Detail Preview** | Summary of action details inline |
| **Expandable Details** | Full action details on demand |
| **Expiry Timer** | Visual countdown for time-sensitive approvals |
| **Reason Input** | Optional rejection reason field |

#### Approval States

```
┌───────────┐    ┌───────────┐    ┌───────────┐
│  PENDING  │───>│ APPROVED  │    │ REJECTED  │
│   (new)   │    │ (success) │    │  (error)  │
└─────┬─────┘    └───────────┘    └───────────┘
      │                                 ▲
      └─────────────────────────────────┘
```

#### Usage

```tsx
import { ApprovalInline } from "@/components/agent/approval-inline";

<ApprovalInline
  approval={{
    id: "apr_123",
    actionType: "create_invoice",
    title: "Create Invoice",
    summary: "Invoice for Acme Corporation - RM 5,000.00",
    details: { customer: "Acme Corp", amount: 5000 },
    expiresAt: new Date("2025-01-15"),
    status: "pending",
  }}
  onApprove={(id) => approveAction(id)}
  onReject={(id, reason) => rejectAction(id, reason)}
/>
```

---

### MemoryPanel Component

Allows users to view, search, filter, and manage what the AI remembers about their preferences and business context.

```
┌─────────────────────────────────────────────────────────────────────┐
│  🧠 Agent Memory                                        [12 items] │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  🔍 [Search memories...                                        ]   │
│                                                                     │
│  [All (12)] [Preference (5)] [Fact (3)] [Pattern (2)] [Rule (2)]  │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─ Preference ─────────────────────────────────────────────────┐  │
│  │ ⚙ "Always include SST at 6% for invoices"                    │  │
│  │   Context: invoice_creation  •  Importance: 8/10             │  │
│  │   Created 3 days ago  •  Accessed 12 times                   │  │
│  │   [Edit] [Remove]                                            │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  ┌─ Fact ───────────────────────────────────────────────────────┐  │
│  │ 📄 "Main supplier is ABC Corporation Sdn Bhd"                 │  │
│  │   Context: vendor_lookup  •  Importance: 7/10                │  │
│  │   Created 1 week ago  •  Accessed 5 times                    │  │
│  │   [Edit] [Remove]                                            │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  ┌─ Pattern ────────────────────────────────────────────────────┐  │
│  │ ✨ "Usually creates invoices on Friday afternoons"            │  │
│  │   Context: scheduling  •  Importance: 5/10                   │  │
│  │   Created 2 weeks ago  •  Accessed 8 times                   │  │
│  │   [Edit] [Remove]                                            │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

#### Memory Types

| Type | Icon | Description | Example |
|------|------|-------------|---------|
| `preference` | ⚙ | User preferences | "Always include SST at 6%" |
| `fact` | 📄 | Business facts | "Main supplier is ABC Corp" |
| `pattern` | ✨ | Usage patterns | "Usually invoices on Fridays" |
| `instruction` | 👤 | Standing orders | "Auto-approve under RM500" |

#### Features

| Feature | Description |
|---------|-------------|
| **Search** | Full-text search across memory content |
| **Type Filters** | Filter by memory category |
| **Importance Ranking** | Visual importance indicator |
| **Access Tracking** | Shows how often memory is used |
| **Edit/Delete** | Manage individual memories |
| **Confirmation Dialog** | Safe deletion with confirmation |

#### Usage

```tsx
import { MemoryPanel, MemoryBadge } from "@/components/agent/memory-panel";

// Full panel
<MemoryPanel
  memories={memories}
  isLoading={false}
  onDelete={(id) => deleteMemory(id)}
  onEdit={(memory) => openEditDialog(memory)}
/>

// Inline badge for chat messages
<MemoryBadge
  type="preference"
  content="Always include SST at 6%"
  onClick={() => openMemoryPanel()}
/>
```

---

### ErrorRecovery Component

Provides intelligent error classification, contextual suggestions, and smart retry functionality.

```
┌─────────────────────────────────────────────────────────────────────┐
│  ⚠ Invalid Input                                    [validation]  │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  The request contained invalid or missing information.              │
│                                                                     │
│  ⚡ Suggestions                                                      │
│  → Check if all required fields are provided                        │
│  → Verify the format of dates, numbers, and emails                  │
│  → Ensure amounts are positive numbers                              │
│                                                                     │
│  ▸ Technical details                                                │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │ Missing required field: customerId                     [Copy] │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  [← Go Back]  [Get Help]                                           │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

#### Error Categories

| Category | Auto-Retry | Delay | Description |
|----------|------------|-------|-------------|
| `validation` | No | - | Input validation errors |
| `authentication` | Yes | 0s | Session/auth issues |
| `rate_limit` | Yes | 60s | Too many requests |
| `not_found` | No | - | Resource doesn't exist |
| `permission` | No | - | Access denied |
| `network` | Yes | 5s | Connection issues |
| `server` | Yes | 10s | Backend errors |
| `unknown` | Yes | 0s | Unclassified errors |

#### Smart Classification

```
Error Message                          → Category
─────────────────────────────────────────────────────────
"Missing required field: email"        → validation
"Session expired, please log in"       → authentication
"Rate limit exceeded (429)"            → rate_limit
"Customer not found"                   → not_found
"Permission denied for this action"    → permission
"Network request failed"               → network
"Internal server error (500)"          → server
```

#### Usage

```tsx
import { ErrorRecovery, InlineError } from "@/components/agent/error-recovery";

// Full error card
<ErrorRecovery
  error="Missing required field: customerId"
  onRetry={() => retryAction()}
  onDismiss={() => clearError()}
  onGoBack={() => goBack()}
/>

// Compact inline error
<InlineError
  error="Invalid email format"
  onRetry={() => retryValidation()}
/>
```

---

### Integration Example

Complete integration of all agentic UX components in a chat interface:

```tsx
import { ThinkingStep } from "@/components/agent/thinking-step";
import { ApprovalInline } from "@/components/agent/approval-inline";
import { MemoryPanel } from "@/components/agent/memory-panel";
import { ErrorRecovery } from "@/components/agent/error-recovery";

function AgentChat() {
  return (
    <div className="flex gap-4">
      {/* Main Chat Area */}
      <div className="flex-1 space-y-4">
        {/* AI Thinking State */}
        {isThinking && (
          <ThinkingStep
            steps={thinkingSteps}
            confidence={confidence}
            isThinking={true}
          />
        )}

        {/* Pending Approvals */}
        {pendingApprovals.map((approval) => (
          <ApprovalInline
            key={approval.id}
            approval={approval}
            onApprove={handleApprove}
            onReject={handleReject}
          />
        ))}

        {/* Error Display */}
        {error && (
          <ErrorRecovery
            error={error}
            onRetry={handleRetry}
            onDismiss={clearError}
          />
        )}
      </div>

      {/* Memory Sidebar */}
      <aside className="w-80">
        <MemoryPanel
          memories={memories}
          onDelete={deleteMemory}
          onEdit={editMemory}
        />
      </aside>
    </div>
  );
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

#### Available Routers (28)

| Router | Description |
|--------|-------------|
| `invoice` | Invoice CRUD, send, mark paid |
| `quotation` | Quotation management |
| `creditNote` | Credit note operations |
| `debitNote` | Debit note operations |
| `bill` | Bill management |
| `customer` | Customer CRUD |
| `vendor` | Vendor CRUD |
| `chartOfAccounts` | Chart of accounts |
| `ledger` | Journal entries & ledger |
| `bankFeed` | Bank transaction import |
| `dashboard` | Analytics & stats |
| `settings` | User preferences |
| `agent` | AI agent operations |
| `apiKey` | API key management |
| `webhook` | Webhook configuration |
| `fixedAsset` | Asset management |
| `payroll` | Employee & payroll management |
| `vault` | Document storage & processing |
| `storage` | File storage operations |
| `subscription` | Subscription management |
| `sst` | SST tax reports |
| `statements` | Customer/vendor statements |
| `einvoice` | MyInvois e-invoice integration |
| `migration` | Data migration tools |
| `companyProfile` | Company settings |
| `dataFlow` | Data flow visualization |
| `admin` | Superadmin operations |
| `blog` | Blog/content management |

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
|   |       +-- api/            # React Query hooks (27 modules)
|   |       +-- assets/         # Icons, images
|   |       +-- components/
|   |       |   +-- agent/      # AI Agent UI components
|   |       |   |   +-- chat-interface.tsx    # Main chat component
|   |       |   |   +-- thinking-step.tsx     # Reasoning visibility
|   |       |   |   +-- approval-inline.tsx   # Inline approvals
|   |       |   |   +-- memory-panel.tsx      # Memory browser
|   |       |   |   +-- error-recovery.tsx    # Smart error handling
|   |       |   |   +-- tool-result-card.tsx  # Tool execution display
|   |       |   |   +-- approval-queue.tsx    # Approval management
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
|   |       |   +-- superadmin/ # Superadmin dashboard pages
|   |       +-- types/          # TypeScript declarations
|   |       |   +-- pwa.d.ts    # PWA virtual module types
|   |       +-- zod-schemas/    # Validation schemas
|   |
|   +-- api/                    # Hono Backend (port 3001)
|       +-- src/
|           +-- routes/
|           |   +-- ai.ts       # AI chat endpoint (10k+ lines, 113 tools)
|           |   +-- v1/         # Public REST API
|           |   +-- [feature]/  # Feature routes
|           +-- trpc/
|           |   +-- router.ts   # Root router
|           |   +-- services/   # tRPC procedures
|           +-- services/       # Business logic (25+ services)
|           |   +-- agent-memory.service.ts   # Session & long-term memory
|           |   +-- agent-safety.service.ts   # Quotas, emergency stop
|           |   +-- agent-audit.service.ts    # Action logging
|           |   +-- approval.service.ts       # Approval workflows
|           |   +-- workflow-engine.service.ts
|           |   +-- document-processor.service.ts  # OCR & extraction
|           |   +-- subscription.service.ts
|           |   +-- admin.service.ts          # Superadmin operations
|           +-- middleware/     # Auth, rate limiting
|           +-- workers/        # Background jobs
|           +-- lib/            # Utilities
|
+-- packages/
|   |
|   +-- db/                     # Database Package
|   |   +-- src/
|   |   |   +-- schema/         # Drizzle schemas (41 files)
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

### Testing Commands

| Command | Description |
|---------|-------------|
| `yarn test` | Run unit tests in watch mode (Vitest) |
| `yarn test:run` | Run unit tests once |
| `yarn test:e2e` | Run E2E tests (Playwright) |
| `yarn test:e2e:ui` | Run E2E tests with UI |
| `yarn test:e2e:headed` | Run E2E tests in headed browser |
| `yarn test:e2e:report` | Show E2E test report |

### Test File Locations

```
apps/web/src/
├── lib/__tests__/          # Utility function tests
├── zod-schemas/__tests__/  # Schema validation tests
├── components/**/*.test.tsx # Component tests
└── e2e/                    # Playwright E2E tests
```

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

| Category | Tables |
|----------|--------|
| **Users & Auth** | `users`, `user_settings`, `user_audit_logs`, `organizations`, `company_profiles` |
| **Sales** | `invoices`, `invoices_v2`, `quotations`, `quotations_v2`, `credit_notes`, `credit_notes_v2`, `debit_notes`, `debit_notes_v2` |
| **Purchases** | `bills`, `vendors`, `payments` |
| **Customers** | `customers` |
| **Accounting** | `chart_of_accounts`, `journal_entries`, `journal_entry_lines`, `sst_transactions` |
| **Banking** | `bank_accounts`, `bank_transactions`, `bank_feeds` |
| **Assets** | `fixed_assets`, `fixed_asset_categories`, `fixed_asset_depreciations` |
| **Payroll** | `employees`, `employee_salaries`, `payroll_runs`, `pay_slips` |
| **Documents** | `vault_documents`, `vault_processing_jobs` |
| **E-Invoice** | `einvoice_submissions`, `einvoice_logs` |
| **Subscriptions** | `subscriptions`, `subscription_plans` |
| **System** | `api_keys`, `webhooks`, `blogs`, `system_settings`, `aggregations` |

### AI Agent Tables

| Table | Description |
|-------|-------------|
| `agent_approval_settings` | User approval preferences & thresholds |
| `agent_pending_approvals` | Actions awaiting user approval |
| `agent_audit_logs` | Full action history with reasoning |
| `agent_quotas` | Usage limits and safety settings |
| `agent_usage` | Daily token & action tracking |
| `agent_workflows` | Multi-step workflow definitions |
| `agent_workflow_steps` | Workflow step configurations |
| `agent_sessions` | Chat session tracking |
| `agent_messages` | Conversation message history |
| `agent_memories` | Long-term memory (preferences, facts, patterns) |
| `agent_user_context` | Business context per user |
| `agent_traces` | Detailed execution traces |
| `admin_audit_logs` | Superadmin action logs |

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
