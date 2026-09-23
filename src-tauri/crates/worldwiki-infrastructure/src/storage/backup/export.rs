//! Export chapters to unified document file.

use std::fs;
use std::path::Path;
use serde_json::Value;
use worldwiki_domain::errors::DomainError;

/// Пишет объединённые главы в `exported_chapters.<format>` внутри `target_dir`.
pub fn export_chapters_inner(
    target_dir: &Path,
    chapters: &[Value],
    format: &str,
) -> Result<String, DomainError> {
    fs::create_dir_all(target_dir).map_err(|e| DomainError::Validation(e.to_string()))?;

    let file_path = target_dir.join(format!("exported_chapters.{}", format));
    let mut combined_content = String::new();

    for chapter in chapters {
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

    fs::write(&file_path, combined_content).map_err(|e| DomainError::Validation(e.to_string()))?;

    Ok(file_path.to_string_lossy().to_string())
}
