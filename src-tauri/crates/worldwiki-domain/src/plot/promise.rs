use serde::{Deserialize, Serialize};
use serde_json::Value;
use chrono::{DateTime, Utc};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "snake_case")]
pub enum PromiseStatus {
    #[default]
    Planted,
    Developed,
    Resolved,
    Abandoned,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "snake_case")]
pub enum PromiseKind {
    #[default]
    Gun,           // Чеховское ружье
    Foreshadowing, // Предзнаменование
    Mystery,       // Тайна / Загадка
    Question,      // Сюжетный вопрос
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct PlotPromise {
    pub id: String,
    pub project_id: String,
    pub chapter_id: String,
    pub kind: PromiseKind,
    pub quote: String,
    pub paragraph_index: i32,
    pub block_id: Option<String>,
    pub note: Option<String>,
    pub status: PromiseStatus,
    #[serde(default)]
    pub progressions: Vec<Value>,
    pub resolution: Option<Value>,
    pub resolved_in_volume: Option<String>,
    pub resolved_in_chapter: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl PlotPromise {
    pub fn new(
        project_id: impl Into<String>,
        chapter_id: impl Into<String>,
        kind: PromiseKind,
        quote: impl Into<String>,
    ) -> Self {
        let now = Utc::now();
        Self {
            id: uuid::Uuid::new_v4().to_string(),
            project_id: project_id.into(),
            chapter_id: chapter_id.into(),
            kind,
            quote: quote.into(),
            paragraph_index: 1,
            block_id: None,
            note: None,
            status: PromiseStatus::Planted,
            progressions: Vec::new(),
            resolution: None,
            resolved_in_volume: None,
            resolved_in_chapter: None,
            created_at: now,
            updated_at: now,
        }
    }

    pub fn resolve(&mut self, chapter_id: String, volume_id: Option<String>, note: Option<String>) {
        self.status = PromiseStatus::Resolved;
        self.resolved_in_chapter = Some(chapter_id);
        self.resolved_in_volume = volume_id;
        self.resolution = Some(serde_json::json!({
            "note": note,
            "resolved_at": Utc::now(),
        }));
        self.updated_at = Utc::now();
    }
}
