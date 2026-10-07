-- 03_RELATIONS.SURQL — СВЯЗИ И ОТНОШЕНИЯ СУЩНОСТЕЙ


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
