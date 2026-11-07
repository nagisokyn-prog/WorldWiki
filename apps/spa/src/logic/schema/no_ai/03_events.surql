-- ==============================================================================
-- 03_EVENTS.SURQL — КАСКАДЫ И АУДИТ-ЛОГИ БАЗОВОГО ЯДРА (BASE & ULTRA)
-- ==============================================================================
-- Включает:
-- 1. cascade_project_delete (Set-based каскад удаления проекта без циклических зависимостей)
-- 2. cascade_volume_delete, cascade_chapter_delete, cascade_story_arc_delete, cascade_calendar_delete
-- 3. cascade_entity_delete (Каскад при удалении сущности: связи, ревизии, участие)
-- 4. log_entity_revision, log_entity_rel_create, log_entity_rel_revision, log_entity_rel_delete, log_chapter_revision
-- ==============================================================================

-- 1. КАСКАД УДАЛЕНИЯ ПРОЕКТА (BASE EDITION)
DEFINE EVENT OVERWRITE cascade_project_delete ON TABLE projects WHEN $event = "DELETE" THEN {
    LET $p_rec = fn::normalize_project_id($before.id);
    
    LET $vols = (SELECT VALUE id FROM volumes WHERE project_id = $p_rec);
    LET $chaps = (SELECT VALUE id FROM chapters WHERE volume_id IN $vols);
    LET $arcs = (SELECT VALUE id FROM story_arcs WHERE project_id = $p_rec);
    LET $schemas = (SELECT VALUE id FROM entity_schemas WHERE project_id = $p_rec);

    -- 1. Графовые связи, нарративные узлы и ревизии лора
    DELETE contains WHERE in = $p_rec;
    DELETE chapter_revisions WHERE target_id IN $chaps;
    DELETE entity_revisions WHERE target_id.schema_id IN $schemas;
    DELETE entity_rel_revisions WHERE in_id.schema_id IN $schemas;
    DELETE entity_rel WHERE in.schema_id IN $schemas;
    DELETE appears_in WHERE in.schema_id IN $schemas;
    DELETE participates_in WHERE in.schema_id IN $schemas;
    DELETE participant_of WHERE in.schema_id IN $schemas;
    DELETE advances_arc WHERE out IN $arcs;
    DELETE revealed_in WHERE out IN $chaps;
    LET $blks = (SELECT VALUE id FROM text_blocks WHERE chapter_id IN $chaps);
    LET $p_from_blocks = (SELECT VALUE in FROM spans_blocks WHERE out IN $blks);
    LET $p_from_milestones = (SELECT VALUE in FROM promise_milestones WHERE out IN $blks);
    LET $p_from_arcs = (SELECT VALUE in FROM advances_arc WHERE out IN $arcs);
    LET $all_promises = array::distinct(array::concat($p_from_blocks, $p_from_milestones, $p_from_arcs));
    DELETE plot_promises WHERE id IN $all_promises;

    -- 2. Задачи планировщика (todos)
    DELETE todos WHERE owner_id IN array::concat($vols, $chaps, $arcs) OR owner_id = $p_rec;

    -- 3. Сюжетные арки
    DELETE story_arcs WHERE project_id = $p_rec;

    -- 4. Текст рукописи (блоки, ревизии, главы, тома)
    DELETE text_blocks WHERE chapter_id IN $chaps;
    DELETE chapters WHERE volume_id IN $vols;
    DELETE volumes WHERE project_id = $p_rec;

    -- 5. Сущности лора (каскад по мета-схемам проекта)
    DELETE entities WHERE schema_id IN $schemas;

    -- 6. Таймлайн, календари и астрофизика
    DELETE timeline_events WHERE project_id = $p_rec;
    LET $plns = (SELECT VALUE id FROM planets WHERE project_id = $p_rec);
    DELETE calendars WHERE planet_id IN $plns;
    DELETE planets WHERE project_id = $p_rec;

    -- 7. Мета-схемы данных проекта
    DELETE entity_schemas WHERE project_id = $p_rec;
    DELETE relation_schemas WHERE project_id = $p_rec;
    DELETE schema_history WHERE project_id = $p_rec;
};

-- 2. КАСКАДЫ ИЕРАРХИИ СЮЖЕТА
DEFINE EVENT OVERWRITE cascade_volume_delete ON TABLE volumes WHEN $event = "DELETE" THEN {
    LET $chaps = (SELECT VALUE id FROM chapters WHERE volume_id = $before.id);
    DELETE text_blocks WHERE chapter_id IN $chaps;
    DELETE chapter_revisions WHERE target_id IN $chaps;
    LET $del_todos = (SELECT VALUE id FROM todos WHERE owner_id = $before.id OR owner_id IN $chaps);
    UPDATE todos SET depends_on = NONE WHERE depends_on IN $del_todos;
    DELETE todos WHERE id IN $del_todos;
    DELETE chapters WHERE volume_id = $before.id;
    DELETE contains WHERE in = $before.id OR out = $before.id;
};

DEFINE EVENT OVERWRITE cascade_chapter_delete ON TABLE chapters WHEN $event = "DELETE" THEN {
    DELETE text_blocks WHERE chapter_id = $before.id;
    DELETE contains WHERE out = $before.id;
    LET $del_todos = (SELECT VALUE id FROM todos WHERE owner_id = $before.id);
    UPDATE todos SET depends_on = NONE WHERE depends_on IN $del_todos;
    DELETE todos WHERE id IN $del_todos;
    DELETE chapter_revisions WHERE target_id = $before.id;
    DELETE revealed_in WHERE out = $before.id;

    -- Разрыв временных границ связей
    UPDATE entity_rel SET start_at = NONE WHERE start_at = $before.id;
    UPDATE entity_rel SET end_at = NONE WHERE end_at = $before.id;
};

-- 2.1. КАСКАД СЮЖЕТНЫХ АРОК
DEFINE EVENT OVERWRITE cascade_story_arc_delete ON TABLE story_arcs WHEN $event = "DELETE" THEN {
    DELETE advances_arc WHERE out = $before.id;
    DELETE todos WHERE owner_id = $before.id;
};

-- 2.2. КАСКАД БЛОКОВ ТЕКСТА
DEFINE EVENT OVERWRITE cascade_text_block_delete ON TABLE text_blocks WHEN $event = "DELETE" THEN {
    DELETE promise_milestones WHERE out = $before.id;
    DELETE spans_blocks WHERE out = $before.id;
    DELETE appears_in WHERE out = $before.id;
};

-- 2.3. КАСКАД СЮЖЕТНЫХ ОБЕЩАНИЙ
DEFINE EVENT OVERWRITE cascade_plot_promise_delete ON TABLE plot_promises WHEN $event = "DELETE" THEN {
    DELETE spans_blocks WHERE in = $before.id;
    DELETE promise_milestones WHERE in = $before.id;
    DELETE participant_of WHERE out = $before.id;
    DELETE advances_arc WHERE in = $before.id;
    DELETE occurs_at WHERE in = $before.id;
};

-- 3. КАСКАД КАЛЕНДАРЯ
DEFINE EVENT OVERWRITE cascade_calendar_delete ON TABLE calendars WHEN $event = "DELETE" THEN {
    LET $proj_id = $before.planet_id.project_id;
    LET $master = (SELECT VALUE id FROM calendars WHERE planet_id.project_id = $proj_id AND (is_master = true OR is_default = true) LIMIT 1)[0];
    IF $master != NONE AND $master != $before.id {
        UPDATE timeline_events SET calendar_id = $master WHERE calendar_id = $before.id;
    };
};

-- 4. КАСКАД УДАЛЕНИЯ СУЩНОСТИ
DEFINE EVENT OVERWRITE cascade_entity_delete ON TABLE entities WHEN $event = "DELETE" THEN {
    DELETE entity_rel WHERE in = $before.id;
    DELETE entity_rel WHERE out = $before.id;
    DELETE appears_in WHERE in = $before.id;
    DELETE participant_of WHERE in = $before.id;
    DELETE participates_in WHERE in = $before.id;
    DELETE entity_revisions WHERE target_id = $before.id;
    DELETE entity_rel_revisions WHERE in_id = $before.id;
    DELETE entity_rel_revisions WHERE out_id = $before.id;
};

-- 4.1. КАСКАД УДАЛЕНИЯ СОБЫТИЯ ТАЙМЛАЙНА
DEFINE EVENT OVERWRITE cascade_timeline_event_delete ON TABLE timeline_events WHEN $event = "DELETE" THEN {
    DELETE participates_in WHERE out = $before.id;
    DELETE occurs_at WHERE out = $before.id;
    DELETE revealed_in WHERE in = $before.id;
    UPDATE plot_promises SET timeline_event_id = NONE WHERE timeline_event_id = $before.id;
};

-- 5. ЛОГИРОВАНИЕ РЕВИЗИЙ СУЩНОСТЕЙ
DEFINE EVENT OVERWRITE log_entity_revision ON TABLE entities 
    WHEN $event = "UPDATE" 
    AND (
        $before.name != $after.name 
        OR $before.description != $after.description 
        OR $before.attributes != $after.attributes 
        OR $before.tags != $after.tags
        OR $before.schema_id != $after.schema_id
    ) 
    THEN {
        CREATE entity_revisions SET 
            target_id = $before.id, 
            content = {
                name: $before.name,
                description: $before.description,
                attributes: $before.attributes,
                tags: $before.tags,
                entity_type: $before.schema_id.type_key
            }, 
            created_at = time::now(), 
            commit_msg = NONE;
    };

-- 5.1. КАСКАД УДАЛЕНИЯ СХЕМЫ СУЩНОСТЕЙ
DEFINE EVENT OVERWRITE cascade_entity_schema_delete ON TABLE entity_schemas WHEN $event = "DELETE" THEN {
    DELETE entities WHERE schema_id = $before.id;
};

-- 6. ЛОГИРОВАНИЕ СОЗДАНИЯ СВЯЗИ СУЩНОСТЕЙ
DEFINE EVENT OVERWRITE log_entity_rel_create ON TABLE entity_rel 
    WHEN $event = "CREATE" 
    THEN {
        CREATE entity_rel_revisions SET 
            target_id = $after.id, 
            in_id = $after.in, 
            out_id = $after.out, 
            action = "CREATE", 
            content = {
                rel_type: $after.rel_type,
                description: $after.description,
                strength: $after.strength,
                attributes: $after.attributes,
                start_at: $after.start_at,
                end_at: $after.end_at,
                is_auto_extend: $after.is_auto_extend
            }, 
            created_at = time::now(), 
            commit_msg = NONE;
    };

-- 7. ЛОГИРОВАНИЕ ОБНОВЛЕНИЯ СВЯЗИ СУЩНОСТЕЙ
DEFINE EVENT OVERWRITE log_entity_rel_revision ON TABLE entity_rel 
    WHEN $event = "UPDATE" 
    AND (
        $before.rel_type != $after.rel_type 
        OR $before.description != $after.description 
        OR $before.strength != $after.strength 
        OR $before.attributes != $after.attributes 
        OR $before.start_at != $after.start_at 
        OR $before.end_at != $after.end_at 
        OR $before.is_auto_extend != $after.is_auto_extend
    ) 
    THEN {
        CREATE entity_rel_revisions SET 
            target_id = $before.id, 
            in_id = $before.in, 
            out_id = $before.out, 
            action = "UPDATE", 
            content = {
                rel_type: $before.rel_type,
                description: $before.description,
                strength: $before.strength,
                attributes: $before.attributes,
                start_at: $before.start_at,
                end_at: $before.end_at,
                is_auto_extend: $before.is_auto_extend
            }, 
            created_at = time::now(), 
            commit_msg = NONE;
    };

-- 8. ЛОГИРОВАНИЕ УДАЛЕНИЯ СВЯЗИ СУЩНОСТЕЙ (ТОЛЬКО ЕСЛИ ОБЕ СУЩНОСТИ ЕЩЁ СУЩЕСТВУЮТ)
DEFINE EVENT OVERWRITE log_entity_rel_delete ON TABLE entity_rel 
    WHEN $event = "DELETE" AND $before.in.id != NONE AND $before.out.id != NONE
    THEN {
        CREATE entity_rel_revisions SET 
            target_id = $before.id, 
            in_id = $before.in, 
            out_id = $before.out, 
            action = "DELETE", 
            content = {
                rel_type: $before.rel_type,
                description: $before.description,
                strength: $before.strength,
                attributes: $before.attributes,
                start_at: $before.start_at,
                end_at: $before.end_at,
                is_auto_extend: $before.is_auto_extend
            }, 
            created_at = time::now(), 
            commit_msg = NONE;
    };

-- 9. ЛОГИРОВАНИЕ РЕВИЗИИ ГЛАВЫ (БЕЗ ВЕКТОРОВ)
DEFINE EVENT OVERWRITE log_chapter_revision ON TABLE chapters 
    WHEN $event = "UPDATE" 
    AND (
        $before.title != $after.title 
        OR $before.content != $after.content 
    ) 
    THEN {
        CREATE chapter_revisions SET 
            target_id = $after.id, 
            content = {
                title: $after.title,
                content: $after.content,
                word_count: $after.word_count
            }, 
            created_at = time::now(), 
            commit_msg = NONE;
    };
