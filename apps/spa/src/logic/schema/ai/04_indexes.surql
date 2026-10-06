-- ==============================================================================
-- 04_INDEXES.SURQL — ИНДЕКСЫ ИИ-ТАБЛИЦ И ВЕБ-МОДУЛЕЙ (ULTRA EDITION)
-- ==============================================================================
-- Включает:
-- 1. B-Tree индексы внешних ключей и уникальности для ИИ-сущностей
-- 2. BM25 полнотекстовые индексы для поиска по сообщениям, навыкам и веб-кэшу
-- ==============================================================================

-- 1. НАСТРОЙКИ АВТО-ОДОБРЕНИЙ
DEFINE INDEX OVERWRITE idx_auto_approval_project ON auto_approval_settings FIELDS project_id;

-- 2. РЕЖИМЫ И РОЛИ ИИ
DEFINE INDEX OVERWRITE idx_aimode_project ON ai_modes FIELDS project_id;
DEFINE INDEX OVERWRITE idx_aimode_slug    ON ai_modes FIELDS slug;

-- 3. ДЕРЕВО ЧАТОВ
DEFINE INDEX OVERWRITE idx_chats_project    ON chats FIELDS project_id;
DEFINE INDEX OVERWRITE idx_chats_created_at ON chats FIELDS created_at;

-- 4. СООБЩЕНИЯ ЧАТА
DEFINE INDEX OVERWRITE idx_chat_msg_project      ON chat_messages FIELDS project_id;
DEFINE INDEX OVERWRITE idx_chat_msg_parent       ON chat_messages FIELDS parent_id;
DEFINE INDEX OVERWRITE idx_chat_msg_content_bm25 ON chat_messages FIELDS content FULLTEXT ANALYZER ru_en_analyzer BM25 HIGHLIGHTS;
DEFINE INDEX OVERWRITE idx_chat_msg_created_at   ON chat_messages FIELDS created_at;
DEFINE INDEX OVERWRITE idx_chat_msg_chat_id      ON chat_messages FIELDS chat_id, created_at;

-- 5. ОПЕРАТИВНАЯ ПАМЯТЬ АГЕНТА
DEFINE INDEX OVERWRITE idx_agent_mem_project ON agent_memory FIELDS project_id;

-- 6. ПРОФИЛИ ИИ
DEFINE INDEX OVERWRITE idx_ai_profiles_project ON ai_profiles FIELDS project_id;

-- 7. АРТЕФАКТЫ ИИ
DEFINE INDEX OVERWRITE idx_artifacts_project ON artifacts FIELDS project_id;
DEFINE INDEX OVERWRITE idx_artifacts_chat    ON artifacts FIELDS chat_id;

-- 8. НАВЫКИ И ИНСТРУКЦИИ
DEFINE INDEX OVERWRITE idx_skills_project    ON ai_skills FIELDS project_id;
DEFINE INDEX OVERWRITE idx_skills_name_ft   ON ai_skills FIELDS name FULLTEXT ANALYZER ru_en_analyzer BM25 HIGHLIGHTS;
DEFINE INDEX OVERWRITE idx_skills_desc_ft   ON ai_skills FIELDS description FULLTEXT ANALYZER ru_en_analyzer BM25 HIGHLIGHTS;
DEFINE INDEX OVERWRITE idx_skills_prompt_ft ON ai_skills FIELDS prompt_text FULLTEXT ANALYZER ru_en_analyzer BM25 HIGHLIGHTS;

-- 9. ПОЛЬЗОВАТЕЛЬСКИЙ СЛОВАРЬ ЛОРА
DEFINE INDEX OVERWRITE idx_dict_project ON user_dictionary FIELDS project_id;
DEFINE INDEX OVERWRITE idx_dict_word    ON user_dictionary FIELDS project_id, word;

-- 10. ВЕБ-СТРАНИЦЫ И КЭШ
DEFINE INDEX OVERWRITE idx_web_pages_canonical ON web_pages FIELDS canonical_url UNIQUE;
DEFINE INDEX OVERWRITE idx_web_pages_hash      ON web_pages FIELDS content_hash;
DEFINE INDEX OVERWRITE idx_web_pages_domain    ON web_pages FIELDS domain;
DEFINE INDEX OVERWRITE idx_web_pages_md_bm25   ON web_pages FIELDS extracted_markdown FULLTEXT ANALYZER ru_en_analyzer BM25 HIGHLIGHTS;

-- 11. ВЕБ-ДОКАЗАТЕЛЬСТВА
DEFINE INDEX OVERWRITE idx_evidence_page      ON web_evidence FIELDS page_id;
DEFINE INDEX OVERWRITE idx_evidence_project   ON web_evidence FIELDS project_id;
DEFINE INDEX OVERWRITE idx_evidence_text_bm25 ON web_evidence FIELDS text FULLTEXT ANALYZER ru_en_analyzer BM25 HIGHLIGHTS;

-- 12. СЕССИИ ПОИСКОВЫХ ИССЛЕДОВАНИЙ
DEFINE INDEX OVERWRITE idx_research_project ON research_sessions FIELDS project_id;
DEFINE INDEX OVERWRITE idx_research_conv    ON research_sessions FIELDS conversation_id;
DEFINE INDEX OVERWRITE idx_research_user_msg ON research_sessions FIELDS user_message_id;

-- 13. ЧАНКИ ЛОРА ДЛЯ RAG
DEFINE INDEX OVERWRITE idx_chunk_project      ON entity_chunks FIELDS project_id;
DEFINE INDEX OVERWRITE idx_chunk_entity       ON entity_chunks FIELDS entity_id;
DEFINE INDEX OVERWRITE idx_chunk_chapter      ON entity_chunks FIELDS chapter_id;
DEFINE INDEX OVERWRITE idx_chunk_content_bm25 ON entity_chunks FIELDS content FULLTEXT ANALYZER ru_en_analyzer BM25 HIGHLIGHTS;


