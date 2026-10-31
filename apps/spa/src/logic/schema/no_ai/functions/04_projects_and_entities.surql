-- 04_PROJECTS_AND_ENTITIES.SURQL — ПРОЕКТЫ И СУЩНОСТИ ЛОРА


-- 13. СПИСОК ВСЕХ ПРОЕКТОВ
DEFINE FUNCTION OVERWRITE fn::get_projects_list() {
    RETURN (SELECT id, name, created_at, type, genres, cover_image, type::string(id) AS id FROM projects ORDER BY created_at DESC LIMIT 1000);
};

-- 14. ПОЛУЧЕНИЕ КОНФИГУРАЦИИ ПРОЕКТА
DEFINE FUNCTION OVERWRITE fn::get_project_config($name: any) {
    IF type::is_null($name) OR (type::is_string($name) AND string::len($name) == 0) {
        RETURN {};
    };
    LET $p_rec = fn::normalize_project_id($name);
    LET $res = (
        SELECT id, name, created_at, type, genres, cover_image, type::string(id) AS id FROM projects 
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
        WHERE schema_id.project_id = $p_rec
        LIMIT 10000
    );
};

-- 16. ОБНОВЛЕНИЕ АТРИБУТОВ СУЩНОСТИ
DEFINE FUNCTION OVERWRITE fn::update_entity_attributes($entity: record<entities>, $attrs: object) {
    UPDATE $entity SET attributes = $attrs, updated_at = time::now();
};

-- 34. ПОЛУЧЕНИЕ СУЩНОСТЕЙ ПРОЕКТА С ФИЛЬТРАЦИЕЙ ПО ТИПУ
DEFINE FUNCTION OVERWRITE fn::get_entities($proj: record<projects>, $et: option<string>) {
    LET $p_rec = fn::normalize_project_id($proj);
    IF $et != NONE {
        RETURN (
            SELECT 
                id, 
                schema_id.project_id AS project_id, 
                schema_id, 
                schema_id.type_key AS entity_type, 
                name, 
                description, 
                attributes, 
                tags, 
                embeddings, 
                created_at, 
                updated_at 
            FROM entities 
            WHERE schema_id.project_id = $p_rec
              AND schema_id.type_key = $et
            ORDER BY name ASC
            LIMIT 10000
        );
    } ELSE {
        RETURN (
            SELECT 
                id, 
                schema_id.project_id AS project_id, 
                schema_id, 
                schema_id.type_key AS entity_type, 
                name, 
                description, 
                attributes, 
                tags, 
                embeddings, 
                created_at, 
                updated_at 
            FROM entities 
            WHERE schema_id.project_id = $p_rec
            ORDER BY name ASC
            LIMIT 10000
        );
    };
};

-- 34.1. ПОЛУЧЕНИЕ ЕДИНИЧНОЙ СУЩНОСТИ ПО ID С КАНОНИЧЕСКОЙ ПРОЕКЦИЕЙ
DEFINE FUNCTION OVERWRITE fn::get_entity($id: record<entities>) {
    RETURN (
        SELECT 
            id, 
            schema_id.project_id AS project_id, 
            schema_id, 
            schema_id.type_key AS entity_type, 
            name, 
            description, 
            attributes, 
            tags, 
            embeddings, 
            created_at, 
            updated_at 
        FROM ONLY $id
        LIMIT 1
    );
};

-- 35. СОХРАНЕНИЕ СУЩНОСТИ (UPSERT ИЛИ CREATE)
DEFINE FUNCTION OVERWRITE fn::save_entity(
    $id: option<record<entities> | null>,
    $proj: record<projects>,
    $entity_type: string,
    $name: string,
    $desc: option<string | null>,
    $attrs: option<object | null>,
    $tags: option<array<string> | null>,
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
            fields_schema = []
        )[0].id
    };

    -- 2. Сохраняем сущность (чистая 3NF модель)
    LET $clean_tags = IF $tags != NONE AND $tags != NULL { $tags } ELSE { [] };
    LET $rec_id = IF $id != NONE AND $id != NULL {
        LET $existing = (SELECT id, schema_id, name, description, attributes, tags, embeddings, created_at, updated_at FROM ONLY $id);
        (UPSERT $id SET
            schema_id = $schema_id,
            name = $name,
            description = IF $desc != NONE AND $desc != NULL { $desc } ELSE IF $existing != NONE { $existing.description } ELSE { NONE },
            attributes = IF $attrs != NONE AND $attrs != NULL AND array::len(object::keys($attrs)) > 0 { $attrs } ELSE IF $existing != NONE { $existing.attributes } ELSE { {} },
            tags = $clean_tags,
            embeddings = IF $embeds != NONE AND $embeds != NULL { $embeds } ELSE IF $existing != NONE { $existing.embeddings } ELSE { {} },
            updated_at = time::now()
        )[0].id
    } ELSE {
        (CREATE entities SET
            schema_id = $schema_id,
            name = $name,
            description = $desc,
            attributes = IF $attrs != NONE AND $attrs != NULL { $attrs } ELSE { {} },
            tags = $clean_tags,
            embeddings = IF $embeds != NONE AND $embeds != NULL { $embeds } ELSE { {} },
            created_at = time::now(),
            updated_at = time::now()
        )[0].id
    };

    -- 3. Возвращаем каноническую проекцию с entity_type и tags
    RETURN (
        SELECT 
            id,
            schema_id.project_id AS project_id,
            schema_id,
            schema_id.type_key AS entity_type,
            name,
            description,
            attributes,
            tags,
            embeddings,
            created_at,
            updated_at
        FROM ONLY $rec_id
        LIMIT 1
    );
};

-- 36. ПОЛНОТЕКСТОВЫЙ ПОИСК СУЩНОСТЕЙ ПО BM25 С РАНЖИРОВАНИЕМ
DEFINE FUNCTION OVERWRITE fn::search_entities($proj: record<projects>, $q: string, $et: option<string>) {
    LET $p_rec = fn::normalize_project_id($proj);
    IF $et != NONE {
        RETURN (
            SELECT 
                id, 
                schema_id.project_id AS project_id, 
                schema_id, 
                schema_id.type_key AS entity_type, 
                name, 
                description, 
                attributes, 
                tags, 
                embeddings, 
                created_at, 
                updated_at 
            FROM entities 
            WHERE schema_id.project_id = $p_rec
              AND (name @1@ $q OR description @1@ $q)
              AND schema_id.type_key = $et
            LIMIT 50
        );
    } ELSE {
        RETURN (
            SELECT 
                id, 
                schema_id.project_id AS project_id, 
                schema_id, 
                schema_id.type_key AS entity_type, 
                name, 
                description, 
                attributes, 
                tags, 
                embeddings, 
                created_at, 
                updated_at 
            FROM entities 
            WHERE schema_id.project_id = $p_rec
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
            schema_id.project_id AS project_id, 
            schema_id, 
            schema_id.type_key AS entity_type, 
            name, 
            description, 
            attributes, 
            tags, 
            embeddings, 
            created_at, 
            updated_at 
        FROM entities 
        WHERE schema_id.project_id = $p_rec
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
        (CREATE entity_schemas SET project_id = $p_rec, type_key = $main_tk, type_name = $main_tk, fields_schema = [])[0].id
    };

    LET $main_tags = IF $main_entity.tags != NONE AND $main_entity.tags != NULL { $main_entity.tags } ELSE { [] };

    UPSERT $main_id SET
        schema_id = $main_schema_id,
        name = $main_entity.name,
        description = $main_entity.description,
        attributes = IF $main_entity.attributes != NONE { $main_entity.attributes } ELSE { {} },
        tags = $main_tags,
        embeddings = IF $main_entity.embeddings != NONE AND $main_entity.embeddings != NULL { $main_entity.embeddings } ELSE { {} },
        updated_at = time::now();

    -- 2. Связанные сущности
    FOR $f IN $foreign_updates {
        IF $f.id != NONE {
            LET $fid = type::record('entities', $f.id);
            LET $f_tk = $f.entity_type;
            LET $f_schema_res = (SELECT VALUE id FROM entity_schemas WHERE project_id = $p_rec AND type_key = $f_tk LIMIT 1);
            LET $f_schema_id = IF array::len($f_schema_res) > 0 {
                $f_schema_res[0]
            } ELSE {
                (CREATE entity_schemas SET project_id = $p_rec, type_key = $f_tk, type_name = $f_tk, fields_schema = [])[0].id
            };

            LET $f_tags = IF $f.tags != NONE AND $f.tags != NULL { $f.tags } ELSE { [] };

            UPSERT $fid SET
                schema_id = $f_schema_id,
                name = $f.name,
                description = $f.description,
                attributes = IF $f.attributes != NONE { $f.attributes } ELSE { {} },
                tags = $f_tags,
                embeddings = IF $f.embeddings != NONE AND $f.embeddings != NULL { $f.embeddings } ELSE { {} },
                updated_at = time::now();
        };
    };

    RETURN (
        SELECT 
            id,
            schema_id.project_id AS project_id,
            schema_id,
            schema_id.type_key AS entity_type,
            name,
            description,
            attributes,
            tags,
            embeddings,
            created_at,
            updated_at
        FROM ONLY $main_id
        LIMIT 1
    );
};

-- 39. ПОЛНОЕ КАСКАДНОЕ УДАЛЕНИЕ ПРОЕКТА И ВСЕХ ПРОЕКТНЫХ ДАННЫХ
DEFINE FUNCTION OVERWRITE fn::delete_project_cascade($name: string) {
    LET $p_rec = fn::normalize_project_id($name);
    
    -- 1. Связи и участия
    DELETE contains WHERE in = $p_rec OR out = $p_rec;
    DELETE entity_rel WHERE project_id = $p_rec;
    DELETE appears_in WHERE project_id = $p_rec;
    DELETE participates_in WHERE project_id = $p_rec;
    DELETE participant_of WHERE project_id = $p_rec;
    DELETE advances_arc WHERE project_id = $p_rec;
    DELETE occurs_at WHERE project_id = $p_rec;
    DELETE story_arcs WHERE project_id = $p_rec;
    DELETE entity_revisions WHERE target_id.schema_id.project_id = $p_rec;
    DELETE entity_rel_revisions WHERE project_id = $p_rec;

    -- 2. Сущности лора и схемы
    DELETE entities WHERE schema_id.project_id = $p_rec;
    DELETE entity_schemas WHERE project_id = $p_rec;
    DELETE relation_schemas WHERE project_id = $p_rec;

    -- 3. Блоки текста, ревизии, главы и тома рукописи
    DELETE promise_milestones WHERE project_id = $p_rec;
    DELETE text_blocks WHERE chapter_id.volume_id.project_id = $p_rec;
    DELETE chapter_revisions WHERE target_id.volume_id.project_id = $p_rec;
    DELETE chapters WHERE volume_id.project_id = $p_rec;
    DELETE volumes WHERE project_id = $p_rec;

    -- 4. Планирование, таймлайн и сюжетные обещания
    DELETE todos WHERE owner_id = $p_rec OR owner_id.project_id = $p_rec OR owner_id.volume_id.project_id = $p_rec;
    DELETE plot_promises WHERE project_id = $p_rec;
    DELETE timeline_events WHERE project_id = $p_rec;
    DELETE calendars WHERE project_id = $p_rec;
    DELETE planets WHERE project_id = $p_rec;

    -- 5. Сам проект
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
            SELECT 
                id, 
                schema_id.project_id AS project_id, 
                schema_id, 
                schema_id.type_key AS entity_type, 
                name, 
                description, 
                attributes, 
                tags, 
                embeddings, 
                created_at, 
                updated_at 
            FROM entities 
            WHERE schema_id.project_id = $p_rec 
              AND schema_id.type_key = $et 
              AND id > $cursor_id 
            ORDER BY id ASC 
            LIMIT $lim
        );
    } ELSE IF $et != NONE {
        RETURN (
            SELECT 
                id, 
                schema_id.project_id AS project_id, 
                schema_id, 
                schema_id.type_key AS entity_type, 
                name, 
                description, 
                attributes, 
                tags, 
                embeddings, 
                created_at, 
                updated_at 
            FROM entities 
            WHERE schema_id.project_id = $p_rec 
              AND schema_id.type_key = $et 
            ORDER BY id ASC 
            LIMIT $lim
        );
    } ELSE IF $cursor_id != NONE AND $cursor_id != NULL {
        RETURN (
            SELECT 
                id, 
                schema_id.project_id AS project_id, 
                schema_id, 
                schema_id.type_key AS entity_type, 
                name, 
                description, 
                attributes, 
                tags, 
                embeddings, 
                created_at, 
                updated_at 
            FROM entities 
            WHERE schema_id.project_id = $p_rec 
              AND id > $cursor_id 
            ORDER BY id ASC 
            LIMIT $lim
        );
    } ELSE {
        RETURN (
            SELECT 
                id, 
                schema_id.project_id AS project_id, 
                schema_id, 
                schema_id.type_key AS entity_type, 
                name, 
                description, 
                attributes, 
                tags, 
                embeddings, 
                created_at, 
                updated_at 
            FROM entities 
            WHERE schema_id.project_id = $p_rec 
            ORDER BY id ASC 
            LIMIT $lim
        );
    };
};
