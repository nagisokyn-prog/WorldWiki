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

use std::sync::atomic::{AtomicUsize, Ordering};

use surrealdb::engine::local::{Db, SurrealKv};
use surrealdb::Surreal;

/// Глобальный счётчик для уникальных имён временных БД между параллельными тестами.
static __DB_IDX: AtomicUsize = AtomicUsize::new(0);

/// Создаёт свежую in-memory БД с применённой прод-схемой.
pub async fn create_test_db() -> Surreal<Db> {
    let idx = __DB_IDX.fetch_add(1, Ordering::SeqCst);
    let unique_id = format!("{}-{}-{}", std::process::id(), idx, uuid::Uuid::new_v4());
    let dir = std::env::temp_dir().join(format!("worldwiki-test-{}", unique_id));
    let _ = std::fs::remove_dir_all(&dir);
    std::fs::create_dir_all(&dir).expect("create db temp dir");

    // IntoEndpoint<SurrealKv> требует owned PathBuf (см. продовой init_database в lib.rs).
    let db = Surreal::new::<SurrealKv>(dir)
        .await
        .expect("Failed to start in-memory SurrealDB");
    db.use_ns("test")
        .use_db("test")
        .await
        .expect("Failed to use NS/DB");

    // Применяем продовую схему через include_str! (вкомпилирована в бинарник).
    let sql = include_str!("../../../apps/spa/src/logic/surreal_schema.surql");
    let mut res = db.query(sql).await.expect("Failed to apply schema");
    if let Some(err) = res.take_errors().into_iter().next() {
        panic!("DDL schema errors: {err:?}");
    }

    db
}

/// Хелпер: создаёт тестовый проект в БД через upsert по ключу.
#[allow(dead_code)]
pub async fn seed_project(db: &Surreal<Db>, key: &str, name: &str) {
    db.upsert::<Option<serde_json::Value>>(("projects", key))
        .content(serde_json::json!({ "name": name, "data": {} }))
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

    let sql = "CREATE type::record('chapters', $cid) SET project_id = type::record('projects', $pid), title = $title, content = $content";
    db.query(sql)
        .bind(("cid", chap_raw))
        .bind(("pid", proj_raw))
        .bind(("title", title))
        .bind(("content", content))
        .await
        .expect("create chapter should run");

    format!("chapters:{}", chap_raw)
}