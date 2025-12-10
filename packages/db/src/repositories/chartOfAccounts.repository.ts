/**
 * Chart of Accounts Repository
 *
 * This file re-exports from the split repositories for backward compatibility.
 * The actual implementations are now in:
 * - account.repository.ts - Account CRUD operations
 * - journalEntry.repository.ts - Journal entry operations
 * - accountingReport.repository.ts - Trial balance and reports
 */

// Re-export types from split repositories
export {
  accountRepository,
  type CreateAccountInput,
  type UpdateAccountInput,
  type AccountQueryOptions,
  type AccountTreeNode,
  type AccountRepository,
} from "./account.repository";

export {
  journalEntryRepository,
  type CreateJournalEntryInput,
  type JournalEntryLineInput,
  type JournalEntryQueryOptions,
  type JournalEntryRepository,
} from "./journalEntry.repository";

export {
  accountingReportRepository,
  type AccountingReportRepository,
} from "./accountingReport.repository";

// ============= Backward Compatibility Facade =============

import { accountRepository } from "./account.repository";
import { journalEntryRepository } from "./journalEntry.repository";
import { accountingReportRepository } from "./accountingReport.repository";

/**
 * @deprecated Use accountRepository, journalEntryRepository, or accountingReportRepository directly
 *
 * This combined repository is kept for backward compatibility.
 * New code should import from the specific repositories.
 */
export const chartOfAccountsRepository = {
  // ============= Account Operations =============
  initializeDefaults: accountRepository.initializeDefaults,
  findAccountById: accountRepository.findById,
  findAccountByCode: accountRepository.findByCode,
  findAllAccounts: accountRepository.findAll,
  getAccountTree: accountRepository.getTree,
  createAccount: accountRepository.create,
  updateAccount: accountRepository.update,
  updateChildrenPaths: accountRepository.updateChildrenPaths,
  deleteAccount: accountRepository.delete,

  // ============= Journal Entry Operations =============
  generateEntryNumber: journalEntryRepository.generateEntryNumber,
  createJournalEntry: journalEntryRepository.create,
  findJournalEntryById: journalEntryRepository.findById,
  findAllJournalEntries: journalEntryRepository.findAll,
  postJournalEntry: journalEntryRepository.post,
  reverseJournalEntry: journalEntryRepository.reverse,

  // ============= Balance Operations =============
  updateAccountBalance: journalEntryRepository.updateAccountBalance,
  getAccountBalance: journalEntryRepository.getAccountBalance,
  getTrialBalance: accountingReportRepository.getTrialBalance,
  getAccountSummaryByType: accountingReportRepository.getAccountSummaryByType,
};

export type ChartOfAccountsRepository = typeof chartOfAccountsRepository;
