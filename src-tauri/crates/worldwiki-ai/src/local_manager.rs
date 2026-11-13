use std::collections::{HashMap, HashSet};
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use worldwiki_domain::ai::{InstalledModelInfo, ModelLifecycleState};
use worldwiki_domain::errors::DomainError;
use worldwiki_ports::ai::LocalModelManagerPort;

#[derive(Clone)]
pub struct FsLocalModelManager {
    models_dir: PathBuf,
    states: Arc<Mutex<HashMap<String, ModelLifecycleState>>>,
}

impl FsLocalModelManager {
    pub fn new(models_dir: PathBuf) -> Self {
        Self {
            models_dir,
            states: Arc::new(Mutex::new(HashMap::new())),
        }
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

#[path = "model_scanner.rs"]
mod model_scanner;

use model_scanner::scan_gguf_files_in_dir;

impl LocalModelManagerPort for FsLocalModelManager {
    fn list_installed(&self) -> Result<Vec<InstalledModelInfo>, DomainError> {
        let states = self.states.lock()
            .map(|g| g.clone())
            .unwrap_or_else(|poison| {
                tracing::warn!("LocalModelManager states lock poisoned, recovering inner state: {poison}");
                poison.into_inner().clone()
            });
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

        if let Ok(mut lock) = self.states.lock() {
            lock.insert(filename.to_string(), ModelLifecycleState::Ready);
        }

        Ok(format!("Модель {filename} успешно загружена в память"))
    }

    fn unload_model(&self, filename: &str) -> Result<String, DomainError> {
        if let Ok(mut lock) = self.states.lock() {
            lock.insert(filename.to_string(), ModelLifecycleState::Installed);
        }

        Ok(format!("Модель {filename} успешно выгружена из памяти"))
    }

    fn unload_all(&self) -> Result<String, DomainError> {
        if let Ok(mut lock) = self.states.lock() {
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
#[path = "local_manager_tests.rs"]
mod tests;
