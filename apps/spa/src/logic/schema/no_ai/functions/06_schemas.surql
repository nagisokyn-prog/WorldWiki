-- 06_SCHEMAS.SURQL — МЕТА-СХЕМЫ СУЩНОСТЕЙ И СВЯЗЕЙ


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
