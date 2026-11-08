//! Интеграционные тесты экспорта и бэкапов (`logic/export.rs`).
//!
//! Тестируют:
//! - `export_chapters_inner`: объединение глав в итоговый файл.
//! - `create_cloud_backup_inner`: экспорт дампа БД и упаковку в `.wwiki` (zip).
//! - `restore_from_backup_inner`: восстановление БД из `.wwiki` (roundtrip).
//! - Негативные сценарии: отсутствующий файл, zip без `database.surql`.
//! - `get_launch_args`.

use std::io::Write;
use std::path::Path;
use std::path::PathBuf;
use std::sync::atomic::{AtomicUsize, Ordering};

use serde_json::json;

use worldwiki_infrastructure::storage::backup::*;
use worldwiki_tauri::commands::get_launch_args;
use super::common::{create_test_db, seed_project};

static __TMP_IDX: AtomicUsize = AtomicUsize::new(0);

/// Создаёт уникальный временный каталог для изоляции файловых тестов
/// между параллельными запусками (аналогично `common::create_test_db`).
fn tmp_dir(tag: &str) -> PathBuf {
    let idx = __TMP_IDX.fetch_add(1, Ordering::SeqCst);
    let dir = std::env::temp_dir().join(format!(
        "worldwiki-export-test-{}-{}-{}-{}",
        std::process::id(),
        idx,
        tag,
        uuid::Uuid::new_v4()
    ));
    let _ = std::fs::remove_dir_all(&dir);
    std::fs::create_dir_all(&dir).expect("create temp dir");
    dir
}

#[tokio::test]
async fn export_chapters_writes_combined_file() {
    let dir = tmp_dir("chapters");

    let chapters = vec![
        json!({ "title": "Пролог", "content": "В начале было слово." }),
        json!({ "title": "Глава 1", "content": "Дальше — больше." }),
    ];

    let path = export_chapters_inner(&dir, &chapters, "md").expect("export should succeed");
    let expected = dir.join("exported_chapters.md");
    assert_eq!(Path::new(&path), expected.as_path());

    let content = std::fs::read_to_string(&expected).expect("exported file should exist");
    assert!(content.contains("=== Пролог ==="), "должен быть заголовок Пролога");
    assert!(content.contains("В начале было слово."), "должен сохраниться контент Пролога");
    assert!(content.contains("=== Глава 1 ==="));
    assert!(content.contains("Дальше — больше."));
}

#[tokio::test]
async fn export_chapters_handles_missing_title_and_content() {
    let dir = tmp_dir("chapters_fallback");

    let chapters = vec![
        json!({}), // нет ни title, ни content
        json!({ "title": "Без контента" }),
    ];

    export_chapters_inner(&dir, &chapters, "txt").expect("export should succeed");

    let content = std::fs::read_to_string(dir.join("exported_chapters.txt")).expect("file");
    assert!(content.contains("=== Без названия ==="), "пустой title заменяется дефолтом");
    assert!(content.contains("=== Без контента ==="));
}

#[tokio::test]
async fn create_cloud_backup_creates_wwiki_with_database_dump() {
    let db = create_test_db().await;
    seed_project(&db, "backup_proj", "Backup Project").await;

    let dir = tmp_dir("backup");
    let test_data = dir.join("test_data");
    std::fs::create_dir_all(&test_data).ok();
    unsafe { std::env::set_var("SURREAL_DATA_DIR", &test_data); }

    let zip_path = create_cloud_backup_inner(&db, &dir)
        .await
        .expect("backup should succeed");

    assert!(Path::new(&zip_path).exists(), "zip-файл должен существовать");
    assert!(zip_path.ends_with(".wwiki"));

    // Читаем zip и проверяем, что внутри есть database.surql с засеянным проектом
    let file = std::fs::File::open(&zip_path).expect("open zip");
    let mut archive = zip::ZipArchive::new(file).expect("read zip");

    let mut dump = archive
        .by_name("database.surql")
        .expect("database.surql должен быть внутри архива");
    let mut surql = String::new();
    std::io::Read::read_to_string(&mut dump, &mut surql).expect("read surql dump");

    assert!(surql.contains("backup_proj"), "дамп должен содержать засеянный проект");
}

#[tokio::test]
async fn restore_from_backup_roundtrip_restores_project() {
    // БД-источник: сидим проект и делаем бэкап
    let src = create_test_db().await;
    seed_project(&src, "roundtrip_proj", "Roundtrip Project").await;

    let dir = tmp_dir("roundtrip");
    let test_data = dir.join("test_data");
    std::fs::create_dir_all(&test_data).ok();
    unsafe { std::env::set_var("SURREAL_DATA_DIR", &test_data); }

    let zip_path = create_cloud_backup_inner(&src, &dir)
        .await
        .expect("backup");

    // БД-приёмник: свежая, восстанавливаем из бэкапа
    let dst = create_test_db().await;
    restore_from_backup_inner(&dst, &zip_path)
        .await
        .expect("restore should succeed");

    // Проверяем, что проект появился в приёмнике
    let mut res = dst
        .query("SELECT name FROM projects WHERE id = type::record('projects:roundtrip_proj')")
        .await
        .expect("query projects");
    let rows: Vec<serde_json::Value> = res.take(0).expect("take rows");
    assert_eq!(rows.len(), 1, "проект должен восстановиться из бэкапа");
    assert_eq!(rows[0]["name"], "Roundtrip Project");
}

#[tokio::test]
async fn restore_from_backup_missing_file_returns_err() {
    let db = create_test_db().await;
    let missing = tmp_dir("missing").join("nope.wwiki");

    let res = restore_from_backup_inner(&db, missing.to_str().unwrap()).await;
    assert!(res.is_err(), "несуществующий файл должен вернуть Err");
    assert!(res.unwrap_err().to_string().contains("does not exist"));
}

#[tokio::test]
async fn restore_from_backup_zip_without_database_surql_returns_err() {
    let db = create_test_db().await;
    let dir = tmp_dir("bad_zip");

    // Собираем валидный zip, но без database.surql
    let zip_path = dir.join("bad.wwiki");
    let file = std::fs::File::create(&zip_path).expect("create zip");
    let mut zw = zip::ZipWriter::new(file);
    zw.start_file("random.txt", zip::write::SimpleFileOptions::default())
        .expect("start file");
    zw.write_all(b"hello").expect("write");
    zw.finish().expect("finish zip");

    let res = restore_from_backup_inner(&db, zip_path.to_str().unwrap()).await;
    assert!(res.is_err(), "zip без database.surql должен вернуть Err");
    assert!(res.unwrap_err().to_string().contains("database.surql not found"));
}

#[tokio::test]
async fn restore_from_backup_with_project_bundle_restores_complete_subgraph() {
    let src = create_test_db().await;
    let proj_key = "full_graph_proj";
    seed_project(&src, proj_key, "Full Graph Project").await;

    // Seed volume & chapter
    let mut vol_res = src
        .query("CREATE volumes:v1 SET project_id = type::record('projects:full_graph_proj'), title = 'Том 1';")
        .await
        .unwrap();
    assert!(vol_res.take_errors().is_empty());

    let mut chap_res = src
        .query("CREATE chapters:ch1 SET volume_id = type::record('volumes:v1'), title = 'Глава 1', content = 'Текст главы';")
        .await
        .unwrap();
    assert!(chap_res.take_errors().is_empty());

    // Seed custom schema & entity
    let mut sch_res = src
        .query("CREATE entity_schemas:custom_faction SET project_id = type::record('projects:full_graph_proj'), type_key = 'faction', type_name = 'Фракция';")
        .await
        .unwrap();
    assert!(sch_res.take_errors().is_empty());

    let mut ent_res = src
        .query("CREATE entities:ent1 SET schema_id = type::record('entity_schemas:custom_faction'), name = 'Орден', attributes = {}, tags = [];")
        .await
        .unwrap();
    assert!(ent_res.take_errors().is_empty());

    // Create cloud backup
    let dir = tmp_dir("full_bundle_export");
    let zip_path = create_cloud_backup_inner(&src, &dir)
        .await
        .expect("backup succeeds");

    // Restore into destination that already has pre-seeded default schemas
    let dst = create_test_db().await;
    restore_from_backup_inner(&dst, &zip_path)
        .await
        .expect("restore must succeed without entity_schemas conflict");

    // Verify project, volume, chapter, entity restored
    let mut check_p = dst
        .query("SELECT * FROM ONLY type::record('projects:full_graph_proj');")
        .await
        .unwrap();
    let p_row: Option<serde_json::Value> = check_p.take(0).unwrap();
    assert!(p_row.is_some(), "Project must exist");

    let mut check_e = dst
        .query("SELECT * FROM ONLY type::record('entities:ent1');")
        .await
        .unwrap();
    let e_row: Option<serde_json::Value> = check_e.take(0).unwrap();
    assert!(e_row.is_some(), "Entity must exist");
    assert_eq!(e_row.unwrap()["name"], "Орден");
}

#[tokio::test]
async fn restore_legacy_backup_with_conflicting_default_schemas_succeeds() {
    let dst = create_test_db().await;
    let dir = tmp_dir("legacy_conflict");

    // Manually construct a legacy backup with raw conflicting CREATE
    let zip_path = dir.join("legacy_conflict.wwiki");
    let file = std::fs::File::create(&zip_path).expect("create zip");
    let mut zw = zip::ZipWriter::new(file);

    let surql_content = r#"
CREATE entity_schemas:default_character CONTENT {
    created_at: time::now(),
    fields_schema: [],
    project_id: 'global',
    type_key: 'character',
    type_name: 'Персонаж'
};
CREATE projects:legacy_proj CONTENT {
    name: 'Legacy Resilient Project'
};
"#;
    zw.start_file("database.surql", zip::write::SimpleFileOptions::default())
        .unwrap();
    zw.write_all(surql_content.as_bytes()).unwrap();
    zw.finish().unwrap();

    // Restore must succeed even though entity_schemas:default_character already exists in dst
    let res = restore_from_backup_inner(&dst, zip_path.to_str().unwrap()).await;
    assert!(
        res.is_ok(),
        "Sanitized legacy restore must not fail on duplicate default_character: {:?}",
        res.err()
    );

    let mut check_p = dst
        .query("SELECT * FROM ONLY type::record('projects:legacy_proj');")
        .await
        .unwrap();
    let p_row: Option<serde_json::Value> = check_p.take(0).unwrap();
    assert!(p_row.is_some(), "Legacy project must be restored");
}

#[tokio::test]
async fn restore_over_existing_project_cleans_zombie_records() {
    let src = create_test_db().await;
    let proj_key = "zombie_test_proj";
    seed_project(&src, proj_key, "Original Project").await;

    // Create volume & original chapter
    src.query("CREATE volumes:v1 SET project_id = type::record('projects:zombie_test_proj'), title = 'Том 1';")
        .await
        .unwrap();
    src.query("CREATE chapters:ch1 SET volume_id = type::record('volumes:v1'), title = 'Глава 1', content = 'Оригинал';")
        .await
        .unwrap();

    let dir = tmp_dir("zombie_backup");
    let zip_path = create_cloud_backup_inner(&src, &dir)
        .await
        .expect("backup succeeds");

    // In src, simulate mutations: user adds a new chapter 'ch_unwanted' and mutates
    src.query("CREATE chapters:ch_unwanted SET volume_id = type::record('volumes:v1'), title = 'Лишняя Глава', content = 'Мусор';")
        .await
        .unwrap();

    // Restore the backup over the mutated project
    restore_from_backup_inner(&src, &zip_path)
        .await
        .expect("restore succeeds");

    // Verify unwanted chapter is GONE (cascade purge) and original chapter is preserved
    let mut check_bad = src
        .query("SELECT * FROM ONLY type::record('chapters:ch_unwanted');")
        .await
        .unwrap();
    let bad_row: Option<serde_json::Value> = check_bad.take(0).unwrap();
    assert!(bad_row.is_none(), "Zombie chapter must be purged upon restore");

    let mut check_orig = src
        .query("SELECT * FROM ONLY type::record('chapters:ch1');")
        .await
        .unwrap();
    let orig_row: Option<serde_json::Value> = check_orig.take(0).unwrap();
    assert!(orig_row.is_some(), "Original chapter must be present");
}

#[tokio::test]
async fn restore_invalid_json_in_project_bundle_rolls_back() {
    let db = create_test_db().await;
    seed_project(&db, "rollback_test_proj", "Should Not Corrupt").await;

    let dir = tmp_dir("corrupted_bundle");
    let zip_path = dir.join("bad_bundle.wwiki");
    let file = std::fs::File::create(&zip_path).expect("create zip");
    let mut zw = zip::ZipWriter::new(file);

    // Broken JSON syntax
    zw.start_file(
        "project_bundle.json",
        zip::write::SimpleFileOptions::default(),
    )
    .unwrap();
    zw.write_all(b"{ broken_json: [ unclosed ...").unwrap();
    zw.finish().unwrap();

    let res = restore_from_backup_inner(&db, zip_path.to_str().unwrap()).await;
    assert!(res.is_err(), "Broken bundle must return Err");

    // Verify project in DB was not wiped or corrupted
    let mut check_p = db
        .query("SELECT * FROM ONLY type::record('projects:rollback_test_proj');")
        .await
        .unwrap();
    let p_row: Option<serde_json::Value> = check_p.take(0).unwrap();
    assert!(
        p_row.is_some(),
        "DB state must remain intact after rollback"
    );
}

#[tokio::test]
async fn restore_corrupted_zip_archive_fails_gracefully() {
    let db = create_test_db().await;
    let dir = tmp_dir("garbage_zip");
    let zip_path = dir.join("corrupted.wwiki");
    std::fs::write(&zip_path, b"NOT A VALID ZIP ARCHIVE AT ALL GARBAGE 1234567890").unwrap();

    let res = restore_from_backup_inner(&db, zip_path.to_str().unwrap()).await;
    assert!(res.is_err(), "Garbage file must return error");
    assert!(res.unwrap_err().to_string().contains("Failed to read zip"));
}

#[tokio::test]
async fn backup_and_restore_stress_large_dataset_chunks() {
    let src = create_test_db().await;
    let proj_key = "stress_proj";
    seed_project(&src, proj_key, "Stress Test Large Project").await;

    // Create custom schema
    src.query("CREATE entity_schemas:stress_item SET project_id = type::record('projects:stress_proj'), type_key = 'item', type_name = 'Предмет';")
        .await
        .unwrap();

    // Insert 1200 entities (exceeds the 500-chunk threshold)
    let mut batch_ents = Vec::new();
    for i in 0..1200 {
        batch_ents.push(serde_json::json!({
            "id": format!("entities:stress_item_{i}"),
            "schema_id": "entity_schemas:stress_item",
            "name": format!("Артефакт #{i}"),
            "attributes": { "power": i },
            "tags": ["stress", "test"]
        }));
    }
    src.query("INSERT INTO entities $batch;")
        .bind(("batch", batch_ents))
        .await
        .unwrap();

    let dir = tmp_dir("stress_export");
    let zip_path = create_cloud_backup_inner(&src, &dir)
        .await
        .expect("backup succeeds for 1200 entities");

    // Restore into fresh DB
    let dst = create_test_db().await;
    restore_from_backup_inner(&dst, &zip_path)
        .await
        .expect("restore must succeed across chunks");

    // Verify exact count of 1200 entities
    let mut count_res = dst
        .query("SELECT count() FROM entities WHERE schema_id = type::record('entity_schemas:stress_item') GROUP ALL;")
        .await
        .unwrap();
    let rows: Vec<serde_json::Value> = count_res.take(0).unwrap();
    assert_eq!(
        rows[0]["count"], 1200,
        "All 1200 entities must be restored across batch chunks"
    );
}

#[tokio::test]
async fn restore_idempotency_multiple_times() {
    let src = create_test_db().await;
    seed_project(&src, "idempotent_proj", "Idempotent Project").await;
    src.query("CREATE volumes:v1 SET project_id = type::record('projects:idempotent_proj'), title = 'Том 1';")
        .await
        .unwrap();

    let dir = tmp_dir("idempotent_export");
    let zip_path = create_cloud_backup_inner(&src, &dir)
        .await
        .expect("backup");

    let dst = create_test_db().await;
    // Restore 3 times in a row
    for _ in 0..3 {
        restore_from_backup_inner(&dst, &zip_path)
            .await
            .expect("repeat restore must succeed");
    }

    let mut res = dst
        .query("SELECT count() FROM volumes WHERE project_id = type::record('projects:idempotent_proj') GROUP ALL;")
        .await
        .unwrap();
    let rows: Vec<serde_json::Value> = res.take(0).unwrap();
    assert_eq!(
        rows[0]["count"], 1,
        "Repeated restore must be idempotent and not duplicate data"
    );
}

#[tokio::test]
async fn restore_orphan_edges_rolls_back_cleanly() {
    let db = create_test_db().await;
    seed_project(&db, "orphan_test_proj", "Orphan Test").await;

    let dir = tmp_dir("orphan_zip");
    let zip_path = dir.join("orphan.wwiki");
    let file = std::fs::File::create(&zip_path).expect("create zip");
    let mut zw = zip::ZipWriter::new(file);

    let bundle = serde_json::json!({
        "project": { "id": "projects:orphan_test_proj", "name": "Orphan Test" },
        "volumes": [],
        "chapters": [],
        "entity_schemas": [],
        "entities": [],
        // Orphan edge referencing non-existent entities
        "entity_rel": [
            {
                "id": "entity_rel:orphan_edge",
                "in": "entities:non_existent_1",
                "out": "entities:non_existent_2",
                "rel_type": "friend"
            }
        ]
    });
    zw.start_file("project_bundle.json", zip::write::SimpleFileOptions::default()).unwrap();
    zw.write_all(serde_json::to_vec_pretty(&bundle).unwrap().as_slice()).unwrap();
    zw.finish().unwrap();

    let res = restore_from_backup_inner(&db, zip_path.to_str().unwrap()).await;
    assert!(res.is_err(), "Orphan edge pointing to non-existent nodes must trigger rollback");

    // Project state must not be corrupted
    let mut check = db.query("SELECT * FROM ONLY type::record('projects:orphan_test_proj');").await.unwrap();
    let row: Option<serde_json::Value> = check.take(0).unwrap();
    assert!(row.is_some(), "Rollback preserved initial state");
}

#[tokio::test]
async fn export_excludes_edges_pointing_outside_project() {
    let src = create_test_db().await;
    seed_project(&src, "proj_a", "Project A").await;
    seed_project(&src, "proj_b", "Project B").await;

    // Schemas & Entities for A & B
    src.query("CREATE entity_schemas:sch_a SET project_id = type::record('projects:proj_a'), type_key = 'char_a', type_name = 'Char A';").await.unwrap();
    src.query("CREATE entity_schemas:sch_b SET project_id = type::record('projects:proj_b'), type_key = 'char_b', type_name = 'Char B';").await.unwrap();

    src.query("CREATE entities:ent_a1 SET schema_id = type::record('entity_schemas:sch_a'), name = 'Hero A', attributes = {}, tags = [];").await.unwrap();
    src.query("CREATE entities:ent_b1 SET schema_id = type::record('entity_schemas:sch_b'), name = 'Hero B', attributes = {}, tags = [];").await.unwrap();

    // Cross-project edge: Hero A -> Hero B
    src.query("RELATE entities:ent_a1->entity_rel->entities:ent_b1 SET rel_type = 'cross_link';").await.unwrap();

    let dir = tmp_dir("cross_export");
    let zip_path = create_cloud_backup_inner(&src, &dir).await.expect("backup A");

    // Read project_bundle.json inside the zip
    let file = std::fs::File::open(&zip_path).expect("open zip");
    let mut archive = zip::ZipArchive::new(file).expect("read zip");
    let mut bundle_file = archive.by_name("project_bundle.json").expect("bundle file");
    let mut bundle_str = String::new();
    std::io::Read::read_to_string(&mut bundle_file, &mut bundle_str).expect("read bundle");
    let bundle: serde_json::Value = serde_json::from_str(&bundle_str).expect("parse bundle");

    // Cross-project edge must NOT be in project_bundle.json
    let rels = bundle.get("entity_rel").and_then(|v| v.as_array()).cloned().unwrap_or_default();
    assert_eq!(rels.len(), 0, "Cross-project edges must be excluded from single-project bundle");
}

#[tokio::test]
async fn restore_preserves_custom_string_ids() {
    let src = create_test_db().await;
    seed_project(&src, "custom_id_proj", "Custom ID Project").await;

    src.query("CREATE entity_schemas:custom_char SET project_id = type::record('projects:custom_id_proj'), type_key = 'hero', type_name = 'Герой';").await.unwrap();
    src.query("CREATE entities:hero_slayer_of_dragons SET schema_id = type::record('entity_schemas:custom_char'), name = 'Убийца Драконов', attributes = {}, tags = [];").await.unwrap();

    let dir = tmp_dir("custom_id_export");
    let zip_path = create_cloud_backup_inner(&src, &dir).await.expect("backup");

    let dst = create_test_db().await;
    restore_from_backup_inner(&dst, &zip_path).await.expect("restore");

    // Must exist under exact custom slug ID
    let mut check = dst.query("SELECT * FROM ONLY type::record('entities:hero_slayer_of_dragons');").await.unwrap();
    let row: Option<serde_json::Value> = check.take(0).unwrap();
    assert!(row.is_some(), "Custom slug ID must be preserved exactly");
    assert_eq!(row.unwrap()["name"], "Убийца Драконов");
}

#[tokio::test]
async fn restore_project_a_does_not_touch_project_b() {
    let db = create_test_db().await;
    seed_project(&db, "isolated_a", "Project A").await;
    seed_project(&db, "isolated_b", "Project B").await;

    db.query("CREATE volumes:vol_b SET project_id = type::record('projects:isolated_b'), title = 'Том Проекта Б';").await.unwrap();
    db.query("CREATE chapters:chap_b SET volume_id = type::record('volumes:vol_b'), title = 'Глава Б', content = 'Секрет Б';").await.unwrap();

    // Make backup of A
    let dir = tmp_dir("isolated_a_export");
    let zip_path = create_cloud_backup_inner(&db, &dir).await.expect("backup A");

    // Mutate A in DB
    db.query("CREATE volumes:vol_a_unwanted SET project_id = type::record('projects:isolated_a'), title = 'Лишний';").await.unwrap();

    // Restore A
    restore_from_backup_inner(&db, &zip_path).await.expect("restore A");

    // Project B must be 100% intact!
    let mut check_b_vol = db.query("SELECT * FROM ONLY type::record('volumes:vol_b');").await.unwrap();
    let b_vol: Option<serde_json::Value> = check_b_vol.take(0).unwrap();
    assert!(b_vol.is_some(), "Project B volume was untouched");

    let mut check_b_chap = db.query("SELECT * FROM ONLY type::record('chapters:chap_b');").await.unwrap();
    let b_chap: Option<serde_json::Value> = check_b_chap.take(0).unwrap();
    assert!(b_chap.is_some(), "Project B chapter was untouched");
    assert_eq!(b_chap.unwrap()["content"], "Секрет Б");
}

#[tokio::test]
async fn restore_bundle_without_default_schemas_keeps_existing_defaults() {
    let dst = create_test_db().await;

    // Verify default_character exists prior to restore
    let mut before_check = dst.query("SELECT * FROM ONLY type::record('entity_schemas:default_character');").await.unwrap();
    let before_row: Option<serde_json::Value> = before_check.take(0).unwrap();
    assert!(before_row.is_some(), "Default schema exists before restore");

    let dir = tmp_dir("bundle_no_defaults");
    let zip_path = dir.join("no_defaults.wwiki");
    let file = std::fs::File::create(&zip_path).expect("create zip");
    let mut zw = zip::ZipWriter::new(file);

    let bundle = serde_json::json!({
        "project": { "id": "projects:clean_proj", "name": "Clean Project" },
        "volumes": [],
        "chapters": [],
        "entity_schemas": [], // No defaults here
        "entities": []
    });
    zw.start_file("project_bundle.json", zip::write::SimpleFileOptions::default()).unwrap();
    zw.write_all(serde_json::to_vec_pretty(&bundle).unwrap().as_slice()).unwrap();
    zw.finish().unwrap();

    restore_from_backup_inner(&dst, zip_path.to_str().unwrap()).await.expect("restore succeeds");

    // Default schema must STILL exist after restore
    let mut after_check = dst.query("SELECT * FROM ONLY type::record('entity_schemas:default_character');").await.unwrap();
    let after_row: Option<serde_json::Value> = after_check.take(0).unwrap();
    assert!(after_row.is_some(), "Default schema must be preserved after restore");
}

#[tokio::test]
async fn restore_bundle_with_modified_default_schema_does_not_override() {
    let dst = create_test_db().await;

    let dir = tmp_dir("bundle_hacked_default");
    let zip_path = dir.join("hacked_default.wwiki");
    let file = std::fs::File::create(&zip_path).expect("create zip");
    let mut zw = zip::ZipWriter::new(file);

    // Rogue bundle trying to hijack default_character
    let bundle = serde_json::json!({
        "project": { "id": "projects:rogue_proj", "name": "Rogue Project" },
        "volumes": [],
        "chapters": [],
        "entity_schemas": [
            {
                "id": "entity_schemas:default_character",
                "type_key": "character",
                "type_name": "HACKED_NAME",
                "project_id": "global"
            }
        ],
        "entities": []
    });
    zw.start_file("project_bundle.json", zip::write::SimpleFileOptions::default()).unwrap();
    zw.write_all(serde_json::to_vec_pretty(&bundle).unwrap().as_slice()).unwrap();
    zw.finish().unwrap();

    restore_from_backup_inner(&dst, zip_path.to_str().unwrap()).await.expect("restore succeeds");

    // Check that default_character was filtered out and NOT renamed to HACKED_NAME
    let mut check = dst.query("SELECT * FROM ONLY type::record('entity_schemas:default_character');").await.unwrap();
    let row: Option<serde_json::Value> = check.take(0).unwrap();
    assert!(row.is_some());
    assert_ne!(row.unwrap()["type_name"], "HACKED_NAME", "Default schemas must not be overridden from bundle");
}

#[tokio::test]
async fn restore_with_empty_nodes_and_edges_succeeds() {
    let src = create_test_db().await;
    seed_project(&src, "empty_proj", "Empty Project").await;

    let dir = tmp_dir("empty_export");
    let zip_path = create_cloud_backup_inner(&src, &dir).await.expect("backup empty project");

    let dst = create_test_db().await;
    let res = restore_from_backup_inner(&dst, &zip_path).await;
    assert!(res.is_ok(), "Empty project backup and restore must succeed cleanly: {:?}", res.err());
}

#[test]
fn get_launch_args_returns_none_without_wwiki_arg() {
    // При обычном запуске тестов первый аргумент — путь к бинарнику,
    // а не аргумент вида `*.wwiki`, поэтому возвращается None.
    assert!(get_launch_args().is_none());
}

