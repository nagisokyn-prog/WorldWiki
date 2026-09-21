use std::fs;
use std::sync::Arc;
use surrealdb::engine::local::Db;
use surrealdb::engine::local::SurrealKv;
use surrealdb::Surreal;
use tauri::Manager;
use tokio::sync::Mutex;

pub mod bootstrap;
pub mod logic;

pub struct AppState {
    pub db: Surreal<Db>,
}

// Implements the SurrealDb trait from surreal_domain_core,
// enabling all macro-generated generic Tauri commands to work.
impl surreal_domain::SurrealDb for AppState {
    type Connection = Db;
    fn surreal_db(&self) -> &Surreal<Db> {
        &self.db
    }
}

#[derive(Default)]
pub struct AgentTasks(
    pub Arc<Mutex<std::collections::HashMap<String, tokio::task::JoinHandle<()>>>>,
);

// --- Инициализация БД ---

async fn init_database() -> Surreal<Db> {
    let db_path = worldwiki_infrastructure::paths::get_surreal_db_path();
    fs::create_dir_all(&db_path).ok();
    let db = Surreal::new::<SurrealKv>(db_path)
        .await
        .expect("Failed to start SurrealDB");
    db.use_ns("worldwriter")
        .use_db("worldwriter")
        .await
        .expect("Failed to use NS/DB");

    if let Err(e) = apply_schema_pipeline(&db).await {
        eprintln!("[CRITICAL] Failed to apply schema pipeline: {}", e);
    }

    db
}

pub async fn apply_schema_pipeline(db: &Surreal<Db>) -> Result<(), String> {
    // 1. БАЗОВОЕ ЯДРО (NO-AI / BASE EDITION)
    const DDL_NOAI_00_ANALYZERS: &str = include_str!("../../apps/spa/src/logic/schema/no_ai/00_analyzers.surql");
    const DDL_NOAI_01_TABLES: &str = include_str!("../../apps/spa/src/logic/schema/no_ai/01_tables.surql");
    const DDL_NOAI_02_INDEXES: &str = include_str!("../../apps/spa/src/logic/schema/no_ai/02_indexes.surql");
    const DDL_NOAI_03_EVENTS: &str = include_str!("../../apps/spa/src/logic/schema/no_ai/03_events.surql");

    apply_ddl_module(db, "no_ai/00_analyzers", DDL_NOAI_00_ANALYZERS).await?;
    apply_ddl_module(db, "no_ai/01_tables", DDL_NOAI_01_TABLES).await?;
    apply_ddl_module(db, "no_ai/02_indexes", DDL_NOAI_02_INDEXES).await?;
    apply_ddl_module(db, "no_ai/03_events", DDL_NOAI_03_EVENTS).await?;

    // 2. ИИ-ПРОСТРАНСТВО (AI / ULTRA EDITION)
    const DDL_AI_01_WORKSPACE: &str = include_str!("../../apps/spa/src/logic/schema/ai/01_workspace_tables.surql");
    const DDL_AI_02_WEB_RESEARCH: &str = include_str!("../../apps/spa/src/logic/schema/ai/02_web_research_tables.surql");
    const DDL_AI_03_EMBEDDINGS: &str = include_str!("../../apps/spa/src/logic/schema/ai/03_embeddings_hnsw.surql");
    const DDL_AI_04_INDEXES: &str = include_str!("../../apps/spa/src/logic/schema/ai/04_indexes.surql");
    const DDL_AI_05_EVENTS: &str = include_str!("../../apps/spa/src/logic/schema/ai/05_events.surql");
    const DDL_AI_06_FUNCTIONS: &str = include_str!("../../apps/spa/src/logic/schema/ai/06_functions.surql");

    apply_ddl_module(db, "ai/01_workspace_tables", DDL_AI_01_WORKSPACE).await?;
    apply_ddl_module(db, "ai/02_web_research_tables", DDL_AI_02_WEB_RESEARCH).await?;
    apply_ddl_module(db, "ai/03_embeddings_hnsw", DDL_AI_03_EMBEDDINGS).await?;
    apply_ddl_module(db, "ai/04_indexes", DDL_AI_04_INDEXES).await?;
    apply_ddl_module(db, "ai/05_events", DDL_AI_05_EVENTS).await?;
    apply_ddl_module(db, "ai/06_functions", DDL_AI_06_FUNCTIONS).await?;

    Ok(())
}

pub async fn apply_ddl_module(db: &Surreal<Db>, name: &str, ddl: &str) -> Result<(), String> {
    if ddl.trim().is_empty() {
        return Ok(());
    }
    match db.query(ddl).await {
        Ok(mut res) => {
            let errors = res.take_errors();
            if !errors.is_empty() {
                let err_msg = format!("DDL Error in module '{}': {:?}", name, errors);
                eprintln!("{}", err_msg);
                return Err(err_msg);
            }
            println!("[DB] Schema module '{}' applied successfully.", name);
            Ok(())
        }
        Err(e) => {
            let err_msg = format!("Failed to execute DDL module '{}': {:?}", name, e);
            eprintln!("{}", err_msg);
            Err(err_msg)
        }
    }
}

fn setup_application(app: &mut tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    let raw_db = tauri::async_runtime::block_on(init_database());
    let db = std::sync::Arc::new(raw_db);
    let event_publisher = std::sync::Arc::new(worldwiki_tauri::TauriEventPublisher::new(app.handle().clone()));
    let services = bootstrap::services::build_surreal_app_services(Arc::clone(&db), event_publisher);
    app.manage(worldwiki_tauri::AppState::new(services));
    app.manage(AppState { db: (*db).clone() });
    app.manage(AgentTasks::default());
    Ok(())
}

fn handle_window_event(window: &tauri::Window, event: &tauri::WindowEvent) {
    if let tauri::WindowEvent::CloseRequested { .. } = event {
        println!("[DEBUG] Emergency backup before close...");
        let state = window.state::<AppState>();
        let db = state.db.clone();
        let backup_path = worldwiki_infrastructure::paths::get_backup_path();
        tauri::async_runtime::block_on(async move {
            if let Err(e) = db.export(backup_path).await {
                eprintln!("[ERROR] Failed to export backup: {}", e);
            } else {
                println!("[DB] Backup completed successfully.");
            }
        });
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    use logic::batch::*;
    use logic::chapters::*;
    use logic::connections::*;
    use logic::entities::*;
    use logic::models::*;
    use logic::projects::*;
    use logic::volumes::*;
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
            // --- Главы / Тома ---
            get_chapter_hierarchy,
            create_volume,
            update_volume,
            assign_chapter,
            reorder_node,
            auto_extend_timeline,
            heal_deleted_chapter,
            // --- Связи / Таймлайн ---
            get_connections,
            save_connections,
            upsert_connections_batch,
            remove_connections_by_source,
                        get_global_timeline,
            save_global_timeline,
            // --- Экспорт и История ---
            worldwiki_tauri::commands::export_chapters,
            worldwiki_tauri::commands::export_document_docx,
            worldwiki_tauri::commands::export_document_epub,
            worldwiki_tauri::commands::export_document_fb2,
            worldwiki_tauri::commands::export_document_pdf_save,
            worldwiki_tauri::commands::create_cloud_backup,
            worldwiki_tauri::commands::exchange_yandex_token,
            worldwiki_tauri::commands::upload_to_yandex_disk,
            worldwiki_tauri::commands::list_yandex_disk_backups,
            worldwiki_tauri::commands::download_and_restore_yandex,
            worldwiki_tauri::commands::get_launch_args,
            worldwiki_tauri::commands::restore_from_backup,
            get_chapter_revisions,
            get_entity_revisions,

            // --- Календарь (worldwiki-tauri) ---
            worldwiki_tauri::commands::convert_absolute_to_local,
            worldwiki_tauri::commands::convert_calendar_date,

            // --- Текстовые блоки ---
            save_text_blocks,

            // --- AI Чат (модульный worldwiki-tauri) ---
            worldwiki_tauri::commands::get_chat_tree,
            worldwiki_tauri::commands::get_chat_messages,
            worldwiki_tauri::commands::get_message_branch,
            worldwiki_tauri::commands::fork_chat,
            worldwiki_tauri::commands::save_chat,
            worldwiki_tauri::commands::update_chat_parent,
            worldwiki_tauri::commands::send_chat_message,
            worldwiki_tauri::commands::cancel_generation,
            worldwiki_tauri::commands::delete_chat_message,
            worldwiki_tauri::commands::switch_message_variant,
            worldwiki_tauri::commands::fetch_ai_models,
            worldwiki_tauri::commands::delete_ai_chat,
            worldwiki_tauri::commands::get_aiprofiles,
            worldwiki_tauri::commands::save_aiprofile,
            worldwiki_tauri::commands::delete_aiprofile,
            worldwiki_tauri::commands::edit_chat_message,
            worldwiki_tauri::commands::regenerate_chat_message,
            worldwiki_tauri::commands::execute_ai_tool_direct,
            worldwiki_tauri::commands::ai_respond_tool_approval,

            // --- AI Локальные модели, Оборудование и Разрешения (worldwiki-tauri) ---
            worldwiki_tauri::commands::get_hardware_info,
            worldwiki_tauri::commands::calculate_quantization_estimates,
            worldwiki_tauri::commands::get_recommended_local_models,
            worldwiki_tauri::commands::list_installed_models,
            worldwiki_tauri::commands::load_local_model,
            worldwiki_tauri::commands::unload_local_model,
            worldwiki_tauri::commands::unload_all_local_models,
            worldwiki_tauri::commands::delete_local_model,
            worldwiki_tauri::commands::get_tool_permissions_catalog,
            worldwiki_tauri::commands::save_tool_permission,
            worldwiki_tauri::commands::save_all_tool_permissions,
            worldwiki_tauri::commands::get_ai_completion,

            // --- AI Hub & Retrieval (worldwiki-tauri) ---
            worldwiki_tauri::commands::fetch_hf_models,
            worldwiki_tauri::commands::download_hf_model,
            worldwiki_tauri::commands::reindex_project_lore,

            // --- Новые модульные IPC-команды (worldwiki-tauri) ---
            worldwiki_tauri::commands::get_entity_full_card,
            worldwiki_tauri::commands::add_entity_relation,
            worldwiki_tauri::commands::plant_plot_promise,
            worldwiki_tauri::commands::complete_plan,
            worldwiki_tauri::commands::audit_volume_consistency,
            // 8 AI Facades
            worldwiki_tauri::commands::ai_query_world,
            worldwiki_tauri::commands::ai_inspect_entity,
            worldwiki_tauri::commands::ai_manage_entity,
            worldwiki_tauri::commands::ai_read_manuscript,
            worldwiki_tauri::commands::ai_edit_manuscript,
            worldwiki_tauri::commands::ai_chronology,
            worldwiki_tauri::commands::ai_timeline_manager,
            worldwiki_tauri::commands::ai_audit_consistency,
            worldwiki_tauri::commands::ai_delegate_task,
            // --- Генерируемые команды для системных сущностей ---
            @entities: [Chapter, Volume, Plan, PlotPromise, Tag, Calendar, Chat, AutoApprovalSetting, AiProfile, AiMode, Artifact, AiSkill],
            @searchable: [TextBlock, ChatMessage, AgentMemory, WebCache, DictionaryWord],
            @relations: [Cites]
])
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .setup(setup_application)
        .on_window_event(handle_window_event)
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests;
