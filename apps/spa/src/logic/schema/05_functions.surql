-- ==============================================================================
-- 05_FUNCTIONS.SURQL — ХРАНИМЫЕ АНАЛИТИЧЕСКИЕ И RAG ФУНКЦИИ (ТОЛЬКО РЕДАКЦИЯ ULTRA)
-- ==============================================================================
-- Включает: fn::gather_rag_bundle, fn::get_chapter_multi_hop_context,
--           fn::resolve_auto_skills.
-- ==============================================================================

-- ===============================================
-- 1. СБОР RAG-КОНТЕКСТА (СУЩНОСТИ, ЧАНКИ, ГЛАВЫ, СВЯЗИ)
-- ===============================================

DEFINE FUNCTION OVERWRITE fn::gather_rag_bundle(
    $proj: record<projects>, 
    $q: string, 
    $limit: int, 
    $rel_limit: int
) {
    LET $ents = (
        SELECT id, name, entity_type AS type_key, description, tags, attributes 
        FROM entities 
        WHERE project_id = $proj AND (name @1@ $q OR description @1@ $q) 
        LIMIT $limit
    );
    
    LET $chunks = (
        SELECT id, entity_id, content 
        FROM entity_chunks 
        WHERE project_id = $proj AND content @1@ $q 
        LIMIT $limit
    );

    LET $chaps = (
        SELECT id, title, content 
        FROM chapters 
        WHERE project_id = $proj AND (title @1@ $q OR content @1@ $q) 
        LIMIT $limit
    );

    LET $seed_entities = array::distinct(
        array::concat($ents.id, $chunks.entity_id)
    );

    LET $rels = (
        SELECT in, out, rel_type, description, strength 
        FROM entity_rel 
        WHERE in IN $seed_entities OR out IN $seed_entities 
        ORDER BY strength DESC 
        LIMIT $rel_limit
    );

    RETURN {
        entities: $ents,
        chunks: $chunks,
        chapters: $chaps,
        relations: $rels
    };
};

-- ===============================================
-- 2. GRAPHRAG: МНОГОШАГОВЫЙ ОБХОД КОНТЕКСТА ГЛАВЫ
-- ===============================================

DEFINE FUNCTION OVERWRITE fn::get_chapter_multi_hop_context($chapter: record<chapters>) {
    LET $participants = (SELECT VALUE in FROM appears_in WHERE out = $chapter);
    LET $relations = (
        SELECT 
            in.name AS source_entity,
            rel_type,
            strength,
            out.name AS target_entity
        FROM entity_rel 
        WHERE in IN $participants AND out IN $participants
    );
    LET $timeline = (
        SELECT * FROM timeline_events 
        WHERE chapter_id = $chapter
    );
    LET $promises = (
        SELECT * FROM plot_promises 
        WHERE chapter_id = $chapter OR (project_id = $chapter.project_id AND status != 'resolved')
    );
    RETURN {
        participants: $participants,
        relations: $relations,
        timeline: $timeline,
        plot_promises: $promises
    };
};

-- ===============================================
-- 3. АТОМАРНЫЙ РЕЗОЛВ НАВЫКОВ (ТРИГГЕРЫ + BM25)
-- ===============================================

DEFINE FUNCTION OVERWRITE fn::resolve_auto_skills(
    $proj: option<record<projects>>,
    $query: string,
    $limit: int
) {
    LET $bm25_matches = (
        SELECT id, name, description, prompt_text, file_path, priority, 'bm25' AS matched_via, 1.0 AS score
        FROM ai_skills
        WHERE (project_id = $proj OR project_id = NONE)
          AND is_auto_trigger = true
          AND is_unlocked = true
          AND (name @1@ $query OR description @1@ $query OR prompt_text @1@ $query)
        LIMIT $limit
    );

    LET $trigger_matches = (
        SELECT id, name, description, prompt_text, file_path, priority, 'trigger' AS matched_via, 2.0 AS score
        FROM ai_skills
        WHERE (project_id = $proj OR project_id = NONE)
          AND is_auto_trigger = true
          AND is_unlocked = true
          AND array::any(triggers, |$t| string::len($t) > 0 AND (string::lowercase($query) CONTAINS string::lowercase($t) OR string::lowercase($t) CONTAINS string::lowercase($query)))
        LIMIT $limit
    );

    RETURN array::distinct(array::concat($trigger_matches, $bm25_matches));
};
