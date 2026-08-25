//! Интеграционные тесты AI-инструментов (`logic/ai/tools/mod.rs`).
//!
//! Покрывают `WorldWikiTools::run()` — диспетчер всех 19 инструментов агента:
//! - читающие тулы на seed-данных;
//! - пишущие сквозным сценарием «агент пополняет лор» с проверкой эффекта в БД;
//! - мок-тулы и негативы (unknown tool).

use crate::logic::ai::tools::{tool_definitions, project_record, WorldWikiTools};
use crate::logic::chapters::save_text_blocks_inner;
use serde_json::json;
use super::common::{create_test_db, seed_chapter, seed_project};

/// Хелпер: инстанс инструментов поверх тестовой БД.
async fn tools(project: &str) -> (surrealdb::Surreal<surrealdb::engine::local::Db>, WorldWikiTools) {
    let db = create_test_db().await;
    seed_project(&db, project, "Tools Project").await;
    let t = WorldWikiTools { db: db.clone(), project_id: format!("projects:{project}") };
    (db, t)
}

// ---------- Определения инструментов ----------

#[test]
fn tool_definitions_are_unique_and_well_formed() {
    let defs = tool_definitions();
    assert!(defs.len() >= 19, "должен быть полный каталог инструментов");

    let mut names: Vec<&str> = defs.iter().map(|d| d.name.as_str()).collect();
    let before = names.len();
    names.sort();
    names.dedup();
    assert_eq!(names.len(), before, "имена инструментов не должны дублироваться");

    for d in &defs {
        assert!(!d.name.is_empty());
        assert!(d.description.is_some(), "{}: нет описания", d.name);
        assert_eq!(d.input_schema["type"], "object", "{}: schema.type != object", d.name);
    }
}

#[tokio::test]
async fn run_unknown_tool_returns_err() {
    let (_db, t) = tools("p_unk").await;
    let res = t.run("definitely_not_a_tool", &json!({})).await;
    assert!(res.is_err());
    assert!(res.unwrap_err().contains("unknown tool"));
}

// ---------- Читающие инструменты ----------

#[tokio::test]
async fn search_entities_finds_substring_respects_type_filter() {
    let (_db, t) = tools("p_se").await;

    t.db.query(
        "CREATE entities:e_alice SET project_id = type::record('projects','p_se'), entity_type = 'character', name = 'Алиса Светлая', description = 'магистр света'"
    ).await.unwrap().take_errors();
    t.db.query(
        "CREATE entities:e_forest SET project_id = type::record('projects','p_se'), entity_type = 'location', name = 'Мост Алисы', description = ''"
    ).await.unwrap().take_errors();
    t.db.query(
        "CREATE entities:e_bob SET project_id = type::record('projects','p_se'), entity_type = 'character', name = 'Боб', description = 'кузнец'"
    ).await.unwrap().take_errors();

    // По подстроке (регистронезависимо, по всей сериализованной строке записи)
    let res = t.run("search_entities", &json!({ "query": "алис" })).await.unwrap();
    let parsed: serde_json::Value = serde_json::from_str(&res).unwrap();
    let found = parsed["entities"].as_array().unwrap();
    assert_eq!(found.len(), 2, "«алис-» должно найтись и в «Алиса Светлая», и в «Мост Алисы»");

    // С типовым фильтром — только персонажи
    let res2 = t.run("search_entities", &json!({ "query": "алис", "type_key": "character" })).await.unwrap();
    let parsed2: serde_json::Value = serde_json::from_str(&res2).unwrap();
    let found2 = parsed2["entities"].as_array().unwrap();
    assert_eq!(found2.len(), 1);
    assert_eq!(found2[0]["entity_type"], "character");
}

#[tokio::test]
async fn get_entity_returns_record_or_null() {
    let (_db, t) = tools("p_ge").await;
    t.db.query(
        "CREATE entities:e_hero SET project_id = type::record('projects','p_ge'), entity_type = 'character', name = 'Герой', description = 'тестовый'"
    ).await.unwrap().take_errors();

    let res = t.run("get_entity", &json!({ "id": "entities:e_hero" })).await.unwrap();
    let v: serde_json::Value = serde_json::from_str(&res).unwrap();
    assert_eq!(v["entity"]["name"], "Герой");

    let res2 = t.run("get_entity", &json!({ "id": "entities:nope" })).await.unwrap();
    let v2: serde_json::Value = serde_json::from_str(&res2).unwrap();
    assert!(v2["entity"].is_null(), "несуществующая сущность → null");
}

#[tokio::test]
async fn get_relations_returns_edges_of_entity() {
    let (_db, t) = tools("p_gr").await;

    t.db.query(
        "CREATE entities:e_a SET project_id = type::record('projects','p_gr'), entity_type = 'character', name = 'A', description = ''"
    ).await.unwrap().take_errors();
    t.db.query(
        "CREATE entities:e_b SET project_id = type::record('projects','p_gr'), entity_type = 'character', name = 'B', description = ''"
    ).await.unwrap().take_errors();
    t.db.query(
        "RELATE entities:e_a->entity_rel->entities:e_b SET rel_type = 'ally', project_id = type::record('projects','p_gr')"
    ).await.unwrap().take_errors();

    let res = t.run("get_relations", &json!({ "entity_id": "entities:e_a" })).await.unwrap();
    let v: serde_json::Value = serde_json::from_str(&res).unwrap();
    let rels = v["relations"].as_array().unwrap();
    assert_eq!(rels.len(), 1);
    assert_eq!(rels[0]["rel_type"], "ally");
}
#[tokio::test]
async fn get_chapter_compiles_text_from_blocks() {
    let (db, t) = tools("p_ch").await;
    seed_chapter(&db, "p_ch", "ch_full", "Глава с текстом", "").await;

    save_text_blocks_inner(
        &db, "p_ch", "ch_full",
        "<p data-semantic-tag=\"desc\">Первый абзац лора.</p><p>Второй абзац.</p>",
    ).await.expect("save text blocks");

    let res = t.run("get_chapter", &json!({ "id": "chapters:ch_full" })).await.unwrap();
    let v: serde_json::Value = serde_json::from_str(&res).unwrap();
    let compiled = v["chapter"]["compiled_text"].as_str().expect("compiled_text present");
    assert!(compiled.contains("Первый абзац лора."));
    assert!(compiled.contains("Второй абзац."));
}

#[tokio::test]
async fn get_chapter_empty_content_returns_system_error_string() {
    let (db, t) = tools("p_ch_empty").await;
    seed_chapter(&db, "p_ch_empty", "ch_blank", "Пустая глава", "").await;

    let res = t.run("get_chapter", &json!({ "id": "ch_blank" })).await.unwrap();
    assert!(
        res.contains("[SYSTEM ERROR") && res.contains("empty"),
        "глава без текста должна вернуть заглушку от галлюцинаций, получено: {res}"
    );
}

#[tokio::test]
async fn get_chapters_list_formats_toc_and_handles_empty() {
    let (db, t) = tools("p_list").await;

    let empty = t.run("get_chapters_list", &json!({})).await.unwrap();
    assert!(empty.contains("нет ни одной главы"));

    seed_chapter(&db, "p_list", "ch_z", "Глава Зет", "").await;
    seed_chapter(&db, "p_list", "ch_a", "Глава Альфа", "").await;

    let toc = t.run("get_chapters_list", &json!({})).await.unwrap();
    assert!(toc.contains("Оглавление"));
    assert!(toc.contains("Глава Зет") && toc.contains("Глава Альфа"));
}

#[tokio::test]
async fn rag_search_spans_tables_and_clamps_top_k() {
    let (_db, t) = tools("p_rag").await;

    // 10 сущностей с общим маркером — больше чем TOP_K=8
    for i in 0..10 {
        t.db.query(format!(
            "CREATE entities:e_rag{i} SET project_id = type::record('projects','p_rag'), entity_type = 'item', name = 'Артефакт-{i}', description = 'уникум-маркер'"
        )).await.unwrap().take_errors();
    }
    seed_chapter(&t.db, "p_rag", "ch_rag", "Цитадель Ветров", "тут тоже уникум-маркер зашит").await;

    let res = t.run("rag_search", &json!({ "query": "уникум-маркер", "top_k": 100 })).await.unwrap();
    let v: serde_json::Value = serde_json::from_str(&res).unwrap();
    let matches = v["matches"].as_array().unwrap();
    assert_eq!(matches.len(), 8, "top_k должен обрезаться до лимита 8");

    // Поиск по главам тоже работает
    let res2 = t.run("rag_search", &json!({ "query": "цитадель" })).await.unwrap();
    assert!(res2.to_lowercase().contains("цитадель"), "RAG должен находить главы");
}

#[tokio::test]
async fn get_timeline_and_calendar_return_payloads() {
    let (db, t) = tools("p_tl").await;
    seed_chapter(&db, "p_tl", "ch_ev", "Глава событий", "").await;

    let added = t.run("add_timeline_event", &json!({
        "chapter_id": "ch_ev",
        "event": { "date": {"year": 1444}, "title": "Осада крепости" }
    })).await.expect("add_timeline_event");
    assert!(added.contains("success"));

    let tl = t.run("get_timeline", &json!({})).await.unwrap();
    let v: serde_json::Value = serde_json::from_str(&tl).unwrap();
    let rows = v["timeline"].as_array().unwrap();
    assert_eq!(rows.len(), 1);
    assert_eq!(rows[0]["timeline_events"][0]["title"], "Осада крепости");

    // Пустой проект → пустой массив календаря, без ошибок
    let cal = t.run("get_calendar", &json!({})).await.unwrap();
    let cv: serde_json::Value = serde_json::from_str(&cal).unwrap();
    assert!(cv["calendar"].as_array().unwrap().is_empty());
}

#[tokio::test]
async fn get_entity_schema_returns_saved_schema() {
    let (_db, t) = tools("p_sch").await;

    t.db.query(
        "CREATE entity_schemas SET project_id = type::record('projects','p_sch'), type_key = 'faction', type_name = 'Фракция', icon = 'flag', color = '#123456', fields_schema = []"
    ).await.unwrap().take_errors();

    let res = t.run("get_entity_schema", &json!({ "type_key": "faction" })).await.unwrap();
    let v: serde_json::Value = serde_json::from_str(&res).unwrap();
    let rows = v["schema"].as_array().unwrap();
    assert_eq!(rows.len(), 1);
    assert_eq!(rows[0]["type_name"], "Фракция");
}
// ---------- Пишущие инструменты: сквозной сценарий «агент пополняет лор» ----------

#[tokio::test]
async fn agent_lore_enrichment_end_to_end() {
    let (db, t) = tools("p_e2e").await;

    // 1. Агент создаёт сущность
    let created = t.run("create_entity", &json!({
        "type_key": "character",
        "data": { "name": "Найденный Рыцарь", "description": "Забытый герой из пролога" }
    })).await.expect("create_entity");
    assert!(created.contains("success") && created.contains("Entity created"));

    let mut r = db.query(
        "SELECT * FROM entities WHERE name = 'Найденный Рыцарь' AND project_id = type::record('projects','p_e2e') LIMIT 1"
    ).await.unwrap();
    let rows: Vec<serde_json::Value> = r.take(0).unwrap();
    assert_eq!(rows.len(), 1, "созданная тулом сущность должна лежать в БД");
    let knight_id = rows[0]["id"].as_str().unwrap().to_string();

    // 2. Вторая сущность + связь между ними
    t.run("create_entity", &json!({
        "type_key": "character",
        "data": { "name": "Старый Король" }
    })).await.unwrap();

    let mut rr = db.query("SELECT * FROM entities WHERE name = 'Старый Король' LIMIT 1").await.unwrap();
    let king_rows: Vec<serde_json::Value> = rr.take(0).unwrap();
    let king_id = king_rows[0]["id"].as_str().expect("king entity id is a string").to_string();

    let rel = t.run("create_relation", &json!({
        "from": knight_id, "to": king_id, "rel_type": "sworn_enemy"
    })).await.expect("create_relation");
    assert!(rel.contains("Relation created"));

    let mut rc = db.query(
        "SELECT * FROM entity_rel WHERE rel_type = 'sworn_enemy' AND project_id = type::record('projects','p_e2e') LIMIT 1"
    ).await.unwrap();
    let rel_rows: Vec<serde_json::Value> = rc.take(0).unwrap();
    assert_eq!(rel_rows.len(), 1, "ребро entity_rel должно существовать");

    // 3. Частичное обновление биографии
    let updated = t.run("update_entity", &json!({
        "id": knight_id,
        "patch": { "description": "Обновлённая агентом биография" }
    })).await.expect("update_entity");
    assert!(updated.contains("success"));

    let mut ur = db.query("SELECT * FROM type::record($id)").bind(("id", knight_id)).await.unwrap();
    let after: Vec<serde_json::Value> = ur.take(0).unwrap();
    assert_eq!(after[0]["description"], "Обновлённая агентом биография");
}

#[tokio::test]
async fn update_chapter_tool_merges_content() {
    let (db, t) = tools("p_uc").await;
    seed_chapter(&db, "p_uc", "ch_upd", "Обновляемая", "старый").await;

    // ⚠️ ИЗВЕСТНЫЙ БАГ ТУЛА (задокументировано тестом): описание инструмента
    // обещает «Tiptap JSON», но DDL схемы требует `chapters.content TYPE string`,
    // поэтому merge объекта падает с coercion error.
    let res = t.run("update_chapter", &json!({
        "id": "chapters:ch_upd",
        "content": { "type": "doc", "content": [{ "type": "paragraph" }] }
    })).await;
    assert!(
        res.is_err(),
        "сейчас schema-strict не даёт писать объект в chapters.content (баг зафиксирован)"
    );

    // Строковый контент при этом обновляется штатно
    let ok = t.run("update_chapter", &json!({
        "id": "chapters:ch_upd",
        "content": "Новый текст главы строкой"
    })).await.expect("string content should work");
    assert!(ok.contains("Chapter updated"));

    let mut r = db.query("SELECT content FROM chapters:ch_upd").await.unwrap();
    let rows: Vec<serde_json::Value> = r.take(0).unwrap();
    assert_eq!(rows[0]["content"], "Новый текст главы строкой");
}

#[tokio::test]
async fn add_timeline_event_requires_chapter_id() {
    let (_db, t) = tools("p_tl_neg").await;
    let res = t.run("add_timeline_event", &json!({ "chapter_id": "", "event": {} })).await;
    assert!(res.is_err());
    assert_eq!(res.unwrap_err(), "chapter_id is required");
}

// ---------- Мок-тулы и история чата ----------

#[tokio::test]
async fn mock_tools_return_success_payloads() {
    let (_db, t) = tools("p_mock").await;

    let evo = t.run("get_entity_evolution", &json!({ "entity_id": "entities:x" })).await.unwrap();
    assert!(evo.contains("evolution"));

    let rh = t.run("get_relation_history", &json!({ "relation_id": "entity_rel:1" })).await.unwrap();
    assert!(rh.contains("history"));

    let sub = t.run("spawn_subagent", &json!({ "task": "изучить руины", "subagent_type": "Explorer" })).await.unwrap();
    assert!(sub.contains("Explorer") && sub.contains("изучить руины"));

    let vc = t.run("validate_world_consistency", &json!({ "statement": "Дракон живёт в башне" })).await
        .expect("validate_world_consistency");
    assert!(vc.contains("rag_search"));
}

#[tokio::test]
async fn search_chat_history_finds_by_content() {
    let (_db, t) = tools("p_hist").await;

    // chat_messages.chat_id — REQUIRED record<chats> (без DEFAULT), поэтому
    // сначала создаём чат-родитель.
    t.db.query(
        "CREATE chats:c_hist SET project_id = type::record('projects','p_hist'), title = 'История', session_context = []"
    ).await.unwrap().take_errors();

    t.db.query(
        "CREATE chat_messages SET project_id = type::record('projects','p_hist'), chat_id = chats:c_hist, content = 'Помнишь про ананасовую диверсию?', role = 'user'"
    ).await.unwrap().take_errors();
    t.db.query(
        "CREATE chat_messages SET project_id = type::record('projects','p_hist'), chat_id = chats:c_hist, content = 'Обычное сообщение про погоду', role = 'assistant'"
    ).await.unwrap().take_errors();

    // Сид должен был реально вставиться (schema-strict может резать поля)
    let mut seed_check = t.db.query(
        "SELECT count() FROM chat_messages WHERE project_id = type::record('projects','p_hist') GROUP ALL"
    ).await.unwrap();
    let cnt: Option<serde_json::Value> = seed_check.take(0).unwrap();
    let seeded = cnt.and_then(|v| v.get("count").and_then(|c| c.as_u64())).unwrap_or(0);
    assert_eq!(seeded, 2, "сид чат-сообщений должен вставиться без schema-ошибок");

    let res = t.run("search_chat_history", &json!({ "query": "ананас" })).await.unwrap();
    let v: serde_json::Value = serde_json::from_str(&res).unwrap();
    let matches = v["matches"].as_array().unwrap();
    assert_eq!(matches.len(), 1);
    assert!(matches[0]["content"].as_str().unwrap().contains("ананасовую"));
}

#[tokio::test]
async fn project_record_normalizes_prefix() {
    use surrealdb::types::RecordId;

    assert_eq!(project_record("projects:`my_proj`"), RecordId::new("projects", "my_proj"));
    assert_eq!(project_record("bare"), RecordId::new("projects", "bare"));
    assert_eq!(project_record("projects:p1"), RecordId::new("projects", "p1"));
}