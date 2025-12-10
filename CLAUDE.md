# Open-Bookkeeping.com

Full-stack open-source bookkeeping and invoicing platform. Monorepo with React frontend, Hono/tRPC backend, PostgreSQL database.

## Tech Stack

| Layer | Stack |
|-------|-------|
| Frontend | React 19, Vite, TypeScript, Tailwind CSS 4, Radix UI |
| Backend | Hono, tRPC 11, Node.js |
| Database | PostgreSQL (Supabase), Drizzle ORM |
| Auth | Supabase Auth |
| State | Jotai (UI state), React Query (server state) |
| Forms | React Hook Form + Zod validation |
| PDF | @react-pdf/renderer |

## Project Structure

- `apps/web` - React frontend (port 5173)
- `apps/api` - tRPC backend (port 3001)
- `packages/db` - Drizzle ORM schemas and migrations
- `packages/shared` - Shared utilities

## Development

```bash
yarn dev          # Run all (web + api)
yarn dev:web      # Frontend only
yarn dev:api      # Backend only
yarn db:generate  # Generate migration from schema changes
yarn db:migrate   # Apply migrations to database (preferred)
yarn db:push      # Sync schema directly (slow, avoid)
yarn db:studio    # Open Drizzle Studio
yarn test:e2e     # Run Playwright tests
yarn check-types  # TypeScript check
yarn build        # Production build
```

**Database Workflow**: Always use `yarn db:generate` then `yarn db:migrate` instead of `yarn db:push`. The push command pulls the entire remote schema which is slow with Supabase. Migrations are faster and more predictable.

## Key Patterns

**tRPC Services**: `apps/api/src/trpc/services/*.ts`
- Each feature has its own router (invoice, customer, quotation, etc.)
- Use `protectedProcedure` for auth-required endpoints
- Zod schemas for input validation

**React Components**: `apps/web/src/components/`
- `ui/` - Base Radix UI components
- `ui/form/` - React Hook Form wrappers
- `pdf/` - PDF templates for documents

**State Management**: `apps/web/src/global/atoms/`
- Jotai atoms for UI state (tab switching, errors)
- React Query for server data caching

**Database**: `packages/db/src/schema/`
- Drizzle ORM with PostgreSQL
- Relations defined with `references()`
- Use transactions for multi-table operations

## Conventions

- All API inputs validated with Zod schemas in `apps/web/src/zod-schemas/`
- Forms use React Hook Form with `zodResolver`
- Currency calculations use `decimal.js` for precision
- PDF templates in `apps/web/src/components/pdf/`
- IndexedDB for offline storage in `apps/web/src/global/indexdb/`

## Environment

Copy `.env.example` to `.env` and configure:
- `VITE_SUPABASE_URL` - Supabase project URL
- `VITE_SUPABASE_ANON_KEY` - Supabase anon key
- `DATABASE_URL` - PostgreSQL connection string
