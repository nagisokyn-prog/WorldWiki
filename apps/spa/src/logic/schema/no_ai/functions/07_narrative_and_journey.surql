-- 07_NARRATIVE_AND_JOURNEY.SURQL — СЮЖЕТНЫЕ ОБЕЩАНИЯ И ИНВЕНТАРЬ


-- 40. СОХРАНЕНИЕ / ОБНОВЛЕНИЕ СЮЖЕТНОГО ОБЕЩАНИЯ (PLOT PROMISE)
DEFINE FUNCTION OVERWRITE fn::upsert_plot_promise(
    $id: string,
    $proj: record<projects>,
    $chap: record<chapters>,
    $data: object
) {
    LET $p_rec = fn::normalize_project_id($proj);
    LET $rec_id = type::record('plot_promises', $id);
    LET $milestones = IF $data.milestones != NONE { $data.milestones } ELSE { [] };
    
    LET $promise = (
        UPSERT $rec_id MERGE {
            project_id: $p_rec,
            kind: IF $data.kind != NONE { $data.kind } ELSE { 'gun' },
            title: IF $data.title != NONE { $data.title } ELSE { '' },
            note: IF $data.note != NONE { $data.note } ELSE { NONE },
            status: IF $data.status != NONE { $data.status } ELSE { 'planted' },
            updated_at: time::now()
        }
    );

    DELETE promise_milestones WHERE in = $rec_id;

    IF array::len($milestones) > 0 {
        FOR $m IN $milestones {
            IF $m.block_id != NONE {
                LET $block_rec = type::record('text_blocks', type::string($m.block_id).replace('text_blocks:', ''));
                RELATE $rec_id->promise_milestones->$block_rec SET
                    project_id = $p_rec,
                    stage = IF $m.stage != NONE { $m.stage } ELSE { 'plant' },
                    quote = IF $m.quote != NONE { $m.quote } ELSE { '' },
                    note = IF $m.note != NONE { $m.note } ELSE { NONE },
                    created_at = time::now();
            };
        };
    };

    RETURN (
        SELECT 
            id,
            project_id,
            kind,
            title,
            note,
            status,
            created_at,
            updated_at,
            ->promise_milestones.{
                milestone_id: id,
                stage: stage,
                quote: quote,
                note: note,
                block_id: out.id,
                chapter_id: out.chapter_id,
                order_index: out.order_index
            } AS milestones
        FROM $rec_id
        LIMIT 1
    )[0];
};

-- 41. СБОР МУЛЬТИ-ПЕРСОНАЖНОГО ПУТИ (MULTI-CHARACTER JOURNEY & CROSS-ARC NAVIGATOR)
DEFINE FUNCTION OVERWRITE fn::get_multi_character_journey($proj: record<projects>, $entity_ids: array) {
    LET $p_rec = fn::normalize_project_id($proj);
    LET $rec_ids = (
        SELECT VALUE type::record('entities', type::string($this).replace('entities:', '')) 
        FROM $entity_ids
        LIMIT 500
    );

    LET $entities_info = (
        SELECT 
            id, 
            name, 
            schema_id.type_key AS entity_type, 
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
            IF string::starts_with(type::string(out), 'text_blocks') { type::string(out.chapter_id) } ELSE { type::string(out.id) } AS chapter_id,
            IF string::starts_with(type::string(out), 'text_blocks') { out.chapter_id.title } ELSE { out.title } AS chapter_title,
            IF string::starts_with(type::string(out), 'text_blocks') { out.chapter_id.volume_id.title } ELSE IF out.volume_id.title != NONE { out.volume_id.title } ELSE { NONE } AS volume_title,
            IF string::starts_with(type::string(out), 'text_blocks') { out.chapter_id.sort_order } ELSE IF out.sort_order != NONE { out.sort_order } ELSE { 0 } AS chapter_order,
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
            type::string(out.chapter_id) AS chapter_id,
            type::string(out.arc_id) AS arc_id,
            out.arc_id.title AS arc_title,
            out.arc_phase AS arc_phase,
            out.arc_id.color AS arc_color,
            out.timeline_event_id.m_abs AS m_abs,
            IF array::len(out<-appears_in<-entities.id) > 0 { out<-appears_in<-entities.id } ELSE { NONE } AS participant_ids
        FROM promise_milestones 
        WHERE project_id = $p_rec OR in.project_id = $p_rec
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
    LET $p_rec = fn::normalize_project_id($proj);

    LET $entities = (
        SELECT 
            type::string(id) AS id, 
            name, 
            schema_id.type_key AS entity_type, 
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
            type::string(->promise_milestones.out.chapter_id[0]) AS chapter_id, 
            ->promise_milestones.out.timeline_event_id.m_abs[0] AS m_abs, 
            [] AS participant_ids, 
            title, 
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
    LET $p_rec = fn::normalize_project_id($proj);
    LET $item_rec = type::record('entities', type::string($item).replace('entities:', ''));

    LET $item_info = (
        SELECT 
            type::string(id) AS id, 
            name, 
            schema_id.type_key AS entity_type, 
            attributes
        FROM $item_rec
        LIMIT 1
    )[0];

    LET $characters = (
        SELECT 
            type::string(id) AS id, 
            name
        FROM entities
        WHERE project_id = $p_rec AND schema_id.type_key = 'character'
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
            type::string(->promise_milestones.out.chapter_id[0]) AS chapter_id, 
            ->promise_milestones.out.timeline_event_id.m_abs[0] AS m_abs, 
            [] AS participant_ids, 
            title, 
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
