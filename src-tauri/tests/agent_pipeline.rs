#![cfg(feature = "agent-pipeline")]
//! Интеграционный тест `run_agent_loop` с локальным mock OpenAI SSE-сервером.
//!
//! Поднимает raw-TCP сервер, отвечающий на любой POST валидным
//! OpenAI-совместимым SSE-стримом (2 текстовых дельты + finish_reason stop),
//! сеединит активный ai_profile с base_url на этот сервер и проверяет,
//! что агент доводит цикл до конца и сохраняет ответ в assistant-сообщение.
//!
//! Запуск: cargo test --test agent_pipeline --features agent-pipeline
//!
//! Тестовый exe требует встроенного манифеста с Common-Controls v6
//! (иначе comctl32 v5 не экспортирует TaskDialogIndirect -> 0xc0000139).
//! Манифест встраивается в build.rs через rustc-link-arg-tests.

use serde_json::{json, Value};
use tauri::Manager;
use world_wiki_lib::logic::ai::agent::runner::run_agent_loop;
use world_wiki_lib::AppState;

/// Mock OpenAI SSE-сервер: слушает 127.0.0.1:0, отвечает одним сценарием.
/// Полностью асинхронный (tokio), чтобы задача корректно завершалась
/// при shutdown рантайма — блокирующий std::net здесь вешал тест навсегда.
async fn spawn_mock_openai(answer_parts: Vec<String>) -> String {
    use tokio::io::{AsyncReadExt, AsyncWriteExt};

    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.expect("bind mock server");
    let port = listener.local_addr().unwrap().port();

    tokio::spawn(async move {
        // До 5 соединений (reqwest может переоткрывать)
        for _ in 0..5 {
            let mut s = match listener.accept().await {
                Ok((s, _)) => s,
                Err(_) => break,
            };

            // Читаем заголовки запроса (до \r\n\r\n)
            let mut buf = [0u8; 8192];
            let mut read_total = 0;
            loop {
                let n = match s.read(&mut buf[read_total..]).await {
                    Ok(0) => break,
                    Ok(n) => n,
                    Err(_) => break,
                };
                read_total += n;
                if buf[..read_total]
                    .windows(4)
                    .any(|w| w == b"\r\n\r\n")
                {
                    break;
                }
            }

            let mut body = String::new();
            for part in &answer_parts {
                let chunk = json!({
                    "id": "chatcmpl-mock",
                    "object": "chat.completion.chunk",
                    "created": 1,
                    "model": "mock-model",
                    "choices": [{ "index": 0, "delta": { "content": part } }]
                });
                body.push_str(&format!("data: {chunk}\n\n"));
            }
            // finish stop
            let stop = json!({
                "id": "chatcmpl-mock",
                "object": "chat.completion.chunk",
                "created": 1,
                "model": "mock-model",
                "choices": [{ "index": 0, "delta": {}, "finish_reason": "stop" }]
            });
            body.push_str(&format!("data: {stop}\n\n"));
            body.push_str("data: [DONE]\n\n");

            let response = format!(
                "HTTP/1.1 200 OK\r\nContent-Type: text/event-stream\r\nCache-Control: no-cache\r\nConnection: close\r\nContent-Length: {}\r\n\r\n{}",
                body.len(),
                body
            );
            let _ = s.write_all(response.as_bytes()).await;
            let _ = s.flush().await;
            drop(s); // Connection: close
        }
    });

    format!("http://127.0.0.1:{port}/v1")
}

/// Mock Tauri App с AppState поверх тестовой БД.
fn build_mock_app(
    db: surrealdb::Surreal<surrealdb::engine::local::Db>,
) -> tauri::AppHandle<tauri::test::MockRuntime> {
    let app = tauri::test::mock_app();
    app.manage(AppState { db });
    app.handle().clone()
}

#[tokio::test(flavor = "multi_thread")]
async fn agent_loop_persists_streamed_answer_from_mock_llm() {
    use surrealdb::engine::local::SurrealKv;

    eprintln!("MARK 0: тест стартовал");
    // 1. Изолированная БД + схема
    let dir = std::env::temp_dir().join(format!("ww_agent_{}", uuid::Uuid::new_v4()));
    std::fs::create_dir_all(&dir).unwrap();
    let db = surrealdb::Surreal::new::<SurrealKv>(dir.clone()).await.unwrap();
    db.use_ns("test").use_db("test").await.unwrap();
    let sql = include_str!("../../apps/spa/src/logic/surreal_schema.surql");
    let mut res = db.query(sql).await.unwrap();
    assert!(res.take_errors().is_empty(), "schema errors");
    eprintln!("MARK 1: БД и схема готовы");

    // 2. Mock LLM
    let base_url = spawn_mock_openai(vec!["Привет, ".to_string(), "писатель!".to_string()]).await;
    eprintln!("MARK 2: mock поднят на {base_url}");

    // 3. Сид: проект, активный профиль на мок, чат + assistant-заглушка
    db.query("CREATE projects:p_agent SET name = 'Agent', data = {}")
        .await
        .unwrap()
        .take_errors();
    db.query(format!(
        "CREATE ai_profiles SET project_id = type::record('projects','p_agent'), \
         name = 'Mock', provider = 'openai', api_key = 'test-key', \
         base_url = '{base_url}', \
         settings = {{ model: 'mock-model', execution_policy: 'direct', \
           enable_auto_rag: false, enable_semantic_search: false, timeout_mins: 1 }}, \
         is_active = true"
    ))
    .await
    .unwrap()
    .take_errors();

    db.query(
        "CREATE chats:c_ag SET project_id = type::record('projects','p_agent'), title = 'T', session_context = []",
    )
    .await
    .unwrap()
    .take_errors();
    db.query(
        "CREATE chat_messages:m_user SET chat_id = chats:c_ag, \
         project_id = type::record('projects','p_agent'), role = 'user', \
         content = 'Скажи привет', version = 1, parent_id = NONE, is_active = true, created_at = time::now()",
    )
    .await
    .unwrap()
    .take_errors();
    db.query(
        "CREATE chat_messages:m_asst SET chat_id = chats:c_ag, \
         project_id = type::record('projects','p_agent'), role = 'assistant', \
         content = '', version = 1, parent_id = chat_messages:m_user, is_active = true, created_at = time::now()",
    )
    .await
    .unwrap()
    .take_errors();

    // 4. Запускаем цикл агента
    let app = build_mock_app(db.clone());
    eprintln!("MARK 3: app собран, запускаю run_agent_loop");
    run_agent_loop(
        app,
        "projects:p_agent".to_string(),
        "chats:c_ag".to_string(),
        "chat_messages:m_asst".to_string(),
        "Скажи привет".to_string(),
        None,
    )
    .await;

    // 5. Ответ из стрима должен быть сохранён в assistant-сообщении
    eprintln!("MARK 4: run_agent_loop вернулся, проверяю БД");
    let mut r = db.query("SELECT content FROM chat_messages:m_asst").await.unwrap();
    let rows: Vec<Value> = r.take(0).unwrap();
    assert_eq!(
        rows[0]["content"], "Привет, писатель!",
        "агент должен склеить дельты стрима и сохранить ответ"
    );

    let _ = std::fs::remove_dir_all(&dir);
}