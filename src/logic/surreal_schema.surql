-- ===============================================
-- БАЗОВЫЕ СУЩНОСТИ ПРОЕКТА
-- ===============================================

DEFINE ANALYZER OVERWRITE like TOKENIZERS blank, class, camel FILTERS ascii, lowercase;

DEFINE TABLE OVERWRITE projects SCHEMAFULL;
DEFINE FIELD OVERWRITE name ON projects TYPE string;
DEFINE FIELD OVERWRITE created_at ON projects TYPE option<datetime> DEFAULT time::now();
DEFINE FIELD OVERWRITE data ON projects TYPE object FLEXIBLE DEFAULT {};
DEFINE FIELD OVERWRITE type ON projects TYPE option<string>;
DEFINE FIELD OVERWRITE genres ON projects TYPE option<array<string>>;
DEFINE FIELD OVERWRITE perfLevel ON projects TYPE option<string>;
DEFINE FIELD OVERWRITE calendar ON projects;

DEFINE TABLE OVERWRITE volumes SCHEMAFULL;
DEFINE FIELD OVERWRITE title ON volumes TYPE string;
DEFINE FIELD OVERWRITE project_id ON volumes TYPE record<projects> | string;
DEFINE FIELD OVERWRITE sort_order ON volumes TYPE int DEFAULT 0;

DEFINE TABLE OVERWRITE arcs SCHEMAFULL;
DEFINE FIELD OVERWRITE title ON arcs TYPE string;
DEFINE FIELD OVERWRITE project_id ON arcs TYPE record<projects> | string;
DEFINE FIELD OVERWRITE volumeId ON arcs TYPE option<record<volumes> | string>;
DEFINE FIELD OVERWRITE sort_order ON arcs TYPE int DEFAULT 0;

DEFINE TABLE OVERWRITE tags SCHEMAFULL;
DEFINE FIELD OVERWRITE name ON tags TYPE string;
DEFINE FIELD OVERWRITE color ON tags TYPE string;
DEFINE FIELD OVERWRITE project_id ON tags TYPE record<projects> | string;

DEFINE TABLE OVERWRITE calendars SCHEMAFULL;
DEFINE FIELD OVERWRITE name ON calendars TYPE string;
DEFINE FIELD OVERWRITE description ON calendars TYPE option<string>;
DEFINE FIELD OVERWRITE data ON calendars TYPE object FLEXIBLE;
DEFINE FIELD OVERWRITE is_default ON calendars TYPE bool DEFAULT false;
DEFINE FIELD OVERWRITE project_id ON calendars TYPE record<projects> | string;

DEFINE TABLE OVERWRITE dynamic_entities SCHEMAFULL;
DEFINE FIELD OVERWRITE project_id ON dynamic_entities TYPE record<projects> | string;
DEFINE FIELD OVERWRITE schema_type ON dynamic_entities TYPE string;
DEFINE FIELD OVERWRITE data ON dynamic_entities TYPE object FLEXIBLE;

-- ===============================================
-- МЕТА: Типы сущностей (определяет пользователь)
-- ===============================================
DEFINE TABLE OVERWRITE entity_schemas SCHEMAFULL;
DEFINE FIELD OVERWRITE project_id   ON entity_schemas TYPE record<projects> | string;
DEFINE FIELD OVERWRITE type_key     ON entity_schemas TYPE string;  -- "character", "location", "faction"
DEFINE FIELD OVERWRITE type_name    ON entity_schemas TYPE string;  -- "Персонаж", "Локация"
DEFINE FIELD OVERWRITE icon         ON entity_schemas TYPE string;  -- "👤", "🗺️"
DEFINE FIELD OVERWRITE color        ON entity_schemas TYPE string;  -- "#FF6B6B"
DEFINE FIELD OVERWRITE fields_schema ON entity_schemas TYPE array<object>; -- [{key, label, type, required}]
DEFINE FIELD OVERWRITE created_at   ON entity_schemas TYPE datetime DEFAULT time::now();

DEFINE INDEX OVERWRITE idx_schema_type ON entity_schemas FIELDS project_id, type_key UNIQUE;

-- ===============================================
-- СУЩНОСТИ (универсальная таблица)
-- ===============================================
DEFINE TABLE OVERWRITE entities SCHEMAFULL;
DEFINE FIELD OVERWRITE project_id   ON entities TYPE record<projects> | string;
DEFINE FIELD OVERWRITE entity_type  ON entities TYPE string;       -- ключ из entity_schemas
DEFINE FIELD OVERWRITE name         ON entities TYPE string;       -- главное имя (для поиска)
DEFINE FIELD OVERWRITE description  ON entities TYPE option<string>;
DEFINE FIELD OVERWRITE attributes   ON entities TYPE object FLEXIBLE;       -- все доп. поля (flexible)
DEFINE FIELD OVERWRITE tags         ON entities TYPE array<record<tags>> DEFAULT [];
DEFINE FIELD OVERWRITE embedding    ON entities TYPE option<array<float>>; -- AI: 1536d
DEFINE FIELD OVERWRITE created_at   ON entities TYPE option<datetime> DEFAULT time::now();
DEFINE FIELD OVERWRITE updated_at   ON entities TYPE option<datetime> DEFAULT time::now();

-- Индексы
DEFINE INDEX OVERWRITE idx_entity_project ON entities COLUMNS project_id;
DEFINE INDEX OVERWRITE idx_entity_type    ON entities COLUMNS project_id, entity_type;
DEFINE INDEX OVERWRITE idx_entity_name_ft ON entities COLUMNS name FULLTEXT;
DEFINE INDEX OVERWRITE idx_entity_desc_ft ON entities COLUMNS description FULLTEXT;
DEFINE INDEX OVERWRITE idx_entity_emb     ON entities COLUMNS embedding HNSW DIMENSION 1536 DIST COSINE;

-- ===============================================
-- ТИПЫ ГРАФ-РЁБЕР (определяет пользователь)
-- ===============================================
DEFINE TABLE OVERWRITE relation_schemas SCHEMAFULL;
DEFINE FIELD OVERWRITE project_id   ON relation_schemas TYPE record<projects> | string;
DEFINE FIELD OVERWRITE rel_key      ON relation_schemas TYPE string;  -- "knows", "lives_in"
DEFINE FIELD OVERWRITE rel_name     ON relation_schemas TYPE string;  -- "Знает", "Живёт в"
DEFINE FIELD OVERWRITE icon         ON relation_schemas TYPE string;
DEFINE FIELD OVERWRITE color        ON relation_schemas TYPE string;
DEFINE FIELD OVERWRITE directed     ON relation_schemas TYPE bool DEFAULT true;
DEFINE FIELD OVERWRITE from_types   ON relation_schemas TYPE array<string>; -- допустимые типы source
DEFINE FIELD OVERWRITE to_types     ON relation_schemas TYPE array<string>; -- допустимые типы target

-- ===============================================
-- ГРАФ-РЁБРА: Связи между сущностями
-- ===============================================
DEFINE TABLE OVERWRITE entity_rel TYPE RELATION IN entities OUT entities SCHEMAFULL;
DEFINE FIELD OVERWRITE project_id   ON entity_rel TYPE record<projects> | string;
DEFINE FIELD OVERWRITE rel_type     ON entity_rel TYPE string;       -- ключ из relation_schemas
DEFINE FIELD OVERWRITE description  ON entity_rel TYPE option<string>;
DEFINE FIELD OVERWRITE strength     ON entity_rel TYPE option<int>;  -- 1-10
DEFINE FIELD OVERWRITE attributes   ON entity_rel TYPE object;       -- доп. данные связи
DEFINE FIELD OVERWRITE start_chapter ON entity_rel TYPE option<record<chapters> | string>;
DEFINE FIELD OVERWRITE end_chapter  ON entity_rel TYPE option<record<chapters> | string>;
DEFINE FIELD OVERWRITE created_at   ON entity_rel TYPE datetime DEFAULT time::now();

DEFINE INDEX OVERWRITE idx_rel_project ON entity_rel FIELDS project_id;
DEFINE INDEX OVERWRITE idx_rel_type    ON entity_rel FIELDS rel_type;

-- ===============================================
-- СВЯЗИ: Сущность ↔ Глава (появление в главе)
-- ===============================================
DEFINE TABLE OVERWRITE appears_in TYPE RELATION IN entities OUT chapters SCHEMAFULL;
DEFINE FIELD OVERWRITE project_id ON appears_in TYPE record<projects> | string;
DEFINE FIELD OVERWRITE role       ON appears_in TYPE option<string>; -- "главный", "упоминание"
DEFINE FIELD OVERWRITE notes      ON appears_in TYPE option<string>;

-- ===============================================
-- ГЛАВЫ (расширенная версия)
-- ===============================================
DEFINE TABLE OVERWRITE chapters SCHEMAFULL;
DEFINE FIELD OVERWRITE project_id  ON chapters TYPE record<projects> | string;
DEFINE FIELD OVERWRITE title       ON chapters TYPE string;
DEFINE FIELD OVERWRITE content     ON chapters TYPE string;
DEFINE FIELD OVERWRITE summary     ON chapters TYPE option<string>;   -- AI: краткое содержание
DEFINE FIELD OVERWRITE arc_id      ON chapters TYPE option<record<arcs> | string>;
DEFINE FIELD OVERWRITE volume_id   ON chapters TYPE option<record<volumes> | string>;
DEFINE FIELD OVERWRITE word_count  ON chapters TYPE int DEFAULT 0;
DEFINE FIELD OVERWRITE sort_order  ON chapters TYPE int DEFAULT 0;
DEFINE FIELD OVERWRITE embedding   ON chapters TYPE option<array<float>>; -- AI: 1536d
DEFINE FIELD OVERWRITE created_at  ON chapters TYPE option<datetime> DEFAULT time::now();
DEFINE FIELD OVERWRITE updated_at  ON chapters TYPE option<datetime> DEFAULT time::now();

-- Flexible fields for chapters
DEFINE FIELD OVERWRITE footnotes        ON chapters TYPE object FLEXIBLE DEFAULT {};
DEFINE FIELD OVERWRITE timeline_events   ON chapters TYPE array DEFAULT [];
DEFINE FIELD OVERWRITE timeline_events[*] ON chapters TYPE object FLEXIBLE;
DEFINE FIELD OVERWRITE timeline_events[*].date ON chapters TYPE object FLEXIBLE;
DEFINE FIELD OVERWRITE timeline_events[*].time ON chapters TYPE object FLEXIBLE;
DEFINE FIELD OVERWRITE timeline_events[*].description ON chapters TYPE string;
DEFINE FIELD OVERWRITE timeline_events[*].calendar_id ON chapters TYPE option<string>;
DEFINE FIELD OVERWRITE participants     ON chapters TYPE array DEFAULT [];
DEFINE FIELD OVERWRITE participants[*]  ON chapters TYPE string;

DEFINE INDEX OVERWRITE idx_chapter_ft  ON chapters COLUMNS content FULLTEXT;
DEFINE INDEX OVERWRITE idx_chapter_emb ON chapters COLUMNS embedding HNSW DIMENSION 1536 DIST COSINE;

-- ===============================================
-- ПЛАНЫ (с правильными Record-ссылками)
-- ===============================================
DEFINE TABLE OVERWRITE plans SCHEMAFULL;
DEFINE FIELD OVERWRITE project_id  ON plans TYPE record<projects> | string;
DEFINE FIELD OVERWRITE title       ON plans TYPE string;
DEFINE FIELD OVERWRITE parent_ref  ON plans TYPE record<chapters | arcs | volumes | plans> | string;
DEFINE FIELD OVERWRITE parent_type ON plans TYPE string;             -- "chapter"|"arc"|"volume"
DEFINE FIELD OVERWRITE sort_order  ON plans TYPE int DEFAULT 0;
DEFINE FIELD OVERWRITE completed   ON plans TYPE bool DEFAULT false;
DEFINE FIELD OVERWRITE created_at  ON plans TYPE datetime DEFAULT time::now();
DEFINE FIELD OVERWRITE updated_at  ON plans TYPE datetime DEFAULT time::now();

-- ===============================================
-- AI: Блоки текста (Семантический чанкинг: мысли, диалоги, описание)
-- ===============================================
DEFINE TABLE OVERWRITE text_blocks SCHEMAFULL;
DEFINE FIELD OVERWRITE project_id  ON text_blocks TYPE record<projects> | string;
DEFINE FIELD OVERWRITE chapter_id  ON text_blocks TYPE record<chapters> | string;
DEFINE FIELD OVERWRITE block_type  ON text_blocks TYPE string; -- "thought", "dialogue", "description"
DEFINE FIELD OVERWRITE order_index ON text_blocks TYPE int;
DEFINE FIELD OVERWRITE content     ON text_blocks TYPE string;
DEFINE FIELD OVERWRITE embedding   ON text_blocks TYPE option<array<float>>;

DEFINE INDEX OVERWRITE idx_blocks_ft  ON text_blocks COLUMNS content FULLTEXT;
DEFINE INDEX OVERWRITE idx_blocks_emb ON text_blocks COLUMNS embedding HNSW DIMENSION 1536 DIST COSINE;

-- ===============================================
-- AI: Древовидный Чат (С ветвлением и цитированием)
-- ===============================================
DEFINE TABLE OVERWRITE chat_messages SCHEMAFULL;
DEFINE FIELD OVERWRITE project_id    ON chat_messages TYPE record<projects> | string;
DEFINE FIELD OVERWRITE role          ON chat_messages TYPE string; -- "user", "assistant"
DEFINE FIELD OVERWRITE content       ON chat_messages TYPE string;
DEFINE FIELD OVERWRITE parent_msg_id ON chat_messages TYPE option<record<chat_messages> | string>;
DEFINE FIELD OVERWRITE version       ON chat_messages TYPE int DEFAULT 0;
DEFINE FIELD OVERWRITE quoted_context ON chat_messages TYPE option<object>; -- На что ссылается

-- Механизм RLHF (исправление ошибок модели юзером)
DEFINE FIELD OVERWRITE edited_content   ON chat_messages TYPE option<string>;
DEFINE FIELD OVERWRITE feedback_comment ON chat_messages TYPE option<string>;
DEFINE FIELD OVERWRITE rag_was_bad      ON chat_messages TYPE bool DEFAULT false;

DEFINE FIELD OVERWRITE embedding     ON chat_messages TYPE option<array<float>>;
DEFINE FIELD OVERWRITE created_at    ON chat_messages TYPE datetime DEFAULT time::now();

-- ===============================================
-- AI: Динамический словарь
-- ===============================================
DEFINE TABLE OVERWRITE user_dictionary SCHEMAFULL;
DEFINE FIELD OVERWRITE project_id   ON user_dictionary TYPE record<projects> | string;
DEFINE FIELD OVERWRITE word         ON user_dictionary TYPE string;
DEFINE FIELD OVERWRITE definition   ON user_dictionary TYPE option<string>;
DEFINE FIELD OVERWRITE is_approved  ON user_dictionary TYPE bool DEFAULT true;
DEFINE FIELD OVERWRITE confidence   ON user_dictionary TYPE float;

DEFINE INDEX OVERWRITE idx_dict_word ON user_dictionary FIELDS project_id, word UNIQUE;

-- ===============================================
-- AI: Кэш интернета
-- ===============================================
DEFINE TABLE OVERWRITE web_cache SCHEMAFULL;
DEFINE FIELD OVERWRITE project_id   ON web_cache TYPE record<projects> | string;
DEFINE FIELD OVERWRITE url          ON web_cache TYPE string;
DEFINE FIELD OVERWRITE source_type  ON web_cache TYPE string;
DEFINE FIELD OVERWRITE content      ON web_cache TYPE string;
DEFINE FIELD OVERWRITE embedding    ON web_cache TYPE option<array<float>>;
DEFINE FIELD OVERWRITE fetched_at   ON web_cache TYPE datetime DEFAULT time::now();
DEFINE FIELD OVERWRITE expires_at   ON web_cache TYPE option<datetime>;

-- ===============================================
-- AI: Межчатовая память и сжатый контекст
-- ===============================================
DEFINE TABLE OVERWRITE agent_memory SCHEMAFULL;
DEFINE FIELD OVERWRITE project_id   ON agent_memory TYPE record<projects> | string;
DEFINE FIELD OVERWRITE memory_type  ON agent_memory TYPE string; -- "summary", "preference", "fact"
DEFINE FIELD OVERWRITE content      ON agent_memory TYPE string;
DEFINE FIELD OVERWRITE embedding    ON agent_memory TYPE option<array<float>>;
DEFINE FIELD OVERWRITE importance   ON agent_memory TYPE int DEFAULT 5;
DEFINE FIELD OVERWRITE created_at   ON agent_memory TYPE datetime DEFAULT time::now();

DEFINE INDEX OVERWRITE idx_memory_emb ON agent_memory FIELDS embedding HNSW DIMENSION 1536 DIST COSINE;
