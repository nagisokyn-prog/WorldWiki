-- 05_REVISIONS_AND_BLOCKS.SURQL — РЕВИЗИИ И ТЕКСТОВЫЕ БЛОКИ


-- 21. ПОЛУЧЕНИЕ РЕВИЗИЙ ГЛАВЫ
DEFINE FUNCTION OVERWRITE fn::get_chapter_revisions($target: record<chapters>) {
    RETURN (SELECT id, target_id, title, content, created_at, is_pinned, order_index FROM chapter_revisions WHERE target_id = $target ORDER BY created_at DESC LIMIT 100);
};

-- 22. ЗАКРЕПЛЕНИЕ/ОТКРЕПЛЕНИЕ РЕВИЗИИ ИЛИ ИСТОРИИ
DEFINE FUNCTION OVERWRITE fn::toggle_pin($target: record, $is_pinned: bool) {
    UPDATE $target SET is_pinned = $is_pinned;
};

-- 23. ПОЛУЧЕНИЕ ИСТОРИИ СХЕМЫ СУЩНОСТЕЙ
DEFINE FUNCTION OVERWRITE fn::get_schema_history($proj: record<projects>, $tk: string) {
    LET $p_rec = type::record('projects', type::string($proj).replace('projects:', ''));
    RETURN (SELECT id, schema_id, project_id, type_key, snapshot, saved_at, is_pinned FROM schema_history WHERE project_id = $p_rec AND type_key = $tk ORDER BY saved_at DESC LIMIT 100);
};

-- 24. ПОЛУЧЕНИЕ РЕВИЗИЙ СУЩНОСТИ
DEFINE FUNCTION OVERWRITE fn::get_entity_revisions($target: record<entities>) {
    RETURN (SELECT id, target_id, name, entity_type, attributes, created_at, is_pinned FROM entity_revisions WHERE target_id = $target ORDER BY created_at DESC LIMIT 100);
};

-- 25. СОХРАНЕНИЕ СЕМАНТИЧЕСКИХ ТЕКСТОВЫХ БЛОКОВ ГЛАВЫ
DEFINE FUNCTION OVERWRITE fn::save_text_blocks(
    $proj: record<projects>,
    $chap: record<chapters>,
    $blocks: array<object>
) {
    LET $p_rec = type::record('projects', type::string($proj).replace('projects:', ''));
    DELETE text_blocks WHERE chapter_id = $chap AND project_id = $p_rec;

    INSERT INTO text_blocks (
        SELECT 
            $p_rec AS project_id, 
            $chap AS chapter_id, 
            block_type, 
            order_index, 
            content 
        FROM $blocks
    );
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

    LET $unpinned = (SELECT id, saved_at FROM schema_history WHERE schema_id = $schema_id AND is_pinned = false ORDER BY saved_at DESC LIMIT 200);
    IF array::len($unpinned) > $max_limit {
        LET $to_delete = array::slice($unpinned, $max_limit, array::len($unpinned));
        DELETE $to_delete;
    };
};
