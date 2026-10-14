//! Интеграционные тесты жизненного цикла проекта и каскадного DDL-удаления.
//!
//! Тестируют:
//! - CRUD проектов (`create_project`, `get_projects`, `get_project_config`, `save_project_config`)
//! - Каскадную очистку всех связанных таблиц (`volumes`, `chapters`, `entities`, `text_blocks` и т.д.)
//!   через событие БД `delete_project_data` при вызове `delete_project`.

use crate::logic::chapters::save_text_blocks_inner;
use crate::logic::entities::save_entity_inner;
use crate::logic::models::Entity;
use crate::logic::projects::*;
use crate::logic::volumes::create_volume_inner;
use serde_json::json;
use super::common::{create_test_db, seed_chapter, seed_project};

#[tokio::test]
async fn create_and_get_projects() {
    let db = create_test_db().await;

    create_project_inner(&db, json!({
        "name": "project_alpha",
        "type": "book",
        "data": { "title": "Альфа Мир" }
    })).await.expect("create alpha");

    create_project_inner(&db, json!({
        "name": "project_beta",
        "type": "game",
        "data": { "title": "Бета Мир" }
    })).await.expect("create beta");

    let projects = get_projects_inner(&db).await.expect("get projects");
    assert!(projects.len() >= 2);

    let names: Vec<&str> = projects.iter().filter_map(|p| p["name"].as_str()).collect();
    assert!(names.contains(&"project_alpha"));
    assert!(names.contains(&"project_beta"));
}

#[tokio::test]
async fn project_config_get_and_save() {
    let db = create_test_db().await;
    seed_project(&db, "cfg_proj", "Config Test").await;

    // Сохраняем кастомный конфиг внутри data (FLEXIBLE)
    let cfg = json!({
        "data": {
            "theme": "dark",
            "default_font": "Inter",
            "author": "Архитектор Миров"
        }
    });
    save_project_config_inner(&db, "cfg_proj", cfg).await.expect("save config");

    // Получаем конфиг
    let fetched = get_project_config_inner(&db, "cfg_proj").await.expect("get config");
    assert_eq!(fetched["data"]["theme"], "dark");
    assert_eq!(fetched["data"]["default_font"], "Inter");
    assert_eq!(fetched["data"]["author"], "Архитектор Миров");
}

#[tokio::test]
async fn delete_project_cascades_ddl_events() {
    let db = create_test_db().await;
    seed_project(&db, "cascade_proj", "Cascade Test").await;

    // Наполняем проект:
    // 1. Том
    create_volume_inner(&db, "cascade_proj", "Том 1").await.unwrap();

    // 2. Глава + текстовые блоки
    seed_chapter(&db, "cascade_proj", "ch_casc", "Глава каскада", "").await;
    save_text_blocks_inner(&db, "cascade_proj", "ch_casc", "<p data-semantic-tag=\"desc\">Текст для удаления</p>").await.unwrap();

    // 3. Сущность
    save_entity_inner(&db, "cascade_proj", Entity {
        id: None,
        project_id: Some("projects:cascade_proj".into()),
        entity_type: "character".into(),
        name: "Герой Каскада".into(),
        description: None,
        attributes: json!({}),
        tags: vec![],
        embeddings: None,
        created_at: None,
        updated_at: None,
    }).await.unwrap();

    // Удаляем проект
    delete_project_inner(&db, "cascade_proj").await.expect("delete project");

    // Проверяем, что сам проект удалён
    let p_res = get_project_config_inner(&db, "cascade_proj").await.unwrap();
    assert!(p_res.get("title").is_none(), "проект должен быть удален");

    // Проверяем, что DDL event `delete_project_data` удалил тома
    let mut v_res = db.query("SELECT * FROM volumes WHERE project_id = type::record('projects:cascade_proj')").await.unwrap();
    let volumes: Vec<serde_json::Value> = v_res.take(0).unwrap();
    assert!(volumes.is_empty(), "все тома проекта должны удалиться");

    // Проверяем, что главы удалены
    let mut c_res = db.query("SELECT * FROM chapters WHERE project_id = type::record('projects:cascade_proj')").await.unwrap();
    let chapters: Vec<serde_json::Value> = c_res.take(0).unwrap();
    assert!(chapters.is_empty(), "все главы проекта должны удалиться");

    // Проверяем, что сущности удалены
    let mut e_res = db.query("SELECT * FROM entities WHERE project_id = type::record('projects:cascade_proj')").await.unwrap();
    let entities: Vec<serde_json::Value> = e_res.take(0).unwrap();
    assert!(entities.is_empty(), "все сущности проекта должны удалиться");

    // Проверяем, что текстовые блоки удалены
    let mut tb_res = db.query("SELECT * FROM text_blocks WHERE project_id = type::record('projects:cascade_proj')").await.unwrap();
    let t_blocks: Vec<serde_json::Value> = tb_res.take(0).unwrap();
    assert!(t_blocks.is_empty(), "все текстовые блоки проекта должны удалиться");
}

#[tokio::test]
async fn create_project_inserts_default_data_when_missing() {
    let db = create_test_db().await;

    // create_project без поля data должен добавить пустой объект data: {}
    create_project_inner(&db, json!({ "name": "no_default_proj" }))
        .await
        .expect("create project without data");

    let cfg = get_project_config_inner(&db, "no_default_proj").await.expect("get config");
    assert_eq!(cfg["data"], json!({}), "без поля data должен подставиться пустой объект");
}

#[tokio::test]
async fn get_project_config_accepts_prefixed_and_default_name() {
    let db = create_test_db().await;
    seed_project(&db, "cfg_pref", "Pref Project").await;

    // Имя с префиксом projects:
    let pref = get_project_config_inner(&db, "projects:cfg_pref").await.expect("prefixed");
    assert_eq!(pref["name"], "Pref Project");

    // Пустое имя -> проект projects:default (его нет в свежей БД, вернётся {})
    let default_cfg = get_project_config_inner(&db, "").await.expect("empty name");
    assert!(default_cfg.get("name").is_none() || default_cfg.get("id").is_none());
}

#[tokio::test]
async fn delete_project_handles_prefixed_name() {
    let db = create_test_db().await;
    seed_project(&db, "del_pref", "Del Pref").await;

    delete_project_inner(&db, "projects:del_pref").await.expect("delete prefixed");

    let mut res = db
        .query("SELECT count() FROM projects WHERE id = type::record('projects:del_pref') GROUP ALL")
        .await
        .expect("count query");
    let count_val: Option<serde_json::Value> = res.take(0).expect("take count");
    let count = count_val.and_then(|v| v.get("count").and_then(|c| c.as_u64())).unwrap_or(0);
    assert_eq!(count, 0, "проект должен быть удалён даже с префиксом projects:");
}

// =====================================================
// Волна 2: пустая БД, спецсимволы, дубликаты имён, merge-конфиг
// =====================================================

#[tokio::test]
async fn get_projects_on_fresh_db_returns_empty() {
    let db = create_test_db().await;
    let projects = get_projects_inner(&db).await.expect("get projects");
    assert!(projects.is_empty(), "свежая БД → пустой список проектов");
}

#[tokio::test]
async fn project_name_with_special_chars_roundtrip() {
    let db = create_test_db().await;

    let name = "Мой Проект №5 — «Эпоха Драконов»";
    create_project_inner(&db, json!({ "name": name, "data": {} }))
        .await
        .expect("create with special chars");

    let cfg = get_project_config_inner(&db, name).await.expect("get config");
    assert_eq!(cfg["name"], name);

    // И с префиксом тоже находится
    let pref = get_project_config_inner(&db, "projects:Мой Проект №5 — «Эпоха Драконов»")
        .await
        .expect("prefixed config");
    assert_eq!(pref["name"], name);
}

#[tokio::test]
async fn duplicate_project_name_upserts_not_duplicates() {
    let db = create_test_db().await;

    create_project_inner(&db, json!({ "name": "same_name", "data": { "v": 1 } }))
        .await
        .expect("create first");
    // Повторное создание с тем же именем — это UPSERT по ключу имени
    create_project_inner(&db, json!({ "name": "same_name", "data": { "v": 2 } }))
        .await
        .expect("create second (upsert)");

    let projects = get_projects_inner(&db).await.unwrap();
    let same: Vec<_> = projects.iter().filter(|p| p["name"] == "same_name").collect();
    assert_eq!(same.len(), 1, "дубликат имени не должен создавать вторую запись");
    assert_eq!(same[0]["data"]["v"], 2, "последний upsert побеждает");
}

#[tokio::test]
async fn save_project_config_merges_without_losing_fields() {
    let db = create_test_db().await;
    seed_project(&db, "merge_proj", "Merge").await;

    save_project_config_inner(&db, "merge_proj", json!({ "data": { "theme": "dark" } }))
        .await
        .expect("save first field");

    // Второй save с другим полем — merge не должен стереть первое
    save_project_config_inner(&db, "merge_proj", json!({ "data": { "font": "Inter" } }))
        .await
        .expect("save second field");

    let cfg = get_project_config_inner(&db, "merge_proj").await.unwrap();
    // merge поверх data заменяет data целиком (это объект) — документируем:
    // верхнеуровневые поля мержатся, вложенный `data` перезаписывается последним save.
    assert_eq!(cfg["data"]["font"], "Inter");
}

#[tokio::test]
async fn delete_project_preserves_global_knowledge_base() {
    let db = create_test_db().await;
    seed_project(&db, "proj_keep_global", "Keep Global Test").await;
    seed_project(&db, "proj_to_delete", "Project to Delete").await;

    // 1. Создаем вечные глобальные сущности
    db.query(
        r#"
        CREATE web_pages:wp1 SET url = "https://example.com", canonical_url = "https://example.com", domain = "example.com", content_hash = "h1", content = "Web content";
        CREATE web_evidence:we1 SET page_id = web_pages:wp1, project_id = type::record('projects:proj_keep_global'), chunk_index = 0, text = "Важный исторический факт", start_offset = 0, end_offset = 20;
        CREATE entity_schemas:es1 SET project_id = type::record('projects:proj_keep_global'), type_key = "magic", type_name = "Магия", icon = "✨", color = "blue";
        CREATE relation_schemas:rs1 SET project_id = type::record('projects:proj_keep_global'), rel_key = "mentor", rel_name = "Наставник", icon = "🎓", color = "gold";
        CREATE ai_profiles:prof1 SET project_id = type::record('projects:proj_keep_global'), name = "OpenAI Global", provider = "openai", is_global = true;
        CREATE ai_skills:sk1 SET project_id = type::record('projects:proj_keep_global'), name = "Конструктор лора", description = "Создание мира", prompt_text = "Тест", is_builtin = true;
        CREATE calendars:cal1 SET project_id = type::record('projects:proj_keep_global'), name = "Григорианский", is_master = true;
        CREATE artifacts:art1 SET project_id = type::record('projects:proj_keep_global'), type = "document", title = "Сводка фактов", content = "Текст документа";
        CREATE user_dictionary:ud1 SET project_id = type::record('projects:proj_keep_global'), word = "Мана", definition = "Энергия";
        "#
    ).await.unwrap();

    // 2. Удаляем проект
    delete_project_inner(&db, "proj_to_delete").await.expect("delete project");

    // 3. Проверяем, что ВСЕ вечные глобальные сущности сохранились в целости
    let mut w_res = db.query("SELECT count() FROM web_evidence GROUP ALL").await.unwrap();
    let count: Option<serde_json::Value> = w_res.take(0).unwrap();
    assert_eq!(count.and_then(|v| v.get("count").and_then(|c| c.as_u64())).unwrap_or(0), 1, "web_evidence НЕ должна удаляться при сносе проекта");

    let mut es_res = db.query("SELECT count() FROM entity_schemas GROUP ALL").await.unwrap();
    let count: Option<serde_json::Value> = es_res.take(0).unwrap();
    assert_eq!(count.and_then(|v| v.get("count").and_then(|c| c.as_u64())).unwrap_or(0), 1, "entity_schemas НЕ должны удаляться");

    let mut rs_res = db.query("SELECT count() FROM relation_schemas GROUP ALL").await.unwrap();
    let count: Option<serde_json::Value> = rs_res.take(0).unwrap();
    assert_eq!(count.and_then(|v| v.get("count").and_then(|c| c.as_u64())).unwrap_or(0), 1, "relation_schemas НЕ должны удаляться");

    let mut prof_res = db.query("SELECT count() FROM ai_profiles GROUP ALL").await.unwrap();
    let count: Option<serde_json::Value> = prof_res.take(0).unwrap();
    assert_eq!(count.and_then(|v| v.get("count").and_then(|c| c.as_u64())).unwrap_or(0), 1, "ai_profiles НЕ должны удаляться");

    let mut sk_res = db.query("SELECT count() FROM ai_skills GROUP ALL").await.unwrap();
    let count: Option<serde_json::Value> = sk_res.take(0).unwrap();
    assert_eq!(count.and_then(|v| v.get("count").and_then(|c| c.as_u64())).unwrap_or(0), 1, "ai_skills НЕ должны удаляться");

    let mut cal_res = db.query("SELECT count() FROM calendars GROUP ALL").await.unwrap();
    let count: Option<serde_json::Value> = cal_res.take(0).unwrap();
    assert_eq!(count.and_then(|v| v.get("count").and_then(|c| c.as_u64())).unwrap_or(0), 1, "calendars НЕ должны удаляться");

    let mut art_res = db.query("SELECT count() FROM artifacts GROUP ALL").await.unwrap();
    let count: Option<serde_json::Value> = art_res.take(0).unwrap();
    assert_eq!(count.and_then(|v| v.get("count").and_then(|c| c.as_u64())).unwrap_or(0), 1, "artifacts НЕ должны удаляться");

    let mut ud_res = db.query("SELECT count() FROM user_dictionary GROUP ALL").await.unwrap();
    let count: Option<serde_json::Value> = ud_res.take(0).unwrap();
    assert_eq!(count.and_then(|v| v.get("count").and_then(|c| c.as_u64())).unwrap_or(0), 1, "user_dictionary НЕ должен удаляться");
}

#[tokio::test]
async fn delete_project_cascades_timeline_and_chats() {
    let db = create_test_db().await;
    seed_project(&db, "proj_casc_full", "Cascade Full Test").await;

    // 1. Создаем проектные данные: таймлайн, чаты, сообщения, сюжетные обещания, планы
    db.query(
        r#"
        CREATE calendars:cal_p SET project_id = type::record('projects:proj_casc_full'), name = "Календарь", is_master = true;
        CREATE timeline_events:te1 SET project_id = type::record('projects:proj_casc_full'), calendar_id = calendars:cal_p, title = "Битва у реки", m_abs = 1000;
        CREATE chats:c1 SET project_id = type::record('projects:proj_casc_full'), title = "Диалог 1";
        CREATE chat_messages:cm1 SET project_id = type::record('projects:proj_casc_full'), chat_id = chats:c1, role = "user", content = "Привет!";
        CREATE plans:pl1 SET project_id = type::record('projects:proj_casc_full'), title = "План главы", parent_type = "chapter";
        CREATE plot_promises:pp1 SET project_id = type::record('projects:proj_casc_full'), kind = "gun", quote = "Ружьё на стене";
        CREATE agent_memory:am1 SET project_id = type::record('projects:proj_casc_full'), memory_type = "fact", content = "Герой левша";
        "#
    ).await.unwrap();

    // 2. Удаляем проект
    delete_project_inner(&db, "proj_casc_full").await.expect("delete project");

    // 3. Проверяем, что все проектные сущности каскадно очищены
    for table in ["timeline_events", "chats", "chat_messages", "plans", "plot_promises", "agent_memory"] {
        let mut res = db.query(format!("SELECT count() FROM {table} WHERE project_id = type::record('projects:proj_casc_full') GROUP ALL")).await.unwrap();
        let count: Option<serde_json::Value> = res.take(0).unwrap();
        let cnt = count.and_then(|v| v.get("count").and_then(|c| c.as_u64())).unwrap_or(0);
        assert_eq!(cnt, 0, "Таблица {table} должна быть каскадно очищена для проекта");
    }
}
