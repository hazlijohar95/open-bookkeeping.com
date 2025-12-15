/**
 * Memory Cleanup Service
 * Handles cleanup of expired and unused agent memories
 * This service can be called by a worker, cron job, or API endpoint
 */

import { eq, and, lte, lt, isNull, or } from "drizzle-orm";
import { db } from "@open-bookkeeping/db";
import { agentMemories, agentSessions, agentAuditLogs } from "@open-bookkeeping/db";
import { createLogger } from "@open-bookkeeping/shared";

const logger = createLogger("memory-cleanup-service");

// Cleanup configuration
const DEFAULT_CONFIG = {
  // Memory expiration settings
  expiredMemoryCleanup: true, // Clean memories past expiresAt
  unusedMemoryDays: 180, // Clean memories not used in X days
  lowConfidenceThreshold: 0.3, // Clean memories with confidence below this
  lowConfidenceAgeDays: 90, // Only clean low confidence if older than X days

  // Session cleanup settings
  inactiveSessionDays: 30, // Archive sessions inactive for X days
  archivedSessionRetentionDays: 365, // Delete archived sessions after X days

  // Audit log cleanup (separate from user audit logs)
  agentAuditLogRetentionDays: 365, // Keep agent audit logs for 1 year

  // Batch sizes for performance
  batchSize: 500,
};

export type CleanupConfig = typeof DEFAULT_CONFIG;

export interface CleanupResult {
  expiredMemories: number;
  unusedMemories: number;
  lowConfidenceMemories: number;
  archivedSessions: number;
  deletedSessions: number;
  deletedAuditLogs: number;
  totalCleaned: number;
  duration: number;
  errors: string[];
}

export const memoryCleanupService = {
  /**
   * Run full cleanup with configurable options
   */
  runCleanup: async (config: Partial<CleanupConfig> = {}): Promise<CleanupResult> => {
    const startTime = Date.now();
    const cfg = { ...DEFAULT_CONFIG, ...config };
    const errors: string[] = [];

    const result: CleanupResult = {
      expiredMemories: 0,
      unusedMemories: 0,
      lowConfidenceMemories: 0,
      archivedSessions: 0,
      deletedSessions: 0,
      deletedAuditLogs: 0,
      totalCleaned: 0,
      duration: 0,
      errors: [],
    };

    logger.info({ config: cfg }, "Starting memory cleanup");

    // 1. Clean expired memories
    if (cfg.expiredMemoryCleanup) {
      try {
        const count = await memoryCleanupService.cleanExpiredMemories();
        result.expiredMemories = count;
        result.totalCleaned += count;
      } catch (error) {
        const msg = `Failed to clean expired memories: ${error}`;
        errors.push(msg);
        logger.error({ error }, msg);
      }
    }

    // 2. Clean unused memories
    try {
      const count = await memoryCleanupService.cleanUnusedMemories(cfg.unusedMemoryDays);
      result.unusedMemories = count;
      result.totalCleaned += count;
    } catch (error) {
      const msg = `Failed to clean unused memories: ${error}`;
      errors.push(msg);
      logger.error({ error }, msg);
    }

    // 3. Clean low confidence memories
    try {
      const count = await memoryCleanupService.cleanLowConfidenceMemories(
        cfg.lowConfidenceThreshold,
        cfg.lowConfidenceAgeDays
      );
      result.lowConfidenceMemories = count;
      result.totalCleaned += count;
    } catch (error) {
      const msg = `Failed to clean low confidence memories: ${error}`;
      errors.push(msg);
      logger.error({ error }, msg);
    }

    // 4. Archive inactive sessions
    try {
      const count = await memoryCleanupService.archiveInactiveSessions(cfg.inactiveSessionDays);
      result.archivedSessions = count;
    } catch (error) {
      const msg = `Failed to archive inactive sessions: ${error}`;
      errors.push(msg);
      logger.error({ error }, msg);
    }

    // 5. Delete old archived sessions
    try {
      const count = await memoryCleanupService.deleteArchivedSessions(cfg.archivedSessionRetentionDays);
      result.deletedSessions = count;
      result.totalCleaned += count;
    } catch (error) {
      const msg = `Failed to delete archived sessions: ${error}`;
      errors.push(msg);
      logger.error({ error }, msg);
    }

    // 6. Clean old agent audit logs
    try {
      const count = await memoryCleanupService.cleanOldAgentAuditLogs(cfg.agentAuditLogRetentionDays);
      result.deletedAuditLogs = count;
      result.totalCleaned += count;
    } catch (error) {
      const msg = `Failed to clean audit logs: ${error}`;
      errors.push(msg);
      logger.error({ error }, msg);
    }

    result.duration = Date.now() - startTime;
    result.errors = errors;

    logger.info(
      {
        result,
        durationMs: result.duration,
      },
      "Memory cleanup completed"
    );

    return result;
  },

  /**
   * Clean memories that have passed their expiration date
   */
  cleanExpiredMemories: async (): Promise<number> => {
    const now = new Date();

    const deleted = await db
      .delete(agentMemories)
      .where(
        and(
          lte(agentMemories.expiresAt, now),
          // Only delete if expiresAt is not null
          // (null means no expiration)
        )
      );

    const count = (deleted as unknown as { rowCount?: number }).rowCount ?? 0;

    if (count > 0) {
      logger.info({ count }, "Cleaned expired memories");
    }

    return count;
  },

  /**
   * Clean memories that haven't been used in a long time
   */
  cleanUnusedMemories: async (daysThreshold: number): Promise<number> => {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysThreshold);

    // Only delete memories that either:
    // - Have lastUsedAt set and it's older than threshold
    // - Have never been used (lastUsedAt is null) and were created before threshold
    const deleted = await db
      .delete(agentMemories)
      .where(
        or(
          // Never used and old
          and(
            isNull(agentMemories.lastUsedAt),
            lte(agentMemories.createdAt, cutoffDate)
          ),
          // Used but not recently
          lte(agentMemories.lastUsedAt, cutoffDate)
        )
      );

    const count = (deleted as unknown as { rowCount?: number }).rowCount ?? 0;

    if (count > 0) {
      logger.info({ count, daysThreshold }, "Cleaned unused memories");
    }

    return count;
  },

  /**
   * Clean memories with low confidence scores that are old
   * Keeps recent low-confidence memories to give them a chance to be validated
   */
  cleanLowConfidenceMemories: async (
    confidenceThreshold: number,
    minAgeDays: number
  ): Promise<number> => {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - minAgeDays);

    const deleted = await db
      .delete(agentMemories)
      .where(
        and(
          lt(agentMemories.confidence, String(confidenceThreshold)),
          lte(agentMemories.createdAt, cutoffDate)
        )
      );

    const count = (deleted as unknown as { rowCount?: number }).rowCount ?? 0;

    if (count > 0) {
      logger.info({ count, confidenceThreshold, minAgeDays }, "Cleaned low confidence memories");
    }

    return count;
  },

  /**
   * Archive sessions that have been inactive
   */
  archiveInactiveSessions: async (inactiveDays: number): Promise<number> => {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - inactiveDays);

    const updated = await db
      .update(agentSessions)
      .set({ status: "archived" })
      .where(
        and(
          eq(agentSessions.status, "active"),
          lte(agentSessions.updatedAt, cutoffDate)
        )
      );

    const count = (updated as unknown as { rowCount?: number }).rowCount ?? 0;

    if (count > 0) {
      logger.info({ count, inactiveDays }, "Archived inactive sessions");
    }

    return count;
  },

  /**
   * Delete archived sessions that are past retention
   */
  deleteArchivedSessions: async (retentionDays: number): Promise<number> => {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    const deleted = await db
      .delete(agentSessions)
      .where(
        and(
          eq(agentSessions.status, "archived"),
          lte(agentSessions.createdAt, cutoffDate)
        )
      );

    const count = (deleted as unknown as { rowCount?: number }).rowCount ?? 0;

    if (count > 0) {
      logger.info({ count, retentionDays }, "Deleted old archived sessions");
    }

    return count;
  },

  /**
   * Clean old agent audit logs
   */
  cleanOldAgentAuditLogs: async (retentionDays: number): Promise<number> => {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    const deleted = await db
      .delete(agentAuditLogs)
      .where(lte(agentAuditLogs.createdAt, cutoffDate));

    const count = (deleted as unknown as { rowCount?: number }).rowCount ?? 0;

    if (count > 0) {
      logger.info({ count, retentionDays }, "Cleaned old agent audit logs");
    }

    return count;
  },

  /**
   * Get cleanup statistics for monitoring
   */
  getStats: async () => {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Count memories by status
    const memories = await db.query.agentMemories.findMany({
      columns: {
        isActive: true,
        expiresAt: true,
        lastUsedAt: true,
        confidence: true,
        createdAt: true,
      },
    });

    const stats = {
      totalMemories: memories.length,
      activeMemories: memories.filter((m) => m.isActive).length,
      expiredMemories: memories.filter((m) => m.expiresAt && m.expiresAt <= now).length,
      unusedMemories: memories.filter(
        (m) => !m.lastUsedAt || m.lastUsedAt <= thirtyDaysAgo
      ).length,
      lowConfidenceMemories: memories.filter(
        (m) => m.confidence && parseFloat(m.confidence) < 0.3
      ).length,
      recentMemories: memories.filter((m) => m.createdAt >= thirtyDaysAgo).length,
    };

    // Count sessions by status
    const sessions = await db.query.agentSessions.findMany({
      columns: {
        status: true,
      },
    });

    const sessionStats = {
      totalSessions: sessions.length,
      activeSessions: sessions.filter((s) => s.status === "active").length,
      completedSessions: sessions.filter((s) => s.status === "completed").length,
      archivedSessions: sessions.filter((s) => s.status === "archived").length,
    };

    return {
      memories: stats,
      sessions: sessionStats,
    };
  },

  /**
   * Deactivate (soft delete) memories for a specific user
   * Useful for user-initiated cleanup
   */
  deactivateUserMemories: async (
    userId: string,
    options?: { category?: string; olderThan?: Date }
  ): Promise<number> => {
    const conditions = [eq(agentMemories.userId, userId)];

    if (options?.category) {
      conditions.push(eq(agentMemories.category, options.category));
    }

    if (options?.olderThan) {
      conditions.push(lte(agentMemories.createdAt, options.olderThan));
    }

    const updated = await db
      .update(agentMemories)
      .set({ isActive: false, updatedAt: new Date() })
      .where(and(...conditions));

    const count = (updated as unknown as { rowCount?: number }).rowCount ?? 0;

    if (count > 0) {
      logger.info({ userId, count, options }, "Deactivated user memories");
    }

    return count;
  },

  /**
   * Permanently delete deactivated memories for a user
   * Called after user confirms deletion
   */
  purgeDeactivatedMemories: async (userId: string): Promise<number> => {
    const deleted = await db
      .delete(agentMemories)
      .where(
        and(eq(agentMemories.userId, userId), eq(agentMemories.isActive, false))
      );

    const count = (deleted as unknown as { rowCount?: number }).rowCount ?? 0;

    if (count > 0) {
      logger.info({ userId, count }, "Purged deactivated memories");
    }

    return count;
  },
};
