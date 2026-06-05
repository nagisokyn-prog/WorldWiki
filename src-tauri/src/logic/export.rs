use serde_json::Value;
use std::fs;
use std::path::PathBuf;
use tauri::Manager; // Важно для работы с путями в Tauri 2.0

#[tauri::command]
pub async fn export_chapters(
    project: String,
    chapters: Vec<Value>,
    format: String,
    app: tauri::AppHandle,
) -> Result<String, String> {
    // Безопасное получение папки "Загрузки" в Tauri 2.0
    let target_dir = match app.path().download_dir() {
        Ok(dir) => dir.join(format!("{}_export", project)),
        Err(_) => PathBuf::from(".").join(format!("{}_export", project)),
    };

    fs::create_dir_all(&target_dir).map_err(|e| e.to_string())?;

    let file_path = target_dir.join(format!("exported_chapters.{}", format));
    let mut combined_content = String::new();

    for chapter in &chapters {
        let title = chapter.get("title").and_then(|v| v.as_str()).unwrap_or("Без названия");
        let content = chapter.get("content").and_then(|v| v.as_str()).unwrap_or("");

        combined_content.push_str(&format!("\n\n=== {} ===\n\n{}\n", title, content));
    }

    // Сохраняем файл
    fs::write(&file_path, combined_content).map_err(|e| e.to_string())?;

    Ok(file_path.to_string_lossy().to_string())
}