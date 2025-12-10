import { z } from "zod";

// Enum schemas
export const accountTypeSchema = z.enum([
  "asset",
  "liability",
  "equity",
  "revenue",
  "expense",
]);

export const normalBalanceSchema = z.enum(["debit", "credit"]);

export const journalEntryStatusSchema = z.enum(["draft", "posted", "reversed"]);

export const sourceDocumentTypeSchema = z.enum([
  "invoice",
  "bill",
  "bank_transaction",
  "manual",
  "credit_note",
  "debit_note",
]);

export const sstTaxCodeSchema = z.enum([
  "sr",
  "zrl",
  "es",
  "os",
  "rs",
  "gs",
  "none",
]);

// Account schemas
export const createAccountSchema = z.object({
  code: z
    .string()
    .min(1, "Account code is required")
    .max(20, "Account code must be at most 20 characters")
    .regex(/^[A-Za-z0-9]+$/, "Account code must be alphanumeric"),
  name: z
    .string()
    .min(1, "Account name is required")
    .max(100, "Account name must be at most 100 characters"),
  description: z.string().max(500).optional(),
  accountType: accountTypeSchema,
  normalBalance: normalBalanceSchema,
  parentId: z.string().uuid().optional().nullable(),
  sstTaxCode: sstTaxCodeSchema.optional(),
  isHeader: z.boolean().default(false),
  openingBalance: z.string().optional(),
  openingBalanceDate: z.string().optional(),
});

export const updateAccountSchema = z.object({
  id: z.string().uuid(),
  code: z
    .string()
    .min(1)
    .max(20)
    .regex(/^[A-Za-z0-9]+$/)
    .optional(),
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional().nullable(),
  parentId: z.string().uuid().optional().nullable(),
  sstTaxCode: sstTaxCodeSchema.optional().nullable(),
  isActive: z.boolean().optional(),
  isHeader: z.boolean().optional(),
  openingBalance: z.string().optional().nullable(),
  openingBalanceDate: z.string().optional().nullable(),
});

// Journal entry line schema
export const journalEntryLineSchema = z
  .object({
    accountId: z.string().uuid("Please select an account"),
    debitAmount: z.string().optional(),
    creditAmount: z.string().optional(),
    sstTaxCode: sstTaxCodeSchema.optional(),
    taxAmount: z.string().optional(),
    description: z.string().optional(),
  })
  .refine(
    (data) => {
      const hasDebit =
        data.debitAmount && parseFloat(data.debitAmount) > 0;
      const hasCredit =
        data.creditAmount && parseFloat(data.creditAmount) > 0;
      return hasDebit || hasCredit;
    },
    {
      message: "Each line must have either a debit or credit amount",
    }
  )
  .refine(
    (data) => {
      const debit = parseFloat(data.debitAmount || "0");
      const credit = parseFloat(data.creditAmount || "0");
      // Can't have both non-zero
      return !(debit > 0 && credit > 0);
    },
    {
      message: "A line cannot have both debit and credit amounts",
    }
  );

// Journal entry schema
export const createJournalEntrySchema = z
  .object({
    entryDate: z.string().min(1, "Entry date is required"),
    description: z.string().min(1, "Description is required").max(500),
    reference: z.string().max(100).optional(),
    lines: z
      .array(
        z.object({
          accountId: z.string().uuid("Please select an account"),
          debitAmount: z.string().optional(),
          creditAmount: z.string().optional(),
          sstTaxCode: sstTaxCodeSchema.optional(),
          taxAmount: z.string().optional(),
          description: z.string().optional(),
        })
      )
      .min(2, "Journal entry must have at least 2 lines"),
  })
  .refine(
    (data) => {
      let totalDebit = 0;
      let totalCredit = 0;

      for (const line of data.lines) {
        totalDebit += parseFloat(line.debitAmount || "0");
        totalCredit += parseFloat(line.creditAmount || "0");
      }

      return Math.abs(totalDebit - totalCredit) < 0.01;
    },
    {
      message: "Total debits must equal total credits",
      path: ["lines"],
    }
  );

// Reversal schema
export const reverseJournalEntrySchema = z.object({
  id: z.string().uuid(),
  reversalDate: z.string().min(1, "Reversal date is required"),
});

// Infer types
export type AccountType = z.infer<typeof accountTypeSchema>;
export type NormalBalance = z.infer<typeof normalBalanceSchema>;
export type JournalEntryStatus = z.infer<typeof journalEntryStatusSchema>;
export type SourceDocumentType = z.infer<typeof sourceDocumentTypeSchema>;
export type SstTaxCode = z.infer<typeof sstTaxCodeSchema>;
export type CreateAccountSchema = z.infer<typeof createAccountSchema>;
export type UpdateAccountSchema = z.infer<typeof updateAccountSchema>;
export type JournalEntryLineSchema = z.infer<typeof journalEntryLineSchema>;
export type CreateJournalEntrySchema = z.infer<typeof createJournalEntrySchema>;
export type ReverseJournalEntrySchema = z.infer<typeof reverseJournalEntrySchema>;

// Display helpers
export const accountTypeLabels: Record<AccountType, string> = {
  asset: "Asset",
  liability: "Liability",
  equity: "Equity",
  revenue: "Revenue",
  expense: "Expense",
};

export const normalBalanceLabels: Record<NormalBalance, string> = {
  debit: "Debit",
  credit: "Credit",
};

export const sstTaxCodeLabels: Record<SstTaxCode, string> = {
  sr: "SR (Standard Rate 6%)",
  zrl: "ZRL (Zero-Rated Local)",
  es: "ES (Exempt Supply)",
  os: "OS (Out of Scope)",
  rs: "RS (Relief Supply)",
  gs: "GS (Goods Suspended)",
  none: "None",
};

export const journalEntryStatusLabels: Record<JournalEntryStatus, string> = {
  draft: "Draft",
  posted: "Posted",
  reversed: "Reversed",
};

// Helper to get default normal balance for account type
export function getDefaultNormalBalance(type: AccountType): NormalBalance {
  switch (type) {
    case "asset":
    case "expense":
      return "debit";
    case "liability":
    case "equity":
    case "revenue":
      return "credit";
  }
}

// Account type colors for UI
export const accountTypeColors: Record<AccountType, string> = {
  asset: "text-success bg-success/10 border-success/30",
  liability: "text-destructive bg-destructive/10 border-destructive/30",
  equity: "text-info bg-info/10 border-info/30",
  revenue: "text-primary bg-primary/10 border-primary/30",
  expense: "text-warning-foreground dark:text-warning bg-warning/10 border-warning/30",
};
