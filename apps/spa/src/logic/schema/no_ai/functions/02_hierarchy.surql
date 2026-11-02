-- 02_HIERARCHY.SURQL — ИЕРАРХИЯ ГЛАВ И ТОМОВ РУКОПИСИ


-- 6. СБОР ПОЛНОЙ ИЕРАРХИИ ГЛАВ И ТОМОВ ПРОЕКТА
DEFINE FUNCTION OVERWRITE fn::get_chapter_hierarchy($proj: any) {
    LET $p_rec = fn::normalize_project_id($proj);
    LET $volumes = (SELECT id, project_id, title FROM volumes WHERE project_id = $p_rec LIMIT 500);
    LET $chapters = (SELECT id, volume_id, title, sort_order, content, word_count, created_at, updated_at FROM chapters WHERE volume_id.project_id = $p_rec OR project_id = $p_rec LIMIT 1000);
    LET $vol_ids = (SELECT VALUE id FROM $volumes LIMIT 500);
    LET $chap_ids = (SELECT VALUE id FROM $chapters LIMIT 1000);
    LET $relations = (
        SELECT in, out, sort_order FROM contains 
        WHERE out IN $vol_ids OR out IN $chap_ids
        LIMIT 2000
    );
    RETURN {
        volumes: $volumes,
        chapters: $chapters,
        relations: $relations
    };
};

-- 7. СОЗДАНИЕ УЗЛА ТОМА И ПРИВЯЗКА К ПРОЕКТУ
DEFINE FUNCTION OVERWRITE fn::create_volume_node($proj: any, $title: string, $order: number) {
    LET $p_rec = fn::normalize_project_id($proj);
    LET $vol = (CREATE volumes SET project_id = $p_rec, title = $title RETURN VALUE id)[0];
    RELATE $p_rec -> contains -> $vol SET sort_order = $order;
    LET $res = (SELECT id, title, project_id, $order AS sort_order FROM $vol LIMIT 1);
    RETURN $res[0];
};

-- 8. ПЕРЕМЕЩЕНИЕ/ПРИВЯЗКА ГЛАВЫ К ТОМУ ИЛИ ПРОЕКТУ
DEFINE FUNCTION OVERWRITE fn::assign_chapter_node($parent: record<projects> | record<volumes>, $chap: record<chapters>) {
    DELETE contains WHERE out = $chap;
    RELATE $parent -> contains -> $chap SET sort_order = 9999;
    IF string::starts_with(type::string($parent), 'volumes') {
        UPDATE $chap SET volume_id = $parent;
    };
};

-- 17. МАКСИМАЛЬНЫЙ ПОРЯДОК СОРТИРОВКИ ТОМОВ
DEFINE FUNCTION OVERWRITE fn::get_max_volume_sort_order($proj: any) {
    LET $p_rec = fn::normalize_project_id($proj);
    LET $res = (SELECT sort_order FROM contains WHERE in = $p_rec ORDER BY sort_order DESC LIMIT 1);
    RETURN IF array::len($res) > 0 AND $res[0].sort_order != NONE { $res[0].sort_order } ELSE { -1 };
};

-- 18. ОБНОВЛЕНИЕ ЗАГОЛОВКА ТОМА
DEFINE FUNCTION OVERWRITE fn::update_volume_title($vol: record<volumes>, $title: string) {
    UPDATE $vol SET title = $title;
};

-- 20. ПЕРЕМЕЩЕНИЕ/ИЗМЕНЕНИЕ ПОРЯДКА УЗЛА
DEFINE FUNCTION OVERWRITE fn::reorder_node($node: record<chapters> | record<volumes>, $order: number) {
    UPDATE contains SET sort_order = $order WHERE out = $node;
};

-- 21. ПОЛУЧЕНИЕ ГЛАВЫ ПО ID
DEFINE FUNCTION OVERWRITE fn::get_chapter($id: any) {
    LET $c_rec = IF string::starts_with(type::string($id), 'chapters:') { type::record($id) } ELSE { type::record('chapters', $id) };
    LET $res = (SELECT id, volume_id, title, content, sort_order, word_count FROM $c_rec LIMIT 1);
    RETURN IF array::len($res) > 0 { $res[0] } ELSE { NONE };
};

-- 22. СОХРАНЕНИЕ / ОБНОВЛЕНИЕ ГЛАВЫ
DEFINE FUNCTION OVERWRITE fn::save_chapter(
    $id: any,
    $vol_id: any,
    $title: string,
    $content: string,
    $sort_order: int,
    $word_count: int
) {
    LET $c_rec = IF string::starts_with(type::string($id), 'chapters:') { type::record($id) } ELSE { type::record('chapters', $id) };
    LET $v_rec = IF string::starts_with(type::string($vol_id), 'volumes:') { type::record($vol_id) } ELSE { type::record('volumes', $vol_id) };
    LET $res = (
        UPSERT $c_rec SET
            title = $title,
            content = $content,
            volume_id = $v_rec,
            sort_order = $sort_order,
            word_count = $word_count,
            updated_at = time::now()
    );
    RETURN IF array::len($res) > 0 { $res[0] } ELSE { NONE };
};

-- 23. УДАЛЕНИЕ ГЛАВЫ
DEFINE FUNCTION OVERWRITE fn::delete_chapter($id: any) {
    LET $c_rec = IF string::starts_with(type::string($id), 'chapters:') { type::record($id) } ELSE { type::record('chapters', $id) };
    DELETE $c_rec;
};

-- 24. СПИСОК ГЛАВ ПРОЕКТА
DEFINE FUNCTION OVERWRITE fn::list_chapters_by_project($proj: any) {
    LET $p_rec = fn::normalize_project_id($proj);
    RETURN (SELECT id, volume_id, title, sort_order, word_count FROM chapters WHERE volume_id.project_id = $p_rec ORDER BY sort_order ASC LIMIT 1000);
};

-- 25. СПИСОК ГЛАВ ТОМА
DEFINE FUNCTION OVERWRITE fn::list_chapters_by_volume($vol: any) {
    LET $v_rec = IF string::starts_with(type::string($vol), 'volumes:') { type::record($vol) } ELSE { type::record('volumes', $vol) };
    RETURN (SELECT id, volume_id, title, sort_order, word_count FROM chapters WHERE volume_id = $v_rec ORDER BY sort_order ASC LIMIT 500);
};

-- 26. ПОЛУЧЕНИЕ ТОМА ПО ID
DEFINE FUNCTION OVERWRITE fn::get_volume($id: any) {
    LET $v_rec = IF string::starts_with(type::string($id), 'volumes:') { type::record($id) } ELSE { type::record('volumes', $id) };
    LET $res = (SELECT id, project_id, title FROM $v_rec LIMIT 1);
    RETURN IF array::len($res) > 0 { $res[0] } ELSE { NONE };
};

-- 27. СОХРАНЕНИЕ / ОБНОВЛЕНИЕ ТОМА
DEFINE FUNCTION OVERWRITE fn::save_volume($id: any, $proj: any, $title: string) {
    LET $v_rec = IF string::starts_with(type::string($id), 'volumes:') { type::record($id) } ELSE { type::record('volumes', $id) };
    LET $p_rec = fn::normalize_project_id($proj);
    LET $res = (
        UPSERT $v_rec SET
            title = $title,
            project_id = $p_rec
    );
    RETURN IF array::len($res) > 0 { $res[0] } ELSE { NONE };
};

-- 28. УДАЛЕНИЕ ТОМА
DEFINE FUNCTION OVERWRITE fn::delete_volume($id: any) {
    LET $v_rec = IF string::starts_with(type::string($id), 'volumes:') { type::record($id) } ELSE { type::record('volumes', $id) };
    DELETE $v_rec;
};

-- 29. СПИСОК ТОМОВ ПРОЕКТА
DEFINE FUNCTION OVERWRITE fn::list_volumes_by_project($proj: any) {
    LET $p_rec = fn::normalize_project_id($proj);
    RETURN (SELECT id, project_id, title FROM volumes WHERE project_id = $p_rec LIMIT 100);
};
