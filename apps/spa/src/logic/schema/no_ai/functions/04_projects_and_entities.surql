-- 04_PROJECTS_AND_ENTITIES.SURQL — ПРОЕКТЫ И СУЩНОСТИ ЛОРА


-- 13. СПИСОК ВСЕХ ПРОЕКТОВ
DEFINE FUNCTION OVERWRITE fn::get_projects_list() {
    RETURN (SELECT id, name, created_at, data, type, genres, perfLevel, type::string(id) AS id FROM projects ORDER BY created_at DESC LIMIT 1000);
};

-- 14. ПОЛУЧЕНИЕ КОНФИГУРАЦИИ ПРОЕКТА
DEFINE FUNCTION OVERWRITE fn::get_project_config($name: any) {
    IF type::is_null($name) OR (type::is_string($name) AND string::len($name) == 0) {
        RETURN {};
    };
    LET $p_rec = fn::normalize_project_id($name);
    LET $res = (
        SELECT id, name, created_at, data, type, genres, perfLevel, type::string(id) AS id FROM projects 
        WHERE id = $p_rec OR name = type::string($name)
        LIMIT 1
    );
    RETURN IF array::len($res) > 0 { $res[0] } ELSE { {} };
};

-- 15. ВЫБОРКА АТРИБУТОВ СУЩНОСТЕЙ ПРОЕКТА
DEFINE FUNCTION OVERWRITE fn::get_entities_attributes($proj: record<projects>) {
    LET $p_rec = fn::normalize_project_id($proj);
    RETURN (
        SELECT id, attributes FROM entities 
        WHERE project_id = $p_rec
        LIMIT 10000
    );
};

-- 16. ОБНОВЛЕНИЕ АТРИБУТОВ СУЩНОСТИ
DEFINE FUNCTION OVERWRITE fn::update_entity_attributes($entity: record<entities>, $attrs: object) {
    UPDATE $entity SET attributes = $attrs;
};

-- 34. ПОЛУЧЕНИЕ СУЩНОСТЕЙ ПРОЕКТА С ФИЛЬТРАЦИЕЙ ПО ТИПУ
DEFINE FUNCTION OVERWRITE fn::get_entities($proj: record<projects>, $et: option<string>) {
    LET $p_rec = fn::normalize_project_id($proj);
    IF $et != NONE {
        RETURN (
            SELECT 
                id, 
                project_id, 
                schema_id, 
                schema_id.type_key AS entity_type, 
                name, 
                description, 
                attributes, 
                (->tagged_with.out.name) AS tags, 
                embeddings, 
                created_at, 
                updated_at 
            FROM entities 
            WHERE project_id = $p_rec
              AND schema_id.type_key = $et
            ORDER BY name ASC
            LIMIT 10000
        );
    } ELSE {
        RETURN (
            SELECT 
                id, 
                project_id, 
                schema_id, 
                schema_id.type_key AS entity_type, 
                name, 
                description, 
                attributes, 
                (->tagged_with.out.name) AS tags, 
                embeddings, 
                created_at, 
                updated_at 
            FROM entities 
            WHERE project_id = $p_rec
            ORDER BY name ASC
            LIMIT 10000
        );
    };
};

-- 34.1. ПОЛУЧЕНИЕ ЕДИНИЧНОЙ СУЩНОСТИ ПО ID С КАНОНИЧЕСКОЙ ПРОЕКЦИЕЙ
DEFINE FUNCTION OVERWRITE fn::get_entity($id: record<entities>) {
    LET $res = (
        SELECT 
            id, 
            project_id, 
            schema_id, 
            schema_id.type_key AS entity_type, 
            name, 
            description, 
            attributes, 
            (SELECT VALUE out.name FROM tagged_with WHERE in = $id ORDER BY out.name ASC) AS tags, 
            embeddings, 
            created_at, 
            updated_at 
        FROM ONLY $id
    );
    RETURN $res;
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
    LET $p_rec = fn::normalize_project_id($proj);
    
    -- 1. Гарантируем наличие схемы сущности
    LET $schema_res = (SELECT VALUE id FROM entity_schemas WHERE project_id = $p_rec AND type_key = $entity_type LIMIT 1);
    LET $schema_id = IF array::len($schema_res) > 0 {
        $schema_res[0]
    } ELSE {
        (CREATE entity_schemas SET
            project_id = $p_rec,
            type_key = $entity_type,
            type_name = $entity_type,
            icon = 'box',
            color = 'var(--text-accent)'
        )[0].id
    };

    -- 2. Сохраняем чистую сущность (только schema_id, без дублирующих колонок entity_type и tags)
    LET $rec_id = IF $id != NONE AND $id != NULL {
        LET $existing = (SELECT id, project_id, schema_id, name, description, attributes, embeddings, created_at, updated_at FROM ONLY $id);
        (UPSERT $id SET
            project_id = $p_rec,
            schema_id = $schema_id,
            name = $name,
            description = IF $desc != NONE AND $desc != NULL { $desc } ELSE IF $existing != NONE { $existing.description } ELSE { NONE },
            attributes = IF $attrs != NONE AND array::len(object::keys($attrs)) > 0 { $attrs } ELSE IF $existing != NONE { $existing.attributes } ELSE { {} },
            embeddings = IF $embeds != NONE AND $embeds != NULL { $embeds } ELSE IF $existing != NONE { $existing.embeddings } ELSE { {} }
        )[0].id
    } ELSE {
        (CREATE entities SET
            project_id = $p_rec,
            schema_id = $schema_id,
            name = $name,
            description = $desc,
            attributes = IF $attrs != NONE { $attrs } ELSE { {} },
            embeddings = IF $embeds != NONE AND $embeds != NULL { $embeds } ELSE { {} }
        )[0].id
    };

    -- 3. Синхронизируем теги через ребро tagged_with
    IF $tags != NONE {
        DELETE tagged_with WHERE in = $rec_id;
        FOR $tag_name IN $tags {
            IF string::len(string::trim($tag_name)) > 0 {
                LET $clean_tag = string::trim($tag_name);
                LET $existing_tag = (SELECT VALUE id FROM tags WHERE project_id = $p_rec AND name = $clean_tag LIMIT 1);
                LET $tag_id = IF array::len($existing_tag) > 0 {
                    $existing_tag[0]
                } ELSE {
                    (CREATE tags SET
                        project_id = $p_rec,
                        name = $clean_tag,
                        color = 'var(--text-accent)'
                    )[0].id
                };
                RELATE $rec_id -> tagged_with -> $tag_id SET project_id = $p_rec;
            };
        };
    };

    -- 4. Возвращаем каноническую проекцию с entity_type и tags
    RETURN (
        SELECT 
            id,
            project_id,
            schema_id,
            schema_id.type_key AS entity_type,
            name,
            description,
            attributes,
            (SELECT VALUE out.name FROM tagged_with WHERE in = $rec_id ORDER BY out.name ASC) AS tags,
            embeddings,
            created_at,
            updated_at
        FROM ONLY $rec_id
    );
};

-- 36. ПОЛНОТЕКСТОВЫЙ ПОИСК СУЩНОСТЕЙ ПО BM25 С РАНЖИРОВАНИЕМ
DEFINE FUNCTION OVERWRITE fn::search_entities($proj: record<projects>, $q: string, $et: option<string>) {
    LET $p_rec = fn::normalize_project_id($proj);
    IF $et != NONE {
        RETURN (
            SELECT 
                id, 
                project_id, 
                schema_id, 
                schema_id.type_key AS entity_type, 
                name, 
                description, 
                attributes, 
                (->tagged_with.out.name) AS tags, 
                embeddings, 
                created_at, 
                updated_at 
            FROM entities 
            WHERE project_id = $p_rec
              AND (name @1@ $q OR description @1@ $q)
              AND schema_id.type_key = $et
            LIMIT 50
        );
    } ELSE {
        RETURN (
            SELECT 
                id, 
                project_id, 
                schema_id, 
                schema_id.type_key AS entity_type, 
                name, 
                description, 
                attributes, 
                (->tagged_with.out.name) AS tags, 
                embeddings, 
                created_at, 
                updated_at 
            FROM entities 
            WHERE project_id = $p_rec
              AND (name @1@ $q OR description @1@ $q)
            LIMIT 50
        );
    };
};

-- 37. ПАКЕТНОЕ ПОЛУЧЕНИЕ СУЩНОСТЕЙ ПО ТИПАМ
DEFINE FUNCTION OVERWRITE fn::get_entities_batch($proj: record<projects>, $types: array<string>) {
    LET $p_rec = fn::normalize_project_id($proj);
    RETURN (
        SELECT 
            id, 
            project_id, 
            schema_id, 
            schema_id.type_key AS entity_type, 
            name, 
            description, 
            attributes, 
            (->tagged_with.out.name) AS tags, 
            embeddings, 
            created_at, 
            updated_at 
        FROM entities 
        WHERE project_id = $p_rec
          AND schema_id.type_key IN $types
        ORDER BY name ASC
        LIMIT 5000
    );
};

-- 38. ПАКЕТНОЕ СОХРАНЕНИЕ СУЩНОСТИ И ЕЕ СВЯЗАННЫХ СУЩНОСТЕЙ
DEFINE FUNCTION OVERWRITE fn::batch_save_entity_with_relations(
    $proj: record<projects>,
    $main_id: record<entities>,
    $main_entity: object,
    $foreign_updates: array<object>
) {
    LET $p_rec = fn::normalize_project_id($proj);
    
    -- 1. Схема главной сущности
    LET $main_tk = $main_entity.entity_type;
    LET $main_schema_res = (SELECT VALUE id FROM entity_schemas WHERE project_id = $p_rec AND type_key = $main_tk LIMIT 1);
    LET $main_schema_id = IF array::len($main_schema_res) > 0 {
        $main_schema_res[0]
    } ELSE {
        (CREATE entity_schemas SET project_id = $p_rec, type_key = $main_tk, type_name = $main_tk, icon = 'box', color = 'var(--text-accent)')[0].id
    };

    UPSERT $main_id SET
        project_id = $p_rec,
        schema_id = $main_schema_id,
        name = $main_entity.name,
        description = $main_entity.description,
        attributes = IF $main_entity.attributes != NONE { $main_entity.attributes } ELSE { {} },
        embeddings = IF $main_entity.embeddings != NONE AND $main_entity.embeddings != NULL { $main_entity.embeddings } ELSE { {} };

    IF $main_entity.tags != NONE {
        DELETE tagged_with WHERE in = $main_id;
        FOR $tag_name IN $main_entity.tags {
            IF string::len(string::trim($tag_name)) > 0 {
                LET $clean_tag = string::trim($tag_name);
                LET $existing_tag = (SELECT VALUE id FROM tags WHERE project_id = $p_rec AND name = $clean_tag LIMIT 1);
                LET $tag_id = IF array::len($existing_tag) > 0 { $existing_tag[0] } ELSE { (CREATE tags SET project_id = $p_rec, name = $clean_tag, color = 'var(--text-accent)')[0].id };
                RELATE $main_id -> tagged_with -> $tag_id SET project_id = $p_rec;
            };
        };
    };

    -- 2. Связанные сущности
    FOR $f IN $foreign_updates {
        IF $f.id != NONE {
            LET $fid = type::record('entities', $f.id);
            LET $f_tk = $f.entity_type;
            LET $f_schema_res = (SELECT VALUE id FROM entity_schemas WHERE project_id = $p_rec AND type_key = $f_tk LIMIT 1);
            LET $f_schema_id = IF array::len($f_schema_res) > 0 {
                $f_schema_res[0]
            } ELSE {
                (CREATE entity_schemas SET project_id = $p_rec, type_key = $f_tk, type_name = $f_tk, icon = 'box', color = 'var(--text-accent)')[0].id
            };

            UPSERT $fid SET
                project_id = $p_rec,
                schema_id = $f_schema_id,
                name = $f.name,
                description = $f.description,
                attributes = IF $f.attributes != NONE { $f.attributes } ELSE { {} },
                embeddings = IF $f.embeddings != NONE AND $f.embeddings != NULL { $f.embeddings } ELSE { {} };

            IF $f.tags != NONE {
                DELETE tagged_with WHERE in = $fid;
                FOR $ftag IN $f.tags {
                    IF string::len(string::trim($ftag)) > 0 {
                        LET $clean_ftag = string::trim($ftag);
                        LET $existing_ftag = (SELECT VALUE id FROM tags WHERE project_id = $p_rec AND name = $clean_ftag LIMIT 1);
                        LET $ftag_id = IF array::len($existing_ftag) > 0 { $existing_ftag[0] } ELSE { (CREATE tags SET project_id = $p_rec, name = $clean_ftag, color = 'var(--text-accent)')[0].id };
                        RELATE $fid -> tagged_with -> $ftag_id SET project_id = $p_rec;
                    };
                };
            };
        };
    };

    RETURN (
        SELECT 
            id,
            project_id,
            schema_id,
            schema_id.type_key AS entity_type,
            name,
            description,
            attributes,
            (->tagged_with.out.name) AS tags,
            embeddings,
            created_at,
            updated_at
        FROM ONLY $main_id
    );
};

-- 39. ПОЛНОЕ КАСКАДНОЕ УДАЛЕНИЕ ПРОЕКТА И ВСЕХ ПРОЕКТНЫХ ДАННЫХ
DEFINE FUNCTION OVERWRITE fn::delete_project_cascade($name: string) {
    LET $p_rec = fn::normalize_project_id($name);
    
    -- 1. Иерархия, связи и участие
    DELETE contains WHERE in = $p_rec OR out = $p_rec;
    DELETE entity_rel WHERE project_id = $p_rec;
    DELETE appears_in WHERE project_id = $p_rec;
    DELETE participates_in WHERE project_id = $p_rec;
    DELETE revealed_in WHERE project_id = $p_rec;
    DELETE arc_entities WHERE project_id = $p_rec;
    DELETE arc_chapters WHERE project_id = $p_rec;
    DELETE advances_arc WHERE project_id = $p_rec;
    DELETE occurs_at WHERE project_id = $p_rec;
    DELETE story_arcs WHERE project_id = $p_rec;
    DELETE entity_revisions WHERE project_id = $p_rec;
    DELETE entity_rel_revisions WHERE project_id = $p_rec;
    DELETE tagged_with WHERE project_id = $p_rec;
    DELETE tags WHERE project_id = $p_rec;

    -- 2. Сущности лора
    DELETE entities WHERE project_id = $p_rec;

    -- 3. Блоки текста, ревизии, главы и тома рукописи
    DELETE promise_milestones WHERE project_id = $p_rec;
    DELETE text_blocks WHERE project_id = $p_rec;
    DELETE chapter_revisions WHERE project_id = $p_rec;
    DELETE chapters WHERE project_id = $p_rec;
    DELETE volumes WHERE project_id = $p_rec;

    -- 4. Планирование, таймлайн и сюжетные обещания
    DELETE plans_for WHERE project_id = $p_rec;
    DELETE plans WHERE project_id = $p_rec;
    DELETE plot_promises WHERE project_id = $p_rec;
    DELETE timeline_events WHERE project_id = $p_rec;

    -- 5. Сам проект (триггерит cascade_project_delete и cascade_project_ai_delete если Ultra включена)
    DELETE projects WHERE id = $p_rec;
    
    RETURN true;
};

-- 40. ПАГИНАЦИЯ СУЩНОСТЕЙ ЧЕРЕЗ KEYSET (CURSOR PAGINATION)
DEFINE FUNCTION OVERWRITE fn::get_entities_cursor(
    $proj: record<projects>, 
    $et: option<string>, 
    $cursor_id: option<record<entities> | null>, 
    $limit: int
) {
    LET $p_rec = fn::normalize_project_id($proj);
    LET $lim = IF $limit > 0 AND $limit <= 500 { $limit } ELSE { 50 };
    
    IF $et != NONE AND $cursor_id != NONE AND $cursor_id != NULL {
        RETURN (
            SELECT id, project_id, entity_type, name, description, attributes, tags, embeddings, created_at, updated_at 
            FROM entities 
            WHERE project_id = $p_rec 
              AND entity_type = $et 
              AND id > $cursor_id 
            ORDER BY id ASC 
            LIMIT $lim
        );
    } ELSE IF $et != NONE {
        RETURN (
            SELECT id, project_id, entity_type, name, description, attributes, tags, embeddings, created_at, updated_at 
            FROM entities 
            WHERE project_id = $p_rec 
              AND entity_type = $et 
            ORDER BY id ASC 
            LIMIT $lim
        );
    } ELSE IF $cursor_id != NONE AND $cursor_id != NULL {
        RETURN (
            SELECT id, project_id, entity_type, name, description, attributes, tags, embeddings, created_at, updated_at 
            FROM entities 
            WHERE project_id = $p_rec 
              AND id > $cursor_id 
            ORDER BY id ASC 
            LIMIT $lim
        );
    } ELSE {
        RETURN (
            SELECT id, project_id, entity_type, name, description, attributes, tags, embeddings, created_at, updated_at 
            FROM entities 
            WHERE project_id = $p_rec 
            ORDER BY id ASC 
            LIMIT $lim
        );
    };
};


