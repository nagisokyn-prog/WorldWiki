use std::collections::{HashMap, HashSet};
use std::path::Path;
use worldwiki_domain::ai::{InstalledModelInfo, ModelKind, ModelLifecycleState};

fn build_model_info(
    path: &Path,
    filename: String,
    states: &HashMap<String, ModelLifecycleState>,
) -> InstalledModelInfo {
    let size_bytes = std::fs::metadata(path).map(|m| m.len()).unwrap_or(0);
    let size_gb =
        ((size_bytes as f64 / (1024.0 * 1024.0 * 1024.0)) * 10.0).round() as f32 / 10.0;

    let lower = filename.to_lowercase();
    let kind = if lower.contains("embed") || lower.contains("nomic") || lower.contains("bge") {
        ModelKind::Embedding
    } else {
        ModelKind::Generation
    };

    let state = states
        .get(&filename)
        .cloned()
        .unwrap_or(ModelLifecycleState::Installed);

    let name = filename
        .trim_end_matches(".gguf")
        .trim_end_matches(".GGUF")
        .to_string();

    InstalledModelInfo {
        id: filename.clone(),
        name,
        filename,
        full_path: path.to_string_lossy().to_string(),
        size_bytes,
        size_gb,
        kind,
        state,
        memory_used_mb: None,
    }
}

pub(crate) fn scan_gguf_files_in_dir(
    dir: &Path,
    states: &HashMap<String, ModelLifecycleState>,
    seen_filenames: &mut HashSet<String>,
    installed: &mut Vec<InstalledModelInfo>,
) {
    if !dir.exists() {
        return;
    }

    let Ok(read_dir) = std::fs::read_dir(dir) else {
        return;
    };

    for entry in read_dir.flatten() {
        let path = entry.path();
        if !path.is_file() {
            continue;
        }
        let is_gguf = path
            .extension()
            .and_then(|s| s.to_str())
            .is_some_and(|ext| ext.eq_ignore_ascii_case("gguf"));
        if !is_gguf {
            continue;
        }
        let filename = path
            .file_name()
            .and_then(|s| s.to_str())
            .unwrap_or("")
            .to_string();
        if filename.is_empty() || !seen_filenames.insert(filename.clone()) {
            continue;
        }
        installed.push(build_model_info(&path, filename, states));
    }
}

