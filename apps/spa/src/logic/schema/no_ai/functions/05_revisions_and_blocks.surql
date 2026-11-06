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
DEFINE FUNCTION OVERWRITE fn::get_schema_history($proj: any, $tk: string) {
    LET $p_rec = fn::normalize_project_id($proj);
    RETURN (SELECT id, schema_id, project_id, type_key, snapshot, saved_at, is_pinned FROM schema_history WHERE project_id = $p_rec AND type_key = $tk ORDER BY saved_at DESC LIMIT 100);
};

-- 24. ПОЛУЧЕНИЕ РЕВИЗИЙ СУЩНОСТИ
DEFINE FUNCTION OVERWRITE fn::get_entity_revisions($target: record<entities>) {
    RETURN (SELECT id, target_id, name, entity_type, attributes, created_at, is_pinned FROM entity_revisions WHERE target_id = $target ORDER BY created_at DESC LIMIT 100);
};

-- 25. СОХРАНЕНИЕ СЕМАНТИЧЕСКИХ ТЕКСТОВЫХ БЛОКОВ ГЛАВЫ (ИДЕМПОТЕНТНЫЙ UPSERT)
DEFINE FUNCTION OVERWRITE fn::save_text_blocks(
    $proj: any,
    $chap: record<chapters>,
    $blocks: array<object>
) {
    -- 1. Извлекаем список активных ID записей
    LET $active_ids = (
        SELECT VALUE IF id != NONE AND id != NULL {
            IF string::starts_with(type::string(id), 'text_blocks:') {
                type::record(id)
            } ELSE {
                type::record('text_blocks', id)
            }
        } ELSE {
            NONE
        }
        FROM $blocks
        WHERE id != NONE AND id != NULL
    );

    -- 2. Обновляем существующие блоки или создаем новые с сохранением их ID и графовых связей
    FOR $b IN $blocks {
        IF $b.id != NONE AND $b.id != NULL {
            LET $bid = IF string::starts_with(type::string($b.id), 'text_blocks:') {
                type::record($b.id)
            } ELSE {
                type::record('text_blocks', $b.id)
            };

            UPSERT $bid SET
                chapter_id = $chap,
                block_type = IF $b.block_type != NONE { $b.block_type } ELSE { 'description' },
                order_index = IF $b.order_index != NONE { type::int($b.order_index) } ELSE { 0 },
                content = IF $b.content != NONE { type::string($b.content) } ELSE { '' },
                created_at = created_at ?? time::now();
        };
    };

    -- 3. Удаляем исключительно те блоки, которые были стёрты из текста рукописи
    IF array::len($active_ids) > 0 {
        DELETE text_blocks WHERE chapter_id = $chap AND id NOT IN $active_ids;
    } ELSE {
        DELETE text_blocks WHERE chapter_id = $chap;
    };
};

-- 26. ПАКЕТНОЕ СОХРАНЕНИЕ ГЛОБАЛЬНОГО ТАЙМЛАЙНА ГЛАВ
DEFINE FUNCTION OVERWRITE fn::save_global_timeline(
    $proj: any,
    $items: array<object>
) {
    FOR $item IN $items {
        IF $item.chapter_id != NONE {
            LET $cid = type::record('chapters', $item.chapter_id);
            UPDATE $cid SET 
                title = IF $item.title != NONE { $item.title } ELSE { title };
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
    LET $p_rec = fn::normalize_project_id($proj);
    CREATE schema_history SET
        schema_id = $schema_id,
        type_key = $type_key,
        project_id = $p_rec,
        snapshot = $snapshot,
        saved_at = time::now(),
        is_pinned = false;

    LET $unpinned = (SELECT id, saved_at FROM schema_history WHERE schema_id = $schema_id AND is_pinned = false ORDER BY saved_at DESC LIMIT 200);
    IF array::len($unpinned) > $max_limit {
        LET $to_delete = array::slice($unpinned, $max_limit, array::len($unpinned));
        DELETE $to_delete;
    };
};
