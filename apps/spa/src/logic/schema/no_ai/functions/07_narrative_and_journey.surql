-- 07_NARRATIVE_AND_JOURNEY.SURQL — СЮЖЕТНЫЕ ОБЕЩАНИЯ И ИНВЕНТАРЬ


-- 40. СОХРАНЕНИЕ / ОБНОВЛЕНИЕ СЮЖЕТНОГО ОБЕЩАНИЯ (PLOT PROMISE / SCENE)
DEFINE FUNCTION OVERWRITE fn::upsert_plot_promise(
    $id: string,
    $proj: record<projects>,
    $chap: record<chapters>,
    $data: object
) {
    LET $p_rec = type::record('projects', type::string($proj).replace('projects:', ''));
    LET $rec_id = type::record('plot_promises', $id);
    
    UPSERT $rec_id MERGE {
        project_id: $p_rec,
        chapter_id: $chap,
        kind: IF $data.kind != NONE { $data.kind } ELSE { 'scene' },
        quote: IF $data.quote != NONE { $data.quote } ELSE { '' },
        paragraph_index: IF $data.paragraph_index != NONE { type::int($data.paragraph_index) } ELSE { 1 },
        block_id: IF $data.block_id != NONE { $data.block_id } ELSE { NONE },
        note: IF $data.note != NONE { $data.note } ELSE { NONE },
        status: IF $data.status != NONE { $data.status } ELSE { 'planted' },
        progressions: IF $data.progressions != NONE { $data.progressions } ELSE { [] },
        resolution: IF $data.resolution != NONE { $data.resolution } ELSE { NONE },
        resolved_in_volume: IF $data.resolved_in_volume != NONE { $data.resolved_in_volume } ELSE { NONE },
        resolved_in_chapter: IF $data.resolved_in_chapter != NONE { $data.resolved_in_chapter } ELSE { NONE },
        participant_ids: IF $data.participant_ids != NONE { $data.participant_ids } ELSE { NONE },
        location_id: IF $data.location_id != NONE { $data.location_id } ELSE { NONE },
        timeline_event_id: IF $data.timeline_event_id != NONE { $data.timeline_event_id } ELSE { NONE },
        arc_id: IF $data.arc_id != NONE { $data.arc_id } ELSE { NONE },
        arc_phase: IF $data.arc_phase != NONE { $data.arc_phase } ELSE { NONE },
        arcs: IF $data.arcs != NONE { $data.arcs } ELSE { [] },
        m_abs: IF $data.m_abs != NONE { type::int($data.m_abs) } ELSE { NONE },
        calendar_id: IF $data.calendar_id != NONE { $data.calendar_id } ELSE { NONE },
        date_fields: IF $data.date_fields != NONE { $data.date_fields } ELSE { NONE },
        updated_at: time::now()
    };
};

-- 41. СБОР МУЛЬТИ-ПЕРСОНАЖНОГО ПУТИ (MULTI-CHARACTER JOURNEY & CROSS-ARC NAVIGATOR)
DEFINE FUNCTION OVERWRITE fn::get_multi_character_journey($proj: record<projects>, $entity_ids: array) {
    LET $p_rec = type::record('projects', type::string($proj).replace('projects:', ''));
    LET $rec_ids = (
        SELECT VALUE type::record('entities', type::string($this).replace('entities:', '')) 
        FROM $entity_ids
        LIMIT 500
    );

    LET $entities_info = (
        SELECT 
            id, 
            name, 
            entity_type, 
            attributes,
            avatar_url
        FROM entities
        WHERE id IN $rec_ids
        LIMIT 500
    );

    LET $appearances = (
        SELECT 
            in.id AS entity_id,
            in.name AS entity_name,
            out.id AS chapter_id,
            out.title AS chapter_title,
            IF out.volume_id.title != NONE { out.volume_id.title } ELSE { NONE } AS volume_title,
            IF out.sort_order != NONE { out.sort_order } ELSE { 0 } AS chapter_order,
            source,
            role,
            created_at
        FROM appears_in 
        WHERE in IN $rec_ids
        LIMIT 2000
    );

    LET $events = (
        SELECT 
            in.id AS entity_id,
            in.name AS entity_name,
            out.id AS event_id,
            out.title AS event_title,
            out.description AS event_desc,
            out.m_abs AS m_abs,
            out.calendar_id AS calendar_id,
            role
        FROM participates_in 
        WHERE in IN $rec_ids
        LIMIT 2000
    );

    LET $promises = (
        SELECT 
            id, 
            kind, 
            quote, 
            status,
            paragraph_index,
            block_id,
            chapter_id.id AS chapter_id,
            chapter_id.title AS chapter_title,
            IF chapter_id.volume_id.title != NONE { chapter_id.volume_id.title } ELSE { NONE } AS volume_title,
            IF chapter_id.sort_order != NONE { chapter_id.sort_order } ELSE { 0 } AS planted_order,
            IF resolved_in_chapter.sort_order != NONE { resolved_in_chapter.sort_order } ELSE { NONE } AS resolved_order,
            arc_id.id AS arc_id,
            arc_id.title AS arc_title,
            arc_id.color AS arc_color,
            arc_phase,
            arcs,
            IF m_abs != NONE { m_abs } 
               ELSE IF timeline_event_id.m_abs != NONE { timeline_event_id.m_abs } 
               ELSE { NONE } AS m_abs,
            IF calendar_id != NONE { calendar_id } 
               ELSE IF timeline_event_id.calendar_id != NONE { timeline_event_id.calendar_id } 
               ELSE { NONE } AS calendar_id,
            date_fields,
            timeline_event_id,
            participant_ids
        FROM plot_promises 
        WHERE project_id = $p_rec
        LIMIT 2000
    );

    RETURN {
        entities: $entities_info,
        appearances: $appearances,
        events: $events,
        promises: $promises
    };
};

-- 42. СБОР ТРЕКЕРА ЧЕХОВСКИХ РУЖЕЙ И ИНВЕНТАРЯ
DEFINE FUNCTION OVERWRITE fn::get_item_tracker($proj: record<projects>) {
    LET $p_rec = type::record('projects', type::string($proj).replace('projects:', ''));

    LET $entities = (
        SELECT 
            type::string(id) AS id, 
            name, 
            entity_type, 
            attributes
        FROM entities
        WHERE project_id = $p_rec
        LIMIT 5000
    );

    LET $chapters = (
        SELECT 
            type::string(id) AS id, 
            title, 
            IF sort_order != NONE { sort_order } ELSE { 0 } AS sort_order
        FROM chapters
        WHERE project_id = $p_rec
        ORDER BY sort_order ASC
        LIMIT 1000
    );

    LET $promises = (
        SELECT 
            type::string(id) AS id, 
            type::string(chapter_id) AS chapter_id, 
            m_abs, 
            IF participant_ids != NONE { participant_ids } ELSE { [] } AS participant_ids, 
            quote AS title, 
            IF note != NONE { note } ELSE { '' } AS description
        FROM plot_promises
        WHERE project_id = $p_rec
        LIMIT 5000
    );

    LET $events = (
        SELECT 
            type::string(id) AS id, 
            type::string(->revealed_in.out[0]) AS chapter_id, 
            m_abs, 
            <-participates_in.in AS participants, 
            title, 
            IF description != NONE { description } ELSE { '' } AS description
        FROM timeline_events
        WHERE project_id = $p_rec
        LIMIT 5000
    );

    RETURN {
        entities: $entities,
        chapters: $chapters,
        promises: $promises,
        events: $events
    };
};

-- 43. ХРОНОЛОГИЯ ПУТИ АРТЕФАКТА
DEFINE FUNCTION OVERWRITE fn::get_item_journey($proj: record<projects>, $item: record<entities>) {
    LET $p_rec = type::record('projects', type::string($proj).replace('projects:', ''));
    LET $item_rec = type::record('entities', type::string($item).replace('entities:', ''));

    LET $item_info = (
        SELECT 
            type::string(id) AS id, 
            name, 
            entity_type, 
            attributes
        FROM $item_rec
        LIMIT 1
    )[0];

    LET $characters = (
        SELECT 
            type::string(id) AS id, 
            name
        FROM entities
        WHERE project_id = $p_rec AND entity_type = 'character'
        LIMIT 1000
    );

    LET $chapters = (
        SELECT 
            type::string(id) AS id, 
            title, 
            IF sort_order != NONE { sort_order } ELSE { 0 } AS sort_order
        FROM chapters
        WHERE project_id = $p_rec
        ORDER BY sort_order ASC
        LIMIT 1000
    );

    LET $promises = (
        SELECT 
            type::string(id) AS id, 
            type::string(chapter_id) AS chapter_id, 
            m_abs, 
            IF participant_ids != NONE { participant_ids } ELSE { [] } AS participant_ids, 
            quote AS title, 
            IF note != NONE { note } ELSE { '' } AS description
        FROM plot_promises
        WHERE project_id = $p_rec
        LIMIT 5000
    );

    LET $events = (
        SELECT 
            type::string(id) AS id, 
            type::string(->revealed_in.out[0]) AS chapter_id, 
            m_abs, 
            <-participates_in.in AS participants, 
            title, 
            IF description != NONE { description } ELSE { '' } AS description
        FROM timeline_events
        WHERE project_id = $p_rec
        LIMIT 5000
    );

    RETURN {
        item: $item_info,
        characters: $characters,
        chapters: $chapters,
        promises: $promises,
        events: $events
    };
};
