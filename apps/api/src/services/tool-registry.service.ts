/**
 * Tool Registry Service
 *
 * Centralized registry for AI agent tools with versioning,
 * deprecation tracking, and schema validation.
 *
 * Features:
 * - Tool versioning (semver)
 * - Deprecation notices
 * - Schema validation
 * - Usage tracking
 * - Breaking change detection
 */

import { createLogger } from "@open-bookkeeping/shared";
import { z } from "zod";

const logger = createLogger("tool-registry-service");

// ============================================
// TYPES
// ============================================

export type ToolCategory =
  | "read" // Read-only data access
  | "write" // Creates/modifies data
  | "analysis" // Computes/analyzes
  | "memory" // Memory operations
  | "reasoning"; // Planning/thinking

export type ToolStatus = "active" | "deprecated" | "beta" | "retired";

export interface ToolVersion {
  major: number;
  minor: number;
  patch: number;
}

export interface ToolMetadata {
  // Identity
  name: string;
  version: ToolVersion;
  versionString: string;

  // Classification
  category: ToolCategory;
  status: ToolStatus;

  // Documentation
  description: string;
  examples?: string[];
  deprecationNotice?: string;
  replacedBy?: string;

  // Schema
  inputSchema: z.ZodType;
  outputSchema?: z.ZodType;

  // Safety
  requiresApproval: boolean;
  riskLevel: "low" | "medium" | "high";
  financialImpact: boolean;

  // Tracking
  addedAt: Date;
  lastModifiedAt: Date;
  usageCount: number;
  errorCount: number;
}

export interface ToolRegistryEntry extends ToolMetadata {
  execute: (args: unknown) => Promise<unknown>;
}

// ============================================
// TOOL REGISTRY
// ============================================

class ToolRegistry {
  private tools: Map<string, ToolRegistryEntry> = new Map();
  private versionHistory: Map<string, ToolVersion[]> = new Map();

  /**
   * Register a new tool or update an existing one
   */
  register(tool: ToolRegistryEntry): void {
    const existingTool = this.tools.get(tool.name);

    if (existingTool) {
      // Check for breaking changes
      const breakingChanges = this.detectBreakingChanges(existingTool, tool);
      if (breakingChanges.length > 0 && tool.version.major <= existingTool.version.major) {
        logger.warn(
          { tool: tool.name, changes: breakingChanges },
          "Breaking changes detected without major version bump"
        );
      }

      // Track version history
      const history = this.versionHistory.get(tool.name) ?? [];
      history.push(existingTool.version);
      this.versionHistory.set(tool.name, history);
    }

    this.tools.set(tool.name, {
      ...tool,
      versionString: this.formatVersion(tool.version),
      lastModifiedAt: new Date(),
      usageCount: existingTool?.usageCount ?? 0,
      errorCount: existingTool?.errorCount ?? 0,
    });

    logger.info(
      { tool: tool.name, version: this.formatVersion(tool.version), status: tool.status },
      "Tool registered"
    );
  }

  /**
   * Get a tool by name
   */
  get(name: string): ToolRegistryEntry | undefined {
    const tool = this.tools.get(name);

    if (tool?.status === "deprecated") {
      logger.warn(
        { tool: name, replacedBy: tool.replacedBy },
        `Tool "${name}" is deprecated${tool.replacedBy ? `. Use "${tool.replacedBy}" instead.` : ""}`
      );
    }

    if (tool?.status === "retired") {
      logger.error({ tool: name }, `Tool "${name}" is retired and should not be used`);
      return undefined;
    }

    return tool;
  }

  /**
   * Execute a tool with tracking
   */
  async execute(name: string, args: unknown): Promise<unknown> {
    const tool = this.get(name);

    if (!tool) {
      throw new Error(`Tool "${name}" not found in registry`);
    }

    // Validate input
    const validation = tool.inputSchema.safeParse(args);
    if (!validation.success) {
      throw new Error(`Invalid input for tool "${name}": ${validation.error.message}`);
    }

    try {
      const result = await tool.execute(validation.data);

      // Track usage
      tool.usageCount++;

      // Validate output if schema provided
      if (tool.outputSchema) {
        const outputValidation = tool.outputSchema.safeParse(result);
        if (!outputValidation.success) {
          logger.warn(
            { tool: name, error: outputValidation.error.message },
            "Tool output failed schema validation"
          );
        }
      }

      return result;
    } catch (error) {
      tool.errorCount++;
      throw error;
    }
  }

  /**
   * Get all tools
   */
  getAll(): ToolRegistryEntry[] {
    return Array.from(this.tools.values());
  }

  /**
   * Get tools by category
   */
  getByCategory(category: ToolCategory): ToolRegistryEntry[] {
    return Array.from(this.tools.values()).filter((t) => t.category === category);
  }

  /**
   * Get active tools only
   */
  getActive(): ToolRegistryEntry[] {
    return Array.from(this.tools.values()).filter((t) => t.status === "active" || t.status === "beta");
  }

  /**
   * Get deprecated tools
   */
  getDeprecated(): ToolRegistryEntry[] {
    return Array.from(this.tools.values()).filter((t) => t.status === "deprecated");
  }

  /**
   * Get tool version history
   */
  getVersionHistory(name: string): ToolVersion[] {
    return this.versionHistory.get(name) ?? [];
  }

  /**
   * Get registry statistics
   */
  getStats(): {
    totalTools: number;
    byCategory: Record<ToolCategory, number>;
    byStatus: Record<ToolStatus, number>;
    totalUsage: number;
    totalErrors: number;
    errorRate: number;
  } {
    const tools = Array.from(this.tools.values());

    const byCategory: Record<ToolCategory, number> = {
      read: 0,
      write: 0,
      analysis: 0,
      memory: 0,
      reasoning: 0,
    };

    const byStatus: Record<ToolStatus, number> = {
      active: 0,
      deprecated: 0,
      beta: 0,
      retired: 0,
    };

    let totalUsage = 0;
    let totalErrors = 0;

    for (const tool of tools) {
      byCategory[tool.category]++;
      byStatus[tool.status]++;
      totalUsage += tool.usageCount;
      totalErrors += tool.errorCount;
    }

    return {
      totalTools: tools.length,
      byCategory,
      byStatus,
      totalUsage,
      totalErrors,
      errorRate: totalUsage > 0 ? (totalErrors / totalUsage) * 100 : 0,
    };
  }

  /**
   * Deprecate a tool
   */
  deprecate(name: string, replacedBy?: string, notice?: string): void {
    const tool = this.tools.get(name);
    if (tool) {
      tool.status = "deprecated";
      tool.replacedBy = replacedBy;
      tool.deprecationNotice = notice ?? `This tool is deprecated${replacedBy ? `. Use "${replacedBy}" instead.` : ""}`;
      tool.lastModifiedAt = new Date();

      logger.info({ tool: name, replacedBy }, "Tool deprecated");
    }
  }

  /**
   * Retire a tool (completely remove from use)
   */
  retire(name: string): void {
    const tool = this.tools.get(name);
    if (tool) {
      tool.status = "retired";
      tool.lastModifiedAt = new Date();

      logger.info({ tool: name }, "Tool retired");
    }
  }

  // ============================================
  // PRIVATE HELPERS
  // ============================================

  private formatVersion(version: ToolVersion): string {
    return `${version.major}.${version.minor}.${version.patch}`;
  }

  private detectBreakingChanges(
    oldTool: ToolRegistryEntry,
    newTool: ToolRegistryEntry
  ): string[] {
    const changes: string[] = [];

    // Check if required fields were added (breaking for callers)
    // This is a simplified check - in production, you'd do deep schema comparison
    try {
      const oldShape = (oldTool.inputSchema as z.ZodObject<z.ZodRawShape>).shape;
      const newShape = (newTool.inputSchema as z.ZodObject<z.ZodRawShape>).shape;

      if (oldShape && newShape) {
        for (const [key, schema] of Object.entries(newShape)) {
          if (!(key in oldShape)) {
            // Check if new field is required
            if (!schema.isOptional()) {
              changes.push(`Added required field: ${key}`);
            }
          }
        }

        // Check for removed fields
        for (const key of Object.keys(oldShape)) {
          if (!(key in newShape)) {
            changes.push(`Removed field: ${key}`);
          }
        }
      }
    } catch {
      // Schema comparison failed, skip
    }

    return changes;
  }
}

// ============================================
// SINGLETON INSTANCE
// ============================================

export const toolRegistry = new ToolRegistry();

// ============================================
// TOOL REGISTRATION HELPER
// ============================================

export interface ToolDefinition<TInput, TOutput> {
  name: string;
  version: ToolVersion;
  category: ToolCategory;
  status?: ToolStatus;
  description: string;
  examples?: string[];
  inputSchema: z.ZodType<TInput>;
  outputSchema?: z.ZodType<TOutput>;
  requiresApproval?: boolean;
  riskLevel?: "low" | "medium" | "high";
  financialImpact?: boolean;
  execute: (args: TInput) => Promise<TOutput>;
}

/**
 * Helper to create and register a tool with proper typing
 */
export function createTool<TInput, TOutput>(
  definition: ToolDefinition<TInput, TOutput>
): ToolRegistryEntry {
  const entry: ToolRegistryEntry = {
    name: definition.name,
    version: definition.version,
    versionString: `${definition.version.major}.${definition.version.minor}.${definition.version.patch}`,
    category: definition.category,
    status: definition.status ?? "active",
    description: definition.description,
    examples: definition.examples,
    inputSchema: definition.inputSchema,
    outputSchema: definition.outputSchema,
    requiresApproval: definition.requiresApproval ?? false,
    riskLevel: definition.riskLevel ?? "low",
    financialImpact: definition.financialImpact ?? false,
    addedAt: new Date(),
    lastModifiedAt: new Date(),
    usageCount: 0,
    errorCount: 0,
    execute: definition.execute as (args: unknown) => Promise<unknown>,
  };

  toolRegistry.register(entry);

  return entry;
}

// ============================================
// TOOL MANIFEST (for documentation/discovery)
// ============================================

export interface ToolManifest {
  version: string;
  generatedAt: Date;
  tools: Array<{
    name: string;
    version: string;
    category: ToolCategory;
    status: ToolStatus;
    description: string;
    inputSchema: string;
    requiresApproval: boolean;
    riskLevel: string;
    deprecated?: {
      notice: string;
      replacedBy?: string;
    };
  }>;
}

/**
 * Generate a tool manifest for documentation
 */
export function generateToolManifest(): ToolManifest {
  const tools = toolRegistry.getAll();

  return {
    version: "1.0.0",
    generatedAt: new Date(),
    tools: tools.map((tool) => ({
      name: tool.name,
      version: tool.versionString,
      category: tool.category,
      status: tool.status,
      description: tool.description,
      inputSchema: JSON.stringify(tool.inputSchema, null, 2),
      requiresApproval: tool.requiresApproval,
      riskLevel: tool.riskLevel,
      deprecated:
        tool.status === "deprecated"
          ? {
              notice: tool.deprecationNotice ?? "This tool is deprecated",
              replacedBy: tool.replacedBy,
            }
          : undefined,
    })),
  };
}

// ============================================
// EXPORTS
// ============================================

export const toolRegistryService = {
  registry: toolRegistry,
  createTool,
  generateToolManifest,
};
