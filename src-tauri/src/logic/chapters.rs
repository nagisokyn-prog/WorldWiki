use crate::logic::models::Chapter;
use serde_json::{json, Value};
use surreal_domain::SurrealRepository;

#[tauri::command]
pub async fn get_global_timeline(
    project: String,
    state: tauri::State<'_, crate::AppState>,
) -> Result<Value, String> {
    let db = &state.db;
    let proj_id = format!("projects:{}", project);
    let chapters = Chapter::find_all(db, &proj_id)
        .await
        .map_err(|e| e.to_string())?;
    Ok(json!(chapters))
}

#[tauri::command]
pub async fn save_text_blocks(
    project: String,
    chapter_id: String,
    blocks: Vec<Value>,
    state: tauri::State<'_, crate::AppState>,
) -> Result<(), String> {
    let db = &state.db;
    let proj_id = format!("projects:⟨{}⟩", project);
    
    let chapter_id_safe = if chapter_id.contains('⟨') {
        chapter_id.clone()
    } else {
        let parts: Vec<&str> = chapter_id.split(':').collect();
        if parts.len() == 2 {
            format!("{}:⟨{}⟩", parts[0], parts[1])
        } else {
            chapter_id.clone()
        }
    };

    println!("[DEBUG] -> save_text_blocks: chapter_id='{}', blocks count={}", chapter_id_safe, blocks.len());
    
    let mut sql = String::new();
    sql.push_str("BEGIN TRANSACTION;\n");
    sql.push_str("DELETE text_blocks WHERE chapter_id = type::record($chapter_id) AND project_id = type::record($project_id);\n");
    
    let mut bindings: Vec<(String, String)> = Vec::new();
    let blocks_count = blocks.len();
    
    for (i, block) in blocks.into_iter().enumerate() {
        let btype = block.get("block_type").and_then(|v| v.as_str()).unwrap_or("description").to_string();
        let content = block.get("content").and_then(|v| v.as_str()).unwrap_or("").to_string();
        
        sql.push_str(&format!(
            "CREATE text_blocks SET project_id = type::record($project_id), chapter_id = type::record($chapter_id), block_type = $btype_{}, order_index = {}, content = $content_{};\n",
            i, i, i
        ));
        
        bindings.push((format!("btype_{}", i), btype));
        bindings.push((format!("content_{}", i), content));
    }
    
    sql.push_str("COMMIT TRANSACTION;\n");
    
    let mut q = db.query(sql)
        .bind(("project_id", proj_id.clone()))
        .bind(("chapter_id", chapter_id_safe.clone()));
        
    for (k, v) in bindings {
        q = q.bind((k, v));
    }
    
    let mut res = q.await.map_err(|e| e.to_string())?;
    let errs = res.take_errors();
    if !errs.is_empty() {
        let e = errs.values().next().unwrap();
        eprintln!("[ERROR] save_text_blocks transaction error: {}", e);
        return Err(e.to_string());
    }

    println!("[DEBUG] <- save_text_blocks: successfully saved {} blocks with ACID", blocks_count);
    Ok(())
}

#[tauri::command]
pub async fn get_chapter_revisions(
    project: String,
    chapter_id: String,
    state: tauri::State<'_, crate::AppState>,
) -> Result<Vec<Value>, String> {
    let db = &state.db;
    let proj_id = format!("projects:{}", project);
    
    let mut result = db.query(
        "SELECT * FROM chapter_revisions WHERE target_id = type::record($target_id) AND project_id = $project_id ORDER BY created_at DESC"
    )
    .bind(("target_id", chapter_id))
    .bind(("project_id", proj_id))
    .await
    .map_err(|e| e.to_string())?;

    let revisions: Vec<Value> = result.take(0).map_err(|e| e.to_string())?;
    Ok(revisions)
}

#[tauri::command]
pub async fn toggle_chapter_history_pin(
    history_id: String,
    is_pinned: bool,
    state: tauri::State<'_, crate::AppState>,
) -> Result<(), String> {
    let db = &state.db;
    let parts: Vec<&str> = history_id.splitn(2, ':').collect();
    let actual_id = if parts.len() == 2 { parts[1] } else { &history_id };
    
    db.query("UPDATE type::record($id) SET is_pinned = $is_pinned")
        .bind(("id", format!("chapter_revisions:{}", actual_id)))
        .bind(("is_pinned", is_pinned))
        .await
        .map_err(|e| e.to_string())?;
        
    Ok(())
}
