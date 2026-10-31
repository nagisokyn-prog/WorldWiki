//! Общие хелперы для интеграционных тестов.
//!
//! Создают изолированную in-memory SurrealDB (SurrealKV), применяют ту же
//! схему, что и в продке (`surreal_schema.surql`), и предоставляют хелперы
//! сидинга.
//!
//! Важно: `SurrealKv("memory")` на Windows не является чисто in-memory — он
//! создаёт файл `memory` в текущем каталоге, из-за чего параллельные тесты
//! конфликтуют (sharing violation, os error 33). Поэтому каждый вызов
//! `create_test_db()` открывает **уникальный временный каталог** (process id +
//! атомарный счётчик) — гарантированная изоляция без блокировок.

use surrealdb::engine::local::{Db, Mem};
use surrealdb::Surreal;

/// Создаёт свежую in-memory БД с применённой прод-схемой.
pub async fn create_test_db() -> Surreal<Db> {
    let db = Surreal::new::<Mem>(())
        .await
        .expect("Failed to start in-memory SurrealDB");
    db.use_ns("test")
        .use_db("test")
        .await
        .expect("Failed to use NS/DB");

    // Применяем продовую модульную схему через apply_schema_pipeline.
    crate::apply_schema_pipeline(&db)
        .await
        .expect("Failed to apply schema pipeline");

    db
}

/// Хелпер: создаёт тестовый проект в БД через upsert по ключу.
#[allow(dead_code)]
pub async fn seed_project(db: &Surreal<Db>, key: &str, name: &str) {
    db.upsert::<Option<serde_json::Value>>(("projects", key))
        .content(serde_json::json!({ "name": name }))
        .await
        .expect("upsert project should run");
}

/// Хелпер: создаёт тестовую главу с явным ID и возвращает нормализованный ID вида "chapters:{chapter_key}".
#[allow(dead_code)]
pub async fn seed_chapter(
    db: &Surreal<Db>,
    project_key: &str,
    chapter_key: &str,
    title: &str,
    content: &str,
) -> String {
    let proj_raw = project_key.strip_prefix("projects:").unwrap_or(project_key).trim_matches('`');
    let chap_raw = chapter_key.strip_prefix("chapters:").unwrap_or(chapter_key).trim_matches('`');

    let check_vol_sql = "SELECT VALUE type::string(id) FROM volumes WHERE project_id = fn::normalize_project_id($pid) LIMIT 1;";
    let mut vres = db.query(check_vol_sql).bind(("pid", proj_raw)).await.expect("query existing volume");
    let existing_vids: Vec<String> = vres.take(0).expect("take existing volume id");
    let vid = if let Some(first_vid) = existing_vids.into_iter().next() {
        first_vid.strip_prefix("volumes:").unwrap_or(&first_vid).to_string()
    } else {
        let default_vid = format!("vol_{}", proj_raw);
        let vol_sql = "UPSERT type::record('volumes', $vid) SET project_id = fn::normalize_project_id($pid), title = 'Volume 1';";
        db.query(vol_sql)
            .bind(("vid", default_vid.clone()))
            .bind(("pid", proj_raw))
            .await
            .expect("create volume for seed_chapter should run");
        default_vid
    };

    let sql = "UPSERT type::record('chapters', $cid) SET volume_id = type::record('volumes', $vid), title = $title, content = $content, word_count = 0;";
    let mut res = db.query(sql)
        .bind(("cid", chap_raw))
        .bind(("vid", vid))
        .bind(("title", title))
        .bind(("content", content))
        .await
        .expect("create chapter query should run");

    // Проверяем schema violations
    let errors = res.take_errors();
    if let Some((_, e)) = errors.into_iter().next() {
        panic!("seed_chapter schema error for '{chapter_key}': {e}");
    }

    let records: Vec<serde_json::Value> = res.take(0).expect("take chapter record");
    if records.is_empty() {
        panic!("seed_chapter failed to create record: result is empty");
    }

    format!("chapters:{}", chap_raw)
}

/// Хелпер: создает полный граф AppServices, подключенный к тестовой SurrealDB.
#[allow(dead_code)]
pub fn create_test_services(db: std::sync::Arc<Surreal<Db>>) -> worldwiki_tauri::state::AppServices {
    let events = std::sync::Arc::new(worldwiki_infrastructure::events::InMemoryEventPublisher);
    crate::bootstrap::services::build_surreal_app_services(db, events)
}