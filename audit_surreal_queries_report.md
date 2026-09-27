# 📊 Production Аудит Inline SurrealQL (Без Тестов)

> **Всего найдено немигрированных SQL-блоков в Rust:** 0

## 📋 Сводка по категориям

- **⚡ Комплексная графовая/бизнес-логика (Кандидаты в Stored Functions fn::* — SDB-007)**: 0 мест
- **🔥 Каскадные удаления (Кандидаты в DDL EVENT — SDB-008)**: 0 мест
- **📦 Инлайн CRUD-запросы**: 0 мест

---

## 🚀 Все запросы переведены на хранимые функции и DDL события

### 📌 Реестр вынесенных хранимых функций (`logic/schema/no_ai/04_functions.surql`):
1. `fn::get_cross_reference_matrix($proj)` — сбор матрицы участий сущностей по главам
2. `fn::get_timeline_inspector_data($proj)` — сбор хронологических связей и сюжетных ружей
3. `fn::get_graph_time_slice($proj)` — временной срез графа связей
4. `fn::get_character_journey($proj, $entity)` — сбор полного пути персонажа (появления, события, связи, обещания)
5. `fn::sync_chapter_mentions($chap, $names)` — атомарная очистка и RELATE mentions в главе
6. `fn::get_chapter_hierarchy($proj)` — выборка томов, глав и связей contains в один вызов
7. `fn::create_volume_node($proj, $title, $order)` — создание тома и привязка к проекту
8. `fn::assign_chapter_node($parent, $chap)` — перемещение главы между томами/проектом
9. `fn::create_entity_relation(...)` — создание типизированного ребра связи сущностей
10. `fn::get_entity_connections($proj, $chap)` — выборка ребер графа связей
11. `fn::save_entity_connections($proj, $src, $connections)` — пакетное сохранение связей
12. `fn::remove_entity_connections($src)` — удаление всех связей сущности
13. `fn::get_projects_list()` — список всех проектов
14. `fn::get_project_config($name)` — конфигурация проекта
15. `fn::get_entities_attributes($proj)` — атрибуты сущностей для автопродления
16. `fn::update_entity_attributes($entity, $attrs)` — обновление атрибутов сущности
17. `fn::get_max_volume_sort_order($proj)` — вычисление максимального порядка тома
18. `fn::update_volume_title($vol, $title)` — переименование тома
19. `fn::get_entity_relations($proj, $eid)` — получение связей сущностей
20. `fn::reorder_node($node, $order)` — изменение порядка узла дерева рукописи
21. `fn::get_chapter_revisions($target)` — выборка ревизий главы
22. `fn::toggle_pin($target, $is_pinned)` — закрепление ревизии/схемы
23. `fn::get_schema_history($proj, $tk)` — выборка истории схемы
24. `fn::get_entity_revisions($target)` — выборка ревизий сущности
25. `fn::save_text_blocks($proj, $chap, $blocks)` — пакетное сохранение семантических текстовых блоков
26. `fn::save_global_timeline($proj, $items)` — пакетное сохранение глобального таймлайна глав
27. `fn::get_relation_schemas($proj)` — выборка схем связей проекта
28. `fn::delete_relation_schema($proj, $rel_key)` — каскадное удаление схемы связи
29. `fn::get_entity_schemas($proj)` — выборка схем сущностей проекта
30. `fn::find_entity_schema_id($proj, $tk)` — поиск ID схемы по ключу типа
31. `fn::record_schema_history(...)` — ротация и снимок истории схемы
32. `fn::save_entity_schema(...)` — сохранение/UPSERT схемы сущности
33. `fn::delete_entity_schema($proj, $tk)` — каскадное удаление схемы сущностей
34. `fn::get_entities($proj, $et)` — выборка сущностей с опциональной фильтрацией по типу
35. `fn::save_entity(...)` — создание/UPSERT сущности лора
36. `fn::search_entities($proj, $q, $et)` — полнотекстовый поиск сущностей
37. `fn::get_entities_batch($proj, $types)` — пакетное получение сущностей по типам
38. `fn::batch_save_entity_with_relations(...)` — пакетное сохранение сущности со связанными
39. `fn::batch_upsert_connections($proj, $src, $conns)` — пакетный UPSERT ребер связей

### 🔥 DDL Каскады и события (`03_events.surql` / `05_events.surql`):
- `cascade_project_delete` — атомарная каскадная очистка всех таблиц проекта
- `cascade_volume_delete` — очистка содержимого тома
- `cascade_chapter_delete` — очистка блоков, ревизий, связей и обещаний главы
- `cascade_entity_delete` — очистка связей, участий и ревизий сущности
- `cascade_chat_delete` — рекурсивное удаление веток чата и сообщений
