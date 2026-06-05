use serde_json::{json, Value};

use crate::logic::models::{Volume, Arc, Chapter};

#[tauri::command]
pub async fn get_chapter_hierarchy(
    project: String,
    state: tauri::State<'_, crate::AppState>,
) -> Result<Value, String> {
    let db = &state.db;
    let proj_id = format!("projects:{}", project);
    
    let mut volumes = Volume::find_all(db, &proj_id).await.map_err(|e| e.to_string())?;
    volumes.sort_by_key(|v| v.sort_order);
    let mut arcs = Arc::find_all(db, &proj_id).await.map_err(|e| e.to_string())?;
    arcs.sort_by_key(|a| a.sort_order);
    let mut chapters = Chapter::find_all(db, &proj_id).await.map_err(|e| e.to_string())?;
    
    chapters.sort_by(|a, b| a.title.cmp(&b.title));

    Ok(json!({
        "volumes": volumes,
        "arcs": arcs,
        "chapters": chapters
    }))
}

#[tauri::command]
pub async fn create_volume(
    project: String,
    title: String,
    state: tauri::State<'_, crate::AppState>,
) -> Result<Value, String> {
    let db = &state.db;
    let proj_id = format!("projects:{}", project);
    
    let volumes = Volume::find_all(db, &proj_id).await.map_err(|e| e.to_string())?;
    let next_order = volumes.iter().map(|v| v.sort_order).max().unwrap_or(-1) + 1;

    let vol = Volume {
        id: None,
        project_id: Some(proj_id),
        title,
        sort_order: next_order,
    };
    
    let saved = Volume::save(db, &vol).await.map_err(|e| e.to_string())?;
    Ok(json!(saved))
}

#[tauri::command]
pub async fn update_volume(
    _project: String,
    id: String,
    title: String,
    state: tauri::State<'_, crate::AppState>,
) -> Result<(), String> {
    let db = &state.db;
    let clean_id = id.split(':').last().unwrap_or(&id);
    if let Some(mut vol) = Volume::find_by_id(db, clean_id).await.map_err(|e| e.to_string())? {
        vol.title = title;
        Volume::save(db, &vol).await.map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub async fn create_arc(
    project: String,
    title: String,
    volume_id: Option<String>,
    state: tauri::State<'_, crate::AppState>,
) -> Result<Value, String> {
    let db = &state.db;
    let proj_id = format!("projects:{}", project);
    
    let arcs = Arc::find_all(db, &proj_id).await.map_err(|e| e.to_string())?;
    let next_order = arcs.iter().map(|a| a.sort_order).max().unwrap_or(-1) + 1;

    let arc = Arc {
        id: None,
        project_id: Some(proj_id),
        title,
        volume_id,
        sort_order: next_order,
    };
    
    let saved = Arc::save(db, &arc).await.map_err(|e| e.to_string())?;
    Ok(json!(saved))
}

#[tauri::command]
pub async fn update_arc(
    _project: String,
    id: String,
    title: String,
    _volume_id: Option<String>,
    state: tauri::State<'_, crate::AppState>,
) -> Result<(), String> {
    let db = &state.db;
    let clean_id = id.split(':').last().unwrap_or(&id);
    if let Some(mut arc) = Arc::find_by_id(db, clean_id).await.map_err(|e| e.to_string())? {
        arc.title = title;
        Arc::save(db, &arc).await.map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub async fn assign_chapter(
    project: String,
    chapter_id: String,
    arc_id: Option<String>,
    volume_id: Option<String>,
    state: tauri::State<'_, crate::AppState>,
) -> Result<(), String> {
    let db = &state.db;
    let _ = project; // might be used later
    let clean_id = chapter_id.split(':').last().unwrap_or(&chapter_id);
    if let Some(mut chap) = Chapter::find_by_id(db, clean_id).await.map_err(|e| e.to_string())? {
        chap.arc_id = arc_id;
        chap.volume_id = volume_id;
        Chapter::save(db, &chap).await.map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub async fn reorder_node(
    project: String,
    node_type: String,
    id: String,
    sort_order: i64,
    state: tauri::State<'_, crate::AppState>,
) -> Result<(), String> {
    let db = &state.db;
    let _ = project;
    let clean_id = id.split(':').last().unwrap_or(&id);
    if node_type == "volume" {
        if let Some(mut vol) = Volume::find_by_id(db, clean_id).await.map_err(|e| e.to_string())? {
            vol.sort_order = sort_order;
            Volume::save(db, &vol).await.map_err(|e| e.to_string())?;
        }
    } else if node_type == "arc" {
        if let Some(mut arc) = Arc::find_by_id(db, clean_id).await.map_err(|e| e.to_string())? {
            arc.sort_order = sort_order;
            Arc::save(db, &arc).await.map_err(|e| e.to_string())?;
        }
    }
    Ok(())
}
