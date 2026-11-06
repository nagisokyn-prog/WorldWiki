//! Интеграционные тесты таймлайна.
//!
//! Тестируют бизнес-логику `get_global_timeline` через `Chapter::find_all`
//! поверх реальной in-memory SurrealDB + продовой схемы `surreal_schema.surql`.
//! Каждый тест создаёт изолированную БД и авто-очищается после завершения.

use crate::logic::chapters::{get_chapter_revisions_inner, toggle_chapter_history_pin_inner};
use crate::logic::models::Chapter;
use serde_json::json;
use surreal_domain::SurrealRepository;
use super::common::create_test_db;

/// Хелпер: создаёт проект и возвращает проектный id `projects:<key>`.
async fn seed_project(db: &surrealdb::Surreal<surrealdb::engine::local::Db>, key: &str) {
    db.upsert::<Option<serde_json::Value>>(("projects", key))
        .content(json!({ "name": format!("Project {key}") }))
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
    let vol_id = format!("vol_{project_key}");
    let _ = db.query(format!(
        "UPSERT type::record('volumes', '{vol_id}') SET project_id = type::record('projects', '{project_key}'), title = 'Том 1'"
    )).await;
    let sql = format!(
        "CREATE chapters SET volume_id = type::record('volumes', '{vol_id}'), title = '{title}', content = '{content}'"
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
        .content(json!({ "name": "Test Project" }))
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
    // ВАЖНО: Rust SDK .delete(record) гарантированно триггерит DEFINE EVENT
    // для каждой записи. Сырой SQL DELETE может не триггерить events в SurrealDB.
    db.delete::<Option<serde_json::Value>>(("projects", "p1"))
        .await
        .expect("delete project via SDK");

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
    db.query("CREATE volumes:v1 SET project_id = type::record('projects','p1'), title = 'v1'")
        .await
        .expect("create volume should run");
    db.query("CREATE chapters:ch1 SET volume_id = type::record('volumes','v1'), title = 'Intro', content = 'a'")
        .await
        .expect("create chapter ch1 should run");

    let timeline: serde_json::Value = json!([{
        "chapter_id": "chapters:ch1",
        "chapter_title": "Intro Updated",
        "events": [],
        "participants": []
    }]);

    let res = Chapter::save_global_timeline_inner(&db, "p1", timeline)
        .await
        .expect("save_global_timeline should succeed");
    assert_eq!(res["success"], true);
    assert_eq!(res["updated"], 1);

    let mut q_res = db.query("SELECT * FROM chapters:ch1").await.expect("query chapter");
    let ch_raw: Option<serde_json::Value> = q_res.take(0).expect("take chapter");
    let ch_val = ch_raw.expect("ch1 exists");
    assert_eq!(ch_val["title"], "Intro Updated");
}

#[tokio::test]
async fn save_global_timeline_rejects_non_array() {
    let db = create_test_db().await;
    seed_project(&db, "p1").await;

    let res = Chapter::save_global_timeline_inner(&db, "p1", json!({ "not": "an array" })).await;
    assert!(res.is_err(), "не-массив должен вернуть Err");
}

#[tokio::test]
async fn save_global_timeline_requires_chapter_id() {
    let db = create_test_db().await;
    seed_project(&db, "p1").await;

    // Элемент без chapter_id — должен быть Err
    let data = json!([{ "chapter_title": "Без id", "events": [] }]);
    let res = Chapter::save_global_timeline_inner(&db, "p1", data).await;
    assert!(res.is_err(), "отсутствие chapter_id должно давать Err");
    assert!(res.unwrap_err().to_string().contains("chapter_id"));
}

#[tokio::test]
async fn save_global_timeline_empty_array_returns_zero_updated() {
    let db = create_test_db().await;
    seed_project(&db, "p1").await;

    let res = Chapter::save_global_timeline_inner(&db, "p1", json!([]))
        .await
        .expect("пустой массив должен успешно завершиться");
    assert_eq!(res["success"], true);
    assert_eq!(res["updated"], 0);
}

#[tokio::test]
async fn get_chapter_revisions_returns_snapshot_after_update() {
    let db = create_test_db().await;
    seed_project(&db, "p1").await;

    db.query("CREATE volumes:v_rev SET project_id = type::record('projects','p1'), title = 'Том 1'").await.unwrap();
    db.query("CREATE chapters:ch_rev SET volume_id = volumes:v_rev, title = 'Начало', content = 'v1'")
        .await
        .expect("create chapter");

    // UPDATE триггерит DDL-событие log_chapter_revision → создаётся снапшот
    db.query("UPDATE chapters:ch_rev SET title = 'Продолжение', content = 'v2'")
        .await
        .expect("update chapter");

    let revisions = get_chapter_revisions_inner(&db, "p1", "chapters:ch_rev")
        .await
        .expect("get revisions");

    assert_eq!(revisions.len(), 1, "после одного UPDATE должен быть 1 снапшот");
    assert_eq!(
        revisions[0]["content"]["title"], "Продолжение",
        "снапшот хранит сохранённое состояние после изменения"
    );
}

#[tokio::test]
async fn toggle_chapter_history_pin_marks_revision_pinned() {
    let db = create_test_db().await;
    seed_project(&db, "p1").await;

    // Создаём ревизию с явным ID, чтобы детерминированно проверить toggle pin
    db.query(
        "CREATE chapter_revisions:my_rev SET target_id = type::record('chapters:ch1'), project_id = type::record('projects','p1'), content = {}, is_pinned = false",
    )
    .await
    .expect("create revision");

    toggle_chapter_history_pin_inner(&db, "chapter_revisions:my_rev", true)
        .await
        .expect("pin should succeed");

    let mut res = db
        .query("SELECT VALUE is_pinned FROM chapter_revisions:my_rev")
        .await
        .expect("query pin");
    let pinned: Option<bool> = res.take(0).expect("take is_pinned");
    assert_eq!(pinned, Some(true), "после toggle ревизия должна быть закреплена");
}

#[tokio::test]
async fn timeline_duplicate_chapter_ids_updates_same_row_twice() {
    let db = create_test_db().await;
    seed_project(&db, "p1").await;

    db.query("CREATE volumes:v1 SET project_id = type::record('projects','p1'), title = 'v1'")
        .await
        .expect("create volume");
    db.query("CREATE chapters:ch_dup SET volume_id = type::record('volumes','v1'), title = 'Дубль', content = ''")
        .await
        .expect("create chapter");

    // Два элемента с ОДИНАКОВЫМ chapter_id: оба UPDATE бьют в одну главу.
    let data = json!([
        { "chapter_id": "chapters:ch_dup", "chapter_title": "Первое",
          "events": [], "participants": [] },
        { "chapter_id": "chapters:ch_dup", "chapter_title": "Второе",
          "events": [], "participants": [] }
    ]);
    let res = Chapter::save_global_timeline_inner(&db, "p1", data)
        .await
        .expect("timeline with duplicates should succeed");
    assert_eq!(res["updated"], 2, "формально обработано 2 элемента");

    // Итоговое состояние главы — последний wins
    let mut q_res = db.query("SELECT * FROM chapters:ch_dup").await.unwrap();
    let ch_raw: Option<serde_json::Value> = q_res.take(0).unwrap();
    let ch_val = ch_raw.unwrap();
    assert_eq!(ch_val["title"], "Второе");

    // Каждый UPDATE логирует ревизию → их должно быть две
    let revisions = get_chapter_revisions_inner(&db, "p1", "chapters:ch_dup")
        .await
        .expect("get revisions");
    assert_eq!(revisions.len(), 2, "два UPDATE → два снапшота");
}

#[tokio::test]
async fn multiple_revisions_ordered_desc_with_after_content() {
    let db = create_test_db().await;
    seed_project(&db, "p1").await;

    db.query("CREATE volumes:v1 SET project_id = type::record('projects','p1'), title = 'v1'")
        .await
        .expect("create volume");
    db.query("CREATE chapters:ch_hist SET volume_id = type::record('volumes','v1'), title = 'v1', content = 'текст-1'")
        .await
        .expect("create chapter");

    for v in ["текст-2", "текст-3", "текст-4"] {
        db.query(format!("UPDATE chapters:ch_hist SET content = '{v}'"))
            .await
            .expect("update chapter");
    }

    let revisions = get_chapter_revisions_inner(&db, "p1", "chapters:ch_hist")
        .await
        .expect("get revisions");

    assert_eq!(revisions.len(), 3, "3 UPDATE → 3 ревизии");
    // По убыванию времени: от последнего сохранения к более ранним ($after)
    assert_eq!(revisions[0]["content"]["content"], "текст-4", "первая в списке — последнее сохранённое состояние");
    assert_eq!(revisions[1]["content"]["content"], "текст-3");
    assert_eq!(revisions[2]["content"]["content"], "текст-2", "последняя — первое сохранённое состояние обновления");
}

#[tokio::test]
async fn test_stored_functions_planet_and_calendar_lifecycle() {
    let db = create_test_db().await;
    seed_project(&db, "proj_cal").await;

    // 1. fn::save_planet
    let mut res = db
        .query("RETURN fn::save_planet(type::record('planets', 'terra'), type::record('projects', 'proj_cal'), 'Земля', 86400, 23400, 365, 1, []);")
        .await
        .expect("save_planet query");
    let planet: Option<serde_json::Value> = res.take(0).expect("take planet");
    assert!(planet.is_some(), "planet created");

    // 2. fn::save_calendar
    let mut res = db
        .query("RETURN fn::save_calendar(type::record('calendars', 'gregorian'), type::record('projects', 'proj_cal'), type::record('planets', 'terra'), 'Григорианский', true, { days_in_year: 365 });")
        .await
        .expect("save_calendar query");
    let cal: Option<serde_json::Value> = res.take(0).expect("take calendar");
    assert!(cal.is_some(), "calendar created");

    // 3. fn::set_master_calendar
    let mut res = db
        .query("RETURN fn::set_master_calendar(type::record('projects', 'proj_cal'), type::record('planets', 'terra'), type::record('calendars', 'gregorian'));")
        .await
        .expect("set_master_calendar query");
    let master_res: Option<serde_json::Value> = res.take(0).expect("take master_res");
    assert!(master_res.is_some());

    // 4. fn::get_planet_calendar_bundle
    let mut res = db
        .query("RETURN fn::get_planet_calendar_bundle(type::record('projects', 'proj_cal'));")
        .await
        .expect("get_planet_calendar_bundle query");
    let bundle: Option<serde_json::Value> = res.take(0).expect("take bundle");
    assert!(bundle.is_some(), "bundle retrieved");
    let bundle_val = bundle.unwrap();
    assert!(bundle_val.get("planets").is_some());
    assert!(bundle_val.get("calendars").is_some());

    // 5. fn::delete_calendar
    let mut res = db
        .query("RETURN fn::delete_calendar(type::record('calendars', 'gregorian'));")
        .await
        .expect("delete_calendar query");
    let del_cal: Option<serde_json::Value> = res.take(0).expect("take del_cal");
    assert!(del_cal.is_some());

    // 6. fn::delete_planet
    let mut res = db
        .query("RETURN fn::delete_planet(type::record('projects', 'proj_cal'), type::record('planets', 'terra'), true);")
        .await
        .expect("delete_planet query");
    let del_planet: Option<serde_json::Value> = res.take(0).expect("take del_planet");
    assert!(del_planet.is_some());
}

