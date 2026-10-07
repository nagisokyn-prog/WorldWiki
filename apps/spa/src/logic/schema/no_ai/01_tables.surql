-- ==============================================================================
-- 01_TABLES.SURQL — ТАБЛИЦЫ И ПОЛЯ БАЗОВОГО ЯДРА (BASE & ULTRA)
-- ==============================================================================
-- Включает:
-- 1. projects (Проекты)
-- 2. contains (Иерархия сюжета)
-- 3. volumes (Тома)
-- 4. chapters (Главы рукописи)
-- 6. text_blocks (Блоки текста)
-- 7. tags (Теги)
-- 8. calendars (Календари и эпохи)
-- 9. entity_schemas (Мета-схемы сущностей лора)
-- 10. schema_history (История версий мета-схем)
-- 11. entities (Сущности лора / энциклопедии)
-- 12. relation_schemas (Схемы типов связей)
-- 13. entity_rel (Графовые связи между сущностями)
-- 14. appears_in (Связь участия сущностей в главах)
-- 15. plans (Планы и иерархические чек-листы)
-- 16. timeline_events (События таймлайна с абсолютной минутой m_abs)
-- 17. participates_in (Связь участия сущностей в событиях таймлайна)
-- 18. entity_revisions (История ревизий сущностей без векторов)
-- 19. entity_rel_revisions (История ревизий связей сущностей)
-- 20. chapter_revisions (История ревизий текста глав)
-- 21. plot_promises (Сюжетные обещания: чеховские ружья, тайны)
-- ==============================================================================

-- 1. ПРОЕКТЫ
DEFINE TABLE OVERWRITE projects SCHEMAFULL;
DEFINE FIELD OVERWRITE name        ON projects TYPE string;
DEFINE FIELD OVERWRITE created_at  ON projects TYPE option<datetime | null> DEFAULT time::now();
DEFINE FIELD OVERWRITE data        ON projects TYPE object FLEXIBLE DEFAULT {};
DEFINE FIELD OVERWRITE type        ON projects TYPE option<string | null>;
DEFINE FIELD OVERWRITE genres      ON projects TYPE array<string> DEFAULT [] VALUE IF $value = NONE OR $value = NULL THEN [] ELSE $value END;
DEFINE FIELD OVERWRITE perfLevel   ON projects TYPE option<string | null>;

-- 2. ИЕРАРХИЯ СЮЖЕТА (ГРАФОВЫЕ СВЯЗИ)
DEFINE TABLE OVERWRITE contains TYPE RELATION IN projects | volumes | chats OUT volumes | chapters | chats SCHEMAFULL;
DEFINE FIELD OVERWRITE sort_order ON contains TYPE int DEFAULT 0;

-- 3. ТОМА
DEFINE TABLE OVERWRITE volumes SCHEMAFULL;
DEFINE FIELD OVERWRITE title      ON volumes TYPE string;
DEFINE FIELD OVERWRITE project_id ON volumes TYPE record<projects> VALUE fn::normalize_project_id($value);

-- 4. ГЛАВЫ РУКОПИСИ
DEFINE TABLE OVERWRITE chapters SCHEMAFULL CHANGEFEED 30d;
DEFINE FIELD OVERWRITE project_id      ON chapters TYPE record<projects> VALUE fn::normalize_project_id($value);
DEFINE FIELD OVERWRITE title          ON chapters TYPE string;
DEFINE FIELD OVERWRITE content        ON chapters TYPE string;
DEFINE FIELD OVERWRITE summary        ON chapters TYPE option<string | null>;
DEFINE FIELD OVERWRITE sort_order      ON chapters TYPE int DEFAULT 0;
DEFINE FIELD OVERWRITE word_count      ON chapters TYPE int DEFAULT 0;
DEFINE FIELD OVERWRITE embeddings      ON chapters TYPE object FLEXIBLE DEFAULT {};
DEFINE FIELD OVERWRITE created_at      ON chapters TYPE option<datetime | null> DEFAULT time::now();
DEFINE FIELD OVERWRITE updated_at      ON chapters TYPE option<datetime | null> DEFAULT time::now();
DEFINE FIELD OVERWRITE footnotes       ON chapters TYPE object FLEXIBLE DEFAULT {};
DEFINE FIELD OVERWRITE timeline_events ON chapters TYPE array DEFAULT [] VALUE IF $value = NONE OR $value = NULL THEN [] ELSE $value END;
DEFINE FIELD OVERWRITE timeline_events.* ON chapters TYPE any;
DEFINE FIELD OVERWRITE participants    ON chapters TYPE array DEFAULT [] VALUE IF $value = NONE OR $value = NULL THEN [] ELSE $value END;
DEFINE FIELD OVERWRITE participants.*  ON chapters TYPE any;

-- 5. СЮЖЕТНЫЕ АРКИ (СТОРИЛАЙНЫ)
DEFINE TABLE OVERWRITE story_arcs SCHEMAFULL;
DEFINE FIELD OVERWRITE project_id    ON story_arcs TYPE record<projects> VALUE fn::normalize_project_id($value);
DEFINE FIELD OVERWRITE title         ON story_arcs TYPE string;
DEFINE FIELD OVERWRITE description   ON story_arcs TYPE option<string | null>;
DEFINE FIELD OVERWRITE arc_type      ON story_arcs TYPE string DEFAULT 'character'; -- 'character' | 'event' | 'relationship' | 'theme'
DEFINE FIELD OVERWRITE status        ON story_arcs TYPE string DEFAULT 'in_progress'; -- 'planned' | 'in_progress' | 'completed' | 'abandoned'
DEFINE FIELD OVERWRITE color         ON story_arcs TYPE option<string | null>;
DEFINE FIELD OVERWRITE created_at    ON story_arcs TYPE datetime DEFAULT time::now();
DEFINE FIELD OVERWRITE updated_at    ON story_arcs TYPE datetime DEFAULT time::now();

-- 5.1. СВЯЗЬ АРКА -> СУЩНОСТИ (ФОКУС АРКИ: персонажи, пары персонажей, фракции)
DEFINE TABLE OVERWRITE arc_entities TYPE RELATION IN story_arcs OUT entities SCHEMAFULL;
DEFINE FIELD OVERWRITE project_id ON arc_entities TYPE record<projects> VALUE fn::normalize_project_id($value);


-- 5.2. СВЯЗЬ АРКА -> ГЛАВЫ (ОХВАТ ГЛАВ СТОРИЛАЙНОМ)
DEFINE TABLE OVERWRITE arc_chapters TYPE RELATION IN story_arcs OUT chapters SCHEMAFULL;
DEFINE FIELD OVERWRITE project_id ON arc_chapters TYPE record<projects> VALUE fn::normalize_project_id($value);
DEFINE FIELD OVERWRITE sort_order ON arc_chapters TYPE int DEFAULT 0;
DEFINE FIELD OVERWRITE phase      ON arc_chapters TYPE option<string | null>; -- 'setup' | 'escalation' | 'climax' | 'resolution'

-- 6. БЛОКИ ТЕКСТА
DEFINE TABLE OVERWRITE text_blocks SCHEMAFULL;
DEFINE FIELD OVERWRITE project_id  ON text_blocks TYPE record<projects> VALUE fn::normalize_project_id($value);
DEFINE FIELD OVERWRITE chapter_id  ON text_blocks TYPE record<chapters>;
DEFINE FIELD OVERWRITE block_type  ON text_blocks TYPE string DEFAULT 'description';
DEFINE FIELD OVERWRITE order_index ON text_blocks TYPE int DEFAULT 0;
DEFINE FIELD OVERWRITE content     ON text_blocks TYPE string;
DEFINE FIELD OVERWRITE embeddings  ON text_blocks TYPE object FLEXIBLE DEFAULT {};
DEFINE FIELD OVERWRITE created_at  ON text_blocks TYPE datetime DEFAULT time::now();

-- 7. ТЕГИ
DEFINE TABLE OVERWRITE tags SCHEMAFULL;
DEFINE FIELD OVERWRITE name       ON tags TYPE string;
DEFINE FIELD OVERWRITE color      ON tags TYPE string;
DEFINE FIELD OVERWRITE project_id ON tags TYPE record<projects> VALUE fn::normalize_project_id($value);

-- 8. КАЛЕНДАРИ
DEFINE TABLE OVERWRITE calendars SCHEMAFULL;
DEFINE FIELD OVERWRITE name        ON calendars TYPE string;
DEFINE FIELD OVERWRITE description ON calendars TYPE option<string | null>;
DEFINE FIELD OVERWRITE data        ON calendars TYPE object FLEXIBLE DEFAULT {};
DEFINE FIELD OVERWRITE is_default  ON calendars TYPE bool DEFAULT false;
DEFINE FIELD OVERWRITE is_master   ON calendars TYPE bool DEFAULT false;
DEFINE FIELD OVERWRITE project_id  ON calendars TYPE record<projects> VALUE fn::normalize_project_id($value);

-- 9. МЕТА-СХЕМЫ СУЩНОСТЕЙ
DEFINE TABLE OVERWRITE entity_schemas SCHEMAFULL;
DEFINE FIELD OVERWRITE project_id    ON entity_schemas TYPE record<projects> VALUE fn::normalize_project_id($value);
DEFINE FIELD OVERWRITE type_key      ON entity_schemas TYPE string;
DEFINE FIELD OVERWRITE type_name     ON entity_schemas TYPE string;
DEFINE FIELD OVERWRITE icon          ON entity_schemas TYPE string;
DEFINE FIELD OVERWRITE color         ON entity_schemas TYPE string;
DEFINE FIELD OVERWRITE fields_schema ON entity_schemas TYPE array<object> FLEXIBLE DEFAULT [] VALUE IF $value = NONE OR $value = NULL THEN [] ELSE $value END;
DEFINE FIELD OVERWRITE full_schema   ON entity_schemas TYPE option<object | null> FLEXIBLE;
DEFINE FIELD OVERWRITE created_at    ON entity_schemas TYPE datetime DEFAULT time::now();

-- 10. ИСТОРИЯ СХЕМ
DEFINE TABLE OVERWRITE schema_history SCHEMAFULL;
DEFINE FIELD OVERWRITE schema_id  ON schema_history TYPE record<entity_schemas>;
DEFINE FIELD OVERWRITE type_key   ON schema_history TYPE string;
DEFINE FIELD OVERWRITE project_id ON schema_history TYPE record<projects> VALUE fn::normalize_project_id($value);
DEFINE FIELD OVERWRITE snapshot   ON schema_history TYPE object FLEXIBLE DEFAULT {};
DEFINE FIELD OVERWRITE saved_at   ON schema_history TYPE datetime DEFAULT time::now();
DEFINE FIELD OVERWRITE is_pinned  ON schema_history TYPE bool DEFAULT false;
DEFINE FIELD OVERWRITE commit_msg ON schema_history TYPE option<string | null>;

-- 11. СУЩНОСТИ ЛОРА
DEFINE TABLE OVERWRITE entities SCHEMAFULL CHANGEFEED 30d;
DEFINE FIELD OVERWRITE project_id   ON entities TYPE record<projects> VALUE fn::normalize_project_id($value);
DEFINE FIELD OVERWRITE entity_type  ON entities TYPE string;
DEFINE FIELD OVERWRITE name         ON entities TYPE string;
DEFINE FIELD OVERWRITE description  ON entities TYPE option<string | null>;
DEFINE FIELD OVERWRITE attributes   ON entities TYPE object FLEXIBLE DEFAULT {};
DEFINE FIELD OVERWRITE tags         ON entities TYPE array<string> DEFAULT [] VALUE IF $value = NONE OR $value = NULL THEN [] ELSE $value END;
DEFINE FIELD OVERWRITE embeddings   ON entities TYPE object FLEXIBLE DEFAULT {};
DEFINE FIELD OVERWRITE created_at   ON entities TYPE option<datetime | null> DEFAULT time::now();
DEFINE FIELD OVERWRITE updated_at   ON entities TYPE option<datetime | null> DEFAULT time::now();

-- 12. СХЕМЫ ТИПОВ СВЯЗЕЙ
DEFINE TABLE OVERWRITE relation_schemas SCHEMAFULL;
DEFINE FIELD OVERWRITE project_id ON relation_schemas TYPE record<projects> VALUE fn::normalize_project_id($value);
DEFINE FIELD OVERWRITE rel_key    ON relation_schemas TYPE string;
DEFINE FIELD OVERWRITE rel_name   ON relation_schemas TYPE string;
DEFINE FIELD OVERWRITE icon       ON relation_schemas TYPE string;
DEFINE FIELD OVERWRITE color      ON relation_schemas TYPE string;
DEFINE FIELD OVERWRITE directed   ON relation_schemas TYPE bool DEFAULT true;
DEFINE FIELD OVERWRITE from_types ON relation_schemas TYPE array<string> DEFAULT [] VALUE IF $value = NONE OR $value = NULL THEN [] ELSE $value END;
DEFINE FIELD OVERWRITE to_types   ON relation_schemas TYPE array<string> DEFAULT [] VALUE IF $value = NONE OR $value = NULL THEN [] ELSE $value END;

-- 13. СВЯЗИ СУЩНОСТЕЙ
DEFINE TABLE OVERWRITE entity_rel TYPE RELATION IN entities OUT entities SCHEMAFULL;
DEFINE FIELD OVERWRITE project_id     ON entity_rel TYPE record<projects> VALUE fn::normalize_project_id($value);
DEFINE FIELD OVERWRITE rel_type       ON entity_rel TYPE string;
DEFINE FIELD OVERWRITE description    ON entity_rel TYPE option<string | null>;
DEFINE FIELD OVERWRITE strength       ON entity_rel TYPE option<int | null>;
DEFINE FIELD OVERWRITE attributes     ON entity_rel TYPE object FLEXIBLE DEFAULT {};
DEFINE FIELD OVERWRITE start_volume   ON entity_rel TYPE option<record<volumes> | null>;
DEFINE FIELD OVERWRITE start_chapter  ON entity_rel TYPE option<record<chapters> | null>;
DEFINE FIELD OVERWRITE end_volume     ON entity_rel TYPE option<record<volumes> | null>;
DEFINE FIELD OVERWRITE end_chapter    ON entity_rel TYPE option<record<chapters> | null>;
DEFINE FIELD OVERWRITE is_auto_extend ON entity_rel TYPE bool DEFAULT false;
DEFINE FIELD OVERWRITE created_at     ON entity_rel TYPE datetime DEFAULT time::now();

-- 14. УЧАСТИЕ В ГЛАВАХ
DEFINE TABLE OVERWRITE appears_in TYPE RELATION IN entities OUT chapters SCHEMAFULL;
DEFINE FIELD OVERWRITE project_id ON appears_in TYPE record<projects> VALUE fn::normalize_project_id($value);
DEFINE FIELD OVERWRITE source     ON appears_in TYPE string DEFAULT 'mention'; -- 'mention' | 'manual' | 'scene'
DEFINE FIELD OVERWRITE role       ON appears_in TYPE option<string | null>;
DEFINE FIELD OVERWRITE notes      ON appears_in TYPE option<string | null>;
DEFINE FIELD OVERWRITE created_at ON appears_in TYPE datetime DEFAULT time::now();

-- 15. ПЛАНЫ
DEFINE TABLE OVERWRITE plans SCHEMAFULL;
DEFINE FIELD OVERWRITE project_id  ON plans TYPE record<projects> VALUE fn::normalize_project_id($value);
DEFINE FIELD OVERWRITE title       ON plans TYPE string;
DEFINE FIELD OVERWRITE parent_ref  ON plans TYPE option<record<chapters> | record<volumes> | record<plans> | null>;
DEFINE FIELD OVERWRITE parent_type ON plans TYPE string;
DEFINE FIELD OVERWRITE sort_order  ON plans TYPE int DEFAULT 0;
DEFINE FIELD OVERWRITE completed   ON plans TYPE bool DEFAULT false;
DEFINE FIELD OVERWRITE created_at  ON plans TYPE datetime DEFAULT time::now();
DEFINE FIELD OVERWRITE updated_at  ON plans TYPE datetime DEFAULT time::now();

-- 16. ТАЙМЛАЙН СОБЫТИЙ
DEFINE TABLE OVERWRITE timeline_events SCHEMAFULL;
DEFINE FIELD OVERWRITE project_id    ON timeline_events TYPE record<projects> VALUE fn::normalize_project_id($value);
DEFINE FIELD OVERWRITE title         ON timeline_events TYPE string;
DEFINE FIELD OVERWRITE description   ON timeline_events TYPE option<string | null>;
DEFINE FIELD OVERWRITE m_abs         ON timeline_events TYPE int; -- Золотой эталон абсолютной минуты
DEFINE FIELD OVERWRITE calendar_id   ON timeline_events TYPE record<calendars>;
DEFINE FIELD OVERWRITE block_id      ON timeline_events TYPE option<string | null>;
DEFINE FIELD OVERWRITE created_at    ON timeline_events TYPE datetime DEFAULT time::now();

-- 17. РАСКРЫТИЕ СОБЫТИЙ В ГЛАВАХ (M:N СВЯЗЬ DIEGETIC СОБЫТИЙ С ГЛАВАМИ ЧТЕНИЯ)
DEFINE TABLE OVERWRITE revealed_in TYPE RELATION IN timeline_events OUT chapters SCHEMAFULL;
DEFINE FIELD OVERWRITE project_id ON revealed_in TYPE record<projects> VALUE fn::normalize_project_id($value);
DEFINE FIELD OVERWRITE pov_id     ON revealed_in TYPE option<record<entities> | null>; -- От чьего лица раскрыто
DEFINE FIELD OVERWRITE kind       ON revealed_in TYPE string DEFAULT 'direct'; -- 'direct' | 'flashback' | 'mention' | 'rumor'
DEFINE FIELD OVERWRITE block_id   ON revealed_in TYPE option<string | null>;
DEFINE FIELD OVERWRITE created_at ON revealed_in TYPE datetime DEFAULT time::now();

-- 18. УЧАСТИЕ В СОБЫТИЯХ ТАЙМЛАЙНА
DEFINE TABLE OVERWRITE participates_in TYPE RELATION IN entities OUT timeline_events SCHEMAFULL;
DEFINE FIELD OVERWRITE project_id ON participates_in TYPE option<record<projects> | null> VALUE IF $value != NONE AND $value != NULL { fn::normalize_project_id($value) } ELSE { NULL };
DEFINE FIELD OVERWRITE role       ON participates_in TYPE option<string | null>;
DEFINE FIELD OVERWRITE notes      ON participates_in TYPE option<string | null>;
DEFINE FIELD OVERWRITE created_at ON participates_in TYPE datetime DEFAULT time::now();

-- 19. РЕВИЗИИ СУЩНОСТЕЙ
DEFINE TABLE OVERWRITE entity_revisions SCHEMAFULL;
DEFINE FIELD OVERWRITE target_id   ON entity_revisions TYPE record<entities>;
DEFINE FIELD OVERWRITE project_id  ON entity_revisions TYPE record<projects> VALUE fn::normalize_project_id($value);
DEFINE FIELD OVERWRITE content     ON entity_revisions TYPE object FLEXIBLE DEFAULT {};
DEFINE FIELD OVERWRITE commit_msg  ON entity_revisions TYPE option<string | null>;
DEFINE FIELD OVERWRITE created_at  ON entity_revisions TYPE datetime DEFAULT time::now();
DEFINE FIELD OVERWRITE is_pinned   ON entity_revisions TYPE bool DEFAULT false;

-- 20. РЕВИЗИИ СВЯЗЕЙ СУЩНОСТЕЙ
DEFINE TABLE OVERWRITE entity_rel_revisions SCHEMAFULL;
DEFINE FIELD OVERWRITE target_id   ON entity_rel_revisions TYPE record<entity_rel>;
DEFINE FIELD OVERWRITE project_id  ON entity_rel_revisions TYPE record<projects> VALUE fn::normalize_project_id($value);
DEFINE FIELD OVERWRITE in_id       ON entity_rel_revisions TYPE record<entities>;
DEFINE FIELD OVERWRITE out_id      ON entity_rel_revisions TYPE record<entities>;
DEFINE FIELD OVERWRITE action      ON entity_rel_revisions TYPE string; -- 'CREATE' | 'UPDATE' | 'DELETE'
DEFINE FIELD OVERWRITE content     ON entity_rel_revisions TYPE object FLEXIBLE DEFAULT {};
DEFINE FIELD OVERWRITE commit_msg  ON entity_rel_revisions TYPE option<string | null>;
DEFINE FIELD OVERWRITE created_at  ON entity_rel_revisions TYPE datetime DEFAULT time::now();

-- 21. РЕВИЗИИ ГЛАВ РУКОПИСИ
DEFINE TABLE OVERWRITE chapter_revisions SCHEMAFULL;
DEFINE FIELD OVERWRITE target_id   ON chapter_revisions TYPE record<chapters>;
DEFINE FIELD OVERWRITE project_id  ON chapter_revisions TYPE record<projects> VALUE fn::normalize_project_id($value);
DEFINE FIELD OVERWRITE content     ON chapter_revisions TYPE object FLEXIBLE DEFAULT {};
DEFINE FIELD OVERWRITE commit_msg  ON chapter_revisions TYPE option<string | null>;
DEFINE FIELD OVERWRITE created_at  ON chapter_revisions TYPE datetime DEFAULT time::now();
DEFINE FIELD OVERWRITE is_pinned   ON chapter_revisions TYPE bool DEFAULT false;

-- 22. СЮЖЕТНЫЕ ОБЕЩАНИЯ / НАРРАТИВНЫЕ БЛОКИ
DEFINE TABLE OVERWRITE plot_promises SCHEMAFULL;
DEFINE FIELD OVERWRITE project_id          ON plot_promises TYPE record<projects> VALUE fn::normalize_project_id($value);
DEFINE FIELD OVERWRITE chapter_id          ON plot_promises TYPE record<chapters>;
DEFINE FIELD OVERWRITE kind                ON plot_promises TYPE string; -- 'gun' | 'foreshadowing' | 'mystery' | 'question' | 'scene' | 'conflict'
DEFINE FIELD OVERWRITE quote               ON plot_promises TYPE string;
DEFINE FIELD OVERWRITE paragraph_index     ON plot_promises TYPE int DEFAULT 1;
DEFINE FIELD OVERWRITE block_id            ON plot_promises TYPE option<string | null>;
DEFINE FIELD OVERWRITE note                ON plot_promises TYPE option<string | null>;
DEFINE FIELD OVERWRITE status              ON plot_promises TYPE string DEFAULT 'planted'; -- 'planted' | 'developed' | 'resolved'
DEFINE FIELD OVERWRITE progressions        ON plot_promises TYPE array<object> FLEXIBLE DEFAULT [] VALUE IF $value = NONE OR $value = NULL THEN [] ELSE $value END;
DEFINE FIELD OVERWRITE resolution          ON plot_promises TYPE option<object | null> FLEXIBLE;
DEFINE FIELD OVERWRITE resolved_in_volume  ON plot_promises TYPE option<record<volumes> | string | null>;
DEFINE FIELD OVERWRITE resolved_in_chapter ON plot_promises TYPE option<record<chapters> | string | null>;
DEFINE FIELD OVERWRITE participant_ids     ON plot_promises TYPE array<record<entities> | record<characters> | string> DEFAULT [] VALUE IF $value = NONE OR $value = NULL THEN [] ELSE $value END;
DEFINE FIELD OVERWRITE location_id         ON plot_promises TYPE option<record<entities> | string | null>;
DEFINE FIELD OVERWRITE timeline_event_id   ON plot_promises TYPE option<record<timeline_events> | string | null>;
DEFINE FIELD OVERWRITE arc_id              ON plot_promises TYPE option<record<story_arcs> | string | null>;
DEFINE FIELD OVERWRITE arc_phase           ON plot_promises TYPE option<string | null>
  ASSERT $value IN [NONE, NULL, 'setup', 'escalation', 'climax', 'resolution'];
DEFINE FIELD OVERWRITE arcs                ON plot_promises TYPE array<object> FLEXIBLE DEFAULT [] VALUE IF $value = NONE OR $value = NULL THEN [] ELSE $value END;
DEFINE FIELD OVERWRITE m_abs               ON plot_promises TYPE option<int | null>;
DEFINE FIELD OVERWRITE calendar_id         ON plot_promises TYPE option<record<calendars> | string | null>;
DEFINE FIELD OVERWRITE date_fields         ON plot_promises TYPE option<object | null> FLEXIBLE;
DEFINE FIELD OVERWRITE created_at          ON plot_promises TYPE datetime DEFAULT time::now();
DEFINE FIELD OVERWRITE updated_at          ON plot_promises TYPE datetime DEFAULT time::now();
