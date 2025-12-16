import {
  pgTable,
  uuid,
  text,
  timestamp,
  boolean,
  varchar,
  index,
  unique,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { users } from "./users";
import { orgRoleEnum, subscriptionPlanEnum, subscriptionStatusEnum } from "./enums";

// ============================================
// ORGANIZATIONS
// ============================================

/**
 * Organizations represent business entities that can have multiple users.
 * Each organization has its own subscription, customers, invoices, etc.
 */
export const organizations = pgTable(
  "organizations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    slug: varchar("slug", { length: 100 }).unique().notNull(), // URL-friendly identifier
    logoUrl: text("logo_url"),

    // Business details
    email: text("email"),
    phone: varchar("phone", { length: 20 }),
    address: text("address"),
    city: varchar("city", { length: 100 }),
    state: varchar("state", { length: 100 }),
    postalCode: varchar("postal_code", { length: 20 }),
    country: varchar("country", { length: 2 }).default("MY"), // ISO 3166-1 alpha-2

    // Tax info (Malaysian business)
    registrationNumber: varchar("registration_number", { length: 50 }), // SSM number
    taxId: varchar("tax_id", { length: 50 }), // TIN number
    sstNumber: varchar("sst_number", { length: 50 }), // SST registration

    // Subscription & Billing (Stripe)
    stripeCustomerId: varchar("stripe_customer_id", { length: 100 }),
    stripeSubscriptionId: varchar("stripe_subscription_id", { length: 100 }),
    subscriptionPlan: subscriptionPlanEnum("subscription_plan").default("trial").notNull(),
    subscriptionStatus: subscriptionStatusEnum("subscription_status").default("active").notNull(),

    // Trial tracking
    trialStartedAt: timestamp("trial_started_at").defaultNow(),
    trialEndsAt: timestamp("trial_ends_at"),

    // Subscription period
    currentPeriodStart: timestamp("current_period_start"),
    currentPeriodEnd: timestamp("current_period_end"),

    // Status
    isActive: boolean("is_active").default(true).notNull(),
    suspendedAt: timestamp("suspended_at"),
    suspendedReason: text("suspended_reason"),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("organizations_slug_idx").on(table.slug),
    index("organizations_stripe_customer_idx").on(table.stripeCustomerId),
    index("organizations_subscription_status_idx").on(table.subscriptionStatus),
    index("organizations_is_active_idx").on(table.isActive),
  ]
);

// ============================================
// ORGANIZATION MEMBERS
// ============================================

/**
 * Junction table linking users to organizations with roles.
 * A user can belong to multiple organizations with different roles.
 */
export const organizationMembers = pgTable(
  "organization_members",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .references(() => organizations.id, { onDelete: "cascade" })
      .notNull(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    role: orgRoleEnum("role").default("member").notNull(),

    // Invitation tracking
    invitedBy: uuid("invited_by").references(() => users.id),
    invitedAt: timestamp("invited_at"),
    acceptedAt: timestamp("accepted_at"),

    // Status
    isActive: boolean("is_active").default(true).notNull(),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    // Ensure a user can only be in an org once
    unique("organization_members_unique").on(table.organizationId, table.userId),
    index("organization_members_org_idx").on(table.organizationId),
    index("organization_members_user_idx").on(table.userId),
    index("organization_members_role_idx").on(table.role),
  ]
);

// ============================================
// ORGANIZATION INVITATIONS
// ============================================

/**
 * Pending invitations to join an organization.
 */
export const organizationInvitations = pgTable(
  "organization_invitations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .references(() => organizations.id, { onDelete: "cascade" })
      .notNull(),
    email: text("email").notNull(),
    role: orgRoleEnum("role").default("member").notNull(),
    token: varchar("token", { length: 64 }).unique().notNull(),

    invitedBy: uuid("invited_by")
      .references(() => users.id)
      .notNull(),

    expiresAt: timestamp("expires_at").notNull(),
    acceptedAt: timestamp("accepted_at"),

    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("organization_invitations_org_idx").on(table.organizationId),
    index("organization_invitations_email_idx").on(table.email),
    index("organization_invitations_token_idx").on(table.token),
  ]
);

// ============================================
// RELATIONS
// ============================================

export const organizationsRelations = relations(organizations, ({ many }) => ({
  members: many(organizationMembers),
  invitations: many(organizationInvitations),
}));

export const organizationMembersRelations = relations(
  organizationMembers,
  ({ one }) => ({
    organization: one(organizations, {
      fields: [organizationMembers.organizationId],
      references: [organizations.id],
    }),
    user: one(users, {
      fields: [organizationMembers.userId],
      references: [users.id],
    }),
    inviter: one(users, {
      fields: [organizationMembers.invitedBy],
      references: [users.id],
    }),
  })
);

export const organizationInvitationsRelations = relations(
  organizationInvitations,
  ({ one }) => ({
    organization: one(organizations, {
      fields: [organizationInvitations.organizationId],
      references: [organizations.id],
    }),
    inviter: one(users, {
      fields: [organizationInvitations.invitedBy],
      references: [users.id],
    }),
  })
);

// ============================================
// TYPES
// ============================================

export type Organization = typeof organizations.$inferSelect;
export type NewOrganization = typeof organizations.$inferInsert;
export type OrganizationMember = typeof organizationMembers.$inferSelect;
export type NewOrganizationMember = typeof organizationMembers.$inferInsert;
export type OrganizationInvitation = typeof organizationInvitations.$inferSelect;
export type NewOrganizationInvitation = typeof organizationInvitations.$inferInsert;
