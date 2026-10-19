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
    DELETE chats WHERE parent_chat_id = $before.id;
};

-- 2. АДДИТИВНЫЙ КАСКАД УДАЛЕНИЯ ПРОЕКТА (ОЧИСТКА ИИ-ПРОСТРАНСТВА)
DEFINE EVENT OVERWRITE cascade_project_ai_delete ON TABLE projects WHEN $event = "DELETE" THEN {
    LET $p_rec = fn::normalize_project_id($before.id);
    
    -- 1. ИИ-сессии, чаты, сообщения и память агента (не трогая глобальную память автора)
    DELETE chats WHERE project_id = $p_rec;
    DELETE chat_messages WHERE project_id = $p_rec;
    DELETE agent_memory WHERE project_id = $p_rec AND (is_global != true OR is_global = NONE);
    DELETE research_sessions WHERE project_id = $p_rec;
    DELETE auto_approval_settings WHERE project_id = $p_rec;

    -- 2. Артефакты, словарь лора, проектные профили и улики ресёрча (не трогая глобальные профили)
    DELETE artifacts WHERE project_id = $p_rec;
    DELETE user_dictionary WHERE project_id = $p_rec;
    DELETE ai_profiles WHERE project_id = $p_rec AND (is_global != true OR is_global = NONE);
    DELETE web_evidence WHERE project_id = $p_rec;

    -- 3. Кастомные навыки и режимы проекта (не трогая глобальные)
    DELETE ai_skills WHERE project_id = $p_rec AND (is_builtin != true OR is_builtin = NONE);
    DELETE ai_modes WHERE project_id = $p_rec AND (is_global != true OR is_global = NONE);
};

-- 3. АДДИТИВНЫЙ КАСКАД УДАЛЕНИЯ СУЩНОСТИ (ОЧИСТКА RAG-ЧАНКОВ)
DEFINE EVENT OVERWRITE cascade_entity_chunks_delete ON TABLE entities WHEN $event = "DELETE" THEN {
    DELETE entity_chunks WHERE entity_id = $before.id;
};
