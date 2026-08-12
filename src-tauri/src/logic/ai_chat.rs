use crate::logic::ai_agent::run_agent_loop;
use crate::AppState;
use serde::Serialize;
use serde_json::{json, Value};
use surreal_domain::SurrealDb;
use surrealdb::types::RecordId;
use tauri::Manager;

fn parse_record_id(id: &str, default_table: &str) -> RecordId {
    let clean = id.trim_matches('`');
    let parts: Vec<&str> = clean.split(':').collect();
    if parts.len() == 2 {
        RecordId::new(parts[0], parts[1])
    } else {
        RecordId::new(default_table, clean)
    }
}

/// Получает дерево чатов, сгруппированное для UI
#[tauri::command]
pub async fn get_chat_tree(
    project_id: String,
    state: tauri::State<'_, AppState>,
) -> Result<Vec<Value>, String> {
    let db = state.surreal_db();
    let proj_rec = parse_record_id(&project_id, "projects");

    // Выбираем чаты
    let mut response = db
        .query("SELECT * FROM chats WHERE project_id = $proj ORDER BY created_at DESC")
        .bind(("proj", proj_rec.clone()))
        .await
        .map_err(|e| e.to_string())?;

    let mut chats: Vec<Value> = response.take(0).map_err(|e| e.to_string())?;

    // Получаем ребра между чатами для parent_chat_id
    let mut edges_res = db.query(r#"
        SELECT in, out, sort_order FROM contains 
        WHERE out IN (SELECT VALUE id FROM chats WHERE project_id = $proj)
          AND in CONTAINS 'chats:'
    "#)
        .bind(("proj", proj_rec))
        .await.map_err(|e| e.to_string())?;
    
    let edges: Vec<Value> = edges_res.take(0).unwrap_or_default();

    // Маппим
    for chat in &mut chats {
        if let Some(id) = chat.get("id").and_then(|i| i.as_str()) {
            if let Some(edge) = edges.iter().find(|e| e.get("out").and_then(|o| o.as_str()) == Some(id)) {
                chat["parent_chat_id"] = edge["in"].clone();
                chat["sort_order"] = edge["sort_order"].clone();
            }
        }
    }

    Ok(chats)
}

/// Получает все сообщения для конкретного чата.
#[tauri::command]
pub async fn get_chat_messages(
    chat_id: String,
    state: tauri::State<'_, AppState>,
) -> Result<Vec<Value>, String> {
    let db = state.surreal_db();
    let chat_rec = parse_record_id(&chat_id, "chats");

    // Ищем, на какое сообщение ссылается чат (leaf message)
    let mut leaf_res = db.query("SELECT out FROM contains WHERE in = $chat AND out CONTAINS 'chat_messages:' LIMIT 1")
        .bind(("chat", chat_rec.clone()))
        .await.map_err(|e| e.to_string())?;
    
    let edges: Vec<Value> = leaf_res.take(0).map_err(|e| e.to_string())?;
    let mut current_msg_id = edges.first().and_then(|e| e.get("out")).cloned();

    if current_msg_id.is_none() {
        return Ok(Vec::new()); // Чат пуст
    }

    let mut branch = Vec::new();
    
    // Грузим все сообщения проекта и ребра
    let mut all_msgs_res = db.query("SELECT * FROM chat_messages").await.map_err(|e| e.to_string())?;
    let all_messages: Vec<Value> = all_msgs_res.take(0).unwrap_or_default();
    
    let mut all_edges_res = db.query("SELECT in, out FROM contains WHERE in CONTAINS 'chat_messages:' AND out CONTAINS 'chat_messages:'").await.map_err(|e| e.to_string())?;
    let all_edges: Vec<Value> = all_edges_res.take(0).unwrap_or_default();

    loop {
        if let Some(ref msg_id_val) = current_msg_id {
            if let Some(msg_id_str) = msg_id_val.as_str() {
                if let Some(msg) = all_messages.iter().find(|m| m.get("id").and_then(|i| i.as_str()) == Some(msg_id_str)) {
                    branch.push(msg.clone());
                    // Ищем родителя
                    if let Some(edge) = all_edges.iter().find(|e| e.get("out").and_then(|o| o.as_str()) == Some(msg_id_str)) {
                        current_msg_id = edge.get("in").cloned();
                        continue;
                    }
                }
            }
        }
        break;
    }

    // Реверс, чтобы порядок был хронологическим (от корня к листу)
    branch.reverse();
    Ok(branch)
}

pub async fn get_message_branch_impl(
    db: &surreal_domain::SurrealDb,
    leaf_msg_id: &str,
) -> Result<Vec<Value>, String> {
    let leaf_record = parse_record_id(leaf_msg_id, "chat_messages");

    let mut current_msg_id = Some(json!(leaf_record.to_string()));
    let mut branch = Vec::new();
    
    let mut all_msgs_res = db.query("SELECT * FROM chat_messages").await.map_err(|e| e.to_string())?;
    let all_messages: Vec<Value> = all_msgs_res.take(0).unwrap_or_default();
    
    let mut all_edges_res = db.query("SELECT in, out FROM contains WHERE in CONTAINS 'chat_messages:' AND out CONTAINS 'chat_messages:'").await.map_err(|e| e.to_string())?;
    let all_edges: Vec<Value> = all_edges_res.take(0).unwrap_or_default();

    loop {
        if let Some(ref msg_id_val) = current_msg_id {
            if let Some(msg_id_str) = msg_id_val.as_str() {
                if let Some(msg) = all_messages.iter().find(|m| m.get("id").and_then(|i| i.as_str()) == Some(msg_id_str)) {
                    branch.push(msg.clone());
                    // Ищем родителя
                    if let Some(edge) = all_edges.iter().find(|e| e.get("out").and_then(|o| o.as_str()) == Some(msg_id_str)) {
                        current_msg_id = edge.get("in").cloned();
                        continue;
                    }
                }
            }
        }
        break;
    }

    branch.reverse();
    Ok(branch)
}

#[tauri::command]
pub async fn get_message_branch(
    leaf_msg_id: String,
    state: tauri::State<'_, AppState>,
) -> Result<Vec<Value>, String> {
    get_message_branch_impl(&state.surreal_db(), &leaf_msg_id).await
}

/// Создаёт новую ветку чата от определённого сообщения
#[tauri::command]
pub async fn fork_chat(
    project_id: String,
    message_id: String,
    new_title: String,
    state: tauri::State<'_, AppState>,
) -> Result<Value, String> {
    let db = state.surreal_db();
    let proj_rec = parse_record_id(&project_id, "projects");
    let msg_rec = parse_record_id(&message_id, "chat_messages");

    let new_chat_id = uuid::Uuid::new_v4().to_string();
    let chat_rec = parse_record_id(&new_chat_id, "chats");

    let mut response = db
        .query(r#"
            LET $chat = (CREATE type::thing('chats', $id) SET project_id = $proj, title = $title, created_at = time::now())[0];
            RELATE $chat -> contains -> $msg SET sort_order = 0;
            SELECT * FROM $chat;
        "#)
        .bind(("id", new_chat_id))
        .bind(("proj", proj_rec))
        .bind(("title", new_title))
        .bind(("msg", msg_rec))
        .await
        .map_err(|e| e.to_string())?;

    let new_chat: Option<Value> = response.take(2).map_err(|e| e.to_string())?;
    new_chat.ok_or("Failed to create chat".to_string())
}

#[tauri::command]
pub async fn update_chat_parent(
    chat_id: String,
    new_parent_id: Option<String>,
    state: tauri::State<'_, AppState>,
) -> Result<(), String> {
    let db = state.surreal_db();
    let chat_rec = parse_record_id(&chat_id, "chats");

    // Удаляем старую связь parent -> chat
    db.query("DELETE contains WHERE out = $chat AND in CONTAINS 'chats:'")
        .bind(("chat", chat_rec.clone()))
        .await.map_err(|e| e.to_string())?;

    if let Some(parent) = new_parent_id {
        let parent_rec = parse_record_id(&parent, "chats");
        db.query("RELATE $parent -> contains -> $chat SET sort_order = 0")
            .bind(("parent", parent_rec))
            .bind(("chat", chat_rec))
            .await.map_err(|e| e.to_string())?;
    }
    
    Ok(())
}

#[derive(Serialize)]
pub struct SendChatResult {
    pub chat_id: String,
    pub assistant_msg_id: String,
}

#[tauri::command]
pub async fn send_chat_message(
    chat_id: String,
    text: String,
    project: String,
    app: tauri::AppHandle,
) -> Result<SendChatResult, String> {
    let state = app.state::<AppState>();
    let db = state.surreal_db();
    let proj_rec = parse_record_id(&project, "projects");

    let mut actual_chat_rec = parse_record_id(&chat_id, "chats");

    // Проверяем существует ли чат
    let mut check = db.query("SELECT id FROM chats WHERE id = $chat").bind(("chat", actual_chat_rec.clone())).await.map_err(|e| e.to_string())?;
    let chat_exists: Option<Value> = check.take(0).unwrap_or_default();
    
    if chat_exists.is_none() {
        let new_id = uuid::Uuid::new_v4().to_string();
        actual_chat_rec = parse_record_id(&new_id, "chats");
        let title: String = text.chars().take(40).collect();
        let title = if title.trim().is_empty() { "Новый чат".to_string() } else { title };
        db.query("CREATE type::thing('chats', $id) SET title = $title, project_id = $proj, session_context = []")
            .bind(("id", actual_chat_rec.clone()))
            .bind(("title", title))
            .bind(("proj", proj_rec.clone()))
            .await.map_err(|e| e.to_string())?;
    }

    // Ищем лист чата (текущее последнее сообщение), чтобы сделать его родителем
    let mut leaf_res = db.query("SELECT out FROM contains WHERE in = $chat AND out CONTAINS 'chat_messages:' LIMIT 1")
        .bind(("chat", actual_chat_rec.clone()))
        .await.map_err(|e| e.to_string())?;
    let edges: Vec<Value> = leaf_res.take(0).unwrap_or_default();
    let parent_msg_id = edges.first().and_then(|e| e.get("out")).and_then(|v| v.as_str()).map(|s| parse_record_id(s, "chat_messages"));

    let user_msg_id = uuid::Uuid::new_v4().to_string();
    let user_msg_rec = parse_record_id(&user_msg_id, "chat_messages");

    let assistant_msg_id = uuid::Uuid::new_v4().to_string();
    let assistant_msg_rec = parse_record_id(&assistant_msg_id, "chat_messages");

    // 1. Создаем сообщения
    db.query(r#"
        CREATE type::thing('chat_messages', $uid) SET project_id = $proj, role = 'user', content = $content, version = 1, created_at = time::now();
        CREATE type::thing('chat_messages', $aid) SET project_id = $proj, role = 'assistant', content = '', version = 1, created_at = time::now();
    "#)
    .bind(("uid", user_msg_rec.clone()))
    .bind(("aid", assistant_msg_rec.clone()))
    .bind(("proj", proj_rec.clone()))
    .bind(("content", text.clone()))
    .await.map_err(|e| e.to_string())?;

    // 2. Устанавливаем графовые связи
    if let Some(parent_msg) = parent_msg_id {
        // Добавляем к ветке
        db.query("RELATE $parent -> contains -> $uid SET sort_order = 0; RELATE $uid -> contains -> $aid SET sort_order = 0;")
            .bind(("parent", parent_msg))
            .bind(("uid", user_msg_rec.clone()))
            .bind(("aid", assistant_msg_rec.clone()))
            .await.map_err(|e| e.to_string())?;
    } else {
        // Новая ветка
        db.query("RELATE $uid -> contains -> $aid SET sort_order = 0;")
            .bind(("uid", user_msg_rec.clone()))
            .bind(("aid", assistant_msg_rec.clone()))
            .await.map_err(|e| e.to_string())?;
    }

    // 3. ОБНОВЛЯЕМ УКАЗАТЕЛЬ ЧАТА НА НОВЫЙ ЛИСТ (сообщение ассистента)
    // Удаляем старый указатель
    db.query("DELETE contains WHERE in = $chat AND out CONTAINS 'chat_messages:'; RELATE $chat -> contains -> $aid SET sort_order = 0;")
        .bind(("chat", actual_chat_rec.clone()))
        .bind(("aid", assistant_msg_rec.clone()))
        .await.map_err(|e| e.to_string())?;

    let chat_id_str = format!("chats:{}", actual_chat_rec.id());
    
    // 3. Запустить фоновый цикл агента
    let project_id_str = format!("projects:{}", proj_rec.id());
    tokio::spawn(async move {
        run_agent_loop(app, project_id_str, chat_id_str, assistant_msg_id, text).await;
    });

    Ok(SendChatResult {
        chat_id: format!("chats:{}", actual_chat_rec.id()),
        assistant_msg_id: assistant_msg_rec.id().to_string(),
    })
}
