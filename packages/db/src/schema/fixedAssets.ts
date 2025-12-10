import {
  pgTable,
  uuid,
  text,
  timestamp,
  numeric,
  index,
  integer,
  varchar,
  date,
  unique,
  jsonb,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { users } from "./users";
import { vendors } from "./vendors";
import { accounts, journalEntries } from "./chartOfAccounts";
import {
  depreciationMethodEnum,
  acquisitionMethodEnum,
  fixedAssetStatusEnum,
  disposalMethodEnum,
  depreciationScheduleStatusEnum,
} from "./enums";

// Re-export enums for convenience
export {
  depreciationMethodEnum,
  acquisitionMethodEnum,
  fixedAssetStatusEnum,
  disposalMethodEnum,
  depreciationScheduleStatusEnum,
};

// Fixed Asset Categories - classification with defaults
export const fixedAssetCategories = pgTable(
  "fixed_asset_categories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),

    // Category identification
    code: varchar("code", { length: 20 }).notNull(),
    name: varchar("name", { length: 100 }).notNull(),
    description: text("description"),

    // Default depreciation settings
    defaultUsefulLifeMonths: integer("default_useful_life_months"),
    defaultDepreciationMethod: depreciationMethodEnum("default_depreciation_method"),

    // Default account links
    defaultAssetAccountId: uuid("default_asset_account_id").references(() => accounts.id, {
      onDelete: "set null",
    }),
    defaultDepreciationExpenseAccountId: uuid("default_depreciation_expense_account_id").references(
      () => accounts.id,
      { onDelete: "set null" }
    ),
    defaultAccumulatedDepreciationAccountId: uuid(
      "default_accumulated_depreciation_account_id"
    ).references(() => accounts.id, { onDelete: "set null" }),

    // Timestamps
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    deletedAt: timestamp("deleted_at"),
  },
  (table) => [
    index("fixed_asset_categories_user_id_idx").on(table.userId),
    unique("fixed_asset_categories_user_code_unique").on(table.userId, table.code),
  ]
);

// Fixed Assets - the main asset register
export const fixedAssets = pgTable(
  "fixed_assets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),

    // Asset identification
    assetCode: varchar("asset_code", { length: 30 }).notNull(), // FA-2024-00001
    name: varchar("name", { length: 200 }).notNull(),
    description: text("description"),
    categoryId: uuid("category_id").references(() => fixedAssetCategories.id, {
      onDelete: "set null",
    }),

    // Acquisition details
    acquisitionDate: date("acquisition_date").notNull(),
    acquisitionCost: numeric("acquisition_cost", { precision: 15, scale: 2 }).notNull(),
    acquisitionMethod: acquisitionMethodEnum("acquisition_method").default("purchase").notNull(),
    vendorId: uuid("vendor_id").references(() => vendors.id, { onDelete: "set null" }),
    invoiceReference: varchar("invoice_reference", { length: 100 }),

    // Depreciation settings
    depreciationMethod: depreciationMethodEnum("depreciation_method")
      .default("straight_line")
      .notNull(),
    usefulLifeMonths: integer("useful_life_months").notNull(), // e.g., 60 for 5 years
    salvageValue: numeric("salvage_value", { precision: 15, scale: 2 }).default("0").notNull(),
    depreciationStartDate: date("depreciation_start_date").notNull(),

    // Current state (denormalized for performance)
    accumulatedDepreciation: numeric("accumulated_depreciation", { precision: 15, scale: 2 })
      .default("0")
      .notNull(),
    netBookValue: numeric("net_book_value", { precision: 15, scale: 2 }).notNull(), // Cost - Accumulated
    lastDepreciationDate: date("last_depreciation_date"),

    // Account links (for double-entry bookkeeping)
    assetAccountId: uuid("asset_account_id")
      .references(() => accounts.id, { onDelete: "restrict" })
      .notNull(),
    depreciationExpenseAccountId: uuid("depreciation_expense_account_id")
      .references(() => accounts.id, { onDelete: "restrict" })
      .notNull(),
    accumulatedDepreciationAccountId: uuid("accumulated_depreciation_account_id")
      .references(() => accounts.id, { onDelete: "restrict" })
      .notNull(),

    // Status
    status: fixedAssetStatusEnum("status").default("draft").notNull(),

    // Physical information
    location: varchar("location", { length: 200 }),
    serialNumber: varchar("serial_number", { length: 100 }),
    warrantyExpiry: date("warranty_expiry"),

    // Flexible metadata
    metadata: jsonb("metadata").$type<Record<string, string>>(),

    // Timestamps
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    deletedAt: timestamp("deleted_at"),
  },
  (table) => [
    index("fixed_assets_user_id_idx").on(table.userId),
    index("fixed_assets_category_id_idx").on(table.categoryId),
    index("fixed_assets_status_idx").on(table.status),
    index("fixed_assets_acquisition_date_idx").on(table.acquisitionDate),
    index("fixed_assets_vendor_id_idx").on(table.vendorId),
    // Composite indexes for common query patterns
    index("fixed_assets_user_status_idx").on(table.userId, table.status),
    index("fixed_assets_user_deleted_idx").on(table.userId, table.deletedAt),
    unique("fixed_assets_user_code_unique").on(table.userId, table.assetCode),
  ]
);

// Fixed Asset Depreciations - annual depreciation schedule
export const fixedAssetDepreciations = pgTable(
  "fixed_asset_depreciations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    fixedAssetId: uuid("fixed_asset_id")
      .references(() => fixedAssets.id, { onDelete: "cascade" })
      .notNull(),

    // Depreciation period (annual)
    year: integer("year").notNull(),
    periodStart: date("period_start").notNull(),
    periodEnd: date("period_end").notNull(),

    // Amounts
    depreciationAmount: numeric("depreciation_amount", { precision: 15, scale: 2 }).notNull(),
    accumulatedDepreciation: numeric("accumulated_depreciation", { precision: 15, scale: 2 }).notNull(),
    netBookValue: numeric("net_book_value", { precision: 15, scale: 2 }).notNull(),

    // Journal entry link (when posted)
    journalEntryId: uuid("journal_entry_id").references(() => journalEntries.id, {
      onDelete: "set null",
    }),

    // Status
    status: depreciationScheduleStatusEnum("status").default("scheduled").notNull(),

    // Notes
    notes: text("notes"),

    // Timestamps
    createdAt: timestamp("created_at").defaultNow().notNull(),
    postedAt: timestamp("posted_at"),
  },
  (table) => [
    index("fixed_asset_depreciations_asset_id_idx").on(table.fixedAssetId),
    index("fixed_asset_depreciations_year_idx").on(table.year),
    index("fixed_asset_depreciations_status_idx").on(table.status),
    index("fixed_asset_depreciations_journal_entry_id_idx").on(table.journalEntryId),
    unique("fixed_asset_depreciations_asset_year_unique").on(table.fixedAssetId, table.year),
  ]
);

// Fixed Asset Disposals - records of asset disposal
export const fixedAssetDisposals = pgTable(
  "fixed_asset_disposals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    fixedAssetId: uuid("fixed_asset_id")
      .references(() => fixedAssets.id, { onDelete: "cascade" })
      .notNull(),

    // Disposal details
    disposalDate: date("disposal_date").notNull(),
    disposalMethod: disposalMethodEnum("disposal_method").notNull(),

    // Financial details
    proceeds: numeric("proceeds", { precision: 15, scale: 2 }).default("0").notNull(),
    netBookValueAtDisposal: numeric("net_book_value_at_disposal", { precision: 15, scale: 2 }).notNull(),
    gainLoss: numeric("gain_loss", { precision: 15, scale: 2 }).notNull(), // proceeds - NBV

    // Buyer information (optional)
    buyerInfo: jsonb("buyer_info").$type<{
      name?: string;
      contact?: string;
      reference?: string;
    }>(),

    // Journal entry link
    journalEntryId: uuid("journal_entry_id").references(() => journalEntries.id, {
      onDelete: "set null",
    }),

    // Notes
    notes: text("notes"),

    // Timestamps
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("fixed_asset_disposals_asset_id_idx").on(table.fixedAssetId),
    index("fixed_asset_disposals_disposal_date_idx").on(table.disposalDate),
    index("fixed_asset_disposals_journal_entry_id_idx").on(table.journalEntryId),
  ]
);

// Relations
export const fixedAssetCategoriesRelations = relations(fixedAssetCategories, ({ one, many }) => ({
  user: one(users, {
    fields: [fixedAssetCategories.userId],
    references: [users.id],
  }),
  defaultAssetAccount: one(accounts, {
    fields: [fixedAssetCategories.defaultAssetAccountId],
    references: [accounts.id],
    relationName: "categoryAssetAccount",
  }),
  defaultDepreciationExpenseAccount: one(accounts, {
    fields: [fixedAssetCategories.defaultDepreciationExpenseAccountId],
    references: [accounts.id],
    relationName: "categoryDepreciationExpenseAccount",
  }),
  defaultAccumulatedDepreciationAccount: one(accounts, {
    fields: [fixedAssetCategories.defaultAccumulatedDepreciationAccountId],
    references: [accounts.id],
    relationName: "categoryAccumulatedDepreciationAccount",
  }),
  assets: many(fixedAssets),
}));

export const fixedAssetsRelations = relations(fixedAssets, ({ one, many }) => ({
  user: one(users, {
    fields: [fixedAssets.userId],
    references: [users.id],
  }),
  category: one(fixedAssetCategories, {
    fields: [fixedAssets.categoryId],
    references: [fixedAssetCategories.id],
  }),
  vendor: one(vendors, {
    fields: [fixedAssets.vendorId],
    references: [vendors.id],
  }),
  assetAccount: one(accounts, {
    fields: [fixedAssets.assetAccountId],
    references: [accounts.id],
    relationName: "assetAccount",
  }),
  depreciationExpenseAccount: one(accounts, {
    fields: [fixedAssets.depreciationExpenseAccountId],
    references: [accounts.id],
    relationName: "depreciationExpenseAccount",
  }),
  accumulatedDepreciationAccount: one(accounts, {
    fields: [fixedAssets.accumulatedDepreciationAccountId],
    references: [accounts.id],
    relationName: "accumulatedDepreciationAccount",
  }),
  depreciations: many(fixedAssetDepreciations),
  disposals: many(fixedAssetDisposals),
}));

export const fixedAssetDepreciationsRelations = relations(fixedAssetDepreciations, ({ one }) => ({
  fixedAsset: one(fixedAssets, {
    fields: [fixedAssetDepreciations.fixedAssetId],
    references: [fixedAssets.id],
  }),
  journalEntry: one(journalEntries, {
    fields: [fixedAssetDepreciations.journalEntryId],
    references: [journalEntries.id],
  }),
}));

export const fixedAssetDisposalsRelations = relations(fixedAssetDisposals, ({ one }) => ({
  fixedAsset: one(fixedAssets, {
    fields: [fixedAssetDisposals.fixedAssetId],
    references: [fixedAssets.id],
  }),
  journalEntry: one(journalEntries, {
    fields: [fixedAssetDisposals.journalEntryId],
    references: [journalEntries.id],
  }),
}));

// TypeScript types
export type FixedAssetCategory = typeof fixedAssetCategories.$inferSelect;
export type NewFixedAssetCategory = typeof fixedAssetCategories.$inferInsert;
export type FixedAsset = typeof fixedAssets.$inferSelect;
export type NewFixedAsset = typeof fixedAssets.$inferInsert;
export type FixedAssetDepreciation = typeof fixedAssetDepreciations.$inferSelect;
export type NewFixedAssetDepreciation = typeof fixedAssetDepreciations.$inferInsert;
export type FixedAssetDisposal = typeof fixedAssetDisposals.$inferSelect;
export type NewFixedAssetDisposal = typeof fixedAssetDisposals.$inferInsert;

// Enum types
export type DepreciationMethod = (typeof depreciationMethodEnum.enumValues)[number];
export type AcquisitionMethod = (typeof acquisitionMethodEnum.enumValues)[number];
export type FixedAssetStatus = (typeof fixedAssetStatusEnum.enumValues)[number];
export type DisposalMethod = (typeof disposalMethodEnum.enumValues)[number];
export type DepreciationScheduleStatus = (typeof depreciationScheduleStatusEnum.enumValues)[number];
