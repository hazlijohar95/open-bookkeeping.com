import { lazy, Suspense } from "react";
import { createBrowserRouter } from "react-router-dom";
import { RootLayout } from "./routes/_layout";
import { DashboardLayout } from "./routes/_dashboard-layout";
import { PublicSidebarLayout } from "./routes/_public-sidebar-layout";
import { ErrorBoundary } from "./routes/error-boundary";

// Lazy load all route components for better performance
const Home = lazy(() => import("./routes/home").then((m) => ({ default: m.Home })));
const Dashboard = lazy(() => import("./routes/dashboard").then((m) => ({ default: m.Dashboard })));
const Invoices = lazy(() => import("./routes/invoices").then((m) => ({ default: m.Invoices })));
const Quotations = lazy(() => import("./routes/quotations").then((m) => ({ default: m.Quotations })));
const CreditNotes = lazy(() => import("./routes/credit-notes").then((m) => ({ default: m.CreditNotes })));
const DebitNotes = lazy(() => import("./routes/debit-notes").then((m) => ({ default: m.DebitNotes })));
const Customers = lazy(() => import("./routes/customers").then((m) => ({ default: m.Customers })));
const Vendors = lazy(() => import("./routes/vendors").then((m) => ({ default: m.Vendors })));
const Bills = lazy(() => import("./routes/bills").then((m) => ({ default: m.Bills })));
const BankFeeds = lazy(() => import("./routes/bank-feeds").then((m) => ({ default: m.BankFeeds })));
const ChartOfAccounts = lazy(() => import("./routes/chart-of-accounts").then((m) => ({ default: m.ChartOfAccounts })));
const JournalEntries = lazy(() => import("./routes/journal-entries").then((m) => ({ default: m.JournalEntries })));
const TrialBalance = lazy(() => import("./routes/trial-balance").then((m) => ({ default: m.TrialBalance })));
const ProfitLoss = lazy(() => import("./routes/profit-loss").then((m) => ({ default: m.ProfitLoss })));
const BalanceSheet = lazy(() => import("./routes/balance-sheet").then((m) => ({ default: m.BalanceSheet })));
const SST = lazy(() => import("./routes/sst").then((m) => ({ default: m.SST })));
const Vault = lazy(() => import("./routes/vault").then((m) => ({ default: m.Vault })));
const Assets = lazy(() => import("./routes/assets").then((m) => ({ default: m.Assets })));
const Settings = lazy(() => import("./routes/settings").then((m) => ({ default: m.Settings })));
const Statements = lazy(() => import("./routes/statements").then((m) => ({ default: m.Statements })));
const CreateInvoicePage = lazy(() => import("./routes/create-invoice").then((m) => ({ default: m.CreateInvoicePage })));
const CreateQuotationPage = lazy(() => import("./routes/create-quotation").then((m) => ({ default: m.CreateQuotationPage })));
const CreateCreditNotePage = lazy(() => import("./routes/create-credit-note").then((m) => ({ default: m.CreateCreditNotePage })));
const CreateDebitNotePage = lazy(() => import("./routes/create-debit-note").then((m) => ({ default: m.CreateDebitNotePage })));
const EditInvoice = lazy(() => import("./routes/edit-invoice").then((m) => ({ default: m.EditInvoice })));
const EditQuotation = lazy(() => import("./routes/edit-quotation").then((m) => ({ default: m.EditQuotationPage })));
const EditCreditNote = lazy(() => import("./routes/edit-credit-note").then((m) => ({ default: m.EditCreditNotePage })));
const EditDebitNote = lazy(() => import("./routes/edit-debit-note").then((m) => ({ default: m.EditDebitNotePage })));
const Blogs = lazy(() => import("./routes/blogs").then((m) => ({ default: m.Blogs })));
const BlogPost = lazy(() => import("./routes/blog-post").then((m) => ({ default: m.BlogPost })));
const Privacy = lazy(() => import("./routes/privacy").then((m) => ({ default: m.Privacy })));
const Terms = lazy(() => import("./routes/terms").then((m) => ({ default: m.Terms })));
const NotFound = lazy(() => import("./routes/not-found").then((m) => ({ default: m.NotFound })));
const AuthCallback = lazy(() => import("./routes/auth-callback").then((m) => ({ default: m.AuthCallback })));
const Login = lazy(() => import("./routes/login").then((m) => ({ default: m.Login })));
const Developer = lazy(() => import("./routes/developer").then((m) => ({ default: m.Developer })));
const FixedAssets = lazy(() => import("./routes/fixed-assets").then((m) => ({ default: m.FixedAssets })));
const Agent = lazy(() => import("./routes/agent").then((m) => ({ default: m.Agent })));
const Employees = lazy(() => import("./routes/employees").then((m) => ({ default: m.Employees })));
const PayrollRuns = lazy(() => import("./routes/payroll").then((m) => ({ default: m.PayrollRuns })));
const PayrollRunDetail = lazy(() => import("./routes/payroll-run").then((m) => ({ default: m.PayrollRunDetail })));
const SetupWizard = lazy(() => import("./routes/setup-wizard").then((m) => ({ default: m.SetupWizard })));
const Onboarding = lazy(() => import("./routes/onboarding"));

// Page skeleton for route transitions - shows structure immediately
function RouteLoader() {
  return (
    <div className="p-6 space-y-6 animate-pulse">
      {/* Header skeleton */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-7 w-48 bg-muted rounded" />
          <div className="h-4 w-64 bg-muted/60 rounded" />
        </div>
        <div className="h-9 w-28 bg-muted rounded" />
      </div>
      {/* Content skeleton */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-24 bg-muted/40 rounded-lg border" />
        ))}
      </div>
      <div className="h-64 bg-muted/30 rounded-lg border" />
    </div>
  );
}

// Wrap lazy components with Suspense
function LazyRoute({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<RouteLoader />}>{children}</Suspense>;
}

export const router = createBrowserRouter([
  {
    path: "/",
    element: <RootLayout />,
    errorElement: <ErrorBoundary />,
    children: [
      // Public routes (no sidebar)
      { index: true, element: <LazyRoute><Home /></LazyRoute> },
      { path: "login", element: <LazyRoute><Login /></LazyRoute> },
      { path: "blogs", element: <LazyRoute><Blogs /></LazyRoute> },
      { path: "blog/:slug", element: <LazyRoute><BlogPost /></LazyRoute> },
      { path: "privacy", element: <LazyRoute><Privacy /></LazyRoute> },
      { path: "terms", element: <LazyRoute><Terms /></LazyRoute> },
      { path: "auth/callback", element: <LazyRoute><AuthCallback /></LazyRoute> },
      { path: "onboarding", element: <LazyRoute><Onboarding /></LazyRoute> },

      // Public routes with sidebar (no auth required)
      {
        element: <PublicSidebarLayout />,
        errorElement: <ErrorBoundary />,
        children: [
          { path: "create/invoice", element: <LazyRoute><CreateInvoicePage /></LazyRoute> },
          { path: "create/quotation", element: <LazyRoute><CreateQuotationPage /></LazyRoute> },
          { path: "create/credit-note", element: <LazyRoute><CreateCreditNotePage /></LazyRoute> },
          { path: "create/debit-note", element: <LazyRoute><CreateDebitNotePage /></LazyRoute> },
        ],
      },

      // Dashboard routes (protected, requires auth)
      {
        element: <DashboardLayout />,
        errorElement: <ErrorBoundary />,
        children: [
          { path: "dashboard", element: <LazyRoute><Dashboard /></LazyRoute> },
          { path: "invoices", element: <LazyRoute><Invoices /></LazyRoute> },
          { path: "quotations", element: <LazyRoute><Quotations /></LazyRoute> },
          { path: "credit-notes", element: <LazyRoute><CreditNotes /></LazyRoute> },
          { path: "debit-notes", element: <LazyRoute><DebitNotes /></LazyRoute> },
          { path: "customers", element: <LazyRoute><Customers /></LazyRoute> },
          { path: "vendors", element: <LazyRoute><Vendors /></LazyRoute> },
          { path: "bills", element: <LazyRoute><Bills /></LazyRoute> },
          { path: "bank-feeds", element: <LazyRoute><BankFeeds /></LazyRoute> },
          { path: "chart-of-accounts", element: <LazyRoute><ChartOfAccounts /></LazyRoute> },
          { path: "journal-entries", element: <LazyRoute><JournalEntries /></LazyRoute> },
          { path: "trial-balance", element: <LazyRoute><TrialBalance /></LazyRoute> },
          { path: "profit-loss", element: <LazyRoute><ProfitLoss /></LazyRoute> },
          { path: "balance-sheet", element: <LazyRoute><BalanceSheet /></LazyRoute> },
          { path: "sst", element: <LazyRoute><SST /></LazyRoute> },
          { path: "vault", element: <LazyRoute><Vault /></LazyRoute> },
          { path: "assets", element: <LazyRoute><Assets /></LazyRoute> },
          { path: "fixed-assets", element: <LazyRoute><FixedAssets /></LazyRoute> },
          { path: "settings", element: <LazyRoute><Settings /></LazyRoute> },
          { path: "statements", element: <LazyRoute><Statements /></LazyRoute> },
          { path: "developer", element: <LazyRoute><Developer /></LazyRoute> },
          { path: "developer/api-keys", element: <LazyRoute><Developer /></LazyRoute> },
          { path: "developer/webhooks", element: <LazyRoute><Developer /></LazyRoute> },
          { path: "agent", element: <LazyRoute><Agent /></LazyRoute> },
          { path: "employees", element: <LazyRoute><Employees /></LazyRoute> },
          { path: "payroll", element: <LazyRoute><PayrollRuns /></LazyRoute> },
          { path: "payroll/:id", element: <LazyRoute><PayrollRunDetail /></LazyRoute> },
          { path: "setup", element: <LazyRoute><SetupWizard /></LazyRoute> },
          { path: "edit/invoice/:type/:id", element: <LazyRoute><EditInvoice /></LazyRoute> },
          { path: "edit/quotation/:type/:id", element: <LazyRoute><EditQuotation /></LazyRoute> },
          { path: "edit/credit-note/:type/:id", element: <LazyRoute><EditCreditNote /></LazyRoute> },
          { path: "edit/debit-note/:type/:id", element: <LazyRoute><EditDebitNote /></LazyRoute> },
          { path: "edit/:type/:id", element: <LazyRoute><EditInvoice /></LazyRoute> },
        ],
      },

      // Catch-all
      { path: "*", element: <LazyRoute><NotFound /></LazyRoute> },
    ],
  },
]);
