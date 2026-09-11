-- ==============================================================================
-- 05_EVENTS.SURQL — КАСКАДЫ ИИ-ПРОСТРАНСТВА (ULTRA EDITION)
-- ==============================================================================
-- Включает:
-- 1. cascade_chat_delete (Каскад удаления сообщений при удалении чата)
-- 2. DEFINE EVENT OVERWRITE cascade_project_delete (Расширенный каскад со всеми ИИ-таблицами)
-- 3. DEFINE EVENT OVERWRITE cascade_entity_delete (Расширенный каскад сущности с entity_chunks)
-- ==============================================================================

-- 1. КАСКАД УДАЛЕНИЯ ЧАТА
DEFINE EVENT OVERWRITE cascade_chat_delete ON TABLE chats WHEN $event = "DELETE" THEN {
    DELETE chat_messages WHERE chat_id = $before.id;
};

-- 2. ПОЛНЫЙ КАСКАД УДАЛЕНИЯ ПРОЕКТА (ULTRA EDITION С ИИ)
DEFINE EVENT OVERWRITE cascade_project_delete ON TABLE projects WHEN $event = "DELETE" THEN {
    LET $pid = $before.id;
    
    -- 1. Связи, чанки, участие и ревизии лора (удаляются до сущностей)
    DELETE entity_rel WHERE project_id = $pid;
    DELETE entity_chunks WHERE project_id = $pid;
    DELETE appears_in WHERE project_id = $pid;
    DELETE participates_in WHERE project_id = $pid;
    DELETE entity_revisions WHERE project_id = $pid;
    DELETE entity_rel_revisions WHERE project_id = $pid;
    DELETE tags WHERE project_id = $pid;

    -- 2. Сущности лора
    DELETE entities WHERE project_id = $pid;

    -- 3. Блоки текста, ревизии и главы рукописи
    DELETE text_blocks WHERE project_id = $pid;
    DELETE chapter_revisions WHERE project_id = $pid;
    DELETE chapters WHERE project_id = $pid;
    DELETE arcs WHERE project_id = $pid;
    DELETE volumes WHERE project_id = $pid;

    -- 4. Планирование, таймлайн и сюжетные обещания
    DELETE plans WHERE project_id = $pid;
    DELETE plot_promises WHERE project_id = $pid;
    DELETE timeline_events WHERE project_id = $pid;

    -- 5. ИИ-сессии и проектные скиллы/настройки
    DELETE chats WHERE project_id = $pid;
    DELETE chat_messages WHERE project_id = $pid;
    DELETE agent_memory WHERE project_id = $pid;
    DELETE research_sessions WHERE project_id = $pid;
    DELETE auto_approval_settings WHERE project_id = $pid;
    DELETE ai_skills WHERE project_id = $pid AND (is_builtin != true OR is_builtin = NONE);
    DELETE ai_modes WHERE project_id = $pid AND (is_global != true OR is_global = NONE);
};

-- 3. КАСКАД УДАЛЕНИЯ СУЩНОСТИ (ULTRA EDITION: Прямые индексные запросы без OR)
DEFINE EVENT OVERWRITE cascade_entity_delete ON TABLE entities WHEN $event = "DELETE" THEN {
    DELETE entity_rel WHERE in = $before.id;
    DELETE entity_rel WHERE out = $before.id;
    DELETE appears_in WHERE in = $before.id;
    DELETE participates_in WHERE in = $before.id;
    DELETE entity_revisions WHERE target_id = $before.id;
    DELETE entity_rel_revisions WHERE in_id = $before.id;
    DELETE entity_rel_revisions WHERE out_id = $before.id;
    DELETE entity_chunks WHERE entity_id = $before.id;
};
