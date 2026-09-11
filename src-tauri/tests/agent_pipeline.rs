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
use std::sync::Arc;
use world_wiki_lib::bootstrap::services::build_surreal_app_services;
use worldwiki_infrastructure::events::InMemoryEventPublisher;

/// Mock OpenAI SSE-сервер: слушает 127.0.0.1:0, отвечает одним сценарием.
/// Полностью асинхронный (tokio), чтобы задача корректно завершалась
/// при shutdown рантайма — блокирующий std::net здесь вешал тест навсегда.
async fn spawn_mock_openai(answer_parts: Vec<String>) -> String {
    use tokio::io::{AsyncReadExt, AsyncWriteExt};

    let listener = tokio::net::TcpListener::bind("127.0.0.1:0")
        .await
        .expect("bind mock server");
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
                if buf[..read_total].windows(4).any(|w| w == b"\r\n\r\n") {
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

#[tokio::test(flavor = "multi_thread")]
async fn agent_loop_persists_streamed_answer_from_mock_llm() {
    use surrealdb::engine::local::SurrealKv;

    eprintln!("MARK 0: тест стартовал");
    // 1. Изолированная БД + схема
    let dir = std::env::temp_dir().join(format!("ww_agent_{}", uuid::Uuid::new_v4()));
    std::fs::create_dir_all(&dir).unwrap();
    let db = surrealdb::Surreal::new::<SurrealKv>(dir.clone())
        .await
        .unwrap();
    db.use_ns("test").use_db("test").await.unwrap();
    world_wiki_lib::apply_schema_pipeline(&db).await.unwrap();
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

    // 4. Запускаем цикл агента через ChatServices
    let services =
        build_surreal_app_services(Arc::new(db.clone()), Arc::new(InMemoryEventPublisher));
    eprintln!("MARK 3: services собраны, запускаю run_agent_loop");
    services
        .chat
        .run_agent_loop(
            "projects:p_agent",
            "chats:c_ag",
            "chat_messages:m_asst",
            "Скажи привет",
            None,
        )
        .await;

    // 5. Ответ из стрима должен быть сохранён в assistant-сообщении
    eprintln!("MARK 4: run_agent_loop вернулся, проверяю БД");
    let mut r = db
        .query("SELECT content FROM chat_messages:m_asst")
        .await
        .unwrap();
    let rows: Vec<Value> = r.take(0).unwrap();
    assert_eq!(
        rows[0]["content"], "Привет, писатель!",
        "агент должен склеить дельты стрима и сохранить ответ"
    );

    let _ = std::fs::remove_dir_all(&dir);
}

// ---------------------------------------------------------------------------
// Pipeline 4: user query → RetrievalRouter → prompt assembly → LLM
// ---------------------------------------------------------------------------

type SharedBuf = std::sync::Arc<tokio::sync::Mutex<Vec<u8>>>;

/// Mock OpenAI SSE-сервер с захватом тела запроса.
async fn spawn_mock_capturing(answer_parts: Vec<String>, captured: SharedBuf) -> String {
    use tokio::io::{AsyncReadExt, AsyncWriteExt};

    let listener = tokio::net::TcpListener::bind("127.0.0.1:0")
        .await
        .expect("bind mock server");
    let port = listener.local_addr().unwrap().port();

    tokio::spawn(async move {
        for _ in 0..5 {
            let mut s = match listener.accept().await {
                Ok((s, _)) => s,
                Err(_) => break,
            };

            // Читаем заголовки до \r\n\r\n, затем ровно Content-Length байт body
            // (читать до EOF нельзя: reqwest держит keep-alive и ждёт ответ).
            let mut buf = vec![0u8; 262144];
            let mut read_total = 0;
            let mut body_needed: Option<usize> = None;
            loop {
                let n = match s.read(&mut buf[read_total..]).await {
                    Ok(0) | Err(_) => break,
                    Ok(n) => n,
                };
                read_total += n;
                if body_needed.is_none() {
                    if let Some(pos) = buf[..read_total].windows(4).position(|w| w == b"\r\n\r\n") {
                        let head = String::from_utf8_lossy(&buf[..pos]);
                        body_needed = Some(
                            head.to_ascii_lowercase()
                                .lines()
                                .find_map(|l| l.strip_prefix("content-length:"))
                                .and_then(|v| v.trim().parse::<usize>().ok())
                                .unwrap_or(0)
                                + pos
                                + 4,
                        );
                    }
                }
                if let Some(need) = body_needed {
                    if read_total >= need {
                        break;
                    }
                }
            }
            if read_total > 0 {
                captured.lock().await.extend_from_slice(&buf[..read_total]);
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
            drop(s);
        }
    });

    format!("http://127.0.0.1:{port}")
}

/// Сквозной сценарий: запрос про лор → RetrievalRouter находит сущность по
/// BM25 → контекст собирается в prompt → LLM (mock) получает его и отвечает.
#[tokio::test(flavor = "multi_thread")]
async fn agent_prompt_contains_retrieved_world_context() {
    use surrealdb::engine::local::SurrealKv;

    // 1. Изолированная БД + продовая схема (нужны FTS-индексы для BM25!)
    let dir = std::env::temp_dir().join(format!("ww_rag_{}", uuid::Uuid::new_v4()));
    std::fs::create_dir_all(&dir).unwrap();
    let db = surrealdb::Surreal::new::<SurrealKv>(dir.clone())
        .await
        .unwrap();
    db.use_ns("test").use_db("test").await.unwrap();
    world_wiki_lib::apply_schema_pipeline(&db).await.unwrap();

    // 2. Mock LLM с захватом prompt'а
    let captured: SharedBuf = Default::default();
    let base_url = spawn_mock_capturing(
        vec!["Артур — ".to_string(), "король бриттов.".to_string()],
        captured.clone(),
    )
    .await;

    // 3. Сид: проект + активный профиль С RAG включённым
    db.query("CREATE projects:p_rag SET name = 'Rag', data = {}")
        .await
        .unwrap()
        .take_errors();
    db.query(format!(
        "CREATE ai_profiles SET project_id = type::record('projects','p_rag'), \
         name = 'MockRag', provider = 'openai', api_key = 'test-key', \
         base_url = '{base_url}', \
         settings = {{ model: 'mock-model', execution_policy: 'direct', \
           enable_auto_rag: true, enable_semantic_search: false, timeout_mins: 1 }}, \
         is_active = true"
    ))
    .await
    .unwrap()
    .take_errors();

    // 4. Сид лора: сущность с точными токенами для BM25
    db.query(
        "CREATE entities:e_arthur SET \
         project_id = type::record('projects','p_rag'), entity_type = 'character', \
         name = 'Артур Пендрагон', \
         description = 'Король бриттов, владелец меча Экскалибур'",
    )
    .await
    .unwrap()
    .take_errors();

    // 5. Чат + сообщения; вопрос содержит точные токены имени
    db.query(
        "CREATE chats:c_rag SET project_id = type::record('projects','p_rag'), title = 'T', session_context = []",
    )
    .await
    .unwrap()
    .take_errors();
    db.query(
        "CREATE chat_messages:m_ru SET chat_id = chats:c_rag, \
         project_id = type::record('projects','p_rag'), role = 'user', \
         content = 'Артур Пендрагон', version = 1, parent_id = NONE, is_active = true, created_at = time::now()",
    )
    .await
    .unwrap()
    .take_errors();
    db.query(
        "CREATE chat_messages:m_ra SET chat_id = chats:c_rag, \
         project_id = type::record('projects','p_rag'), role = 'assistant', \
         content = '', version = 1, parent_id = chat_messages:m_ru, is_active = true, created_at = time::now()",
    )
    .await
    .unwrap()
    .take_errors();

    // 6. Запуск агента через ChatServices
    let services =
        build_surreal_app_services(Arc::new(db.clone()), Arc::new(InMemoryEventPublisher));
    services
        .chat
        .run_agent_loop(
            "projects:p_rag",
            "chats:c_rag",
            "chat_messages:m_ra",
            "Артур Пендрагон",
            None,
        )
        .await;

    // 7. Ответ сохранён
    let mut r = db
        .query("SELECT content FROM chat_messages:m_ra")
        .await
        .unwrap();
    let rows: Vec<Value> = r.take(0).unwrap();
    assert_eq!(
        rows[0]["content"], "Артур — король бриттов.",
        "агент должен сохранить ответ"
    );

    // 8. ГЛАВНОЕ: в prompt, ушедший к LLM, был подставлен retrieved-контекст
    let prompt = String::from_utf8_lossy(&captured.try_lock().unwrap()).into_owned();
    assert!(
        prompt.contains("<context>"),
        "в prompt должно попасть собранное world_context: {prompt}"
    );
    assert!(
        prompt.contains("Артур Пендрагон"),
        "имя найденной сущности в контексте: {prompt}"
    );
    assert!(
        prompt.contains("Экскалибур"),
        "описание сущности в контексте: {prompt}"
    );

    let _ = std::fs::remove_dir_all(&dir);
}

// ---------------------------------------------------------------------------
// Pipeline 1: LLM → tool_call → WorldWikiTools::run() → результат → LLM → ответ
// ---------------------------------------------------------------------------

/// Собирает OpenAI-SSE тело из текстовых дельт с finish stop.
fn sse_text(parts: &[&str]) -> String {
    let mut body = String::new();
    for part in parts {
        let chunk = json!({
            "id": "chatcmpl-mock", "object": "chat.completion.chunk",
            "created": 1, "model": "mock-model",
            "choices": [{ "index": 0, "delta": { "content": part } }]
        });
        body.push_str(&format!("data: {chunk}\n\n"));
    }
    body.push_str(&sse_stop("stop"));
    body
}

/// OpenAI-SSE с одним tool_call (аргументы одним чанком).
fn sse_tool_call(id: &str, name: &str, arguments: &str) -> String {
    let mut body = String::new();
    let chunk = json!({
        "id": "chatcmpl-mock", "object": "chat.completion.chunk",
        "created": 1, "model": "mock-model",
        "choices": [{
            "index": 0,
            "delta": {
                "tool_calls": [{
                    "index": 0,
                    "id": id,
                    "type": "function",
                    "function": { "name": name, "arguments": arguments }
                }]
            }
        }]
    });
    body.push_str(&format!("data: {chunk}\n\n"));
    body.push_str(&sse_stop("tool_calls"));
    body
}

fn sse_stop(finish_reason: &str) -> String {
    let stop = json!({
        "id": "chatcmpl-mock",
        "object": "chat.completion.chunk",
        "created": 1,
        "model": "mock-model",
        "choices": [{ "index": 0, "delta": {}, "finish_reason": finish_reason }]
    });
    format!("data: {stop}\n\ndata: [DONE]\n\n")
}

/// Mock-сервер со сценариями: на 1-й запрос отдаёт scenario[0], на 2-й — scenario[1].
async fn spawn_mock_scenarios(scenarios: Vec<String>, captured: SharedBuf) -> String {
    use tokio::io::{AsyncReadExt, AsyncWriteExt};

    let listener = tokio::net::TcpListener::bind("127.0.0.1:0")
        .await
        .expect("bind mock server");
    let port = listener.local_addr().unwrap().port();

    tokio::spawn(async move {
        for body in scenarios {
            let mut s = match listener.accept().await {
                Ok((s, _)) => s,
                Err(_) => break,
            };

            let mut buf = vec![0u8; 262144];
            let mut read_total = 0;
            let mut body_needed: Option<usize> = None;
            loop {
                let n = match s.read(&mut buf[read_total..]).await {
                    Ok(0) | Err(_) => break,
                    Ok(n) => n,
                };
                read_total += n;
                if body_needed.is_none() {
                    if let Some(pos) = buf[..read_total].windows(4).position(|w| w == b"\r\n\r\n") {
                        let head = String::from_utf8_lossy(&buf[..pos]);
                        body_needed = Some(
                            head.to_ascii_lowercase()
                                .lines()
                                .find_map(|l| l.strip_prefix("content-length:"))
                                .and_then(|v| v.trim().parse::<usize>().ok())
                                .unwrap_or(0)
                                + pos
                                + 4,
                        );
                    }
                }
                if let Some(need) = body_needed {
                    if read_total >= need {
                        break;
                    }
                }
            }
            if read_total > 0 {
                captured.lock().await.extend_from_slice(&buf[..read_total]);
            }

            let response = format!(
                "HTTP/1.1 200 OK\r\nContent-Type: text/event-stream\r\nCache-Control: no-cache\r\nConnection: close\r\nContent-Length: {}\r\n\r\n{}",
                body.len(),
                body
            );
            let _ = s.write_all(response.as_bytes()).await;
            let _ = s.flush().await;
            drop(s);
        }
    });

    format!("http://127.0.0.1:{port}")
}

#[tokio::test(flavor = "multi_thread")]
async fn agent_loop_executes_tool_call_and_produces_final_answer() {
    use surrealdb::engine::local::SurrealKv;

    // 1. БД + схема
    let dir = std::env::temp_dir().join(format!("ww_tool_{}", uuid::Uuid::new_v4()));
    std::fs::create_dir_all(&dir).unwrap();
    let db = surrealdb::Surreal::new::<SurrealKv>(dir.clone())
        .await
        .unwrap();
    db.use_ns("test").use_db("test").await.unwrap();
    world_wiki_lib::apply_schema_pipeline(&db).await.unwrap();

    // 2. Mock: ход 1 → tool_call get_chapters_list; ход 2 → финальный текст
    let captured: SharedBuf = Default::default();
    let base_url = spawn_mock_scenarios(
        vec![
            sse_tool_call("call_1", "get_chapters_list", "{}"),
            sse_text(&["В книге ", "одна глава."]),
        ],
        captured.clone(),
    )
    .await;

    // 3. Сид: проект, профиль с RAG off (чистый tool-loop), глава для тулза
    db.query("CREATE projects:p_tool SET name = 'Tool', data = {}")
        .await
        .unwrap()
        .take_errors();
    db.query(format!(
        "CREATE ai_profiles SET project_id = type::record('projects','p_tool'), \
         name = 'MockTool', provider = 'openai', api_key = 'test-key', \
         base_url = '{base_url}', \
         settings = {{ model: 'mock-model', execution_policy: 'direct', \
           enable_auto_rag: false, enable_semantic_search: false, timeout_mins: 2 }}, \
         is_active = true"
    ))
    .await
    .unwrap()
    .take_errors();
    db.query(
        "CREATE chapters:ch_t SET project_id = type::record('projects','p_tool'), \
         title = 'Глава Первая', content = 'Текст главы'",
    )
    .await
    .unwrap()
    .take_errors();

    // 4. Чат + сообщения
    db.query(
        "CREATE chats:c_t SET project_id = type::record('projects','p_tool'), title = 'T', session_context = []",
    )
    .await
    .unwrap()
    .take_errors();
    db.query(
        "CREATE chat_messages:m_tu SET chat_id = chats:c_t, \
         project_id = type::record('projects','p_tool'), role = 'user', \
         content = 'Сколько глав?', version = 1, parent_id = NONE, is_active = true, created_at = time::now()",
    )
    .await
    .unwrap()
    .take_errors();
    db.query(
        "CREATE chat_messages:m_ta SET chat_id = chats:c_t, \
         project_id = type::record('projects','p_tool'), role = 'assistant', \
         content = '', version = 1, parent_id = chat_messages:m_tu, is_active = true, created_at = time::now()",
    )
    .await
    .unwrap()
    .take_errors();

    // 5. Запуск через ChatServices
    let services =
        build_surreal_app_services(Arc::new(db.clone()), Arc::new(InMemoryEventPublisher));
    services
        .chat
        .run_agent_loop(
            "projects:p_tool",
            "chats:c_t",
            "chat_messages:m_ta",
            "Сколько глав?",
            None,
        )
        .await;

    // 6. Финальный ответ второго хода сохранён в assistant-сообщении
    let mut r = db
        .query("SELECT content FROM chat_messages:m_ta")
        .await
        .unwrap();
    let rows: Vec<Value> = r.take(0).unwrap();
    assert_eq!(
        rows[0]["content"], "В книге одна глава.",
        "агент должен выполнить тул и вернуться с финальным ответом"
    );

    // 7. Цикл реально сходил дважды:
    let all = String::from_utf8_lossy(&captured.try_lock().unwrap()).into_owned();
    assert!(
        all.contains("\"get_chapters_list\""),
        "первый запрос должен объявлять тул"
    );
    assert!(
        all.contains("call_1"),
        "второй запрос должен содержать id tool-вызова"
    );
    assert!(
        all.contains("Глава Первая"),
        "результат тула (список глав) должен вернуться в LLM"
    );

    let _ = std::fs::remove_dir_all(&dir);
}

// ---------------------------------------------------------------------------
// Pipeline 2: обрыв стрима — delta, delta, connection closed без [DONE]
// ---------------------------------------------------------------------------

#[tokio::test(flavor = "multi_thread")]
async fn agent_loop_survives_midstream_disconnect() {
    use surrealdb::engine::local::SurrealKv;

    // 1. БД + схема
    let dir = std::env::temp_dir().join(format!("ww_disc_{}", uuid::Uuid::new_v4()));
    std::fs::create_dir_all(&dir).unwrap();
    let db = surrealdb::Surreal::new::<SurrealKv>(dir.clone())
        .await
        .unwrap();
    db.use_ns("test").use_db("test").await.unwrap();
    world_wiki_lib::apply_schema_pipeline(&db).await.unwrap();

    // 2. Mock: шлём одну дельту и ОБРЫВАЕМ соединение без [DONE]
    let captured: SharedBuf = Default::default();
    let base_url = spawn_mock_scenarios(
        vec![{
            let chunk = json!({
                "id": "chatcmpl-mock", "object": "chat.completion.chunk",
                "created": 1, "model": "mock-model",
                "choices": [{ "index": 0, "delta": { "content": "Частичный ответ" } }]
            });
            format!("data: {chunk}\n\n")
        }],
        captured.clone(),
    )
    .await;

    // 3. Сид
    db.query("CREATE projects:p_dsc SET name = 'Disc', data = {}")
        .await
        .unwrap()
        .take_errors();
    db.query(format!(
        "CREATE ai_profiles SET project_id = type::record('projects','p_dsc'), \
         name = 'MockDisc', provider = 'openai', api_key = 'test-key', \
         base_url = '{base_url}', \
         settings = {{ model: 'mock-model', execution_policy: 'direct', \
           enable_auto_rag: false, enable_semantic_search: false, timeout_mins: 2 }}, \
         is_active = true"
    ))
    .await
    .unwrap()
    .take_errors();
    db.query(
        "CREATE chats:c_d SET project_id = type::record('projects','p_dsc'), title = 'T', session_context = []",
    )
    .await
    .unwrap()
    .take_errors();
    db.query(
        "CREATE chat_messages:m_du SET chat_id = chats:c_d, \
         project_id = type::record('projects','p_dsc'), role = 'user', \
         content = 'Вопрос', version = 1, parent_id = NONE, is_active = true, created_at = time::now()",
    )
    .await
    .unwrap()
    .take_errors();
    db.query(
        "CREATE chat_messages:m_da SET chat_id = chats:c_d, \
         project_id = type::record('projects','p_dsc'), role = 'assistant', \
         content = '', version = 1, parent_id = chat_messages:m_du, is_active = true, created_at = time::now()",
    )
    .await
    .unwrap()
    .take_errors();

    // 4. Запуск под таймаутом через ChatServices: обрыв не должен привести к зависанию
    let services =
        build_surreal_app_services(Arc::new(db.clone()), Arc::new(InMemoryEventPublisher));
    let chat_svc = services.chat.clone();
    let loop_res = tokio::time::timeout(
        std::time::Duration::from_secs(30),
        chat_svc.run_agent_loop(
            "projects:p_dsc",
            "chats:c_d",
            "chat_messages:m_da",
            "Вопрос",
            None,
        ),
    )
    .await;
    assert!(
        loop_res.is_ok(),
        "run_agent_loop должен завершиться после обрыва, а не висеть"
    );

    // 5. Частичный текст сохранён как ответ (graceful degradation)
    let mut r = db
        .query("SELECT content FROM chat_messages:m_da")
        .await
        .unwrap();
    let rows: Vec<Value> = r.take(0).unwrap();
    let saved = rows[0]["content"].as_str().unwrap_or("");
    assert!(
        saved.contains("Частичный ответ") || saved.is_empty(),
        "либо частичный текст, либо пусто — но не мусор/зависание: {saved:?}"
    );
    assert!(
        !saved.contains("panic"),
        "в контент не должны попадать служебные ошибки"
    );

    let _ = std::fs::remove_dir_all(&dir);
}

// ---------------------------------------------------------------------------
// Pipeline 3: generation started → cancel_generation() → задача прервана
// ---------------------------------------------------------------------------

/// Mock-сервер: один delta-чанк БЕЗ Content-Length, соединение держится
/// открытым минуту — клиент «висит» в чтении стрима, пока его не отменят.
async fn spawn_mock_holding(captured: SharedBuf) -> String {
    use tokio::io::{AsyncReadExt, AsyncWriteExt};

    let listener = tokio::net::TcpListener::bind("127.0.0.1:0")
        .await
        .expect("bind mock server");
    let port = listener.local_addr().unwrap().port();

    tokio::spawn(async move {
        for _ in 0..3 {
            let mut s = match listener.accept().await {
                Ok((s, _)) => s,
                Err(_) => break,
            };

            let mut buf = vec![0u8; 131072];
            let mut read_total = 0;
            let mut need: Option<usize> = None;
            loop {
                let n = match s.read(&mut buf[read_total..]).await {
                    Ok(0) | Err(_) => break,
                    Ok(n) => n,
                };
                read_total += n;
                if need.is_none() {
                    if let Some(pos) = buf[..read_total].windows(4).position(|w| w == b"\r\n\r\n") {
                        let head = String::from_utf8_lossy(&buf[..pos]);
                        need = Some(
                            head.to_ascii_lowercase()
                                .lines()
                                .find_map(|l| l.strip_prefix("content-length:"))
                                .and_then(|v| v.trim().parse::<usize>().ok())
                                .unwrap_or(0)
                                + pos
                                + 4,
                        );
                    }
                }
                if let Some(n2) = need {
                    if read_total >= n2 {
                        break;
                    }
                }
            }
            if read_total > 0 {
                captured.lock().await.extend_from_slice(&buf[..read_total]);
            }

            let chunk = json!({
                "id": "chatcmpl-mock", "object": "chat.completion.chunk",
                "created": 1, "model": "mock-model",
                "choices": [{ "index": 0, "delta": { "content": "Начало" } }]
            });
            let head = "HTTP/1.1 200 OK\r\nContent-Type: text/event-stream\r\nCache-Control: no-cache\r\n\r\n";
            let first = format!("data: {chunk}\n\n");
            let _ = s.write_all(head.as_bytes()).await;
            let _ = s.write_all(first.as_bytes()).await;
            let _ = s.flush().await;
            tokio::time::sleep(std::time::Duration::from_secs(60)).await;
            drop(s);
        }
    });

    format!("http://127.0.0.1:{port}")
}

#[tokio::test(flavor = "multi_thread")]
async fn cancel_generation_aborts_running_task_and_keeps_db_consistent() {
    use surrealdb::engine::local::SurrealKv;

    // 1. БД + схема
    let dir = std::env::temp_dir().join(format!("ww_cancel_{}", uuid::Uuid::new_v4()));
    std::fs::create_dir_all(&dir).unwrap();
    let db = surrealdb::Surreal::new::<SurrealKv>(dir.clone())
        .await
        .unwrap();
    db.use_ns("test").use_db("test").await.unwrap();
    world_wiki_lib::apply_schema_pipeline(&db).await.unwrap();

    // 2. Медленный мок: стрим не заканчивается сам
    let captured: SharedBuf = Default::default();
    let base_url = spawn_mock_holding(captured).await;

    // 3. Сид
    db.query("CREATE projects:p_cnl SET name = 'Cnl', data = {}")
        .await
        .unwrap()
        .take_errors();
    db.query(format!(
        "CREATE ai_profiles SET project_id = type::record('projects','p_cnl'), \
         name = 'MockCnl', provider = 'openai', api_key = 'test-key', \
         base_url = '{base_url}', \
         settings = {{ model: 'mock-model', execution_policy: 'direct', \
           enable_auto_rag: false, enable_semantic_search: false, timeout_mins: 5 }}, \
         is_active = true"
    ))
    .await
    .unwrap()
    .take_errors();
    db.query(
        "CREATE chats:c_cnl SET project_id = type::record('projects','p_cnl'), title = 'T', session_context = []",
    )
    .await
    .unwrap()
    .take_errors();
    db.query(
        "CREATE chat_messages:m_cu SET chat_id = chats:c_cnl, \
         project_id = type::record('projects','p_cnl'), role = 'user', \
         content = 'Длинный вопрос', version = 1, parent_id = NONE, is_active = true, created_at = time::now()",
    )
    .await
    .unwrap()
    .take_errors();
    db.query(
        "CREATE chat_messages:m_ca SET chat_id = chats:c_cnl, \
         project_id = type::record('projects','p_cnl'), role = 'assistant', \
         content = '', version = 1, parent_id = chat_messages:m_cu, is_active = true, created_at = time::now()",
    )
    .await
    .unwrap()
    .take_errors();

    // 4. Запускаем генерацию в фоновом таске
    let services =
        build_surreal_app_services(Arc::new(db.clone()), Arc::new(InMemoryEventPublisher));
    let chat_svc = services.chat.clone();
    let handle = tokio::spawn(async move {
        chat_svc
            .run_agent_loop(
                "projects:p_cnl",
                "chats:c_cnl",
                "chat_messages:m_ca",
                "Длинный вопрос",
                None,
            )
            .await;
    });

    // Даём генерации стартовать (мок успевает отдать первый чанк)
    tokio::time::sleep(std::time::Duration::from_millis(800)).await;

    // 5. Отмена через ChatServices
    let aborted = services.chat.abort_generation("chats:c_cnl");
    assert!(aborted, "cancel_generation должен пройти");

    // Ждём завершения таски
    let _ = handle.await;

    // 6. Повторная отмена безопасна (задача уже снята)
    let aborted_repeat = services.chat.abort_generation("chats:c_cnl");
    assert!(
        !aborted_repeat,
        "повторная отмена должна вернуть false без паники"
    );

    // 7. DB консистентна: assistant-сообщение существует и читается
    let mut r = db
        .query("SELECT content FROM chat_messages:m_ca")
        .await
        .unwrap();
    let rows: Vec<Value> = r.take(0).unwrap();
    assert_eq!(rows.len(), 1, "assistant-сообщение на месте");
    let saved = rows[0]["content"].as_str().unwrap_or("");
    assert!(
        saved.contains("Начало") || saved.is_empty(),
        "контент либо пустой, либо частичный — без мусора: {saved:?}"
    );

    let _ = std::fs::remove_dir_all(&dir);
}
