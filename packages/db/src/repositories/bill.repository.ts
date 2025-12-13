import { eq, and, isNull, desc, gte, lte, sql } from "drizzle-orm";
import { db } from "../index";
import { bills, billItems, type BillStatus } from "../schema";

export interface CreateBillInput {
  userId: string;
  vendorId?: string | null;
  billNumber: string;
  description?: string | null;
  currency?: string;
  billDate: Date;
  dueDate?: Date | null;
  status?: BillStatus;
  notes?: string | null;
  attachmentUrl?: string | null;
  // Financial totals
  subtotal?: string | null;
  taxRate?: string | null;
  taxAmount?: string | null;
  total?: string | null;
  items?: Array<{
    description: string;
    quantity: string;
    unitPrice: string;
  }>;
}

export interface UpdateBillInput {
  vendorId?: string | null;
  billNumber?: string;
  description?: string | null;
  currency?: string;
  billDate?: Date;
  dueDate?: Date | null;
  status?: BillStatus;
  notes?: string | null;
  attachmentUrl?: string | null;
  // Financial totals
  subtotal?: string | null;
  taxRate?: string | null;
  taxAmount?: string | null;
  total?: string | null;
  items?: Array<{
    description: string;
    quantity: string;
    unitPrice: string;
  }>;
}

export interface BillQueryOptions {
  limit?: number;
  offset?: number;
  vendorId?: string;
  status?: BillStatus;
  startDate?: Date;
  endDate?: Date;
}

export interface BillListItem {
  id: string;
  billNumber: string;
  status: string;
  currency: string;
  billDate: Date;
  dueDate: Date | null;
  paidAt: Date | null;
  total: number;
  vendorId: string | null;
  vendorName: string | null;
}

export const billRepository = {
  findById: async (id: string, userId: string) => {
    return db.query.bills.findFirst({
      where: and(
        eq(bills.id, id),
        eq(bills.userId, userId),
        isNull(bills.deletedAt)
      ),
      with: {
        items: true,
        vendor: true,
      },
    });
  },

  findMany: async (userId: string, options?: BillQueryOptions) => {
    const { limit = 50, offset = 0, vendorId, status, startDate, endDate } = options ?? {};

    const conditions = [
      eq(bills.userId, userId),
      isNull(bills.deletedAt),
    ];

    if (vendorId) {
      conditions.push(eq(bills.vendorId, vendorId));
    }

    if (status) {
      conditions.push(eq(bills.status, status));
    }

    if (startDate) {
      conditions.push(gte(bills.billDate, startDate));
    }

    if (endDate) {
      conditions.push(lte(bills.billDate, endDate));
    }

    return db.query.bills.findMany({
      where: and(...conditions),
      with: {
        items: true,
        vendor: true,
      },
      limit,
      offset,
      orderBy: [desc(bills.createdAt)],
    });
  },

  /**
   * Lightweight list query - only loads fields needed for list/table views.
   * Much faster than findMany for large bill counts.
   */
  findManyLight: async (userId: string, options?: BillQueryOptions): Promise<BillListItem[]> => {
    const { limit = 50, offset = 0, vendorId, status, startDate, endDate } = options ?? {};

    const conditions = [
      eq(bills.userId, userId),
      isNull(bills.deletedAt),
    ];

    if (vendorId) {
      conditions.push(eq(bills.vendorId, vendorId));
    }

    if (status) {
      conditions.push(eq(bills.status, status));
    }

    if (startDate) {
      conditions.push(gte(bills.billDate, startDate));
    }

    if (endDate) {
      conditions.push(lte(bills.billDate, endDate));
    }

    const userBills = await db.query.bills.findMany({
      where: and(...conditions),
      columns: {
        id: true,
        billNumber: true,
        status: true,
        currency: true,
        billDate: true,
        dueDate: true,
        paidAt: true,
        total: true,
        vendorId: true,
      },
      with: {
        vendor: {
          columns: { name: true },
        },
      },
      limit,
      offset,
      orderBy: [desc(bills.createdAt)],
    });

    return userBills.map((bill) => ({
      id: bill.id,
      billNumber: bill.billNumber,
      status: bill.status,
      currency: bill.currency,
      billDate: bill.billDate,
      dueDate: bill.dueDate,
      paidAt: bill.paidAt,
      total: Number(bill.total ?? 0),
      vendorId: bill.vendorId,
      vendorName: bill.vendor?.name ?? null,
    }));
  },

  findByVendor: async (vendorId: string, userId: string, options?: { limit?: number; offset?: number }) => {
    const { limit = 50, offset = 0 } = options ?? {};

    return db.query.bills.findMany({
      where: and(
        eq(bills.vendorId, vendorId),
        eq(bills.userId, userId),
        isNull(bills.deletedAt)
      ),
      with: {
        items: true,
      },
      limit,
      offset,
      orderBy: [desc(bills.createdAt)],
    });
  },

  getUnpaidBills: async (userId: string, vendorId?: string) => {
    const conditions = [
      eq(bills.userId, userId),
      isNull(bills.deletedAt),
      sql`${bills.status} IN ('pending', 'overdue')`,
    ];

    if (vendorId) {
      conditions.push(eq(bills.vendorId, vendorId));
    }

    return db.query.bills.findMany({
      where: and(...conditions),
      with: {
        items: true,
        vendor: true,
      },
      orderBy: [desc(bills.dueDate)],
    });
  },

  create: async (input: CreateBillInput) => {
    return db.transaction(async (tx) => {
      const [bill] = await tx
        .insert(bills)
        .values({
          userId: input.userId,
          vendorId: input.vendorId ?? null,
          billNumber: input.billNumber,
          description: input.description ?? null,
          currency: input.currency ?? "MYR",
          billDate: input.billDate,
          dueDate: input.dueDate ?? null,
          status: input.status ?? "pending",
          notes: input.notes ?? null,
          attachmentUrl: input.attachmentUrl ?? null,
          // Financial totals
          subtotal: input.subtotal ?? null,
          taxRate: input.taxRate ?? null,
          taxAmount: input.taxAmount ?? null,
          total: input.total ?? null,
        })
        .returning();

      if (input.items?.length) {
        await tx.insert(billItems).values(
          input.items.map((item) => ({
            billId: bill!.id,
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
          }))
        );
      }

      return bill;
    });
  },

  update: async (id: string, userId: string, input: UpdateBillInput) => {
    return db.transaction(async (tx) => {
      const existingBill = await tx.query.bills.findFirst({
        where: and(
          eq(bills.id, id),
          eq(bills.userId, userId),
          isNull(bills.deletedAt)
        ),
      });

      if (!existingBill) {
        return null;
      }

      const [updated] = await tx
        .update(bills)
        .set({
          vendorId: input.vendorId !== undefined ? input.vendorId : existingBill.vendorId,
          billNumber: input.billNumber ?? existingBill.billNumber,
          description: input.description !== undefined ? input.description : existingBill.description,
          currency: input.currency ?? existingBill.currency,
          billDate: input.billDate ?? existingBill.billDate,
          dueDate: input.dueDate !== undefined ? input.dueDate : existingBill.dueDate,
          status: input.status ?? existingBill.status,
          notes: input.notes !== undefined ? input.notes : existingBill.notes,
          attachmentUrl: input.attachmentUrl !== undefined ? input.attachmentUrl : existingBill.attachmentUrl,
          updatedAt: new Date(),
        })
        .where(and(eq(bills.id, id), eq(bills.userId, userId)))
        .returning();

      if (input.items !== undefined) {
        // Delete existing items and insert new ones
        await tx.delete(billItems).where(eq(billItems.billId, id));

        if (input.items.length) {
          await tx.insert(billItems).values(
            input.items.map((item) => ({
              billId: id,
              description: item.description,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
            }))
          );
        }
      }

      return updated;
    });
  },

  updateStatus: async (id: string, userId: string, status: BillStatus, paidAt?: Date) => {
    const existingBill = await db.query.bills.findFirst({
      where: and(
        eq(bills.id, id),
        eq(bills.userId, userId),
        isNull(bills.deletedAt)
      ),
    });

    if (!existingBill) {
      return null;
    }

    const [updated] = await db
      .update(bills)
      .set({
        status,
        paidAt: status === "paid" ? (paidAt || new Date()) : null,
        updatedAt: new Date(),
      })
      .where(and(eq(bills.id, id), eq(bills.userId, userId)))
      .returning();

    return updated;
  },

  delete: async (id: string, userId: string) => {
    const existingBill = await db.query.bills.findFirst({
      where: and(
        eq(bills.id, id),
        eq(bills.userId, userId),
        isNull(bills.deletedAt)
      ),
    });

    if (!existingBill) {
      return false;
    }

    // Soft delete
    await db
      .update(bills)
      .set({ deletedAt: new Date() })
      .where(and(eq(bills.id, id), eq(bills.userId, userId)));

    return true;
  },

  exists: async (id: string, userId: string) => {
    const bill = await db.query.bills.findFirst({
      where: and(
        eq(bills.id, id),
        eq(bills.userId, userId),
        isNull(bills.deletedAt)
      ),
      columns: { id: true },
    });
    return !!bill;
  },

  // Calculate total for a bill from its items
  calculateTotal: (items: Array<{ quantity: string; unitPrice: string }>) => {
    return items.reduce((sum, item) => {
      return sum + (parseFloat(item.quantity) * parseFloat(item.unitPrice));
    }, 0);
  },

  getAgingReport: async (userId: string, vendorId?: string) => {
    const conditions = [
      eq(bills.userId, userId),
      isNull(bills.deletedAt),
      sql`${bills.status} IN ('pending', 'overdue')`,
    ];

    if (vendorId) {
      conditions.push(eq(bills.vendorId, vendorId));
    }

    // Use lightweight query - only load what's needed for aging calculation
    const unpaidBills = await db.query.bills.findMany({
      where: and(...conditions),
      columns: {
        id: true,
        status: true,
        dueDate: true,
        total: true,
      },
    });

    // Helper to sum amounts for a bucket of bills
    const sumBucketAmounts = (billList: typeof unpaidBills): number => {
      return billList.reduce((sum, bill) => sum + parseFloat(bill.total ?? "0"), 0);
    };

    // Calculate aging buckets
    const now = new Date();
    const buckets = {
      current: [] as typeof unpaidBills,
      days1to30: [] as typeof unpaidBills,
      days31to60: [] as typeof unpaidBills,
      days61to90: [] as typeof unpaidBills,
      over90: [] as typeof unpaidBills,
    };

    for (const bill of unpaidBills) {
      const dueDate = bill.dueDate;
      if (!dueDate) {
        buckets.current.push(bill);
        continue;
      }

      const dueDateObj = new Date(dueDate);
      const daysOverdue = Math.floor((now.getTime() - dueDateObj.getTime()) / (1000 * 60 * 60 * 24));

      if (daysOverdue <= 0) {
        buckets.current.push(bill);
      } else if (daysOverdue <= 30) {
        buckets.days1to30.push(bill);
      } else if (daysOverdue <= 60) {
        buckets.days31to60.push(bill);
      } else if (daysOverdue <= 90) {
        buckets.days61to90.push(bill);
      } else {
        buckets.over90.push(bill);
      }
    }

    // Calculate both counts and amounts for each bucket (matches invoice aging report)
    return {
      buckets,
      totals: {
        // Counts (number of bills)
        currentCount: buckets.current.length,
        days1to30Count: buckets.days1to30.length,
        days31to60Count: buckets.days31to60.length,
        days61to90Count: buckets.days61to90.length,
        over90Count: buckets.over90.length,
        totalCount: unpaidBills.length,
        // Amounts (sum of bill totals) - the critical financial metric
        current: sumBucketAmounts(buckets.current),
        days1to30: sumBucketAmounts(buckets.days1to30),
        days31to60: sumBucketAmounts(buckets.days31to60),
        days61to90: sumBucketAmounts(buckets.days61to90),
        over90: sumBucketAmounts(buckets.over90),
        total: sumBucketAmounts(unpaidBills),
      },
    };
  },
};

export type BillRepository = typeof billRepository;
