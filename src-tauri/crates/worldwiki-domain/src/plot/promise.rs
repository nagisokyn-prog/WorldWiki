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
    Scene,         // Сцена / Эпизод (блок текста)
    Conflict,      // Драматургический конфликт
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
    #[serde(default)]
    pub participant_ids: Option<Vec<String>>,
    pub location_id: Option<String>,
    pub timeline_event_id: Option<String>,
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
        Self {
            id: String::new(),
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
            participant_ids: None,
            location_id: None,
            timeline_event_id: None,
            created_at: DateTime::UNIX_EPOCH,
            updated_at: DateTime::UNIX_EPOCH,
        }
    }

    pub fn resolve(
        &mut self,
        chapter_id: impl Into<String>,
        volume_id: Option<String>,
        resolution: Option<Value>,
    ) {
        self.status = PromiseStatus::Resolved;
        self.resolved_in_chapter = Some(chapter_id.into());
        self.resolved_in_volume = volume_id;
        self.resolution = resolution;
    }
}
