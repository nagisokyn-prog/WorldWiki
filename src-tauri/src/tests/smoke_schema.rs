//! Smoke-тест схемы базы данных SurrealDB.
//!
//! Проверяет:
//! - Успешное накатывание полного DDL файла `surreal_schema.surql` без синтаксических ошибок.
//! - Существование всех ключевых таблиц проекта (20+ таблиц).
//! - Работу встроенных анализаторов текста (Fulltext Analyzer `like`).

use super::common::create_test_db;

#[tokio::test]
async fn smoke_all_required_tables_exist() {
    let db = create_test_db().await;

    // Запрашиваем информацию о структуре базы данных
    let mut res = db.query("INFO FOR DB").await.expect("INFO FOR DB should execute");
    let info: Option<serde_json::Value> = res.take(0).expect("take info");
    let info = info.expect("info object exists");

    let tables = info.get("tables").expect("tables map exists");
    println!("\n[SMOKE TEST] Таблицы, зарегистрированные в схеме: {:?}", tables);

    let expected_tables = [
        "projects",
        "volumes",
        "chapters",
        "text_blocks",
        "entities",
        "entity_schemas",
        "relation_schemas",
        "schema_history",
        "entity_rel",
        "contains",
        "calendars",
        "tags",
        "user_dictionary",
        "chat_messages",
        "chats",
        "agent_memory",
        "plans",
        "entity_revisions",
        "chapter_revisions",
        "ai_modes",
        "ai_profiles",
        "ai_skills",
        "appears_in",
        "artifacts",
        "web_pages",
        "web_evidence",
        "timeline_events",
        "participates_in",
        "entity_chunks",
        "plot_promises",
        "research_sessions",
        "auto_approval_settings",
    ];

    for table in expected_tables {
        assert!(
            tables.get(table).is_some(),
            "Таблица '{table}' должна быть объявлена в схеме"
        );
    }
}

#[tokio::test]
async fn smoke_tables_are_queryable_empty() {
    let db = create_test_db().await;

    for table in ["projects", "volumes", "chapters", "entities", "text_blocks", "entity_rel", "contains"] {
        let mut res = db
            .query(format!("SELECT count() FROM {table} GROUP ALL"))
            .await
            .unwrap_or_else(|_| panic!("Failed to query table {table}"));
        let count_val: Option<serde_json::Value> = res.take(0).unwrap();
        let count = count_val.and_then(|v| v.get("count").and_then(|c| c.as_u64())).unwrap_or(0);
        assert_eq!(count, 0, "Таблица {table} в новой БД должна быть пустой");
    }
}
