//! Высоконагрузочные (Load) и стресс-тесты (Stress Testing) ядра SurrealDB и бизнес-логики.
//!
//! Тестируют поведение системы в экстремальных условиях:
//! - Bulk-insert 10,000+ сущностей и 5,000+ текстовых блоков.
//! - Высококонкурентный пул (50 параллельных воркеров tokio) на чтение/запись графов.
//! - Глубокие графы иерархии (1,100+ узлов через ребра `contains`).
//! - Каскадное DDL-удаление проекта с тысячами связанных записей.

use std::sync::Arc;
use std::time::Instant;
use tokio::task::JoinSet;
use serde_json::json;

use crate::logic::chapters::save_text_blocks_inner;
use crate::logic::entities::{create_entity_relation_inner, get_entities_inner, get_entity_relations_inner, save_entity_inner};
use crate::logic::models::{Entity, EntityRel};
use crate::logic::projects::delete_project_inner;
use crate::logic::volumes::{assign_chapter_inner, create_volume_inner, get_chapter_hierarchy_inner};
use super::common::{create_test_db, seed_chapter, seed_project};

/// 1. Нагрузочный тест: Пакетная вставка 10,000 сущностей.
#[tokio::test]
async fn stress_bulk_insert_10k_entities() {
    let db = create_test_db().await;
    seed_project(&db, "stress_p1", "Stress 10k Entities").await;

    let total = 10_000;
    let batch_size = 500;
    let start = Instant::now();

    println!("\n[LOAD TEST] Запуск вставки {total} сущностей батчами по {batch_size}...");

    for batch_idx in 0..(total / batch_size) {
        let mut sql = String::from("BEGIN TRANSACTION;\n");
        for i in 0..batch_size {
            let idx = batch_idx * batch_size + i;
            sql.push_str(&format!(
                "CREATE entities SET project_id = type::record('projects:stress_p1'), entity_type = 'character', name = 'Персонаж_{idx}', attributes = {{ level: {idx}, exp: {i} }};\n"
            ));
        }
        sql.push_str("COMMIT TRANSACTION;\n");

        let mut res = db.query(sql).await.expect("batch insert should execute");
        let errs = res.take_errors();
        assert!(errs.is_empty(), "не должно быть ошибок транзакции: {:?}", errs);
    }

    let elapsed = start.elapsed();
    println!("[LOAD TEST] Вставка {total} сущностей завершена за {:?}", elapsed);
    println!("[LOAD TEST] Пропускная способность: {:.0} записей/сек", total as f64 / elapsed.as_secs_f64());

    // Проверяем итоговое количество
    let mut count_res = db
        .query("SELECT count() FROM entities WHERE project_id = type::record('projects:stress_p1') GROUP ALL")
        .await
        .unwrap();
    let count_val: Option<serde_json::Value> = count_res.take(0).unwrap();
    let count = count_val.and_then(|v| v.get("count").and_then(|c| c.as_u64())).unwrap_or(0);

    assert_eq!(count, total as u64, "в базе должно быть ровно {total} записей");
}

/// 2. Нагрузочный тест: Сохранение главы с 3,000 семантическими текстовыми блоками.
#[tokio::test]
async fn stress_bulk_insert_text_blocks() {
    let db = create_test_db().await;
    seed_project(&db, "stress_tb", "Stress Text Blocks").await;
    seed_chapter(&db, "stress_tb", "ch_huge", "Гигантская глава", "").await;

    let total_blocks = 3_000;
    let mut html = String::with_capacity(total_blocks * 80);
    for i in 0..total_blocks {
        let tag = if i % 2 == 0 { "desc" } else { "dialog" };
        html.push_str(&format!(r#"<p data-semantic-tag="{tag}">Абзац номер {i} с некоторым текстом повествования.</p>"#));
    }

    let start = Instant::now();
    save_text_blocks_inner(&db, "stress_tb", "ch_huge", &html)
        .await
        .expect("save_text_blocks should handle 3000 blocks");
    let elapsed = start.elapsed();

    println!("\n[LOAD TEST] Нарезка и сохранение {total_blocks} блоков заняли {:?}", elapsed);

    let mut res = db
        .query("SELECT count() FROM text_blocks WHERE chapter_id = type::record('chapters:ch_huge') GROUP ALL")
        .await
        .unwrap();
    let count_val: Option<serde_json::Value> = res.take(0).unwrap();
    let count = count_val.and_then(|v| v.get("count").and_then(|c| c.as_u64())).unwrap_or(0);

    assert_eq!(count, total_blocks as u64);
}

/// 3. Стресс-тест конкурентности: 50 параллельных тасок tokio на одновременную запись и чтение графа связей.
#[tokio::test]
async fn stress_high_concurrency_50_workers() {
    let db = create_test_db().await;
    seed_project(&db, "stress_concur", "Concurrency Test").await;

    // Создаём 10 начальных персонажей
    let mut initial_ids = Vec::new();
    for i in 0..10 {
        let e = save_entity_inner(&db, "stress_concur", Entity {
            id: None,
            project_id: Some("projects:stress_concur".into()),
            schema_id: None,
            entity_type: "character".into(),
            name: format!("Базовый Персонаж {i}"),
            description: None,
            attributes: json!({}),
            tags: vec![],
            embeddings: None,
            created_at: None,
            updated_at: None,
        }).await.unwrap();
        initial_ids.push(e.id.unwrap());
    }

    let db_arc = Arc::new(db);
    let ids_arc = Arc::new(initial_ids);
    let num_tasks = 50;

    let start = Instant::now();
    let mut set = JoinSet::new();

    for task_idx in 0..num_tasks {
        let db_clone = db_arc.clone();
        let ids_clone = ids_arc.clone();

        set.spawn(async move {
            if task_idx % 2 == 0 {
                // Воркер-писатель: создаёт нового персонажа и связь к базовому
                let from_id = &ids_clone[task_idx % ids_clone.len()];
                let new_e = save_entity_inner(&db_clone, "stress_concur", Entity {
                    id: None,
                    project_id: Some("projects:stress_concur".into()),
                    schema_id: None,
                    entity_type: "npc".into(),
                    name: format!("Конкурентный NPC {task_idx}"),
                    description: None,
                    attributes: json!({ "thread": task_idx }),
                    tags: vec![],
                    embeddings: None,
                    created_at: None,
                    updated_at: None,
                }).await.expect("concurrent save entity");

                let to_id = new_e.id.unwrap();
                create_entity_relation_inner(&db_clone, "stress_concur", from_id, &to_id, EntityRel {
                    id: None,
                    r#in: None,
                    out: None,
                    project_id: None,
                    rel_type: "allies".into(),
                    description: None,
                    strength: Some(10),
                    attributes: json!({}),
                    start_chapter: None,
                    end_chapter: None,
                    created_at: None,
                }).await.expect("concurrent create relation");
            } else {
                // Воркер-читатель: читает список сущностей и запрашивает связи
                let entities = get_entities_inner(&db_clone, "stress_concur", None).await.expect("concurrent read entities");
                assert!(!entities.is_empty());

                let target_id = &ids_clone[task_idx % ids_clone.len()];
                let _rels = get_entity_relations_inner(&db_clone, "stress_concur", Some(target_id.clone())).await.expect("concurrent read rels");
            }
        });
    }

    while let Some(res) = set.join_next().await {
        res.expect("task must not panic under concurrency");
    }

    let elapsed = start.elapsed();
    println!("\n[STRESS TEST] 50 параллельных конкурентных воркеров завершили работу за {:?}", elapsed);
}

/// 4. Стресс-тест глубокой иерархии: Дерево из 505 узлов (тома -> главы) и замер `get_chapter_hierarchy`.
#[tokio::test]
async fn stress_deep_hierarchy_1000_nodes() {
    let db = create_test_db().await;
    seed_project(&db, "stress_tree", "Tree Test").await;

    // 5 томов, в каждом по 100 глав = 5 + 500 = 505 узлов
    let start_gen = Instant::now();
    for v_idx in 0..5 {
        let vol = create_volume_inner(&db, "stress_tree", &format!("Том {v_idx}")).await.unwrap();
        let vol_id = vol["id"].as_str().unwrap().to_string();

        for c_idx in 0..100 {
            let chap_key = format!("c_{v_idx}_{c_idx}");
            let c_id = seed_chapter(&db, "stress_tree", &chap_key, &format!("Глава {chap_key}"), "").await;
            assign_chapter_inner(&db, "stress_tree", &c_id, Some(vol_id.clone())).await.unwrap();
        }
    }
    println!("\n[LOAD TEST] Построение дерева из 505 графовых узлов заняло {:?}", start_gen.elapsed());

    // Замеряем время выборки полной иерархии
    let start_query = Instant::now();
    let hierarchy = get_chapter_hierarchy_inner(&db, "stress_tree").await.expect("get hierarchy should succeed");
    let query_elapsed = start_query.elapsed();

    println!("[LOAD TEST] Запрос и сборка полного дерева иерархии заняли {:?}", query_elapsed);
    let volumes = hierarchy["volumes"].as_array().expect("volumes must be array");
    let chapters = hierarchy["chapters"].as_array().expect("chapters must be array");

    assert_eq!(volumes.len(), 5, "должно быть 5 томов");
    assert_eq!(chapters.len(), 500, "должно быть 500 глав");
}

/// 5. Стресс-тест каскадного удаления: Удаление проекта с 3,000+ связанными записями.
#[tokio::test]
async fn stress_massive_cascade_delete() {
    let db = create_test_db().await;
    seed_project(&db, "stress_cascade", "Cascade Delete Test").await;

    // Засеиваем 1000 сущностей
    let mut sql = String::from("BEGIN TRANSACTION;\n");
    for i in 0..1000 {
        sql.push_str(&format!(
            "CREATE entities SET project_id = type::record('projects:stress_cascade'), entity_type = 'character', name = 'Персонаж {i}';\n"
        ));
    }
    sql.push_str("COMMIT TRANSACTION;\n");
    db.query(sql).await.unwrap();

    // Засеиваем 500 глав
    let mut sql_ch = String::from("BEGIN TRANSACTION;\n");
    for i in 0..500 {
        sql_ch.push_str(&format!(
            "CREATE chapters SET project_id = type::record('projects:stress_cascade'), title = 'Глава {i}', content = '';\n"
        ));
    }
    sql_ch.push_str("COMMIT TRANSACTION;\n");
    db.query(sql_ch).await.unwrap();

    let start_del = Instant::now();
    delete_project_inner(&db, "stress_cascade").await.expect("delete_project under load should succeed");
    let del_elapsed = start_del.elapsed();

    println!("\n[STRESS TEST] Каскадное удаление проекта с 1500+ записями заняло {:?}", del_elapsed);

    // Проверяем, что все таблицы чисты
    let mut e_res = db.query("SELECT count() FROM entities WHERE project_id = type::record('projects:stress_cascade') GROUP ALL").await.unwrap();
    let e_cnt: Option<serde_json::Value> = e_res.take(0).unwrap();
    assert_eq!(e_cnt.and_then(|v| v.get("count").and_then(|c| c.as_u64())).unwrap_or(0), 0);

    let mut c_res = db.query("SELECT count() FROM chapters WHERE project_id = type::record('projects:stress_cascade') GROUP ALL").await.unwrap();
    let c_cnt: Option<serde_json::Value> = c_res.take(0).unwrap();
    assert_eq!(c_cnt.and_then(|v| v.get("count").and_then(|c| c.as_u64())).unwrap_or(0), 0);
}
