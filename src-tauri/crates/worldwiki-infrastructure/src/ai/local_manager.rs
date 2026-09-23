use std::collections::{HashMap, HashSet};
use std::path::PathBuf;
use std::sync::{Mutex, OnceLock};
use worldwiki_domain::ai::{InstalledModelInfo, ModelKind, ModelLifecycleState};
use worldwiki_domain::errors::DomainError;
use worldwiki_ports::ai::LocalModelManagerPort;

static MODEL_STATES: OnceLock<Mutex<HashMap<String, ModelLifecycleState>>> = OnceLock::new();

fn get_states_map() -> &'static Mutex<HashMap<String, ModelLifecycleState>> {
    MODEL_STATES.get_or_init(|| Mutex::new(HashMap::new()))
}

#[derive(Clone)]
pub struct FsLocalModelManager {
    models_dir: PathBuf,
}

impl FsLocalModelManager {
    pub fn new(models_dir: PathBuf) -> Self {
        Self { models_dir }
    }

    pub fn default_dir() -> PathBuf {
        #[cfg(target_os = "windows")]
        {
            if let Ok(app_data) = std::env::var("APPDATA") {
                return PathBuf::from(app_data)
                    .join("com.worldwiki.app")
                    .join("models");
            }
            if let Ok(user_prof) = std::env::var("USERPROFILE") {
                return PathBuf::from(user_prof)
                    .join("AppData")
                    .join("Roaming")
                    .join("com.worldwiki.app")
                    .join("models");
            }
            if let Ok(local_app_data) = std::env::var("LOCALAPPDATA") {
                return PathBuf::from(local_app_data)
                    .join("com.worldwiki.app")
                    .join("models");
            }
        }
        #[cfg(not(target_os = "windows"))]
        {
            if let Ok(home) = std::env::var("HOME") {
                return PathBuf::from(home)
                    .join(".local")
                    .join("share")
                    .join("com.worldwiki.app")
                    .join("models");
            }
        }
        PathBuf::from(".").join("data").join("models")
    }

    pub fn candidate_dirs(&self) -> Vec<PathBuf> {
        let mut dirs = Vec::new();
        dirs.push(self.models_dir.clone());

        #[cfg(target_os = "windows")]
        {
            if let Ok(app_data) = std::env::var("APPDATA") {
                dirs.push(
                    PathBuf::from(app_data)
                        .join("com.worldwiki.app")
                        .join("models"),
                );
            }
            if let Ok(user_prof) = std::env::var("USERPROFILE") {
                dirs.push(
                    PathBuf::from(user_prof)
                        .join("AppData")
                        .join("Roaming")
                        .join("com.worldwiki.app")
                        .join("models"),
                );
            }
            if let Ok(local_app_data) = std::env::var("LOCALAPPDATA") {
                dirs.push(
                    PathBuf::from(&local_app_data)
                        .join("com.worldwiki.app")
                        .join("models"),
                );
                dirs.push(
                    PathBuf::from(local_app_data)
                        .join("WorldWiki")
                        .join("models"),
                );
            }
        }

        #[cfg(not(target_os = "windows"))]
        {
            if let Ok(home) = std::env::var("HOME") {
                dirs.push(
                    PathBuf::from(home)
                        .join(".local")
                        .join("share")
                        .join("com.worldwiki.app")
                        .join("models"),
                );
            }
        }

        dirs.push(PathBuf::from("models"));
        dirs.push(PathBuf::from(".").join("data").join("models"));

        let mut seen = HashSet::new();
        dirs.retain(|d| seen.insert(d.clone()));
        dirs
    }

    pub fn find_model_file(&self, filename: &str) -> Option<PathBuf> {
        for dir in self.candidate_dirs() {
            let candidate = dir.join(filename);
            if candidate.exists() && candidate.is_file() {
                return Some(candidate);
            }
        }
        None
    }
}

fn scan_gguf_files_in_dir(
    dir: &std::path::Path,
    states: &HashMap<String, ModelLifecycleState>,
    seen_filenames: &mut HashSet<String>,
    installed: &mut Vec<InstalledModelInfo>,
) {
    if !dir.exists() {
        return;
    }

    let entries = match std::fs::read_dir(dir) {
        Ok(read_dir) => read_dir.flatten().collect::<Vec<_>>(),
        Err(_) => return,
    };

    for entry in entries {
        let path = entry.path();
        if path.is_file() {
            let ext = path.extension().and_then(|s| s.to_str()).unwrap_or("");
            if ext.eq_ignore_ascii_case("gguf") {
                let filename = path
                    .file_name()
                    .and_then(|s| s.to_str())
                    .unwrap_or("")
                    .to_string();

                if filename.is_empty() || !seen_filenames.insert(filename.clone()) {
                    continue;
                }

                let metadata = std::fs::metadata(&path).ok();
                let size_bytes = metadata.as_ref().map(|m| m.len()).unwrap_or(0);
                let size_gb = ((size_bytes as f64 / (1024.0 * 1024.0 * 1024.0)) * 10.0)
                    .round() as f32
                    / 10.0;

                let is_embed = filename.to_lowercase().contains("embed")
                    || filename.to_lowercase().contains("nomic")
                    || filename.to_lowercase().contains("bge");
                let kind = if is_embed {
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

                installed.push(InstalledModelInfo {
                    id: filename.clone(),
                    name,
                    filename: filename.clone(),
                    full_path: path.to_string_lossy().to_string(),
                    size_bytes,
                    size_gb,
                    kind,
                    state,
                    memory_used_mb: None,
                });
            }
        }
    }
}

impl LocalModelManagerPort for FsLocalModelManager {
    fn list_installed(&self) -> Result<Vec<InstalledModelInfo>, DomainError> {
        let states = get_states_map()
            .lock()
            .map(|g| g.clone())
            .unwrap_or_default();
        let mut installed = Vec::new();
        let mut seen_filenames = HashSet::new();

        let dirs = self.candidate_dirs();
        for dir in dirs {
            scan_gguf_files_in_dir(&dir, &states, &mut seen_filenames, &mut installed);
        }

        installed.sort_by(|a, b| a.name.cmp(&b.name));
        Ok(installed)
    }

    fn load_model(&self, filename: &str) -> Result<String, DomainError> {
        let full_path = self.find_model_file(filename);
        if full_path.is_none() {
            return Err(DomainError::Validation(format!(
                "Файл модели не найден: {filename}"
            )));
        }

        if let Ok(mut lock) = get_states_map().lock() {
            lock.insert(filename.to_string(), ModelLifecycleState::Ready);
        }

        Ok(format!("Модель {filename} успешно загружена в память"))
    }

    fn unload_model(&self, filename: &str) -> Result<String, DomainError> {
        if let Ok(mut lock) = get_states_map().lock() {
            lock.insert(filename.to_string(), ModelLifecycleState::Installed);
        }

        Ok(format!("Модель {filename} успешно выгружена из памяти"))
    }

    fn unload_all(&self) -> Result<String, DomainError> {
        if let Ok(mut lock) = get_states_map().lock() {
            lock.clear();
        }
        Ok("Все локальные модели выгружены".to_string())
    }

    fn delete_model(&self, filename: &str) -> Result<String, DomainError> {
        let full_path = match self.find_model_file(filename) {
            Some(p) => p,
            None => {
                return Err(DomainError::Validation(format!(
                    "Файл модели не найден: {filename}"
                )));
            }
        };

        self.unload_model(filename).ok();

        std::fs::remove_file(&full_path)
            .map_err(|e| DomainError::Validation(format!("Ошибка удаления файла модели: {e}")))?;

        Ok(format!("Модель {filename} удалена с диска"))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_candidate_dirs_contains_appdata_and_configured() {
        let mgr = FsLocalModelManager::new(PathBuf::from("custom_models_path"));
        let dirs = mgr.candidate_dirs();
        assert!(dirs.iter().any(|d| d == &PathBuf::from("custom_models_path")));
        assert!(dirs.iter().any(|d| d.to_string_lossy().contains("models")));
    }

    #[test]
    fn test_list_installed_empty_or_valid() {
        let temp_dir = std::env::temp_dir().join(format!("test_models_{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&temp_dir).expect("Failed to create temp dir for tests");

        let test_model = temp_dir.join("test-model-q4.gguf");
        std::fs::write(&test_model, b"GGUF test content").expect("Failed to write test model file");

        let mgr = FsLocalModelManager::new(temp_dir.clone());
        let installed = mgr.list_installed().expect("list_installed must succeed");

        assert!(installed.iter().any(|m| m.filename == "test-model-q4.gguf"));
        let found = installed.iter().find(|m| m.filename == "test-model-q4.gguf");
        assert!(found.is_some());
        assert_eq!(found.unwrap().kind, ModelKind::Generation);

        let _ = std::fs::remove_dir_all(&temp_dir);
    }
}
