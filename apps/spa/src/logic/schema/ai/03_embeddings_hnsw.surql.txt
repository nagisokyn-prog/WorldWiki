-- ==============================================================================
-- 03_EMBEDDINGS_HNSW.SURQL — ВЕКТОРНЫЕ ИНДЕКСЫ И ЧАНКИ (ULTRA EDITION)
-- ==============================================================================
-- Включает:
-- 1. entity_chunks (Чанки лора и энциклопедии для RAG-поиска)
-- 2. Векторные HNSW индексы для OpenAI (1536d), Nemotron (2048d),
--    Primary/Web (768d), Local (1024d) по всем сущностям системы.
-- ==============================================================================

-- 1. ЧАНКИ ЛОРА И ЭНЦИКЛОПЕДИИ
DEFINE TABLE OVERWRITE entity_chunks SCHEMAFULL;
DEFINE FIELD OVERWRITE project_id          ON entity_chunks TYPE record<projects>;
DEFINE FIELD OVERWRITE chapter_id          ON entity_chunks TYPE option<record<chapters> | null>;
DEFINE FIELD OVERWRITE entity_id           ON entity_chunks TYPE option<record<entities> | null>;
DEFINE FIELD OVERWRITE title               ON entity_chunks TYPE string;
DEFINE FIELD OVERWRITE content             ON entity_chunks TYPE string;
DEFINE FIELD OVERWRITE chunk_index         ON entity_chunks TYPE int DEFAULT 0;
DEFINE FIELD OVERWRITE embedding_nemotron  ON entity_chunks TYPE option<array<float> | null>;
DEFINE FIELD OVERWRITE embedding_nomic     ON entity_chunks TYPE option<array<float> | null>;
DEFINE FIELD OVERWRITE embedding_openai    ON entity_chunks TYPE option<array<float> | null>;
DEFINE FIELD OVERWRITE created_at          ON entity_chunks TYPE datetime DEFAULT time::now();

-- 2. HNSW ВЕКТОРНЫЕ ИНДЕКСЫ

-- Чанки (Entity Chunks)
DEFINE INDEX OVERWRITE idx_chunk_emb_nemotron ON entity_chunks COLUMNS embedding_nemotron HNSW DIMENSION 2048 DIST COSINE;

-- Главы (Chapters)
DEFINE INDEX OVERWRITE idx_chapter_emb_openai   ON chapters COLUMNS embeddings.openai HNSW DIMENSION 1536 DIST COSINE;
DEFINE INDEX OVERWRITE idx_chapter_emb_nemotron ON chapters COLUMNS embeddings.nemotron HNSW DIMENSION 2048 DIST COSINE;

-- Блоки текста (Text Blocks)
DEFINE INDEX OVERWRITE idx_textblock_emb_openai   ON text_blocks COLUMNS embeddings.openai HNSW DIMENSION 1536 DIST COSINE;
DEFINE INDEX OVERWRITE idx_textblock_emb_nemotron ON text_blocks COLUMNS embeddings.nemotron HNSW DIMENSION 2048 DIST COSINE;

-- Сущности (Entities)
DEFINE INDEX OVERWRITE idx_entity_emb_openai   ON entities COLUMNS embeddings.openai HNSW DIMENSION 1536 DIST COSINE;
DEFINE INDEX OVERWRITE idx_entity_emb_local    ON entities COLUMNS embeddings.local HNSW DIMENSION 1024 DIST COSINE;
DEFINE INDEX OVERWRITE idx_entity_emb_nemotron ON entities COLUMNS embeddings.nemotron HNSW DIMENSION 2048 DIST COSINE;

-- Сообщения чата (Chat Messages)
DEFINE INDEX OVERWRITE idx_chat_msg_emb_primary ON chat_messages COLUMNS embeddings.primary HNSW DIMENSION 768 DIST COSINE;
DEFINE INDEX OVERWRITE idx_chat_msg_emb_openai  ON chat_messages COLUMNS embeddings.openai HNSW DIMENSION 1536 DIST COSINE;

-- Память агента (Agent Memory)
DEFINE INDEX OVERWRITE idx_memory_emb_openai ON agent_memory COLUMNS embeddings.openai HNSW DIMENSION 1536 DIST COSINE;

-- Навыки ИИ (AI Skills)
DEFINE INDEX OVERWRITE idx_skills_emb_openai ON ai_skills COLUMNS embeddings.openai HNSW DIMENSION 1536 DIST COSINE;
DEFINE INDEX OVERWRITE idx_skills_emb_local  ON ai_skills COLUMNS embeddings.local HNSW DIMENSION 1024 DIST COSINE;

-- Веб-доказательства (Web Evidence)
DEFINE INDEX OVERWRITE idx_evidence_emb_primary ON web_evidence COLUMNS embeddings.primary HNSW DIMENSION 768 DIST COSINE;
