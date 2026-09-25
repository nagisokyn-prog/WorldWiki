-- ==============================================================================
-- 04_INDEXES.SURQL — ИНДЕКСЫ ИИ-ТАБЛИЦ И ВЕБ-МОДУЛЕЙ (ULTRA EDITION)
-- ==============================================================================
-- Включает:
-- 1. B-Tree индексы внешних ключей и уникальности для ИИ-сущностей
-- 2. BM25 полнотекстовые индексы для поиска по сообщениям, навыкам и веб-кэшу
-- ==============================================================================

-- 1. РЕЖИМЫ И РОЛИ ИИ
DEFINE INDEX OVERWRITE idx_aimode_project ON ai_modes FIELDS project_id;
DEFINE INDEX OVERWRITE idx_aimode_slug    ON ai_modes FIELDS slug;

-- 2. СООБЩЕНИЯ ЧАТА
DEFINE INDEX OVERWRITE idx_chat_msg_content_bm25 ON chat_messages COLUMNS content FULLTEXT ANALYZER ru_en_analyzer BM25;
DEFINE INDEX OVERWRITE idx_chat_msg_created_at   ON chat_messages FIELDS created_at;
DEFINE INDEX OVERWRITE idx_chat_msg_chat_id      ON chat_messages FIELDS chat_id, created_at;

-- 3. НАВЫКИ И ИНСТРУКЦИИ
DEFINE INDEX OVERWRITE idx_skills_project    ON ai_skills FIELDS project_id;
DEFINE INDEX OVERWRITE idx_skills_name_ft   ON ai_skills COLUMNS name FULLTEXT ANALYZER ru_en_analyzer BM25;
DEFINE INDEX OVERWRITE idx_skills_desc_ft   ON ai_skills COLUMNS description FULLTEXT ANALYZER ru_en_analyzer BM25;
DEFINE INDEX OVERWRITE idx_skills_prompt_ft ON ai_skills COLUMNS prompt_text FULLTEXT ANALYZER ru_en_analyzer BM25;

-- 4. ПОЛЬЗОВАТЕЛЬСКИЙ СЛОВАРЬ ЛОРА
DEFINE INDEX OVERWRITE idx_dict_word ON user_dictionary FIELDS project_id, word;

-- 5. ВЕБ-СТРАНИЦЫ И КЭШ
DEFINE INDEX OVERWRITE idx_web_pages_canonical ON web_pages FIELDS canonical_url UNIQUE;
DEFINE INDEX OVERWRITE idx_web_pages_hash      ON web_pages FIELDS content_hash;
DEFINE INDEX OVERWRITE idx_web_pages_domain    ON web_pages FIELDS domain;
DEFINE INDEX OVERWRITE idx_web_pages_md_bm25   ON web_pages COLUMNS extracted_markdown FULLTEXT ANALYZER ru_en_analyzer BM25;

-- 6. ВЕБ-ДОКАЗАТЕЛЬСТВА
DEFINE INDEX OVERWRITE idx_evidence_page      ON web_evidence FIELDS page_id;
DEFINE INDEX OVERWRITE idx_evidence_text_bm25 ON web_evidence COLUMNS text FULLTEXT ANALYZER ru_en_analyzer BM25;

-- 7. ЧАНКИ ЛОРА ДЛЯ RAG
DEFINE INDEX OVERWRITE idx_chunk_project      ON entity_chunks FIELDS project_id;
DEFINE INDEX OVERWRITE idx_chunk_entity       ON entity_chunks FIELDS entity_id;
DEFINE INDEX OVERWRITE idx_chunk_chapter      ON entity_chunks FIELDS chapter_id;
DEFINE INDEX OVERWRITE idx_chunk_content_bm25 ON entity_chunks COLUMNS content FULLTEXT ANALYZER ru_en_analyzer BM25;
