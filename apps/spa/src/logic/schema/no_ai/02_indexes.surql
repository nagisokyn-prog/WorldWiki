-- ==============================================================================
-- 02_INDEXES.SURQL — ИНДЕКСЫ БАЗОВОГО ЯДРА (BASE & ULTRA)
-- ==============================================================================
-- Включает:
-- 1. B-Tree индексы внешних ключей (project_id, volume_id, chapter_id, owner_id)
-- 2. Композитные индексы для хронологии и онтологии
-- 3. BM25 полнотекстовые индексы для поиска автора (главы, сущности, события, обещания)
-- ==============================================================================

-- 1. ИЕРАРХИЯ РУКОПИСИ
DEFINE INDEX OVERWRITE idx_volume_project    ON volumes FIELDS project_id;
DEFINE INDEX OVERWRITE idx_chapter_volume    ON chapters FIELDS volume_id;
DEFINE INDEX OVERWRITE idx_chapter_title_ft  ON chapters FIELDS title FULLTEXT ANALYZER ru_en_analyzer BM25 HIGHLIGHTS;
DEFINE INDEX OVERWRITE idx_chapter_ft        ON chapters FIELDS content FULLTEXT ANALYZER ru_en_analyzer BM25 HIGHLIGHTS;
DEFINE INDEX OVERWRITE idx_contains_in       ON contains FIELDS in;
DEFINE INDEX OVERWRITE idx_contains_out      ON contains FIELDS out;

-- 1.1. СЮЖЕТНЫЕ АРКИ
DEFINE INDEX OVERWRITE idx_arc_project         ON story_arcs FIELDS project_id;

-- 2. БЛОКИ ТЕКСТА
DEFINE INDEX OVERWRITE idx_textblock_chapter   ON text_blocks FIELDS chapter_id;

-- 2.1. РЕБРА АРКИ И ВРЕМЕНИ ДЛЯ НАРРАТИВНЫХ УЗЛОВ (PLOT PROMISES)
DEFINE INDEX OVERWRITE idx_advances_arc_in     ON advances_arc FIELDS in;
DEFINE INDEX OVERWRITE idx_advances_arc_out    ON advances_arc FIELDS out;

DEFINE INDEX OVERWRITE idx_occurs_at_in        ON occurs_at FIELDS in;
DEFINE INDEX OVERWRITE idx_occurs_at_out       ON occurs_at FIELDS out;

-- 2.2. ОХВАТ БЛОКОВ ТЕКСТА
DEFINE INDEX OVERWRITE idx_spans_blocks_in     ON spans_blocks FIELDS in;
DEFINE INDEX OVERWRITE idx_spans_blocks_out    ON spans_blocks FIELDS out;

-- 3. ПЛАНЕТЫ И КАЛЕНДАРИ
DEFINE INDEX OVERWRITE idx_planet_project      ON planets FIELDS project_id;
DEFINE INDEX OVERWRITE idx_calendar_planet     ON calendars FIELDS planet_id;

-- 4. МЕТА-СХЕМЫ СУЩНОСТЕЙ И ИСТОРИЯ
DEFINE INDEX OVERWRITE idx_schema_type            ON entity_schemas FIELDS project_id, type_key;
DEFINE INDEX OVERWRITE idx_schema_history_project ON schema_history FIELDS project_id;
DEFINE INDEX OVERWRITE idx_schema_history_schema  ON schema_history FIELDS schema_id;

-- 5. СУЩНОСТИ ЛОРА
DEFINE INDEX OVERWRITE idx_entity_schema_id    ON entities FIELDS schema_id;
DEFINE INDEX OVERWRITE idx_entity_name_ft      ON entities FIELDS name FULLTEXT ANALYZER ru_en_analyzer BM25 HIGHLIGHTS;
DEFINE INDEX OVERWRITE idx_entity_desc_ft      ON entities FIELDS description FULLTEXT ANALYZER ru_en_analyzer BM25 HIGHLIGHTS;

-- 6. СВЯЗИ И ОТНОШЕНИЯ
DEFINE INDEX OVERWRITE idx_rel_schema_project ON relation_schemas FIELDS project_id;
DEFINE INDEX OVERWRITE idx_rel_type           ON entity_rel FIELDS rel_type;
DEFINE INDEX OVERWRITE idx_rel_in             ON entity_rel FIELDS in;
DEFINE INDEX OVERWRITE idx_rel_out            ON entity_rel FIELDS out;
DEFINE INDEX OVERWRITE idx_rel_start_at       ON entity_rel FIELDS start_at;
DEFINE INDEX OVERWRITE idx_rel_end_at         ON entity_rel FIELDS end_at;

-- 7. УЧАСТИЕ В БЛОКАХ ТЕКСТА
DEFINE INDEX OVERWRITE idx_appears_in_in      ON appears_in FIELDS in;
DEFINE INDEX OVERWRITE idx_appears_in_out     ON appears_in FIELDS out;

-- 8. ЗАДАЧИ И ЧЕК-ЛИСТЫ ПЛАНИРОВЩИКА (ПЕРЕПЛЕТЁННАЯ ТКАНЬ)
DEFINE INDEX OVERWRITE idx_todos_owner        ON todos FIELDS owner_id;
DEFINE INDEX OVERWRITE idx_todos_arc          ON todos FIELDS arc_id;
DEFINE INDEX OVERWRITE idx_todos_depends      ON todos FIELDS depends_on;
DEFINE INDEX OVERWRITE idx_todos_status       ON todos FIELDS status;

-- 9. ТАЙМЛАЙН И УЧАСТИЕ
DEFINE INDEX OVERWRITE idx_event_project           ON timeline_events FIELDS project_id;
DEFINE INDEX OVERWRITE idx_event_m_abs             ON timeline_events FIELDS project_id, m_abs;
DEFINE INDEX OVERWRITE idx_event_calendar          ON timeline_events FIELDS calendar_id;
DEFINE INDEX OVERWRITE idx_event_title_ft          ON timeline_events COLUMNS title FULLTEXT ANALYZER ru_en_analyzer BM25 HIGHLIGHTS;
DEFINE INDEX OVERWRITE idx_event_desc_ft           ON timeline_events COLUMNS description FULLTEXT ANALYZER ru_en_analyzer BM25 HIGHLIGHTS;
DEFINE INDEX OVERWRITE idx_participates_in_in      ON participates_in FIELDS in;
DEFINE INDEX OVERWRITE idx_participates_in_out     ON participates_in FIELDS out;

-- 9.1. РАСКРЫТИЕ СОБЫТИЙ В ГЛАВАХ
DEFINE INDEX OVERWRITE idx_revealed_in_in          ON revealed_in FIELDS in;
DEFINE INDEX OVERWRITE idx_revealed_in_out         ON revealed_in FIELDS out;

-- 10. РЕВИЗИИ СУЩНОСТЕЙ, СВЯЗЕЙ И ГЛАВ
DEFINE INDEX OVERWRITE idx_entity_rev_target   ON entity_revisions FIELDS target_id;

DEFINE INDEX OVERWRITE idx_rel_rev_target      ON entity_rel_revisions FIELDS target_id;
DEFINE INDEX OVERWRITE idx_rel_rev_nodes       ON entity_rel_revisions FIELDS in_id, out_id;
DEFINE INDEX OVERWRITE idx_rel_rev_in          ON entity_rel_revisions FIELDS in_id;
DEFINE INDEX OVERWRITE idx_rel_rev_out         ON entity_rel_revisions FIELDS out_id;

DEFINE INDEX OVERWRITE idx_chapter_rev_target  ON chapter_revisions FIELDS target_id;

-- 11. СЮЖЕТНЫЕ ОБЕЩАНИЯ И МИЛЬСТОУНЫ В ТЕКСТЕ
DEFINE INDEX OVERWRITE idx_promise_status           ON plot_promises FIELDS status;
DEFINE INDEX OVERWRITE idx_promise_kind             ON plot_promises FIELDS kind;
DEFINE INDEX OVERWRITE idx_promise_location         ON plot_promises FIELDS location_id;
DEFINE INDEX OVERWRITE idx_promise_parent           ON plot_promises FIELDS parent_id;
DEFINE INDEX OVERWRITE idx_promise_event            ON plot_promises FIELDS timeline_event_id;
DEFINE INDEX OVERWRITE idx_promise_title_ft         ON plot_promises COLUMNS title FULLTEXT ANALYZER ru_en_analyzer BM25 HIGHLIGHTS;
DEFINE INDEX OVERWRITE idx_promise_note_ft          ON plot_promises COLUMNS note FULLTEXT ANALYZER ru_en_analyzer BM25 HIGHLIGHTS;

-- 11.1. МИЛЬСТОУНЫ РУЖЕЙ (ПРИВЯЗКА К БЛОКАМ ТЕКСТА)
DEFINE INDEX OVERWRITE idx_promise_milestones_in    ON promise_milestones FIELDS in;
DEFINE INDEX OVERWRITE idx_promise_milestones_out   ON promise_milestones FIELDS out;
DEFINE INDEX OVERWRITE idx_promise_milestones_stage ON promise_milestones FIELDS in, stage;

-- 11.2. ДЕЙСТВУЮЩИЕ ЛИЦА НАРРАТИВНОГО УЗЛА
DEFINE INDEX OVERWRITE idx_participant_of_in        ON participant_of FIELDS in;
DEFINE INDEX OVERWRITE idx_participant_of_out       ON participant_of FIELDS out;
