import { eq, and, or, ilike, isNull } from "drizzle-orm";
import { db } from "../index";
import { vendors, vendorMetadata } from "../schema";

export interface CreateVendorInput {
  userId: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  website?: string | null;
  bankName?: string | null;
  bankAccountNumber?: string | null;
  bankRoutingNumber?: string | null;
  bankSwiftCode?: string | null;
  taxId?: string | null;
  vatNumber?: string | null;
  registrationNumber?: string | null;
  paymentTermsDays?: number | null;
  preferredPaymentMethod?: string | null;
  creditLimit?: string | null;
  metadata?: Array<{ label: string; value: string }>;
}

export interface UpdateVendorInput {
  name?: string;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  website?: string | null;
  bankName?: string | null;
  bankAccountNumber?: string | null;
  bankRoutingNumber?: string | null;
  bankSwiftCode?: string | null;
  taxId?: string | null;
  vatNumber?: string | null;
  registrationNumber?: string | null;
  paymentTermsDays?: number | null;
  preferredPaymentMethod?: string | null;
  creditLimit?: string | null;
  metadata?: Array<{ label: string; value: string }>;
}

export interface VendorQueryOptions {
  limit?: number;
  offset?: number;
}

export const vendorRepository = {
  findById: async (id: string, userId: string) => {
    return db.query.vendors.findFirst({
      where: and(
        eq(vendors.id, id),
        eq(vendors.userId, userId),
        isNull(vendors.deletedAt)
      ),
      with: {
        metadata: true,
      },
    });
  },

  findMany: async (userId: string, options?: VendorQueryOptions) => {
    const { limit = 50, offset = 0 } = options || {};

    return db.query.vendors.findMany({
      where: and(
        eq(vendors.userId, userId),
        isNull(vendors.deletedAt)
      ),
      with: {
        metadata: true,
      },
      limit,
      offset,
      orderBy: (vendors, { desc }) => [desc(vendors.createdAt)],
    });
  },

  search: async (userId: string, query: string, limit = 10) => {
    if (!query.trim()) {
      return [];
    }

    const searchPattern = `%${query}%`;

    return db.query.vendors.findMany({
      where: and(
        eq(vendors.userId, userId),
        isNull(vendors.deletedAt),
        or(
          ilike(vendors.name, searchPattern),
          ilike(vendors.email, searchPattern)
        )
      ),
      limit,
      orderBy: (vendors, { asc }) => [asc(vendors.name)],
    });
  },

  create: async (input: CreateVendorInput) => {
    return db.transaction(async (tx) => {
      const [vendor] = await tx
        .insert(vendors)
        .values({
          userId: input.userId,
          name: input.name,
          email: input.email || null,
          phone: input.phone || null,
          address: input.address || null,
          website: input.website || null,
          bankName: input.bankName || null,
          bankAccountNumber: input.bankAccountNumber || null,
          bankRoutingNumber: input.bankRoutingNumber || null,
          bankSwiftCode: input.bankSwiftCode || null,
          taxId: input.taxId || null,
          vatNumber: input.vatNumber || null,
          registrationNumber: input.registrationNumber || null,
          paymentTermsDays: input.paymentTermsDays || null,
          preferredPaymentMethod: input.preferredPaymentMethod || null,
          creditLimit: input.creditLimit || null,
        })
        .returning();

      if (input.metadata?.length) {
        await tx.insert(vendorMetadata).values(
          input.metadata.map((m) => ({
            vendorId: vendor!.id,
            label: m.label,
            value: m.value,
          }))
        );
      }

      return vendor;
    });
  },

  update: async (id: string, userId: string, input: UpdateVendorInput) => {
    return db.transaction(async (tx) => {
      const existingVendor = await tx.query.vendors.findFirst({
        where: and(eq(vendors.id, id), eq(vendors.userId, userId)),
      });

      if (!existingVendor) {
        return null;
      }

      const [updated] = await tx
        .update(vendors)
        .set({
          name: input.name ?? existingVendor.name,
          email: input.email !== undefined ? input.email : existingVendor.email,
          phone: input.phone !== undefined ? input.phone : existingVendor.phone,
          address: input.address !== undefined ? input.address : existingVendor.address,
          website: input.website !== undefined ? input.website : existingVendor.website,
          bankName: input.bankName !== undefined ? input.bankName : existingVendor.bankName,
          bankAccountNumber: input.bankAccountNumber !== undefined ? input.bankAccountNumber : existingVendor.bankAccountNumber,
          bankRoutingNumber: input.bankRoutingNumber !== undefined ? input.bankRoutingNumber : existingVendor.bankRoutingNumber,
          bankSwiftCode: input.bankSwiftCode !== undefined ? input.bankSwiftCode : existingVendor.bankSwiftCode,
          taxId: input.taxId !== undefined ? input.taxId : existingVendor.taxId,
          vatNumber: input.vatNumber !== undefined ? input.vatNumber : existingVendor.vatNumber,
          registrationNumber: input.registrationNumber !== undefined ? input.registrationNumber : existingVendor.registrationNumber,
          paymentTermsDays: input.paymentTermsDays !== undefined ? input.paymentTermsDays : existingVendor.paymentTermsDays,
          preferredPaymentMethod: input.preferredPaymentMethod !== undefined ? input.preferredPaymentMethod : existingVendor.preferredPaymentMethod,
          creditLimit: input.creditLimit !== undefined ? input.creditLimit : existingVendor.creditLimit,
          updatedAt: new Date(),
        })
        .where(and(eq(vendors.id, id), eq(vendors.userId, userId)))
        .returning();

      if (input.metadata !== undefined) {
        await tx.delete(vendorMetadata).where(eq(vendorMetadata.vendorId, id));

        if (input.metadata.length) {
          await tx.insert(vendorMetadata).values(
            input.metadata.map((m) => ({
              vendorId: id,
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
    const existingVendor = await db.query.vendors.findFirst({
      where: and(
        eq(vendors.id, id),
        eq(vendors.userId, userId),
        isNull(vendors.deletedAt)
      ),
    });

    if (!existingVendor) {
      return false;
    }

    // Soft delete - set deletedAt timestamp
    await db
      .update(vendors)
      .set({ deletedAt: new Date() })
      .where(and(eq(vendors.id, id), eq(vendors.userId, userId)));

    return true;
  },

  exists: async (id: string, userId: string) => {
    const vendor = await db.query.vendors.findFirst({
      where: and(
        eq(vendors.id, id),
        eq(vendors.userId, userId),
        isNull(vendors.deletedAt)
      ),
      columns: { id: true },
    });
    return !!vendor;
  },
};

export type VendorRepository = typeof vendorRepository;
