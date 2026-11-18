use serde::{Deserialize, Serialize};
use chrono::{DateTime, Utc};
use super::status::ManuscriptStatus;

fn default_epoch() -> DateTime<Utc> {
    DateTime::UNIX_EPOCH
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Volume {
    #[serde(default)]
    pub id: String,
    pub project_id: String,
    pub title: String,
    pub description: Option<String>,
    #[serde(default)]
    pub sort_order: i32,
    #[serde(default)]
    pub status: ManuscriptStatus,
    pub target_word_count: Option<usize>,
    #[serde(default = "default_epoch")]
    pub created_at: DateTime<Utc>,
    #[serde(default = "default_epoch")]
    pub updated_at: DateTime<Utc>,
}

impl Volume {
    pub fn new(project_id: impl Into<String>, title: impl Into<String>, sort_order: i32) -> Self {
        Self {
            id: String::new(),
            project_id: project_id.into(),
            title: title.into(),
            description: None,
            sort_order,
            status: ManuscriptStatus::Draft,
            target_word_count: None,
            created_at: DateTime::UNIX_EPOCH,
            updated_at: DateTime::UNIX_EPOCH,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn volume_new_and_serde_defaults() {
        let vol = Volume::new("projects:p1", "Том 1", 3);
        assert_eq!(vol.project_id, "projects:p1");
        assert_eq!(vol.title, "Том 1");
        assert_eq!(vol.sort_order, 3);
        assert_eq!(vol.status, ManuscriptStatus::Draft);

        let parsed: Volume = serde_json::from_str(r#"{"project_id":"p1","title":"T"}"#).unwrap();
        assert_eq!(parsed.created_at, DateTime::UNIX_EPOCH);
        assert_eq!(parsed.sort_order, 0);
    }
}
