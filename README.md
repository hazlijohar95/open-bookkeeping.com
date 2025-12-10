<div align="center">

# Open Bookkeeping

**Professional invoicing and bookkeeping for Malaysian businesses**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178c6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19-61dafb?logo=react&logoColor=white)](https://react.dev/)
[![Supabase](https://img.shields.io/badge/Supabase-Powered-3ecf8e?logo=supabase&logoColor=white)](https://supabase.com/)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)

[Live Demo](https://open-bookkeeping.com) &nbsp;|&nbsp; [Documentation](https://open-bookkeeping.com/docs) &nbsp;|&nbsp; [Report Bug](https://github.com/hazlijohar95/open-bookkeeping.com/issues)

</div>

---

## Why Open Bookkeeping?

A **free, self-hostable** invoicing platform built for freelancers and small businesses in Malaysia. No vendor lock-in. No monthly fees. Complete control over your data.

| Benefit | Description |
|---------|-------------|
| **AI-Powered** | Intelligent assistant to automate accounting tasks |
| **Malaysia e-Invoice Ready** | Built-in MyInvois integration for LHDN compliance |
| **Privacy First** | Self-host on your infrastructure. Your data stays yours. |
| **Offline Ready** | Create invoices without internet. Syncs when reconnected. |
| **Beautiful PDFs** | 5 professional templates with custom branding |
| **Public API & SDK** | REST API with TypeScript SDK for integrations |

---

## Features

### AI Agent

An intelligent assistant that can analyze data, create documents, and automate accounting tasks.

| Feature | Description |
|---------|-------------|
| **Chat Interface** | Natural language interaction for accounting tasks |
| **20+ Tools** | Read reports, create invoices, analyze data |
| **Approval Workflow** | Human-in-loop for high-value transactions |
| **Audit Trail** | Full history with AI reasoning logged |
| **Safety Controls** | Emergency stop, daily quotas, amount limits |

```
+------------------+     +------------------+     +------------------+
|    Chat with     | --> |   AI Processes   | --> |  Execute with    |
|   AI Assistant   |     |   Your Request   |     |  Approval Flow   |
+------------------+     +------------------+     +------------------+
```

### Document Management

| Document | Capabilities |
|----------|--------------|
| **Invoices** | Create, track, convert to e-Invoice (Draft, Pending, Paid, Overdue, Cancelled) |
| **Quotations** | Generate quotes, convert to invoices with one click |
| **Credit Notes** | Issue refunds linked to original invoices |
| **Debit Notes** | Add supplementary charges to transactions |
| **Statements** | Customer account statements with date filtering |

### Accounting & Bookkeeping

| Feature | Description |
|---------|-------------|
| **Chart of Accounts** | Full double-entry bookkeeping with customizable accounts |
| **Journal Entries** | Manual and automated journal entries |
| **Fixed Assets** | Asset register with depreciation tracking |
| **Trial Balance** | Real-time trial balance reports |
| **Profit & Loss** | Income statement with date range filtering |
| **Balance Sheet** | Assets, liabilities, and equity reports |
| **SST Management** | Sales and Service Tax tracking for Malaysia |

### Business Operations

| Feature | Description |
|---------|-------------|
| **Customer Management** | Contact info, addresses, invoice history |
| **Vendor Management** | Track vendor details and bills |
| **Document Vault** | Store contracts, receipts, attachments |
| **Bank Feeds** | Import and categorize bank transactions |
| **Dashboard** | Revenue overview, pending payments, activity |

### Developer Portal

| Feature | Description |
|---------|-------------|
| **REST API** | Full CRUD for invoices, customers, bills, and more |
| **API Keys** | Generate and manage API keys for integrations |
| **Webhooks** | Real-time event notifications to your endpoints |
| **TypeScript SDK** | First-class SDK with full type support |
| **Swagger Docs** | Interactive API documentation at `/api/docs` |

### PDF Templates

Five professionally designed templates:

- **Default** - Clean, modern layout
- **Cynco** - Bold, corporate style
- **Classic** - Traditional business format
- **Executive** - Premium, elegant design
- **Zen** - Minimalist, contemporary

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | React 19, Vite, TypeScript, Tailwind CSS 4 |
| **Components** | Radix UI, Phosphor Icons, Recharts |
| **State** | Jotai (UI), React Query (server) |
| **Forms** | React Hook Form + Zod validation |
| **PDF** | @react-pdf/renderer |
| **Backend** | Hono, tRPC 11, Node.js |
| **AI** | AI SDK with tool calling |
| **Database** | PostgreSQL, Drizzle ORM |
| **Auth** | Supabase Auth + API Keys |
| **Queue** | BullMQ with Redis/Upstash |

---

## Quick Start

### Prerequisites

- **Node.js 20+** ([download](https://nodejs.org/))
- **Yarn** (via Corepack)
- **PostgreSQL** or [Supabase](https://supabase.com) account

### Installation

```bash
# Clone the repository
git clone https://github.com/hazlijohar95/open-bookkeeping.com.git
cd open-bookkeeping.com

# Enable Corepack and install dependencies
corepack enable
yarn install
```

### Configuration

```bash
# Copy environment template
cp .env.example .env
```

Edit `.env` with your credentials:

```env
# Supabase (from your project dashboard)
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key

# Database
DATABASE_URL=postgresql://user:password@host:5432/database

# API
VITE_API_URL=http://localhost:3001

# AI (for agent features - choose one)
OPENAI_API_KEY=sk-xxx
# or
ANTHROPIC_API_KEY=sk-ant-xxx
```

### Database Setup

```bash
# Generate and run migrations (recommended)
yarn db:generate
yarn db:migrate

# Or push schema directly (slower)
yarn db:push
```

### Start Development

```bash
# Start frontend + backend
yarn dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## Project Structure

```
open-bookkeeping/
├── apps/
│   ├── web/                    # React frontend (port 5173)
│   │   ├── src/
│   │   │   ├── components/
│   │   │   │   ├── agent/      # AI Agent components
│   │   │   │   ├── ui/         # Base components
│   │   │   │   └── pdf/        # PDF templates
│   │   │   ├── routes/         # Page components
│   │   │   ├── api/            # React Query hooks
│   │   │   ├── global/         # Jotai atoms, IndexedDB
│   │   │   └── zod-schemas/    # Form validation
│   │   └── package.json
│   │
│   └── api/                    # Hono + tRPC backend (port 3001)
│       ├── src/
│       │   ├── routes/
│       │   │   ├── ai.ts       # AI chat endpoint
│       │   │   └── v1/         # Public REST API
│       │   ├── trpc/
│       │   │   └── services/   # tRPC procedures
│       │   ├── services/       # Business logic
│       │   └── workers/        # Background jobs
│       └── package.json
│
├── packages/
│   ├── db/                     # Drizzle ORM
│   │   └── src/
│   │       ├── schema/         # Table definitions
│   │       └── repositories/   # Data access
│   │
│   ├── sdk/                    # TypeScript SDK
│   │   └── src/
│   │       ├── client.ts       # API client
│   │       └── webhooks.ts     # Webhook utilities
│   │
│   └── shared/                 # Shared utilities
│
└── supabase/                   # Supabase config
```

---

## API & SDK

### Public REST API

Base URL: `/api/v1`
Auth: API Key (`Authorization: Bearer ob_live_xxx`)
Docs: `/api/docs` (Swagger UI)

| Endpoint | Methods | Description |
|----------|---------|-------------|
| `/invoices` | GET, POST, PATCH, DELETE | Invoice management |
| `/customers` | GET, POST, PATCH, DELETE | Customer management |
| `/vendors` | GET, POST, PATCH, DELETE | Vendor management |
| `/quotations` | GET, POST, PATCH, DELETE | Quotation management |
| `/bills` | GET, POST, PATCH, DELETE | Bill management |
| `/accounts` | GET | Chart of accounts |
| `/webhooks` | GET, POST, DELETE | Webhook management |

### TypeScript SDK

```bash
npm install @open-bookkeeping/sdk
```

```typescript
import { OpenBookkeeping } from '@open-bookkeeping/sdk';

const client = new OpenBookkeeping({
  apiKey: 'ob_live_xxxxx',
});

// List invoices
const { data } = await client.invoices.list({ status: 'unpaid' });

// Create customer
const customer = await client.customers.create({
  name: 'Acme Corp',
  email: 'billing@acme.com',
});

// Webhook verification
import { constructWebhookEvent } from '@open-bookkeeping/sdk/webhooks';
const event = await constructWebhookEvent(payload, sig, ts, secret);
```

### Webhook Events

```
invoice.created   invoice.updated   invoice.sent   invoice.paid
customer.created  customer.updated  customer.deleted
vendor.created    vendor.updated    vendor.deleted
quotation.created quotation.updated quotation.accepted
bill.created      bill.updated      bill.paid
```

---

## Commands

### Development

| Command | Description |
|---------|-------------|
| `yarn dev` | Start all services |
| `yarn dev:web` | Frontend only (localhost:5173) |
| `yarn dev:api` | Backend only (localhost:3001) |

### Database

| Command | Description |
|---------|-------------|
| `yarn db:generate` | Generate migration files |
| `yarn db:migrate` | Run pending migrations |
| `yarn db:push` | Push schema directly |
| `yarn db:studio` | Open Drizzle Studio |

### Quality

| Command | Description |
|---------|-------------|
| `yarn check-types` | TypeScript type checking |
| `yarn lint` | Run ESLint |
| `yarn format` | Format with Prettier |
| `yarn test:e2e` | Playwright tests |

### Build

| Command | Description |
|---------|-------------|
| `yarn build` | Production build |

---

## Deployment

### Netlify (Frontend) + Railway (Backend)

**Frontend:**
1. Import repository on [Netlify](https://netlify.com)
2. Base directory: `apps/web`
3. Build command: `yarn build`
4. Publish directory: `apps/web/dist`

**Backend:**
1. Create web service on [Railway](https://railway.app)
2. Start command: `node apps/api/dist/index.js`
3. Add environment variables

### Self-Hosted

```bash
# Build production
yarn build

# Start API
node apps/api/dist/index.js

# Serve frontend with any static server
npx serve apps/web/dist -l 3000
```

---

## Malaysia e-Invoice (MyInvois)

Open Bookkeeping includes built-in support for Malaysia's e-Invoice system:

```env
# MyInvois Gateway Configuration
MYINVOIS_GATEWAY_URL=http://localhost:3002
MYINVOIS_ENVIRONMENT=SANDBOX  # or PROD
MYINVOIS_CLIENT_ID=your-client-id
MYINVOIS_CLIENT_SECRET=your-client-secret
```

Features:
- Generate LHDN-compliant e-Invoices
- Digital signature support
- Sandbox and production environments
- Automatic submission and validation

---

## Contributing

We welcome contributions! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

```bash
# Fork, clone, and create a branch
git checkout -b feature/your-feature

# Make changes and commit
git commit -m "feat: add your feature"

# Push and open a PR
git push origin feature/your-feature
```

---

## Security

Found a vulnerability? Please email security concerns privately. Do not open public issues for security matters.

See [SECURITY.md](SECURITY.md) for our security policy.

---

## License

MIT License - see [LICENSE](LICENSE) for details.

---

## Acknowledgments

Built with these excellent open source projects:

[React](https://react.dev/) | [Supabase](https://supabase.com/) | [tRPC](https://trpc.io/) | [Drizzle](https://orm.drizzle.team/) | [Hono](https://hono.dev/) | [Tailwind CSS](https://tailwindcss.com/) | [Radix UI](https://www.radix-ui.com/) | [AI SDK](https://sdk.vercel.ai/)

---

<div align="center">

**[Website](https://open-bookkeeping.com)** | **[Documentation](https://open-bookkeeping.com/docs)** | **[GitHub](https://github.com/hazlijohar95/open-bookkeeping.com)**

Made with care for the Malaysian business community

</div>
