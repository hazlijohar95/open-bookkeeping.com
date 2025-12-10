import { eq, and, or, ilike, isNull } from "drizzle-orm";
import { db } from "../index";
import { customers, customerMetadata } from "../schema";

export interface CreateCustomerInput {
  userId: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  metadata?: Array<{ label: string; value: string }>;
}

export interface UpdateCustomerInput {
  name?: string;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  metadata?: Array<{ label: string; value: string }>;
}

export interface CustomerQueryOptions {
  limit?: number;
  offset?: number;
}

export const customerRepository = {
  findById: async (id: string, userId: string) => {
    return db.query.customers.findFirst({
      where: and(
        eq(customers.id, id),
        eq(customers.userId, userId),
        isNull(customers.deletedAt)
      ),
      with: {
        metadata: true,
      },
    });
  },

  findMany: async (userId: string, options?: CustomerQueryOptions) => {
    const { limit = 50, offset = 0 } = options || {};

    return db.query.customers.findMany({
      where: and(
        eq(customers.userId, userId),
        isNull(customers.deletedAt)
      ),
      with: {
        metadata: true,
      },
      limit,
      offset,
      orderBy: (customers, { desc }) => [desc(customers.createdAt)],
    });
  },

  search: async (userId: string, query: string, limit = 10) => {
    if (!query.trim()) {
      return [];
    }

    const searchPattern = `%${query}%`;

    return db.query.customers.findMany({
      where: and(
        eq(customers.userId, userId),
        isNull(customers.deletedAt),
        or(
          ilike(customers.name, searchPattern),
          ilike(customers.email, searchPattern)
        )
      ),
      limit,
      orderBy: (customers, { asc }) => [asc(customers.name)],
    });
  },

  create: async (input: CreateCustomerInput) => {
    return db.transaction(async (tx) => {
      const [customer] = await tx
        .insert(customers)
        .values({
          userId: input.userId,
          name: input.name,
          email: input.email || null,
          phone: input.phone || null,
          address: input.address || null,
        })
        .returning();

      if (input.metadata?.length) {
        await tx.insert(customerMetadata).values(
          input.metadata.map((m) => ({
            customerId: customer!.id,
            label: m.label,
            value: m.value,
          }))
        );
      }

      return customer;
    });
  },

  update: async (id: string, userId: string, input: UpdateCustomerInput) => {
    return db.transaction(async (tx) => {
      const existingCustomer = await tx.query.customers.findFirst({
        where: and(eq(customers.id, id), eq(customers.userId, userId)),
      });

      if (!existingCustomer) {
        return null;
      }

      const [updated] = await tx
        .update(customers)
        .set({
          name: input.name ?? existingCustomer.name,
          email: input.email !== undefined ? input.email : existingCustomer.email,
          phone: input.phone !== undefined ? input.phone : existingCustomer.phone,
          address: input.address !== undefined ? input.address : existingCustomer.address,
          updatedAt: new Date(),
        })
        .where(and(eq(customers.id, id), eq(customers.userId, userId)))
        .returning();

      if (input.metadata !== undefined) {
        await tx.delete(customerMetadata).where(eq(customerMetadata.customerId, id));

        if (input.metadata.length) {
          await tx.insert(customerMetadata).values(
            input.metadata.map((m) => ({
              customerId: id,
              label: m.label,
              value: m.value,
            }))
          );
        }
      }

      return updated;
    });
  },

  delete: async (id: string, userId: string) => {
    const existingCustomer = await db.query.customers.findFirst({
      where: and(
        eq(customers.id, id),
        eq(customers.userId, userId),
        isNull(customers.deletedAt)
      ),
    });

    if (!existingCustomer) {
      return false;
    }

    // Soft delete - set deletedAt timestamp
    await db
      .update(customers)
      .set({ deletedAt: new Date() })
      .where(and(eq(customers.id, id), eq(customers.userId, userId)));

    return true;
  },

  exists: async (id: string, userId: string) => {
    const customer = await db.query.customers.findFirst({
      where: and(
        eq(customers.id, id),
        eq(customers.userId, userId),
        isNull(customers.deletedAt)
      ),
      columns: { id: true },
    });
    return !!customer;
  },
};

export type CustomerRepository = typeof customerRepository;
