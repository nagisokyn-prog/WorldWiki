//! IPC layer for module `operations`: #[tauri::command] wrappers only.
//! All business logic lives in mod.rs (*_inner).

use super::*;

/// Создаёт новую ветку чата от определённого сообщения
#[tauri::command]
pub async fn fork_chat(
    project_id: String,
    message_id: String,
    new_title: String,
    state: tauri::State<'_, AppState>,
) -> Result<Value, String> {
    fork_chat_impl(state.surreal_db(), &project_id, &message_id, &new_title).await
}

#[tauri::command]
pub async fn update_chat_parent(
    chat_id: String,
    new_parent_id: Option<String>,
    state: tauri::State<'_, AppState>,
) -> Result<(), String> {
    update_chat_parent_impl(state.surreal_db(), &chat_id, new_parent_id.as_deref()).await
}

#[tauri::command]
pub async fn send_chat_message(
    chat_id: String,
    text: String,
    project: String,
    mode_slug: Option<String>,
    app: tauri::AppHandle,
) -> Result<SendChatResult, String> {
    let state = app.state::<AppState>();
    let result = send_message_db_core(state.surreal_db(), &chat_id, &project, &text).await?;

    // 2. Запустить фоновый цикл агента
    let tasks_state = app.state::<AgentTasks>();
    let app2 = app.clone();
    let chat_id_str = result.chat_id.clone();
    let assistant_msg_id_str = result.assistant_msg_id.clone();

    let handle = tokio::spawn(async move {
        run_agent_loop(app2.clone(), project, chat_id_str.clone(), assistant_msg_id_str, text, mode_slug).await;
        let tasks_state = app2.state::<AgentTasks>();
        let mut tasks = tasks_state.0.lock().await;
        tasks.remove(&chat_id_str);
    });

    let mut tasks = tasks_state.0.lock().await;
    tasks.insert(result.chat_id.clone(), handle);

    Ok(result)
}

#[tauri::command]
pub async fn cancel_generation(
    chat_id: String,
    state: State<'_, AgentTasks>,
) -> Result<(), String> {
    #[cfg(feature = "ai-local")]
    {
        crate::logic::ai::local_llm::trigger_cancel_local_gen();
    }

#[tauri::command]
pub async fn delete_chat_message(
    msg_id: String,
    state: tauri::State<'_, AppState>,
) -> Result<(), String> {
    delete_chat_message_impl(state.surreal_db(), &msg_id).await
}

#[tauri::command]
pub async fn edit_chat_message(
    msg_id: String,
    new_text: String,
    chat_id: String,
    project: String,
    mode_slug: Option<String>,
    app: tauri::AppHandle,
) -> Result<SendChatResult, String> {
    let state = app.state::<AppState>();
    let result =
        edit_message_db_core(state.surreal_db(), &msg_id, &new_text, &chat_id, &project).await?;

    // Start background agent
    let tasks_state = app.state::<AgentTasks>();
    let app2 = app.clone();
    let chat_id_str = result.chat_id.clone();
    let assistant_msg_id_str = result.assistant_msg_id.clone();

    let handle = tokio::spawn(async move {
        run_agent_loop(app2.clone(), project, chat_id_str.clone(), assistant_msg_id_str, new_text, mode_slug).await;
        let tasks = app2.state::<AgentTasks>();
        let mut tasks_lock = tasks.0.lock().await;
        tasks_lock.remove(&chat_id_str);
    });
    let mut tasks = tasks_state.0.lock().await;
    tasks.insert(result.chat_id.clone(), handle);

    Ok(result)
}

#[tauri::command]
pub async fn regenerate_chat_message(
    parent_msg_id: String,
    chat_id: String,
    project: String,
    mode_slug: Option<String>,
    app: tauri::AppHandle,
) -> Result<SendChatResult, String> {
    let state = app.state::<AppState>();
    let (assistant_uuid, user_text) =
        regenerate_variant_db_core(state.surreal_db(), &parent_msg_id, &chat_id, &project).await?;

    // Start background agent
    let tasks_state = app.state::<AgentTasks>();
    let app2 = app.clone();
    let chat_id_str = chat_id.clone();
    let assistant_msg_id_str = format!("chat_messages:{}", assistant_uuid);

    let handle = tokio::spawn(async move {
        run_agent_loop(app2.clone(), project, chat_id_str.clone(), assistant_msg_id_str, user_text, mode_slug).await;
        let tasks = app2.state::<AgentTasks>();
        let mut tasks_lock = tasks.0.lock().await;
        tasks_lock.remove(&chat_id_str);
    });
    let mut tasks = tasks_state.0.lock().await;
    tasks.insert(chat_id.clone(), handle);

    Ok(SendChatResult {
        chat_id,
        assistant_msg_id: format!("chat_messages:{}", assistant_uuid),
        user_msg_id: "".to_string(),
    })
}

#[tauri::command]
pub async fn switch_message_variant(
    msg_id: String,
    state: tauri::State<'_, AppState>,
) -> Result<(), String> {
    switch_message_variant_impl(state.surreal_db(), &msg_id).await
}

#[tauri::command]
pub async fn delete_ai_chat(id: String, state: tauri::State<'_, AppState>) -> Result<(), String> {
    delete_ai_chat_impl(state.surreal_db(), &id).await
}

