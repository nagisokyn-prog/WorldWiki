use crate::AppState;
use serde_json::Value;
use surreal_domain::SurrealDb;
use super::{parse_record_id, clean_surreal_id};

/// Получает дерево чатов, сгруппированное для UI
#[tauri::command]
pub async fn get_chat_tree(
    project_id: String,
    state: tauri::State<'_, AppState>,
) -> Result<Vec<Value>, String> {
    get_chat_tree_impl(state.surreal_db(), &project_id).await
}

pub async fn get_chat_tree_impl(
    db: &surrealdb::Surreal<surrealdb::engine::local::Db>,
    project_id: &str,
) -> Result<Vec<Value>, String> {
    let proj_rec = parse_record_id(project_id, "projects");

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
        if let Some(id) = chat.get("id").and_then(clean_surreal_id) {
            chat["id"] = Value::from(id.clone()); // Update the ID to the clean version
            if let Some(edge) = edges
                .iter()
                .find(|e| e.get("out").and_then(clean_surreal_id) == Some(id.clone()))
            {
                if let Some(parent) = edge.get("in").and_then(clean_surreal_id) {
                    if parent.starts_with("chats:") {
                        chat["parent_chat_id"] = Value::from(parent);
                        chat["sort_order"] = edge["sort_order"].clone();
                    }
                }
            }
        }
    }

    Ok(chats)
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
    get_chat_messages_impl(state.surreal_db(), &chat_id).await
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn msg(id: Value, parent: Option<Value>) -> Value {
        let mut m = json!({ "id": id, "content": "x" });
        if let Some(p) = parent {
            m["parent_id"] = p;
        }
        m
    }

    #[test]
    fn sanitizes_record_id_objects_to_strings() {
        let messages = vec![
            msg(json!({ "tb": "chat_messages", "id": { "String": "m1" } }), None),
            msg(
                json!({ "tb": "chat_messages", "id": { "Number": 5 } }),
                Some(json!({ "tb": "chat_messages", "id": { "String": "m1" } })),
            ),
        ];

        let out = sanitize_message_ids(messages);
        assert_eq!(out[0]["id"], json!("chat_messages:m1"));
        assert_eq!(out[1]["id"], json!("chat_messages:5"));
        assert_eq!(out[1]["parent_id"], json!("chat_messages:m1"));
    }

    #[test]
    fn cleans_decorated_string_ids() {
        let messages = vec![msg(
            json!("⟨chats:root⟩"),
            Some(json!("`chats:root`")),
        )];
        let out = sanitize_message_ids(messages);
        assert_eq!(out[0]["id"], json!("chats:root"));
        assert_eq!(out[0]["parent_id"], json!("chats:root"));
    }

    #[test]
    fn none_parent_id_is_left_untouched() {
        // clean_surreal_id(NONE) → None → значение не перезаписывается
        let messages = vec![msg(json!("chats:a"), Some(json!("NONE")))];
        let out = sanitize_message_ids(messages);
        assert_eq!(out[0]["parent_id"], json!("NONE"));
    }

    #[test]
    fn null_parent_id_is_left_untouched() {
        let messages = vec![msg(json!("chats:a"), Some(Value::Null))];
        let out = sanitize_message_ids(messages);
        assert_eq!(out[0]["parent_id"], Value::Null);
    }

    #[test]
    fn non_object_entries_pass_through() {
        let messages: Vec<Value> = vec![json!("garbage"), json!(null), json!(42)];
        let out = sanitize_message_ids(messages);
        assert_eq!(out.len(), 3);
        assert_eq!(out[0], json!("garbage"));
        assert_eq!(out[2], json!(42));
    }

    #[test]
    fn other_fields_are_preserved() {
        let messages = vec![json!({
            "id": { "tb": "chat_messages", "id": { "String": "m9" } },
            "content": "привет",
            "role": "user",
            "is_active": true
        })];
        let out = sanitize_message_ids(messages);
        assert_eq!(out[0]["content"], json!("привет"));
        assert_eq!(out[0]["role"], json!("user"));
        assert_eq!(out[0]["is_active"], json!(true));
        assert_eq!(out[0]["id"], json!("chat_messages:m9"));
    }
}
