-- 01_ANALYTICS.SURQL — АНАЛИТИЧЕСКИЕ И ГРАФОВЫЕ ФУНКЦИИ


-- 1. СБОР МАТРИЦЫ УЧАСТИЙ (CROSS-REFERENCE MATRIX & HEATMAP)
DEFINE FUNCTION OVERWRITE fn::get_cross_reference_matrix($proj: any) {
    LET $p_rec = fn::normalize_project_id($proj);

    LET $chapters = (
        SELECT 
            id, 
            title, 
            IF sort_order != NONE { sort_order } ELSE { 0 } AS sort_order, 
            IF word_count != NONE { word_count } ELSE { 0 } AS word_count 
        FROM chapters 
        WHERE volume_id.project_id = $p_rec
        ORDER BY sort_order ASC
        LIMIT 1000
    );

    LET $entities = (
        SELECT 
            id, 
            name, 
            schema_id.type_key AS entity_type,
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
            array::concat(
                (->appears_in.{
                    chapter_id: IF out.chapter_id != NONE {
                        IF out.chapter_id.id != NONE { out.chapter_id.id } ELSE { type::string(out.chapter_id) }
                    } ELSE IF out.id != NONE {
                        IF out.id.id != NONE { out.id.id } ELSE { type::string(out.id) }
                    } ELSE {
                        type::string(out)
                    },
                    source: IF source != NONE { source } ELSE { 'mention' },
                    role: role
                }),
                (->participant_of.{
                    chapter_id: IF out.chapter_id != NONE {
                        IF out.chapter_id.id != NONE { out.chapter_id.id } ELSE { type::string(out.chapter_id) }
                    } ELSE IF array::len(out->promise_milestones) > 0 {
                        LET $first_ch = array::first(out->promise_milestones.out.chapter_id);
                        IF $first_ch.id != NONE { $first_ch.id } ELSE { type::string($first_ch) }
                    } ELSE { NONE },
                    source: 'scene',
                    role: role
                })
            ) AS appearances
        FROM entities 
        WHERE schema_id.project_id = $p_rec
        ORDER BY name ASC
        LIMIT 2000
    );

    RETURN {
        chapters: $chapters,
        entities: $entities
    };
};

-- 2. СБОР ДАННЫХ ДЛЯ ХРОНОЛОГИЧЕСКОГО ОКНА (TIMELINE INSPECTOR)
DEFINE FUNCTION OVERWRITE fn::get_timeline_inspector_data($proj: record<projects>) {
    LET $p_rec = fn::normalize_project_id($proj);

    LET $events = (
        SELECT 
            id,
            title,
            description,
            'event' AS kind,
            location_id,
            m_abs,
            IF calendar_id != NONE { IF calendar_id.id != NONE { calendar_id.id } ELSE { type::string(calendar_id) } } ELSE { 'default' } AS calendar_id,
            ->revealed_in.{
                chapter_id: IF out.id != NONE { out.id } ELSE { type::string(out) },
                chapter_title: out.title,
                chapter_order: IF out.sort_order != NONE { out.sort_order } ELSE { 0 },
                chapter_sort_order: IF out.sort_order != NONE { out.sort_order } ELSE { 0 },
                pov_id: IF pov_id != NONE { IF pov_id.id != NONE { pov_id.id } ELSE { type::string(pov_id) } } ELSE { NONE },
                kind: IF kind != NONE { kind } ELSE { 'direct' },
                block_id: block_id,
                is_anachronism: false
            } AS reveals,
            <-participates_in<-entities.{
                id: IF id.id != NONE { id.id } ELSE { type::string(id) },
                name: name,
                entity_type: schema_id.type_key
            } AS participants
        FROM timeline_events
        WHERE project_id = $p_rec
        ORDER BY m_abs ASC
        LIMIT 2000
    );

    LET $scene_events = (
        SELECT 
            id,
            IF title != NONE AND string::len(title) > 0 { title }
               ELSE IF quote != NONE AND string::len(quote) > 0 { quote }
               ELSE IF kind == 'conflict' { 'Конфликт' }
               ELSE IF kind == 'gun' { 'Чеховское ружьё' }
               ELSE IF kind == 'foreshadowing' { 'Предзнаменование' }
               ELSE IF kind == 'mystery' { 'Загадка' }
               ELSE IF kind == 'question' { 'Вопрос' }
               ELSE { 'Сцена' } AS title,
            note AS description,
            IF kind != NONE { kind } ELSE { 'scene' } AS kind,
            location_id,
            IF timeline_event_id.m_abs != NONE {
                timeline_event_id.m_abs
            } ELSE IF array::first(->occurs_at.out.m_abs) != NONE {
                array::first(->occurs_at.out.m_abs)
            } ELSE IF chapter_id.sort_order != NONE {
                chapter_id.sort_order * 1440
            } ELSE {
                1440
            } AS m_abs,
            IF timeline_event_id.calendar_id != NONE {
                IF timeline_event_id.calendar_id.id != NONE { timeline_event_id.calendar_id.id } ELSE { type::string(timeline_event_id.calendar_id) }
            } ELSE IF array::first(->occurs_at.out.calendar_id) != NONE {
                LET $oc_cal = array::first(->occurs_at.out.calendar_id);
                IF $oc_cal.id != NONE { $oc_cal.id } ELSE { type::string($oc_cal) }
            } ELSE {
                'default'
            } AS calendar_id,
            [
                {
                    chapter_id: IF chapter_id != NONE {
                        IF chapter_id.id != NONE { chapter_id.id } ELSE { type::string(chapter_id) }
                    } ELSE IF array::first(->promise_milestones.out.chapter_id) != NONE {
                        LET $pm_ch = array::first(->promise_milestones.out.chapter_id);
                        IF $pm_ch.id != NONE { $pm_ch.id } ELSE { type::string($pm_ch) }
                    } ELSE { '' },
                    chapter_title: IF chapter_id.title != NONE {
                        chapter_id.title
                    } ELSE IF array::first(->promise_milestones.out.chapter_id.title) != NONE {
                        array::first(->promise_milestones.out.chapter_id.title)
                    } ELSE { 'Глава' },
                    chapter_order: IF chapter_id.sort_order != NONE {
                        chapter_id.sort_order
                    } ELSE IF array::first(->promise_milestones.out.chapter_id.sort_order) != NONE {
                        array::first(->promise_milestones.out.chapter_id.sort_order)
                    } ELSE { 0 },
                    chapter_sort_order: IF chapter_id.sort_order != NONE {
                        chapter_id.sort_order
                    } ELSE IF array::first(->promise_milestones.out.chapter_id.sort_order) != NONE {
                        array::first(->promise_milestones.out.chapter_id.sort_order)
                    } ELSE { 0 },
                    pov_id: NONE,
                    kind: 'direct',
                    block_id: IF block_id != NONE { block_id } ELSE IF array::first(->promise_milestones.out) != NONE { array::first(->promise_milestones.out).id } ELSE { NONE },
                    is_anachronism: false
                }
            ] AS reveals,
            <-participant_of<-entities.{
                id: IF id.id != NONE { id.id } ELSE { type::string(id) },
                name: name,
                entity_type: schema_id.type_key
            } AS participants
        FROM plot_promises
        WHERE project_id = $p_rec
        LIMIT 2000
    );

    LET $all_events = array::concat($events, $scene_events);

    LET $chapters = (
        SELECT id, title, IF sort_order != NONE { sort_order } ELSE { 0 } AS sort_order 
        FROM chapters 
        WHERE volume_id.project_id = $p_rec
        ORDER BY sort_order ASC
        LIMIT 1000
    );

    RETURN {
        events: $all_events,
        chapters: $chapters
    };
};

-- 3. СБОР ПОЛНОГО ПУТИ ПЕРСОНАЖА (CHARACTER JOURNEY & ARC NAVIGATOR)
DEFINE FUNCTION OVERWRITE fn::get_character_journey($proj: record<projects>, $entity: record<entities>) {
    LET $info = (SELECT id, name, schema_id.type_key AS entity_type, attributes FROM ONLY $entity LIMIT 1);
    LET $ent_clean = type::string($entity).replace('entities:', '');
    LET $ent_prefixed = 'entities:' + $ent_clean;
    LET $appears_in_list = (
        SELECT 
            IF string::starts_with(type::string(out), 'text_blocks') { type::string(out.chapter_id) } ELSE { type::string(out.id) } AS chapter_id,
            IF string::starts_with(type::string(out), 'text_blocks') { out.chapter_id.title } ELSE { out.title } AS chapter_title,
            IF string::starts_with(type::string(out), 'text_blocks') { IF out.chapter_id.sort_order != NONE { out.chapter_id.sort_order } ELSE { 0 } }
               ELSE IF out.sort_order != NONE { out.sort_order } ELSE { 0 } AS chapter_order,
            source,
            role,
            created_at
        FROM appears_in 
        WHERE in = $entity
        LIMIT 1000
    );
    LET $participant_list = (
        SELECT 
            IF out.chapter_id != NONE { type::string(out.chapter_id) }
               ELSE IF array::first(out->promise_milestones.out.chapter_id) != NONE { type::string(array::first(out->promise_milestones.out.chapter_id)) }
               ELSE { '' } AS chapter_id,
            IF out.chapter_id.title != NONE { out.chapter_id.title }
               ELSE IF array::first(out->promise_milestones.out.chapter_id.title) != NONE { array::first(out->promise_milestones.out.chapter_id.title) }
               ELSE { 'Сцена' } AS chapter_title,
            IF out.chapter_id.sort_order != NONE { out.chapter_id.sort_order }
               ELSE IF array::first(out->promise_milestones.out.chapter_id.sort_order) != NONE { array::first(out->promise_milestones.out.chapter_id.sort_order) }
               ELSE { 0 } AS chapter_order,
            'scene' AS source,
            role,
            IF created_at != NONE { type::string(created_at) } ELSE { '' } AS created_at
        FROM participant_of 
        WHERE in = $entity
        LIMIT 1000
    );
    LET $appearances = array::concat($appears_in_list, $participant_list);
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
        LIMIT 1000
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
        LIMIT 1000
    );
    LET $scene_blocks = (
        SELECT VALUE out FROM appears_in 
        WHERE in = $entity AND string::starts_with(type::string(out), 'text_blocks')
        LIMIT 1000
    );
    LET $promises = (
        SELECT 
            id, 
            kind, 
            IF title != NONE { title } ELSE { '' } AS quote, 
            status,
            IF paragraph_index != NONE { paragraph_index }
               ELSE IF array::first(->promise_milestones.order_index) != NONE { array::first(->promise_milestones.order_index) }
               ELSE { 1 } AS paragraph_index,
            IF block_id != NONE { block_id }
               ELSE IF array::first(->promise_milestones.out) != NONE { array::first(->promise_milestones.out).id }
               ELSE { NONE } AS block_id,
            IF chapter_id != NONE { type::string(chapter_id) } 
               ELSE IF array::first(->promise_milestones.out.chapter_id) != NONE { type::string(array::first(->promise_milestones.out.chapter_id)) }
               ELSE { NONE } AS chapter_id,
            IF chapter_id.title != NONE { chapter_id.title }
               ELSE IF array::first(->promise_milestones.out.chapter_id.title) != NONE { array::first(->promise_milestones.out.chapter_id.title) }
               ELSE { 'Сцена' } AS chapter_title,
            IF chapter_id.sort_order != NONE { chapter_id.sort_order }
               ELSE IF array::first(->promise_milestones.out.chapter_id.sort_order) != NONE { array::first(->promise_milestones.out.chapter_id.sort_order) }
               ELSE { 0 } AS planted_order,
            IF resolved_in_chapter.sort_order != NONE { resolved_in_chapter.sort_order } ELSE { NONE } AS resolved_order,
            ->advances_arc.{
                arc_id: type::string(out.id),
                arc_title: out.title,
                arc_color: out.color,
                arc_phase: phase
            } AS arcs,
            IF array::len(->advances_arc) > 0 { type::string(array::first(->advances_arc.out.id)) }
               ELSE IF arc_id != NONE { type::string(arc_id) }
               ELSE { NONE } AS arc_id,
            IF array::len(->advances_arc) > 0 { array::first(->advances_arc.out.title) }
               ELSE IF arc_id.title != NONE { arc_id.title }
               ELSE { NONE } AS arc_title,
            IF array::len(->advances_arc) > 0 { array::first(->advances_arc.out.color) }
               ELSE IF arc_id.color != NONE { arc_id.color }
               ELSE { NONE } AS arc_color,
            IF array::len(->advances_arc) > 0 { array::first(->advances_arc.phase) }
               ELSE IF arc_phase != NONE { arc_phase }
               ELSE { NONE } AS arc_phase,
            IF m_abs != NONE { m_abs } 
            ELSE IF timeline_event_id.m_abs != NONE { timeline_event_id.m_abs } 
            ELSE IF array::first(->promise_milestones.out.timeline_event_id.m_abs) != NONE { array::first(->promise_milestones.out.timeline_event_id.m_abs) }
            ELSE { NONE } AS m_abs,
            IF calendar_id != NONE { calendar_id } 
            ELSE IF timeline_event_id.calendar_id != NONE { timeline_event_id.calendar_id } 
            ELSE IF array::first(->promise_milestones.out.timeline_event_id.calendar_id) != NONE { array::first(->promise_milestones.out.timeline_event_id.calendar_id) }
            ELSE { NONE } AS calendar_id,
            date_fields,
            IF timeline_event_id != NONE { timeline_event_id }
            ELSE IF array::first(->promise_milestones.out.timeline_event_id) != NONE { array::first(->promise_milestones.out.timeline_event_id) }
            ELSE { NONE } AS timeline_event_id
        FROM plot_promises 
        WHERE (array::len($scene_blocks) > 0 AND array::len(array::intersect(->promise_milestones.out, $scene_blocks)) > 0)
           OR $entity IN <-participant_of.in
           OR $entity IN participant_ids
           OR $ent_clean IN participant_ids
           OR $ent_prefixed IN participant_ids
           OR type::string($entity) IN participant_ids 
           OR $entity.id IN participant_ids
           OR ($info.name != NONE AND $info.name IN participant_ids)
        LIMIT 1000
    );

    RETURN {
        entity: $info,
        appearances: $appearances,
        events: $events,
        relations: $relations,
        promises: $promises
    };
};

-- 5. СИНХРОНИЗАЦИЯ УПОМИНАНИЙ СУЩНОСТЕЙ В ГЛАВЕ
DEFINE FUNCTION OVERWRITE fn::sync_chapter_mentions($chap: record<chapters>, $names: array<string>) {
    LET $p_rec = fn::normalize_project_id($chap.volume_id.project_id);
    DELETE appears_in WHERE out = $chap AND source = 'mention';

    IF array::len($names) > 0 {
        LET $lower_names = (SELECT VALUE string::lowercase($this) FROM $names LIMIT 500);
        LET $targets = (
            SELECT VALUE id FROM entities 
            WHERE schema_id.project_id = $p_rec
              AND (
                  type::string(id) IN $names
                  OR id.id IN $names
                  OR id IN $names
                  OR name IN $names 
                  OR string::lowercase(name) IN $lower_names 
                  OR (attributes.aliases != NONE AND array::len(array::intersect(attributes.aliases, $names)) > 0)
              )
            LIMIT 1000
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
