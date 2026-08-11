use crate::logic::ai_agent::run_agent_loop;
use crate::AppState;
use serde::Serialize;
use serde_json::Value;
use surreal_domain::SurrealDb;
use surrealdb::types::RecordId;
use tauri::Manager;

/// Получает дерево чатов, сгруппированное для UI
#[tauri::command]
pub async fn get_chat_tree(
    project_id: String,
    state: tauri::State<'_, AppState>,
) -> Result<Vec<Value>, String> {
    let db = state.surreal_db();
    let id_part = if project_id.starts_with("projects:") {
        &project_id["projects:".len()..]
    } else {
        project_id.as_str()
    };

    let mut response = db
        .query("SELECT * FROM chats WHERE project_id = $proj ORDER BY created_at DESC")
        .bind(("proj", RecordId::new("projects", id_part)))
        .await
        .map_err(|e| e.to_string())?;

    let chats: Vec<Value> = response.take(0).map_err(|e| e.to_string())?;
    Ok(chats)
}

/// Получает все сообщения для конкретного чата
#[tauri::command]
pub async fn get_chat_messages(
    chat_id: String,
    state: tauri::State<'_, AppState>,
) -> Result<Vec<Value>, String> {
    let db = state.surreal_db();
    
    let id_part = if chat_id.starts_with("chats:") {
        &chat_id["chats:".len()..]
    } else {
        chat_id.as_str()
    };
    let chat_id_clean = id_part.trim_matches('`');

    let chat_id_str = format!("chats:{}", chat_id_clean);
    let chat_id_record = RecordId::new("chats", chat_id_clean);

    let mut response = db
        .query("SELECT * FROM chat_messages WHERE chat_id = $chat_id_str OR chat_id = $chat_id_record ORDER BY created_at ASC")
        .bind(("chat_id_str", chat_id_str))
        .bind(("chat_id_record", chat_id_record))
        .await
        .map_err(|e| e.to_string())?;

    let messages: Vec<Value> = response.take(0).map_err(|e| e.to_string())?;
    Ok(messages)
}

/// Получает плоский массив истории конкретной ветки, поднимаясь вверх по parent_msg_id
#[tauri::command]
pub async fn get_message_branch(
    leaf_msg_id: String,
    state: tauri::State<'_, AppState>,
) -> Result<Vec<Value>, String> {
    let db = state.surreal_db();

    // В SurrealDB можно получить дерево через рекурсивные связи, но так как у нас parent_msg_id,
    // проще сделать цикл или использовать подзапрос. Поскольку глубина может быть большой,
    // ищем все сообщения чата (для этого нам нужен chat_id), затем строим цепочку в Rust.

    // Сначала найдём leaf сообщение, чтобы узнать chat_id
    let mut response = db
        .query("SELECT * FROM chat_messages WHERE id = $id")
        .bind(("id", RecordId::new("chat_messages", leaf_msg_id.as_str())))
        .await
        .map_err(|e| e.to_string())?;

    let leaf_msg: Option<Value> = response.take(0).map_err(|e| e.to_string())?;
    let leaf = leaf_msg.ok_or("Message not found")?;
    let chat_id = leaf["chat_id"].as_str().unwrap_or("").to_string();

    if chat_id.is_empty() {
        return Err("Invalid chat_id".to_string());
    }

    // Получаем все сообщения этого чата
    let mut response = db
        .query("SELECT * FROM chat_messages WHERE chat_id = $chat_id")
        .bind(("chat_id", chat_id))
        .await
        .map_err(|e| e.to_string())?;

    let all_messages: Vec<Value> = response.take(0).map_err(|e| e.to_string())?;

    // Строим цепочку
    let mut branch = Vec::new();
    let mut current_id = leaf["id"].clone();

    loop {
        // Находим текущее сообщение
        if let Some(msg) = all_messages.iter().find(|m| m["id"] == current_id) {
            branch.push(msg.clone());
            if let Some(parent_id) = msg.get("parent_msg_id").and_then(|v| v.as_str()) {
                if !parent_id.is_empty() {
                    // Конвертируем строку parent_id в RecordId JSON формат, если нужно, или ищем как строку
                    // Предполагается что parent_id это просто строка
                    current_id = serde_json::Value::String(parent_id.to_string());
                    continue;
                }
            }
        }
        break;
    }

    // Реверс, чтобы порядок был хронологическим (от корня к листу)
    branch.reverse();

    Ok(branch)
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

    // 1. Получаем ветку сообщений до этого момента
    let branch_res = get_message_branch(message_id.clone(), state.clone()).await?;
    if branch_res.is_empty() {
        return Err("Cannot fork empty branch".to_string());
    }

    let original_chat_id = branch_res[0]["chat_id"].as_str().unwrap_or("").to_string();

    // 2. Создаем новый чат
    let new_chat_id = uuid::Uuid::new_v4().to_string();
    let id_part = if project_id.starts_with("projects:") {
        &project_id["projects:".len()..]
    } else {
        project_id.as_str()
    };

    let mut response = db
        .query("CREATE type::thing('chats', $id) SET project_id = $project_id, title = $title, parent_chat_id = $parent_chat_id, created_at = time::now()")
        .bind(("id", new_chat_id.clone()))
        .bind(("project_id", RecordId::new("projects", id_part)))
        .bind(("title", new_title))
        .bind(("parent_chat_id", original_chat_id.clone()))
        .await
        .map_err(|e| e.to_string())?;

    let new_chat: Option<Value> = response.take(0).map_err(|e| e.to_string())?;
    let new_chat_val = new_chat.ok_or("Failed to create chat")?;

    // 3. Копируем все сообщения из ветки в новый чат (или мы можем просто ссылаться на них?
    // Лучше скопировать, чтобы новый чат имел свою изолированную историю)
    let mut prev_new_msg_id: Option<String> = None;

    for msg in branch_res {
        let msg_new_id = uuid::Uuid::new_v4().to_string();

        let role = msg["role"].as_str().unwrap_or("");
        let content = msg["content"].as_str().unwrap_or("");

        let query = if prev_new_msg_id.is_some() {
            "CREATE type::thing('chat_messages', $id) SET project_id = $project_id, chat_id = $chat_id, role = $role, content = $content, parent_msg_id = $parent_msg_id, version = 1, created_at = time::now()"
        } else {
            "CREATE type::thing('chat_messages', $id) SET project_id = $project_id, chat_id = $chat_id, role = $role, content = $content, version = 1, created_at = time::now()"
        };

        let id_part = if project_id.starts_with("projects:") {
            &project_id["projects:".len()..]
        } else {
            project_id.as_str()
        };

        let mut req = db
            .query(query)
            .bind(("id", msg_new_id.clone()))
            .bind(("project_id", RecordId::new("projects", id_part)))
            .bind(("chat_id", new_chat_id.clone()))
            .bind(("role", role))
            .bind(("content", content));

        if let Some(parent) = prev_new_msg_id.as_ref() {
            req = req.bind(("parent_msg_id", parent.clone()));
        }

        let _ = req.await.map_err(|e| e.to_string())?;
        prev_new_msg_id = Some(msg_new_id);
    }

    Ok(new_chat_val)
}

/// Меняет родителя чата (для Drag and Drop)
#[tauri::command]
pub async fn update_chat_parent(
    chat_id: String,
    new_parent_id: Option<String>,
    state: tauri::State<'_, AppState>,
) -> Result<(), String> {
    let db = state.surreal_db();
    
    let query = match &new_parent_id {
        Some(_) => "UPDATE type::thing('chats', $id) SET parent_chat_id = $parent_id",
        None => "UPDATE type::thing('chats', $id) SET parent_chat_id = NONE",
    };
    
    let mut req = db.query(query).bind(("id", chat_id));
    
    if let Some(parent) = new_parent_id {
        req = req.bind(("parent_id", parent));
    }
    
    req.await.map_err(|e| e.to_string())?;
    Ok(())
}

/// Результат отправки: chat_id (мог быть создан автоматически) + id ответа ассистента.
#[derive(Serialize)]
pub struct SendChatResult {
    pub chat_id: String,
    pub assistant_msg_id: String,
}

/// Отправляет сообщение в чат и запускает генерацию ИИ.
/// Если чат не найден (или chat_id пуст) — создаёт чат в проекте автоматически.
#[tauri::command]
pub async fn send_chat_message(
    chat_id: String,
    text: String,
    project: String,
    app: tauri::AppHandle,
) -> Result<SendChatResult, String> {
    println!(
        "[API] send_chat_message called: chat_id={}, project={}, text={}",
        chat_id, project, text
    );
    let state = app.state::<AppState>();
    let db = state.surreal_db();

    // Парсим chat_id и убираем возможные бэктики
    let chat_id_part = if chat_id.starts_with("chats:") {
        &chat_id["chats:".len()..]
    } else {
        chat_id.as_str()
    };
    let mut chat_id_clean = chat_id_part.trim_matches('`').to_string();

    // Ищем чат (данные могли храниться и как record, и как строка)
    let chat_record_id = RecordId::new("chats", chat_id_clean.as_str());
    let mut chat_resp = db
        .query("SELECT project_id FROM chats WHERE id = $rec OR id = $str LIMIT 1")
        .bind(("rec", chat_record_id))
        .bind(("str", format!("chats:{}", chat_id_clean)))
        .await
        .map_err(|e| format!("Ошибка чтения чата: {e}"))?;
    let chat_info: Option<Value> = chat_resp.take(0).map_err(|e| e.to_string())?;

    let project_id_val = match chat_info {
        Some(info) => info["project_id"].clone(),
        None => {
            // Чат не найден — создаём в проекте
            let new_id = uuid::Uuid::new_v4().to_string();
            let title: String = text.chars().take(40).collect();
            let title = if title.trim().is_empty() {
                "Новый чат".to_string()
            } else {
                title
            };
            let proj_part = project
                .strip_prefix("projects:")
                .unwrap_or(&project)
                .trim_matches('`')
                .to_string();
            
            let chat_id_rec = RecordId::new("chats", new_id.as_str());
            let project_id_rec = RecordId::new("projects", proj_part.as_str());
            
            db.query("UPSERT $id SET title = $title, project_id = $project_id, session_context = []")
                .bind(("id", chat_id_rec))
                .bind(("title", title))
                .bind(("project_id", project_id_rec))
                .await
                .map_err(|e| format!("Не удалось создать чат: {e}"))?;
            println!("[API] auto-created chat: chats:{new_id}");
            chat_id_clean = new_id;
            Value::String(format!("projects:{proj_part}"))
        }
    };
    let chat_id_full = format!("chats:{}", chat_id_clean);

    // Находим последнее сообщение, чтобы сделать его родителем
    let mut last_msg_resp = db
        .query(
            "SELECT id, created_at FROM chat_messages WHERE (chat_id = $cstr OR chat_id = $crec) ORDER BY created_at DESC LIMIT 1",
        )
        .bind(("cstr", chat_id_full.clone()))
        .bind(("crec", RecordId::new("chats", chat_id_clean.as_str())))
        .await
        .map_err(|e| e.to_string())?;

    let last_msg: Option<Value> = last_msg_resp.take(0).map_err(|e| e.to_string())?;
    let mut parent_msg_id_bind = None;
    if let Some(msg) = last_msg {
        if let Some(id_str) = msg["id"].as_str() {
            parent_msg_id_bind = Some(id_str.to_string());
        }
    }

    // 1. Создать пользовательское сообщение
    let user_msg_id = uuid::Uuid::new_v4().to_string();
    // Парсим project_id в RecordId
    let project_id_rec = match &project_id_val {
        Value::String(s) => {
            let clean = s.trim_matches('`');
            let parts: Vec<&str> = clean.split(':').collect();
            if parts.len() == 2 {
                RecordId::new(parts[0], parts[1])
            } else {
                return Err(format!("Invalid project_id format: {}", clean));
            }
        }
        Value::Object(o) => {
            if let Some(id_val) = o.get("id").and_then(|v| v.as_str()) {
                let clean = id_val.trim_matches('`');
                let parts: Vec<&str> = clean.split(':').collect();
                if parts.len() == 2 {
                    RecordId::new(parts[0], parts[1])
                } else {
                    return Err(format!("Invalid project_id format in object: {}", clean));
                }
            } else {
                return Err("project_id object missing 'id' field".to_string());
            }
        }
        _ => return Err("Invalid project_id type".to_string()),
    };
    
    // Парсим chat_id в RecordId
    let chat_id_clean = chat_id_full.strip_prefix("chats:").unwrap_or(&chat_id_full);
    let chat_id_rec = RecordId::new("chats", chat_id_clean);
    
    // Нормализуем parent до RecordId
    let parent_msg_id_rec = parent_msg_id_bind.as_ref().map(|p| {
        let p = p.trim_matches('`');
        if p.starts_with("chat_messages:") {
            let parts: Vec<&str> = p.split(':').collect();
            if parts.len() == 2 {
                RecordId::new(parts[0], parts[1])
            } else {
                RecordId::new("chat_messages", p)
            }
        } else {
            RecordId::new("chat_messages", p)
        }
    });
    
    let user_msg_id_rec = RecordId::new("chat_messages", user_msg_id.as_str());

    let query_user = if parent_msg_id_rec.is_some() {
        "UPSERT $id SET project_id = $project_id, chat_id = $chat_id, role = 'user', content = $content, parent_msg_id = $parent_msg_id, version = 1, created_at = time::now()"
    } else {
        "UPSERT $id SET project_id = $project_id, chat_id = $chat_id, role = 'user', content = $content, version = 1, created_at = time::now()"
    };

    let mut req_user = db
        .query(query_user)
        .bind(("id", user_msg_id_rec))
        .bind(("project_id", project_id_rec.clone()))
        .bind(("chat_id", chat_id_rec.clone()))
        .bind(("content", text.clone()));
    if let Some(p) = &parent_msg_id_rec {
        req_user = req_user.bind(("parent_msg_id", p.clone()));
    }
    req_user.await.map_err(|e| e.to_string())?;

    // 2. Создать сообщение ассистента (пока пустое)
    let assistant_msg_id = uuid::Uuid::new_v4().to_string();
    let assistant_msg_id_rec = RecordId::new("chat_messages", assistant_msg_id.as_str());
    let user_msg_id_rec_for_parent = RecordId::new("chat_messages", user_msg_id.as_str());

    let query_assistant = "UPSERT $id SET project_id = $project_id, chat_id = $chat_id, role = 'assistant', content = '', parent_msg_id = $parent_msg_id, version = 1, created_at = time::now()";

    db.query(query_assistant)
        .bind(("id", assistant_msg_id_rec))
        .bind(("project_id", project_id_rec.clone()))
        .bind(("chat_id", chat_id_rec.clone()))
        .bind(("parent_msg_id", user_msg_id_rec_for_parent))
        .await
        .map_err(|e| e.to_string())?;

    // 3. Запустить фоновый цикл агента
    let chat_id_clone = chat_id_full.clone();
    let assistant_msg_id_clone = assistant_msg_id.clone();
    // project_id может быть строкой "projects:xxx" или RecordId-объектом {"tb":"projects","id":"..."}
    let project_id_str = match &project_id_val {
        Value::String(s) => s.trim_matches('`').to_string(),
        Value::Object(o) => o
            .get("id")
            .and_then(|v| v.as_str())
            .map(|id| format!("projects:{}", id.trim_matches('`')))
            .unwrap_or_default(),
        _ => String::new(),
    };
    tokio::spawn(async move {
        run_agent_loop(app, project_id_str, chat_id_clone, assistant_msg_id_clone, text).await;
    });

    Ok(SendChatResult {
        chat_id: chat_id_full,
        assistant_msg_id,
    })
}
