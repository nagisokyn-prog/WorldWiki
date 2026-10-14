-- ==============================================================================
-- 03_EVENTS.SURQL — КАСКАДЫ И АУДИТ-ЛОГИ БАЗОВОГО ЯДРА (BASE & ULTRA)
-- ==============================================================================
-- Включает:
-- 1. cascade_project_delete (Set-based каскад удаления проекта)
-- 2. cascade_volume_delete, cascade_arc_delete, cascade_chapter_delete, cascade_calendar_delete, cascade_plan_delete
-- 3. cascade_entity_delete (Каскад при удалении отдельной сущности: связи, ревизии, участие)
-- 4. log_entity_revision, log_entity_rel_create, log_entity_rel_revision, log_entity_rel_delete, log_chapter_revision
-- ==============================================================================

-- 1. КАСКАД УДАЛЕНИЯ ПРОЕКТА (BASE EDITION)
DEFINE EVENT OVERWRITE cascade_project_delete ON TABLE projects WHEN $event = "DELETE" THEN {
    LET $p_rec = fn::normalize_project_id($before.id);
    
    -- 1. Иерархия, связи, участие и ревизии лора (удаляются до сущностей)
    DELETE contains WHERE in = $p_rec;
    DELETE entity_rel WHERE project_id = $p_rec;
    DELETE appears_in WHERE project_id = $p_rec;
    DELETE participates_in WHERE project_id = $p_rec;
    DELETE revealed_in WHERE project_id = $p_rec;
    DELETE arc_entities WHERE project_id = $p_rec;
    DELETE arc_chapters WHERE project_id = $p_rec;
    DELETE story_arcs WHERE project_id = $p_rec;
    DELETE entity_revisions WHERE project_id = $p_rec;
    DELETE entity_rel_revisions WHERE project_id = $p_rec;
    DELETE tags WHERE project_id = $p_rec;

    -- 2. Сущности лора
    DELETE entities WHERE project_id = $p_rec;

    -- 3. Блоки текста, ревизии и главы рукописи
    DELETE text_blocks WHERE project_id = $p_rec;
    DELETE chapter_revisions WHERE project_id = $p_rec;
    DELETE chapters WHERE project_id = $p_rec;
    DELETE volumes WHERE project_id = $p_rec;

    -- 4. Планирование и сюжетные обещания
    DELETE plans WHERE project_id = $p_rec;
    DELETE plot_promises WHERE project_id = $p_rec;

    -- 5. Таймлайн СТРОГО ДО календарей (чтобы не триггерить cascade_calendar_delete)
    DELETE timeline_events WHERE project_id = $p_rec;
    DELETE calendars WHERE project_id = $p_rec;

    -- 6. Схемы данных проекта
    DELETE entity_schemas WHERE project_id = $p_rec;
    DELETE relation_schemas WHERE project_id = $p_rec;
    DELETE schema_history WHERE project_id = $p_rec;
};

-- 2. КАСКАДЫ ИЕРАРХИИ СЮЖЕТА
DEFINE EVENT OVERWRITE cascade_volume_delete ON TABLE volumes WHEN $event = "DELETE" THEN {
    DELETE ->contains->chapters;
    DELETE contains WHERE in = $before.id OR out = $before.id;
    DELETE plans WHERE parent_ref = $before.id;
};

DEFINE EVENT OVERWRITE cascade_chapter_delete ON TABLE chapters WHEN $event = "DELETE" THEN {
    DELETE text_blocks WHERE chapter_id = $before.id;
    DELETE appears_in WHERE out = $before.id;
    DELETE arc_chapters WHERE out = $before.id;
    DELETE revealed_in WHERE out = $before.id;
    DELETE contains WHERE out = $before.id;
    DELETE plans WHERE parent_ref = $before.id;
    DELETE plot_promises WHERE chapter_id = $before.id;
    DELETE chapter_revisions WHERE target_id = $before.id;

    -- Разрыв ссылок на удаленную главу в сюжетных ружьях и временных границах связей
    UPDATE plot_promises SET resolved_in_chapter = NONE WHERE resolved_in_chapter = $before.id;
    UPDATE entity_rel SET start_chapter = NONE WHERE start_chapter = $before.id;
    UPDATE entity_rel SET end_chapter = NONE WHERE end_chapter = $before.id;
};

-- 2.1. КАСКАД СЮЖЕТНЫХ АРОК
DEFINE EVENT OVERWRITE cascade_story_arc_delete ON TABLE story_arcs WHEN $event = "DELETE" THEN {
    DELETE arc_entities WHERE in = $before.id;
    DELETE arc_chapters WHERE in = $before.id;
};

-- 3. КАСКАД КАЛЕНДАРЯ
DEFINE EVENT OVERWRITE cascade_calendar_delete ON TABLE calendars WHEN $event = "DELETE" THEN {
    LET $master = (SELECT VALUE id FROM calendars WHERE project_id = $before.project_id AND (is_master = true OR is_default = true) LIMIT 1)[0];
    IF $master != NONE AND $master != $before.id {
        UPDATE timeline_events SET calendar_id = $master WHERE calendar_id = $before.id;
    };
};

-- 4. КАСКАД ПЛАНОВ
DEFINE EVENT OVERWRITE cascade_plan_delete ON TABLE plans WHEN $event = "DELETE" THEN {
    DELETE plans WHERE parent_ref = $before.id;
};

-- 5. КАСКАД УДАЛЕНИЯ СУЩНОСТИ (Прямые индексные запросы без OR для исключения конфликтов блокировок)
DEFINE EVENT OVERWRITE cascade_entity_delete ON TABLE entities WHEN $event = "DELETE" THEN {
    DELETE entity_rel WHERE in = $before.id;
    DELETE entity_rel WHERE out = $before.id;
    DELETE appears_in WHERE in = $before.id;
    DELETE arc_entities WHERE out = $before.id;
    DELETE revealed_in WHERE pov_id = $before.id;
    DELETE participates_in WHERE in = $before.id;
    DELETE entity_revisions WHERE target_id = $before.id;
    DELETE entity_rel_revisions WHERE in_id = $before.id;
    DELETE entity_rel_revisions WHERE out_id = $before.id;

    -- Разрыв ссылок на удаленную сущность в сюжетных обещаниях
    UPDATE plot_promises SET location_id = NONE WHERE location_id = $before.id;
};

-- 5.1. КАСКАД УДАЛЕНИЯ СОБЫТИЯ ТАЙМЛАЙНА
DEFINE EVENT OVERWRITE cascade_timeline_event_delete ON TABLE timeline_events WHEN $event = "DELETE" THEN {
    DELETE participates_in WHERE out = $before.id;
    DELETE revealed_in WHERE in = $before.id;

    -- Разрыв ссылок на удаленное событие в сюжетных обещаниях
    UPDATE plot_promises SET timeline_event_id = NONE WHERE timeline_event_id = $before.id;
};

-- 6. ЛОГИРОВАНИЕ РЕВИЗИЙ СУЩНОСТЕЙ
DEFINE EVENT OVERWRITE log_entity_revision ON TABLE entities 
    WHEN $event = "UPDATE" 
    AND (
        $before.name != $after.name 
        OR $before.description != $after.description 
        OR $before.attributes != $after.attributes 
        OR $before.tags != $after.tags 
        OR $before.entity_type != $after.entity_type
    ) 
    THEN {
        CREATE entity_revisions SET 
            target_id = $before.id, 
            project_id = $before.project_id, 
            content = {
                name: $before.name,
                description: $before.description,
                attributes: $before.attributes,
                tags: $before.tags,
                entity_type: $before.entity_type
            }, 
            created_at = time::now(), 
            commit_msg = NONE;
    };

-- 7. ЛОГИРОВАНИЕ СОЗДАНИЯ СВЯЗИ СУЩНОСТЕЙ
DEFINE EVENT OVERWRITE log_entity_rel_create ON TABLE entity_rel 
    WHEN $event = "CREATE" 
    THEN {
        CREATE entity_rel_revisions SET 
            target_id = $after.id, 
            project_id = $after.project_id, 
            in_id = $after.in, 
            out_id = $after.out, 
            action = "CREATE", 
            content = {
                rel_type: $after.rel_type,
                description: $after.description,
                strength: $after.strength,
                attributes: $after.attributes,
                start_volume: $after.start_volume,
                start_chapter: $after.start_chapter,
                end_volume: $after.end_volume,
                end_chapter: $after.end_chapter,
                is_auto_extend: $after.is_auto_extend
            }, 
            created_at = time::now(), 
            commit_msg = NONE;
    };

-- 8. ЛОГИРОВАНИЕ ОБНОВЛЕНИЯ СВЯЗИ СУЩНОСТЕЙ
DEFINE EVENT OVERWRITE log_entity_rel_revision ON TABLE entity_rel 
    WHEN $event = "UPDATE" 
    AND (
        $before.rel_type != $after.rel_type 
        OR $before.description != $after.description 
        OR $before.strength != $after.strength 
        OR $before.attributes != $after.attributes 
        OR $before.start_volume != $after.start_volume 
        OR $before.start_chapter != $after.start_chapter 
        OR $before.end_volume != $after.end_volume 
        OR $before.end_chapter != $after.end_chapter
        OR $before.is_auto_extend != $after.is_auto_extend
    ) 
    THEN {
        CREATE entity_rel_revisions SET 
            target_id = $before.id, 
            project_id = $before.project_id, 
            in_id = $before.in, 
            out_id = $before.out, 
            action = "UPDATE", 
            content = {
                rel_type: $before.rel_type,
                description: $before.description,
                strength: $before.strength,
                attributes: $before.attributes,
                start_volume: $before.start_volume,
                start_chapter: $before.start_chapter,
                end_volume: $before.end_volume,
                end_chapter: $before.end_chapter,
                is_auto_extend: $before.is_auto_extend
            }, 
            created_at = time::now(), 
            commit_msg = NONE;
    };

-- 9. ЛОГИРОВАНИЕ УДАЛЕНИЯ СВЯЗИ СУЩНОСТЕЙ
DEFINE EVENT OVERWRITE log_entity_rel_delete ON TABLE entity_rel 
    WHEN $event = "DELETE" 
    THEN {
        CREATE entity_rel_revisions SET 
            target_id = $before.id, 
            project_id = $before.project_id, 
            in_id = $before.in, 
            out_id = $before.out, 
            action = "DELETE", 
            content = {
                rel_type: $before.rel_type,
                description: $before.description,
                strength: $before.strength,
                attributes: $before.attributes,
                start_volume: $before.start_volume,
                start_chapter: $before.start_chapter,
                end_volume: $before.end_volume,
                end_chapter: $before.end_chapter,
                is_auto_extend: $before.is_auto_extend
            }, 
            created_at = time::now(), 
            commit_msg = NONE;
    };

-- 10. ЛОГИРОВАНИЕ РЕВИЗИИ ГЛАВЫ (БЕЗ ВЕКТОРОВ)
DEFINE EVENT OVERWRITE log_chapter_revision ON TABLE chapters 
    WHEN $event = "UPDATE" 
    AND (
        $before.title != $after.title 
        OR $before.content != $after.content 
        OR $before.summary != $after.summary 
        OR $before.footnotes != $after.footnotes
        OR $before.timeline_events != $after.timeline_events
        OR $before.participants != $after.participants
    ) 
    THEN {
        CREATE chapter_revisions SET 
            target_id = $before.id, 
            project_id = $before.project_id, 
            content = {
                title: $before.title,
                content: $before.content,
                summary: $before.summary,
                footnotes: $before.footnotes,
                word_count: $before.word_count,
                timeline_events: $before.timeline_events,
                participants: $before.participants
            }, 
            created_at = time::now(), 
            commit_msg = NONE;
    };
