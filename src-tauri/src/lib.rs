pub mod bootstrap;
pub mod logic;

pub use bootstrap::database::{apply_ddl_module, apply_schema_pipeline, init_database};
pub use bootstrap::lifecycle::{AgentTasks, AppState, handle_window_event, setup_application};

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

    if let Err(e) = tauri::Builder::default()
        .invoke_handler(surreal_domain::entity_commands![
// --- Проекты ---
            get_projects,
            create_project,
            get_project_config,
            save_project_config,
            delete_project,
            execute_raw_surql,
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
            get_chapters,
            get_chapter,
            create_chapter,
            save_chapter,
            delete_chapter,
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
            get_planet_calendar_bundle,
            save_planet,
            save_calendar_direct,
            set_master_calendar,
            delete_planet,
            delete_calendar_direct,
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
            worldwiki_tauri::commands::get_plot_promises,
            worldwiki_tauri::commands::plant_plot_promise,
            worldwiki_tauri::commands::save_plot_promise,
            worldwiki_tauri::commands::delete_plot_promise,
            worldwiki_tauri::commands::complete_plan,
            worldwiki_tauri::commands::audit_volume_consistency,
            // Сюжетные арки & Аналитика
            worldwiki_tauri::commands::get_story_arcs,
            worldwiki_tauri::commands::save_story_arc,
            worldwiki_tauri::commands::delete_story_arc,
            worldwiki_tauri::commands::assign_arc_chapter,
            worldwiki_tauri::commands::remove_arc_chapter,
            worldwiki_tauri::commands::assign_arc_entity,
            worldwiki_tauri::commands::remove_arc_entity,
            worldwiki_tauri::commands::get_arc_chapters,
            worldwiki_tauri::commands::get_arc_entities,
            worldwiki_tauri::commands::get_cross_reference_matrix,
            worldwiki_tauri::commands::audit_manuscript_consistency,
            worldwiki_tauri::commands::get_timeline_inspector_data,

            worldwiki_tauri::commands::get_character_journey,
            worldwiki_tauri::commands::get_multi_character_journey,
            worldwiki_tauri::commands::get_item_tracker,
            worldwiki_tauri::commands::get_item_journey,
            worldwiki_tauri::commands::get_manuscript_statistics,
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
            @entities: [StoryArc, Volume, Plan, PlotPromise, Tag, Calendar, Chat, AutoApprovalSetting, AiProfile, AiMode, Artifact, AiSkill],
            @searchable: [TextBlock, ChatMessage, AgentMemory, WebCache, DictionaryWord],
            @relations: [Cites, ParticipantOf, AdvancesArc, OccursAt, RevealedIn]
])
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .setup(setup_application)
        .on_window_event(handle_window_event)
        .run(tauri::generate_context!())
    {
        eprintln!("[CRITICAL] Error while running tauri application: {e}");
    }
}

#[cfg(test)]
mod tests;
