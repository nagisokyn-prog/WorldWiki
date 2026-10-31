//! IPC layer for module `chapters`: #[tauri::command] wrappers only.
//! All business logic lives in mod.rs (*_inner).

use super::*;
use crate::forward_ipc;
use crate::logic::models::Chapter;

forward_ipc!(
    get_chapters(project: String) -> Result<Vec<Chapter>, ChapterError>
        => get_chapters_inner(&project)
);

forward_ipc!(
    get_chapter(id: String) -> Result<Option<Chapter>, ChapterError>
        => get_chapter_inner(&id)
);

forward_ipc!(
    create_chapter(project: String, chapter: Chapter) -> Result<Chapter, ChapterError>
        => create_chapter_inner(&project, chapter)
);

forward_ipc!(
    save_chapter(chapter: Chapter) -> Result<Chapter, ChapterError>
        => save_chapter_inner(chapter)
);

forward_ipc!(
    delete_chapter(id: String) -> Result<(), ChapterError>
        => delete_chapter_inner(&id)
);

forward_ipc!(
    get_global_timeline(project: String) -> Result<serde_json::Value, ChapterError>
        => get_global_timeline_inner(&project)
);

forward_ipc!(
    save_global_timeline(project: String, data: serde_json::Value) -> Result<serde_json::Value, ChapterError>
        => save_global_timeline_inner(&project, data)
);

forward_ipc!(
    save_text_blocks(project: String, chapter_id: String, html: String) -> Result<(), ChapterError>
        => save_text_blocks_inner(&project, &chapter_id, &html)
);

forward_ipc!(
    get_chapter_revisions(project: String, chapter_id: String) -> Result<Vec<serde_json::Value>, ChapterError>
        => get_chapter_revisions_inner(&project, &chapter_id)
);

forward_ipc!(
    toggle_chapter_history_pin(history_id: String, is_pinned: bool) -> Result<(), ChapterError>
        => toggle_chapter_history_pin_inner(&history_id, is_pinned)
);

forward_ipc!(
    get_planet_calendar_bundle(project: String) -> Result<serde_json::Value, ChapterError>
        => get_planet_calendar_bundle_inner(&project)
);

forward_ipc!(
    save_planet(params: SavePlanetParams) -> Result<serde_json::Value, ChapterError>
        => save_planet_inner(params)
);

forward_ipc!(
    save_calendar_direct(
        project: String,
        calendar_id: Option<String>,
        planet_id: String,
        name: String,
        is_master: bool,
        data: serde_json::Value,
    ) -> Result<serde_json::Value, ChapterError>
        => save_calendar_inner(&project, calendar_id, &planet_id, &name, is_master, data)
);

forward_ipc!(
    set_master_calendar(project: String, planet_id: String, calendar_id: String) -> Result<serde_json::Value, ChapterError>
        => set_master_calendar_inner(&project, &planet_id, &calendar_id)
);

forward_ipc!(
    delete_planet(project: String, planet_id: String, cascade: Option<bool>) -> Result<serde_json::Value, ChapterError>
        => delete_planet_inner(&project, &planet_id, cascade.unwrap_or(true))
);

forward_ipc!(
    delete_calendar_direct(calendar_id: String) -> Result<serde_json::Value, ChapterError>
        => delete_calendar_inner(&calendar_id)
);
