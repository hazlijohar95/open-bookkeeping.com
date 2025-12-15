import { openai } from "@ai-sdk/openai";
import { embed, embedMany } from "ai";
import { createLogger } from "@open-bookkeeping/shared";

const logger = createLogger("embedding-service");

// Use text-embedding-3-small for cost-effective embeddings (1536 dimensions)
const EMBEDDING_MODEL = openai.embedding("text-embedding-3-small");

/**
 * Generate embedding for a single text
 * @returns Array of 1536 floats or null if failed
 */
export async function generateEmbedding(text: string): Promise<number[] | null> {
  if (!text || text.trim().length === 0) {
    return null;
  }

  try {
    const { embedding } = await embed({
      model: EMBEDDING_MODEL,
      value: text,
    });

    return embedding;
  } catch (error) {
    logger.error({ error, textLength: text.length }, "Failed to generate embedding");
    return null;
  }
}

/**
 * Generate embeddings for multiple texts in batch
 * More efficient for bulk operations
 * @returns Array of embeddings (1536 floats each) or null for failed items
 */
export async function generateEmbeddings(
  texts: string[]
): Promise<(number[] | null)[]> {
  if (!texts || texts.length === 0) {
    return [];
  }

  // Filter out empty texts, keeping track of original indices
  const validTexts: { index: number; text: string }[] = [];
  texts.forEach((text, index) => {
    if (text && text.trim().length > 0) {
      validTexts.push({ index, text: text.trim() });
    }
  });

  if (validTexts.length === 0) {
    return texts.map(() => null);
  }

  try {
    const { embeddings } = await embedMany({
      model: EMBEDDING_MODEL,
      values: validTexts.map((v) => v.text),
    });

    // Map results back to original indices
    const results: (number[] | null)[] = texts.map(() => null);
    validTexts.forEach((item, resultIndex) => {
      results[item.index] = embeddings[resultIndex] ?? null;
    });

    return results;
  } catch (error) {
    logger.error({ error, count: texts.length }, "Failed to generate batch embeddings");
    return texts.map(() => null);
  }
}

/**
 * Create a searchable text from memory content
 * Combines key and value for better semantic matching
 */
export function createMemorySearchText(key: string, value: string): string {
  return `${key}: ${value}`.trim();
}

/**
 * Format embedding array for PostgreSQL vector type
 * @returns String in format '[0.1,0.2,...]'
 */
export function formatEmbeddingForPg(embedding: number[]): string {
  return `[${embedding.join(",")}]`;
}

export const embeddingService = {
  generateEmbedding,
  generateEmbeddings,
  createMemorySearchText,
  formatEmbeddingForPg,
};
