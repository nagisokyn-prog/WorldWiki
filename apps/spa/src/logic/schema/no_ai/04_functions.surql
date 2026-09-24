-- ==============================================================================
-- 04_FUNCTIONS.SURQL — ХРАНИМЫЕ АНАЛИТИЧЕСКИЕ И ГРАФОВЫЕ ФУНКЦИИ БАЗОВОГО ЯДРА
-- ==============================================================================
-- Стандарт: SDB-002 (OVERWRITE), SDB-003 (Параметризация), SDB-007 (Атомарность)
-- ==============================================================================

-- 1. СБОР МАТРИЦЫ УЧАСТИЙ (CROSS-REFERENCE MATRIX & HEATMAP)
DEFINE FUNCTION OVERWRITE fn::get_cross_reference_matrix($proj: record<projects>) {
    LET $chapters = (
        SELECT id, title, sort_order, word_count 
        FROM chapters 
        WHERE project_id = $proj 
        ORDER BY sort_order ASC
    );

    LET $entities = (
        SELECT 
            id, 
            name, 
            entity_type,
            attributes.is_deceased AS is_deceased,
            attributes.death_m_abs AS death_m_abs,
            ->appears_in.{
                out AS chapter_id,
                source,
                role
            } AS appearances
        FROM entities 
        WHERE project_id = $proj 
        ORDER BY name ASC
    );

    RETURN {
        chapters: $chapters,
        entities: $entities
    };
};

-- 2. СБОР ДАННЫХ ДЛЯ ХРОНОЛОГИЧЕСКОГО ОКНА (TIMELINE INSPECTOR)
DEFINE FUNCTION OVERWRITE fn::get_timeline_inspector_data($proj: record<projects>) {
    LET $events = (
        SELECT 
            id,
            title,
            description,
            m_abs,
            calendar_id,
            ->revealed_in.{
                out AS chapter_id,
                out.title AS chapter_title,
                out.sort_order AS chapter_order,
                pov_id,
                kind,
                block_id
            } AS reveals,
            <-participates_in<-entities.{ id, name, entity_type } AS participants
        FROM timeline_events
        WHERE project_id = $proj
        ORDER BY m_abs ASC
    );

    LET $chapters = (
        SELECT id, title, sort_order 
        FROM chapters 
        WHERE project_id = $proj 
        ORDER BY sort_order ASC
    );

    RETURN {
        events: $events,
        chapters: $chapters
    };
};

-- 3. ВЫБОРКА ВРЕМЕННОГО СРЕЗА ГРАФА СВЯЗЕЙ («ПАУТИНА»)
DEFINE FUNCTION OVERWRITE fn::get_graph_time_slice($proj: record<projects>) {
    LET $nodes = (
        SELECT id, name, entity_type, tags, attributes 
        FROM entities 
        WHERE project_id = $proj
    );

    LET $edges = (
        SELECT 
            id,
            in AS source_id,
            out AS target_id,
            rel_type,
            description,
            strength,
            is_auto_extend,
            start_chapter,
            start_chapter.sort_order AS start_order,
            end_chapter,
            end_chapter.sort_order AS end_order,
            (SELECT VALUE m_abs FROM timeline_events WHERE chapter_id = start_chapter LIMIT 1)[0] AS inferred_start_m_abs
        FROM entity_rel
        WHERE project_id = $proj
    );

    RETURN {
        nodes: $nodes,
        edges: $edges
    };
};

-- 4. СБОР ПОЛНОГО ПУТИ ПЕРСОНАЖА (CHARACTER JOURNEY)
DEFINE FUNCTION OVERWRITE fn::get_character_journey($proj: record<projects>, $entity: record<entities>) {
    LET $info = (SELECT id, name, entity_type, attributes FROM $entity);
    LET $appearances = (
        SELECT 
            out.id AS chapter_id,
            out.title AS chapter_title,
            out.sort_order AS chapter_order,
            source,
            role,
            created_at
        FROM appears_in 
        WHERE in = $entity
    );
    LET $events = (
        SELECT 
            out.id AS event_id,
            out.title AS event_title,
            out.m_abs AS m_abs,
            role
        FROM participates_in 
        WHERE in = $entity
    );
    LET $relations = (
        SELECT 
            id,
            out.name AS target_name,
            rel_type,
            strength,
            start_chapter.sort_order AS start_order,
            end_chapter.sort_order AS end_order
        FROM entity_rel 
        WHERE in = $entity OR out = $entity
    );
    LET $promises = (
        SELECT 
            id, 
            kind, 
            quote, 
            status, 
            chapter_id.sort_order AS planted_order,
            resolved_in_chapter.sort_order AS resolved_order
        FROM plot_promises 
        WHERE participant_ids CONTAINS $entity
    );

    RETURN {
        entity: $info[0],
        appearances: $appearances,
        events: $events,
        relations: $relations,
        promises: $promises
    };
};
