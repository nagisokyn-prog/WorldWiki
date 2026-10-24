use serde::{Deserialize, Serialize};
use super::cross_ref::ChapterHeaderDto;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct TimelineRevealLink {
    pub chapter_id: String,
    pub chapter_title: String,
    pub chapter_sort_order: i32,
    pub pov_id: Option<String>,
    pub kind: String, // 'direct' | 'flashback' | 'mention' | 'rumor'
    pub block_id: Option<String>,
    pub is_anachronism: bool, // Раскрыто до момента свершения события
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct TimelineInspectorEventNode {
    pub event_id: String,
    pub title: String,
    pub description: Option<String>,
    pub m_abs: i64,
    pub calendar_id: String,
    pub participants: Vec<String>,
    pub reveals: Vec<TimelineRevealLink>,
    #[serde(default)]
    pub kind: Option<String>,
    #[serde(default)]
    pub location_id: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct EntitySwimlaneDto {
    pub entity_id: String,
    pub entity_name: String,
    pub entity_type: String,
    pub event_ids: Vec<String>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct TimelineInspectorDto {
    pub events: Vec<TimelineInspectorEventNode>,
    pub chapters: Vec<ChapterHeaderDto>,
    pub entity_swimlanes: Vec<EntitySwimlaneDto>,
    pub detected_crossings: usize, // Число нелинейных перехлестов осей
}
