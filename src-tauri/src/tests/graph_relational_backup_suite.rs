//! Matrix Integration Tests for Backup & Restore (Graph, Relational, and Mixed databases).
//!
//! Covers the full matrix with realistic database states (pre-seeded destination DB,
//! Cyrillic identifiers with spaces, SCHEMAFULL constraints, graph traversal, and atomic rollback):
//! 1. Graph DB Positive: Pre-existing destination state, Cyrillic IDs with spaces, RELATE edges, graph traversal.
//! 2. Graph DB Negative: Orphan edge referencing non-existent nodes rejected with pre-flight check and atomic rollback.
//! 3. Relational DB Positive: Pre-existing calendar & planet collision resolved via UPSERT MERGE without type coercion or duplicate errors.
//! 4. Relational DB Negative: SCHEMAFULL type violation aborts transaction and preserves destination DB integrity.
//! 5. Mixed DB Positive: Full literary universe with pre-existing state + zombie record purge + graph relations + timeline analytics.
//! 6. Mixed DB Negative: Corrupted mixed payload rejected with complete atomic rollback.

use std::io::Write;
use std::path::PathBuf;
use std::sync::atomic::{AtomicUsize, Ordering};

use worldwiki_infrastructure::storage::backup::*;
use super::common::{create_test_db, seed_project};

static __MATRIX_TMP_IDX: AtomicUsize = AtomicUsize::new(0);

fn tmp_matrix_dir(tag: &str) -> PathBuf {
    let idx = __MATRIX_TMP_IDX.fetch_add(1, Ordering::SeqCst);
    let dir = std::env::temp_dir().join(format!(
        "worldwiki-matrix-test-{}-{}-{}-{}",
        std::process::id(),
        idx,
        tag,
        uuid::Uuid::new_v4()
    ));
    let _ = std::fs::remove_dir_all(&dir);
    let _ = std::fs::create_dir_all(&dir);
    dir
}

// ============================================================================
// 1. GRAPH DATABASE: POSITIVE (PRE-EXISTING STATE & CYRILLIC IDENTIFIERS)
// ============================================================================
#[tokio::test]
async fn test_graph_database_positive_roundtrip_with_preexisting_state() {
    let src = create_test_db().await;

    // 1. Source Database with Cyrillic project name containing spaces and punctuation
    src.query("UPSERT type::record('projects', 'Не один') SET name = 'Не один';")
        .await
        .unwrap();

    src.query(
        "UPSERT type::record('volumes', 'Том 1. Война') SET project_id = fn::normalize_project_id('Не один'), title = 'Том 1. Война';"
    )
    .await
    .unwrap();

    src.query(
        "UPSERT type::record('chapters', 'Глава 1. Начало') SET volume_id = type::record('volumes', 'Том 1. Война'), title = 'Глава 1. Начало', content = 'В начале было слово...', word_count = 4;"
    )
    .await
    .unwrap();

    // Graph relation edges via RELATE
    src.query("RELATE projects:⟨Не один⟩->contains:⟨edge_pv1⟩->volumes:⟨Том 1. Война⟩ SET sort_order = 1;")
        .await
        .unwrap();
    src.query("RELATE volumes:⟨Том 1. Война⟩->contains:⟨edge_vc1⟩->chapters:⟨Глава 1. Начало⟩ SET sort_order = 1;")
        .await
        .unwrap();

    let dir = tmp_matrix_dir("graph_pos_preexist");
    let zip_path = create_cloud_backup_inner(&src, &dir, Some("Не один"))
        .await
        .expect("graph backup with Cyrillic and spaces should succeed");

    // 2. Destination Database PRE-SEEDED with existing project state (simulating real runtime re-import)
    let dst = create_test_db().await;
    dst.query("UPSERT type::record('projects', 'Не один') SET name = 'Не один (Черновик)';")
        .await
        .unwrap();
    dst.query("UPSERT type::record('volumes', 'Том 1. Война') SET project_id = fn::normalize_project_id('Не один'), title = 'Старый черновик тома';")
        .await
        .unwrap();

    // 3. Restore backup over pre-existing destination state
    restore_from_backup_inner(&dst, &zip_path)
        .await
        .expect("graph restore must succeed over pre-existing state without token or duplicate errors");

    // 4. Verify graph edges exist and are true relations
    let mut q = dst.query("SELECT *, type::string(in) AS in_str, type::string(out) AS out_str FROM contains;").await.unwrap();
    let rows: Vec<serde_json::Value> = q.take(0).unwrap();
    assert_eq!(rows.len(), 2, "Expected 2 contains relation edges restored");

    // 5. Verify native graph traversal works smoothly with Cyrillic record IDs
    let mut trav_q = dst.query("SELECT ->contains->volumes->contains->chapters.title AS titles FROM ONLY type::record('projects', 'Не один');").await.unwrap();
    let trav_row: Option<serde_json::Value> = trav_q.take(0).unwrap();
    assert!(trav_row.is_some(), "Graph traversal must return result");
    let titles = &trav_row.unwrap()["titles"];
    assert!(
        titles.to_string().contains("Глава 1. Начало"),
        "Traversal must reach restored chapter title: {:?}",
        titles
    );
}

// ============================================================================
// 2. GRAPH DATABASE: NEGATIVE (ORPHAN EDGE DETECTED & ATOMIC ROLLBACK)
// ============================================================================
#[tokio::test]
async fn test_graph_database_negative_orphan_edge_rollback() {
    let dst = create_test_db().await;
    seed_project(&dst, "safe_graph_proj", "Protected Safe Project").await;

    let dir = tmp_matrix_dir("graph_neg_orphan");
    let zip_path = dir.join("orphan_graph.wwiki");
    let file = std::fs::File::create(&zip_path).expect("create zip");
    let mut zw = zip::ZipWriter::new(file);

    // Bundle with an edge pointing to non-existent nodes (orphan relation)
    let bundle = serde_json::json!({
        "project": { "id": "projects:⟨broken_graph_proj⟩", "name": "Broken Graph Project" },
        "volumes": [
            { "id": "volumes:⟨vol_ok⟩", "title": "Vol OK", "project_id": "projects:⟨broken_graph_proj⟩" }
        ],
        "chapters": [],
        "contains": [
            {
                "id": "contains:⟨orphan_edge_1⟩",
                "in": "projects:⟨broken_graph_proj⟩",
                "out": "volumes:⟨ghost_missing_node⟩" // Ghost node missing in bundle and DB!
            }
        ]
    });

    zw.start_file("project_bundle.json", zip::write::SimpleFileOptions::default()).unwrap();
    zw.write_all(serde_json::to_vec_pretty(&bundle).unwrap().as_slice()).unwrap();
    zw.finish().unwrap();

    let res = restore_from_backup_inner(&dst, zip_path.to_str().unwrap()).await;
    assert!(
        res.is_err(),
        "Restoring bundle with orphan edge must fail validation"
    );

    // Verify atomic safety: pre-existing project untouched, corrupted project never created
    let mut check_safe = dst.query("SELECT * FROM ONLY type::record('projects:safe_graph_proj');").await.unwrap();
    let safe_row: Option<serde_json::Value> = check_safe.take(0).unwrap();
    assert!(safe_row.is_some(), "Pre-existing safe project must remain intact");

    let mut check_broken = dst.query("SELECT * FROM ONLY type::record('projects:broken_graph_proj');").await.unwrap();
    let broken_row: Option<serde_json::Value> = check_broken.take(0).unwrap();
    assert!(broken_row.is_none(), "Corrupted project must not be committed");

    let mut q_edge = dst.query("SELECT * FROM ONLY type::record('contains:orphan_edge_1');").await.unwrap();
    let edge_row: Option<serde_json::Value> = q_edge.take(0).unwrap();
    assert!(edge_row.is_none(), "Orphan edge must not exist in database");
}

// ============================================================================
// 3. RELATIONAL DATABASE: POSITIVE (OVER PRE-EXISTING CALENDAR & SCHEMAFULL)
// ============================================================================
#[tokio::test]
async fn test_relational_database_positive_over_preexisting_calendar() {
    let src = create_test_db().await;
    seed_project(&src, "rel_proj", "Relational Project").await;

    // Custom entity schema
    src.query("CREATE entity_schemas:schema_magic SET project_id = type::record('projects:rel_proj'), type_key = 'magic', type_name = 'Магия';")
        .await
        .unwrap();

    // Entity with attributes and tags
    src.query(r#"
        CREATE entities:spell_1 SET 
            schema_id = type::record('entity_schemas:schema_magic'),
            name = 'Огненный шар',
            tags = ['огонь', 'атака'],
            attributes = { mana_cost: 25 };
    "#).await.unwrap();

    // Planet & Calendar (using real calendar key pattern that previously clashed in runtime)
    src.query("CREATE planets:planet_rel SET project_id = type::record('projects:rel_proj'), name = 'Марс', ticks_per_day = 86400;")
        .await
        .unwrap();
    src.query(r#"
        CREATE calendars:cal_667816c8bc674a33 SET 
            planet_id = type::record('planets:planet_rel'), 
            name = 'Марсианский',
            data = {
                "дней_в_неделе": 7,
                "названия_дней_недели": ['Пн', 'Вт'],
                "первый_месяц_года": 0,
                "месяцы": [],
                "эпохи": []
            };
    "#).await.unwrap();

    let dir = tmp_matrix_dir("rel_pos_preexist");
    let zip_path = create_cloud_backup_inner(&src, &dir, Some("rel_proj"))
        .await
        .expect("relational backup succeeds");

    // Destination Database PRE-SEEDED with conflicting calendar ID (runtime default creation state)
    let dst = create_test_db().await;
    dst.query("CREATE planets:planet_rel SET project_id = type::record('projects:rel_proj'), name = 'Марс', ticks_per_day = 86400;")
        .await
        .unwrap();
    dst.query(r#"
        CREATE calendars:cal_667816c8bc674a33 SET 
            planet_id = type::record('planets:planet_rel'), 
            name = 'Дефолтный календарь',
            data = { "дней_в_неделе": 7 };
    "#).await.unwrap();

    // Restore must safely merge into existing calendar without AlreadyExists or created_at NONE error
    restore_from_backup_inner(&dst, &zip_path)
        .await
        .expect("relational restore must succeed over existing calendar ID");

    // Verify entity data
    let mut eq = dst.query("SELECT * FROM ONLY type::record('entities:spell_1');").await.unwrap();
    let ent: Option<serde_json::Value> = eq.take(0).unwrap();
    assert!(ent.is_some());
    let e_val = ent.unwrap();
    assert_eq!(e_val["name"], "Огненный шар");
    assert_eq!(e_val["attributes"]["mana_cost"], 25);

    // Verify calendar was updated smoothly
    let mut cq = dst.query("SELECT * FROM ONLY type::record('calendars:cal_667816c8bc674a33');").await.unwrap();
    let cal: Option<serde_json::Value> = cq.take(0).unwrap();
    assert!(cal.is_some());
    assert_eq!(cal.unwrap()["name"], "Марсианский");
}

// ============================================================================
// 4. RELATIONAL DATABASE: NEGATIVE (SCHEMAFULL CONSTRAINT VIOLATION & ROLLBACK)
// ============================================================================
#[tokio::test]
async fn test_relational_database_negative_schemfull_type_violation() {
    let dst = create_test_db().await;
    seed_project(&dst, "safe_rel_proj", "Protected Relational Project").await;

    let dir = tmp_matrix_dir("rel_neg_schemfull");
    let zip_path = dir.join("invalid_schema.wwiki");
    let file = std::fs::File::create(&zip_path).expect("create zip");
    let mut zw = zip::ZipWriter::new(file);

    // Chapter with invalid type for word_count (string instead of int in SCHEMAFULL table)
    let bundle = serde_json::json!({
        "project": { "id": "projects:⟨violating_proj⟩", "name": "Violating Project" },
        "volumes": [
            { "id": "volumes:⟨vol_v⟩", "title": "Vol V", "project_id": "projects:⟨violating_proj⟩" }
        ],
        "chapters": [
            {
                "id": "chapters:⟨ch_v⟩",
                "volume_id": "volumes:⟨vol_v⟩",
                "title": "Bad Chapter",
                "content": "text",
                "word_count": "NOT_AN_INT" // Schema strictly requires int!
            }
        ]
    });

    zw.start_file("project_bundle.json", zip::write::SimpleFileOptions::default()).unwrap();
    zw.write_all(serde_json::to_vec_pretty(&bundle).unwrap().as_slice()).unwrap();
    zw.finish().unwrap();

    let res = restore_from_backup_inner(&dst, zip_path.to_str().unwrap()).await;
    assert!(res.is_err(), "Schema violation in SCHEMAFULL table must fail transaction");

    // Verify atomic rollback: pre-existing project unharmed, violating project completely rolled back
    let mut safe_check = dst.query("SELECT * FROM ONLY type::record('projects:safe_rel_proj');").await.unwrap();
    let safe_row: Option<serde_json::Value> = safe_check.take(0).unwrap();
    assert!(safe_row.is_some(), "Pre-existing safe project must remain intact");

    let mut check_q = dst.query("SELECT * FROM ONLY type::record('projects:violating_proj');").await.unwrap();
    let p_row: Option<serde_json::Value> = check_q.take(0).unwrap();
    assert!(p_row.is_none(), "Transaction abort must roll back invalid project");
}

// ============================================================================
// 5. MIXED DATABASE: POSITIVE (FULL UNIVERSE ROUNDTRIP, ZOMBIE PURGE, ANALYTICS)
// ============================================================================
#[tokio::test]
async fn test_mixed_database_positive_full_universe_roundtrip() {
    let src = create_test_db().await;

    // 1. Source Database with full literary universe
    src.query("UPSERT type::record('projects', 'Война и Мир') SET name = 'Война и Мир';").await.unwrap();

    // Hierarchy
    src.query("CREATE volumes:mv_1 SET project_id = fn::normalize_project_id('Война и Мир'), title = 'Том Войны';").await.unwrap();
    src.query("CREATE chapters:mc_1 SET volume_id = type::record('volumes:mv_1'), title = 'Битва', content = 'Глава о битве', word_count = 100;").await.unwrap();
    src.query("RELATE projects:⟨Война и Мир⟩->contains:m_pv->volumes:mv_1 SET sort_order = 0;").await.unwrap();
    src.query("RELATE volumes:mv_1->contains:m_vc->chapters:mc_1 SET sort_order = 0;").await.unwrap();

    // Lore Entities
    src.query("CREATE entity_schemas:schema_char SET project_id = fn::normalize_project_id('Война и Мир'), type_key = 'character', type_name = 'Персонаж';").await.unwrap();
    src.query("CREATE entities:hero SET schema_id = type::record('entity_schemas:schema_char'), name = 'Герой', attributes = {}, tags = [];").await.unwrap();
    src.query("CREATE entities:villain SET schema_id = type::record('entity_schemas:schema_char'), name = 'Злодей', attributes = {}, tags = [];").await.unwrap();

    // Entity relation edge (hero -> enemy -> villain)
    src.query("RELATE entities:hero->entity_rel:hero_villain->entities:villain SET rel_type = 'враг';").await.unwrap();

    // Planet & Calendar for timeline
    src.query("CREATE planets:mixed_planet SET project_id = fn::normalize_project_id('Война и Мир'), name = 'Земля', ticks_per_day = 86400;").await.unwrap();
    src.query(r#"
        CREATE calendars:cal_default_war SET 
            planet_id = type::record('planets:mixed_planet'), 
            name = 'Солнечный',
            data = {
                "дней_в_неделе": 7,
                "названия_дней_недели": ['Пн', 'Вт'],
                "первый_месяц_года": 0,
                "месяцы": [],
                "эпохи": []
            };
    "#).await.unwrap();

    // Timeline event & participation
    src.query("CREATE timeline_events:te_battle SET project_id = fn::normalize_project_id('Война и Мир'), calendar_id = type::record('calendars:cal_default_war'), title = 'Великая Битва', m_abs = 1500;").await.unwrap();
    src.query("RELATE entities:hero->participates_in:part_hero->timeline_events:te_battle SET role = 'Командир';").await.unwrap();

    let dir = tmp_matrix_dir("mixed_pos_full");
    let zip_path = create_cloud_backup_inner(&src, &dir, Some("Война и Мир"))
        .await
        .expect("mixed project backup succeeds");

    // 2. Destination Database PRE-SEEDED with conflicting state + a zombie chapter
    let dst = create_test_db().await;
    dst.query("UPSERT type::record('projects', 'Война и Мир') SET name = 'Война и Мир (Старый)';").await.unwrap();
    dst.query("CREATE volumes:mv_1 SET project_id = fn::normalize_project_id('Война и Мир'), title = 'Старый том';").await.unwrap();
    dst.query("CREATE chapters:mc_zombie SET volume_id = type::record('volumes:mv_1'), title = 'Зомби-глава', content = 'Устаревший текст', word_count = 10;").await.unwrap();

    // 3. Restore backup
    restore_from_backup_inner(&dst, &zip_path)
        .await
        .expect("mixed project restore succeeds over pre-existing state");

    // 4. Check all facets:
    // a. Zombie chapter was purged
    let mut check_zombie = dst.query("SELECT * FROM ONLY type::record('chapters:mc_zombie');").await.unwrap();
    let zombie_row: Option<serde_json::Value> = check_zombie.take(0).unwrap();
    assert!(zombie_row.is_none(), "Pre-existing zombie chapter must be purged upon restore");

    // b. Hierarchy relation restored
    let mut check_tree = dst.query("SELECT ->contains->volumes.title AS vol_titles FROM ONLY type::record('projects', 'Война и Мир');").await.unwrap();
    let tree_row: Option<serde_json::Value> = check_tree.take(0).unwrap();
    assert_eq!(tree_row.unwrap()["vol_titles"][0], "Том Войны");

    // c. Entity relation edge restored
    let mut check_er = dst.query("SELECT out.name AS target_name FROM entity_rel WHERE in = type::record('entities:hero');").await.unwrap();
    let er_rows: Vec<serde_json::Value> = check_er.take(0).unwrap();
    assert_eq!(
        er_rows.first().and_then(|r| r.get("target_name")).and_then(|v| v.as_str()),
        Some("Злодей")
    );

    // d. Timeline inspector query (analytics function executes without runtime crash)
    let mut anal_q = dst.query("fn::get_timeline_inspector_data(type::record('projects', 'Война и Мир'));").await.unwrap();
    let anal_res: Option<serde_json::Value> = anal_q.take(0).unwrap();
    assert!(anal_res.is_some(), "fn::get_timeline_inspector_data must run smoothly on restored project");
}

// ============================================================================
// 6. MIXED DATABASE: NEGATIVE (CORRUPTED MIXED PAYLOAD & ATOMIC ROLLBACK)
// ============================================================================
#[tokio::test]
async fn test_mixed_database_negative_corrupted_payload_atomic_rollback() {
    let dst = create_test_db().await;
    seed_project(&dst, "safe_mixed_dest", "Protected Universe").await;
    dst.query("CREATE volumes:mv_safe SET project_id = type::record('projects:safe_mixed_dest'), title = 'Safe Volume';").await.unwrap();

    let dir = tmp_matrix_dir("mixed_neg_rollback");
    let zip_path = dir.join("corrupted_mixed.wwiki");
    let file = std::fs::File::create(&zip_path).expect("create zip");
    let mut zw = zip::ZipWriter::new(file);

    // Mixed bundle containing valid project & volume, but chapter violates SCHEMAFULL
    let bundle = serde_json::json!({
        "project": { "id": "projects:⟨doomed_mixed_proj⟩", "name": "Doomed Universe" },
        "volumes": [
            { "id": "volumes:mv_good", "title": "Good Volume", "project_id": "projects:⟨doomed_mixed_proj⟩" }
        ],
        "chapters": [
            {
                "id": "chapters:mc_broken",
                "volume_id": "volumes:mv_good",
                "title": "Broken Chapter",
                "content": "text",
                "unregistered_strict_field": "ILLEGAL_SCHEMAFULL_DATA"
            }
        ],
        "contains": [
            {
                "id": "contains:edge_doomed",
                "in": "projects:⟨doomed_mixed_proj⟩",
                "out": "volumes:mv_good"
            }
        ]
    });

    zw.start_file("project_bundle.json", zip::write::SimpleFileOptions::default()).unwrap();
    zw.write_all(serde_json::to_vec_pretty(&bundle).unwrap().as_slice()).unwrap();
    zw.finish().unwrap();

    let res = restore_from_backup_inner(&dst, zip_path.to_str().unwrap()).await;
    assert!(res.is_err(), "Restoring corrupted mixed bundle must error out");

    // Ensure atomic rollback: pre-existing safe project & volume untouched
    let mut q_safe_p = dst.query("SELECT * FROM ONLY type::record('projects:safe_mixed_dest');").await.unwrap();
    assert!(q_safe_p.take::<Option<serde_json::Value>>(0).unwrap().is_some());

    let mut q_safe_v = dst.query("SELECT * FROM ONLY type::record('volumes:mv_safe');").await.unwrap();
    assert!(q_safe_v.take::<Option<serde_json::Value>>(0).unwrap().is_some());

    // Ensure nothing from the doomed project remained committed
    let mut q_proj = dst.query("SELECT * FROM ONLY type::record('projects:doomed_mixed_proj');").await.unwrap();
    assert!(q_proj.take::<Option<serde_json::Value>>(0).unwrap().is_none());

    let mut q_vol = dst.query("SELECT * FROM ONLY type::record('volumes:mv_good');").await.unwrap();
    assert!(q_vol.take::<Option<serde_json::Value>>(0).unwrap().is_none());

    let mut q_edge = dst.query("SELECT * FROM ONLY type::record('contains:edge_doomed');").await.unwrap();
    assert!(q_edge.take::<Option<serde_json::Value>>(0).unwrap().is_none());
}
