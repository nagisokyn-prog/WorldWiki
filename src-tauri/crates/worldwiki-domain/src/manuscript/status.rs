use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "snake_case")]
pub enum ManuscriptStatus {
    #[default]
    Draft,
    InProgress,
    Review,
    Completed,
    Archived,
}

impl std::fmt::Display for ManuscriptStatus {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Draft => write!(f, "draft"),
            Self::InProgress => write!(f, "in_progress"),
            Self::Review => write!(f, "review"),
            Self::Completed => write!(f, "completed"),
            Self::Archived => write!(f, "archived"),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn manuscript_status_display_and_default() {
        assert_eq!(ManuscriptStatus::default(), ManuscriptStatus::Draft);
        assert_eq!(ManuscriptStatus::Draft.to_string(), "draft");
        assert_eq!(ManuscriptStatus::InProgress.to_string(), "in_progress");
        assert_eq!(ManuscriptStatus::Review.to_string(), "review");
        assert_eq!(ManuscriptStatus::Completed.to_string(), "completed");
        assert_eq!(ManuscriptStatus::Archived.to_string(), "archived");
    }
}
