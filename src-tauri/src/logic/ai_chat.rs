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
    let mut edges_res = db
        .query(
            r#"
        SELECT in, out, sort_order FROM contains 
        WHERE out IN (SELECT VALUE id FROM chats WHERE project_id = $proj)
    "#,
        )
        .bind(("proj", proj_rec))
        .await
        .map_err(|e| e.to_string())?;

    let edges: Vec<Value> = edges_res.take(0).unwrap_or_default();

    // Маппим
    for chat in &mut chats {
        if let Some(id) = chat.get("id").and_then(|i| i.as_str()) {
            if let Some(edge) = edges
                .iter()
                .find(|e| e.get("out").and_then(|o| o.as_str()) == Some(id))
            {
                if let Some(parent) = edge.get("in").and_then(|i| i.as_str()) {
                    if parent.starts_with("chats:") {
                        chat["parent_chat_id"] = edge["in"].clone();
                        chat["sort_order"] = edge["sort_order"].clone();
                    }
                }
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

    let mut response = db
        .query("SELECT * FROM chat_messages WHERE chat_id = $chat ORDER BY created_at ASC")
        .bind(("chat", chat_rec))
        .await
        .map_err(|e| e.to_string())?;

    let messages: Vec<Value> = response.take(0).unwrap_or_default();
    println!("[DEBUG get_chat_messages] returning {} messages", messages.len());
    Ok(messages)
}



pub async fn get_chat_messages_impl(
    db: &surrealdb::Surreal<surrealdb::engine::local::Db>,
    chat_id: &str,
) -> Result<Vec<Value>, String> {
    let chat_rec = parse_record_id(chat_id, "chats");

    let mut response = db
        .query("SELECT * FROM chat_messages WHERE chat_id = $chat ORDER BY created_at ASC")
        .bind(("chat", chat_rec))
        .await
        .map_err(|e| e.to_string())?;

    let messages: Vec<Value> = response.take(0).unwrap_or_default();
    Ok(messages)
}

#[tauri::command]
pub async fn get_message_branch(
    chat_id: String,
    state: tauri::State<'_, AppState>,
) -> Result<Vec<Value>, String> {
    get_chat_messages_impl(&state.surreal_db(), &chat_id).await
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
    let new_chat_rec = parse_record_id(&new_chat_id, "chats");

    let mut response = db
        .query(r#"
            LET $target_msg = (SELECT * FROM $msg)[0];
            LET $old_chat = $target_msg.chat_id;
            
            LET $chat = (CREATE $new_chat SET project_id = $proj, title = $title, created_at = time::now())[0];
            
            LET $orig_msgs = (SELECT * FROM chat_messages WHERE chat_id = $old_chat AND created_at <= $target_msg.created_at ORDER BY created_at ASC);
            
            FOR $m IN $orig_msgs {
                CREATE chat_messages CONTENT {
                    chat_id: $chat.id,
                    project_id: $m.project_id,
                    role: $m.role,
                    content: $m.content,
                    version: $m.version,
                    quoted_context: $m.quoted_context,
                    created_at: $m.created_at,
                    updated_at: $m.updated_at
                };
            };
            
            RETURN $chat;
        "#)
        .bind(("new_chat", new_chat_rec))
        .bind(("proj", proj_rec))
        .bind(("title", new_title))
        .bind(("msg", msg_rec))
        .await
        .map_err(|e| e.to_string())?;

    let new_chat: Option<Value> = response.take(0).map_err(|e| e.to_string())?;
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
    db.query("DELETE contains WHERE out = $chat")
        .bind(("chat", chat_rec.clone()))
        .await
        .map_err(|e| e.to_string())?;

    if let Some(parent) = new_parent_id {
        let parent_rec = parse_record_id(&parent, "chats");
        db.query("RELATE $parent -> contains -> $chat SET sort_order = 0")
            .bind(("parent", parent_rec))
            .bind(("chat", chat_rec))
            .await
            .map_err(|e| e.to_string())?;
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
    let mut check = db
        .query("SELECT id FROM chats WHERE id = $chat")
        .bind(("chat", actual_chat_rec.clone()))
        .await
        .map_err(|e| e.to_string())?;
    let chat_exists: Option<Value> = check.take(0).unwrap_or_default();

    let mut actual_chat_id_str = chat_id.clone();
    if chat_exists.is_none() {
        let new_id = uuid::Uuid::new_v4().to_string();
        actual_chat_id_str = format!("chats:{}", new_id);
        actual_chat_rec = parse_record_id(&new_id, "chats");
        let title: String = text.chars().take(40).collect();
        let title = if title.trim().is_empty() {
            "Новый чат".to_string()
        } else {
            title
        };
        db.query("CREATE $id SET title = $title, project_id = $proj, session_context = []")
            .bind(("id", actual_chat_rec.clone()))
            .bind(("title", title))
            .bind(("proj", proj_rec.clone()))
            .await
            .map_err(|e| e.to_string())?;
    }

    let user_msg_uuid = uuid::Uuid::new_v4().to_string();
    let user_msg_rec = parse_record_id(&user_msg_uuid, "chat_messages");

    let assistant_msg_uuid = uuid::Uuid::new_v4().to_string();
    let assistant_msg_rec = parse_record_id(&assistant_msg_uuid, "chat_messages");

    // 1. Создаем сообщения привязанные к чату
    db.query(r#"
        CREATE $uid SET chat_id = $chat, project_id = $proj, role = 'user', content = $content, version = 1, created_at = time::now();
        CREATE $aid SET chat_id = $chat, project_id = $proj, role = 'assistant', content = '', version = 1, created_at = time::now();
    "#)
    .bind(("uid", user_msg_rec.clone()))
    .bind(("aid", assistant_msg_rec.clone()))
    .bind(("chat", actual_chat_rec.clone()))
    .bind(("proj", proj_rec.clone()))
    .bind(("content", text.clone()))
    .await.map_err(|e| e.to_string())?;

    let chat_id_str = actual_chat_id_str.clone();

    // 2. Запустить фоновый цикл агента
    let project_id_str = project.clone();
    let assistant_msg_id_str = format!("chat_messages:{}", assistant_msg_uuid);

    tokio::spawn(async move {
        run_agent_loop(app, project_id_str, chat_id_str, assistant_msg_id_str, text).await;
    });

    Ok(SendChatResult {
        chat_id: actual_chat_id_str,
        assistant_msg_id: format!("chat_messages:{}", assistant_msg_uuid),
    })
}
