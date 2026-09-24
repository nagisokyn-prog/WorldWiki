use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ContradictionSeverity {
    Critical, // 🔴 Блокирует логику повествования (мертвый персонаж)
    Warning,  // 🟡 Предупреждение (разрушенная локация, билокация, анахронизм)
    Notice,   // ℹ️ Забытые ружья / сюжетные долги
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ContradictionRule {
    DeceasedEntityActive,
    RevealBeforeEvent,
    DestroyedLocationUsed,
    EntityBilocation,
    ForgottenPlotPromise,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ContradictionAnomaly {
    pub rule: ContradictionRule,
    pub severity: ContradictionSeverity,
    pub title: String,
    pub description: String,
    pub entity_ids: Vec<String>,
    pub chapter_ids: Vec<String>,
    pub event_ids: Vec<String>,
    pub promise_ids: Vec<String>,
}
