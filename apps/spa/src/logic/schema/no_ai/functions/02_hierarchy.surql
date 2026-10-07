-- 02_HIERARCHY.SURQL — ИЕРАРХИЯ ГЛАВ И ТОМОВ РУКОПИСИ


-- 6. СБОР ПОЛНОЙ ИЕРАРХИИ ГЛАВ И ТОМОВ ПРОЕКТА
DEFINE FUNCTION OVERWRITE fn::get_chapter_hierarchy($proj: record<projects>) {
    LET $p_rec = type::record('projects', type::string($proj).replace('projects:', ''));
    LET $volumes = (SELECT id, project_id, title, description, sort_order, created_at, updated_at FROM volumes WHERE project_id = $p_rec LIMIT 500);
    LET $chapters = (SELECT id, project_id, title, order_index, description, content, word_count, is_pinned, created_at, updated_at FROM chapters WHERE project_id = $p_rec LIMIT 1000);
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
DEFINE FUNCTION OVERWRITE fn::create_volume_node($proj: record<projects>, $title: string, $order: int) {
    LET $p_rec = type::record('projects', type::string($proj).replace('projects:', ''));
    LET $vol = (CREATE volumes SET project_id = $p_rec, title = $title RETURN VALUE id)[0];
    RELATE $p_rec -> contains -> $vol SET sort_order = $order;
    LET $res = (SELECT id, title, project_id, $order AS sort_order FROM $vol LIMIT 1);
    RETURN $res[0];
};

-- 8. ПЕРЕМЕЩЕНИЕ/ПРИВЯЗКА ГЛАВЫ К ТОМУ ИЛИ ПРОЕКТУ
DEFINE FUNCTION OVERWRITE fn::assign_chapter_node($parent: record<projects> | record<volumes>, $chap: record<chapters>) {
    DELETE contains WHERE out = $chap;
    RELATE $parent -> contains -> $chap SET sort_order = 9999;
};

-- 17. МАКСИМАЛЬНЫЙ ПОРЯДОК СОРТИРОВКИ ТОМОВ
DEFINE FUNCTION OVERWRITE fn::get_max_volume_sort_order($proj: record<projects>) {
    LET $p_rec = type::record('projects', type::string($proj).replace('projects:', ''));
    LET $res = (SELECT math::max(sort_order) AS max_order FROM contains WHERE in = $p_rec GROUP ALL);
    RETURN IF array::len($res) > 0 AND $res[0].max_order != NONE { $res[0].max_order } ELSE { -1 };
};

-- 18. ОБНОВЛЕНИЕ ЗАГОЛОВКА ТОМА
DEFINE FUNCTION OVERWRITE fn::update_volume_title($vol: record<volumes>, $title: string) {
    UPDATE $vol SET title = $title;
};

-- 20. ПЕРЕМЕЩЕНИЕ/ИЗМЕНЕНИЕ ПОРЯДКА УЗЛА
DEFINE FUNCTION OVERWRITE fn::reorder_node($node: record<chapters> | record<volumes>, $order: int) {
    UPDATE contains SET sort_order = $order WHERE out = $node;
};
