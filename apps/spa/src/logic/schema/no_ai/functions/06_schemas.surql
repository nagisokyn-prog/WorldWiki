-- 06_SCHEMAS.SURQL — МЕТА-СХЕМЫ СУЩНОСТЕЙ И СВЯЗЕЙ


-- 27. ПОЛУЧЕНИЕ СХЕМ СВЯЗЕЙ ПРОЕКТА
DEFINE FUNCTION OVERWRITE fn::get_relation_schemas($proj: any) {
    LET $p_rec = fn::normalize_project_id($proj);
    RETURN (SELECT id, project_id, rel_key, rel_name, icon, color, from_types, to_types FROM relation_schemas WHERE project_id = $p_rec LIMIT 1000);
};

-- 28. УДАЛЕНИЕ СХЕМЫ СВЯЗИ И СВЯЗАННЫХ РЕБЕР
DEFINE FUNCTION OVERWRITE fn::delete_relation_schema($proj: any, $rel_key: string) {
    LET $p_rec = fn::normalize_project_id($proj);
    DELETE entity_rel WHERE project_id = $p_rec AND rel_type = $rel_key;
    DELETE relation_schemas WHERE project_id = $p_rec AND rel_key = $rel_key;
};

-- 29. ПОЛУЧЕНИЕ СХЕМ СУЩНОСТЕЙ ПРОЕКТА
DEFINE FUNCTION OVERWRITE fn::get_entity_schemas($proj: any) {
    LET $p_rec = fn::normalize_project_id($proj);
    RETURN (SELECT id, project_id, type_key, type_name, fields_schema, full_schema, created_at FROM entity_schemas WHERE project_id = $p_rec LIMIT 1000);
};

-- 30. ПОИСК ID СХЕМЫ СУЩНОСТИ ПО TYPE_KEY
DEFINE FUNCTION OVERWRITE fn::find_entity_schema_id($proj: any, $tk: string) {
    LET $p_rec = fn::normalize_project_id($proj);
    LET $res = (SELECT id FROM entity_schemas WHERE project_id = $p_rec AND type_key = $tk LIMIT 1);
    RETURN IF array::len($res) > 0 { type::string($res[0].id) } ELSE { NONE };
};

-- 32. СОХРАНЕНИЕ СХЕМЫ СУЩНОСТИ (UPSERT)
DEFINE FUNCTION OVERWRITE fn::save_entity_schema(
    $id: record<entity_schemas>,
    $proj: any,
    $type_key: string,
    $type_name: string,
    $fields_schema: array,
    $full_schema: option<object | null>
) {
    LET $p_rec = fn::normalize_project_id($proj);
    LET $res = (
        UPSERT $id SET 
            project_id = $p_rec,
            type_key = $type_key,
            type_name = $type_name,
            fields_schema = $fields_schema,
            full_schema = $full_schema
    );
    RETURN $res[0];
};

-- 33. КАСКАДНОЕ УДАЛЕНИЕ СХЕМЫ СУЩНОСТЕЙ
DEFINE FUNCTION OVERWRITE fn::delete_entity_schema($proj: record<projects>, $type_key: string) {
    LET $p_rec = fn::normalize_project_id($proj);
    LET $matching_rel_keys = (
        SELECT VALUE rel_key FROM relation_schemas 
        WHERE project_id = $p_rec 
          AND (from_types CONTAINS $type_key OR to_types CONTAINS $type_key)
        LIMIT 1000
    );
    DELETE entity_rel WHERE project_id = $p_rec AND rel_type IN $matching_rel_keys;
    LET $schemas = (
        SELECT VALUE id FROM entity_schemas 
        WHERE project_id = $p_rec AND type_key = $type_key
        LIMIT 100
    );
    DELETE entities WHERE project_id = $p_rec AND schema_id IN $schemas;
    DELETE entity_schemas WHERE project_id = $p_rec AND type_key = $type_key;
};
