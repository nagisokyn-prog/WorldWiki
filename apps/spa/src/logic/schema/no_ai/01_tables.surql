-- ==============================================================================
-- 01_TABLES.SURQL — ТАБЛИЦЫ И ПОЛЯ БАЗОВОГО ЯДРА (BASE & ULTRA)
-- ==============================================================================
-- СОГЛАШЕНИЯ СХЕМЫ (LPG / ISO GQL / 3NF модель):
-- 1. Иерархия владения строго древовидная (DAG, без транзитивного project_id):
--    - projects -> volumes -> chapters -> text_blocks
--    - projects -> entity_schemas -> entities
--    - projects -> planets -> calendars
-- 2. Задачи планировщика (todos) нормализованы (3NF) с полиморфным owner_id:
--    - todos -> record<volumes | chapters | story_arcs>
-- 3. Время вселенной (timeline_events) фиксирует абсолютную минуту m_abs в календаре.
--    Связь рукописи со временем осуществляется строго через нарративный хаб (plot_promises).
-- 4. Сущности лора (entities) несут канонический текст статьи (description: option<string>)
--    для BM25 поиска и RAG, встроенный массив тегов (tags: array<string>) и динамические
--    свойства (attributes: object FLEXIBLE).
-- 5. Графовые связи (TYPE RELATION):
--    - contains: projects | volumes -> volumes | chapters
--    - appears_in: entities -> text_blocks (синтаксический уровень ((Сущность)))
--    - participant_of: entities -> plot_promises (драматургические действующие лица)
--    - advances_arc: chapters | plot_promises -> story_arcs (продвижение фаз арок в главах и сценах)
--    - occurs_at: plot_promises -> timeline_events (темпоральная фиксация сцен)
--    - promise_milestones: plot_promises -> text_blocks (вехи жизненного цикла ружья)
--    - entity_rel: entities -> entities (межсущностные семантические связи)
--    - participates_in: entities -> timeline_events (хроника участия в истории лора)
-- ==============================================================================

-- 1. ПРОЕКТЫ / ЛИТЕРАТУРНЫЕ ВСЕЛЕННЫЕ
DEFINE TABLE OVERWRITE projects SCHEMAFULL;
DEFINE FIELD OVERWRITE name        ON projects TYPE string;
DEFINE FIELD OVERWRITE type        ON projects TYPE option<string | null>;
DEFINE FIELD OVERWRITE genres      ON projects TYPE array<string> DEFAULT [] VALUE IF $value = NONE OR $value = NULL THEN [] ELSE $value END;
DEFINE FIELD OVERWRITE cover_image ON projects TYPE option<string | null>;
DEFINE FIELD OVERWRITE created_at  ON projects TYPE option<datetime | null> DEFAULT time::now();

-- 2. ИЕРАРХИЯ СЮЖЕТА (ГРАФОВЫЕ СВЯЗИ ОГЛАВЛЕНИЯ)
DEFINE TABLE OVERWRITE contains TYPE RELATION IN projects | volumes OUT volumes | chapters SCHEMAFULL;
DEFINE FIELD OVERWRITE sort_order ON contains TYPE number DEFAULT 0;

-- 3. ТОМА
DEFINE TABLE OVERWRITE volumes SCHEMAFULL;
DEFINE FIELD OVERWRITE project_id ON volumes TYPE record<projects> | string VALUE fn::normalize_project_id($value);
DEFINE FIELD OVERWRITE title      ON volumes TYPE string;

-- 4. ГЛАВЫ РУКОПИСИ
DEFINE TABLE OVERWRITE chapters SCHEMAFULL CHANGEFEED 30d;
DEFINE FIELD OVERWRITE volume_id   ON chapters TYPE record<volumes>;
DEFINE FIELD OVERWRITE title       ON chapters TYPE string;
DEFINE FIELD OVERWRITE content     ON chapters TYPE string;
DEFINE FIELD OVERWRITE sort_order  ON chapters TYPE int DEFAULT 0;
DEFINE FIELD OVERWRITE word_count  ON chapters TYPE int DEFAULT 0;
DEFINE FIELD OVERWRITE embeddings  ON chapters TYPE object FLEXIBLE DEFAULT {};
DEFINE FIELD OVERWRITE created_at  ON chapters TYPE option<datetime | null> DEFAULT time::now();
DEFINE FIELD OVERWRITE updated_at  ON chapters TYPE option<datetime | null> DEFAULT time::now();

-- 5. СЮЖЕТНЫЕ АРКИ (СТОРИЛАЙНЫ)
DEFINE TABLE OVERWRITE story_arcs SCHEMAFULL;
DEFINE FIELD OVERWRITE project_id  ON story_arcs TYPE record<projects> | string VALUE fn::normalize_project_id($value);
DEFINE FIELD OVERWRITE title       ON story_arcs TYPE string;
DEFINE FIELD OVERWRITE status      ON story_arcs TYPE string DEFAULT 'in_progress'
  ASSERT $value IN ['planned', 'in_progress', 'completed', 'abandoned'];
DEFINE FIELD OVERWRITE created_at  ON story_arcs TYPE datetime DEFAULT time::now();
DEFINE FIELD OVERWRITE updated_at  ON story_arcs TYPE datetime DEFAULT time::now();

-- 6. БЛОКИ ТЕКСТА (АТОМАРНЫЙ ТЕКСТ РУКОПИСИ)
DEFINE TABLE OVERWRITE text_blocks SCHEMAFULL;
DEFINE FIELD OVERWRITE chapter_id  ON text_blocks TYPE record<chapters>;
DEFINE FIELD OVERWRITE block_type  ON text_blocks TYPE string DEFAULT 'description';
DEFINE FIELD OVERWRITE order_index ON text_blocks TYPE int DEFAULT 0;
DEFINE FIELD OVERWRITE content     ON text_blocks TYPE string;
DEFINE FIELD OVERWRITE embeddings  ON text_blocks TYPE object FLEXIBLE DEFAULT {};
DEFINE FIELD OVERWRITE created_at  ON text_blocks TYPE datetime DEFAULT time::now();

-- 7. ПЛАНЕТЫ (АСТРОФИЗИЧЕСКИЙ БАЗИС)
DEFINE TABLE OVERWRITE planets SCHEMAFULL;
DEFINE FIELD OVERWRITE project_id       ON planets TYPE record<projects> | string VALUE fn::normalize_project_id($value);
DEFINE FIELD OVERWRITE name             ON planets TYPE string;
DEFINE FIELD OVERWRITE ticks_per_day    ON planets TYPE int;
DEFINE FIELD OVERWRITE axial_tilt_mdeg  ON planets TYPE option<int | null>;
DEFINE FIELD OVERWRITE orbit_days_num   ON planets TYPE option<int | null>;
DEFINE FIELD OVERWRITE orbit_days_den   ON planets TYPE option<int | null>;
DEFINE FIELD OVERWRITE moons            ON planets TYPE array<object> FLEXIBLE DEFAULT [] VALUE IF $value = NONE OR $value = NULL THEN [] ELSE $value END;
DEFINE FIELD OVERWRITE created_at       ON planets TYPE datetime DEFAULT time::now();
DEFINE FIELD OVERWRITE updated_at       ON planets TYPE datetime DEFAULT time::now();

-- 8. КАЛЕНДАРИ И ЭПОХИ
DEFINE TABLE OVERWRITE calendars SCHEMAFULL;
DEFINE FIELD OVERWRITE planet_id   ON calendars TYPE record<planets>;
DEFINE FIELD OVERWRITE name        ON calendars TYPE string;
DEFINE FIELD OVERWRITE description ON calendars TYPE option<string | null>;
DEFINE FIELD OVERWRITE data        ON calendars TYPE object FLEXIBLE DEFAULT {};
DEFINE FIELD OVERWRITE is_default  ON calendars TYPE bool DEFAULT false;
DEFINE FIELD OVERWRITE is_master   ON calendars TYPE bool DEFAULT false;
DEFINE FIELD OVERWRITE created_at  ON calendars TYPE datetime DEFAULT time::now();
DEFINE FIELD OVERWRITE updated_at  ON calendars TYPE datetime DEFAULT time::now();

-- 9. МЕТА-СХЕМЫ СУЩНОСТЕЙ ЛОРА
DEFINE TABLE OVERWRITE entity_schemas SCHEMAFULL;
DEFINE FIELD OVERWRITE project_id    ON entity_schemas TYPE record<projects> | string VALUE fn::normalize_project_id($value);
DEFINE FIELD OVERWRITE type_key      ON entity_schemas TYPE string;
DEFINE FIELD OVERWRITE type_name     ON entity_schemas TYPE string;
DEFINE FIELD OVERWRITE fields_schema ON entity_schemas TYPE array<object> FLEXIBLE DEFAULT [] VALUE IF $value = NONE OR $value = NULL THEN [] ELSE $value END;
DEFINE FIELD OVERWRITE full_schema   ON entity_schemas TYPE option<object | null> FLEXIBLE;
DEFINE FIELD OVERWRITE created_at    ON entity_schemas TYPE datetime DEFAULT time::now();

-- 10. ИСТОРИЯ ВЕРСИЙ МЕТА-СХЕМ
DEFINE TABLE OVERWRITE schema_history SCHEMAFULL;
DEFINE FIELD OVERWRITE schema_id  ON schema_history TYPE record<entity_schemas>;
DEFINE FIELD OVERWRITE type_key   ON schema_history TYPE string;
DEFINE FIELD OVERWRITE project_id ON schema_history TYPE record<projects> | string VALUE fn::normalize_project_id($value);
DEFINE FIELD OVERWRITE snapshot   ON schema_history TYPE object FLEXIBLE DEFAULT {};
DEFINE FIELD OVERWRITE saved_at   ON schema_history TYPE datetime DEFAULT time::now();
DEFINE FIELD OVERWRITE is_pinned  ON schema_history TYPE bool DEFAULT false;
DEFINE FIELD OVERWRITE commit_msg ON schema_history TYPE option<string | null>;

-- 11. СУЩНОСТИ ЭНЦИКЛОПЕДИИ ЛОРА
DEFINE TABLE OVERWRITE entities SCHEMAFULL CHANGEFEED 30d;
DEFINE FIELD OVERWRITE schema_id    ON entities TYPE record<entity_schemas>;
DEFINE FIELD OVERWRITE name         ON entities TYPE string;
DEFINE FIELD OVERWRITE description  ON entities TYPE option<string | null>;
DEFINE FIELD OVERWRITE tags         ON entities TYPE array<string> DEFAULT [] VALUE IF $value = NONE OR $value = NULL THEN [] ELSE $value END;
DEFINE FIELD OVERWRITE attributes   ON entities TYPE object FLEXIBLE DEFAULT {};
DEFINE FIELD OVERWRITE embeddings   ON entities TYPE object FLEXIBLE DEFAULT {};
DEFINE FIELD OVERWRITE created_at   ON entities TYPE option<datetime | null> DEFAULT time::now();
DEFINE FIELD OVERWRITE updated_at   ON entities TYPE option<datetime | null> DEFAULT time::now();

-- 12. СХЕМЫ ТИПОВ СВЯЗЕЙ МЕЖДУ СУЩНОСТЯМИ
DEFINE TABLE OVERWRITE relation_schemas SCHEMAFULL;
DEFINE FIELD OVERWRITE project_id ON relation_schemas TYPE record<projects> | string VALUE fn::normalize_project_id($value);
DEFINE FIELD OVERWRITE rel_key    ON relation_schemas TYPE string;
DEFINE FIELD OVERWRITE rel_name   ON relation_schemas TYPE string;
DEFINE FIELD OVERWRITE icon       ON relation_schemas TYPE string;
DEFINE FIELD OVERWRITE color      ON relation_schemas TYPE string;
DEFINE FIELD OVERWRITE from_types ON relation_schemas TYPE array<string> DEFAULT [] VALUE IF $value = NONE OR $value = NULL THEN [] ELSE $value END;
DEFINE FIELD OVERWRITE to_types   ON relation_schemas TYPE array<string> DEFAULT [] VALUE IF $value = NONE OR $value = NULL THEN [] ELSE $value END;

-- 13. ГРАФОВЫЕ СВЯЗИ МЕЖДУ СУЩНОСТЯМИ
DEFINE TABLE OVERWRITE entity_rel TYPE RELATION IN entities OUT entities SCHEMAFULL;
DEFINE FIELD OVERWRITE project_id     ON entity_rel TYPE record<projects> | string VALUE fn::normalize_project_id($value);
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

-- 14. СИНТАКСИЧЕСКОЕ УЧАСТИЕ СУЩНОСТЕЙ В БЛОКАХ ТЕКСТА
DEFINE TABLE OVERWRITE appears_in TYPE RELATION IN entities OUT chapters | text_blocks SCHEMAFULL;
DEFINE FIELD OVERWRITE project_id ON appears_in TYPE record<projects> | string VALUE fn::normalize_project_id($value);
DEFINE FIELD OVERWRITE source     ON appears_in TYPE string DEFAULT 'mention'
  ASSERT $value IN ['mention', 'manual', 'scene'];
DEFINE FIELD OVERWRITE role       ON appears_in TYPE option<string | null>;
DEFINE FIELD OVERWRITE notes      ON appears_in TYPE option<string | null>;
DEFINE FIELD OVERWRITE created_at ON appears_in TYPE datetime DEFAULT time::now();

-- 15. ЗАДАЧИ И ЧЕК-ЛИСТЫ ПЛАНИРОВЩИКА (3NF, БЕЗ ЦИКЛОВ)
DEFINE TABLE OVERWRITE todos SCHEMAFULL;
DEFINE FIELD OVERWRITE owner_id    ON todos TYPE record<volumes | chapters | story_arcs>;
DEFINE FIELD OVERWRITE text        ON todos TYPE string;
DEFINE FIELD OVERWRITE is_done     ON todos TYPE bool DEFAULT false;
DEFINE FIELD OVERWRITE sort_order  ON todos TYPE int DEFAULT 0;
DEFINE FIELD OVERWRITE created_at  ON todos TYPE datetime DEFAULT time::now();
DEFINE FIELD OVERWRITE updated_at  ON todos TYPE datetime DEFAULT time::now();

-- 16. СОБЫТИЯ ТАЙМЛАЙНА ВСЕЛЕННОЙ
DEFINE TABLE OVERWRITE timeline_events SCHEMAFULL;
DEFINE FIELD OVERWRITE project_id  ON timeline_events TYPE record<projects> | string VALUE fn::normalize_project_id($value);
DEFINE FIELD OVERWRITE title       ON timeline_events TYPE string;
DEFINE FIELD OVERWRITE description ON timeline_events TYPE option<string | null>;
DEFINE FIELD OVERWRITE m_abs       ON timeline_events TYPE int; -- Золотой эталон абсолютной минуты
DEFINE FIELD OVERWRITE calendar_id ON timeline_events TYPE record<calendars>;
DEFINE FIELD OVERWRITE created_at  ON timeline_events TYPE datetime DEFAULT time::now();

-- 17. РОЛЕВОЕ УЧАСТИЕ СУЩНОСТЕЙ В СОБЫТИЯХ ТАЙМЛАЙНА (ХРОНИКА ЛОРА)
DEFINE TABLE OVERWRITE participates_in TYPE RELATION IN entities OUT timeline_events SCHEMAFULL;
DEFINE FIELD OVERWRITE project_id ON participates_in TYPE record<projects> | string VALUE fn::normalize_project_id($value);
DEFINE FIELD OVERWRITE role       ON participates_in TYPE option<string | null>;
DEFINE FIELD OVERWRITE notes      ON participates_in TYPE option<string | null>;
DEFINE FIELD OVERWRITE created_at ON participates_in TYPE datetime DEFAULT time::now();

-- 18. РЕВИЗИИ СУЩНОСТЕЙ ЛОРА (БЕЗ ВЕКТОРОВ ЭМБЕДДИНГОВ)
DEFINE TABLE OVERWRITE entity_revisions SCHEMAFULL;
DEFINE FIELD OVERWRITE target_id   ON entity_revisions TYPE record<entities>;
DEFINE FIELD OVERWRITE project_id  ON entity_revisions TYPE record<projects> | string VALUE fn::normalize_project_id($value);
DEFINE FIELD OVERWRITE content     ON entity_revisions TYPE object FLEXIBLE DEFAULT {};
DEFINE FIELD OVERWRITE commit_msg  ON entity_revisions TYPE option<string | null>;
DEFINE FIELD OVERWRITE created_at  ON entity_revisions TYPE datetime DEFAULT time::now();
DEFINE FIELD OVERWRITE is_pinned   ON entity_revisions TYPE bool DEFAULT false;

-- 19. РЕВИЗИИ ГРАФОВЫХ СВЯЗЕЙ СУЩНОСТЕЙ
DEFINE TABLE OVERWRITE entity_rel_revisions SCHEMAFULL;
DEFINE FIELD OVERWRITE target_id   ON entity_rel_revisions TYPE record<entity_rel>;
DEFINE FIELD OVERWRITE project_id  ON entity_rel_revisions TYPE record<projects> | string VALUE fn::normalize_project_id($value);
DEFINE FIELD OVERWRITE in_id       ON entity_rel_revisions TYPE record<entities>;
DEFINE FIELD OVERWRITE out_id      ON entity_rel_revisions TYPE record<entities>;
DEFINE FIELD OVERWRITE action      ON entity_rel_revisions TYPE string
  ASSERT $value IN ['CREATE', 'UPDATE', 'DELETE'];
DEFINE FIELD OVERWRITE content     ON entity_rel_revisions TYPE object FLEXIBLE DEFAULT {};
DEFINE FIELD OVERWRITE commit_msg  ON entity_rel_revisions TYPE option<string | null>;
DEFINE FIELD OVERWRITE created_at  ON entity_rel_revisions TYPE datetime DEFAULT time::now();

-- 20. РЕВИЗИИ ТЕКСТА ГЛАВ РУКОПИСИ
DEFINE TABLE OVERWRITE chapter_revisions SCHEMAFULL;
DEFINE FIELD OVERWRITE target_id   ON chapter_revisions TYPE record<chapters>;
DEFINE FIELD OVERWRITE project_id  ON chapter_revisions TYPE record<projects> | string VALUE fn::normalize_project_id($value);
DEFINE FIELD OVERWRITE content     ON chapter_revisions TYPE object FLEXIBLE DEFAULT {};
DEFINE FIELD OVERWRITE commit_msg  ON chapter_revisions TYPE option<string | null>;
DEFINE FIELD OVERWRITE created_at  ON chapter_revisions TYPE datetime DEFAULT time::now();
DEFINE FIELD OVERWRITE is_pinned   ON chapter_revisions TYPE bool DEFAULT false;

-- 21. НАРРАТИВНЫЕ УЗЛЫ И СЮЖЕТНЫЕ ОБЕЩАНИЯ (ЧЕХОВСКИЕ РУЖЬЯ / СЦЕНАРНЫЕ ЕДИНИЦЫ)
DEFINE TABLE OVERWRITE plot_promises SCHEMAFULL;
DEFINE FIELD OVERWRITE project_id        ON plot_promises TYPE record<projects> | string VALUE fn::normalize_project_id($value);
DEFINE FIELD OVERWRITE chapter_id        ON plot_promises TYPE option<record<chapters> | null>;
DEFINE FIELD OVERWRITE paragraph_index   ON plot_promises TYPE option<int | null>;
DEFINE FIELD OVERWRITE block_id          ON plot_promises TYPE option<string | null>;
DEFINE FIELD OVERWRITE kind              ON plot_promises TYPE string
  ASSERT $value IN ['gun', 'foreshadowing', 'mystery', 'question', 'conflict', 'scene'];
DEFINE FIELD OVERWRITE title             ON plot_promises TYPE string;
DEFINE FIELD OVERWRITE note              ON plot_promises TYPE option<string | null>;
DEFINE FIELD OVERWRITE status            ON plot_promises TYPE string DEFAULT 'planted'
  ASSERT $value IN ['planted', 'developed', 'resolved'];
DEFINE FIELD OVERWRITE location_id       ON plot_promises TYPE option<record<entities> | string | null>;
DEFINE FIELD OVERWRITE timeline_event_id ON plot_promises TYPE option<record<timeline_events> | null>;
DEFINE FIELD OVERWRITE created_at        ON plot_promises TYPE datetime DEFAULT time::now();
DEFINE FIELD OVERWRITE updated_at        ON plot_promises TYPE datetime DEFAULT time::now();

-- 21.1. ВЕХИ ЖИЗНЕННОГО ЦИКЛА РУЖЬЯ В ТЕКСТЕ РУКОПИСИ
DEFINE TABLE OVERWRITE promise_milestones TYPE RELATION IN plot_promises OUT text_blocks SCHEMAFULL;
DEFINE FIELD OVERWRITE project_id ON promise_milestones TYPE record<projects> | string VALUE fn::normalize_project_id($value);
DEFINE FIELD OVERWRITE stage      ON promise_milestones TYPE string
  ASSERT $value IN ['plant', 'progression', 'resolution'];
DEFINE FIELD OVERWRITE quote      ON promise_milestones TYPE string;
DEFINE FIELD OVERWRITE note       ON promise_milestones TYPE option<string | null>;
DEFINE FIELD OVERWRITE created_at ON promise_milestones TYPE datetime DEFAULT time::now();

-- 21.2. ДЕЙСТВУЮЩИЕ ЛИЦА НАРРАТИВНОГО УЗЛА (ПЕРСОНАЖИ, АРТЕФАКТЫ, ЛОКАЦИИ)
DEFINE TABLE OVERWRITE participant_of TYPE RELATION IN entities OUT plot_promises SCHEMAFULL;
DEFINE FIELD OVERWRITE project_id ON participant_of TYPE record<projects> | string VALUE fn::normalize_project_id($value);
DEFINE FIELD OVERWRITE role       ON participant_of TYPE option<string | null>;
DEFINE FIELD OVERWRITE created_at ON participant_of TYPE datetime DEFAULT time::now();

-- 21.3. ДИНАМИКА СЮЖЕТНЫХ АРОК В РАМКАХ НАРРАТИВНОГО УЗЛА И ГЛАВ
DEFINE TABLE OVERWRITE advances_arc TYPE RELATION IN chapters | plot_promises OUT story_arcs SCHEMAFULL;
DEFINE FIELD OVERWRITE project_id ON advances_arc TYPE record<projects> | string VALUE fn::normalize_project_id($value);
DEFINE FIELD OVERWRITE phase      ON advances_arc TYPE string ASSERT $value IN ['setup', 'escalation', 'climax', 'resolution'];
DEFINE FIELD OVERWRITE transition ON advances_arc TYPE option<string | null>;
DEFINE FIELD OVERWRITE created_at ON advances_arc TYPE datetime DEFAULT time::now();

-- 21.4. ДИЕГЕТИЧЕСКАЯ ПРИВЯЗКА НАРРАТИВНОГО УЗЛА К СОБЫТИЮ ШКАЛЫ ВРЕМЕНИ
DEFINE TABLE OVERWRITE occurs_at TYPE RELATION IN plot_promises OUT timeline_events SCHEMAFULL;
DEFINE FIELD OVERWRITE project_id  ON occurs_at TYPE record<projects> | string VALUE fn::normalize_project_id($value);
DEFINE FIELD OVERWRITE time_nature ON occurs_at TYPE string DEFAULT 'present'
  ASSERT $value IN ['present', 'flashback', 'flashforward', 'memory', 'dream'];
DEFINE FIELD OVERWRITE created_at  ON occurs_at TYPE datetime DEFAULT time::now();

-- 22. СИСТЕМНЫЕ МЕТАДАННЫЕ СХЕМЫ
DEFINE TABLE OVERWRITE system_meta SCHEMAFULL;
DEFINE FIELD OVERWRITE ddl_hash    ON system_meta TYPE string;
DEFINE FIELD OVERWRITE updated_at  ON system_meta TYPE datetime DEFAULT time::now();
