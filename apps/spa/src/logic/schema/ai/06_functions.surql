-- ==============================================================================
-- 06_FUNCTIONS.SURQL — ХРАНИМЫЕ АНАЛИТИЧЕСКИЕ И RAG ФУНКЦИИ (ULTRA EDITION)
-- ==============================================================================
-- Включает:
-- 1. fn::upsert_global_web_page (Атомарная функция кэширования веб-страниц)
-- 2. fn::gather_rag_bundle (Автоматический сбор контекста сущностей, чанков, глав и связей)
-- 3. fn::get_chapter_multi_hop_context (GraphRAG: многошаговый обход связей и таймлайна главы)
-- 4. fn::resolve_auto_skills (Атомарный резолв навыков по триггерам и BM25)
-- ==============================================================================

-- 1. АТОМАРНАЯ ФУНКЦИЯ КЭШИРОВАНИЯ ВЕБ-СТРАНИЦЫ
DEFINE FUNCTION OVERWRITE fn::upsert_global_web_page(
    $url: string,
    $canonical_url: string,
    $domain: string,
    $title: string,
    $content_type: string,
    $language: string,
    $content_hash: string,
    $content: string,
    $extracted_md: string,
    $status_code: int,
    $ttl_days: int
) {
    LET $existing = (
        SELECT id, content_hash FROM web_pages 
        WHERE canonical_url = $canonical_url 
        LIMIT 1
    )[0];

    IF $existing != NONE {
        IF $existing.content_hash == $content_hash {
            UPDATE $existing.id SET
                hit_count += 1,
                fetched_at = time::now(),
                expires_at = time::now() + duration::from_days($ttl_days);
            RETURN { id: $existing.id, is_new: false, is_updated: false };
        } ELSE {
            UPDATE $existing.id SET
                content_hash = $content_hash,
                title = $title,
                content_type = $content_type,
                language = $language,
                content = $content,
                extracted_markdown = $extracted_md,
                hit_count += 1,
                fetched_at = time::now(),
                expires_at = time::now() + duration::from_days($ttl_days);
            RETURN { id: $existing.id, is_new: false, is_updated: true };
        };
    } ELSE {
        LET $created = (
            CREATE web_pages SET
                url = $url,
                canonical_url = $canonical_url,
                domain = $domain,
                title = $title,
                content_type = $content_type,
                language = $language,
                content_hash = $content_hash,
                content = $content,
                extracted_markdown = $extracted_md,
                status_code = $status_code,
                hit_count = 1,
                fetched_at = time::now(),
                expires_at = time::now() + duration::from_days($ttl_days)
        );
        RETURN { id: $created[0].id, is_new: true, is_updated: false };
    };
};

-- 2. СБОР RAG-КОНТЕКСТА (СУЩНОСТИ, ЧАНКИ, ГЛАВЫ, СВЯЗИ)
DEFINE FUNCTION OVERWRITE fn::gather_rag_bundle(
    $proj: record<projects>, 
    $q: string, 
    $limit: int, 
    $rel_limit: int
) {
    LET $p_rec = fn::normalize_project_id($proj);
    LET $q_low = string::lowercase($q);

    LET $ents = (
        SELECT id, name, entity_type AS type_key, description, tags, attributes 
        FROM entities 
        WHERE project_id = $p_rec 
          AND (string::lowercase(name) CONTAINS $q_low OR (description != NONE AND string::lowercase(type::string(description)) CONTAINS $q_low))
        LIMIT $limit
    );
    
    LET $chunks = (
        SELECT id, entity_id, content 
        FROM entity_chunks 
        WHERE project_id = $p_rec 
          AND (content != NONE AND string::lowercase(type::string(content)) CONTAINS $q_low)
        LIMIT $limit
    );

    LET $chaps = (
        SELECT id, title, content 
        FROM chapters 
        WHERE project_id = $p_rec 
          AND (string::lowercase(title) CONTAINS $q_low OR (content != NONE AND string::lowercase(type::string(content)) CONTAINS $q_low))
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

-- 3. GRAPHRAG: МНОГОШАГОВЫЙ ОБХОД КОНТЕКСТА ГЛАВЫ
DEFINE FUNCTION OVERWRITE fn::get_chapter_multi_hop_context($chapter: record<chapters>) {
    LET $participants = (SELECT VALUE in FROM appears_in WHERE out = $chapter LIMIT 200);
    LET $relations = (
        SELECT 
            in.name AS source_entity,
            rel_type,
            strength,
            out.name AS target_entity
        FROM entity_rel 
        WHERE in IN $participants AND out IN $participants
        LIMIT 200
    );
    LET $timeline = (
        SELECT id, project_id, title, description, m_abs, calendar_id, created_at 
        FROM timeline_events 
        WHERE chapter_id = $chapter
        LIMIT 100
    );
    LET $promises = (
        SELECT id, project_id, chapter_id, kind, quote, note, status, resolved_in_volume, resolved_in_chapter, location_id, timeline_event_id, arc_id, created_at 
        FROM plot_promises 
        WHERE chapter_id = $chapter OR (project_id = $chapter.project_id AND status != 'resolved')
        LIMIT 100
    );
    RETURN {
        participants: $participants,
        relations: $relations,
        timeline: $timeline,
        plot_promises: $promises
    };
};

-- 4. АТОМАРНЫЙ РЕЗОЛВ НАВЫКОВ (ТРИГГЕРЫ + BM25)
DEFINE FUNCTION OVERWRITE fn::resolve_auto_skills(
    $proj: option<record<projects>>,
    $query: string,
    $limit: int
) {
    LET $bm25_matches = (
        SELECT id, name, description, prompt_text, file_path, priority, 'bm25' AS matched_via
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
