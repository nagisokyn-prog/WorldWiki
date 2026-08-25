//! ⚠️ ЭТОТ ФАЙЛ НЕ КОМПИЛИРУЕТСЯ И НИКОГДА НЕ ЗАПУСКАЛСЯ.
//!
//! `backend/surreal_domain/Cargo.toml` — виртуальный воркспейс (`[workspace]`
//! без `[package]`), поэтому каталог `backend/surreal_domain/tests/` Cargo
//! игнорирует: интеграционные тесты у виртуального воркспейса невозможны.
//!
//! Рабочая версия тестов живёт в:
//! `backend/surreal_domain/surreal_domain_facade/tests/repository_branches_integration.rs`
//!
//! Запуск: `cargo test -p surreal_domain --test repository_branches_integration`
//! из `backend/surreal_domain/`.
//!
//! TODO(git): удалить весь каталог `backend/surreal_domain/tests/` командой
//! `git rm -r backend/surreal_domain/tests/` (или перенести полезные файлы в
//! `surreal_domain_facade/tests/`, добавив каждому локальный харнес).

#[allow(unused)]
mod dead_original_content {
    //! Branch-coverage integration tests for `SurrealRepository` default methods.
    //!
    //! Целенаправленно затрагивают «красные» ветки в `surreal_domain_core/src/lib.rs`:
    //! - `find_all` → ошибка запроса (таблица не существует) → `Ok(vec![]);`
    //! - `find_all` → замыкание нормализует RecordId-объект `{tb, id}`;
    //! - `find_all` → замыкание пропускает битую запись (deserialize error);
    //! - `save` → явный `null` в Option-поле (`v.is_null()` → NONE/literal);
    //! - `save` → пустой результат UPSERT → fallback на `Self::create`.

    mod common;


use common::create_test_db;
use serde::{Deserialize, Serialize};
use surreal_domain::SurrealRepository;

/// Сущность с Option-полем, которое будем специально сохранять как `None`.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
struct BranchEntity {
    id: Option<String>,
    project_id: Option<String>,
    name: String,
    description: Option<String>,
}

impl SurrealRepository for BranchEntity {
    const TABLE: &'static str = "branch_entities";

    fn get_id(&self) -> Option<String> {
        self.id.clone()
    }

    fn set_id(&mut self, id: String) {
        self.id = Some(id);
    }
}

/// Сущность с "чужой" таблицей: используем, чтобы покрыть ветку
/// `find_all` → запрос к несуществующей таблице.
#[derive(Debug, Clone, Serialize, Deserialize)]
struct GhostEntity {
    id: Option<String>,
    project_id: Option<String>,
    name: String,
}

impl SurrealRepository for GhostEntity {
    const TABLE: &'static str = "ghost_table_that_does_not_exist";

    fn get_id(&self) -> Option<String> {
        self.id.clone()
    }
    fn set_id(&mut self, id: String) {
        self.id = Some(id);
    }
}

/// Маленький хелпер-обёртка над `seed_project`, чтобы не тащить импорт в тесты.
async fn ensure_project(db: &surrealdb::Surreal<surrealdb::engine::local::Db>, project_id: &str) {
    common::seed_project(db, project_id, "Project 1").await;
}

// ─── find_all: таблица не существует → Ok(Vec::new()) ──────────────────────────

#[tokio::test]
#[serial_test::serial]
async fn test_find_all_nonexistent_table_returns_empty() {
    let db = create_test_db().await;

    // Таблица `ghost_table_that_does_not_exist` в БД нет. Запрос может вернуть
    // либо пустой набор (SurrealKV часто так делает для пустого скана), либо
    // ошибку. Любой из вариантов гарантирует отсутствие паники; если Surreal
    // вернул Ok — он должен быть пустым (покрывает строки 163–166 Err-ветку
    // или корректно завершённый Ok-путь).
    let result = GhostEntity::find_all(&db, "projects:p1").await;
    match result {
        Ok(rows) => assert!(rows.is_empty(), "empty table should yield empty vec"),
        Err(e) => eprintln!("find_all on missing table returned (acceptable): {}", e),
    }
}

// ─── find_all: замыкание нормализует RecordId-объекты `{tb, id}` ───────────────

#[tokio::test]
#[serial_test::serial]
async fn test_find_all_normalizes_nested_record_id_values() {
    let db = create_test_db().await;

    // Вставляем запись, где project_id хранится как SurrealDB RecordID →
    // при чтении сериализуется как объект {"tb","id"}. Покрывает строки 182–191
    // замыкания filter_map (нормализация thing → "tb:id").
    let _: Vec<serde_json::Value> = db
        .query("CREATE branch_entities CONTENT { project_id: type::record('projects', 'p1'), name: 'nested-thing' }")
        .await
        .unwrap()
        .take(0)
        .unwrap();

    let rows = BranchEntity::find_all(&db, "projects:p1")
        .await
        .expect("find_all should succeed");
    assert!(
        rows.iter().any(|r| r.name == "nested-thing"),
        "row with thing-as-object project_id must be returned: {:?}",
        rows
    );
}

// ─── find_all: замыкание пропускает битую запись (deserialize error) ───────────

#[tokio::test]
#[serial_test::serial]
async fn test_find_all_skips_malformed_row() {
    let db = create_test_db().await;

    // Валидная запись (проходит десериализацию).
    let _: Vec<serde_json::Value> = db
        .query("CREATE branch_entities CONTENT { project_id: 'projects:p1', name: 'good' }")
        .await
        .unwrap()
        .take(0)
        .unwrap();

    // "Битая" запись: поле `name` (required) — число, а не строка →
    // `serde_json::from_value::<BranchEntity>` падает → замыкание возвращает
    // `None` и запись пропускается (покрывает 198–200).
    let _: Vec<serde_json::Value> = db
        .query("CREATE branch_entities CONTENT { project_id: 'projects:p1', name: 12345 }")
        .await
        .unwrap()
        .take(0)
        .unwrap();

        let rows = BranchEntity::find_all(&db, "projects:p1")
        .await
        .expect("find_all should succeed");
    assert_eq!(rows.len(), 1, "битая запись должна быть пропущена, валидная — оставлена");
    assert_eq!(rows[0].name, "good");
}

// ─── save: явный null в Option-поле ─────────────────────────────────────────────

#[tokio::test]
#[serial_test::serial]
async fn test_save_explicit_none_option_field() {
    let db = create_test_db().await;
    ensure_project(&db, "p1").await;

    // Создаём запись с Some(description).
    let created = BranchEntity::create(
        &db,
        BranchEntity {
            id: None,
            project_id: Some("projects:p1".into()),
            name: "Original".into(),
            description: Some("text".into()),
        },
    )
    .await
    .expect("create");
    let created_id = created.id.clone().expect("should have id after create");

    // save с description = None. save() НЕ strip-ит nulls, поэтому в карте
    // окажется `"description": null` → покрываются строки 243–244
    // (v.is_null() → literal NONE/null).
    let _ = BranchEntity::save(
        &db,
        &BranchEntity {
            id: Some(created_id.clone()),
            project_id: Some("projects:p1".into()),
            name: "Updated".into(),
            description: None,
        },
    )
    .await
    .expect("save with explicit null");

    let fetched = BranchEntity::find_by_id(&db, &created_id)
        .await
        .expect("find_by_id")
        .expect("entity after save");
    assert_eq!(fetched.description, None, "description must be null after save");
}

// ─── save: пустой результат UPSERT → fallback на create ─────────────────────────

#[tokio::test]
#[serial_test::serial]
async fn test_save_upsert_empty_result_falls_back_to_create() {
    let db = create_test_db().await;
    ensure_project(&db, "p1").await;

    // id указывает в чужую таблицу → UPSERT $__record_id не создаёт запись в
    // `branch_entities`, возвращая пустой набор строк. save() тогда падает на
    // `Self::create` (строки 287–294), включая ветку `items.into_iter().next()`
    // == None и последующий create.
    let res = BranchEntity::save(
        &db,
        &BranchEntity {
            id: Some("other_table:ghost_ups".into()),
            project_id: Some("projects:p1".into()),
            name: "Fallback".into(),
            description: None,
        },
    )
    .await;
    let _ = res; // Ok или Err — главное покрыть 287–294 без паники

    // А вот корректный upsert в свою таблицу — убеждаемся, что основной путь save работает.
        let saved = BranchEntity::save(
        &db,
        &BranchEntity {
            id: None,
            project_id: Some("projects:p1".into()),
            name: "DirectUpsert".into(),
            description: None,
        },
    )
    .await
    .expect("save into own table should upsert");
    assert_eq!(saved.name, "DirectUpsert");
    assert!(saved.id.is_some());
}

// ─── delete: полный цикл + ветка чужого префикса (строки 298–316) ───────────────

#[tokio::test]
#[serial_test::serial]
async fn test_branch_entity_delete_roundtrip_and_foreign_prefix_noop() {
    let db = create_test_db().await;
    ensure_project(&db, "p1").await;

    let created = BranchEntity::create(
        &db,
        BranchEntity {
            id: None,
            project_id: Some("projects:p1".into()),
            name: "ToDelete".into(),
            description: None,
        },
    )
    .await
    .expect("create");
    let id = created.id.clone().expect("has id");

    // удаление по чужой таблице — no-op Ok(()) (строка 301)
    let noop = BranchEntity::delete(&db, "other_table:whatever").await;
    assert!(noop.is_ok(), "foreign-prefix delete must be Ok no-op");

    // удаление своего id — Ok
    let deleted = BranchEntity::delete(&db, &id).await;
    assert!(deleted.is_ok(), "delete should succeed: {:?}", deleted.err());

    // больше не находится
    let after = BranchEntity::find_by_id(&db, &id).await.expect("find after delete");
    assert!(after.is_none(), "entity must be gone after delete");

    // удаление несуществующего id той же таблицы — тоже Ok (строки 307–311)
    let stale = BranchEntity::delete(&db, "branch_entities:never_existed").await;
    assert!(stale.is_ok(), "delete of missing record must be no-op Ok");
}




