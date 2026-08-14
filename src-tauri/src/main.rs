// src-tauri/src/main.rs
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::env;
use std::fs;
use surrealdb::engine::local::Db;
use surrealdb::engine::local::SurrealKv;
use surrealdb::Surreal;
use tauri::Manager;

mod logic;
use crate::logic::models::*;

pub struct AppState {
    pub db: Surreal<Db>,
}

#[derive(Default)]
pub struct AgentTasks(pub std::sync::Arc<tokio::sync::Mutex<std::collections::HashMap<String, tokio::task::JoinHandle<()>>>>);

// Implements the SurrealDb trait from surreal_domain_core,
// enabling all macro-generated generic Tauri commands to work.
impl surreal_domain::SurrealDb for AppState {
    type Connection = Db;
    fn surreal_db(&self) -> &Surreal<Db> {
        &self.db
    }
}

// // wrappers moved to logic::projects and logic::system

// --- Инициализация и Main ---

async fn init_database() -> Surreal<Db> {
    let db_path = env::current_dir()
        .unwrap_or_default()
        .join("data")
        .join("surreal_db");
    fs::create_dir_all(&db_path).ok();
    let db = Surreal::new::<SurrealKv>(db_path)
        .await
        .expect("Failed to start SurrealDB");
    db.use_ns("worldwriter")
        .use_db("worldwriter")
        .await
        .expect("Failed to use NS/DB");

    // Загружаем пользовательский DDL через include_str! чтобы он был вкомпилирован
    println!("[DEBUG] Applying surreal_schema.surql...");
    let sql = include_str!("../../apps/spa/src/logic/surreal_schema.surql");

    match db.query(sql).await {
        Ok(mut res) => {
            if let Some(err) = res.take_errors().into_iter().next() {
                eprintln!("DDL Error inside result: {:?}", err);
            } else {
                println!("DDL Schema applied successfully.");
            }
        }
        Err(e) => eprintln!("Failed to execute DDL: {:?}", e),
    }

    db
}

fn main() {
    use logic::ai_chat::*;
    use logic::batch::*;
    use logic::chapters::*;
    use logic::connections::*;
    use logic::entities::*;
    use logic::export::*;
    use logic::projects::*;
    use logic::volumes::*;
    use logic::ai_agent::*;
    use logic::ai_models_fetch::*;
    use logic::calendar_math::*;
    use tauri_shell::logic::system::*;
    
    tauri::Builder::default()
        .invoke_handler(surreal_domain::entity_commands![
            // --- Проекты ---
            get_projects,
            create_project,
            get_project_config,
            save_project_config,
            delete_project,
            // --- Универсальные Сущности ---
            get_entities,
            get_entities_batch,
            get_entity,
            save_entity,
            save_entity_with_relations,
            delete_entity,
            search_entities,
            get_entity_schemas,
            save_entity_schema,
            delete_entity_schema,
            get_schema_history,
            toggle_schema_history_pin,
            toggle_entity_history_pin,
            toggle_chapter_history_pin,
            get_entity_relations,
            create_entity_relation,
            delete_entity_relation,
            get_relation_schemas,
            save_relation_schema,
            delete_relation_schema,
            // --- Вспомогательные ---
            upload_photo,
            copy_background_file,
            get_local_file,
            run_performance_benchmark,
            get_performance_styles,
            save_settings,
            load_settings,
            toggle_fullscreen,
            get_custom_themes,
            load_theme,
            save_custom_theme,
            // --- Главы / Тома / Арки ---
            get_chapter_hierarchy,
            create_volume,
            update_volume,
            create_arc,
            update_arc,
            assign_chapter,
            reorder_node,
            // --- Связи / Таймлайн ---
            get_connections,
            save_connections,
            upsert_connections_batch,
            remove_connections_by_source,
            get_global_timeline,
            // --- Экспорт и История ---
            export_chapters,
            create_cloud_backup,
            exchange_yandex_token,
            upload_to_yandex_disk,
            list_yandex_disk_backups,
            download_and_restore_yandex,
            get_launch_args,
            restore_from_backup,
            get_chapter_revisions,
            get_entity_revisions,
            convert_absolute_to_local,

            // --- Текстовые блоки ---
            save_text_blocks,

            // --- AI Чат ---
            get_chat_tree,
            get_chat_messages,
            get_message_branch,
            fork_chat,
            update_chat_parent,
            send_chat_message,
            cancel_generation,
            delete_chat_message,
            edit_chat_message,
            regenerate_chat_message,
            switch_message_variant,
            fetch_ai_models,
            get_ai_completion,
            generate_chat_title,

            // --- Генерируемые команды для системных сущностей ---
            @entities: [Chapter, Volume, Arc, Plan, Tag, Calendar, Chat, AutoApprovalSetting, AiProfile, AiMode, Artifact, AiSkill],
            @searchable: [TextBlock, ChatMessage, AgentMemory, WebCache, DictionaryWord],
            @relations: [Cites]
        ])
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .setup(|app| {
            let db = tauri::async_runtime::block_on(init_database());
            app.manage(AppState { db });
            app.manage(AgentTasks::default());
            Ok(())
        })
        .on_window_event(|window, event| if let tauri::WindowEvent::CloseRequested { .. } = event {
            println!("[DEBUG] Emergency backup before close...");
            let state = window.state::<AppState>();
            let db = state.db.clone();
            let backup_path = std::env::current_dir().unwrap_or_default().join("data").join("backup_latest.surql");
            tauri::async_runtime::block_on(async move {
                if let Err(e) = db.export(backup_path).await {
                    eprintln!("[ERROR] Failed to export backup: {}", e);
                } else {
                    println!("[DEBUG] Backup completed successfully.");
                }
            });
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
