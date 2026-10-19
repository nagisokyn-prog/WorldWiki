-- ==============================================================================
-- 01_TABLES.SURQL — ТАБЛИЦЫ И ПОЛЯ БАЗОВОГО ЯДРА (BASE & ULTRA)
-- ==============================================================================
-- СОГЛАШЕНИЯ СХЕМЫ (LPG / ISO GQL модель):
-- 1. project_id есть у всех таблиц и означает владение проектом, а не связь.
-- 2. Связи двух видов: RELATION-таблицы (contains, advances_arc, occurs_at,
--    promise_milestones, tagged_with, plans_for, entity_rel, appears_in, 
--    revealed_in, participates_in, arc_entities, arc_chapters)
--    и структурные поля-ссылки record<...>.
-- 3. entities.schema_id -> entity_schemas (строгая типизация классов лора).
-- 4. Текст рукописи декомпозирован в text_blocks (семантические блоки/сцены).
-- 5. Время вселенной привязано к text_blocks (occurs_at) и timeline_events.
-- ==============================================================================
-- Включает:
-- 1. projects (Проекты)
-- 2. contains (Иерархия книги: Проект -> Тома -> Главы)
-- 3. volumes (Тома)
-- 4. chapters (Главы рукописи)
-- 5. story_arcs (Сюжетные арки / сторилайны)
-- 5.1. arc_entities (Связь арки с сущностями фокуса)
-- 5.2. arc_chapters (Охват глав сюжетной аркой)
-- 6. text_blocks (Семантические блоки текста / сцены)
-- 6.1. advances_arc (Продвижение фазы арки в блоке текста)
-- 6.2. occurs_at (Фиксация времени и диегетической природы сцены)
-- 7. tags (Теги лора)
-- 7.1. tagged_with (Тегирование сущностей)
-- 8. planets (Планеты)
-- 8.1. calendars (Календари и эпохи)
-- 9. entity_schemas (Мета-схемы классов сущностей лора)
-- 10. schema_history (История версий мета-схем)
-- 11. entities (Сущности лора / энциклопедии)
-- 12. relation_schemas (Схемы типов связей)
-- 13. entity_rel (Графовые связи между сущностями)
-- 14. appears_in (Связь участия сущностей в главах)
-- 15. plans (Планы и иерархические чек-листы)
-- 15.1. plans_for (Графовая привязка планов к томам, главам, аркам)
-- 16. timeline_events (События таймлайна с абсолютной минутой m_abs)
-- 17. revealed_in (Раскрытие событий таймлайна в главах рукописи)
-- 18. participates_in (Связь участия сущностей в событиях таймлайна)
-- 19. entity_revisions (История ревизий сущностей без векторов)
-- 20. entity_rel_revisions (История ревизий связей сущностей)
-- 21. chapter_revisions (История ревизий текста глав)
-- 22. plot_promises (Сюжетные обещания: чеховские ружья, тайны)
-- 22.1. promise_milestones (Жизненный цикл ружья в блоках текста)
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
DEFINE FIELD OVERWRITE sort_order ON contains TYPE number DEFAULT 0;

-- 3. ТОМА
DEFINE TABLE OVERWRITE volumes SCHEMAFULL;
DEFINE FIELD OVERWRITE title      ON volumes TYPE string;
DEFINE FIELD OVERWRITE project_id ON volumes TYPE record<projects> | string VALUE fn::normalize_project_id($value);

-- 4. ГЛАВЫ РУКОПИСИ
DEFINE TABLE OVERWRITE chapters SCHEMAFULL CHANGEFEED 30d;
DEFINE FIELD OVERWRITE project_id      ON chapters TYPE record<projects> | string VALUE fn::normalize_project_id($value);
DEFINE FIELD OVERWRITE title          ON chapters TYPE string;
DEFINE FIELD OVERWRITE content        ON chapters TYPE string;
DEFINE FIELD OVERWRITE summary        ON chapters TYPE option<string | null>;
DEFINE FIELD OVERWRITE sort_order      ON chapters TYPE int DEFAULT 0;
DEFINE FIELD OVERWRITE word_count      ON chapters TYPE int DEFAULT 0;
DEFINE FIELD OVERWRITE embeddings      ON chapters TYPE object FLEXIBLE DEFAULT {};
DEFINE FIELD OVERWRITE created_at      ON chapters TYPE option<datetime | null> DEFAULT time::now();
DEFINE FIELD OVERWRITE updated_at      ON chapters TYPE option<datetime | null> DEFAULT time::now();
DEFINE FIELD OVERWRITE footnotes       ON chapters TYPE object FLEXIBLE DEFAULT {};
DEFINE FIELD OVERWRITE timeline_events ON chapters TYPE array<object> FLEXIBLE DEFAULT [] VALUE IF $value = NONE OR $value = NULL THEN [] ELSE $value END;
DEFINE FIELD OVERWRITE participants    ON chapters TYPE array<string> DEFAULT [] VALUE IF $value = NONE OR $value = NULL THEN [] ELSE $value END;

-- 5. СЮЖЕТНЫЕ АРКИ (СТОРИЛАЙНЫ)
DEFINE TABLE OVERWRITE story_arcs SCHEMAFULL;
DEFINE FIELD OVERWRITE project_id    ON story_arcs TYPE record<projects> | string VALUE fn::normalize_project_id($value);
DEFINE FIELD OVERWRITE title         ON story_arcs TYPE string;
DEFINE FIELD OVERWRITE description   ON story_arcs TYPE option<string | null>;
DEFINE FIELD OVERWRITE arc_type      ON story_arcs TYPE string DEFAULT 'character'
  ASSERT $value IN ['character', 'event', 'relationship', 'theme'];
DEFINE FIELD OVERWRITE status        ON story_arcs TYPE string DEFAULT 'in_progress'
  ASSERT $value IN ['planned', 'in_progress', 'completed', 'abandoned'];
DEFINE FIELD OVERWRITE color         ON story_arcs TYPE option<string | null>;
DEFINE FIELD OVERWRITE created_at    ON story_arcs TYPE datetime DEFAULT time::now();
DEFINE FIELD OVERWRITE updated_at    ON story_arcs TYPE datetime DEFAULT time::now();

-- 5.1. СВЯЗЬ АРКА -> СУЩНОСТИ (ФОКУС АРКИ: персонажи, пары персонажей, фракции)
DEFINE TABLE OVERWRITE arc_entities TYPE RELATION IN story_arcs OUT entities SCHEMAFULL;
DEFINE FIELD OVERWRITE project_id ON arc_entities TYPE record<projects> | string VALUE fn::normalize_project_id($value);
DEFINE FIELD OVERWRITE role       ON arc_entities TYPE string DEFAULT 'focus'
  ASSERT $value IN ['protagonist', 'antagonist', 'love_interest', 'catalyst', 'victim', 'focus'];
DEFINE FIELD OVERWRITE notes      ON arc_entities TYPE option<string | null>;


-- 5.2. СВЯЗЬ АРКА -> ГЛАВЫ (ОХВАТ ГЛАВ СТОРИЛАЙНОМ)
DEFINE TABLE OVERWRITE arc_chapters TYPE RELATION IN story_arcs OUT chapters SCHEMAFULL;
DEFINE FIELD OVERWRITE project_id ON arc_chapters TYPE record<projects> | string VALUE fn::normalize_project_id($value);
DEFINE FIELD OVERWRITE sort_order ON arc_chapters TYPE int DEFAULT 0;
DEFINE FIELD OVERWRITE phase      ON arc_chapters TYPE option<string | null>
  ASSERT $value == NONE OR $value == NULL OR $value IN ['setup', 'escalation', 'climax', 'resolution'];

-- 6. БЛОКИ ТЕКСТА
DEFINE TABLE OVERWRITE text_blocks SCHEMAFULL;
DEFINE FIELD OVERWRITE project_id        ON text_blocks TYPE record<projects> | string VALUE fn::normalize_project_id($value);
DEFINE FIELD OVERWRITE chapter_id        ON text_blocks TYPE record<chapters>;
-- ВНИМАНИЕ: block_type намеренно БЕЗ ASSERT! Это открытый тег семантической разметки (open set),
-- принимающий как базовые теги ('description', 'dialogue', 'thought'), так и любые кастомные теги автора
-- из Tiptap WYSIWYG (data-semantic-tag: 'custom_action', 'whisper' и др.). Закрытый enum сломает расширяемость.
DEFINE FIELD OVERWRITE block_type        ON text_blocks TYPE string DEFAULT 'description';
DEFINE FIELD OVERWRITE order_index       ON text_blocks TYPE int DEFAULT 0;
DEFINE FIELD OVERWRITE content           ON text_blocks TYPE string;
DEFINE FIELD OVERWRITE arc_id            ON text_blocks TYPE option<record<story_arcs> | null>;
DEFINE FIELD OVERWRITE arc_phase         ON text_blocks TYPE option<string | null>
  ASSERT $value == NONE OR $value == NULL OR $value IN ['setup', 'escalation', 'climax', 'resolution'];
DEFINE FIELD OVERWRITE arc_transition    ON text_blocks TYPE option<string | null>;
DEFINE FIELD OVERWRITE timeline_event_id ON text_blocks TYPE option<record<timeline_events> | null>;
DEFINE FIELD OVERWRITE time_nature       ON text_blocks TYPE string DEFAULT 'present'
  ASSERT $value IN ['present', 'flashback', 'flashforward', 'memory', 'dream'];
DEFINE FIELD OVERWRITE embeddings        ON text_blocks TYPE object FLEXIBLE DEFAULT {};
DEFINE FIELD OVERWRITE created_at        ON text_blocks TYPE datetime DEFAULT time::now();

-- 6.1. ДИНАМИКА АРКИ В СЦЕНЕ (БЛОКЕ ТЕКСТА)
DEFINE TABLE OVERWRITE advances_arc TYPE RELATION IN text_blocks OUT story_arcs SCHEMAFULL;
DEFINE FIELD OVERWRITE project_id ON advances_arc TYPE record<projects> | string VALUE fn::normalize_project_id($value);
DEFINE FIELD OVERWRITE phase      ON advances_arc TYPE string ASSERT $value IN ['setup', 'escalation', 'climax', 'resolution'];
DEFINE FIELD OVERWRITE transition ON advances_arc TYPE option<string | null>;
DEFINE FIELD OVERWRITE created_at ON advances_arc TYPE datetime DEFAULT time::now();

-- 6.2. ВРЕМЯ ДЕЙСТВИЯ СЦЕНЫ (БЛОКА ТЕКСТА)
DEFINE TABLE OVERWRITE occurs_at TYPE RELATION IN text_blocks OUT timeline_events SCHEMAFULL;
DEFINE FIELD OVERWRITE project_id  ON occurs_at TYPE record<projects> | string VALUE fn::normalize_project_id($value);
DEFINE FIELD OVERWRITE time_nature ON occurs_at TYPE string DEFAULT 'present'
  ASSERT $value IN ['present', 'flashback', 'flashforward', 'memory', 'dream'];
DEFINE FIELD OVERWRITE created_at  ON occurs_at TYPE datetime DEFAULT time::now();

-- 7. ТЕГИ
DEFINE TABLE OVERWRITE tags SCHEMAFULL;
DEFINE FIELD OVERWRITE name       ON tags TYPE string;
DEFINE FIELD OVERWRITE color      ON tags TYPE string;
DEFINE FIELD OVERWRITE project_id ON tags TYPE record<projects> | string VALUE fn::normalize_project_id($value);

-- 7.1. ТЕГИРОВАНИЕ СУЩНОСТЕЙ ЛОРА
DEFINE TABLE OVERWRITE tagged_with TYPE RELATION IN entities OUT tags SCHEMAFULL;
DEFINE FIELD OVERWRITE project_id ON tagged_with TYPE record<projects> | string VALUE fn::normalize_project_id($value);
DEFINE FIELD OVERWRITE created_at ON tagged_with TYPE datetime DEFAULT time::now();

-- 8. ПЛАНЕТЫ
DEFINE TABLE OVERWRITE planets SCHEMAFULL;
DEFINE FIELD OVERWRITE name             ON planets TYPE string;
DEFINE FIELD OVERWRITE ticks_per_day    ON planets TYPE int;
DEFINE FIELD OVERWRITE axial_tilt_mdeg  ON planets TYPE option<int | null>;
DEFINE FIELD OVERWRITE orbit_days_num   ON planets TYPE option<int | null>;
DEFINE FIELD OVERWRITE orbit_days_den   ON planets TYPE option<int | null>;
DEFINE FIELD OVERWRITE moons            ON planets TYPE array<object> DEFAULT [] VALUE IF $value = NONE OR $value = NULL THEN [] ELSE $value END;
DEFINE FIELD OVERWRITE created_at       ON planets TYPE datetime DEFAULT time::now();
DEFINE FIELD OVERWRITE updated_at       ON planets TYPE datetime DEFAULT time::now();
DEFINE FIELD OVERWRITE project_id       ON planets TYPE record<projects> | string VALUE fn::normalize_project_id($value);

-- 8.1. КАЛЕНДАРИ
DEFINE TABLE OVERWRITE calendars SCHEMAFULL;
DEFINE FIELD OVERWRITE name        ON calendars TYPE string;
DEFINE FIELD OVERWRITE description ON calendars TYPE option<string | null>;
DEFINE FIELD OVERWRITE data        ON calendars TYPE object FLEXIBLE DEFAULT {};
DEFINE FIELD OVERWRITE is_default  ON calendars TYPE bool DEFAULT false;
DEFINE FIELD OVERWRITE is_master   ON calendars TYPE bool DEFAULT false;
DEFINE FIELD OVERWRITE planet_id   ON calendars TYPE option<record<planets> | null>;
DEFINE FIELD OVERWRITE created_at  ON calendars TYPE datetime DEFAULT time::now();
DEFINE FIELD OVERWRITE updated_at  ON calendars TYPE datetime DEFAULT time::now();
DEFINE FIELD OVERWRITE project_id  ON calendars TYPE record<projects> | string VALUE fn::normalize_project_id($value);

-- 9. МЕТА-СХЕМЫ СУЩНОСТЕЙ
DEFINE TABLE OVERWRITE entity_schemas SCHEMAFULL;
DEFINE FIELD OVERWRITE project_id    ON entity_schemas TYPE record<projects> | string VALUE fn::normalize_project_id($value);
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
DEFINE FIELD OVERWRITE project_id ON schema_history TYPE record<projects> | string VALUE fn::normalize_project_id($value);
DEFINE FIELD OVERWRITE snapshot   ON schema_history TYPE object FLEXIBLE DEFAULT {};
DEFINE FIELD OVERWRITE saved_at   ON schema_history TYPE datetime DEFAULT time::now();
DEFINE FIELD OVERWRITE is_pinned  ON schema_history TYPE bool DEFAULT false;
DEFINE FIELD OVERWRITE commit_msg ON schema_history TYPE option<string | null>;

-- 11. СУЩНОСТИ ЛОРА
DEFINE TABLE OVERWRITE entities SCHEMAFULL CHANGEFEED 30d;
DEFINE FIELD OVERWRITE project_id   ON entities TYPE record<projects> | string VALUE fn::normalize_project_id($value);
DEFINE FIELD OVERWRITE schema_id    ON entities TYPE option<record<entity_schemas> | null>;
DEFINE FIELD OVERWRITE entity_type  ON entities TYPE string DEFAULT 'character';
DEFINE FIELD OVERWRITE name         ON entities TYPE string;
DEFINE FIELD OVERWRITE description  ON entities TYPE option<string | null>;
DEFINE FIELD OVERWRITE attributes   ON entities TYPE object FLEXIBLE DEFAULT {};
DEFINE FIELD OVERWRITE tags         ON entities TYPE array<string> DEFAULT [] VALUE IF $value = NONE OR $value = NULL THEN [] ELSE $value END;
DEFINE FIELD OVERWRITE embeddings   ON entities TYPE object FLEXIBLE DEFAULT {};
DEFINE FIELD OVERWRITE created_at   ON entities TYPE option<datetime | null> DEFAULT time::now();
DEFINE FIELD OVERWRITE updated_at   ON entities TYPE option<datetime | null> DEFAULT time::now();

-- 12. СХЕМЫ ТИПОВ СВЯЗЕЙ
DEFINE TABLE OVERWRITE relation_schemas SCHEMAFULL;
DEFINE FIELD OVERWRITE project_id ON relation_schemas TYPE record<projects> | string VALUE fn::normalize_project_id($value);
DEFINE FIELD OVERWRITE rel_key    ON relation_schemas TYPE string;
DEFINE FIELD OVERWRITE rel_name   ON relation_schemas TYPE string;
DEFINE FIELD OVERWRITE icon       ON relation_schemas TYPE string;
DEFINE FIELD OVERWRITE color      ON relation_schemas TYPE string;
DEFINE FIELD OVERWRITE directed   ON relation_schemas TYPE bool DEFAULT true;
DEFINE FIELD OVERWRITE from_types ON relation_schemas TYPE array<string> DEFAULT [] VALUE IF $value = NONE OR $value = NULL THEN [] ELSE $value END;
DEFINE FIELD OVERWRITE to_types   ON relation_schemas TYPE array<string> DEFAULT [] VALUE IF $value = NONE OR $value = NULL THEN [] ELSE $value END;

-- 13. СВЯЗИ СУЩНОСТЕЙ
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

-- 14. УЧАСТИЕ В ГЛАВАХ
DEFINE TABLE OVERWRITE appears_in TYPE RELATION IN entities OUT chapters SCHEMAFULL;
DEFINE FIELD OVERWRITE project_id ON appears_in TYPE record<projects> | string VALUE fn::normalize_project_id($value);
DEFINE FIELD OVERWRITE source     ON appears_in TYPE string DEFAULT 'mention'
  ASSERT $value IN ['mention', 'manual', 'scene'];
DEFINE FIELD OVERWRITE role       ON appears_in TYPE option<string | null>;
DEFINE FIELD OVERWRITE notes      ON appears_in TYPE option<string | null>;
DEFINE FIELD OVERWRITE created_at ON appears_in TYPE datetime DEFAULT time::now();

-- 15. ПЛАНЫ
DEFINE TABLE OVERWRITE plans SCHEMAFULL;
DEFINE FIELD OVERWRITE project_id  ON plans TYPE record<projects> | string VALUE fn::normalize_project_id($value);
DEFINE FIELD OVERWRITE title       ON plans TYPE string;
DEFINE FIELD OVERWRITE parent_ref  ON plans TYPE option<record<projects> | record<volumes> | record<story_arcs> | record<chapters> | record<plans> | null>;
DEFINE FIELD OVERWRITE parent_type ON plans TYPE string
  ASSERT $value IN ['project', 'volume', 'story_arc', 'chapter', 'plan'];
DEFINE FIELD OVERWRITE sort_order  ON plans TYPE int DEFAULT 0;
DEFINE FIELD OVERWRITE completed   ON plans TYPE bool DEFAULT false;
DEFINE FIELD OVERWRITE created_at  ON plans TYPE datetime DEFAULT time::now();
DEFINE FIELD OVERWRITE updated_at  ON plans TYPE datetime DEFAULT time::now();

-- 15.1. ДЕКОМПОЗИЦИЯ ПЛАНОВ (ГРАФОВАЯ ПРИВЯЗКА К ТОМАМ, ГЛАВАМ И АРКАМ)
DEFINE TABLE OVERWRITE plans_for TYPE RELATION IN plans OUT volumes | chapters | story_arcs SCHEMAFULL;
DEFINE FIELD OVERWRITE project_id ON plans_for TYPE record<projects> | string VALUE fn::normalize_project_id($value);
DEFINE FIELD OVERWRITE created_at ON plans_for TYPE datetime DEFAULT time::now();

-- 16. ТАЙМЛАЙН СОБЫТИЙ
DEFINE TABLE OVERWRITE timeline_events SCHEMAFULL;
DEFINE FIELD OVERWRITE project_id    ON timeline_events TYPE record<projects> | string VALUE fn::normalize_project_id($value);
DEFINE FIELD OVERWRITE title         ON timeline_events TYPE string;
DEFINE FIELD OVERWRITE description   ON timeline_events TYPE option<string | null>;
DEFINE FIELD OVERWRITE m_abs         ON timeline_events TYPE int; -- Золотой эталон абсолютной минуты
DEFINE FIELD OVERWRITE calendar_id   ON timeline_events TYPE record<calendars>;
DEFINE FIELD OVERWRITE block_id      ON timeline_events TYPE option<string | null>;
DEFINE FIELD OVERWRITE created_at    ON timeline_events TYPE datetime DEFAULT time::now();

-- 17. РАСКРЫТИЕ СОБЫТИЙ В ГЛАВАХ (M:N СВЯЗЬ DIEGETIC СОБЫТИЙ С ГЛАВАМИ ЧТЕНИЯ)
DEFINE TABLE OVERWRITE revealed_in TYPE RELATION IN timeline_events OUT chapters SCHEMAFULL;
DEFINE FIELD OVERWRITE project_id ON revealed_in TYPE record<projects> | string VALUE fn::normalize_project_id($value);
DEFINE FIELD OVERWRITE pov_id     ON revealed_in TYPE option<record<entities> | null>; -- От чьего лица раскрыто
DEFINE FIELD OVERWRITE kind       ON revealed_in TYPE string DEFAULT 'direct'
  ASSERT $value IN ['direct', 'flashback', 'mention', 'rumor'];
DEFINE FIELD OVERWRITE block_id   ON revealed_in TYPE option<string | null>;
DEFINE FIELD OVERWRITE created_at ON revealed_in TYPE datetime DEFAULT time::now();

-- 18. УЧАСТИЕ В СОБЫТИЯХ ТАЙМЛАЙНА
DEFINE TABLE OVERWRITE participates_in TYPE RELATION IN entities OUT timeline_events SCHEMAFULL;
DEFINE FIELD OVERWRITE project_id ON participates_in TYPE record<projects> | string VALUE fn::normalize_project_id($value);
DEFINE FIELD OVERWRITE role       ON participates_in TYPE option<string | null>;
DEFINE FIELD OVERWRITE notes      ON participates_in TYPE option<string | null>;
DEFINE FIELD OVERWRITE created_at ON participates_in TYPE datetime DEFAULT time::now();

-- 19. РЕВИЗИИ СУЩНОСТЕЙ
DEFINE TABLE OVERWRITE entity_revisions SCHEMAFULL;
DEFINE FIELD OVERWRITE target_id   ON entity_revisions TYPE record<entities>;
DEFINE FIELD OVERWRITE project_id  ON entity_revisions TYPE record<projects> | string VALUE fn::normalize_project_id($value);
DEFINE FIELD OVERWRITE content     ON entity_revisions TYPE object FLEXIBLE DEFAULT {};
DEFINE FIELD OVERWRITE commit_msg  ON entity_revisions TYPE option<string | null>;
DEFINE FIELD OVERWRITE created_at  ON entity_revisions TYPE datetime DEFAULT time::now();
DEFINE FIELD OVERWRITE is_pinned   ON entity_revisions TYPE bool DEFAULT false;

-- 20. РЕВИЗИИ СВЯЗЕЙ СУЩНОСТЕЙ
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

-- 21. РЕВИЗИИ ГЛАВ РУКОПИСИ
DEFINE TABLE OVERWRITE chapter_revisions SCHEMAFULL;
DEFINE FIELD OVERWRITE target_id   ON chapter_revisions TYPE record<chapters>;
DEFINE FIELD OVERWRITE project_id  ON chapter_revisions TYPE record<projects> | string VALUE fn::normalize_project_id($value);
DEFINE FIELD OVERWRITE content     ON chapter_revisions TYPE object FLEXIBLE DEFAULT {};
DEFINE FIELD OVERWRITE commit_msg  ON chapter_revisions TYPE option<string | null>;
DEFINE FIELD OVERWRITE created_at  ON chapter_revisions TYPE datetime DEFAULT time::now();
DEFINE FIELD OVERWRITE is_pinned   ON chapter_revisions TYPE bool DEFAULT false;

-- 22. СЮЖЕТНЫЕ ОБЕЩАНИЯ (ЧЕХОВСКИЕ РУЖЬЯ, ТАЙНЫ)
DEFINE TABLE OVERWRITE plot_promises SCHEMAFULL;
DEFINE FIELD OVERWRITE project_id  ON plot_promises TYPE record<projects> | string VALUE fn::normalize_project_id($value);
DEFINE FIELD OVERWRITE kind        ON plot_promises TYPE string
  ASSERT $value IN ['gun', 'foreshadowing', 'mystery', 'question', 'scene', 'conflict'];
DEFINE FIELD OVERWRITE title       ON plot_promises TYPE string;
DEFINE FIELD OVERWRITE note        ON plot_promises TYPE option<string | null>;
DEFINE FIELD OVERWRITE status      ON plot_promises TYPE string DEFAULT 'planted'
  ASSERT $value IN ['planted', 'developed', 'resolved'];
DEFINE FIELD OVERWRITE created_at  ON plot_promises TYPE datetime DEFAULT time::now();
DEFINE FIELD OVERWRITE updated_at  ON plot_promises TYPE datetime DEFAULT time::now();

-- 22.1. ЖИЗНЕННЫЙ ЦИКЛ РУЖЬЯ (PLANT / PROGRESSION / RESOLUTION) В ТЕКСТЕ
DEFINE TABLE OVERWRITE promise_milestones TYPE RELATION IN plot_promises OUT text_blocks SCHEMAFULL;
DEFINE FIELD OVERWRITE project_id ON promise_milestones TYPE record<projects> | string VALUE fn::normalize_project_id($value);
DEFINE FIELD OVERWRITE stage      ON promise_milestones TYPE string
  ASSERT $value IN ['plant', 'progression', 'resolution'];
DEFINE FIELD OVERWRITE quote      ON promise_milestones TYPE string;
DEFINE FIELD OVERWRITE note       ON promise_milestones TYPE option<string | null>;
DEFINE FIELD OVERWRITE created_at ON promise_milestones TYPE datetime DEFAULT time::now();

