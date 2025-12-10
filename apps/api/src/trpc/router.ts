import { router, publicProcedure, protectedProcedure } from "./trpc";
import { invoiceRouter } from "./services/invoice";
import { customerRouter } from "./services/customer";
import { vendorRouter } from "./services/vendor";
import { vaultRouter } from "./services/vault";
import { storageRouter } from "./services/storage";
import { blogRouter } from "./services/blog";
import { quotationRouter } from "./services/quotation";
import { creditNoteRouter } from "./services/creditNote";
import { debitNoteRouter } from "./services/debitNote";
import { dashboardRouter } from "./services/dashboard";
import { settingsRouter } from "./services/settings";
import { statementsRouter } from "./services/statements";
import { einvoiceRouter } from "./services/einvoice";
import { billRouter } from "./services/bill";
import { bankFeedRouter } from "./services/bankFeed";
import { chartOfAccountsRouter } from "./services/chartOfAccounts";
import { sstRouter } from "./services/sst";
import { ledgerRouter } from "./services/ledger";
import { apiKeyRouter } from "./services/apiKey";
import { webhookRouter } from "./services/webhook";
import { fixedAssetRouter } from "./services/fixedAsset";
import { agentRouter } from "./services/agent";

export { router, publicProcedure, protectedProcedure };

export const appRouter = router({
  invoice: invoiceRouter,
  customer: customerRouter,
  vendor: vendorRouter,
  vault: vaultRouter,
  storage: storageRouter,
  blog: blogRouter,
  quotation: quotationRouter,
  creditNote: creditNoteRouter,
  debitNote: debitNoteRouter,
  dashboard: dashboardRouter,
  settings: settingsRouter,
  statements: statementsRouter,
  einvoice: einvoiceRouter,
  bill: billRouter,
  bankFeed: bankFeedRouter,
  chartOfAccounts: chartOfAccountsRouter,
  sst: sstRouter,
  ledger: ledgerRouter,
  apiKey: apiKeyRouter,
  webhook: webhookRouter,
  fixedAsset: fixedAssetRouter,
  agent: agentRouter,
});

export type AppRouter = typeof appRouter;
