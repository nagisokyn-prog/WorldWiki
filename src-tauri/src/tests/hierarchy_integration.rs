//! Интеграционные тесты иерархии сюжета (Тома и Главы).
//!
//! Тестируют бизнес-логику управления иерархией через графовые рёбра `contains`
//! поверх реальной in-memory SurrealDB + схемы `surreal_schema.surql`.

use crate::logic::volumes::*;
use super::common::{create_test_db, seed_project, seed_chapter};

#[tokio::test]
async fn create_volume_creates_node_and_contains_edge() {
    let db = create_test_db().await;
    seed_project(&db, "p1", "Project 1").await;

    let res = create_volume_inner(&db, "p1", "Том 1: Начало")
        .await
        .expect("create volume should succeed");

    assert_eq!(res["title"], "Том 1: Начало");
    assert_eq!(res["sort_order"], 0);

    let vol_id = res["id"].as_str().expect("volume has id");

    // Проверяем наличие ребра `projects:p1 -> contains -> volumes:...`
    let mut edge_res = db
        .query("SELECT in, out, sort_order FROM contains WHERE in = type::record('projects:p1')")
        .await
        .expect("query contains edge");
    let edges: Vec<serde_json::Value> = edge_res.take(0).expect("take edges");
    assert_eq!(edges.len(), 1);
    assert_eq!(edges[0]["out"], vol_id);
    assert_eq!(edges[0]["sort_order"], 0);
}

#[tokio::test]
async fn create_multiple_volumes_increments_sort_order() {
    let db = create_test_db().await;
    seed_project(&db, "p1", "Project 1").await;

    let v1 = create_volume_inner(&db, "p1", "Том 1").await.unwrap();
    let v2 = create_volume_inner(&db, "p1", "Том 2").await.unwrap();
    let v3 = create_volume_inner(&db, "p1", "Том 3").await.unwrap();

    assert_eq!(v1["sort_order"], 0);
    assert_eq!(v2["sort_order"], 1);
    assert_eq!(v3["sort_order"], 2);
}

#[tokio::test]
async fn full_hierarchy_roundtrip() {
    let db = create_test_db().await;
    seed_project(&db, "p1", "Project 1").await;

    let vol = create_volume_inner(&db, "p1", "Том 1").await.unwrap();
    let vol_id = vol["id"].as_str().unwrap().to_string();

    let ch1_id = seed_chapter(&db, "p1", "ch1", "Глава 1", "контент 1").await;
    let ch2_id = seed_chapter(&db, "p1", "ch2", "Глава 2", "контент 2").await;

    // Привязываем обе главы к тому 1
    assign_chapter_inner(&db, "p1", &ch1_id, Some(vol_id.clone())).await.unwrap();
    assign_chapter_inner(&db, "p1", &ch2_id, Some(vol_id.clone())).await.unwrap();

    // Запрашиваем полную иерархию
    let hierarchy = get_chapter_hierarchy_inner(&db, "p1")
        .await
        .expect("get_chapter_hierarchy should succeed");

    let volumes = hierarchy["volumes"].as_array().unwrap();
    let chapters = hierarchy["chapters"].as_array().unwrap();

    assert_eq!(volumes.len(), 1);
    assert_eq!(chapters.len(), 2);

    // Проверяем, что у обеих глав volume_id указывает на vol_id
    let ch1 = chapters.iter().find(|c| c["title"] == "Глава 1").unwrap();
    let ch2 = chapters.iter().find(|c| c["title"] == "Глава 2").unwrap();

    assert_eq!(ch1["volume_id"], vol_id);
    assert_eq!(ch2["volume_id"], vol_id);
}

#[tokio::test]
async fn assign_chapter_switches_parent_cleanly() {
    let db = create_test_db().await;
    seed_project(&db, "p1", "Project 1").await;
    let ch_id = seed_chapter(&db, "p1", "ch1", "Глава 1", "Текст главы").await;

    let v1 = create_volume_inner(&db, "p1", "Том 1").await.unwrap();
    let v1_id = v1["id"].as_str().unwrap().to_string();

    let v2 = create_volume_inner(&db, "p1", "Том 2").await.unwrap();
    let v2_id = v2["id"].as_str().unwrap().to_string();

    // 1. Привязываем главу к Тому 1
    assign_chapter_inner(&db, "p1", &ch_id, Some(v1_id.clone()))
        .await
        .expect("assign to volume 1 should succeed");

    let mut e1 = db.query("SELECT in, out FROM contains WHERE out = type::record($ch)")
        .bind(("ch", ch_id.clone()))
        .await.unwrap();
    let edges1: Vec<serde_json::Value> = e1.take(0).unwrap();
    assert_eq!(edges1.len(), 1);
    assert_eq!(edges1[0]["in"], v1_id);

    // 2. Перемещаем главу в Том 2 (старое ребро должно удалиться, новое создаться)
    assign_chapter_inner(&db, "p1", &ch_id, Some(v2_id.clone()))
        .await
        .expect("assign to volume 2 should succeed");

    let mut e2 = db.query("SELECT in, out FROM contains WHERE out = type::record($ch)")
        .bind(("ch", ch_id.clone()))
        .await.unwrap();
    let edges2: Vec<serde_json::Value> = e2.take(0).unwrap();
    assert_eq!(edges2.len(), 1);
    assert_eq!(edges2[0]["in"], v2_id);
}

#[tokio::test]
async fn multiple_volumes_with_chapters() {
    let db = create_test_db().await;
    seed_project(&db, "p1", "Project 1").await;

    // Создаём 2 тома
    let v1 = create_volume_inner(&db, "p1", "Том 1").await.unwrap();
    let v1_id = v1["id"].as_str().unwrap().to_string();

    let _v2 = create_volume_inner(&db, "p1", "Том 2").await.unwrap();

    // Создаём 2 главы
    let ch1_id = seed_chapter(&db, "p1", "ch1", "Глава 1", "контент 1").await;
    let ch2_id = seed_chapter(&db, "p1", "ch2", "Глава 2", "контент 2").await;

    // Привязываем обе главы к тому 1
    assign_chapter_inner(&db, "p1", &ch1_id, Some(v1_id.clone())).await.unwrap();
    assign_chapter_inner(&db, "p1", &ch2_id, Some(v1_id.clone())).await.unwrap();

    // Запрашиваем полную иерархию
    let hierarchy = get_chapter_hierarchy_inner(&db, "p1")
        .await
        .expect("get_chapter_hierarchy should succeed");

    let volumes = hierarchy["volumes"].as_array().unwrap();
    let chapters = hierarchy["chapters"].as_array().unwrap();

    assert_eq!(volumes.len(), 2);
    assert_eq!(chapters.len(), 2);

    // Проверяем, что у обеих глав volume_id указывает на v1_id
    let ch1 = chapters.iter().find(|c| c["title"] == "Глава 1").unwrap();
    let ch2 = chapters.iter().find(|c| c["title"] == "Глава 2").unwrap();

    assert_eq!(ch1["volume_id"], v1_id);
    assert_eq!(ch2["volume_id"], v1_id);
}

#[tokio::test]
async fn update_volume_titles() {
    let db = create_test_db().await;
    seed_project(&db, "p1", "Project 1").await;

    let v1 = create_volume_inner(&db, "p1", "Старое имя тома").await.unwrap();
    let v1_id = v1["id"].as_str().unwrap();

    update_volume_inner(&db, v1_id, "Новое имя тома").await.unwrap();

    let h = get_chapter_hierarchy_inner(&db, "p1").await.unwrap();
    assert_eq!(h["volumes"][0]["title"], "Новое имя тома");
}

#[tokio::test]
async fn reorder_node_updates_sort_order() {
    let db = create_test_db().await;
    seed_project(&db, "p1", "Project 1").await;

    let v1 = create_volume_inner(&db, "p1", "Том 1").await.unwrap();
    let v1_id = v1["id"].as_str().unwrap();
    assert_eq!(v1["sort_order"], 0);

    reorder_node_inner(&db, "p1", "volume", v1_id, 42).await.unwrap();

    let h = get_chapter_hierarchy_inner(&db, "p1").await.unwrap();
    assert_eq!(h["volumes"][0]["sort_order"], 42);
}

#[tokio::test]
async fn update_volume_nonexistent_is_noop_ok() {
    let db = create_test_db().await;

    // UPDATE по несуществующему id — SurrealDB не считает это ошибкой
    let res = update_volume_inner(&db, "volumes:ghost_vol", "Призрачное имя").await;
    assert!(res.is_ok(), "update несуществующего тома → Ok (no-op)");
}

#[tokio::test]
async fn reorder_keeps_sort_order_of_other_nodes() {
    let db = create_test_db().await;
    seed_project(&db, "p1", "Project 1").await;

    let v1 = create_volume_inner(&db, "p1", "Том 1").await.unwrap();
    let v2 = create_volume_inner(&db, "p1", "Том 2").await.unwrap();
    let v3 = create_volume_inner(&db, "p1", "Том 3").await.unwrap();

    // Переносим Том 2 в конец
    assert_eq!(v1["sort_order"].as_i64(), Some(0), "сосед 1 создан в базовом порядке");
    assert_eq!(v3["sort_order"].as_i64(), Some(2), "сосед 3 создан в базовом порядке");
    let v2_id = v2["id"].as_str().unwrap();
    reorder_node_inner(&db, "p1", "volume", v2_id, 10).await.unwrap();

    let h = get_chapter_hierarchy_inner(&db, "p1").await.unwrap();
    let volumes = h["volumes"].as_array().unwrap();

    let order_of = |title: &str| -> i64 {
        volumes.iter()
            .find(|v| v["title"] == title)
            .unwrap()["sort_order"]
            .as_i64()
            .unwrap()
    };

    assert_eq!(order_of("Том 1"), 0, "соседи не должны менять sort_order");
    assert_eq!(order_of("Том 3"), 2, "соседи не должны менять sort_order");
    assert_eq!(order_of("Том 2"), 10);
}

#[tokio::test]
async fn assign_chapter_to_project_root_clears_old_parent_edge() {
    let db = create_test_db().await;
    seed_project(&db, "p1", "Project 1").await;

    let vol = create_volume_inner(&db, "p1", "Том 1").await.unwrap();
    let vol_id = vol["id"].as_str().unwrap().to_string();
    let ch_id = seed_chapter(&db, "p1", "ch_migrate", "Кочующая глава", "").await;

    // Сначала привязываем к тому
    assign_chapter_inner(&db, "p1", &ch_id, Some(vol_id.clone())).await.unwrap();
    // Потом «открепляем» на корень проекта
    assign_chapter_inner(&db, "p1", &ch_id, None).await.unwrap();

    let mut e = db.query("SELECT in FROM contains WHERE out = type::record($ch)")
        .bind(("ch", ch_id.clone()))
        .await.unwrap();
    let edges: Vec<serde_json::Value> = e.take(0).unwrap();

    assert_eq!(edges.len(), 1, "ровно одно ребро после миграции");
    assert_eq!(
        edges[0]["in"], "projects:p1",
        "после открепления родителем становится проект"
    );
}
