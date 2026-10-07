-- ==============================================================================
-- 05_EVENTS.SURQL — АДДИТИВНЫЕ КАСКАДЫ ИИ-ПРОСТРАНСТВА (ULTRA EDITION)
-- ==============================================================================
-- Включает:
-- 1. cascade_chat_delete (Каскад удаления сообщений при удалении чата)
-- 2. cascade_project_ai_delete (Аддитивный каскад очистки ИИ-сессий, чатов и памяти при удалении проекта)
-- 3. cascade_entity_chunks_delete (Аддитивный каскад очистки векторных чанков при удалении сущности)
-- ==============================================================================

-- 1. КАСКАД УДАЛЕНИЯ ЧАТА
DEFINE EVENT OVERWRITE cascade_chat_delete ON TABLE chats WHEN $event = "DELETE" THEN {
    DELETE chat_messages WHERE chat_id = $before.id;
    DELETE contains WHERE in = $before.id OR out = $before.id;
    DELETE chats WHERE parent_chat_id = $before.id;
};

-- 2. АДДИТИВНЫЙ КАСКАД УДАЛЕНИЯ ПРОЕКТА (ОЧИСТКА ИИ-ПРОСТРАНСТВА)
DEFINE EVENT OVERWRITE cascade_project_ai_delete ON TABLE projects WHEN $event = "DELETE" THEN {
    LET $pid = $before.id;
    LET $p_rec = fn::normalize_project_id($pid);
    
    -- 1. ИИ-сессии, чаты, сообщения и память агента
    DELETE chats WHERE project_id = $pid OR project_id = $p_rec OR project_id = $before.name;
    DELETE chat_messages WHERE project_id = $pid OR project_id = $p_rec OR project_id = $before.name;
    DELETE agent_memory WHERE project_id = $pid OR project_id = $p_rec OR project_id = $before.name;
    DELETE research_sessions WHERE project_id = $pid OR project_id = $p_rec OR project_id = $before.name;
    DELETE auto_approval_settings WHERE project_id = $pid OR project_id = $p_rec OR project_id = $before.name;

    -- 2. Кастомные навыки и режимы проекта (не трогая глобальные)
    DELETE ai_skills WHERE (project_id = $pid OR project_id = $p_rec OR project_id = $before.name) AND (is_builtin != true OR is_builtin = NONE);
    DELETE ai_modes WHERE (project_id = $pid OR project_id = $p_rec OR project_id = $before.name) AND (is_global != true OR is_global = NONE);
};

-- 3. АДДИТИВНЫЙ КАСКАД УДАЛЕНИЯ СУЩНОСТИ (ОЧИСТКА RAG-ЧАНКОВ)
DEFINE EVENT OVERWRITE cascade_entity_chunks_delete ON TABLE entities WHEN $event = "DELETE" THEN {
    DELETE entity_chunks WHERE entity_id = $before.id;
};
