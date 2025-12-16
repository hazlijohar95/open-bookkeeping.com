/**
 * Admin Service
 * Provides superadmin functionality for user and organization management
 */

import { eq, and, desc, asc, sql } from "drizzle-orm";
import {
  db,
  users,
  organizations,
  invoices,
  bills,
  customers,
  vendors,
  systemSettings,
  featureFlags,
  userSubscriptions,
} from "@open-bookkeeping/db";
import type { UserRole } from "@open-bookkeeping/db";
import { createLogger } from "@open-bookkeeping/shared";
import { adminAuditService } from "./admin-audit.service";
import { invalidateUserSessions } from "../trpc/context";

const logger = createLogger("admin-service");

// ============================================
// TYPES
// ============================================

export interface UserQueryOptions {
  search?: string;
  role?: UserRole;
  isSuspended?: boolean;
  limit?: number;
  offset?: number;
  sortBy?: "createdAt" | "lastActiveAt" | "email" | "name";
  sortOrder?: "asc" | "desc";
}

export interface OrganizationQueryOptions {
  search?: string;
  subscriptionStatus?: string;
  limit?: number;
  offset?: number;
  sortBy?: "createdAt" | "name" | "memberCount";
  sortOrder?: "asc" | "desc";
}

export interface UpdateUserRoleInput {
  userId: string;
  newRole: UserRole;
  adminId: string;
  reason?: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface SuspendUserInput {
  userId: string;
  reason: string;
  adminId: string;
  ipAddress?: string;
  userAgent?: string;
}

// ============================================
// USER MANAGEMENT
// ============================================

export const adminService = {
  /**
   * List all users with filtering and pagination
   */
  async listUsers(options: UserQueryOptions = {}) {
    const {
      limit = 50,
      offset = 0,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = options;

    const conditions = [];

    if (options.search) {
      conditions.push(
        sql`(${users.email} ILIKE ${`%${options.search}%`} OR ${users.name} ILIKE ${`%${options.search}%`})`
      );
    }

    if (options.role) {
      conditions.push(eq(users.role, options.role));
    }

    if (options.isSuspended !== undefined) {
      conditions.push(eq(users.isSuspended, options.isSuspended));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const orderColumn = {
      createdAt: users.createdAt,
      lastActiveAt: users.lastActiveAt,
      email: users.email,
      name: users.name,
    }[sortBy];

    const orderFn = sortOrder === "asc" ? asc : desc;

    const [userList, countResult] = await Promise.all([
      db.query.users.findMany({
        where: whereClause,
        orderBy: orderColumn ? [orderFn(orderColumn)] : undefined,
        limit,
        offset,
        columns: {
          id: true,
          email: true,
          name: true,
          avatarUrl: true,
          role: true,
          isSuspended: true,
          suspendedAt: true,
          suspendedReason: true,
          lastLoginAt: true,
          lastActiveAt: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      db
        .select({ count: sql<number>`count(*)` })
        .from(users)
        .where(whereClause),
    ]);

    return {
      users: userList,
      total: Number(countResult[0]?.count ?? 0),
      limit,
      offset,
    };
  },

  /**
   * Get detailed user information
   */
  async getUserDetails(userId: string) {
    // Query user without nested relations to avoid ambiguity errors
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
      columns: {
        id: true,
        email: true,
        name: true,
        avatarUrl: true,
        role: true,
        isSuspended: true,
        suspendedAt: true,
        suspendedReason: true,
        suspendedBy: true,
        lastLoginAt: true,
        lastActiveAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) return null;

    // Get user's stats and subscription in parallel
    const [invoiceCount, billCount, customerCount, vendorCount, subscription] =
      await Promise.all([
        db
          .select({ count: sql<number>`count(*)` })
          .from(invoices)
          .where(eq(invoices.userId, userId)),
        db
          .select({ count: sql<number>`count(*)` })
          .from(bills)
          .where(eq(bills.userId, userId)),
        db
          .select({ count: sql<number>`count(*)` })
          .from(customers)
          .where(eq(customers.userId, userId)),
        db
          .select({ count: sql<number>`count(*)` })
          .from(vendors)
          .where(eq(vendors.userId, userId)),
        db.query.userSubscriptions.findFirst({
          where: eq(userSubscriptions.userId, userId),
        }),
      ]);

    return {
      ...user,
      stats: {
        invoices: Number(invoiceCount[0]?.count ?? 0),
        bills: Number(billCount[0]?.count ?? 0),
        customers: Number(customerCount[0]?.count ?? 0),
        vendors: Number(vendorCount[0]?.count ?? 0),
      },
      subscription: subscription ?? null,
    };
  },

  /**
   * Update user role
   */
  async updateUserRole(input: UpdateUserRoleInput) {
    const user = await db.query.users.findFirst({
      where: eq(users.id, input.userId),
    });

    if (!user) {
      throw new Error("User not found");
    }

    const previousRole = user.role;

    // Prevent demoting last superadmin
    if (previousRole === "superadmin" && input.newRole !== "superadmin") {
      const superadminCount = await db
        .select({ count: sql<number>`count(*)` })
        .from(users)
        .where(eq(users.role, "superadmin"));

      if (Number(superadminCount[0]?.count) <= 1) {
        throw new Error("Cannot demote the last superadmin");
      }
    }

    // Update role
    const [updatedUser] = await db
      .update(users)
      .set({
        role: input.newRole,
        updatedAt: new Date(),
      })
      .where(eq(users.id, input.userId))
      .returning();

    // Log the action
    await adminAuditService.logAction({
      adminId: input.adminId,
      action: "user_role_changed",
      description: `Changed user role from ${previousRole} to ${input.newRole}`,
      targetType: "user",
      targetId: input.userId,
      targetEmail: user.email,
      previousState: { role: previousRole },
      newState: { role: input.newRole },
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
      metadata: { reason: input.reason },
    });

    // Invalidate user sessions to force re-auth with new role
    await invalidateUserSessions(input.userId);

    logger.info(
      { userId: input.userId, previousRole, newRole: input.newRole },
      "User role updated"
    );

    return updatedUser;
  },

  /**
   * Suspend a user
   */
  async suspendUser(input: SuspendUserInput) {
    const user = await db.query.users.findFirst({
      where: eq(users.id, input.userId),
    });

    if (!user) {
      throw new Error("User not found");
    }

    if (user.role === "superadmin") {
      throw new Error("Cannot suspend a superadmin");
    }

    if (user.isSuspended) {
      throw new Error("User is already suspended");
    }

    const [updatedUser] = await db
      .update(users)
      .set({
        isSuspended: true,
        suspendedAt: new Date(),
        suspendedReason: input.reason,
        suspendedBy: input.adminId,
        updatedAt: new Date(),
      })
      .where(eq(users.id, input.userId))
      .returning();

    // Log the action
    await adminAuditService.logAction({
      adminId: input.adminId,
      action: "user_suspended",
      description: `Suspended user: ${input.reason}`,
      targetType: "user",
      targetId: input.userId,
      targetEmail: user.email,
      previousState: { isSuspended: false },
      newState: { isSuspended: true, reason: input.reason },
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
    });

    // Invalidate all sessions
    await invalidateUserSessions(input.userId);

    logger.info({ userId: input.userId, reason: input.reason }, "User suspended");

    return updatedUser;
  },

  /**
   * Unsuspend a user
   */
  async unsuspendUser(input: Omit<SuspendUserInput, "reason">) {
    const user = await db.query.users.findFirst({
      where: eq(users.id, input.userId),
    });

    if (!user) {
      throw new Error("User not found");
    }

    if (!user.isSuspended) {
      throw new Error("User is not suspended");
    }

    const [updatedUser] = await db
      .update(users)
      .set({
        isSuspended: false,
        suspendedAt: null,
        suspendedReason: null,
        suspendedBy: null,
        updatedAt: new Date(),
      })
      .where(eq(users.id, input.userId))
      .returning();

    // Log the action
    await adminAuditService.logAction({
      adminId: input.adminId,
      action: "user_unsuspended",
      description: "Unsuspended user",
      targetType: "user",
      targetId: input.userId,
      targetEmail: user.email,
      previousState: { isSuspended: true },
      newState: { isSuspended: false },
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
    });

    // Invalidate cached sessions so user can access system immediately
    await invalidateUserSessions(input.userId);

    logger.info({ userId: input.userId }, "User unsuspended");

    return updatedUser;
  },

  // ============================================
  // ORGANIZATION MANAGEMENT
  // ============================================

  /**
   * List all organizations
   */
  async listOrganizations(options: OrganizationQueryOptions = {}) {
    const { limit = 50, offset = 0, sortOrder = "desc" } = options;

    const conditions = [];

    if (options.search) {
      conditions.push(
        sql`(${organizations.name} ILIKE ${`%${options.search}%`} OR ${organizations.slug} ILIKE ${`%${options.search}%`})`
      );
    }

    if (options.subscriptionStatus) {
      conditions.push(
        eq(organizations.subscriptionStatus, options.subscriptionStatus as any)
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
    const orderFn = sortOrder === "asc" ? asc : desc;

    const [orgList, countResult] = await Promise.all([
      db.query.organizations.findMany({
        where: whereClause,
        orderBy: [orderFn(organizations.createdAt)],
        limit,
        offset,
        with: {
          members: {
            columns: {
              id: true,
              role: true,
            },
          },
        },
      }),
      db
        .select({ count: sql<number>`count(*)` })
        .from(organizations)
        .where(whereClause),
    ]);

    // Add member counts
    const orgsWithCounts = orgList.map((org) => ({
      ...org,
      memberCount: org.members.length,
    }));

    return {
      organizations: orgsWithCounts,
      total: Number(countResult[0]?.count ?? 0),
      limit,
      offset,
    };
  },

  /**
   * Get organization details
   */
  async getOrganizationDetails(orgId: string) {
    return db.query.organizations.findFirst({
      where: eq(organizations.id, orgId),
      with: {
        members: {
          with: {
            user: {
              columns: {
                id: true,
                email: true,
                name: true,
                avatarUrl: true,
                role: true,
              },
            },
          },
        },
      },
    });
  },

  // ============================================
  // PLATFORM STATS
  // ============================================

  /**
   * Get platform-wide statistics
   */
  async getPlatformStats() {
    const [
      totalUsers,
      activeUsers,
      suspendedUsers,
      totalOrgs,
      totalInvoices,
      totalBills,
      usersByRole,
    ] = await Promise.all([
      db.select({ count: sql<number>`count(*)` }).from(users),
      db
        .select({ count: sql<number>`count(*)` })
        .from(users)
        .where(eq(users.isSuspended, false)),
      db
        .select({ count: sql<number>`count(*)` })
        .from(users)
        .where(eq(users.isSuspended, true)),
      db.select({ count: sql<number>`count(*)` }).from(organizations),
      db.select({ count: sql<number>`count(*)` }).from(invoices),
      db.select({ count: sql<number>`count(*)` }).from(bills),
      db
        .select({
          role: users.role,
          count: sql<number>`count(*)`,
        })
        .from(users)
        .groupBy(users.role),
    ]);

    return {
      users: {
        total: Number(totalUsers[0]?.count ?? 0),
        active: Number(activeUsers[0]?.count ?? 0),
        suspended: Number(suspendedUsers[0]?.count ?? 0),
        byRole: usersByRole.reduce(
          (acc, row) => {
            acc[row.role] = Number(row.count);
            return acc;
          },
          {} as Record<string, number>
        ),
      },
      organizations: {
        total: Number(totalOrgs[0]?.count ?? 0),
      },
      documents: {
        invoices: Number(totalInvoices[0]?.count ?? 0),
        bills: Number(totalBills[0]?.count ?? 0),
      },
    };
  },

  /**
   * Get user growth over time
   */
  async getUserGrowth(days = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    const startDateISO = startDate.toISOString();

    const growth = await db
      .select({
        date: sql<string>`DATE(${users.createdAt})`,
        count: sql<number>`count(*)`,
      })
      .from(users)
      .where(sql`${users.createdAt} >= ${startDateISO}::timestamp`)
      .groupBy(sql`DATE(${users.createdAt})`)
      .orderBy(sql`DATE(${users.createdAt})`);

    return growth.map((row) => ({
      date: row.date,
      count: Number(row.count),
    }));
  },

  // ============================================
  // SYSTEM SETTINGS
  // ============================================

  /**
   * Get system settings
   */
  async getSystemSettings() {
    let settings = await db.query.systemSettings.findFirst();

    if (!settings) {
      // Create default settings if none exist
      const [newSettings] = await db
        .insert(systemSettings)
        .values({})
        .returning();
      settings = newSettings;
    }

    return settings;
  },

  /**
   * Update system settings
   */
  async updateSystemSettings(
    adminId: string,
    updates: Partial<typeof systemSettings.$inferInsert>,
    context?: { ipAddress?: string; userAgent?: string }
  ) {
    const currentSettings = await this.getSystemSettings();

    const [updatedSettings] = await db
      .update(systemSettings)
      .set({
        ...updates,
        updatedBy: adminId,
        updatedAt: new Date(),
      })
      .where(eq(systemSettings.id, currentSettings!.id))
      .returning();

    // Log the action
    await adminAuditService.logAction({
      adminId,
      action: "system_setting_updated",
      description: "Updated system settings",
      targetType: "system",
      previousState: currentSettings as Record<string, unknown>,
      newState: updatedSettings as Record<string, unknown>,
      ipAddress: context?.ipAddress,
      userAgent: context?.userAgent,
    });

    return updatedSettings;
  },

  // ============================================
  // FEATURE FLAGS
  // ============================================

  /**
   * List all feature flags
   */
  async listFeatureFlags() {
    return db.query.featureFlags.findMany({
      orderBy: [asc(featureFlags.key)],
    });
  },

  /**
   * Toggle a feature flag
   */
  async toggleFeatureFlag(
    adminId: string,
    flagKey: string,
    enabled: boolean,
    context?: { ipAddress?: string; userAgent?: string }
  ) {
    const flag = await db.query.featureFlags.findFirst({
      where: eq(featureFlags.key, flagKey),
    });

    if (!flag) {
      throw new Error("Feature flag not found");
    }

    const [updatedFlag] = await db
      .update(featureFlags)
      .set({
        isEnabled: enabled,
        updatedBy: adminId,
        updatedAt: new Date(),
      })
      .where(eq(featureFlags.key, flagKey))
      .returning();

    // Log the action
    await adminAuditService.logAction({
      adminId,
      action: "feature_flag_toggled",
      description: `${enabled ? "Enabled" : "Disabled"} feature flag: ${flagKey}`,
      targetType: "feature_flag",
      targetId: flag.id,
      previousState: { isEnabled: flag.isEnabled },
      newState: { isEnabled: enabled },
      ipAddress: context?.ipAddress,
      userAgent: context?.userAgent,
    });

    return updatedFlag;
  },

  /**
   * Create a new feature flag
   */
  async createFeatureFlag(
    adminId: string,
    data: {
      key: string;
      name: string;
      description?: string;
      isEnabled?: boolean;
      targetRules?: Record<string, unknown>;
    }
  ) {
    const [flag] = await db
      .insert(featureFlags)
      .values({
        key: data.key,
        name: data.name,
        description: data.description,
        isEnabled: data.isEnabled ?? false,
        targetRules: data.targetRules,
        createdBy: adminId,
        updatedBy: adminId,
      })
      .returning();

    return flag;
  },
};

export type AdminService = typeof adminService;
