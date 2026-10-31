-- 07_NARRATIVE_AND_JOURNEY.SURQL — СЮЖЕТНЫЕ ОБЕЩАНИЯ И ИНВЕНТАРЬ


-- 40. СОХРАНЕНИЕ / ОБНОВЛЕНИЕ СЮЖЕТНОГО ОБЕЩАНИЯ (PLOT PROMISE / NARRATIVE HUB)
DEFINE FUNCTION OVERWRITE fn::upsert_plot_promise(
    $id: string,
    $proj: record<projects>,
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

    LET $promise = (
        UPSERT $rec_id MERGE {
            project_id: $p_rec,
            chapter_id: $target_chap,
            paragraph_index: $target_para,
            block_id: $target_block,
            kind: IF $data.kind != NONE { $data.kind } ELSE { 'gun' },
            title: IF $data.title != NONE { $data.title } ELSE { '' },
            note: IF $data.note != NONE { $data.note } ELSE { NONE },
            status: IF $data.status != NONE { $data.status } ELSE { 'planted' },
            location_id: IF $data.location_id != NONE { $data.location_id } ELSE { NONE },
            timeline_event_id: IF $data.timeline_event_id != NONE { 
                IF $data.timeline_event_id != NULL { type::record('timeline_events', type::string($data.timeline_event_id).replace('timeline_events:', '')) } ELSE { NONE }
            } ELSE { NONE },
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
                LET $ent_rec = type::record('entities', $clean_id);
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
    IF $data.timeline_event_id != NONE AND $data.timeline_event_id != NULL {
        LET $evt_rec = type::record('timeline_events', type::string($data.timeline_event_id).replace('timeline_events:', ''));
        RELATE $rec_id->occurs_at->$evt_rec SET
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
            m_abs,
            calendar_id,
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
            type::string(array::first(->promise_milestones.out.chapter_id)) AS chapter_id, 
            m_abs, 
            <-participant_of.in.id AS participant_ids, 
            title, 
            IF note != NONE { note } ELSE { '' } AS description
        FROM plot_promises
        WHERE project_id = $p_rec
        LIMIT 5000
    );

    LET $events = (
        SELECT 
            type::string(id) AS id, 
            type::string(array::first(->revealed_in.out)) AS chapter_id, 
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
            type::string(array::first(->promise_milestones.out.chapter_id)) AS chapter_id, 
            IF m_abs != NONE { m_abs } ELSE { array::first(->promise_milestones.out.timeline_event_id.m_abs) } AS m_abs, 
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
            type::string(array::first(->revealed_in.out)) AS chapter_id, 
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
    );
};

-- 48. СПИСОК НЕРАЗРЕШЕННЫХ ОБЕЩАНИЙ ТОМА
DEFINE FUNCTION OVERWRITE fn::list_unresolved_promises_by_volume($vol: any) {
    LET $vol_rec = IF string::starts_with(type::string($vol), 'volumes:') { type::record($vol) } ELSE { type::record('volumes', $vol) };
    LET $chapters = (SELECT VALUE out FROM contains WHERE in = $vol_rec);
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
    );
};

-- 49. УДАЛЕНИЕ СЮЖЕТНОГО ОБЕЩАНИЯ
DEFINE FUNCTION OVERWRITE fn::delete_plot_promise($id: any) {
    LET $rec = IF string::starts_with(type::string($id), 'plot_promises:') { type::record($id) } ELSE { type::record('plot_promises', $id) };
    DELETE $rec;
};

-- 50. СОХРАНЕНИЕ / ОБНОВЛЕНИЕ ЗАДАЧИ ПЛАНИРОВЩИКА (TODO)
DEFINE FUNCTION OVERWRITE fn::save_todo(
    $id: any,
    $owner_table: string,
    $owner_id: string,
    $text: string,
    $is_done: bool,
    $sort_order: int
) {
    LET $t_rec = IF string::starts_with(type::string($id), 'todos:') { type::record($id) } ELSE { type::record('todos', $id) };
    LET $o_rec = type::record($owner_table, $owner_id);
    LET $res = (
        UPSERT $t_rec SET
            owner_id = $o_rec,
            text = $text,
            is_done = $is_done,
            sort_order = $sort_order,
            updated_at = time::now()
    );
    RETURN IF array::len($res) > 0 { $res[0] } ELSE { NONE };
};

-- 51. ПОЛУЧЕНИЕ ЗАДАЧИ ПО ID
DEFINE FUNCTION OVERWRITE fn::get_todo($id: any) {
    LET $t_rec = IF string::starts_with(type::string($id), 'todos:') { type::record($id) } ELSE { type::record('todos', $id) };
    LET $res = (SELECT * FROM $t_rec LIMIT 1);
    RETURN IF array::len($res) > 0 { $res[0] } ELSE { NONE };
};

-- 52. УДАЛЕНИЕ ЗАДАЧИ
DEFINE FUNCTION OVERWRITE fn::delete_todo($id: any) {
    LET $t_rec = IF string::starts_with(type::string($id), 'todos:') { type::record($id) } ELSE { type::record('todos', $id) };
    DELETE $t_rec;
};

-- 53. СПИСОК ЗАДАЧ ПО ВЛАДЕЛЬЦУ
DEFINE FUNCTION OVERWRITE fn::list_todos_by_owner($owner_table: string, $owner_id: string) {
    LET $o_rec = type::record($owner_table, $owner_id);
    RETURN (SELECT * FROM todos WHERE owner_id = $o_rec ORDER BY sort_order ASC, created_at ASC);
};

-- 54. СПИСОК ЗАДАЧ ПО СПИСКУ ВЛАДЕЛЬЦЕВ
DEFINE FUNCTION OVERWRITE fn::list_todos_by_owners($owners: array<any>) {
    RETURN (SELECT * FROM todos WHERE owner_id IN $owners ORDER BY sort_order ASC, created_at ASC);
};

-- 55. ПОЛУЧЕНИЕ СЮЖЕТНОЙ АРКИ ПО ID
DEFINE FUNCTION OVERWRITE fn::get_story_arc($id: any) {
    LET $a_rec = IF string::starts_with(type::string($id), 'story_arcs:') { type::record($id) } ELSE { type::record('story_arcs', $id) };
    LET $res = (SELECT * FROM $a_rec LIMIT 1);
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
    RETURN (SELECT id, project_id, title, status, created_at, updated_at FROM story_arcs WHERE project_id = $p_rec ORDER BY created_at ASC);
};

-- 59. СПИСОК ГЛАВ ДЛЯ СЮЖЕТНОЙ АРКИ
DEFINE FUNCTION OVERWRITE fn::list_chapters_for_arc($arc_id: any) {
    LET $arc_rec = IF string::starts_with(type::string($arc_id), 'story_arcs:') { type::record($arc_id) } ELSE { type::record('story_arcs', $arc_id) };
    RETURN (
        SELECT 
            out AS arc_id,
            IF in.chapter_id != NONE { in.chapter_id } ELSE { array::first(in->promise_milestones.out.chapter_id) } AS chapter_id,
            IF in.chapter_id.sort_order != NONE { in.chapter_id.sort_order } ELSE IF array::first(in->promise_milestones.out.chapter_id.sort_order) != NONE { array::first(in->promise_milestones.out.chapter_id.sort_order) } ELSE { 0 } AS sort_order,
            phase
        FROM advances_arc 
        WHERE out = $arc_rec
        ORDER BY sort_order ASC
    );
};

-- 60. СПИСОК СУЩНОСТЕЙ ДЛЯ СЮЖЕТНОЙ АРКИ
DEFINE FUNCTION OVERWRITE fn::list_entities_for_arc($arc_id: any) {
    LET $arc_rec = IF string::starts_with(type::string($arc_id), 'story_arcs:') { type::record($arc_id) } ELSE { type::record('story_arcs', $arc_id) };
    LET $promises = (SELECT VALUE in FROM advances_arc WHERE out = $arc_rec);
    LET $entities = (SELECT VALUE <-participant_of.in.id FROM $promises);
    LET $flat = array::distinct(array::flatten($entities));
    RETURN (
        FOR $e IN $flat {
            {
                arc_id: type::string($arc_rec),
                entity_id: type::string($e)
            }
        }
    );
};
