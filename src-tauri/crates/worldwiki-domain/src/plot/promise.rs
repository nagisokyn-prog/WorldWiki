use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "snake_case")]
pub enum PromiseStatus {
    #[default]
    Planted,
    #[serde(rename = "developed", alias = "in_progress")]
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
    #[serde(default)]
    pub stage: MilestoneStage,
    #[serde(default)]
    pub quote: Option<String>,
    #[serde(default)]
    pub note: Option<String>,
    #[serde(default)]
    pub block_id: Option<String>,
    #[serde(default)]
    pub chapter_id: Option<String>,
    #[serde(default)]
    pub order_index: Option<i32>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct SceneArcItem {
    pub arc_id: String,
    #[serde(default)]
    pub arc_phase: Option<String>,
}

fn default_datetime() -> DateTime<Utc> {
    DateTime::UNIX_EPOCH
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct PlotPromise {
    pub id: String,
    pub kind: PromiseKind,
    #[serde(default)]
    pub title: String,
    #[serde(default)]
    pub note: Option<String>,
    #[serde(default)]
    pub status: PromiseStatus,
    #[serde(default)]
    pub block_ids: Vec<String>,
    #[serde(default)]
    pub location_id: Option<String>,
    #[serde(default)]
    pub timeline_event_id: Option<String>,
    #[serde(default)]
    pub parent_id: Option<String>,
    #[serde(default)]
    pub time_nature: Option<String>,
    #[serde(default = "default_datetime")]
    pub created_at: DateTime<Utc>,
    #[serde(default = "default_datetime")]
    pub updated_at: DateTime<Utc>,

    // Graph projection fields (hydrated from relations, not stored on plot_promises record)
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub milestones: Vec<PromiseMilestone>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub m_abs: Option<i64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub calendar_id: Option<String>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub participant_ids: Vec<String>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub arcs: Vec<SceneArcItem>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub arc_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub arc_phase: Option<String>,
}

impl PlotPromise {
    pub fn new(
        kind: PromiseKind,
        title: impl Into<String>,
    ) -> Self {
        Self {
            id: String::new(),
            kind,
            title: title.into(),
            note: None,
            status: PromiseStatus::Planted,
            block_ids: Vec::new(),
            location_id: None,
            timeline_event_id: None,
            parent_id: None,
            time_nature: None,
            created_at: DateTime::UNIX_EPOCH,
            updated_at: DateTime::UNIX_EPOCH,
            milestones: Vec::new(),
            m_abs: None,
            calendar_id: None,
            participant_ids: Vec::new(),
            arcs: Vec::new(),
            arc_id: None,
            arc_phase: None,
        }
    }

    pub fn resolve(&mut self) {
        self.status = PromiseStatus::Resolved;
    }
}
