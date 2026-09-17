use std::path::Path;
use serde::{Deserialize, Serialize};

/// Архитектурный слой для контекстно-зависимой оценки
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum LayerContext {
    Domain,
    Application,
    Infrastructure,
    Unknown,
}

impl LayerContext {
    #[must_use]
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Domain => "Domain",
            Self::Application => "Application",
            Self::Infrastructure => "Infrastructure",
            Self::Unknown => "Unknown",
        }
    }

    #[must_use]
    pub fn from_str_loose(s: &str) -> Self {
        let s = s.to_lowercase();
        if s.contains("domain") {
            Self::Domain
        } else if s.contains("application") || s.contains("usecase") || s.contains("use_case") {
            Self::Application
        } else if s.contains("infrastructure") || s.contains("adapter") || s.contains("storage") || s.contains("tauri") {
            Self::Infrastructure
        } else {
            Self::Unknown
        }
    }

    #[must_use]
    pub fn from_path(path: &Path) -> Self {
        let path_str = path.to_string_lossy().to_lowercase();
        if path_str.contains("domain") {
            Self::Domain
        } else if path_str.contains("application") {
            Self::Application
        } else if path_str.contains("infrastructure") || path_str.contains("adapter") {
            Self::Infrastructure
        } else {
            Self::Unknown
        }
    }
}
