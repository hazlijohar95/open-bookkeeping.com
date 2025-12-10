# Changelog

All notable changes to Open Bookkeeping are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Added

- Open-source release under MIT License
- Comprehensive documentation suite (README, CONTRIBUTING, SECURITY, CHANGELOG)
- GitHub issue and pull request templates
- Code of Conduct for community guidelines

### Changed

- Renamed project from Invoicely to Open Bookkeeping
- Updated all package namespaces to `@open-bookkeeping/*`
- Improved project structure documentation

### Migration Guide

No migration required. This release introduces documentation and branding changes only.

---

## [1.0.0] - 2024-12-01

**Initial public release of Open Bookkeeping.**

This release marks the first stable version of the platform, featuring a complete invoicing solution for freelancers and small businesses.

### Highlights

- Full invoice lifecycle management with PDF generation
- Multi-currency support with 150+ currencies
- Offline-first architecture with cloud sync
- Three professional PDF templates

---

### Added

#### Invoice Management

| Feature | Description |
|---------|-------------|
| Create & Edit | Full invoice creation with line items, taxes, and discounts |
| PDF Export | Generate professional PDFs with customizable templates |
| PNG Export | Export invoices as images for quick sharing |
| Multi-currency | 150+ currencies with automatic symbol detection |
| Status Tracking | Draft, Pending, Paid, Overdue, and Cancelled statuses |
| Payment Terms | Configurable due date calculations |

#### Quotation Management

| Feature | Description |
|---------|-------------|
| Full Lifecycle | Create, edit, and track quotations |
| Convert to Invoice | One-click conversion to invoice |
| Validity Periods | Set expiration dates for quotes |
| PDF/PNG Export | Same export options as invoices |

#### Credit Notes

| Feature | Description |
|---------|-------------|
| Issue Credits | Create credit notes against existing invoices |
| Reason Tracking | Document why credit was issued |
| PDF Generation | Full template support |

#### Debit Notes

| Feature | Description |
|---------|-------------|
| Additional Charges | Issue debit notes for supplementary charges |
| Invoice Linking | Connect to original transactions |
| PDF Generation | Consistent template support |

#### Customer & Vendor Management

| Feature | Description |
|---------|-------------|
| Contact Database | Store customer and vendor details |
| Address Book | Multiple addresses per contact |
| Transaction History | View all invoices per customer/vendor |

#### Company Settings

| Feature | Description |
|---------|-------------|
| Profile Setup | Company name, address, and contact info |
| Logo Upload | Base64-encoded logo storage |
| Default Settings | Pre-fill invoice defaults |
| Tax Configuration | Define tax rates and rules |

#### Dashboard

| Feature | Description |
|---------|-------------|
| Overview | Quick stats on revenue and outstanding amounts |
| Recent Activity | Latest invoices and quotations |
| Quick Actions | Fast access to common tasks |

#### Document Vault

| Feature | Description |
|---------|-------------|
| File Storage | Upload and organize related documents |
| Tagging | Categorize documents with tags |
| Quick Search | Find documents by name or tag |

#### Statements

| Feature | Description |
|---------|-------------|
| Customer Statements | Generate account statements |
| Date Filtering | Filter by date range |
| PDF Export | Professional statement PDFs |

---

### Technical Features

#### Offline-First Architecture

```
Browser IndexedDB  <-->  React App  <-->  Supabase Cloud
       |                    |                    |
  Local Storage        Real-time            PostgreSQL
                         Sync
```

- **IndexedDB Storage**: All data cached locally for offline access
- **Background Sync**: Changes sync automatically when online
- **Conflict Resolution**: Last-write-wins with timestamp tracking

#### Real-time Sync

- Supabase real-time subscriptions for instant updates
- Multi-device synchronization
- Optimistic UI updates with rollback on failure

#### Type-Safe API

- End-to-end TypeScript with tRPC
- Zod validation for all API inputs
- Inferred types from database schema

#### PDF Generation

- Client-side rendering with @react-pdf/renderer
- Three template designs: Default, Cynco, Classic
- Custom font support: Inter, Outfit, Manrope
- Multi-page support for long invoices

#### Authentication

- Supabase Auth integration
- Email/password authentication
- Secure session management
- Row-level security in PostgreSQL

---

### Tech Stack

| Layer | Technology | Version |
|-------|------------|---------|
| Frontend | React | 19.x |
| Build Tool | Vite | 6.x |
| Language | TypeScript | 5.8 |
| Styling | Tailwind CSS | 4.x |
| Components | Radix UI | Latest |
| UI State | Jotai | 2.x |
| Server State | React Query | 5.x |
| Forms | React Hook Form | 7.x |
| Validation | Zod | 3.x |
| PDF | @react-pdf/renderer | 4.x |
| Backend | Hono | 4.x |
| API | tRPC | 11.x |
| Database | PostgreSQL | 14+ |
| ORM | Drizzle | 0.36.x |
| Auth | Supabase Auth | Latest |

---

### Known Issues

- PDF generation may be slow on older mobile devices
- Large invoices (500+ items) may cause memory pressure in the browser
- Safari requires fonts to be preloaded for PDF rendering

### Workarounds

| Issue | Workaround |
|-------|------------|
| Slow PDF on mobile | Generate PDFs on desktop when possible |
| Large invoices | Split into multiple invoices if needed |
| Safari fonts | Ensure stable internet for first PDF generation |

---

## Version History

| Version | Date | Type | Notes |
|---------|------|------|-------|
| 1.0.0 | 2024-12-01 | Major | Initial public release |

---

## Upgrade Guides

### Upgrading to 1.0.0

This is the initial release. No upgrade path required.

### Future Upgrades

When upgrading between versions:

1. **Read the changelog** for breaking changes
2. **Backup your database** before upgrading
3. **Run migrations** using `yarn db:migrate`
4. **Test in staging** before production deployment

---

## Links

- [Unreleased]: https://github.com/open-bookkeeping/open-bookkeeping/compare/v1.0.0...HEAD
- [1.0.0]: https://github.com/open-bookkeeping/open-bookkeeping/releases/tag/v1.0.0

---

<div align="center">

For detailed release notes and migration guides, visit the [GitHub Releases](https://github.com/open-bookkeeping/open-bookkeeping/releases) page.

</div>
