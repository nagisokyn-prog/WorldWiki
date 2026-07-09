use serde_json::Value;
use std::env;
use std::fs;
use std::io::Write;
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
        let title = chapter
            .get("title")
            .and_then(|v| v.as_str())
            .unwrap_or("Без названия");
        let content = chapter
            .get("content")
            .and_then(|v| v.as_str())
            .unwrap_or("");

        combined_content.push_str(&format!("\n\n=== {} ===\n\n{}\n", title, content));
    }

    // Сохраняем файл
    fs::write(&file_path, combined_content).map_err(|e| e.to_string())?;

    Ok(file_path.to_string_lossy().to_string())
}

#[tauri::command]
pub async fn create_cloud_backup(
    state: tauri::State<'_, crate::AppState>,
    app: tauri::AppHandle,
) -> Result<String, String> {
    let db = &state.db;

    // Find backup directory
    let target_dir = app
        .path()
        .app_data_dir()
        .unwrap_or(PathBuf::from("."))
        .join("backups");
    fs::create_dir_all(&target_dir).map_err(|e| e.to_string())?;

    let timestamp = chrono::Local::now().format("%Y%m%d_%H%M%S").to_string();
    let temp_surql_path = target_dir.join(format!("backup_{}.surql", timestamp));

    // In SurrealDB v3, exporting to a file
    db.export(temp_surql_path.to_str().unwrap())
        .await
        .map_err(|e| e.to_string())?;

    let zip_path = target_dir.join(format!("WorldWiki_Backup_{}.wwiki", timestamp));
    let file =
        fs::File::create(&zip_path).map_err(|e| format!("Failed to create zip file: {}", e))?;
    let mut zip = zip::ZipWriter::new(file);

    let options = zip::write::SimpleFileOptions::default()
        .compression_method(zip::CompressionMethod::Deflated);

    // 1. Add database dump
    if let Ok(dump_content) = fs::read(&temp_surql_path) {
        zip.start_file("database.surql", options)
            .map_err(|e| e.to_string())?;
        use std::io::Write;
        zip.write_all(&dump_content).map_err(|e| e.to_string())?;
    }

    // Clean up temporary dump
    let _ = fs::remove_file(&temp_surql_path);

    // 2. Add user images (if any)
    let images_dir = env::current_dir()
        .unwrap_or_default()
        .join("data")
        .join("user_images");
    if images_dir.exists() {
        // recursively add images
        if let Ok(entries) = fs::read_dir(&images_dir) {
            for entry in entries.filter_map(Result::ok) {
                if let Ok(file_type) = entry.file_type() {
                    if file_type.is_file() {
                        if let Ok(content) = fs::read(entry.path()) {
                            let name = format!("images/{}", entry.file_name().to_string_lossy());
                            if zip.start_file(name, options).is_ok() {
                                let _ = zip.write_all(&content);
                            }
                        }
                    }
                }
            }
        }
    }

    // 3. Add settings files
    let data_dir = env::current_dir().unwrap_or_default().join("data");
    if let Ok(entries) = fs::read_dir(&data_dir) {
        for entry in entries.filter_map(Result::ok) {
            if entry.file_name().to_string_lossy().ends_with(".json") {
                if let Ok(content) = fs::read(entry.path()) {
                    let name = format!("settings/{}", entry.file_name().to_string_lossy());
                    if zip.start_file(name, options).is_ok() {
                        let _ = zip.write_all(&content);
                    }
                }
            }
        }
    }

    zip.finish()
        .map_err(|e| format!("Failed to finalize zip: {}", e))?;

    Ok(zip_path.to_string_lossy().to_string())
}
