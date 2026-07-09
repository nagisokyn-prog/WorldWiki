-- ===============================================
-- БАЗОВЫЕ СУЩНОСТИ ПРОЕКТА
-- ===============================================

DEFINE ANALYZER OVERWRITE like TOKENIZERS blank, class, camel FILTERS ascii, lowercase;

DEFINE TABLE OVERWRITE projects SCHEMAFULL;
DEFINE FIELD OVERWRITE name        ON projects TYPE string;
DEFINE FIELD OVERWRITE created_at  ON projects TYPE option<datetime> DEFAULT time::now();
DEFINE FIELD OVERWRITE data        ON projects TYPE object FLEXIBLE DEFAULT {};
DEFINE FIELD OVERWRITE type        ON projects TYPE option<string>;
DEFINE FIELD OVERWRITE genres      ON projects TYPE option<array<string>>;
DEFINE FIELD OVERWRITE perfLevel   ON projects TYPE option<string>;
DEFINE FIELD OVERWRITE calendar    ON projects TYPE option<object> FLEXIBLE;

DEFINE TABLE OVERWRITE volumes SCHEMAFULL;
DEFINE FIELD OVERWRITE title      ON volumes TYPE string;
DEFINE FIELD OVERWRITE project_id ON volumes TYPE record<projects> | string;
DEFINE FIELD OVERWRITE sort_order ON volumes TYPE int DEFAULT 0;

DEFINE EVENT OVERWRITE cascade_volume_delete ON TABLE volumes WHEN $event = "DELETE" THEN {
    DELETE arcs WHERE volumeId = $before.id OR volumeId = type::string($before.id);
    DELETE chapters WHERE volume_id = $before.id OR volume_id = type::string($before.id);
    DELETE plans WHERE parent_ref = $before.id OR parent_ref = type::string($before.id);
};

DEFINE TABLE OVERWRITE arcs SCHEMAFULL;
DEFINE FIELD OVERWRITE title      ON arcs TYPE string;
DEFINE FIELD OVERWRITE project_id ON arcs TYPE record<projects> | string;
DEFINE FIELD OVERWRITE volumeId   ON arcs TYPE option<record<volumes> | string>;
DEFINE FIELD OVERWRITE sort_order ON arcs TYPE int DEFAULT 0;

DEFINE EVENT OVERWRITE cascade_arc_delete ON TABLE arcs WHEN $event = "DELETE" THEN {
    DELETE chapters WHERE arc_id = $before.id OR arc_id = type::string($before.id);
    DELETE plans WHERE parent_ref = $before.id OR parent_ref = type::string($before.id);
};

DEFINE TABLE OVERWRITE tags SCHEMAFULL;
DEFINE FIELD OVERWRITE name       ON tags TYPE string;
DEFINE FIELD OVERWRITE color      ON tags TYPE string;
DEFINE FIELD OVERWRITE project_id ON tags TYPE record<projects> | string;

DEFINE TABLE OVERWRITE calendars SCHEMAFULL;
DEFINE FIELD OVERWRITE name        ON calendars TYPE string;
DEFINE FIELD OVERWRITE description ON calendars TYPE option<string>;
DEFINE FIELD OVERWRITE data        ON calendars TYPE object FLEXIBLE DEFAULT {};
DEFINE FIELD OVERWRITE is_default  ON calendars TYPE bool DEFAULT false;
DEFINE FIELD OVERWRITE project_id  ON calendars TYPE record<projects> | string;

DEFINE TABLE OVERWRITE dynamic_entities SCHEMAFULL;
DEFINE FIELD OVERWRITE project_id  ON dynamic_entities TYPE record<projects> | string;
DEFINE FIELD OVERWRITE schema_type ON dynamic_entities TYPE string;
DEFINE FIELD OVERWRITE data        ON dynamic_entities TYPE object FLEXIBLE DEFAULT {};

-- ===============================================
-- МЕТА: Типы сущностей (определяет пользователь)
-- ===============================================
DEFINE TABLE OVERWRITE entity_schemas SCHEMAFULL;
DEFINE FIELD OVERWRITE project_id    ON entity_schemas TYPE record<projects> | string;
DEFINE FIELD OVERWRITE type_key      ON entity_schemas TYPE string;
DEFINE FIELD OVERWRITE type_name     ON entity_schemas TYPE string;
DEFINE FIELD OVERWRITE icon          ON entity_schemas TYPE string;
DEFINE FIELD OVERWRITE color         ON entity_schemas TYPE string;
DEFINE FIELD OVERWRITE fields_schema ON entity_schemas TYPE array<object> FLEXIBLE DEFAULT [];
DEFINE FIELD OVERWRITE full_schema   ON entity_schemas TYPE option<object> FLEXIBLE;
DEFINE FIELD OVERWRITE created_at    ON entity_schemas TYPE datetime DEFAULT time::now();

DEFINE INDEX OVERWRITE idx_schema_type ON entity_schemas FIELDS project_id, type_key UNIQUE;

-- ===============================================
-- ИСТОРИЯ СХЕМ
-- ===============================================
DEFINE TABLE OVERWRITE schema_history SCHEMAFULL;
DEFINE FIELD OVERWRITE schema_id  ON schema_history TYPE record<entity_schemas> | string;
DEFINE FIELD OVERWRITE type_key   ON schema_history TYPE string;
DEFINE FIELD OVERWRITE project_id ON schema_history TYPE record<projects> | string;
DEFINE FIELD OVERWRITE snapshot   ON schema_history TYPE object FLEXIBLE DEFAULT {};
DEFINE FIELD OVERWRITE saved_at   ON schema_history TYPE string;
DEFINE FIELD OVERWRITE is_pinned  ON schema_history TYPE bool DEFAULT false;
DEFINE FIELD OVERWRITE commit_msg ON schema_history TYPE option<string>;

-- ===============================================
-- СУЩНОСТИ (универсальная таблица)
-- ===============================================
DEFINE TABLE OVERWRITE entities SCHEMAFULL;
DEFINE FIELD OVERWRITE project_id   ON entities TYPE record<projects> | string;
DEFINE FIELD OVERWRITE entity_type  ON entities TYPE string;
DEFINE FIELD OVERWRITE name         ON entities TYPE string;
DEFINE FIELD OVERWRITE description  ON entities TYPE option<string>;
DEFINE FIELD OVERWRITE attributes   ON entities TYPE object FLEXIBLE DEFAULT {};
DEFINE FIELD OVERWRITE tags         ON entities TYPE array<string> DEFAULT [];
DEFINE FIELD OVERWRITE embedding    ON entities TYPE option<array<float>>;
DEFINE FIELD OVERWRITE created_at   ON entities TYPE option<datetime> DEFAULT time::now();
DEFINE FIELD OVERWRITE updated_at   ON entities TYPE option<datetime> DEFAULT time::now();

DEFINE INDEX OVERWRITE idx_entity_project ON entities FIELDS project_id;
DEFINE INDEX OVERWRITE idx_entity_type    ON entities FIELDS project_id, entity_type;
DEFINE INDEX OVERWRITE idx_entity_name_ft ON entities COLUMNS name FULLTEXT ANALYZER like BM25;
DEFINE INDEX OVERWRITE idx_entity_desc_ft ON entities COLUMNS description FULLTEXT ANALYZER like BM25;
DEFINE INDEX OVERWRITE idx_entity_emb     ON entities COLUMNS embedding HNSW DIMENSION 1536 DIST COSINE;

-- ===============================================
-- ТИПЫ ГРАФ-РЁБЕР (определяет пользователь)
-- ===============================================
DEFINE TABLE OVERWRITE relation_schemas SCHEMAFULL;
DEFINE FIELD OVERWRITE project_id ON relation_schemas TYPE record<projects> | string;
DEFINE FIELD OVERWRITE rel_key    ON relation_schemas TYPE string;
DEFINE FIELD OVERWRITE rel_name   ON relation_schemas TYPE string;
DEFINE FIELD OVERWRITE icon       ON relation_schemas TYPE string;
DEFINE FIELD OVERWRITE color      ON relation_schemas TYPE string;
DEFINE FIELD OVERWRITE directed   ON relation_schemas TYPE bool DEFAULT true;
DEFINE FIELD OVERWRITE from_types ON relation_schemas TYPE array<string> DEFAULT [];
DEFINE FIELD OVERWRITE to_types   ON relation_schemas TYPE array<string> DEFAULT [];

-- ===============================================
-- ГРАФ-РЁБРА: Связи между сущностями
-- ===============================================
DEFINE TABLE OVERWRITE entity_rel TYPE RELATION IN entities OUT entities SCHEMAFULL;
DEFINE FIELD OVERWRITE project_id    ON entity_rel TYPE record<projects> | string;
DEFINE FIELD OVERWRITE rel_type      ON entity_rel TYPE string;
DEFINE FIELD OVERWRITE description   ON entity_rel TYPE option<string>;
DEFINE FIELD OVERWRITE strength      ON entity_rel TYPE option<int>;
DEFINE FIELD OVERWRITE attributes    ON entity_rel TYPE object FLEXIBLE DEFAULT {};
DEFINE FIELD OVERWRITE start_chapter ON entity_rel TYPE option<record<chapters> | string>;
DEFINE FIELD OVERWRITE end_chapter   ON entity_rel TYPE option<record<chapters> | string>;
DEFINE FIELD OVERWRITE created_at    ON entity_rel TYPE datetime DEFAULT time::now();

DEFINE INDEX OVERWRITE idx_rel_project ON entity_rel FIELDS project_id;
DEFINE INDEX OVERWRITE idx_rel_type    ON entity_rel FIELDS rel_type;

-- ===============================================
-- СВЯЗИ: Сущность ↔ Глава
-- ===============================================
DEFINE TABLE OVERWRITE appears_in TYPE RELATION IN entities OUT chapters SCHEMAFULL;
DEFINE FIELD OVERWRITE project_id ON appears_in TYPE record<projects> | string;
DEFINE FIELD OVERWRITE role       ON appears_in TYPE option<string>;
DEFINE FIELD OVERWRITE notes      ON appears_in TYPE option<string>;

-- ===============================================
-- ГЛАВЫ
-- ===============================================
DEFINE TABLE OVERWRITE chapters SCHEMAFULL;
DEFINE FIELD OVERWRITE project_id      ON chapters TYPE record<projects> | string;
DEFINE FIELD OVERWRITE title           ON chapters TYPE string;
DEFINE FIELD OVERWRITE content         ON chapters TYPE string;
DEFINE FIELD OVERWRITE summary         ON chapters TYPE option<string>;
DEFINE FIELD OVERWRITE arc_id          ON chapters TYPE option<record<arcs> | string>;
DEFINE FIELD OVERWRITE volume_id       ON chapters TYPE option<record<volumes> | string>;
DEFINE FIELD OVERWRITE word_count      ON chapters TYPE int DEFAULT 0;
DEFINE FIELD OVERWRITE sort_order      ON chapters TYPE int DEFAULT 0;
DEFINE FIELD OVERWRITE embedding       ON chapters TYPE option<array<float>>;
DEFINE FIELD OVERWRITE created_at      ON chapters TYPE option<datetime> DEFAULT time::now();
DEFINE FIELD OVERWRITE updated_at      ON chapters TYPE option<datetime> DEFAULT time::now();
DEFINE FIELD OVERWRITE footnotes       ON chapters TYPE object FLEXIBLE DEFAULT {};
DEFINE FIELD OVERWRITE timeline_events ON chapters TYPE array<object> FLEXIBLE DEFAULT [];
DEFINE FIELD OVERWRITE participants    ON chapters TYPE array<string> DEFAULT [];

DEFINE INDEX OVERWRITE idx_chapter_ft  ON chapters COLUMNS content FULLTEXT ANALYZER like BM25;
DEFINE INDEX OVERWRITE idx_chapter_emb ON chapters COLUMNS embedding HNSW DIMENSION 1536 DIST COSINE;

DEFINE EVENT OVERWRITE cascade_chapter_delete ON TABLE chapters WHEN $event = "DELETE" THEN {
    DELETE text_blocks WHERE chapter_id = $before.id OR chapter_id = type::string($before.id);
    DELETE plans WHERE parent_ref = $before.id OR parent_ref = type::string($before.id);
};

-- ===============================================
-- ПЛАНЫ
-- ===============================================
DEFINE TABLE OVERWRITE plans SCHEMAFULL;
DEFINE FIELD OVERWRITE project_id  ON plans TYPE record<projects> | string;
DEFINE FIELD OVERWRITE title       ON plans TYPE string;
DEFINE FIELD OVERWRITE parent_ref  ON plans TYPE record<chapters | arcs | volumes | plans> | string;
DEFINE FIELD OVERWRITE parent_type ON plans TYPE string;
DEFINE FIELD OVERWRITE sort_order  ON plans TYPE int DEFAULT 0;
DEFINE FIELD OVERWRITE completed   ON plans TYPE bool DEFAULT false;
DEFINE FIELD OVERWRITE created_at  ON plans TYPE datetime DEFAULT time::now();
DEFINE FIELD OVERWRITE updated_at  ON plans TYPE datetime DEFAULT time::now();

DEFINE EVENT OVERWRITE cascade_plan_delete ON TABLE plans WHEN $event = "DELETE" THEN {
    DELETE plans WHERE parent_ref = $before.id OR parent_ref = type::string($before.id);
};

-- ===============================================
-- AI: Блоки текста
-- ===============================================
DEFINE TABLE OVERWRITE text_blocks SCHEMAFULL;
DEFINE FIELD OVERWRITE project_id  ON text_blocks TYPE record<projects> | string;
DEFINE FIELD OVERWRITE chapter_id  ON text_blocks TYPE record<chapters> | string;
DEFINE FIELD OVERWRITE block_type  ON text_blocks TYPE string;
DEFINE FIELD OVERWRITE order_index ON text_blocks TYPE int;
DEFINE FIELD OVERWRITE content     ON text_blocks TYPE string;
DEFINE FIELD OVERWRITE embedding   ON text_blocks TYPE option<array<float>>;

DEFINE INDEX OVERWRITE idx_blocks_ft  ON text_blocks COLUMNS content FULLTEXT ANALYZER like BM25;
DEFINE INDEX OVERWRITE idx_blocks_emb ON text_blocks COLUMNS embedding HNSW DIMENSION 1536 DIST COSINE;

-- ===============================================
-- AI: Чат
-- ===============================================
DEFINE TABLE OVERWRITE chat_messages SCHEMAFULL;
DEFINE FIELD OVERWRITE project_id       ON chat_messages TYPE record<projects> | string;
DEFINE FIELD OVERWRITE role             ON chat_messages TYPE string;
DEFINE FIELD OVERWRITE content          ON chat_messages TYPE string;
DEFINE FIELD OVERWRITE parent_msg_id    ON chat_messages TYPE option<record<chat_messages> | string>;
DEFINE FIELD OVERWRITE version          ON chat_messages TYPE int DEFAULT 0;
DEFINE FIELD OVERWRITE quoted_context   ON chat_messages TYPE option<object> FLEXIBLE;
DEFINE FIELD OVERWRITE edited_content   ON chat_messages TYPE option<string>;
DEFINE FIELD OVERWRITE feedback_comment ON chat_messages TYPE option<string>;
DEFINE FIELD OVERWRITE rag_was_bad      ON chat_messages TYPE bool DEFAULT false;
DEFINE FIELD OVERWRITE embedding        ON chat_messages TYPE option<array<float>>;
DEFINE FIELD OVERWRITE created_at       ON chat_messages TYPE datetime DEFAULT time::now();

-- ===============================================
-- AI: Словарь
-- ===============================================
DEFINE TABLE OVERWRITE user_dictionary SCHEMAFULL;
DEFINE FIELD OVERWRITE project_id  ON user_dictionary TYPE record<projects> | string;
DEFINE FIELD OVERWRITE word        ON user_dictionary TYPE string;
DEFINE FIELD OVERWRITE definition  ON user_dictionary TYPE option<string>;
DEFINE FIELD OVERWRITE is_approved ON user_dictionary TYPE bool DEFAULT true;
DEFINE FIELD OVERWRITE confidence  ON user_dictionary TYPE float DEFAULT 1.0;

DEFINE INDEX OVERWRITE idx_dict_word ON user_dictionary FIELDS project_id, word UNIQUE;

-- ===============================================
-- AI: Кэш интернета
-- ===============================================
DEFINE TABLE OVERWRITE web_cache SCHEMAFULL;
DEFINE FIELD OVERWRITE project_id  ON web_cache TYPE record<projects> | string;
DEFINE FIELD OVERWRITE url         ON web_cache TYPE string;
DEFINE FIELD OVERWRITE source_type ON web_cache TYPE string;
DEFINE FIELD OVERWRITE content     ON web_cache TYPE string;
DEFINE FIELD OVERWRITE embedding   ON web_cache TYPE option<array<float>>;
DEFINE FIELD OVERWRITE fetched_at  ON web_cache TYPE datetime DEFAULT time::now();
DEFINE FIELD OVERWRITE expires_at  ON web_cache TYPE option<datetime>;

-- ===============================================
-- AI: Память агента
-- ===============================================
DEFINE TABLE OVERWRITE agent_memory SCHEMAFULL;
DEFINE FIELD OVERWRITE project_id  ON agent_memory TYPE record<projects> | string;
DEFINE FIELD OVERWRITE memory_type ON agent_memory TYPE string;
DEFINE FIELD OVERWRITE content     ON agent_memory TYPE string;
DEFINE FIELD OVERWRITE embedding   ON agent_memory TYPE option<array<float>>;
DEFINE FIELD OVERWRITE importance  ON agent_memory TYPE int DEFAULT 5;
DEFINE FIELD OVERWRITE created_at  ON agent_memory TYPE datetime DEFAULT time::now();

DEFINE INDEX OVERWRITE idx_memory_emb ON agent_memory FIELDS embedding HNSW DIMENSION 1536 DIST COSINE;

-- ===============================================
-- ИСТОРИЯ СУЩНОСТЕЙ (РЕВИЗИИ)
-- ===============================================
DEFINE TABLE OVERWRITE entity_revisions TYPE NORMAL;
DEFINE FIELD OVERWRITE target_id   ON entity_revisions TYPE record<entities>;
DEFINE FIELD OVERWRITE project_id  ON entity_revisions TYPE string;
DEFINE FIELD OVERWRITE content     ON entity_revisions TYPE object;
DEFINE FIELD OVERWRITE commit_msg  ON entity_revisions TYPE option<string>;
DEFINE FIELD OVERWRITE created_at  ON entity_revisions TYPE datetime DEFAULT time::now();
DEFINE FIELD OVERWRITE is_pinned   ON entity_revisions TYPE bool DEFAULT false;

DEFINE INDEX OVERWRITE idx_entity_rev_target ON entity_revisions FIELDS target_id;
DEFINE INDEX OVERWRITE idx_entity_rev_project ON entity_revisions FIELDS project_id;

-- ===============================================
-- ИСТОРИЯ ГЛАВ (РЕВИЗИИ)
-- ===============================================
DEFINE TABLE OVERWRITE chapter_revisions SCHEMAFULL;
DEFINE FIELD OVERWRITE target_id   ON chapter_revisions TYPE record<chapters> | string;
DEFINE FIELD OVERWRITE project_id  ON chapter_revisions TYPE record<projects> | string;
DEFINE FIELD OVERWRITE content     ON chapter_revisions TYPE object FLEXIBLE DEFAULT {};
DEFINE FIELD OVERWRITE commit_msg  ON chapter_revisions TYPE option<string>;
DEFINE FIELD OVERWRITE created_at  ON chapter_revisions TYPE datetime DEFAULT time::now();

DEFINE INDEX OVERWRITE idx_chapter_rev_target ON chapter_revisions FIELDS target_id;
DEFINE INDEX OVERWRITE idx_chapter_rev_project ON chapter_revisions FIELDS project_id;

-- ===============================================
-- ТРИГГЕРЫ (АВТО-РЕВИЗИИ)
-- ===============================================

DEFINE EVENT OVERWRITE log_entity_revision ON TABLE entities WHEN $event = "UPDATE" THEN {
    CREATE entity_revisions SET 
        target_id = $before.id,
        project_id = $before.project_id,
        content = $before,
        created_at = time::now();
};

DEFINE EVENT OVERWRITE log_chapter_revision ON TABLE chapters WHEN $event = "UPDATE" THEN {
    CREATE chapter_revisions SET 
        target_id = $before.id,
        project_id = $before.project_id,
        content = $before,
        created_at = time::now();
};
