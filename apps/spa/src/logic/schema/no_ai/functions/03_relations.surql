-- 03_RELATIONS.SURQL — СВЯЗИ И ОТНОШЕНИЯ СУЩНОСТЕЙ


-- 9. СОЗДАНИЕ ГРАФОВОЙ СВЯЗИ МЕЖДУ СУЩНОСТЯМИ
DEFINE FUNCTION OVERWRITE fn::create_entity_relation(
    $proj: any,
    $from: record<entities>,
    $to: record<entities>,
    $rel_type: string,
    $desc: option<string | null>,
    $strength: option<int | null>,
    $attrs: option<object>,
    $start_chap: option<record<chapters> | record<volumes> | null>,
    $end_chap: option<record<chapters> | record<volumes> | null>
) {
    LET $p_rec = fn::normalize_project_id($proj);
    LET $existing = (
        SELECT id FROM entity_rel 
        WHERE in = $from AND out = $to AND rel_type = $rel_type 
        LIMIT 1
    );

    IF array::len($existing) > 0 {
        LET $updated = (
            UPDATE $existing[0].id SET
                description = $desc,
                strength = $strength,
                attributes = IF $attrs != NONE { $attrs } ELSE { {} },
                start_at = $start_chap,
                end_at = $end_chap
            RETURN AFTER
        );
        RETURN $updated[0];
    };

    LET $res = (
        RELATE $from -> entity_rel -> $to CONTENT {
            rel_type: $rel_type,
            description: $desc,
            strength: $strength,
            attributes: IF $attrs != NONE { $attrs } ELSE { {} },
            start_at: $start_chap,
            end_at: $end_chap,
            created_at: time::now()
        } RETURN AFTER
    );
    RETURN $res[0];
};

-- 10. ПОЛУЧЕНИЕ СВЯЗЕЙ СУЩНОСТЕЙ ДЛЯ ГРАФА
DEFINE FUNCTION OVERWRITE fn::get_entity_connections($proj: any, $chap: option<record<chapters>>) {
    LET $p_rec = fn::normalize_project_id($proj);
    IF $chap != NONE {
        RETURN (
            SELECT id, in, out, rel_type, description, strength, attributes, start_at, end_at, is_auto_extend, created_at, type::string(in) AS source, type::string(out) AS target, type::string(id) AS id 
            FROM entity_rel 
            WHERE in.schema_id.project_id = $p_rec 
              AND (start_at = $chap OR end_at = $chap)
            LIMIT 5000
        );
    } ELSE {
        RETURN (
            SELECT id, in, out, rel_type, description, strength, attributes, start_at, end_at, is_auto_extend, created_at, type::string(in) AS source, type::string(out) AS target, type::string(id) AS id 
            FROM entity_rel 
            WHERE in.schema_id.project_id = $p_rec
            LIMIT 5000
        );
    };
};

-- 11. ПАКЕТНОЕ СОХРАНЕНИЕ СВЯЗЕЙ СУЩНОСТИ
DEFINE FUNCTION OVERWRITE fn::save_entity_connections(
    $proj: any,
    $src: record<entities>,
    $connections: array<object>
) {
    LET $p_rec = fn::normalize_project_id($proj);
    DELETE entity_rel WHERE (in = $src OR out = $src);

    FOR $c IN $connections {
        IF $c.target != NONE AND $c.target.entityId != NONE {
            LET $tgt = type::record('entities', $c.target.entityId);
            LET $role = IF $c.role != NONE { $c.role } ELSE { 'associated' };
            LET $desc = IF $c.description != NONE { $c.description } ELSE { '' };
            LET $start_chap = IF $c.period != NONE AND $c.period.start_chapter != NONE { type::record('chapters', $c.period.start_chapter) } ELSE { NONE };
            LET $end_chap = IF $c.period != NONE AND $c.period.end_chapter != NONE { type::record('chapters', $c.period.end_chapter) } ELSE { NONE };

            RELATE $src -> entity_rel -> $tgt CONTENT {
                rel_type: $role,
                description: $desc,
                start_at: $start_chap,
                end_at: $end_chap,
                created_at: time::now()
            };
        };
    };
};

-- 12. УДАЛЕНИЕ ВСЕХ СВЯЗЕЙ СУЩНОСТИ
DEFINE FUNCTION OVERWRITE fn::remove_entity_connections($src: record<entities>) {
    DELETE entity_rel WHERE in = $src OR out = $src;
};

-- 19. ПОЛУЧЕНИЕ СПИСКА СВЯЗЕЙ СУЩНОСТЕЙ
DEFINE FUNCTION OVERWRITE fn::get_entity_relations($proj: any, $eid: option<record<entities>>) {
    LET $p_rec = fn::normalize_project_id($proj);
    IF $eid != NONE {
        RETURN (
            SELECT id, in, out, rel_type, description, strength, attributes, start_at, end_at, is_auto_extend, created_at, type::string(in) AS in, type::string(out) AS out, type::string(id) AS id 
            FROM entity_rel 
            WHERE in.schema_id.project_id = $p_rec AND (in = $eid OR out = $eid)
            LIMIT 5000
        );
    } ELSE {
        RETURN (
            SELECT id, in, out, rel_type, description, strength, attributes, start_at, end_at, is_auto_extend, created_at, type::string(in) AS in, type::string(out) AS out, type::string(id) AS id 
            FROM entity_rel 
            WHERE in.schema_id.project_id = $p_rec
            LIMIT 5000
        );
    };
};

-- 39. ПАКЕТНОЕ ОБНОВЛЕНИЕ РЕБЕР СВЯЗЕЙ СУЩНОСТИ
DEFINE FUNCTION OVERWRITE fn::batch_upsert_connections(
    $proj: any,
    $src: record<entities>,
    $connections: array<object>
) {
    LET $p_rec = fn::normalize_project_id($proj);
    DELETE entity_rel WHERE in.schema_id.project_id = $p_rec AND (in = $src OR out = $src);

    FOR $c IN $connections {
        IF $c.target != NONE {
            LET $tgt = type::record('entities', $c.target);
            LET $from = IF $c.source != NONE { type::record('entities', $c.source) } ELSE { $src };
            LET $rt = IF $c.rel_type != NONE { $c.rel_type } ELSE { 'associated' };
            LET $desc = IF $c.description != NONE { $c.description } ELSE { '' };
            LET $str = IF $c.strength != NONE { $c.strength } ELSE { NONE };
            LET $attr = IF $c.attributes != NONE { $c.attributes } ELSE { {} };
            LET $start = IF $c.start_at != NONE AND $c.start_at != NULL AND type::string($c.start_at) != '' { 
                IF string::starts_with(type::string($c.start_at), 'volumes:') OR string::starts_with(type::string($c.start_at), 'chapters:') { 
                    type::record($c.start_at) 
                } ELSE { 
                    type::record('chapters', $c.start_at) 
                }
            } ELSE IF $c.start_chapter != NONE AND $c.start_chapter != NULL AND type::string($c.start_chapter) != '' { 
                IF string::starts_with(type::string($c.start_chapter), 'chapters:') { 
                    type::record($c.start_chapter) 
                } ELSE { 
                    type::record('chapters', $c.start_chapter) 
                }
            } ELSE { NONE };
            LET $end = IF $c.end_at != NONE AND $c.end_at != NULL AND type::string($c.end_at) != '' { 
                IF string::starts_with(type::string($c.end_at), 'volumes:') OR string::starts_with(type::string($c.end_at), 'chapters:') { 
                    type::record($c.end_at) 
                } ELSE { 
                    type::record('chapters', $c.end_at) 
                }
            } ELSE IF $c.end_chapter != NONE AND $c.end_chapter != NULL AND type::string($c.end_chapter) != '' { 
                IF string::starts_with(type::string($c.end_chapter), 'chapters:') { 
                    type::record($c.end_chapter) 
                } ELSE { 
                    type::record('chapters', $c.end_chapter) 
                }
            } ELSE { NONE };

            RELATE $from -> entity_rel -> $tgt CONTENT {
                rel_type: $rt,
                description: $desc,
                strength: $str,
                attributes: $attr,
                start_at: $start,
                end_at: $end,
                created_at: time::now()
            };
        };
    };
};

-- 41. ПОЛУЧЕНИЕ СВЯЗИ СУЩНОСТЕЙ ПО ID
DEFINE FUNCTION OVERWRITE fn::get_entity_relation($id: any) {
    LET $rec = IF string::starts_with(type::string($id), 'entity_rel:') { type::record($id) } ELSE { type::record('entity_rel', $id) };
    LET $res = (
        SELECT id, in, out, rel_type, description, strength, attributes, start_at, end_at, is_auto_extend, created_at, type::string(in) AS in, type::string(out) AS out, type::string(id) AS id 
        FROM $rec 
        LIMIT 1
    );
    RETURN IF array::len($res) > 0 { $res[0] } ELSE { NONE };
};

-- 42. УДАЛЕНИЕ СВЯЗИ СУЩНОСТЕЙ ПО ID
DEFINE FUNCTION OVERWRITE fn::delete_entity_relation($id: any) {
    LET $rec = IF string::starts_with(type::string($id), 'entity_rel:') { type::record($id) } ELSE { type::record('entity_rel', $id) };
    DELETE $rec;
};

-- 43. СОХРАНЕНИЕ / ОБНОВЛЕНИЕ ЕДИНИЧНОЙ ГРАФОВОЙ СВЯЗИ
DEFINE FUNCTION OVERWRITE fn::save_entity_relation(
    $id: option<string | null>,
    $from: any,
    $to: any,
    $rel_type: string,
    $desc: option<string | null>,
    $strength: option<int | null>,
    $attrs: option<object | null>,
    $start_chap: option<string | null>,
    $end_chap: option<string | null>
) {
    LET $from_rec = IF string::starts_with(type::string($from), 'entities:') { type::record($from) } ELSE { type::record('entities', $from) };
    LET $to_rec = IF string::starts_with(type::string($to), 'entities:') { type::record($to) } ELSE { type::record('entities', $to) };
    LET $start = IF $start_chap != NONE AND $start_chap != NULL AND type::string($start_chap) != '' {
        IF string::starts_with(type::string($start_chap), 'volumes:') { type::record($start_chap) }
        ELSE IF string::starts_with(type::string($start_chap), 'chapters:') { type::record($start_chap) } 
        ELSE { type::record('chapters', $start_chap) }
    } ELSE { NONE };
    LET $end = IF $end_chap != NONE AND $end_chap != NULL AND type::string($end_chap) != '' {
        IF string::starts_with(type::string($end_chap), 'volumes:') { type::record($end_chap) }
        ELSE IF string::starts_with(type::string($end_chap), 'chapters:') { type::record($end_chap) } 
        ELSE { type::record('chapters', $end_chap) }
    } ELSE { NONE };
    LET $safe_attrs = IF $attrs != NONE AND $attrs != NULL AND type::is_object($attrs) { $attrs } ELSE { {} };

    LET $edge_id = IF $id != NONE AND $id != NULL AND type::string($id) != '' {
        IF string::starts_with(type::string($id), 'entity_rel:') { type::record($id) } ELSE { type::record('entity_rel', $id) }
    } ELSE {
        NONE
    };

    IF $edge_id != NONE {
        LET $existing = (SELECT id FROM $edge_id LIMIT 1);
        IF array::len($existing) > 0 {
            LET $updated = (
                UPDATE $edge_id SET
                    in = $from_rec,
                    out = $to_rec,
                    rel_type = $rel_type,
                    description = $desc,
                    strength = $strength,
                    attributes = $safe_attrs,
                    start_at = $start,
                    end_at = $end
                RETURN AFTER
            );
            RETURN $updated[0];
        };
        LET $rel = (
            RELATE $from_rec->$edge_id->$to_rec CONTENT {
                rel_type: $rel_type,
                description: $desc,
                strength: $strength,
                attributes: $safe_attrs,
                start_at: $start,
                end_at: $end,
                created_at: time::now()
            } RETURN AFTER
        );
        RETURN $rel[0];
    } ELSE {
        LET $rel = (
            RELATE $from_rec->entity_rel->$to_rec CONTENT {
                rel_type: $rel_type,
                description: $desc,
                strength: $strength,
                attributes: $safe_attrs,
                start_at: $start,
                end_at: $end,
                created_at: time::now()
            } RETURN AFTER
        );
        RETURN $rel[0];
    };
};
