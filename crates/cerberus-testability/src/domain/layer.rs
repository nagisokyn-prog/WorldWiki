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
        if s.contains("kernel") {
            Self::Infrastructure
        } else if (s.contains("domain") || s.contains("entity") || s.contains("entities") || s.contains("core") || s.contains("model"))
            && !s.ends_with(".vue")
            && !s.contains("apps/")
        {
            Self::Domain
        } else if s.contains("application") || s.contains("usecase") || s.contains("use_case") || s.contains("service") || s.contains("commands") || s.contains("queries") {
            Self::Application
        } else if s.contains("infrastructure")
            || s.contains("infra")
            || s.contains("adapter")
            || s.contains("storage")
            || s.contains("tauri")
            || s.contains("repo")
            || s.contains("db")
            || s.contains("database")
            || s.contains("serverless")
            || s.contains("function")
            || s.contains("handler")
            || s.contains("gateway")
            || s.contains("bff")
            || s.contains("actor")
            || s.contains("worker")
            || s.contains("producer")
            || s.contains("consumer")
            || s.contains("plugin")
            || s.contains("apps/")
            || s.ends_with(".vue")
        {
            Self::Infrastructure
        } else {
            Self::Unknown
        }
    }

    #[must_use]
    pub fn from_path(path: &Path) -> Self {
        let path_str = path.to_string_lossy().to_lowercase();
        if path_str.contains("kernel") {
            Self::Infrastructure
        } else if (path_str.contains("domain") || path_str.contains("entity") || path_str.contains("entities") || path_str.contains("core"))
            && !path_str.ends_with(".vue")
            && !path_str.contains("apps/")
            && !path_str.contains("apps\\")
        {
            Self::Domain
        } else if path_str.contains("application") || path_str.contains("usecase") || path_str.contains("service") || path_str.contains("commands") || path_str.contains("queries") {
            Self::Application
        } else if path_str.contains("infrastructure")
            || path_str.contains("infra")
            || path_str.contains("adapter")
            || path_str.contains("storage")
            || path_str.contains("tauri")
            || path_str.contains("repository")
            || path_str.contains("serverless")
            || path_str.contains("function")
            || path_str.contains("handler")
            || path_str.contains("gateway")
            || path_str.contains("bff")
            || path_str.contains("actor")
            || path_str.contains("worker")
            || path_str.contains("producer")
            || path_str.contains("consumer")
            || path_str.contains("plugin")
            || path_str.contains("controller")
            || path_str.contains("db")
            || path_str.contains("apps/")
            || path_str.contains("apps\\")
            || path_str.ends_with(".vue")
        {
            Self::Infrastructure
        } else {
            Self::Unknown
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_layer_context_methods() {
        assert_eq!(LayerContext::Domain.as_str(), "Domain");
        assert_eq!(LayerContext::Application.as_str(), "Application");
        assert_eq!(LayerContext::Infrastructure.as_str(), "Infrastructure");
        assert_eq!(LayerContext::Unknown.as_str(), "Unknown");

        assert_eq!(LayerContext::from_str_loose("domain"), LayerContext::Domain);
        assert_eq!(LayerContext::from_str_loose("app"), LayerContext::Unknown);
        assert_eq!(LayerContext::from_str_loose("infrastructure"), LayerContext::Infrastructure);

        assert_eq!(LayerContext::from_path(Path::new("src/domain/model.rs")), LayerContext::Domain);
        assert_eq!(LayerContext::from_path(Path::new("src/application/uc.rs")), LayerContext::Application);
        assert_eq!(LayerContext::from_path(Path::new("src/infra/db.rs")), LayerContext::Infrastructure);
        assert_eq!(LayerContext::from_path(Path::new("unknown/path.rs")), LayerContext::Unknown);
    }
}
