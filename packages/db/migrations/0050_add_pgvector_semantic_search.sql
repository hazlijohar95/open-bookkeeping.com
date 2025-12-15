-- Migration: Add pgvector for semantic memory search
-- This enables AI agent to find relevant memories using meaning, not just keywords

-- Enable pgvector extension (Supabase has this pre-installed)
CREATE EXTENSION IF NOT EXISTS vector;

-- Add vector column for embeddings (1536 dimensions for OpenAI text-embedding-3-small)
ALTER TABLE agent_memories
ADD COLUMN IF NOT EXISTS embedding_vector vector(1536);

-- Create HNSW index for fast approximate nearest neighbor search
-- HNSW is faster for queries, IVFFlat is faster for inserts
CREATE INDEX IF NOT EXISTS agent_memories_embedding_hnsw_idx
ON agent_memories
USING hnsw (embedding_vector vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- Create a function for semantic search
CREATE OR REPLACE FUNCTION search_memories_semantic(
  p_user_id UUID,
  p_query_embedding vector(1536),
  p_match_threshold FLOAT DEFAULT 0.7,
  p_match_count INT DEFAULT 10
)
RETURNS TABLE (
  id UUID,
  category VARCHAR,
  key VARCHAR,
  value TEXT,
  confidence NUMERIC,
  source_type VARCHAR,
  similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    am.id,
    am.category,
    am.key,
    am.value,
    am.confidence,
    am.source_type,
    1 - (am.embedding_vector <=> p_query_embedding) AS similarity
  FROM agent_memories am
  WHERE am.user_id = p_user_id
    AND am.is_active = true
    AND (am.expires_at IS NULL OR am.expires_at > NOW())
    AND am.embedding_vector IS NOT NULL
    AND 1 - (am.embedding_vector <=> p_query_embedding) > p_match_threshold
  ORDER BY am.embedding_vector <=> p_query_embedding
  LIMIT p_match_count;
END;
$$;

-- Create a function to find similar memories (for deduplication)
CREATE OR REPLACE FUNCTION find_similar_memories(
  p_user_id UUID,
  p_embedding vector(1536),
  p_threshold FLOAT DEFAULT 0.95
)
RETURNS TABLE (
  id UUID,
  key VARCHAR,
  similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    am.id,
    am.key,
    1 - (am.embedding_vector <=> p_embedding) AS similarity
  FROM agent_memories am
  WHERE am.user_id = p_user_id
    AND am.is_active = true
    AND am.embedding_vector IS NOT NULL
    AND 1 - (am.embedding_vector <=> p_embedding) > p_threshold
  ORDER BY am.embedding_vector <=> p_embedding
  LIMIT 5;
END;
$$;

-- Add comment for documentation
COMMENT ON COLUMN agent_memories.embedding_vector IS 'Vector embedding for semantic search (OpenAI text-embedding-3-small, 1536 dimensions)';
