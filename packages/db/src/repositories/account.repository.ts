import { eq, and, isNull, asc } from "drizzle-orm";
import { db } from "../index";
import {
  accounts,
  type AccountType,
  type NormalBalance,
  type SstTaxCode,
} from "../schema";
import { malaysianSMEAccounts } from "../data/malaysianChartOfAccounts";

// ============= Types =============

export interface CreateAccountInput {
  userId: string;
  code: string;
  name: string;
  description?: string;
  accountType: AccountType;
  normalBalance: NormalBalance;
  parentId?: string;
  sstTaxCode?: SstTaxCode;
  isHeader?: boolean;
  isSystemAccount?: boolean;
  openingBalance?: string;
  openingBalanceDate?: string;
}

export interface UpdateAccountInput {
  code?: string;
  name?: string;
  description?: string | null;
  parentId?: string | null;
  sstTaxCode?: SstTaxCode | null;
  isActive?: boolean;
  isHeader?: boolean;
  openingBalance?: string | null;
  openingBalanceDate?: string | null;
}

export interface AccountQueryOptions {
  accountType?: AccountType;
  isActive?: boolean;
  isHeader?: boolean;
  parentId?: string | null;
}

export interface AccountTreeNode {
  id: string;
  code: string;
  name: string;
  description: string | null;
  accountType: AccountType;
  normalBalance: NormalBalance;
  level: number;
  path: string | null;
  sstTaxCode: SstTaxCode | null;
  isActive: boolean;
  isSystemAccount: boolean;
  isHeader: boolean;
  openingBalance: string | null;
  balance: string;
  children: AccountTreeNode[];
}

// ============= Repository =============

export const accountRepository = {
  initializeDefaults: async (userId: string) => {
    // Check if user already has accounts
    const existingAccounts = await db.query.accounts.findMany({
      where: and(eq(accounts.userId, userId), isNull(accounts.deletedAt)),
      limit: 1,
    });

    if (existingAccounts.length > 0) {
      throw new Error("User already has accounts initialized");
    }

    // First pass: create all accounts without parentId
    const codeToIdMap = new Map<string, string>();

    for (const defaultAccount of malaysianSMEAccounts) {
      const [created] = await db
        .insert(accounts)
        .values({
          userId,
          code: defaultAccount.code,
          name: defaultAccount.name,
          description: defaultAccount.description ?? null,
          accountType: defaultAccount.accountType,
          normalBalance: defaultAccount.normalBalance,
          parentId: null, // Will update in second pass
          level: defaultAccount.parentCode ? 1 : 0,
          path: defaultAccount.code,
          sstTaxCode: defaultAccount.sstTaxCode ?? "none",
          isActive: true,
          isSystemAccount: defaultAccount.isSystemAccount,
          isHeader: defaultAccount.isHeader,
          openingBalance: "0",
        })
        .returning();

      if (!created) {
        throw new Error(`Failed to create account ${defaultAccount.code}`);
      }
      codeToIdMap.set(defaultAccount.code, created.id);
    }

    // Second pass: update parent relationships and paths
    for (const defaultAccount of malaysianSMEAccounts) {
      if (defaultAccount.parentCode) {
        const parentId = codeToIdMap.get(defaultAccount.parentCode);
        const accountId = codeToIdMap.get(defaultAccount.code);

        if (parentId && accountId) {
          // Calculate the full path
          const parentAccount = malaysianSMEAccounts.find(
            (a) => a.code === defaultAccount.parentCode
          );
          let level = 1;
          let path = defaultAccount.code;

          if (parentAccount) {
            // Find level by counting parent chain
            let currentParent = parentAccount;
            while (currentParent.parentCode) {
              level++;
              currentParent = malaysianSMEAccounts.find(
                (a) => a.code === currentParent.parentCode
              )!;
            }
            // Build path
            const pathParts: string[] = [defaultAccount.code];
            currentParent = parentAccount;
            while (currentParent) {
              pathParts.unshift(currentParent.code);
              if (currentParent.parentCode) {
                currentParent = malaysianSMEAccounts.find(
                  (a) => a.code === currentParent.parentCode
                )!;
              } else {
                break;
              }
            }
            path = pathParts.join("/");
          }

          await db
            .update(accounts)
            .set({
              parentId,
              level,
              path,
            })
            .where(eq(accounts.id, accountId));
        }
      }
    }

    return { accountsCreated: malaysianSMEAccounts.length };
  },

  findById: async (id: string, userId: string) => {
    return db.query.accounts.findFirst({
      where: and(
        eq(accounts.id, id),
        eq(accounts.userId, userId),
        isNull(accounts.deletedAt)
      ),
      with: {
        parent: true,
        children: {
          where: isNull(accounts.deletedAt),
        },
      },
    });
  },

  findByCode: async (code: string, userId: string) => {
    return db.query.accounts.findFirst({
      where: and(
        eq(accounts.code, code),
        eq(accounts.userId, userId),
        isNull(accounts.deletedAt)
      ),
    });
  },

  findAll: async (userId: string, options?: AccountQueryOptions) => {
    const conditions = [eq(accounts.userId, userId), isNull(accounts.deletedAt)];

    if (options?.accountType) {
      conditions.push(eq(accounts.accountType, options.accountType));
    }
    if (options?.isActive !== undefined) {
      conditions.push(eq(accounts.isActive, options.isActive));
    }
    if (options?.isHeader !== undefined) {
      conditions.push(eq(accounts.isHeader, options.isHeader));
    }
    if (options?.parentId !== undefined) {
      if (options.parentId === null) {
        conditions.push(isNull(accounts.parentId));
      } else {
        conditions.push(eq(accounts.parentId, options.parentId));
      }
    }

    return db.query.accounts.findMany({
      where: and(...conditions),
      orderBy: [asc(accounts.code)],
      with: {
        parent: true,
      },
    });
  },

  getTree: async (userId: string, accountType?: AccountType) => {
    const conditions = [eq(accounts.userId, userId), isNull(accounts.deletedAt)];

    if (accountType) {
      conditions.push(eq(accounts.accountType, accountType));
    }

    const allAccounts = await db.query.accounts.findMany({
      where: and(...conditions),
      orderBy: [asc(accounts.code)],
    });

    // Build tree structure
    const accountMap = new Map<string, AccountTreeNode>();
    const rootAccounts: AccountTreeNode[] = [];

    // First pass: create nodes
    for (const account of allAccounts) {
      const node: AccountTreeNode = {
        id: account.id,
        code: account.code,
        name: account.name,
        description: account.description,
        accountType: account.accountType,
        normalBalance: account.normalBalance,
        level: account.level,
        path: account.path,
        sstTaxCode: account.sstTaxCode,
        isActive: account.isActive,
        isSystemAccount: account.isSystemAccount,
        isHeader: account.isHeader,
        openingBalance: account.openingBalance,
        balance: account.openingBalance ?? "0",
        children: [],
      };
      accountMap.set(account.id, node);
    }

    // Second pass: build tree
    for (const account of allAccounts) {
      const node = accountMap.get(account.id)!;
      if (account.parentId && accountMap.has(account.parentId)) {
        accountMap.get(account.parentId)!.children.push(node);
      } else if (!account.parentId) {
        rootAccounts.push(node);
      }
    }

    return rootAccounts;
  },

  create: async (input: CreateAccountInput) => {
    // Check for duplicate code
    const existing = await db.query.accounts.findFirst({
      where: and(
        eq(accounts.code, input.code),
        eq(accounts.userId, input.userId),
        isNull(accounts.deletedAt)
      ),
    });

    if (existing) {
      throw new Error(`Account code ${input.code} already exists`);
    }

    // Calculate level and path from parent
    let level = 0;
    let path = input.code;

    if (input.parentId) {
      const parent = await db.query.accounts.findFirst({
        where: and(
          eq(accounts.id, input.parentId),
          eq(accounts.userId, input.userId),
          isNull(accounts.deletedAt)
        ),
      });

      if (!parent) {
        throw new Error("Parent account not found");
      }

      level = parent.level + 1;
      path = parent.path ? `${parent.path}/${input.code}` : input.code;
    }

    const [created] = await db
      .insert(accounts)
      .values({
        userId: input.userId,
        code: input.code,
        name: input.name,
        description: input.description ?? null,
        accountType: input.accountType,
        normalBalance: input.normalBalance,
        parentId: input.parentId ?? null,
        level,
        path,
        sstTaxCode: input.sstTaxCode ?? "none",
        isActive: true,
        isSystemAccount: input.isSystemAccount || false,
        isHeader: input.isHeader || false,
        openingBalance: input.openingBalance ?? "0",
        openingBalanceDate: input.openingBalanceDate ?? null,
      })
      .returning();

    return created;
  },

  update: async (id: string, userId: string, input: UpdateAccountInput) => {
    const existing = await db.query.accounts.findFirst({
      where: and(
        eq(accounts.id, id),
        eq(accounts.userId, userId),
        isNull(accounts.deletedAt)
      ),
    });

    if (!existing) {
      return null;
    }

    // If changing parent, recalculate level and path
    let level = existing.level;
    let path = existing.path;

    if (input.parentId !== undefined) {
      if (input.parentId === null) {
        level = 0;
        path = input.code || existing.code;
      } else {
        const parent = await db.query.accounts.findFirst({
          where: and(
            eq(accounts.id, input.parentId),
            eq(accounts.userId, userId),
            isNull(accounts.deletedAt)
          ),
        });

        if (!parent) {
          throw new Error("Parent account not found");
        }

        level = parent.level + 1;
        path = parent.path
          ? `${parent.path}/${input.code || existing.code}`
          : (input.code || existing.code);
      }
    } else if (input.code && input.code !== existing.code) {
      // Just code change, update path
      if (existing.path) {
        const pathParts = existing.path.split("/");
        pathParts[pathParts.length - 1] = input.code;
        path = pathParts.join("/");
      } else {
        path = input.code;
      }
    }

    const [updated] = await db
      .update(accounts)
      .set({
        code: input.code ?? existing.code,
        name: input.name ?? existing.name,
        description:
          input.description !== undefined ? input.description : existing.description,
        parentId:
          input.parentId !== undefined ? input.parentId : existing.parentId,
        level,
        path,
        sstTaxCode:
          input.sstTaxCode !== undefined ? input.sstTaxCode : existing.sstTaxCode,
        isActive: input.isActive ?? existing.isActive,
        isHeader: input.isHeader ?? existing.isHeader,
        openingBalance:
          input.openingBalance !== undefined
            ? input.openingBalance
            : existing.openingBalance,
        openingBalanceDate:
          input.openingBalanceDate !== undefined
            ? input.openingBalanceDate
            : existing.openingBalanceDate,
        updatedAt: new Date(),
      })
      .where(and(eq(accounts.id, id), eq(accounts.userId, userId)))
      .returning();

    // If code changed, update children paths
    if (input.code && input.code !== existing.code) {
      await accountRepository.updateChildrenPaths(id, userId, path!);
    }

    return updated;
  },

  updateChildrenPaths: async (
    parentId: string,
    userId: string,
    parentPath: string
  ) => {
    const children = await db.query.accounts.findMany({
      where: and(
        eq(accounts.parentId, parentId),
        eq(accounts.userId, userId),
        isNull(accounts.deletedAt)
      ),
    });

    for (const child of children) {
      const newPath = `${parentPath}/${child.code}`;
      await db
        .update(accounts)
        .set({ path: newPath, updatedAt: new Date() })
        .where(eq(accounts.id, child.id));

      // Recursively update grandchildren
      await accountRepository.updateChildrenPaths(child.id, userId, newPath);
    }
  },

  delete: async (id: string, userId: string) => {
    const existing = await db.query.accounts.findFirst({
      where: and(
        eq(accounts.id, id),
        eq(accounts.userId, userId),
        isNull(accounts.deletedAt)
      ),
      with: {
        children: {
          where: isNull(accounts.deletedAt),
        },
        journalEntryLines: {
          limit: 1,
        },
      },
    });

    if (!existing) {
      return { success: false, error: "Account not found" };
    }

    if (existing.isSystemAccount) {
      return { success: false, error: "Cannot delete system account" };
    }

    if (existing.children.length > 0) {
      return { success: false, error: "Cannot delete account with children" };
    }

    if (existing.journalEntryLines.length > 0) {
      return { success: false, error: "Cannot delete account with transactions" };
    }

    await db
      .update(accounts)
      .set({ deletedAt: new Date() })
      .where(and(eq(accounts.id, id), eq(accounts.userId, userId)));

    return { success: true };
  },
};

export type AccountRepository = typeof accountRepository;
