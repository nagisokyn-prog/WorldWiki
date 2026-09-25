-- ==============================================================================
-- 01_WORKSPACE_TABLES.SURQL — ТАБЛИЦЫ И ПОЛЯ ИИ-ПРОСТРАНСТВА (ULTRA EDITION)
-- ==============================================================================
-- Включает:
-- 1. auto_approval_settings (Настройки авто-одобрений тулов)
-- 2. ai_modes (Режимы и роли ИИ)
-- 3. chats (Дерево диалогов)
-- 4. chat_messages (Сообщения диалогов)
-- 5. agent_memory (Оперативная память агента)
-- 6. ai_profiles (Ключи и провайдеры LLM)
-- 7. artifacts (Артефакты и генерации)
-- 8. ai_skills (Навыки и системные инструкции)
-- 9. user_dictionary (Словарь лора автора)
-- ==============================================================================

-- 1. НАСТРОЙКИ АВТО-ОДОБРЕНИЙ (AUTO-APPROVAL)
DEFINE TABLE OVERWRITE auto_approval_settings SCHEMAFULL;
DEFINE FIELD OVERWRITE project_id ON auto_approval_settings TYPE record<projects>;
DEFINE FIELD OVERWRITE enabled    ON auto_approval_settings TYPE bool DEFAULT true;
DEFINE FIELD OVERWRITE categories ON auto_approval_settings TYPE object FLEXIBLE DEFAULT { read: true, edit_entities: false, edit_content: false, edit_relations: false, analyze: true };
DEFINE FIELD OVERWRITE allowlist  ON auto_approval_settings TYPE object FLEXIBLE DEFAULT { entity_types: [], rel_types: [], paths: [] };
DEFINE FIELD OVERWRITE denylist   ON auto_approval_settings TYPE object FLEXIBLE DEFAULT { entity_types: [], rel_types: [], paths: [] };

-- 2. РЕЖИМЫ И РОЛИ ИИ (AI MODES)
DEFINE TABLE OVERWRITE ai_modes SCHEMAFULL;
DEFINE FIELD OVERWRITE project_id          ON ai_modes TYPE record<projects>;
DEFINE FIELD OVERWRITE slug                ON ai_modes TYPE string;
DEFINE FIELD OVERWRITE name                ON ai_modes TYPE string;
DEFINE FIELD OVERWRITE role_definition     ON ai_modes TYPE string;
DEFINE FIELD OVERWRITE custom_instructions ON ai_modes TYPE string;
DEFINE FIELD OVERWRITE api_profile_id      ON ai_modes TYPE option<string | null>;
DEFINE FIELD OVERWRITE allowed_tools       ON ai_modes TYPE array<string> DEFAULT [];
DEFINE FIELD OVERWRITE is_global           ON ai_modes TYPE bool DEFAULT false;

-- 3. ДЕРЕВО ЧАТОВ
DEFINE TABLE OVERWRITE chats SCHEMAFULL;
DEFINE FIELD OVERWRITE project_id      ON chats TYPE record<projects>;
DEFINE FIELD OVERWRITE title           ON chats TYPE string;
DEFINE FIELD OVERWRITE tag             ON chats TYPE option<string | null>;
DEFINE FIELD OVERWRITE session_context ON chats TYPE array<record> DEFAULT [];
DEFINE FIELD OVERWRITE created_at      ON chats TYPE datetime DEFAULT time::now();

-- 4. СООБЩЕНИЯ ЧАТА
DEFINE TABLE OVERWRITE chat_messages SCHEMAFULL;
DEFINE FIELD OVERWRITE project_id       ON chat_messages TYPE record<projects>;
DEFINE FIELD OVERWRITE chat_id          ON chat_messages TYPE record<chats>;
DEFINE FIELD OVERWRITE role             ON chat_messages TYPE string;
DEFINE FIELD OVERWRITE content          ON chat_messages TYPE string;
DEFINE FIELD OVERWRITE reasoning        ON chat_messages TYPE option<string | null>;
DEFINE FIELD OVERWRITE tool_logs        ON chat_messages TYPE option<array<string> | null>;
DEFINE FIELD OVERWRITE version          ON chat_messages TYPE int DEFAULT 0;
DEFINE FIELD OVERWRITE quoted_context   ON chat_messages TYPE option<object> FLEXIBLE;
DEFINE FIELD OVERWRITE citations        ON chat_messages TYPE array<object> FLEXIBLE DEFAULT [];
DEFINE FIELD OVERWRITE edited_content   ON chat_messages TYPE option<string | null>;
DEFINE FIELD OVERWRITE feedback_comment ON chat_messages TYPE option<string | null>;
DEFINE FIELD OVERWRITE rag_was_bad      ON chat_messages TYPE bool DEFAULT false;
DEFINE FIELD OVERWRITE embeddings       ON chat_messages TYPE object FLEXIBLE DEFAULT {};
DEFINE FIELD OVERWRITE parent_id        ON chat_messages TYPE option<record<chat_messages>>;
DEFINE FIELD OVERWRITE is_active        ON chat_messages TYPE bool DEFAULT true;
DEFINE FIELD OVERWRITE created_at       ON chat_messages TYPE datetime DEFAULT time::now();
DEFINE FIELD OVERWRITE updated_at       ON chat_messages TYPE datetime DEFAULT time::now();

-- 5. ОПЕРАТИВНАЯ ПАМЯТЬ АГЕНТА
DEFINE TABLE OVERWRITE agent_memory SCHEMAFULL;
DEFINE FIELD OVERWRITE project_id  ON agent_memory TYPE record<projects>;
DEFINE FIELD OVERWRITE memory_type ON agent_memory TYPE string;
DEFINE FIELD OVERWRITE content     ON agent_memory TYPE string;
DEFINE FIELD OVERWRITE embeddings  ON agent_memory TYPE object FLEXIBLE DEFAULT {};
DEFINE FIELD OVERWRITE importance  ON agent_memory TYPE int DEFAULT 5;
DEFINE FIELD OVERWRITE created_at  ON agent_memory TYPE datetime DEFAULT time::now();

-- 6. ПРОФИЛИ ИИ
DEFINE TABLE OVERWRITE ai_profiles SCHEMAFULL;
DEFINE FIELD OVERWRITE project_id  ON ai_profiles TYPE option<record<projects>>;
DEFINE FIELD OVERWRITE name        ON ai_profiles TYPE string;
DEFINE FIELD OVERWRITE provider    ON ai_profiles TYPE string; -- 'openai', 'anthropic', 'ollama', 'turboquant'
DEFINE FIELD OVERWRITE base_url    ON ai_profiles TYPE option<string>;
DEFINE FIELD OVERWRITE api_key     ON ai_profiles TYPE option<string>;
DEFINE FIELD OVERWRITE settings    ON ai_profiles TYPE object FLEXIBLE DEFAULT {};
DEFINE FIELD OVERWRITE is_active   ON ai_profiles TYPE bool DEFAULT false;
DEFINE FIELD OVERWRITE is_global   ON ai_profiles TYPE bool DEFAULT false;

-- 7. АРТЕФАКТЫ ИИ
DEFINE TABLE OVERWRITE artifacts SCHEMAFULL;
DEFINE FIELD OVERWRITE project_id  ON artifacts TYPE option<record<projects>>;
DEFINE FIELD OVERWRITE chat_id     ON artifacts TYPE option<record<chats>>;
DEFINE FIELD OVERWRITE type        ON artifacts TYPE string; -- 'document', 'code', 'table', 'graph'
DEFINE FIELD OVERWRITE title       ON artifacts TYPE string;
DEFINE FIELD OVERWRITE content     ON artifacts TYPE string;
DEFINE FIELD OVERWRITE version     ON artifacts TYPE int DEFAULT 1;
DEFINE FIELD OVERWRITE created_at  ON artifacts TYPE datetime DEFAULT time::now();

-- 8. НАВЫКИ И ИНСТРУКЦИИ (AI SKILLS)
DEFINE TABLE OVERWRITE ai_skills SCHEMAFULL;
DEFINE FIELD OVERWRITE project_id             ON ai_skills TYPE option<record<projects>>;
DEFINE FIELD OVERWRITE name                   ON ai_skills TYPE string;
DEFINE FIELD OVERWRITE description            ON ai_skills TYPE string;
DEFINE FIELD OVERWRITE prompt_text            ON ai_skills TYPE string;
DEFINE FIELD OVERWRITE triggers               ON ai_skills TYPE array<string> DEFAULT [];
DEFINE FIELD OVERWRITE is_auto_trigger        ON ai_skills TYPE bool DEFAULT true;
DEFINE FIELD OVERWRITE priority               ON ai_skills TYPE int DEFAULT 10;
DEFINE FIELD OVERWRITE is_builtin             ON ai_skills TYPE bool DEFAULT false;
DEFINE FIELD OVERWRITE file_path              ON ai_skills TYPE option<string>;
DEFINE FIELD OVERWRITE is_unlocked            ON ai_skills TYPE bool DEFAULT true;
DEFINE FIELD OVERWRITE is_custom_author_style ON ai_skills TYPE bool DEFAULT false;
DEFINE FIELD OVERWRITE embeddings             ON ai_skills TYPE object FLEXIBLE DEFAULT {};
DEFINE FIELD OVERWRITE created_at             ON ai_skills TYPE datetime DEFAULT time::now();

-- 9. ПОЛЬЗОВАТЕЛЬСКИЙ СЛОВАРЬ ЛОРА
DEFINE TABLE OVERWRITE user_dictionary SCHEMAFULL;
DEFINE FIELD OVERWRITE project_id  ON user_dictionary TYPE record<projects>;
DEFINE FIELD OVERWRITE word        ON user_dictionary TYPE string;
DEFINE FIELD OVERWRITE definition  ON user_dictionary TYPE option<string>;
DEFINE FIELD OVERWRITE is_approved ON user_dictionary TYPE bool DEFAULT true;
DEFINE FIELD OVERWRITE confidence  ON user_dictionary TYPE float DEFAULT 1.0;
