-- HNSW index for cosine similarity search on retrieval_units embeddings.
-- CONCURRENTLY avoids long write locks, so this migration must not run
-- inside an explicit transaction block.
--
-- NOTE: pgvector 0.8.0 (current Neon version as of 2026-03-25) limits
-- HNSW and IVFFlat indexes to 2000 dimensions. Our embeddings are
-- 3072-dim (Gemini Embedding 2). This migration will FAIL on pgvector
-- < 0.9.0. At small scale (<10K rows) brute-force scan is fast enough.
-- Re-run this migration after Neon upgrades pgvector.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_retrieval_units_embedding_hnsw
ON retrieval_units
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 200);
