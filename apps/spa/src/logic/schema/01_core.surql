-- ==============================================================================
-- 01_CORE.SURQL — БАЗОВОЕ ЯДРО СХЕМЫ (ВЫПОЛНЯЕТСЯ ВО ВСЕХ РЕДАКЦИЯХ: BASE И ULTRA)
-- ==============================================================================
-- Включает: Проекты, Тома, Арки, Главы, Блоки текста, Схемы сущностей,
--           Историю схем, Сущности, Графовые связи, Таймлайн, Календари,
--           Планы, Сюжетные обещания, Ревизии и каскадный триггер cascade_project_delete.
-- ==============================================================================

DEFINE ANALYZER OVERWRITE like TOKENIZERS blank, class, camel FILTERS ascii, lowercase;
DEFINE ANALYZER OVERWRITE ru_en_analyzer TOKENIZERS class, blank FILTERS lowercase, snowball(russian), snowball(english);

-- ===============================================
-- 1. ПРОЕКТЫ И КАСКАДНЫЙ ТРИГГЕР УДАЛЕНИЯ
-- ===============================================

DEFINE TABLE OVERWRITE projects SCHEMAFULL;
DEFINE FIELD OVERWRITE name        ON projects TYPE string;
DEFINE FIELD OVERWRITE created_at  ON projects TYPE option<datetime> DEFAULT time::now();
DEFINE FIELD OVERWRITE data        ON projects TYPE object FLEXIBLE DEFAULT {};
DEFINE FIELD OVERWRITE type        ON projects TYPE option<string>;
DEFINE FIELD OVERWRITE genres      ON projects TYPE option<array<string>>;
DEFINE FIELD OVERWRITE perfLevel   ON projects TYPE option<string>;

DEFINE EVENT OVERWRITE cascade_project_delete ON TABLE projects WHEN $event = "DELETE" THEN {
    LET $pid = $before.id;
    
    -- 1. Сущности, связи и история правок книги
    DELETE entities WHERE project_id = $pid;
    DELETE entity_chunks WHERE project_id = $pid;
    DELETE entity_rel WHERE project_id = $pid;
    DELETE appears_in WHERE project_id = $pid;
    DELETE entity_revisions WHERE project_id = $pid;
    DELETE chapter_revisions WHERE project_id = $pid;
    DELETE tags WHERE project_id = $pid;

    -- 2. Сюжет, главы и текст рукописи
    DELETE volumes WHERE project_id = $pid;
    DELETE arcs WHERE project_id = $pid;
    DELETE chapters WHERE project_id = $pid;
    DELETE text_blocks WHERE project_id = $pid;

    -- 3. Планирование, таймлайн и сюжетные обещания
    DELETE plans WHERE project_id = $pid;
    DELETE plot_promises WHERE project_id = $pid;
    DELETE timeline_events WHERE project_id = $pid;

    -- 4. ИИ-сессии и контекст диалогов по книге
    DELETE chats WHERE project_id = $pid;
    DELETE chat_messages WHERE project_id = $pid;
    DELETE agent_memory WHERE project_id = $pid;
    DELETE research_sessions WHERE project_id = $pid;
    DELETE auto_approval_settings WHERE project_id = $pid;
    DELETE ai_modes WHERE project_id = $pid AND (is_global != true OR is_global = NONE);
};

-- ===============================================
-- 2. ИЕРАРХИЯ СЮЖЕТА (ГРАФОВЫЕ СВЯЗИ)
-- ===============================================

DEFINE TABLE OVERWRITE contains TYPE RELATION IN projects | volumes | arcs | chats OUT volumes | arcs | chapters | chats SCHEMAFULL;
DEFINE FIELD OVERWRITE sort_order ON contains TYPE int DEFAULT 0;

DEFINE TABLE OVERWRITE volumes SCHEMAFULL;
DEFINE FIELD OVERWRITE title      ON volumes TYPE string;
DEFINE FIELD OVERWRITE project_id ON volumes TYPE record<projects>;

DEFINE EVENT OVERWRITE cascade_volume_delete ON TABLE volumes WHEN $event = "DELETE" THEN {
    DELETE ->contains->arcs;
    DELETE ->contains->chapters;
    DELETE plans WHERE parent_ref = $before.id;
};

DEFINE TABLE OVERWRITE arcs SCHEMAFULL;
DEFINE FIELD OVERWRITE title      ON arcs TYPE string;
DEFINE FIELD OVERWRITE project_id ON arcs TYPE record<projects>;

DEFINE EVENT OVERWRITE cascade_arc_delete ON TABLE arcs WHEN $event = "DELETE" THEN {
    DELETE ->contains->chapters;
    DELETE plans WHERE parent_ref = $before.id;
};

DEFINE TABLE OVERWRITE chapters SCHEMAFULL CHANGEFEED 30d;
DEFINE FIELD OVERWRITE project_id      ON chapters TYPE record<projects>;
DEFINE FIELD OVERWRITE title          ON chapters TYPE string;
DEFINE FIELD OVERWRITE content        ON chapters TYPE string;
DEFINE FIELD OVERWRITE summary        ON chapters TYPE option<string | null>;
DEFINE FIELD OVERWRITE word_count      ON chapters TYPE int DEFAULT 0;
DEFINE FIELD OVERWRITE embeddings      ON chapters TYPE object FLEXIBLE DEFAULT {};
DEFINE FIELD OVERWRITE created_at      ON chapters TYPE option<datetime> DEFAULT time::now();
DEFINE FIELD OVERWRITE updated_at      ON chapters TYPE option<datetime> DEFAULT time::now();
DEFINE FIELD OVERWRITE footnotes      ON chapters TYPE object FLEXIBLE DEFAULT {};
DEFINE FIELD OVERWRITE participants    ON chapters TYPE array<string> DEFAULT [];

DEFINE FIELD OVERWRITE timeline_events ON chapters TYPE array DEFAULT [];
DEFINE FIELD OVERWRITE timeline_events.* ON chapters TYPE object FLEXIBLE;
DEFINE FIELD OVERWRITE timeline_events.*.date ON chapters TYPE object FLEXIBLE;
DEFINE FIELD OVERWRITE timeline_events.*.epoch ON chapters TYPE option<string>;
DEFINE FIELD OVERWRITE timeline_events.*.time ON chapters TYPE option<object> FLEXIBLE;

DEFINE INDEX OVERWRITE idx_chapter_ft  ON chapters COLUMNS content FULLTEXT ANALYZER ru_en_analyzer BM25;
DEFINE INDEX OVERWRITE idx_chapter_title_ft ON chapters COLUMNS title FULLTEXT ANALYZER ru_en_analyzer BM25;

DEFINE EVENT OVERWRITE cascade_chapter_delete ON TABLE chapters WHEN $event = "DELETE" THEN {
    DELETE text_blocks WHERE chapter_id = $before.id;
    DELETE plans WHERE parent_ref = $before.id;
    DELETE plot_promises WHERE chapter_id = $before.id;
};

-- ===============================================
-- 3. БЛОКИ ТЕКСТА РУКОПИСИ
-- ===============================================

DEFINE TABLE OVERWRITE text_blocks SCHEMAFULL;
DEFINE FIELD OVERWRITE project_id  ON text_blocks TYPE record<projects>;
DEFINE FIELD OVERWRITE chapter_id  ON text_blocks TYPE record<chapters>;
DEFINE FIELD OVERWRITE block_type  ON text_blocks TYPE string DEFAULT 'description';
DEFINE FIELD OVERWRITE order_index ON text_blocks TYPE int DEFAULT 0;
DEFINE FIELD OVERWRITE content     ON text_blocks TYPE string;
DEFINE FIELD OVERWRITE embeddings  ON text_blocks TYPE object FLEXIBLE DEFAULT {};
DEFINE FIELD OVERWRITE created_at  ON text_blocks TYPE datetime DEFAULT time::now();

DEFINE INDEX OVERWRITE idx_textblock_project ON text_blocks FIELDS project_id;
DEFINE INDEX OVERWRITE idx_textblock_chapter ON text_blocks FIELDS chapter_id;

-- ===============================================
-- 4. ТЕГИ И КАЛЕНДАРИ
-- ===============================================

DEFINE TABLE OVERWRITE tags SCHEMAFULL;
DEFINE FIELD OVERWRITE name       ON tags TYPE string;
DEFINE FIELD OVERWRITE color      ON tags TYPE string;
DEFINE FIELD OVERWRITE project_id ON tags TYPE record<projects>;

DEFINE TABLE OVERWRITE calendars SCHEMAFULL;
DEFINE FIELD OVERWRITE name        ON calendars TYPE string;
DEFINE FIELD OVERWRITE description ON calendars TYPE option<string | null>;
DEFINE FIELD OVERWRITE data        ON calendars TYPE object FLEXIBLE DEFAULT {};
DEFINE FIELD OVERWRITE is_default  ON calendars TYPE bool DEFAULT false;
DEFINE FIELD OVERWRITE is_master   ON calendars TYPE bool DEFAULT false;
DEFINE FIELD OVERWRITE project_id  ON calendars TYPE record<projects>;

-- ===============================================
-- 5. МЕТА-СХЕМЫ СУЩНОСТЕЙ И ИСТОРИЯ
-- ===============================================

DEFINE TABLE OVERWRITE entity_schemas SCHEMAFULL;
DEFINE FIELD OVERWRITE project_id    ON entity_schemas TYPE record<projects>;
DEFINE FIELD OVERWRITE type_key      ON entity_schemas TYPE string;
DEFINE FIELD OVERWRITE type_name     ON entity_schemas TYPE string;
DEFINE FIELD OVERWRITE icon          ON entity_schemas TYPE string;
DEFINE FIELD OVERWRITE color         ON entity_schemas TYPE string;
DEFINE FIELD OVERWRITE fields_schema ON entity_schemas TYPE array<object> FLEXIBLE DEFAULT [];
DEFINE FIELD OVERWRITE full_schema   ON entity_schemas TYPE option<object> FLEXIBLE;
DEFINE FIELD OVERWRITE created_at    ON entity_schemas TYPE datetime DEFAULT time::now();

DEFINE INDEX OVERWRITE idx_schema_type ON entity_schemas FIELDS project_id, type_key;

DEFINE TABLE OVERWRITE schema_history SCHEMAFULL;
DEFINE FIELD OVERWRITE schema_id  ON schema_history TYPE record<entity_schemas>;
DEFINE FIELD OVERWRITE type_key   ON schema_history TYPE string;
DEFINE FIELD OVERWRITE project_id ON schema_history TYPE record<projects>;
DEFINE FIELD OVERWRITE snapshot   ON schema_history TYPE object FLEXIBLE DEFAULT {};
DEFINE FIELD OVERWRITE saved_at   ON schema_history TYPE string;
DEFINE FIELD OVERWRITE is_pinned  ON schema_history TYPE bool DEFAULT false;
DEFINE FIELD OVERWRITE commit_msg ON schema_history TYPE option<string>;

-- ===============================================
-- 6. СУЩНОСТИ (ЛОКАЛЬНЫЙ ЛОР)
-- ===============================================

DEFINE TABLE OVERWRITE entities SCHEMAFULL CHANGEFEED 30d;
DEFINE FIELD OVERWRITE project_id   ON entities TYPE record<projects>;
DEFINE FIELD OVERWRITE entity_type  ON entities TYPE string;
DEFINE FIELD OVERWRITE name         ON entities TYPE string;
DEFINE FIELD OVERWRITE description  ON entities TYPE option<string>;
DEFINE FIELD OVERWRITE attributes   ON entities TYPE object FLEXIBLE DEFAULT {};
DEFINE FIELD OVERWRITE tags         ON entities TYPE array<string> DEFAULT [];
DEFINE FIELD OVERWRITE embeddings   ON entities TYPE object FLEXIBLE DEFAULT {};
DEFINE FIELD OVERWRITE created_at   ON entities TYPE option<datetime> DEFAULT time::now();
DEFINE FIELD OVERWRITE updated_at   ON entities TYPE option<datetime> DEFAULT time::now();

DEFINE INDEX OVERWRITE idx_entity_project ON entities FIELDS project_id;
DEFINE INDEX OVERWRITE idx_entity_type    ON entities FIELDS project_id, entity_type;
DEFINE INDEX OVERWRITE idx_entity_name_ft ON entities COLUMNS name FULLTEXT ANALYZER ru_en_analyzer BM25;
DEFINE INDEX OVERWRITE idx_entity_desc_ft ON entities COLUMNS description FULLTEXT ANALYZER ru_en_analyzer BM25;

-- ===============================================
-- 7. СВЯЗИ И ОТНОШЕНИЯ СУЩНОСТЕЙ
-- ===============================================

DEFINE TABLE OVERWRITE relation_schemas SCHEMAFULL;
DEFINE FIELD OVERWRITE project_id ON relation_schemas TYPE record<projects>;
DEFINE FIELD OVERWRITE rel_key    ON relation_schemas TYPE string;
DEFINE FIELD OVERWRITE rel_name   ON relation_schemas TYPE string;
DEFINE FIELD OVERWRITE icon       ON relation_schemas TYPE string;
DEFINE FIELD OVERWRITE color      ON relation_schemas TYPE string;
DEFINE FIELD OVERWRITE directed   ON relation_schemas TYPE bool DEFAULT true;
DEFINE FIELD OVERWRITE from_types ON relation_schemas TYPE array<string> DEFAULT [];
DEFINE FIELD OVERWRITE to_types   ON relation_schemas TYPE array<string> DEFAULT [];

DEFINE TABLE OVERWRITE entity_rel TYPE RELATION IN entities OUT entities SCHEMAFULL;
DEFINE FIELD OVERWRITE project_id    ON entity_rel TYPE record<projects>;
DEFINE FIELD OVERWRITE rel_type      ON entity_rel TYPE string;
DEFINE FIELD OVERWRITE description   ON entity_rel TYPE option<string | null>;
DEFINE FIELD OVERWRITE strength      ON entity_rel TYPE option<int | null>;
DEFINE FIELD OVERWRITE attributes    ON entity_rel TYPE object FLEXIBLE DEFAULT {};
DEFINE FIELD OVERWRITE start_chapter ON entity_rel TYPE option<record<chapters> | null>;
DEFINE FIELD OVERWRITE end_chapter   ON entity_rel TYPE option<record<chapters> | null>;
DEFINE FIELD OVERWRITE created_at    ON entity_rel TYPE datetime DEFAULT time::now();

DEFINE INDEX OVERWRITE idx_rel_project ON entity_rel FIELDS project_id;
DEFINE INDEX OVERWRITE idx_rel_type    ON entity_rel FIELDS rel_type;

DEFINE TABLE OVERWRITE appears_in TYPE RELATION IN entities OUT chapters SCHEMAFULL;
DEFINE FIELD OVERWRITE project_id ON appears_in TYPE record<projects>;
DEFINE FIELD OVERWRITE role       ON appears_in TYPE option<string | null>;
DEFINE FIELD OVERWRITE notes      ON appears_in TYPE option<string | null>;

-- ===============================================
-- 8. ПЛАНЫ И ЧЕК-ЛИСТЫ
-- ===============================================

DEFINE TABLE OVERWRITE plans SCHEMAFULL;
DEFINE FIELD OVERWRITE project_id  ON plans TYPE record<projects>;
DEFINE FIELD OVERWRITE title       ON plans TYPE string;
DEFINE FIELD OVERWRITE parent_ref  ON plans TYPE option<record<chapters> | record<arcs> | record<volumes> | record<plans> | null>;
DEFINE FIELD OVERWRITE parent_type ON plans TYPE string;
DEFINE FIELD OVERWRITE sort_order  ON plans TYPE int DEFAULT 0;
DEFINE FIELD OVERWRITE completed   ON plans TYPE bool DEFAULT false;
DEFINE FIELD OVERWRITE created_at  ON plans TYPE datetime DEFAULT time::now();
DEFINE FIELD OVERWRITE updated_at  ON plans TYPE datetime DEFAULT time::now();

DEFINE EVENT OVERWRITE cascade_plan_delete ON TABLE plans WHEN $event = "DELETE" THEN {
    DELETE plans WHERE parent_ref = $before.id;
};

-- ===============================================
-- 9. ТАЙМЛАЙН СОБЫТИЙ И УЧАСТИЕ СУЩНОСТЕЙ
-- ===============================================

DEFINE TABLE OVERWRITE timeline_events SCHEMAFULL;
DEFINE FIELD OVERWRITE project_id    ON timeline_events TYPE record<projects>;
DEFINE FIELD OVERWRITE title         ON timeline_events TYPE string;
DEFINE FIELD OVERWRITE description   ON timeline_events TYPE option<string>;
DEFINE FIELD OVERWRITE m_abs         ON timeline_events TYPE int; -- Золотой эталон абсолютной минуты
DEFINE FIELD OVERWRITE calendar_id   ON timeline_events TYPE record<calendars>;
DEFINE FIELD OVERWRITE chapter_id    ON timeline_events TYPE option<record<chapters>>;
DEFINE FIELD OVERWRITE block_id      ON timeline_events TYPE option<string>;
DEFINE FIELD OVERWRITE created_at    ON timeline_events TYPE datetime DEFAULT time::now();

DEFINE INDEX OVERWRITE idx_event_m_abs ON timeline_events FIELDS project_id, m_abs;

DEFINE TABLE OVERWRITE participates_in TYPE RELATION IN entities OUT timeline_events SCHEMAFULL;
DEFINE FIELD OVERWRITE role  ON participates_in TYPE option<string>;
DEFINE FIELD OVERWRITE notes ON participates_in TYPE option<string>;

-- ===============================================
-- 10. РЕВИЗИИ СУЩНОСТЕЙ И ГЛАВ
-- ===============================================

DEFINE TABLE OVERWRITE entity_revisions TYPE NORMAL;
DEFINE FIELD OVERWRITE target_id   ON entity_revisions TYPE record<entities>;
DEFINE FIELD OVERWRITE project_id  ON entity_revisions TYPE record<projects>;
DEFINE FIELD OVERWRITE content     ON entity_revisions TYPE object;
DEFINE FIELD OVERWRITE commit_msg  ON entity_revisions TYPE option<string>;
DEFINE FIELD OVERWRITE created_at  ON entity_revisions TYPE datetime DEFAULT time::now();
DEFINE FIELD OVERWRITE is_pinned   ON entity_revisions TYPE bool DEFAULT false;
DEFINE INDEX OVERWRITE idx_entity_rev_target ON entity_revisions FIELDS target_id;
DEFINE INDEX OVERWRITE idx_entity_rev_project ON entity_revisions FIELDS project_id;

DEFINE TABLE OVERWRITE chapter_revisions SCHEMAFULL;
DEFINE FIELD OVERWRITE target_id   ON chapter_revisions TYPE record<chapters>;
DEFINE FIELD OVERWRITE project_id  ON chapter_revisions TYPE record<projects>;
DEFINE FIELD OVERWRITE content     ON chapter_revisions TYPE object FLEXIBLE DEFAULT {};
DEFINE FIELD OVERWRITE commit_msg  ON chapter_revisions TYPE option<string>;
DEFINE FIELD OVERWRITE created_at  ON chapter_revisions TYPE datetime DEFAULT time::now();
DEFINE FIELD OVERWRITE is_pinned   ON chapter_revisions TYPE bool DEFAULT false;
DEFINE INDEX OVERWRITE idx_chapter_rev_target ON chapter_revisions FIELDS target_id;
DEFINE INDEX OVERWRITE idx_chapter_rev_project ON chapter_revisions FIELDS project_id;

DEFINE EVENT OVERWRITE log_entity_revision ON TABLE entities WHEN $event = "UPDATE" THEN {
    CREATE entity_revisions SET target_id = $before.id, project_id = $before.project_id, content = $before, created_at = time::now(), commit_msg = NONE;
};

DEFINE EVENT OVERWRITE log_chapter_revision ON TABLE chapters WHEN $event = "UPDATE" THEN {
    CREATE chapter_revisions SET target_id = $before.id, project_id = $before.project_id, content = $before, created_at = time::now(), commit_msg = NONE;
};

-- ===============================================
-- 11. СЮЖЕТНЫЕ ОБЕЩАНИЯ (ЧЕХОВСКИЕ РУЖЬЯ, ТАЙНЫ)
-- ===============================================

DEFINE TABLE OVERWRITE plot_promises SCHEMAFULL;
DEFINE FIELD OVERWRITE project_id          ON plot_promises TYPE record<projects>;
DEFINE FIELD OVERWRITE chapter_id          ON plot_promises TYPE record<chapters>;
DEFINE FIELD OVERWRITE kind                ON plot_promises TYPE string; -- 'gun' | 'foreshadowing' | 'mystery' | 'question'
DEFINE FIELD OVERWRITE quote               ON plot_promises TYPE string;
DEFINE FIELD OVERWRITE paragraph_index     ON plot_promises TYPE int DEFAULT 1;
DEFINE FIELD OVERWRITE block_id            ON plot_promises TYPE option<string>;
DEFINE FIELD OVERWRITE note                ON plot_promises TYPE option<string>;
DEFINE FIELD OVERWRITE status              ON plot_promises TYPE string DEFAULT 'planted'; -- 'planted' | 'developed' | 'resolved'
DEFINE FIELD OVERWRITE progressions        ON plot_promises TYPE array<object> FLEXIBLE DEFAULT [];
DEFINE FIELD OVERWRITE resolution          ON plot_promises TYPE option<object> FLEXIBLE;
DEFINE FIELD OVERWRITE resolved_in_volume  ON plot_promises TYPE option<record<volumes>>;
DEFINE FIELD OVERWRITE resolved_in_arc     ON plot_promises TYPE option<record<arcs>>;
DEFINE FIELD OVERWRITE resolved_in_chapter ON plot_promises TYPE option<record<chapters>>;
DEFINE FIELD OVERWRITE created_at          ON plot_promises TYPE datetime DEFAULT time::now();
DEFINE FIELD OVERWRITE updated_at          ON plot_promises TYPE datetime DEFAULT time::now();

DEFINE INDEX OVERWRITE idx_promise_project ON plot_promises FIELDS project_id;
DEFINE INDEX OVERWRITE idx_promise_chapter ON plot_promises FIELDS chapter_id;
DEFINE INDEX OVERWRITE idx_promise_status  ON plot_promises FIELDS project_id, status;
