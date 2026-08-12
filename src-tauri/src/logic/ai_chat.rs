use crate::logic::ai_agent::run_agent_loop;
use crate::AgentTasks;
use crate::AppState;
use serde::Serialize;
use serde_json::Value;
use surreal_domain::SurrealDb;
use surrealdb::types::RecordId;
use tauri::{Manager, State};

fn parse_record_id(id: &str, default_table: &str) -> RecordId {
    let clean = id.trim().trim_matches(|c| c == '`' || c == '⟨' || c == '⟩');
    if let Some(colon) = clean.find(':') {
        let table = clean[..colon]
            .trim()
            .trim_matches(|c| c == '`' || c == '⟨' || c == '⟩');
        let key = clean[colon + 1..]
            .trim()
            .trim_matches(|c| c == '`' || c == '⟨' || c == '⟩');
        RecordId::new(table, key)
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

/// Получает ВСЕ сообщения для конкретного чата (для UI, чтобы строить дерево вариантов).

fn clean_surreal_id(val: &Value) -> Option<String> {
    if let Some(s) = val.as_str() {
        let cleaned = s.replace('⟨', "").replace('⟩', "").replace('`', "");
        if cleaned == "NONE" || cleaned == "null" || cleaned.is_empty() {
            return None;
        }
        return Some(cleaned);
    }

    if let Some(obj) = val.as_object() {
        if let Some(tb) = obj.get("tb").and_then(|v| v.as_str()) {
            let id_str = if let Some(id_obj) = obj.get("id").and_then(|v| v.as_object()) {
                if let Some(s) = id_obj.get("String").and_then(|v| v.as_str()) {
                    Some(s.to_string())
                } else if let Some(n) = id_obj.get("Number").and_then(|v| v.as_u64()) {
                    Some(n.to_string())
                } else {
                    None
                }
            } else if let Some(s) = obj.get("id").and_then(|v| v.as_str()) {
                Some(s.to_string())
            } else {
                None
            };
            
            if let Some(id) = id_str {
                let cleaned_id = id.replace('⟨', "").replace('⟩', "").replace('`', "");
                return Some(format!("{}:{}", tb, cleaned_id));
            }
        }
    }
    None
}

fn sanitize_message_ids(mut messages: Vec<Value>) -> Vec<Value> {
    for msg in &mut messages {
        if let Value::Object(obj) = msg {
            if let Some(id_val) = obj.get("id") {
                if let Some(clean_id) = clean_surreal_id(id_val) {
                    obj.insert("id".to_string(), Value::from(clean_id));
                }
            }
            if let Some(pid_val) = obj.get("parent_id") {
                if let Some(clean_pid) = clean_surreal_id(pid_val) {
                    obj.insert("parent_id".to_string(), Value::from(clean_pid));
                }
            }
        }
    }
    messages
}

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
    Ok(sanitize_message_ids(messages))
}

pub async fn get_chat_messages_impl(
    db: &surrealdb::Surreal<surrealdb::engine::local::Db>,
    chat_id: &str,
) -> Result<Vec<Value>, String> {
    let chat_rec = parse_record_id(chat_id, "chats");

    let mut response = db
        .query("SELECT * FROM chat_messages WHERE chat_id = $chat AND (is_active = true OR is_active = NONE) ORDER BY created_at ASC")
        .bind(("chat", chat_rec))
        .await
        .map_err(|e| e.to_string())?;

    let messages: Vec<Value> = response.take(0).unwrap_or_default();
    println!(
        "[DEBUG get_chat_messages] returning {} messages",
        messages.len()
    );
    Ok(sanitize_message_ids(messages))
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
    pub user_msg_id: String,
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

    // Fetch the last message in the chat to use as parent_id for the new user message
    let mut check_last = db.query("SELECT id, created_at FROM chat_messages WHERE chat_id = $chat ORDER BY created_at DESC LIMIT 1")
        .bind(("chat", actual_chat_rec.clone()))
        .await
        .map_err(|e| e.to_string())?;

    let last_msg: Option<Value> = check_last.take(0).unwrap_or_default();
    let parent_id_val = last_msg.and_then(|m| m.get("id").cloned());

    let mut query = db.query(r#"
        CREATE $uid SET chat_id = $chat, project_id = $proj, role = 'user', content = $content, version = 1, parent_id = $parent, is_active = true, created_at = time::now();
        CREATE $aid SET chat_id = $chat, project_id = $proj, role = 'assistant', content = '', version = 1, parent_id = $uid, is_active = true, created_at = time::now();
    "#);

    if let Some(p) = parent_id_val {
        println!("[SEND] user_msg={} parent={:?} assistant={}", user_msg_uuid, p, assistant_msg_uuid);
        if let Some(clean_p) = clean_surreal_id(&p) {
            let p_rec = parse_record_id(&clean_p, "chat_messages");
            query = query.bind(("parent", p_rec));
        } else {
            query = query.bind(("parent", p)); // fallback
        }
    } else {
        println!("[SEND] user_msg={} parent=NONE (first msg) assistant={}", user_msg_uuid, assistant_msg_uuid);
        query = db.query(r#"
            CREATE $uid SET chat_id = $chat, project_id = $proj, role = 'user', content = $content, version = 1, parent_id = NONE, is_active = true, created_at = time::now();
            CREATE $aid SET chat_id = $chat, project_id = $proj, role = 'assistant', content = '', version = 1, parent_id = $uid, is_active = true, created_at = time::now();
        "#);
    }

    query
        .bind(("uid", user_msg_rec.clone()))
        .bind(("aid", assistant_msg_rec.clone()))
        .bind(("chat", actual_chat_rec.clone()))
        .bind(("proj", proj_rec.clone()))
        .bind(("content", text.clone()))
        .await
        .map_err(|e| e.to_string())?;

    let chat_id_str = actual_chat_id_str.clone();

    // 2. Запустить фоновый цикл агента
    let project_id_str = project.clone();
    let assistant_msg_id_str = format!("chat_messages:{}", assistant_msg_uuid);

    let tasks_state = app.state::<AgentTasks>();
    let app2 = app.clone();
    let chat_id_str2 = chat_id_str.clone();
    let handle = tokio::spawn(async move {
        run_agent_loop(
            app2.clone(),
            project_id_str,
            chat_id_str,
            assistant_msg_id_str,
            text,
        )
        .await;
        let tasks_state = app2.state::<AgentTasks>();
        let mut tasks = tasks_state.0.lock().await;
        tasks.remove(&chat_id_str2);
    });

    // Store handle
    let mut tasks = tasks_state.0.lock().await;
    tasks.insert(actual_chat_id_str.clone(), handle);

    Ok(SendChatResult {
        chat_id: actual_chat_id_str,
        assistant_msg_id: format!("chat_messages:{}", assistant_msg_uuid),
        user_msg_id: format!("chat_messages:{}", user_msg_uuid),
    })
}

#[tauri::command]
pub async fn cancel_generation(
    chat_id: String,
    state: State<'_, AgentTasks>,
) -> Result<(), String> {
    let mut tasks = state.0.lock().await;
    if let Some(handle) = tasks.remove(&chat_id) {
        handle.abort();
        println!("[DEBUG] Aborted generation for chat {}", chat_id);
    }
    Ok(())
}

#[tauri::command]
pub async fn delete_chat_message(
    msg_id: String,
    state: tauri::State<'_, AppState>,
) -> Result<(), String> {
    let db = state.surreal_db();
    let msg_rec = parse_record_id(&msg_id, "chat_messages");
    db.query("DELETE $msg")
        .bind(("msg", msg_rec))
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn edit_chat_message(
    msg_id: String,
    new_text: String,
    chat_id: String,
    project: String,
    app: tauri::AppHandle,
) -> Result<SendChatResult, String> {
    let state = app.state::<AppState>();
    let db = state.surreal_db();
    let msg_rec = parse_record_id(&msg_id, "chat_messages");
    let proj_rec = parse_record_id(&project, "projects");
    let chat_rec = parse_record_id(&chat_id, "chats");

    // Fetch the parent_id of the original message
    let mut check = db
        .query("SELECT parent_id FROM $msg")
        .bind(("msg", msg_rec.clone()))
        .await
        .map_err(|e| e.to_string())?;
    let orig: Option<Value> = check.take(0).unwrap_or_default();

    let parent_id_val = orig.as_ref().and_then(|v| v.get("parent_id").cloned());

    // We don't mark anything as inactive globally, we just mark siblings as inactive
    let is_none = parent_id_val.is_none() 
        || parent_id_val.as_ref().unwrap().is_null() 
        || parent_id_val.as_ref().unwrap().as_str() == Some("NONE");

    let mut query_inactive = db.query(if is_none {
        "UPDATE chat_messages SET is_active = false WHERE chat_id = $chat AND parent_id = NONE"
    } else {
        "UPDATE chat_messages SET is_active = false WHERE chat_id = $chat AND parent_id = $parent"
    });

    if !is_none {
        if let Some(clean_p) = clean_surreal_id(parent_id_val.as_ref().unwrap()) {
            let p_rec = parse_record_id(&clean_p, "chat_messages");
            query_inactive = query_inactive.bind(("parent", p_rec));
        }
    }

    query_inactive
        .bind(("chat", chat_rec.clone()))
        .await
        .map_err(|e| e.to_string())?;

    // Create a new user message
    let new_user_uuid = uuid::Uuid::new_v4().to_string();
    let new_user_rec = parse_record_id(&new_user_uuid, "chat_messages");
    let new_assistant_uuid = uuid::Uuid::new_v4().to_string();
    let new_assistant_rec = parse_record_id(&new_assistant_uuid, "chat_messages");

    let mut query_create = db.query(if is_none {
        r#"
        CREATE $uid SET chat_id = $chat, project_id = $proj, role = 'user', content = $content, version = 1, parent_id = NONE, is_active = true, created_at = time::now();
        CREATE $aid SET chat_id = $chat, project_id = $proj, role = 'assistant', content = '', version = 1, parent_id = $uid, is_active = true, created_at = time::now();
        "#
    } else {
        r#"
        CREATE $uid SET chat_id = $chat, project_id = $proj, role = 'user', content = $content, version = 1, parent_id = $parent, is_active = true, created_at = time::now();
        CREATE $aid SET chat_id = $chat, project_id = $proj, role = 'assistant', content = '', version = 1, parent_id = $uid, is_active = true, created_at = time::now();
        "#
    });

    if !is_none {
        // We know we can clean it because we did it above
        if let Some(clean_p) = clean_surreal_id(parent_id_val.as_ref().unwrap()) {
            let p_rec = parse_record_id(&clean_p, "chat_messages");
            query_create = query_create.bind(("parent", p_rec));
        }
    }

    query_create
        .bind(("uid", new_user_rec.clone()))
        .bind(("aid", new_assistant_rec.clone()))
        .bind(("chat", chat_rec.clone()))
        .bind(("proj", proj_rec.clone()))
        .bind(("content", new_text.clone()))
        .await
        .map_err(|e| e.to_string())?;

    // Start background agent
    let project_id_str = project.clone();
    let assistant_msg_id_str = format!("chat_messages:{}", new_assistant_uuid);
    let chat_id_str2 = chat_id.clone();
    let app2 = app.clone();

    let tasks_state = app.state::<AgentTasks>();
    let handle = tokio::spawn(async move {
        run_agent_loop(
            app2.clone(),
            project_id_str,
            chat_id.clone(),
            assistant_msg_id_str,
            new_text,
        )
        .await;
        let tasks = app2.state::<AgentTasks>();
        let mut tasks_lock = tasks.0.lock().await;
        tasks_lock.remove(&chat_id);
    });
    let mut tasks = tasks_state.0.lock().await;
    tasks.insert(chat_id_str2.clone(), handle);

    Ok(SendChatResult {
        chat_id: chat_id_str2,
        assistant_msg_id: format!("chat_messages:{}", new_assistant_uuid),
        user_msg_id: format!("chat_messages:{}", new_user_uuid),
    })
}

#[tauri::command]
pub async fn regenerate_chat_message(
    parent_msg_id: String,
    chat_id: String,
    project: String,
    app: tauri::AppHandle,
) -> Result<SendChatResult, String> {
    let state = app.state::<AppState>();
    let db = state.surreal_db();
    let chat_rec = parse_record_id(&chat_id, "chats");
    let proj_rec = parse_record_id(&project, "projects");
    let user_msg_rec = parse_record_id(&parent_msg_id, "chat_messages");

    // Достать текст запроса из родительского сообщения пользователя
    let mut check_user = db
        .query("SELECT content FROM $parent")
        .bind(("parent", user_msg_rec.clone()))
        .await
        .map_err(|e| e.to_string())?;

    let user_msg: Option<Value> = check_user.take(0).unwrap_or_default();
    let user_text = user_msg
        .and_then(|v| {
            v.get("content")
                .and_then(|c| c.as_str())
                .map(|s| s.to_string())
        })
        .unwrap_or_default();

    if user_text.is_empty() {
        return Err(format!(
            "User message '{}' not found or empty",
            parent_msg_id
        ));
    }

    // Mark previous assistant variants (children of this user message) as inactive
    db.query("UPDATE chat_messages SET is_active = false WHERE parent_id = $parent AND role = 'assistant'")
        .bind(("parent", user_msg_rec.clone()))
        .await
        .map_err(|e| e.to_string())?;

    let new_assistant_uuid = uuid::Uuid::new_v4().to_string();
    let new_assistant_rec = parse_record_id(&new_assistant_uuid, "chat_messages");

    db.query(r#"
        CREATE $aid SET chat_id = $chat, project_id = $proj, role = 'assistant', content = '', version = 1, parent_id = $parent, is_active = true, created_at = time::now();
    "#)
    .bind(("aid", new_assistant_rec.clone()))
    .bind(("chat", chat_rec.clone()))
    .bind(("proj", proj_rec.clone()))
    .bind(("parent", user_msg_rec))
    .await.map_err(|e| e.to_string())?;

    // Start background agent
    let project_id_str = project.clone();
    let assistant_msg_id_str = format!("chat_messages:{}", new_assistant_uuid);
    let chat_id_str2 = chat_id.clone();
    let app2 = app.clone();

    let tasks_state = app.state::<AgentTasks>();
    let handle = tokio::spawn(async move {
        run_agent_loop(
            app2.clone(),
            project_id_str,
            chat_id.clone(),
            assistant_msg_id_str,
            user_text,
        )
        .await;
        let tasks = app2.state::<AgentTasks>();
        let mut tasks_lock = tasks.0.lock().await;
        tasks_lock.remove(&chat_id);
    });
    let mut tasks = tasks_state.0.lock().await;
    tasks.insert(chat_id_str2.clone(), handle);

    Ok(SendChatResult {
        chat_id: chat_id_str2,
        assistant_msg_id: format!("chat_messages:{}", new_assistant_uuid),
        user_msg_id: "".to_string(),
    })
}

#[tauri::command]
pub async fn switch_message_variant(
    msg_id: String,
    state: tauri::State<'_, AppState>,
) -> Result<(), String> {
    let db = state.surreal_db();
    let msg_rec = parse_record_id(&msg_id, "chat_messages");

    // Fetch the target parent_id
    let mut check = db
        .query("SELECT parent_id, chat_id FROM $msg")
        .bind(("msg", msg_rec.clone()))
        .await
        .map_err(|e| e.to_string())?;

    let orig: Option<Value> = check.take(0).unwrap_or_default();
    if let Some(orig) = orig {
        let chat_id = orig.get("chat_id").cloned().unwrap_or_default();

        let parent_id_val = orig.get("parent_id").cloned();

        let is_none = parent_id_val.is_none() 
            || parent_id_val.as_ref().unwrap().is_null() 
            || parent_id_val.as_ref().unwrap().as_str() == Some("NONE");

        let mut query = db.query(if is_none {
            "UPDATE chat_messages SET is_active = false WHERE chat_id = $chat AND parent_id = NONE"
        } else {
            "UPDATE chat_messages SET is_active = false WHERE chat_id = $chat AND parent_id = $parent"
        });
        
        let clean_chat_id = clean_surreal_id(&chat_id).unwrap_or_default();
        let chat_rec = parse_record_id(&clean_chat_id, "chats");
        query = query.bind(("chat", chat_rec));

        if !is_none {
            if let Some(clean_parent_id) = clean_surreal_id(parent_id_val.as_ref().unwrap()) {
                let p_rec = parse_record_id(&clean_parent_id, "chat_messages");
                query = query.bind(("parent", p_rec));
            }
        }

        query.await.map_err(|e| e.to_string())?;

        // Mark target as active
        db.query("UPDATE $msg SET is_active = true")
            .bind(("msg", msg_rec))
            .await
            .map_err(|e| e.to_string())?;
    }

    Ok(())
}
