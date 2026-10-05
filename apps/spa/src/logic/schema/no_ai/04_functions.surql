-- ==============================================================================
-- 04_FUNCTIONS.SURQL — ХРАНИМЫЕ АНАЛИТИЧЕСКИЕ И ГРАФОВЫЕ ФУНКЦИИ БАЗОВОГО ЯДРА
-- ==============================================================================
-- Стандарт: SDB-002 (OVERWRITE), SDB-003 (Параметризация), SDB-007 (Атомарность)
-- ==============================================================================

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

-- 6. СБОР ПОЛНОЙ ИЕРАРХИИ ГЛАВ И ТОМОВ ПРОЕКТА
DEFINE FUNCTION OVERWRITE fn::get_chapter_hierarchy($proj: record<projects>) {
    LET $p_rec = type::record('projects', type::string($proj).replace('projects:', ''));
    LET $volumes = (SELECT * FROM volumes WHERE project_id = $p_rec);
    LET $chapters = (SELECT * FROM chapters WHERE project_id = $p_rec);
    LET $vol_ids = (SELECT VALUE id FROM $volumes);
    LET $chap_ids = (SELECT VALUE id FROM $chapters);
    LET $relations = (
        SELECT in, out, sort_order FROM contains 
        WHERE out IN $vol_ids OR out IN $chap_ids
    );
    RETURN {
        volumes: $volumes,
        chapters: $chapters,
        relations: $relations
    };
};

-- 7. СОЗДАНИЕ УЗЛА ТОМА И ПРИВЯЗКА К ПРОЕКТУ
DEFINE FUNCTION OVERWRITE fn::create_volume_node($proj: record<projects>, $title: string, $order: int) {
    LET $p_rec = type::record('projects', type::string($proj).replace('projects:', ''));
    LET $vol = (CREATE volumes SET project_id = $p_rec, title = $title RETURN VALUE id)[0];
    RELATE $p_rec -> contains -> $vol SET sort_order = $order;
    LET $res = (SELECT id, title, project_id, $order AS sort_order FROM $vol);
    RETURN $res[0];
};

-- 8. ПЕРЕМЕЩЕНИЕ/ПРИВЯЗКА ГЛАВЫ К ТОМУ ИЛИ ПРОЕКТУ
DEFINE FUNCTION OVERWRITE fn::assign_chapter_node($parent: record<projects> | record<volumes>, $chap: record<chapters>) {
    DELETE contains WHERE out = $chap;
    RELATE $parent -> contains -> $chap SET sort_order = 9999;
};

-- 9. СОЗДАНИЕ ГРАФОВОЙ СВЯЗИ МЕЖДУ СУЩНОСТЯМИ
DEFINE FUNCTION OVERWRITE fn::create_entity_relation(
    $proj: record<projects>,
    $from: record<entities>,
    $to: record<entities>,
    $rel_type: string,
    $desc: option<string | null>,
    $strength: option<int | null>,
    $attrs: option<object>,
    $start_chap: option<record<chapters> | null>,
    $end_chap: option<record<chapters> | null>
) {
    LET $p_rec = type::record('projects', type::string($proj).replace('projects:', ''));
    LET $res = (
        RELATE $from -> entity_rel -> $to CONTENT {
            project_id: $p_rec,
            rel_type: $rel_type,
            description: $desc,
            strength: $strength,
            attributes: IF $attrs != NONE { $attrs } ELSE { {} },
            start_chapter: $start_chap,
            end_chapter: $end_chap,
            created_at: time::now()
        } RETURN AFTER
    );
    RETURN $res[0];
};

-- 10. ПОЛУЧЕНИЕ СВЯЗЕЙ СУЩНОСТЕЙ ДЛЯ ГРАФА
DEFINE FUNCTION OVERWRITE fn::get_entity_connections($proj: record<projects>, $chap: option<record<chapters>>) {
    LET $p_rec = type::record('projects', type::string($proj).replace('projects:', ''));
    IF $chap != NONE {
        RETURN (
            SELECT *, type::string(in) AS source, type::string(out) AS target, type::string(id) AS id 
            FROM entity_rel 
            WHERE project_id = $p_rec 
              AND (start_chapter = $chap OR end_chapter = $chap)
        );
    } ELSE {
        RETURN (
            SELECT *, type::string(in) AS source, type::string(out) AS target, type::string(id) AS id 
            FROM entity_rel 
            WHERE project_id = $p_rec
        );
    };
};

-- 11. ПАКЕТНОЕ СОХРАНЕНИЕ СВЯЗЕЙ СУЩНОСТИ
DEFINE FUNCTION OVERWRITE fn::save_entity_connections(
    $proj: record<projects>,
    $src: record<entities>,
    $connections: array<object>
) {
    LET $p_rec = type::record('projects', type::string($proj).replace('projects:', ''));
    DELETE entity_rel WHERE (in = $src OR out = $src) AND project_id = $p_rec;

    FOR $c IN $connections {
        IF $c.target != NONE AND $c.target.entityId != NONE {
            LET $tgt = type::record('entities', $c.target.entityId);
            LET $role = IF $c.role != NONE { $c.role } ELSE { 'associated' };
            LET $desc = IF $c.description != NONE { $c.description } ELSE { '' };
            LET $start_chap = IF $c.period != NONE AND $c.period.start_chapter != NONE { type::record('chapters', $c.period.start_chapter) } ELSE { NONE };
            LET $end_chap = IF $c.period != NONE AND $c.period.end_chapter != NONE { type::record('chapters', $c.period.end_chapter) } ELSE { NONE };

            RELATE $src -> entity_rel -> $tgt CONTENT {
                project_id: $p_rec,
                rel_type: $role,
                description: $desc,
                start_chapter: $start_chap,
                end_chapter: $end_chap,
                created_at: time::now()
            };
        };
    };
};

-- 12. УДАЛЕНИЕ ВСЕХ СВЯЗЕЙ СУЩНОСТИ
DEFINE FUNCTION OVERWRITE fn::remove_entity_connections($src: record<entities>) {
    DELETE entity_rel WHERE in = $src OR out = $src;
};

-- 13. СПИСОК ВСЕХ ПРОЕКТОВ
DEFINE FUNCTION OVERWRITE fn::get_projects_list() {
    RETURN (SELECT *, type::string(id) AS id FROM projects ORDER BY created_at DESC);
};

-- 14. ПОЛУЧЕНИЕ КОНФИГУРАЦИИ ПРОЕКТА
DEFINE FUNCTION OVERWRITE fn::get_project_config($name: string) {
    IF string::len($name) == 0 {
        RETURN {};
    };
    LET $clean = string::replace($name, 'projects:', '');
    LET $res = (
        SELECT *, type::string(id) AS id FROM projects 
        WHERE id = type::record('projects', $clean) OR name = $name OR name = $clean
        LIMIT 1
    );
    RETURN IF array::len($res) > 0 { $res[0] } ELSE { {} };
};

-- 15. ВЫБОРКА АТРИБУТОВ СУЩНОСТЕЙ ПРОЕКТА
DEFINE FUNCTION OVERWRITE fn::get_entities_attributes($proj: record<projects>) {
    LET $p_rec = type::record('projects', type::string($proj).replace('projects:', ''));
    RETURN (
        SELECT id, attributes FROM entities 
        WHERE project_id = $p_rec
    );
};

-- 16. ОБНОВЛЕНИЕ АТРИБУТОВ СУЩНОСТИ
DEFINE FUNCTION OVERWRITE fn::update_entity_attributes($entity: record<entities>, $attrs: object) {
    UPDATE $entity SET attributes = $attrs;
};

-- 17. МАКСИМАЛЬНЫЙ ПОРЯДОК СОРТИРОВКИ ТОМОВ
DEFINE FUNCTION OVERWRITE fn::get_max_volume_sort_order($proj: record<projects>) {
    LET $p_rec = type::record('projects', type::string($proj).replace('projects:', ''));
    LET $res = (SELECT math::max(sort_order) AS max_order FROM contains WHERE in = $p_rec GROUP ALL);
    RETURN IF array::len($res) > 0 AND $res[0].max_order != NONE { $res[0].max_order } ELSE { -1 };
};

-- 18. ОБНОВЛЕНИЕ ЗАГОЛОВКА ТОМА
DEFINE FUNCTION OVERWRITE fn::update_volume_title($vol: record<volumes>, $title: string) {
    UPDATE $vol SET title = $title;
};

-- 19. ПОЛУЧЕНИЕ СПИСКА СВЯЗЕЙ СУЩНОСТЕЙ
DEFINE FUNCTION OVERWRITE fn::get_entity_relations($proj: record<projects>, $eid: option<record<entities>>) {
    LET $p_rec = type::record('projects', type::string($proj).replace('projects:', ''));
    IF $eid != NONE {
        RETURN (
            SELECT *, type::string(in) AS in, type::string(out) AS out, type::string(id) AS id 
            FROM entity_rel 
            WHERE project_id = $p_rec AND (in = $eid OR out = $eid)
        );
    } ELSE {
        RETURN (
            SELECT *, type::string(in) AS in, type::string(out) AS out, type::string(id) AS id 
            FROM entity_rel 
            WHERE project_id = $p_rec
        );
    };
};

-- 20. ПЕРЕМЕЩЕНИЕ/ИЗМЕНЕНИЕ ПОРЯДКА УЗЛА
DEFINE FUNCTION OVERWRITE fn::reorder_node($node: record<chapters> | record<volumes>, $order: int) {
    UPDATE contains SET sort_order = $order WHERE out = $node;
};

-- 21. ПОЛУЧЕНИЕ РЕВИЗИЙ ГЛАВЫ
DEFINE FUNCTION OVERWRITE fn::get_chapter_revisions($target: record<chapters>) {
    RETURN (SELECT * FROM chapter_revisions WHERE target_id = $target ORDER BY created_at DESC);
};

-- 22. ЗАКРЕПЛЕНИЕ/ОТКРЕПЛЕНИЕ РЕВИЗИИ ИЛИ ИСТОРИИ
DEFINE FUNCTION OVERWRITE fn::toggle_pin($target: record, $is_pinned: bool) {
    UPDATE $target SET is_pinned = $is_pinned;
};

-- 23. ПОЛУЧЕНИЕ ИСТОРИИ СХЕМЫ СУЩНОСТЕЙ
DEFINE FUNCTION OVERWRITE fn::get_schema_history($proj: record<projects>, $tk: string) {
    LET $p_rec = type::record('projects', type::string($proj).replace('projects:', ''));
    RETURN (SELECT * FROM schema_history WHERE project_id = $p_rec AND type_key = $tk ORDER BY saved_at DESC);
};

-- 24. ПОЛУЧЕНИЕ РЕВИЗИЙ СУЩНОСТИ
DEFINE FUNCTION OVERWRITE fn::get_entity_revisions($target: record<entities>) {
    RETURN (SELECT * FROM entity_revisions WHERE target_id = $target ORDER BY created_at DESC);
};

-- 25. СОХРАНЕНИЕ СЕМАНТИЧЕСКИХ ТЕКСТОВЫХ БЛОКОВ ГЛАВЫ
DEFINE FUNCTION OVERWRITE fn::save_text_blocks(
    $proj: record<projects>,
    $chap: record<chapters>,
    $blocks: array<object>
) {
    LET $p_rec = type::record('projects', type::string($proj).replace('projects:', ''));
    DELETE text_blocks WHERE chapter_id = $chap AND project_id = $p_rec;

    FOR $b IN $blocks {
        CREATE text_blocks SET 
            project_id = $p_rec,
            chapter_id = $chap,
            block_type = $b.block_type,
            order_index = $b.order_index,
            content = $b.content;
    };
};

-- 26. ПАКЕТНОЕ СОХРАНЕНИЕ ГЛОБАЛЬНОГО ТАЙМЛАЙНА ГЛАВ
DEFINE FUNCTION OVERWRITE fn::save_global_timeline(
    $proj: record<projects>,
    $items: array<object>
) {
    LET $p_rec = type::record('projects', type::string($proj).replace('projects:', ''));
    FOR $item IN $items {
        IF $item.chapter_id != NONE {
            LET $cid = type::record('chapters', $item.chapter_id);
            UPDATE $cid SET 
                project_id = $p_rec,
                title = IF $item.title != NONE { $item.title } ELSE { title },
                timeline_events = IF $item.events != NONE { $item.events } ELSE { [] },
                participants = IF $item.participants != NONE { $item.participants } ELSE { [] };
        };
    };
};

-- 27. ПОЛУЧЕНИЕ СХЕМ СВЯЗЕЙ ПРОЕКТА
DEFINE FUNCTION OVERWRITE fn::get_relation_schemas($proj: record<projects>) {
    LET $p_rec = type::record('projects', type::string($proj).replace('projects:', ''));
    RETURN (SELECT * FROM relation_schemas WHERE project_id = $p_rec);
};

-- 28. УДАЛЕНИЕ СХЕМЫ СВЯЗИ И СВЯЗАННЫХ РЕБЕР
DEFINE FUNCTION OVERWRITE fn::delete_relation_schema($proj: record<projects>, $rel_key: string) {
    LET $p_rec = type::record('projects', type::string($proj).replace('projects:', ''));
    DELETE entity_rel WHERE project_id = $p_rec AND rel_type = $rel_key;
    DELETE relation_schemas WHERE project_id = $p_rec AND rel_key = $rel_key;
};

-- 29. ПОЛУЧЕНИЕ СХЕМ СУЩНОСТЕЙ ПРОЕКТА
DEFINE FUNCTION OVERWRITE fn::get_entity_schemas($proj: record<projects>) {
    LET $p_rec = type::record('projects', type::string($proj).replace('projects:', ''));
    RETURN (SELECT * FROM entity_schemas WHERE project_id = $p_rec);
};

-- 30. ПОИСК ID СХЕМЫ СУЩНОСТИ ПО TYPE_KEY
DEFINE FUNCTION OVERWRITE fn::find_entity_schema_id($proj: record<projects>, $tk: string) {
    LET $p_rec = type::record('projects', type::string($proj).replace('projects:', ''));
    LET $res = (SELECT id FROM entity_schemas WHERE project_id = $p_rec AND type_key = $tk LIMIT 1);
    RETURN IF array::len($res) > 0 { $res[0].id } ELSE { NONE };
};

-- 31. СОХРАНЕНИЕ СНИМКА ИСТОРИИ СХЕМЫ
DEFINE FUNCTION OVERWRITE fn::record_schema_history(
    $proj: record<projects>,
    $schema_id: record<entity_schemas>,
    $type_key: string,
    $snapshot: object,
    $max_limit: int
) {
    LET $p_rec = type::record('projects', type::string($proj).replace('projects:', ''));
    CREATE schema_history SET
        schema_id = $schema_id,
        type_key = $type_key,
        project_id = $p_rec,
        snapshot = $snapshot,
        saved_at = type::string(time::now()),
        is_pinned = false;

    LET $unpinned = (SELECT id, saved_at FROM schema_history WHERE schema_id = $schema_id AND is_pinned = false ORDER BY saved_at DESC);
    IF array::len($unpinned) > $max_limit {
        LET $to_delete = array::slice($unpinned, $max_limit, array::len($unpinned));
        DELETE $to_delete;
    };
};

-- 32. СОХРАНЕНИЕ СХЕМЫ СУЩНОСТИ (UPSERT)
DEFINE FUNCTION OVERWRITE fn::save_entity_schema(
    $id: record<entity_schemas>,
    $proj: record<projects>,
    $type_key: string,
    $type_name: string,
    $icon: option<string | null>,
    $color: option<string | null>,
    $fields_schema: array,
    $full_schema: option<object | null>
) {
    LET $p_rec = type::record('projects', type::string($proj).replace('projects:', ''));
    LET $res = (
        UPSERT $id SET 
            project_id = $p_rec,
            type_key = $type_key,
            type_name = $type_name,
            icon = $icon,
            color = $color,
            fields_schema = $fields_schema,
            full_schema = $full_schema
    );
    RETURN $res[0];
};

-- 33. КАСКАДНОЕ УДАЛЕНИЕ СХЕМЫ СУЩНОСТЕЙ
DEFINE FUNCTION OVERWRITE fn::delete_entity_schema($proj: record<projects>, $type_key: string) {
    LET $p_rec = type::record('projects', type::string($proj).replace('projects:', ''));
    LET $matching_rel_keys = (
        SELECT VALUE rel_key FROM relation_schemas 
        WHERE project_id = $p_rec 
          AND (from_types CONTAINS $type_key OR to_types CONTAINS $type_key)
    );
    DELETE entity_rel WHERE project_id = $p_rec AND rel_type IN $matching_rel_keys;
    DELETE entities WHERE project_id = $p_rec AND entity_type = $type_key;
    DELETE entity_schemas WHERE project_id = $p_rec AND type_key = $type_key;
};

-- 34. ПОЛУЧЕНИЕ СУЩНОСТЕЙ ПРОЕКТА С ФИЛЬТРАЦИЕЙ ПО ТИПУ
DEFINE FUNCTION OVERWRITE fn::get_entities($proj: record<projects>, $et: option<string>) {
    LET $p_rec = type::record('projects', type::string($proj).replace('projects:', ''));
    IF $et != NONE {
        RETURN (
            SELECT * FROM entities 
            WHERE project_id = $p_rec
              AND entity_type = $et
        );
    } ELSE {
        RETURN (
            SELECT * FROM entities 
            WHERE project_id = $p_rec
        );
    };
};

-- 35. СОХРАНЕНИЕ СУЩНОСТИ (UPSERT ИЛИ CREATE)
DEFINE FUNCTION OVERWRITE fn::save_entity(
    $id: option<record<entities> | null>,
    $proj: record<projects>,
    $entity_type: string,
    $name: string,
    $desc: option<string | null>,
    $attrs: option<object>,
    $tags: option<array<string>>,
    $embeds: option<object | array | null>
) {
    LET $p_rec = type::record('projects', type::string($proj).replace('projects:', ''));
    IF $id != NONE AND $id != NULL {
        LET $existing = (SELECT * FROM ONLY $id);
        LET $res = (
            UPSERT $id SET
                project_id = $p_rec,
                entity_type = $entity_type,
                name = $name,
                description = IF $desc != NONE AND $desc != NULL { $desc } ELSE IF $existing != NONE { $existing.description } ELSE { NONE },
                attributes = IF $attrs != NONE AND array::len(object::keys($attrs)) > 0 { $attrs } ELSE IF $existing != NONE { $existing.attributes } ELSE { {} },
                tags = IF $tags != NONE AND array::len($tags) > 0 { $tags } ELSE IF $existing != NONE { $existing.tags } ELSE { [] },
                embeddings = IF $embeds != NONE AND $embeds != NULL { $embeds } ELSE IF $existing != NONE { $existing.embeddings } ELSE { {} }
        );
        RETURN $res[0];
    } ELSE {
        LET $res = (
            CREATE entities SET
                project_id = $p_rec,
                entity_type = $entity_type,
                name = $name,
                description = $desc,
                attributes = IF $attrs != NONE { $attrs } ELSE { {} },
                tags = IF $tags != NONE { $tags } ELSE { [] },
                embeddings = IF $embeds != NONE AND $embeds != NULL { $embeds } ELSE { {} }
        );
        RETURN $res[0];
    };
};

-- 36. ПОЛНОТЕКСТОВЫЙ ПОИСК СУЩНОСТЕЙ ПО BM25 С РАНЖИРОВАНИЕМ
DEFINE FUNCTION OVERWRITE fn::search_entities($proj: record<projects>, $q: string, $et: option<string>) {
    LET $p_rec = type::record('projects', type::string($proj).replace('projects:', ''));
    IF $et != NONE {
        RETURN (
            SELECT * 
            FROM entities 
            WHERE project_id = $p_rec
              AND (name @1@ $q OR description @2@ $q)
              AND entity_type = $et
            LIMIT 50
        );
    } ELSE {
        RETURN (
            SELECT * 
            FROM entities 
            WHERE project_id = $p_rec
              AND (name @1@ $q OR description @2@ $q)
            LIMIT 50
        );
    };
};

-- 37. ПАКЕТНОЕ ПОЛУЧЕНИЕ СУЩНОСТЕЙ ПО ТИПАМ
DEFINE FUNCTION OVERWRITE fn::get_entities_batch($proj: record<projects>, $types: array<string>) {
    LET $p_rec = type::record('projects', type::string($proj).replace('projects:', ''));
    RETURN (
        SELECT * FROM entities 
        WHERE project_id = $p_rec
          AND entity_type IN $types
    );
};

-- 38. ПАКЕТНОЕ СОХРАНЕНИЕ СУЩНОСТИ И ЕЕ СВЯЗАННЫХ СУЩНОСТЕЙ
DEFINE FUNCTION OVERWRITE fn::batch_save_entity_with_relations(
    $proj: record<projects>,
    $main_id: record<entities>,
    $main_entity: object,
    $foreign_updates: array<object>
) {
    LET $p_rec = type::record('projects', type::string($proj).replace('projects:', ''));
    LET $saved = (
        UPSERT $main_id SET
            project_id = $p_rec,
            entity_type = $main_entity.entity_type,
            name = $main_entity.name,
            description = $main_entity.description,
            attributes = IF $main_entity.attributes != NONE { $main_entity.attributes } ELSE { {} },
            tags = IF $main_entity.tags != NONE { $main_entity.tags } ELSE { [] },
            embeddings = IF $main_entity.embeddings != NONE AND $main_entity.embeddings != NULL { $main_entity.embeddings } ELSE { {} }
    );

    FOR $f IN $foreign_updates {
        IF $f.id != NONE {
            LET $fid = type::record('entities', $f.id);
            UPSERT $fid SET
                project_id = $p_rec,
                entity_type = $f.entity_type,
                name = $f.name,
                description = $f.description,
                attributes = IF $f.attributes != NONE { $f.attributes } ELSE { {} },
                tags = IF $f.tags != NONE { $f.tags } ELSE { [] },
                embeddings = IF $f.embeddings != NONE AND $f.embeddings != NULL { $f.embeddings } ELSE { {} };
        };
    };

    RETURN $saved[0];
};

-- 39. ПАКЕТНОЕ ОБНОВЛЕНИЕ РЕБЕР СВЯЗЕЙ СУЩНОСТИ
DEFINE FUNCTION OVERWRITE fn::batch_upsert_connections(
    $proj: record<projects>,
    $src: record<entities>,
    $connections: array<object>
) {
    LET $p_rec = type::record('projects', type::string($proj).replace('projects:', ''));
    DELETE entity_rel WHERE project_id = $p_rec AND (in = $src OR out = $src);

    FOR $c IN $connections {
        IF $c.target != NONE {
            LET $tgt = type::record('entities', $c.target);
            LET $from = IF $c.source != NONE { type::record('entities', $c.source) } ELSE { $src };
            LET $rt = IF $c.rel_type != NONE { $c.rel_type } ELSE { 'associated' };
            LET $desc = IF $c.description != NONE { $c.description } ELSE { '' };
            LET $str = IF $c.strength != NONE { $c.strength } ELSE { NONE };
            LET $attr = IF $c.attributes != NONE { $c.attributes } ELSE { {} };
            LET $start = IF $c.start_chapter != NONE { type::record('chapters', $c.start_chapter) } ELSE { NONE };
            LET $end = IF $c.end_chapter != NONE { type::record('chapters', $c.end_chapter) } ELSE { NONE };

            RELATE $from -> entity_rel -> $tgt CONTENT {
                project_id: $p_rec,
                rel_type: $rt,
                description: $desc,
                strength: $str,
                attributes: $attr,
                start_chapter: $start,
                end_chapter: $end,
                created_at: time::now()
            };
        };
    };
};

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
    );

    LET $chapters = (
        SELECT 
            type::string(id) AS id, 
            title, 
            IF sort_order != NONE { sort_order } ELSE { 0 } AS sort_order
        FROM chapters
        WHERE project_id = $p_rec
        ORDER BY sort_order ASC
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
    );

    LET $events = (
        SELECT 
            type::string(id) AS id, 
            (SELECT VALUE type::string(out) FROM ->revealed_in LIMIT 1)[0] AS chapter_id, 
            m_abs, 
            (SELECT VALUE type::string(in) FROM <-participates_in) AS participants, 
            title, 
            IF description != NONE { description } ELSE { '' } AS description
        FROM timeline_events
        WHERE project_id = $p_rec
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
    )[0];

    LET $characters = (
        SELECT 
            type::string(id) AS id, 
            name
        FROM entities
        WHERE project_id = $p_rec AND entity_type = 'character'
    );

    LET $chapters = (
        SELECT 
            type::string(id) AS id, 
            title, 
            IF sort_order != NONE { sort_order } ELSE { 0 } AS sort_order
        FROM chapters
        WHERE project_id = $p_rec
        ORDER BY sort_order ASC
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
    );

    LET $events = (
        SELECT 
            type::string(id) AS id, 
            (SELECT VALUE type::string(out) FROM ->revealed_in LIMIT 1)[0] AS chapter_id, 
            m_abs, 
            (SELECT VALUE type::string(in) FROM <-participates_in) AS participants, 
            title, 
            IF description != NONE { description } ELSE { '' } AS description
        FROM timeline_events
        WHERE project_id = $p_rec
    );

    RETURN {
        item: $item_info,
        characters: $characters,
        chapters: $chapters,
        promises: $promises,
        events: $events
    };
};

