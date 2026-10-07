-- 01_ANALYTICS.SURQL — АНАЛИТИЧЕСКИЕ И ГРАФОВЫЕ ФУНКЦИИ


-- 1. СБОР МАТРИЦЫ УЧАСТИЙ (CROSS-REFERENCE MATRIX & HEATMAP)
DEFINE FUNCTION OVERWRITE fn::get_cross_reference_matrix($proj: record<projects>) {
    LET $p_rec = type::record('projects', type::string($proj).replace('projects:', ''));

    LET $chapters = (
        SELECT 
            id, 
            title, 
            IF sort_order != NONE { sort_order } ELSE { 0 } AS sort_order, 
            IF word_count != NONE { word_count } ELSE { 0 } AS word_count 
        FROM chapters 
        WHERE project_id = $p_rec
        ORDER BY sort_order ASC
    );

    LET $entities = (
        SELECT 
            id, 
            name, 
            entity_type,
            (attributes['статус_категория'] = 'Мёртв' OR attributes.is_deceased = true) AS is_deceased,
            IF attributes['дата_смерти']['m_abs'] != NONE {
                attributes['дата_смерти']['m_abs']
            } ELSE {
                attributes.death_m_abs
            } AS death_m_abs,
            IF attributes['дата_рождения']['m_abs'] != NONE {
                attributes['дата_рождения']['m_abs']
            } ELSE {
                attributes.birth_m_abs
            } AS birth_m_abs,
            attributes['роль_в_истории'] AS role_in_story,
            attributes['статус_категория'] AS status_category,
            (SELECT IF out.id != NONE { out.id } ELSE { type::string(out) } AS chapter_id, source, role FROM ->appears_in) AS appearances
        FROM entities 
        WHERE project_id = $p_rec
        ORDER BY name ASC
    );

    RETURN {
        chapters: $chapters,
        entities: $entities
    };
};

-- 2. СБОР ДАННЫХ ДЛЯ ХРОНОЛОГИЧЕСКОГО ОКНА (TIMELINE INSPECTOR)
DEFINE FUNCTION OVERWRITE fn::get_timeline_inspector_data($proj: record<projects>) {
    LET $p_rec = type::record('projects', type::string($proj).replace('projects:', ''));

    LET $events = (
        SELECT 
            id,
            title,
            description,
            m_abs,
            IF calendar_id != NONE { IF calendar_id.id != NONE { calendar_id.id } ELSE { type::string(calendar_id) } } ELSE { 'default' } AS calendar_id,
            (
                SELECT 
                    IF out.id != NONE { out.id } ELSE { type::string(out) } AS chapter_id,
                    out.title AS chapter_title,
                    IF out.sort_order != NONE { out.sort_order } ELSE { 0 } AS chapter_sort_order,
                    IF pov_id != NONE { IF pov_id.id != NONE { pov_id.id } ELSE { type::string(pov_id) } } ELSE { NONE } AS pov_id,
                    IF kind != NONE { kind } ELSE { 'direct' } AS kind,
                    block_id,
                    false AS is_anachronism
                FROM ->revealed_in
            ) AS reveals,
            (SELECT IF id.id != NONE { id.id } ELSE { type::string(id) } AS id, name, entity_type FROM <-participates_in<-entities) AS participants
        FROM timeline_events
        WHERE project_id = $p_rec
        ORDER BY m_abs ASC
    );

    LET $scene_events = (
        SELECT 
            id,
            IF quote != NONE AND string::len(quote) > 0 { quote } ELSE { 'Сцена' } AS title,
            note AS description,
            m_abs,
            IF calendar_id != NONE { IF calendar_id.id != NONE { calendar_id.id } ELSE { type::string(calendar_id) } } ELSE { 'default' } AS calendar_id,
            [
                {
                    chapter_id: IF chapter_id.id != NONE { chapter_id.id } ELSE { type::string(chapter_id) },
                    chapter_title: chapter_id.title,
                    chapter_sort_order: IF chapter_id.sort_order != NONE { chapter_id.sort_order } ELSE { 0 },
                    pov_id: NONE,
                    kind: IF kind != NONE { kind } ELSE { 'direct' },
                    block_id: block_id,
                    is_anachronism: false
                }
            ] AS reveals,
            IF participant_ids != NONE {
                (
                    SELECT 
                        IF id.id != NONE { id.id } ELSE { type::string(id) } AS id,
                        name,
                        entity_type 
                    FROM entities 
                    WHERE id IN $parent.participant_ids OR type::string(id) IN $parent.participant_ids
                )
            } ELSE {
                []
            } AS participants
        FROM plot_promises
        WHERE project_id = $p_rec
          AND m_abs != NONE
          AND (timeline_event_id = NONE OR timeline_event_id = NULL OR type::string(timeline_event_id) CONTAINS 'ev_scene_')
    );

    LET $all_events = array::concat($events, $scene_events);

    LET $chapters = (
        SELECT id, title, IF sort_order != NONE { sort_order } ELSE { 0 } AS sort_order 
        FROM chapters 
        WHERE project_id = $p_rec
        ORDER BY sort_order ASC
    );

    RETURN {
        events: $all_events,
        chapters: $chapters
    };
};

-- 3. ВЫБОРКА ВРЕМЕННОГО СРЕЗА ГРАФА СВЯЗЕЙ («ПАУТИНА»)
DEFINE FUNCTION OVERWRITE fn::get_graph_time_slice($proj: record<projects>) {
    LET $p_rec = type::record('projects', type::string($proj).replace('projects:', ''));

    LET $nodes = (
        SELECT id, name, entity_type, tags, attributes 
        FROM entities 
        WHERE project_id = $p_rec
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
            IF attributes.start_m_abs != NONE {
                attributes.start_m_abs
            } ELSE {
                (SELECT VALUE in.m_abs FROM revealed_in WHERE out = start_chapter LIMIT 1)[0]
            } AS inferred_start_m_abs
        FROM entity_rel 
        WHERE project_id = $p_rec
    );

    RETURN {
        nodes: $nodes,
        edges: $edges
    };
};

-- 4. СБОР ПОЛНОГО ПУТИ ПЕРСОНАЖА (CHARACTER JOURNEY & ARC NAVIGATOR)
DEFINE FUNCTION OVERWRITE fn::get_character_journey($proj: record<projects>, $entity: record<entities>) {
    LET $info = (SELECT id, name, entity_type, attributes FROM $entity);
    LET $appearances = (
        SELECT 
            out.id AS chapter_id,
            out.title AS chapter_title,
            IF out.sort_order != NONE { out.sort_order } ELSE { 0 } AS chapter_order,
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
            out.description AS event_desc,
            out.m_abs AS m_abs,
            out.calendar_id AS calendar_id,
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
            paragraph_index,
            block_id,
            chapter_id.id AS chapter_id,
            chapter_id.title AS chapter_title,
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
            timeline_event_id
        FROM plot_promises 
        WHERE participant_ids CONTAINS type::string($entity) 
           OR participant_ids CONTAINS $entity.id 
           OR $entity IN participant_ids
           OR ($info[0].name != NONE AND participant_ids CONTAINS $info[0].name)
    );

    RETURN {
        entity: $info[0],
        appearances: $appearances,
        events: $events,
        relations: $relations,
        promises: $promises
    };
};

-- 5. СИНХРОНИЗАЦИЯ УПОМИНАНИЙ СУЩНОСТЕЙ В ГЛАВЕ
DEFINE FUNCTION OVERWRITE fn::sync_chapter_mentions($chap: record<chapters>, $names: array<string>) {
    LET $p_rec = type::record('projects', type::string($chap.project_id).replace('projects:', ''));
    DELETE appears_in WHERE out = $chap AND source = 'mention';

    IF array::len($names) > 0 {
        LET $lower_names = (SELECT VALUE string::lowercase($this) FROM $names);
        LET $targets = (
            SELECT VALUE id FROM entities 
            WHERE project_id = $p_rec
              AND (
                  type::string(id) IN $names
                  OR id.id IN $names
                  OR id IN $names
                  OR name IN $names 
                  OR string::lowercase(name) IN $lower_names 
                  OR (attributes.aliases != NONE AND array::len(array::intersect(attributes.aliases, $names)) > 0)
              )
        );
        FOR $ent_id IN $targets {
            RELATE $ent_id->appears_in->$chap CONTENT {
                source: 'mention',
                project_id: $p_rec,
                created_at: time::now()
            };
        };
        RETURN {
            proj: $p_rec,
            target_entities: $targets
        };
    } ELSE {
        RETURN {
            proj: $p_rec,
            target_entities: []
        };
    };
};
