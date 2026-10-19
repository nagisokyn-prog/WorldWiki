use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "snake_case")]
pub enum PromiseStatus {
    #[default]
    Planted,
    #[serde(alias = "developed")]
    InProgress,
    Resolved,
    Abandoned,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "snake_case")]
pub enum PromiseKind {
    #[default]
    Gun, // Чеховское ружье
    Foreshadowing, // Предзнаменование
    Mystery,       // Тайна / Загадка
    Question,      // Сюжетный вопрос
    Scene,         // Сцена / Эпизод (блок текста)
    Conflict,      // Драматургический конфликт
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "snake_case")]
pub enum MilestoneStage {
    #[default]
    Plant,
    Progression,
    Resolution,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct PromiseMilestone {
    #[serde(default)]
    pub milestone_id: Option<String>,
    pub stage: MilestoneStage,
    #[serde(default)]
    pub quote: Option<String>,
    #[serde(default)]
    pub note: Option<String>,
    pub block_id: String,
    #[serde(default)]
    pub chapter_id: Option<String>,
    #[serde(default)]
    pub order_index: Option<i32>,
}

fn default_datetime() -> DateTime<Utc> {
    DateTime::UNIX_EPOCH
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct PlotPromise {
    pub id: String,
    pub project_id: String,
    pub kind: PromiseKind,
    pub title: String,
    #[serde(default)]
    pub note: Option<String>,
    #[serde(default)]
    pub status: PromiseStatus,
    #[serde(default)]
    pub milestones: Vec<PromiseMilestone>,
    #[serde(default = "default_datetime")]
    pub created_at: DateTime<Utc>,
    #[serde(default = "default_datetime")]
    pub updated_at: DateTime<Utc>,
}

impl PlotPromise {
    pub fn new(
        project_id: impl Into<String>,
        kind: PromiseKind,
        title: impl Into<String>,
    ) -> Self {
        Self {
            id: String::new(),
            project_id: project_id.into(),
            kind,
            title: title.into(),
            note: None,
            status: PromiseStatus::Planted,
            milestones: Vec::new(),
            created_at: DateTime::UNIX_EPOCH,
            updated_at: DateTime::UNIX_EPOCH,
        }
    }

    pub fn resolve(&mut self) {
        self.status = PromiseStatus::Resolved;
    }
}
