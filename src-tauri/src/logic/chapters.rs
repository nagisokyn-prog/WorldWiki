use crate::logic::models::Chapter;
use serde_json::{json, Value};

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
    
    let _ = match db.query("DELETE text_blocks WHERE chapter_id = type::record($chapter_id) AND project_id = type::record($project_id)")
        .bind(("chapter_id", chapter_id_safe.clone()))
        .bind(("project_id", proj_id.clone()))
        .await
    {
        Ok(res) => match res.check() {
            Ok(r) => r,
            Err(e) => {
                eprintln!("[ERROR] save_text_blocks check error: {}", e);
                return Err(e.to_string());
            }
        },
        Err(e) => {
            eprintln!("[ERROR] save_text_blocks query error: {}", e);
            return Err(e.to_string());
        }
    };

    println!("[DEBUG] -> save_text_blocks: deleted old blocks");

    let blocks_count = blocks.len();
    // Then insert new ones
    for (i, block) in blocks.into_iter().enumerate() {
        let block_type = block.get("block_type").and_then(|v| v.as_str()).unwrap_or("description");
        let content = block.get("content").and_then(|v| v.as_str()).unwrap_or("");
        
        let _ = match db.query(r#"
            CREATE text_blocks SET 
                project_id = type::record($project_id),
                chapter_id = type::record($chapter_id),
                block_type = $block_type,
                order_index = $order_index,
                content = $content
        "#)
        .bind(("project_id", proj_id.clone()))
        .bind(("chapter_id", chapter_id_safe.clone()))
        .bind(("block_type", block_type))
        .bind(("order_index", i as i64))
        .bind(("content", content))
        .await {
            Ok(res) => match res.check() {
                Ok(r) => r,
                Err(e) => {
                    eprintln!("[ERROR] save_text_blocks create check error on block {}: {}", i, e);
                    return Err(e.to_string());
                }
            },
            Err(e) => {
                eprintln!("[ERROR] save_text_blocks create query error on block {}: {}", i, e);
                return Err(e.to_string());
            }
        };
    }

    println!("[DEBUG] <- save_text_blocks: successfully saved {} blocks", blocks_count);
    Ok(())
}
