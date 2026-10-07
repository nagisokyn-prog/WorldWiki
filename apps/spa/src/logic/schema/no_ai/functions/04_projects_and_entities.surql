-- 04_PROJECTS_AND_ENTITIES.SURQL — ПРОЕКТЫ И СУЩНОСТИ ЛОРА


-- 13. СПИСОК ВСЕХ ПРОЕКТОВ
DEFINE FUNCTION OVERWRITE fn::get_projects_list() {
    RETURN (SELECT id, name, created_at, data, type, genres, perfLevel, type::string(id) AS id FROM projects ORDER BY created_at DESC LIMIT 1000);
};

-- 14. ПОЛУЧЕНИЕ КОНФИГУРАЦИИ ПРОЕКТА
DEFINE FUNCTION OVERWRITE fn::get_project_config($name: string) {
    IF string::len($name) == 0 {
        RETURN {};
    };
    LET $clean = string::replace($name, 'projects:', '');
    LET $res = (
        SELECT id, name, created_at, data, type, genres, perfLevel, type::string(id) AS id FROM projects 
        WHERE id = type::record('projects', $clean) OR name = $name OR name = $clean
        LIMIT 1
    );
    RETURN IF array::len($res) > 0 { $res[0] } ELSE { {} };
};

-- 15. ВЫБОРКА АТРИБУТОВ СУЩНОСТЕЙ ПРОЕКТА
DEFINE FUNCTION OVERWRITE fn::get_entities_attributes($proj: record<projects>) {
    LET $clean = string::replace(string::replace(string::replace(string::replace(type::string($proj), 'projects:', ''), '⟨', ''), '⟩', ''), '`', '');
    LET $p_rec = type::record('projects', $clean);
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
    LET $clean = string::replace(string::replace(string::replace(string::replace(type::string($proj), 'projects:', ''), '⟨', ''), '⟩', ''), '`', '');
    LET $p_rec = type::record('projects', $clean);
    IF $et != NONE {
        RETURN (
            SELECT id, project_id, entity_type, name, description, attributes, tags, embeddings, created_at, updated_at FROM entities 
            WHERE project_id = $p_rec
              AND entity_type = $et
            LIMIT 10000
        );
    } ELSE {
        RETURN (
            SELECT id, project_id, entity_type, name, description, attributes, tags, embeddings, created_at, updated_at FROM entities 
            WHERE project_id = $p_rec
            LIMIT 10000
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
    LET $clean = string::replace(string::replace(string::replace(string::replace(type::string($proj), 'projects:', ''), '⟨', ''), '⟩', ''), '`', '');
    LET $p_rec = type::record('projects', $clean);
    IF $id != NONE AND $id != NULL {
        LET $existing = (SELECT id, project_id, entity_type, name, description, attributes, tags, embeddings, created_at, updated_at FROM ONLY $id);
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
    LET $clean = string::replace(string::replace(string::replace(string::replace(type::string($proj), 'projects:', ''), '⟨', ''), '⟩', ''), '`', '');
    LET $p_rec = type::record('projects', $clean);
    IF $et != NONE {
        RETURN (
            SELECT id, project_id, entity_type, name, description, attributes, tags, embeddings, created_at, updated_at 
            FROM entities 
            WHERE project_id = $p_rec
              AND (name @1@ $q OR description @1@ $q)
              AND entity_type = $et
            LIMIT 50
        );
    } ELSE {
        RETURN (
            SELECT id, project_id, entity_type, name, description, attributes, tags, embeddings, created_at, updated_at 
            FROM entities 
            WHERE project_id = $p_rec
              AND (name @1@ $q OR description @1@ $q)
            LIMIT 50
        );
    };
};

-- 37. ПАКЕТНОЕ ПОЛУЧЕНИЕ СУЩНОСТЕЙ ПО ТИПАМ
DEFINE FUNCTION OVERWRITE fn::get_entities_batch($proj: record<projects>, $types: array<string>) {
    LET $clean = string::replace(string::replace(string::replace(string::replace(type::string($proj), 'projects:', ''), '⟨', ''), '⟩', ''), '`', '');
    LET $p_rec = type::record('projects', $clean);
    RETURN (
        SELECT id, project_id, entity_type, name, description, attributes, tags, embeddings, created_at, updated_at FROM entities 
        WHERE project_id = $p_rec
          AND entity_type IN $types
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
    LET $clean = string::replace(string::replace(string::replace(string::replace(type::string($proj), 'projects:', ''), '⟨', ''), '⟩', ''), '`', '');
    LET $p_rec = type::record('projects', $clean);
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

-- 39. ПОЛНОЕ КАСКАДНОЕ УДАЛЕНИЕ ПРОЕКТА И ВСЕХ ПРОЕКТНЫХ ДАННЫХ
DEFINE FUNCTION OVERWRITE fn::delete_project_cascade($name: string) {
    LET $clean = string::replace(string::replace(string::replace($name, 'projects:', ''), '⟨', ''), '⟩', '');
    LET $p_rec = type::record('projects', $clean);
    
    -- 1. Иерархия, связи и участие
    DELETE contains WHERE in = $p_rec OR out = $p_rec;
    DELETE entity_rel WHERE project_id = $p_rec;
    DELETE appears_in WHERE project_id = $p_rec;
    DELETE participates_in WHERE project_id = $p_rec;
    DELETE revealed_in WHERE project_id = $p_rec;
    DELETE arc_entities WHERE project_id = $p_rec;
    DELETE arc_chapters WHERE project_id = $p_rec;
    DELETE story_arcs WHERE project_id = $p_rec;
    DELETE entity_revisions WHERE project_id = $p_rec;
    DELETE entity_rel_revisions WHERE project_id = $p_rec;
    DELETE tags WHERE project_id = $p_rec;

    -- 2. Сущности лора
    DELETE entities WHERE project_id = $p_rec;

    -- 3. Блоки текста, ревизии, главы и тома рукописи
    DELETE text_blocks WHERE project_id = $p_rec;
    DELETE chapter_revisions WHERE project_id = $p_rec;
    DELETE chapters WHERE project_id = $p_rec;
    DELETE volumes WHERE project_id = $p_rec;

    -- 4. Планирование, таймлайн и сюжетные обещания
    DELETE plans WHERE project_id = $p_rec;
    DELETE plot_promises WHERE project_id = $p_rec;
    DELETE timeline_events WHERE project_id = $p_rec;

    -- 5. Сам проект (триггерит cascade_project_delete и cascade_project_ai_delete если Ultra включена)
    DELETE projects WHERE id = $p_rec OR name = $name OR name = $clean;
    
    RETURN true;
};


