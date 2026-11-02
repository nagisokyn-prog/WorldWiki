-- 07_NARRATIVE_AND_JOURNEY.SURQL — СЮЖЕТНЫЕ ОБЕЩАНИЯ И ИНВЕНТАРЬ


-- 40. СОХРАНЕНИЕ / ОБНОВЛЕНИЕ СЮЖЕТНОГО ОБЕЩАНИЯ (PLOT PROMISE / NARRATIVE HUB)
DEFINE FUNCTION OVERWRITE fn::upsert_plot_promise(
    $id: string,
    $proj: any,
    $chap: option<record<chapters> | string | null>,
    $data: object
) {
    LET $p_rec = fn::normalize_project_id($proj);
    LET $rec_id = IF string::starts_with(type::string($id), 'plot_promises:') { type::record($id) } ELSE { type::record('plot_promises', $id) };
    LET $milestones = IF $data.milestones != NONE { $data.milestones } ELSE { [] };
    
    LET $target_chap = IF $chap != NONE AND $chap != NULL AND type::string($chap) != '' {
        type::record('chapters', type::string($chap).replace('chapters:', ''))
    } ELSE IF $data.chapter_id != NONE AND $data.chapter_id != NULL AND type::string($data.chapter_id) != '' {
        type::record('chapters', type::string($data.chapter_id).replace('chapters:', ''))
    } ELSE IF array::len($milestones) > 0 AND array::first($milestones).chapter_id != NONE AND type::string(array::first($milestones).chapter_id) != '' {
        type::record('chapters', type::string(array::first($milestones).chapter_id).replace('chapters:', ''))
    } ELSE { NONE };

    LET $target_para = IF $data.paragraph_index != NONE { 
        $data.paragraph_index 
    } ELSE IF array::len($milestones) > 0 AND array::first($milestones).order_index != NONE {
        array::first($milestones).order_index
    } ELSE { NONE };

    LET $target_block = IF $data.block_id != NONE AND type::string($data.block_id) != '' {
        type::string($data.block_id)
    } ELSE IF array::len($milestones) > 0 AND array::first($milestones).block_id != NONE AND type::string(array::first($milestones).block_id) != '' {
        type::string(array::first($milestones).block_id)
    } ELSE { NONE };

    -- Синхронизация времени и события таймлайна (timeline_events)
    LET $has_m_abs = $data.m_abs != NONE AND $data.m_abs != NULL;
    LET $existing_evt_id = IF $data.timeline_event_id != NONE AND $data.timeline_event_id != NULL AND type::string($data.timeline_event_id) != '' {
        type::record('timeline_events', type::string($data.timeline_event_id).replace('timeline_events:', ''))
    } ELSE {
        (SELECT VALUE out FROM occurs_at WHERE in = $rec_id LIMIT 1)[0]
    };

    LET $target_evt_id = IF $has_m_abs {
        LET $cal_rec = IF $data.calendar_id != NONE AND $data.calendar_id != NULL AND type::string($data.calendar_id) != '' {
            type::record('calendars', type::string($data.calendar_id).replace('calendars:', ''))
        } ELSE {
            (SELECT VALUE id FROM calendars WHERE fn::normalize_project_id(planet_id.project_id) = $p_rec OR fn::normalize_project_id(project_id) = $p_rec ORDER BY is_default DESC, is_master DESC LIMIT 1)[0]
        };
        LET $evt_title = IF $data.title != NONE AND $data.title != '' { $data.title } ELSE { 'Сцена' };
        LET $evt_desc = IF $data.note != NONE { $data.note } ELSE { NONE };
        LET $evt_mabs = type::int($data.m_abs);
        
        IF $existing_evt_id != NONE AND $existing_evt_id != NULL {
            (UPSERT $existing_evt_id SET
                project_id = $p_rec,
                title = $evt_title,
                description = $evt_desc,
                m_abs = $evt_mabs,
                calendar_id = $cal_rec
            );
            $existing_evt_id
        } ELSE {
            LET $new_evt = (CREATE timeline_events SET
                project_id = $p_rec,
                title = $evt_title,
                description = $evt_desc,
                m_abs = $evt_mabs,
                calendar_id = $cal_rec,
                created_at = time::now()
            );
            $new_evt[0].id
        }
    } ELSE IF $existing_evt_id != NONE AND $existing_evt_id != NULL {
        $existing_evt_id
    } ELSE {
        NONE
    };

    LET $promise = (
        UPSERT $rec_id MERGE {
            project_id: $p_rec,
            chapter_id: $target_chap,
            paragraph_index: $target_para,
            block_id: $target_block,
            kind: IF $data.kind != NONE { $data.kind } ELSE { 'gun' },
            time_nature: IF $data.time_nature != NONE { $data.time_nature } ELSE { 'present' },
            title: IF $data.title != NONE { $data.title } ELSE { '' },
            note: IF $data.note != NONE { $data.note } ELSE { NONE },
            status: IF $data.status != NONE { $data.status } ELSE { 'planted' },
            location_id: IF $data.location_id != NONE { $data.location_id } ELSE { NONE },
            timeline_event_id: $target_evt_id,
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

    -- Синхронизация участников (participant_of): entities -> participant_of -> plot_promises
    DELETE participant_of WHERE out = $rec_id;
    LET $participants = IF $data.participant_ids != NONE { $data.participant_ids } ELSE { [] };
    IF array::len($participants) > 0 {
        FOR $pid IN $participants {
            IF $pid != NONE AND $pid != NULL {
                LET $clean_id = type::string($pid).replace('characters:', '').replace('character:', '').replace('entities:', '');
                LET $found_ent = (SELECT VALUE id FROM entities WHERE schema_id.project_id = $p_rec AND (id = type::record('entities', $clean_id) OR name = type::string($pid) OR string::lowercase(name) = string::lowercase(type::string($pid))) LIMIT 1);
                LET $ent_rec = IF array::len($found_ent) > 0 { $found_ent[0] } ELSE { type::record('entities', $clean_id) };
                RELATE $ent_rec->participant_of->$rec_id SET
                    project_id = $p_rec,
                    created_at = time::now();
            };
        };
    };

    -- Синхронизация сюжетных арок (advances_arc): plot_promises -> advances_arc -> story_arcs
    DELETE advances_arc WHERE in = $rec_id;
    LET $arcs = IF $data.arcs != NONE AND array::len($data.arcs) > 0 {
        $data.arcs
    } ELSE IF $data.arc_id != NONE AND $data.arc_id != NULL {
        [{ arc_id: $data.arc_id, arc_phase: IF $data.arc_phase != NONE { $data.arc_phase } ELSE { 'setup' } }]
    } ELSE {
        []
    };
    IF array::len($arcs) > 0 {
        FOR $a IN $arcs {
            IF $a.arc_id != NONE AND $a.arc_id != NULL {
                LET $arc_rec = type::record('story_arcs', type::string($a.arc_id).replace('story_arcs:', ''));
                RELATE $rec_id->advances_arc->$arc_rec SET
                    project_id = $p_rec,
                    phase = IF $a.arc_phase != NONE { $a.arc_phase } ELSE { 'setup' },
                    created_at = time::now();
            };
        };
    };

    -- Синхронизация таймлайна (occurs_at): plot_promises -> occurs_at -> timeline_events
    DELETE occurs_at WHERE in = $rec_id;
    IF $target_evt_id != NONE AND $target_evt_id != NULL {
        RELATE $rec_id->occurs_at->$target_evt_id SET
            project_id = $p_rec,
            time_nature = IF $data.time_nature != NONE { $data.time_nature } ELSE { 'present' },
            created_at = time::now();
    };

    RETURN (
        SELECT 
            id,
            project_id,
            kind,
            title,
            note,
            status,
            location_id,
            timeline_event_id,
            (timeline_event_id.m_abs ?? array::first(->occurs_at.out.m_abs)) AS m_abs,
            type::string(timeline_event_id.calendar_id ?? array::first(->occurs_at.out.calendar_id)) AS calendar_id,
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
            } AS milestones,
            <-participant_of.in.id AS participant_ids,
            ->advances_arc.{
                arc_id: type::string(out.id),
                arc_title: out.title,
                arc_color: out.color,
                arc_phase: phase
            } AS arcs
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

    LET $appears_in_list = (
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

    LET $participant_list = (
        SELECT 
            in.id AS entity_id,
            in.name AS entity_name,
            IF out.chapter_id != NONE { type::string(out.chapter_id) }
               ELSE IF array::first(out->promise_milestones.out.chapter_id) != NONE { type::string(array::first(out->promise_milestones.out.chapter_id)) }
               ELSE { '' } AS chapter_id,
            IF out.chapter_id.title != NONE { out.chapter_id.title }
               ELSE IF array::first(out->promise_milestones.out.chapter_id.title) != NONE { array::first(out->promise_milestones.out.chapter_id.title) }
               ELSE { 'Сцена' } AS chapter_title,
            IF out.chapter_id.volume_id.title != NONE { out.chapter_id.volume_id.title }
               ELSE IF array::first(out->promise_milestones.out.chapter_id.volume_id.title) != NONE { array::first(out->promise_milestones.out.chapter_id.volume_id.title) }
               ELSE { NONE } AS volume_title,
            IF out.chapter_id.sort_order != NONE { out.chapter_id.sort_order }
               ELSE IF array::first(out->promise_milestones.out.chapter_id.sort_order) != NONE { array::first(out->promise_milestones.out.chapter_id.sort_order) }
               ELSE { 0 } AS chapter_order,
            'scene' AS source,
            role,
            IF created_at != NONE { type::string(created_at) } ELSE { '' } AS created_at
        FROM participant_of 
        WHERE in IN $rec_ids
        LIMIT 2000
    );

    LET $appearances = array::concat($appears_in_list, $participant_list);

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
            IF title != NONE { title } ELSE { '' } AS quote,
            status,
            IF chapter_id != NONE { type::string(chapter_id) }
               ELSE IF array::len(->promise_milestones) > 0 { type::string(array::first(->promise_milestones.out.chapter_id)) }
               ELSE { NONE } AS chapter_id,
            IF chapter_id.title != NONE { chapter_id.title }
               ELSE IF array::first(->promise_milestones.out.chapter_id.title) != NONE { array::first(->promise_milestones.out.chapter_id.title) }
               ELSE { 'Сцена' } AS chapter_title,
            IF chapter_id.sort_order != NONE { chapter_id.sort_order }
               ELSE IF array::first(->promise_milestones.out.chapter_id.sort_order) != NONE { array::first(->promise_milestones.out.chapter_id.sort_order) }
               ELSE { 0 } AS planted_order,
            ->advances_arc.{
                arc_id: type::string(out.id),
                arc_title: out.title,
                arc_color: out.color,
                arc_phase: phase
            } AS arcs,
            IF array::len(->advances_arc) > 0 { type::string(array::first(->advances_arc.out.id)) } ELSE { NONE } AS arc_id,
            IF array::len(->advances_arc) > 0 { array::first(->advances_arc.out.title) } ELSE { NONE } AS arc_title,
            IF array::len(->advances_arc) > 0 { array::first(->advances_arc.phase) } ELSE { NONE } AS arc_phase,
            IF array::len(->advances_arc) > 0 { array::first(->advances_arc.out.color) } ELSE { NONE } AS arc_color,
            IF timeline_event_id.m_abs != NONE { timeline_event_id.m_abs } ELSE IF m_abs != NONE { m_abs } ELSE { NONE } AS m_abs,
            IF array::len(<-participant_of) > 0 { (SELECT VALUE type::string(id) FROM <-participant_of<-entities) } ELSE { [] } AS participant_ids
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
    LET $p_rec = fn::normalize_project_id($proj);

    LET $entities = (
        SELECT 
            type::string(id) AS id, 
            IF name != NONE AND name != NULL THEN name ELSE '' END AS name, 
            IF schema_id.type_key != NONE AND schema_id.type_key != NULL THEN schema_id.type_key ELSE 'unknown' END AS entity_type, 
            IF attributes != NONE AND attributes != NULL THEN attributes ELSE {} END AS attributes
        FROM entities
        WHERE schema_id.project_id = $p_rec
        LIMIT 5000
    );

    LET $chapters = (
        SELECT 
            type::string(id) AS id, 
            IF title != NONE AND title != NULL THEN title ELSE '' END AS title, 
            IF sort_order != NONE AND sort_order != NULL THEN sort_order ELSE 0 END AS sort_order
        FROM chapters
        WHERE volume_id.project_id = $p_rec
        ORDER BY sort_order ASC
        LIMIT 1000
    );

    LET $promises = (
        SELECT 
            type::string(id) AS id, 
            IF chapter_id != NONE AND chapter_id != NULL THEN type::string(chapter_id)
               ELSE IF array::first(->promise_milestones.out.chapter_id) != NONE THEN type::string(array::first(->promise_milestones.out.chapter_id))
               ELSE NONE END AS chapter_id, 
            IF (SELECT VALUE out.chapter_id FROM ->promise_milestones WHERE stage = 'resolution' LIMIT 1)[0] != NONE THEN type::string((SELECT VALUE out.chapter_id FROM ->promise_milestones WHERE stage = 'resolution' LIMIT 1)[0]) ELSE NONE END AS resolved_at_chapter_id,
            IF timeline_event_id.m_abs != NONE THEN timeline_event_id.m_abs
               ELSE IF chapter_id.sort_order != NONE THEN chapter_id.sort_order * 1440
               ELSE NONE END AS m_abs, 
            IF <-participant_of.in.id != NONE AND <-participant_of.in.id != NULL THEN <-participant_of.in.id ELSE [] END AS participant_ids, 
            IF title != NONE AND title != NULL THEN title ELSE '' END AS title, 
            IF note != NONE AND note != NULL THEN note ELSE '' END AS description,
            IF kind != NONE AND kind != NULL THEN kind ELSE 'gun' END AS kind,
            IF status != NONE AND status != NULL THEN status ELSE 'planted' END AS status
        FROM plot_promises
        WHERE project_id = $p_rec
        LIMIT 5000
    );

    LET $events = (
        SELECT 
            type::string(id) AS id, 
            IF array::first(->revealed_in.out) != NONE AND array::first(->revealed_in.out) != NULL THEN type::string(array::first(->revealed_in.out)) ELSE NONE END AS chapter_id, 
            m_abs, 
            IF <-participates_in.in != NONE AND <-participates_in.in != NULL THEN <-participates_in.in ELSE [] END AS participants, 
            IF title != NONE AND title != NULL THEN title ELSE '' END AS title, 
            IF description != NONE AND description != NULL THEN description ELSE '' END AS description
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
DEFINE FUNCTION OVERWRITE fn::get_item_journey($proj: record<projects>, $item: record) {
    LET $p_rec = fn::normalize_project_id($proj);
    LET $is_promise = string::starts_with(type::string($item), 'plot_promises');
    LET $item_info = IF $is_promise {
        (SELECT 
            type::string(id) AS id, 
            IF title != NONE AND title != NULL THEN title ELSE '' END AS name, 
            IF kind != NONE THEN kind ELSE 'gun' END AS entity_type, 
            {} AS attributes
        FROM ONLY type::record($item))
    } ELSE {
        (SELECT 
            type::string(id) AS id, 
            IF name != NONE AND name != NULL THEN name ELSE '' END AS name, 
            IF schema_id.type_key != NONE AND schema_id.type_key != NULL THEN schema_id.type_key ELSE 'unknown' END AS entity_type, 
            IF attributes != NONE AND attributes != NULL THEN attributes ELSE {} END AS attributes
        FROM ONLY type::record('entities', type::string($item).replace('entities:', '')))
    };

    LET $characters = (
        SELECT 
            type::string(id) AS id, 
            IF name != NONE AND name != NULL THEN name ELSE '' END AS name
        FROM entities
        WHERE schema_id.project_id = $p_rec AND schema_id.type_key = 'character'
        LIMIT 1000
    );

    LET $chapters = (
        SELECT 
            type::string(id) AS id, 
            IF title != NONE AND title != NULL THEN title ELSE '' END AS title, 
            IF sort_order != NONE AND sort_order != NULL THEN sort_order ELSE 0 END AS sort_order
        FROM chapters
        WHERE volume_id.project_id = $p_rec
        ORDER BY sort_order ASC
        LIMIT 1000
    );

    LET $promises = (
        SELECT 
            type::string(id) AS id, 
            IF chapter_id != NONE AND chapter_id != NULL THEN type::string(chapter_id)
               ELSE IF array::first(->promise_milestones.out.chapter_id) != NONE THEN type::string(array::first(->promise_milestones.out.chapter_id))
               ELSE NONE END AS chapter_id, 
            IF (SELECT VALUE out.chapter_id FROM ->promise_milestones WHERE stage = 'resolution' LIMIT 1)[0] != NONE THEN type::string((SELECT VALUE out.chapter_id FROM ->promise_milestones WHERE stage = 'resolution' LIMIT 1)[0]) ELSE NONE END AS resolved_at_chapter_id,
            IF timeline_event_id.m_abs != NONE THEN timeline_event_id.m_abs
               ELSE IF chapter_id.sort_order != NONE THEN chapter_id.sort_order * 1440
               ELSE NONE END AS m_abs, 
            IF <-participant_of.in.id != NONE AND <-participant_of.in.id != NULL THEN <-participant_of.in.id ELSE [] END AS participant_ids, 
            IF title != NONE AND title != NULL THEN title ELSE '' END AS title, 
            IF note != NONE AND note != NULL THEN note ELSE '' END AS description,
            IF kind != NONE AND kind != NULL THEN kind ELSE 'gun' END AS kind,
            IF status != NONE AND status != NULL THEN status ELSE 'planted' END AS status
        FROM plot_promises
        WHERE project_id = $p_rec
        LIMIT 5000
    );

    LET $events = (
        SELECT 
            type::string(id) AS id, 
            IF array::first(->revealed_in.out) != NONE AND array::first(->revealed_in.out) != NULL THEN type::string(array::first(->revealed_in.out)) ELSE NONE END AS chapter_id, 
            m_abs, 
            IF <-participates_in.in != NONE AND <-participates_in.in != NULL THEN <-participates_in.in ELSE [] END AS participants, 
            IF title != NONE AND title != NULL THEN title ELSE '' END AS title, 
            IF description != NONE AND description != NULL THEN description ELSE '' END AS description
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

-- 45. ПОЛУЧЕНИЕ СЮЖЕТНОГО ОБЕЩАНИЯ ПО ID
DEFINE FUNCTION OVERWRITE fn::get_plot_promise($id: any) {
    LET $rec = IF string::starts_with(type::string($id), 'plot_promises:') { type::record($id) } ELSE { type::record('plot_promises', $id) };
    LET $res = (
        SELECT 
            id,
            project_id,
            chapter_id,
            paragraph_index,
            block_id,
            kind,
            title,
            note,
            status,
            location_id,
            timeline_event_id,
            (timeline_event_id.m_abs ?? array::first(->occurs_at.out.m_abs)) AS m_abs,
            type::string(timeline_event_id.calendar_id ?? array::first(->occurs_at.out.calendar_id)) AS calendar_id,
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
            } AS milestones,
            <-participant_of.in.id AS participant_ids,
            ->advances_arc.{
                arc_id: out.id,
                arc_phase: phase
            } AS arcs
        FROM $rec
        LIMIT 1
    );
    RETURN IF array::len($res) > 0 { $res[0] } ELSE { NONE };
};

-- 46. СПИСОК СЮЖЕТНЫХ ОБЕЩАНИЙ ПРОЕКТА
DEFINE FUNCTION OVERWRITE fn::list_plot_promises_by_project($proj: any) {
    LET $p_rec = fn::normalize_project_id($proj);
    RETURN (
        SELECT 
            id,
            project_id,
            chapter_id,
            paragraph_index,
            block_id,
            kind,
            title,
            note,
            status,
            location_id,
            timeline_event_id,
            (timeline_event_id.m_abs ?? array::first(->occurs_at.out.m_abs)) AS m_abs,
            type::string(timeline_event_id.calendar_id ?? array::first(->occurs_at.out.calendar_id)) AS calendar_id,
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
            } AS milestones,
            <-participant_of.in.id AS participant_ids,
            ->advances_arc.{
                arc_id: out.id,
                arc_phase: phase
            } AS arcs
        FROM plot_promises 
        WHERE project_id = $p_rec
        LIMIT 500
    );
};

-- 47. СПИСОК СЮЖЕТНЫХ ОБЕЩАНИЙ ГЛАВЫ
DEFINE FUNCTION OVERWRITE fn::list_plot_promises_by_chapter($chap: any) {
    LET $ch_rec = IF string::starts_with(type::string($chap), 'chapters:') { type::record($chap) } ELSE { type::record('chapters', $chap) };
    RETURN (
        SELECT 
            id,
            project_id,
            chapter_id,
            paragraph_index,
            block_id,
            kind,
            title,
            note,
            status,
            location_id,
            timeline_event_id,
            (timeline_event_id.m_abs ?? array::first(->occurs_at.out.m_abs)) AS m_abs,
            type::string(timeline_event_id.calendar_id ?? array::first(->occurs_at.out.calendar_id)) AS calendar_id,
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
            } AS milestones,
            <-participant_of.in.id AS participant_ids,
            ->advances_arc.{
                arc_id: out.id,
                arc_phase: phase
            } AS arcs
        FROM plot_promises 
        WHERE chapter_id = $ch_rec OR ->promise_milestones.out.chapter_id CONTAINS $ch_rec
        LIMIT 200
    );
};

-- 48. СПИСОК НЕРАЗРЕШЕННЫХ ОБЕЩАНИЙ ТОМА
DEFINE FUNCTION OVERWRITE fn::list_unresolved_promises_by_volume($vol: any) {
    LET $vol_rec = IF string::starts_with(type::string($vol), 'volumes:') { type::record($vol) } ELSE { type::record('volumes', $vol) };
    LET $chapters = (SELECT VALUE out FROM contains WHERE in = $vol_rec LIMIT 100);
    RETURN (
        SELECT 
            id,
            project_id,
            chapter_id,
            paragraph_index,
            block_id,
            kind,
            title,
            note,
            status,
            location_id,
            timeline_event_id,
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
            } AS milestones,
            <-participant_of.in.id AS participant_ids,
            ->advances_arc.{
                arc_id: out.id,
                arc_phase: phase
            } AS arcs
        FROM plot_promises
        WHERE (chapter_id IN $chapters OR ->promise_milestones.out.chapter_id CONTAINSANY $chapters)
          AND status != 'resolved'
        LIMIT 500
    );
};

-- 49. УДАЛЕНИЕ СЮЖЕТНОГО ОБЕЩАНИЯ
DEFINE FUNCTION OVERWRITE fn::delete_plot_promise($id: any) {
    LET $rec = IF string::starts_with(type::string($id), 'plot_promises:') { type::record($id) } ELSE { type::record('plot_promises', $id) };
    
    -- Собираем связанные timeline_events
    LET $te_ids = (
        SELECT VALUE out FROM occurs_at WHERE in = $rec LIMIT 100
    );
    LET $direct_te = (SELECT VALUE timeline_event_id FROM $rec LIMIT 1)[0];
    LET $all_te = array::distinct(array::concat($te_ids, IF $direct_te != NONE AND $direct_te != NULL { [$direct_te] } ELSE { [] }));

    -- Очищаем ребра связей
    DELETE occurs_at WHERE in = $rec;
    DELETE promise_milestones WHERE in = $rec;
    DELETE advances_arc WHERE in = $rec;
    DELETE participant_of WHERE out = $rec;
    
    -- Удаляем сюжетное обещание
    DELETE $rec;

    -- Если у связанного timeline_events нет других сюжетных обещаний и нет канонических участников лора (participates_in), удаляем его
    FOR $te IN $all_te {
        IF $te != NONE AND $te != NULL {
            LET $other_promises = (SELECT VALUE count() FROM occurs_at WHERE out = $te);
            LET $direct_refs = (SELECT VALUE count() FROM plot_promises WHERE timeline_event_id = $te);
            LET $lore_participants = (SELECT VALUE count() FROM participates_in WHERE out = $te);
            IF ($other_promises[0] ?? 0) == 0 AND ($direct_refs[0] ?? 0) == 0 AND ($lore_participants[0] ?? 0) == 0 {
                DELETE $te;
            };
        };
    };
};

-- 50. СОХРАНЕНИЕ / ОБНОВЛЕНИЕ ЗАДАЧИ ПЛАНИРОВЩИКА (TODO)
DEFINE FUNCTION OVERWRITE fn::save_todo(
    $id: any,
    $owner_table: string,
    $owner_id: string,
    $text: string,
    $is_done: bool,
    $sort_order: int,
    $status: option<string>,
    $arc_id: any,
    $depends_on: any
) {
    LET $t_rec = IF string::starts_with(type::string($id), 'todos:') { type::record($id) } ELSE { type::record('todos', $id) };
    LET $o_rec = type::record($owner_table, $owner_id);
    LET $arc_rec = IF $arc_id != NONE AND $arc_id != NULL AND type::string($arc_id) != '' {
        IF string::starts_with(type::string($arc_id), 'story_arcs:') { type::record($arc_id) } ELSE { type::record('story_arcs', $arc_id) }
    } ELSE { NONE };
    LET $dep_rec = IF $depends_on != NONE AND $depends_on != NULL AND type::string($depends_on) != '' {
        IF string::starts_with(type::string($depends_on), 'todos:') { type::record($depends_on) } ELSE { type::record('todos', $depends_on) }
    } ELSE { NONE };

    -- Определение статуса
    LET $calculated_status = IF $status != NONE AND $status != NULL AND type::string($status) != '' {
        type::string($status)
    } ELSE IF $is_done {
        'done'
    } ELSE IF $dep_rec != NONE AND (SELECT VALUE status FROM $dep_rec LIMIT 1)[0] != 'done' {
        'blocked'
    } ELSE {
        'planned'
    };

    LET $res = (
        UPSERT $t_rec SET
            owner_id = $o_rec,
            arc_id = $arc_rec,
            depends_on = $dep_rec,
            text = $text,
            status = $calculated_status,
            is_done = ($calculated_status = 'done'),
            sort_order = $sort_order,
            updated_at = time::now()
    );

    -- Если статус стал 'done', разблокируем зависимые задачи (blocked -> planned)
    IF $calculated_status = 'done' {
        UPDATE todos SET status = 'planned' WHERE depends_on = $t_rec AND status = 'blocked';
    };

    RETURN IF array::len($res) > 0 { $res[0] } ELSE { NONE };
};

-- 50.1. АТОМАРНАЯ СМЕНА СТАТУСА ЗАДАЧИ
DEFINE FUNCTION OVERWRITE fn::set_todo_status($id: any, $new_status: string) {
    LET $t_rec = IF string::starts_with(type::string($id), 'todos:') { type::record($id) } ELSE { type::record('todos', $id) };
    LET $is_done_val = ($new_status = 'done');
    
    LET $res = (
        UPDATE $t_rec SET
            status = $new_status,
            is_done = $is_done_val,
            updated_at = time::now()
    );

    IF $new_status = 'done' {
        UPDATE todos SET status = 'planned' WHERE depends_on = $t_rec AND status = 'blocked';
    };

    RETURN IF array::len($res) > 0 { $res[0] } ELSE { NONE };
};

-- 51. ПОЛУЧЕНИЕ ЗАДАЧИ ПО ID
DEFINE FUNCTION OVERWRITE fn::get_todo($id: any) {
    LET $t_rec = IF string::starts_with(type::string($id), 'todos:') { type::record($id) } ELSE { type::record('todos', $id) };
    LET $res = (SELECT id, owner_id, arc_id, depends_on, text, status, is_done, sort_order, created_at, updated_at FROM $t_rec LIMIT 1);
    RETURN IF array::len($res) > 0 { $res[0] } ELSE { NONE };
};

-- 52. УДАЛЕНИЕ ЗАДАЧИ
DEFINE FUNCTION OVERWRITE fn::delete_todo($id: any) {
    LET $t_rec = IF string::starts_with(type::string($id), 'todos:') { type::record($id) } ELSE { type::record('todos', $id) };
    -- Освобождаем зависящие задачи, если родитель удален
    UPDATE todos SET depends_on = NONE, status = IF status = 'blocked' { 'planned' } ELSE { status } WHERE depends_on = $t_rec;
    DELETE $t_rec;
};

-- 53. СПИСОК ЗАДАЧ ПО ВЛАДЕЛЬЦУ
DEFINE FUNCTION OVERWRITE fn::list_todos_by_owner($owner_table: string, $owner_id: string) {
    LET $o_rec = type::record($owner_table, $owner_id);
    RETURN (
        SELECT 
            type::string(id) AS id, 
            type::string(owner_id) AS owner_id, 
            IF arc_id != NONE AND arc_id != NULL { type::string(arc_id) } ELSE { NONE } AS arc_id, 
            IF arc_id != NONE AND arc_id != NULL { arc_id.title } ELSE { NONE } AS arc_title, 
            IF depends_on != NONE AND depends_on != NULL { type::string(depends_on) } ELSE { NONE } AS depends_on, 
            text, 
            status, 
            is_done, 
            sort_order, 
            created_at, 
            updated_at 
        FROM todos 
        WHERE owner_id = $o_rec 
        ORDER BY sort_order ASC, created_at ASC 
        LIMIT 300
    );
};

-- 54. СПИСОК ЗАДАЧ ПО СПИСКУ ВЛАДЕЛЬЦЕВ
DEFINE FUNCTION OVERWRITE fn::list_todos_by_owners($owners: array<any>) {
    RETURN (
        SELECT 
            type::string(id) AS id, 
            type::string(owner_id) AS owner_id, 
            IF arc_id != NONE AND arc_id != NULL { type::string(arc_id) } ELSE { NONE } AS arc_id, 
            IF arc_id != NONE AND arc_id != NULL { arc_id.title } ELSE { NONE } AS arc_title, 
            IF depends_on != NONE AND depends_on != NULL { type::string(depends_on) } ELSE { NONE } AS depends_on, 
            text, 
            status, 
            is_done, 
            sort_order, 
            created_at, 
            updated_at 
        FROM todos 
        WHERE owner_id IN $owners 
        ORDER BY sort_order ASC, created_at ASC 
        LIMIT 500
    );
};

-- 55. ПОЛУЧЕНИЕ СЮЖЕТНОЙ АРКИ ПО ID
DEFINE FUNCTION OVERWRITE fn::get_story_arc($id: any) {
    LET $a_rec = IF string::starts_with(type::string($id), 'story_arcs:') { type::record($id) } ELSE { type::record('story_arcs', $id) };
    LET $res = (SELECT id, project_id, title, status, created_at, updated_at FROM $a_rec LIMIT 1);
    RETURN IF array::len($res) > 0 { $res[0] } ELSE { NONE };
};

-- 56. СОХРАНЕНИЕ / ОБНОВЛЕНИЕ СЮЖЕТНОЙ АРКИ
DEFINE FUNCTION OVERWRITE fn::save_story_arc(
    $id: any,
    $proj: any,
    $title: string,
    $status: string
) {
    LET $p_rec = fn::normalize_project_id($proj);
    LET $res = IF $id != NONE AND $id != NULL AND type::string($id) != '' {
        LET $a_rec = IF string::starts_with(type::string($id), 'story_arcs:') { type::record($id) } ELSE { type::record('story_arcs', $id) };
        (UPSERT $a_rec SET
            title = $title,
            status = $status,
            project_id = $p_rec,
            updated_at = time::now()
        )
    } ELSE {
        (CREATE story_arcs SET
            title = $title,
            status = $status,
            project_id = $p_rec,
            created_at = time::now(),
            updated_at = time::now()
        )
    };
    RETURN IF array::len($res) > 0 { $res[0] } ELSE { NONE };
};

-- 57. УДАЛЕНИЕ СЮЖЕТНОЙ АРКИ
DEFINE FUNCTION OVERWRITE fn::delete_story_arc($id: any) {
    LET $a_rec = IF string::starts_with(type::string($id), 'story_arcs:') { type::record($id) } ELSE { type::record('story_arcs', $id) };
    DELETE $a_rec;
};

-- 58. СПИСОК СЮЖЕТНЫХ АРОК ПРОЕКТА
DEFINE FUNCTION OVERWRITE fn::list_story_arcs_by_project($proj: any) {
    LET $p_rec = fn::normalize_project_id($proj);
    RETURN (SELECT id, project_id, title, status, created_at, updated_at FROM story_arcs WHERE project_id = $p_rec ORDER BY created_at ASC LIMIT 100);
};

-- 59. СПИСОК ГЛАВ ДЛЯ СЮЖЕТНОЙ АРКИ
DEFINE FUNCTION OVERWRITE fn::list_chapters_for_arc($arc_id: any) {
    LET $arc_rec = IF string::starts_with(type::string($arc_id), 'story_arcs:') { type::record($arc_id) } ELSE { type::record('story_arcs', $arc_id) };
    RETURN (
        SELECT 
            out AS arc_id,
            IF string::starts_with(type::string(in), 'chapters:') THEN in
            ELSE IF in.chapter_id != NONE THEN in.chapter_id 
            ELSE array::first(in->promise_milestones.out.chapter_id) END AS chapter_id,
            IF in.sort_order != NONE THEN in.sort_order
            ELSE IF in.chapter_id.sort_order != NONE THEN in.chapter_id.sort_order
            ELSE IF array::first(in->promise_milestones.out.chapter_id.sort_order) != NONE THEN array::first(in->promise_milestones.out.chapter_id.sort_order)
            ELSE 0 END AS sort_order,
            phase
        FROM advances_arc 
        WHERE out = $arc_rec
        ORDER BY sort_order ASC
        LIMIT 200
    );
};

-- 60. СПИСОК СУЩНОСТЕЙ ДЛЯ СЮЖЕТНОЙ АРКИ
DEFINE FUNCTION OVERWRITE fn::list_entities_for_arc($arc_id: any) {
    LET $arc_rec = IF string::starts_with(type::string($arc_id), 'story_arcs:') { type::record($arc_id) } ELSE { type::record('story_arcs', $arc_id) };
    LET $promises = (SELECT VALUE in FROM advances_arc WHERE out = $arc_rec LIMIT 200);
    LET $entities = (SELECT VALUE <-participant_of.in.id FROM $promises LIMIT 500);
    LET $flat = array::distinct(array::flatten($entities));
    IF array::len($flat) == 0 {
        RETURN [];
    };
    RETURN (
        FOR $e IN $flat {
            {
                arc_id: type::string($arc_rec),
                entity_id: type::string($e)
            }
        }
    );
};

-- 61. ПРИВЯЗКА ГЛАВЫ К СЮЖЕТНОЙ АРКЕ (M:N)
DEFINE FUNCTION OVERWRITE fn::link_chapter_to_arc($chapter_id: any, $arc_id: any, $phase: string) {
    LET $c_rec = IF string::starts_with(type::string($chapter_id), 'chapters:') { type::record($chapter_id) } ELSE { type::record('chapters', $chapter_id) };
    LET $a_rec = IF string::starts_with(type::string($arc_id), 'story_arcs:') { type::record($arc_id) } ELSE { type::record('story_arcs', $arc_id) };
    LET $valid_phase = IF $phase != NONE AND $phase != NULL AND $phase != '' THEN $phase ELSE 'setup' END;
    DELETE advances_arc WHERE in = $c_rec AND out = $a_rec;
    RELATE $c_rec -> advances_arc -> $a_rec SET
        phase = $valid_phase,
        project_id = $a_rec.project_id;
};

-- 62. ОТВЯЗКА ГЛАВЫ ОТ СЮЖЕТНОЙ АРКИ
DEFINE FUNCTION OVERWRITE fn::unlink_chapter_from_arc($chapter_id: any, $arc_id: any) {
    LET $c_rec = IF string::starts_with(type::string($chapter_id), 'chapters:') { type::record($chapter_id) } ELSE { type::record('chapters', $chapter_id) };
    LET $a_rec = IF string::starts_with(type::string($arc_id), 'story_arcs:') { type::record($arc_id) } ELSE { type::record('story_arcs', $arc_id) };
    DELETE advances_arc WHERE in = $c_rec AND out = $a_rec;
};

-- 63. ПОЛУЧЕНИЕ ВСЕХ СЮЖЕТНЫХ АРОК ДЛЯ ГЛАВЫ
DEFINE FUNCTION OVERWRITE fn::list_arcs_for_chapter($chapter_id: any) {
    LET $c_rec = IF string::starts_with(type::string($chapter_id), 'chapters:') { type::record($chapter_id) } ELSE { type::record('chapters', $chapter_id) };
    RETURN (
        SELECT 
            out.id AS arc_id,
            out.title AS title,
            out.status AS status,
            phase
        FROM advances_arc 
        WHERE in = $c_rec
        LIMIT 100
    );
};
