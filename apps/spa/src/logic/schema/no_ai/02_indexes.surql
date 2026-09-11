-- ==============================================================================
-- 02_INDEXES.SURQL — ИНДЕКСЫ БАЗОВОГО ЯДРА (BASE & ULTRA)
-- ==============================================================================
-- Включает:
-- 1. B-Tree индексы внешних ключей (project_id, parent_ref и т.д.)
-- 2. Композитные индексы (project_id + entity_type, project_id + m_abs)
-- 3. BM25 полнотекстовые индексы для поиска автора (главы, сущности)
-- ==============================================================================

-- 1. ИЕРАРХИЯ РУКОПИСИ
DEFINE INDEX OVERWRITE idx_volume_project    ON volumes FIELDS project_id;
DEFINE INDEX OVERWRITE idx_chapter_project   ON chapters FIELDS project_id;
DEFINE INDEX OVERWRITE idx_chapter_ft        ON chapters COLUMNS content FULLTEXT ANALYZER ru_en_analyzer BM25;
DEFINE INDEX OVERWRITE idx_chapter_title_ft  ON chapters COLUMNS title FULLTEXT ANALYZER ru_en_analyzer BM25;

-- 2. БЛОКИ ТЕКСТА
DEFINE INDEX OVERWRITE idx_textblock_project ON text_blocks FIELDS project_id;
DEFINE INDEX OVERWRITE idx_textblock_chapter ON text_blocks FIELDS chapter_id;

-- 3. ТЕГИ И КАЛЕНДАРИ
DEFINE INDEX OVERWRITE idx_tag_project       ON tags FIELDS project_id;
DEFINE INDEX OVERWRITE idx_calendar_project  ON calendars FIELDS project_id;

-- 4. МЕТА-СХЕМЫ СУЩНОСТЕЙ И ИСТОРИЯ
DEFINE INDEX OVERWRITE idx_schema_type            ON entity_schemas FIELDS project_id, type_key;
DEFINE INDEX OVERWRITE idx_schema_history_project ON schema_history FIELDS project_id;

-- 5. СУЩНОСТИ ЛОРА
DEFINE INDEX OVERWRITE idx_entity_project ON entities FIELDS project_id;
DEFINE INDEX OVERWRITE idx_entity_type    ON entities FIELDS project_id, entity_type;
DEFINE INDEX OVERWRITE idx_entity_name_ft ON entities COLUMNS name FULLTEXT ANALYZER ru_en_analyzer BM25;
DEFINE INDEX OVERWRITE idx_entity_desc_ft ON entities COLUMNS description FULLTEXT ANALYZER ru_en_analyzer BM25;

-- 6. СВЯЗИ И ОТНОШЕНИЯ
DEFINE INDEX OVERWRITE idx_rel_schema_project ON relation_schemas FIELDS project_id;
DEFINE INDEX OVERWRITE idx_rel_project        ON entity_rel FIELDS project_id;
DEFINE INDEX OVERWRITE idx_rel_type           ON entity_rel FIELDS rel_type;
DEFINE INDEX OVERWRITE idx_rel_in             ON entity_rel FIELDS in;
DEFINE INDEX OVERWRITE idx_rel_out            ON entity_rel FIELDS out;

-- 7. УЧАСТИЕ В ГЛАВАХ
DEFINE INDEX OVERWRITE idx_appears_in_project ON appears_in FIELDS project_id;
DEFINE INDEX OVERWRITE idx_appears_in_in      ON appears_in FIELDS in;
DEFINE INDEX OVERWRITE idx_appears_in_out     ON appears_in FIELDS out;

-- 8. ПЛАНЫ
DEFINE INDEX OVERWRITE idx_plan_project ON plans FIELDS project_id;
DEFINE INDEX OVERWRITE idx_plan_parent  ON plans FIELDS parent_ref;

-- 9. ТАЙМЛАЙН И УЧАСТИЕ
DEFINE INDEX OVERWRITE idx_event_project       ON timeline_events FIELDS project_id;
DEFINE INDEX OVERWRITE idx_event_m_abs         ON timeline_events FIELDS project_id, m_abs;
DEFINE INDEX OVERWRITE idx_event_chapter       ON timeline_events FIELDS chapter_id;
DEFINE INDEX OVERWRITE idx_participates_in_in  ON participates_in FIELDS in;
DEFINE INDEX OVERWRITE idx_participates_in_out ON participates_in FIELDS out;

-- 10. РЕВИЗИИ СУЩНОСТЕЙ, СВЯЗЕЙ И ГЛАВ
DEFINE INDEX OVERWRITE idx_entity_rev_target   ON entity_revisions FIELDS target_id;
DEFINE INDEX OVERWRITE idx_entity_rev_project  ON entity_revisions FIELDS project_id;

DEFINE INDEX OVERWRITE idx_rel_rev_target      ON entity_rel_revisions FIELDS target_id;
DEFINE INDEX OVERWRITE idx_rel_rev_project     ON entity_rel_revisions FIELDS project_id;
DEFINE INDEX OVERWRITE idx_rel_rev_nodes       ON entity_rel_revisions FIELDS project_id, in_id, out_id;
DEFINE INDEX OVERWRITE idx_rel_rev_in          ON entity_rel_revisions FIELDS in_id;
DEFINE INDEX OVERWRITE idx_rel_rev_out         ON entity_rel_revisions FIELDS out_id;

DEFINE INDEX OVERWRITE idx_chapter_rev_target  ON chapter_revisions FIELDS target_id;
DEFINE INDEX OVERWRITE idx_chapter_rev_project ON chapter_revisions FIELDS project_id;

-- 11. СЮЖЕТНЫЕ ОБЕЩАНИЯ
DEFINE INDEX OVERWRITE idx_promise_project ON plot_promises FIELDS project_id;
DEFINE INDEX OVERWRITE idx_promise_chapter ON plot_promises FIELDS chapter_id;
DEFINE INDEX OVERWRITE idx_promise_status  ON plot_promises FIELDS project_id, status;
