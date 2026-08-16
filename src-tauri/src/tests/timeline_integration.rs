//! Интеграционные тесты таймлайна.
//!
//! Тестируют бизнес-логику `get_global_timeline` через `Chapter::find_all`
//! поверх реальной in-memory SurrealDB + продовой схемы `surreal_schema.surql`.
//! Каждый тест создаёт изолированную БД и авто-очищается после завершения.

use crate::logic::models::Chapter;
use serde_json::json;
use surreal_domain::SurrealRepository;
use super::common::create_test_db;

/// Хелпер: создаёт проект и возвращает проектный id `projects:<key>`.
async fn seed_project(db: &surrealdb::Surreal<surrealdb::engine::local::Db>, key: &str) {
    db.upsert::<Option<serde_json::Value>>(("projects", key))
        .content(json!({ "name": format!("Project {key}"), "data": {} }))
        .await
        .expect("upsert project should run");
}

/// Хелпер: вставляет главу в проект через сырой SurQL.
async fn create_chapter(
    db: &surrealdb::Surreal<surrealdb::engine::local::Db>,
    project_key: &str,
    title: &str,
    content: &str,
) {
    let sql = format!(
        "CREATE chapters SET project_id = type::record('projects','{project_key}'), title = '{title}', content = '{content}'"
    );
    let mut res = db.query(sql).await.expect("create chapter should run");
    let errs = res.take_errors();
    assert!(errs.is_empty(), "chapter insert errors: {:?}", errs);
}

#[tokio::test]
async fn in_memory_db_ready() {
    let db = create_test_db().await;

    // Вставляем тем же способом, что и продовый create_project: upsert по key.
    db.upsert::<Option<serde_json::Value>>(("projects", "proj1"))
        .content(json!({ "name": "Test Project", "data": {} }))
        .await
        .expect("upsert should run");

    let mut res = db
        .query("SELECT VALUE name FROM projects")
        .await
        .expect("query should run");

    let names: Vec<String> = res.take::<Vec<String>>(0).expect("take name");
    assert_eq!(names, vec!["Test Project"]);
}

#[tokio::test]
async fn get_global_timeline_returns_chapters_for_project() {
    let db = create_test_db().await;
    seed_project(&db, "p1").await;
    create_chapter(&db, "p1", "Intro", "Первая глава").await;
    create_chapter(&db, "p1", "Epilogue", "Последняя глава").await;

    // `get_global_timeline` в chapters.rs — это `json!(Chapter::find_all(...))`.
    let chapters = Chapter::find_all(&db, "projects:p1")
        .await
        .expect("find_all should succeed");

    assert_eq!(chapters.len(), 2, "должно найтись ровно 2 главы");
    let titles: Vec<String> = chapters.iter().map(|c| c.title.clone()).collect();
    assert!(titles.contains(&"Intro".into()));
    assert!(titles.contains(&"Epilogue".into()));
}

#[tokio::test]
async fn get_global_timeline_is_project_scoped() {
    let db = create_test_db().await;
    seed_project(&db, "p1").await;
    seed_project(&db, "p2").await;
    create_chapter(&db, "p1", "P1 Ch1", "a").await;
    create_chapter(&db, "p2", "P2 Ch1", "b").await;
    create_chapter(&db, "p1", "P1 Ch2", "c").await;

    let p1 = Chapter::find_all(&db, "projects:p1")
        .await
        .expect("find_all p1");
    let p2 = Chapter::find_all(&db, "projects:p2")
        .await
        .expect("find_all p2");

    assert_eq!(p1.len(), 2, "две главы только для p1");
    assert_eq!(p2.len(), 1, "одна глава только для p2");
}

#[tokio::test]
async fn get_global_timeline_empty_when_no_chapters() {
    let db = create_test_db().await;
    seed_project(&db, "empty").await;

    let chapters = Chapter::find_all(&db, "projects:empty")
        .await
        .expect("find_all for empty project");
    assert!(chapters.is_empty(), "без глав — пустой массив");
}

#[tokio::test]
async fn delete_project_cascades_chapters() {
    let db = create_test_db().await;
    seed_project(&db, "p1").await;
    create_chapter(&db, "p1", "Intro", "a").await;
    create_chapter(&db, "p1", "Epilogue", "b").await;

    assert_eq!(
        Chapter::find_all(&db, "projects:p1").await.expect("pre").len(),
        2
    );

    // DDL-событиe `cascade_project_delete` должно удалить все главы проекта.
    db.query("DELETE FROM projects WHERE id = type::record('projects','p1')")
        .await
        .expect("delete project");

    let chapters = Chapter::find_all(&db, "projects:p1")
        .await
        .expect("find_all post-delete");
    assert!(chapters.is_empty(), "после удаления проекта главы исчезли");
}

/// Контрактный тест: `save_global_timeline` пишет `timeline_events`/
/// `participants` в главы, а `get_global_timeline` (через `Chapter::find_all`)
/// читает их обратно — roundtrip save→get для frontend-контракта
/// `calendar.api.saveGlobalTimeline` / `getGlobalTimeline`.
#[tokio::test]
async fn save_global_timeline_roundtrip() {
    let db = create_test_db().await;
    seed_project(&db, "p1").await;

    // Создаём главу с известным record-id, чтобы save_global_timeline мог
    // апсертить по тому же id (как делает frontend, передавая chapter_id).
    db.query("CREATE chapters:ch1 SET project_id = type::record('projects','p1'), title = 'Intro', content = 'a'")
        .await
        .expect("create chapter ch1 should run");

    let timeline: serde_json::Value = json!([{
        "chapter_id": "chapters:ch1",
        "chapter_title": "Intro",
                "events": [{"id": "e1", "date": "2024-01-01"}],
        "participants": ["character:c1", "character:c2"]
    }]);

    let res = Chapter::save_global_timeline_inner(&db, "p1", timeline)
        .await
        .expect("save_global_timeline should succeed");
    assert_eq!(res["success"], true);
    assert_eq!(res["updated"], 1);

    // get_global_timeline core = Chapter::find_all
    let chapters = Chapter::find_all(&db, "projects:p1")
        .await
        .expect("find_all should succeed");
    assert_eq!(chapters.len(), 1, "одна глава для p1");

    let ev = chapters[0]
        .timeline_events
        .as_ref()
        .expect("timeline_events was saved")
        .as_array()
        .expect("timeline_events is array");
    assert_eq!(ev.len(), 1);
    assert_eq!(ev[0]["date"], json!("2024-01-01"));

        assert_eq!(
        chapters[0].participants.as_deref(),
        Some(&["character:c1".to_string(), "character:c2".to_string()][..])
    );
}

