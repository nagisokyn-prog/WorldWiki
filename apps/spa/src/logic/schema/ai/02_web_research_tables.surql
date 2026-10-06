-- ==============================================================================
-- 02_WEB_RESEARCH_TABLES.SURQL — ТАБЛИЦЫ ВЕБ-ИССЛЕДОВАНИЙ (ULTRA EDITION)
-- ==============================================================================
-- Включает:
-- 1. web_pages (Глобальный кэш веб-страниц)
-- 2. web_evidence (Перманентная база фактов и веб-доказательств)
-- 3. research_sessions (Сессии поисковых исследований)
-- ==============================================================================

-- 1. ГЛОБАЛЬНЫЙ КЭШ ВЕБ-СТРАНИЦ (WEB CACHE)
DEFINE TABLE OVERWRITE web_pages SCHEMAFULL;
DEFINE FIELD OVERWRITE url                 ON web_pages TYPE string;
DEFINE FIELD OVERWRITE canonical_url       ON web_pages TYPE string;
DEFINE FIELD OVERWRITE domain              ON web_pages TYPE string;
DEFINE FIELD OVERWRITE title               ON web_pages TYPE option<string | null>;
DEFINE FIELD OVERWRITE content_type        ON web_pages TYPE string DEFAULT "text/html";
DEFINE FIELD OVERWRITE charset             ON web_pages TYPE string DEFAULT "utf-8";
DEFINE FIELD OVERWRITE language            ON web_pages TYPE option<string | null>;
DEFINE FIELD OVERWRITE content_hash        ON web_pages TYPE string;
DEFINE FIELD OVERWRITE content             ON web_pages TYPE string;
DEFINE FIELD OVERWRITE extracted_markdown  ON web_pages TYPE option<string | null>;
DEFINE FIELD OVERWRITE status_code         ON web_pages TYPE int DEFAULT 200;
DEFINE FIELD OVERWRITE hit_count           ON web_pages TYPE int DEFAULT 1;
DEFINE FIELD OVERWRITE fetched_at          ON web_pages TYPE datetime DEFAULT time::now();
DEFINE FIELD OVERWRITE expires_at          ON web_pages TYPE option<datetime | null> DEFAULT (time::now() + 14d);

-- 2. ВЕЧНЫЕ ВЕБ-ДОКАЗАТЕЛЬСТВА (WEB EVIDENCE)
DEFINE TABLE OVERWRITE web_evidence SCHEMAFULL;
DEFINE FIELD OVERWRITE page_id             ON web_evidence TYPE record<web_pages>;
DEFINE FIELD OVERWRITE project_id          ON web_evidence TYPE option<record<projects> | null>;
DEFINE FIELD OVERWRITE chunk_index         ON web_evidence TYPE int;
DEFINE FIELD OVERWRITE text                ON web_evidence TYPE string;
DEFINE FIELD OVERWRITE start_offset        ON web_evidence TYPE int;
DEFINE FIELD OVERWRITE end_offset          ON web_evidence TYPE int;
DEFINE FIELD OVERWRITE simhash             ON web_evidence TYPE option<string | null>;
DEFINE FIELD OVERWRITE embeddings          ON web_evidence TYPE object FLEXIBLE DEFAULT {};
DEFINE FIELD OVERWRITE metadata            ON web_evidence TYPE object FLEXIBLE DEFAULT {};
DEFINE FIELD OVERWRITE created_at          ON web_evidence TYPE datetime DEFAULT time::now();

-- 3. СЕССИИ ПОИСКОВЫХ ИССЛЕДОВАНИЙ
DEFINE TABLE OVERWRITE research_sessions SCHEMAFULL;
DEFINE FIELD OVERWRITE project_id          ON research_sessions TYPE record<projects>;
DEFINE FIELD OVERWRITE conversation_id     ON research_sessions TYPE record<chats>;
DEFINE FIELD OVERWRITE user_message_id     ON research_sessions TYPE record<chat_messages>;
DEFINE FIELD OVERWRITE mode                ON research_sessions TYPE string; -- 'direct' | 'research' | 'deep_research'
DEFINE FIELD OVERWRITE status              ON research_sessions TYPE string; -- 'planning' | 'searching' | 'reading' | 'synthesizing' | 'verifying' | 'completed' | 'failed'
DEFINE FIELD OVERWRITE objective           ON research_sessions TYPE string;
DEFINE FIELD OVERWRITE plan                ON research_sessions TYPE array<string> DEFAULT [];
DEFINE FIELD OVERWRITE events              ON research_sessions TYPE array<object> FLEXIBLE DEFAULT [];
DEFINE FIELD OVERWRITE claims              ON research_sessions TYPE array<object> FLEXIBLE DEFAULT [];
DEFINE FIELD OVERWRITE used_page_ids       ON research_sessions TYPE array<record<web_pages>> DEFAULT [];
DEFINE FIELD OVERWRITE used_evidence_ids   ON research_sessions TYPE array<record<web_evidence>> DEFAULT [];
DEFINE FIELD OVERWRITE search_count        ON research_sessions TYPE int DEFAULT 0;
DEFINE FIELD OVERWRITE page_count          ON research_sessions TYPE int DEFAULT 0;
DEFINE FIELD OVERWRITE created_at          ON research_sessions TYPE datetime DEFAULT time::now();
DEFINE FIELD OVERWRITE finished_at         ON research_sessions TYPE option<datetime | null>;
