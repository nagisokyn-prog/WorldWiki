use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct JourneyAppearanceDto {
    pub chapter_id: String,
    pub chapter_title: String,
    pub chapter_order: i32,
    pub source: String,
    #[serde(default)]
    pub role: Option<String>,
    #[serde(default)]
    pub created_at: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct JourneyEventDto {
    pub event_id: String,
    pub event_title: String,
    #[serde(default)]
    pub event_desc: Option<String>,
    pub m_abs: i64,
    #[serde(default)]
    pub calendar_id: Option<String>,
    #[serde(default)]
    pub role: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct JourneyRelationDto {
    pub id: String,
    pub target_name: String,
    pub rel_type: String,
    pub strength: i32,
    #[serde(default)]
    pub start_order: Option<i32>,
    #[serde(default)]
    pub end_order: Option<i32>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct JourneyPromiseDto {
    pub id: String,
    pub kind: String,
    pub quote: String,
    pub status: String,
    #[serde(default)]
    pub planted_order: Option<i32>,
    #[serde(default)]
    pub resolved_order: Option<i32>,
    #[serde(default)]
    pub chapter_id: Option<String>,
    #[serde(default)]
    pub chapter_title: Option<String>,
    #[serde(default)]
    pub paragraph_index: Option<i64>,
    #[serde(default)]
    pub block_id: Option<String>,
    #[serde(default)]
    pub arc_id: Option<String>,
    #[serde(default)]
    pub arc_title: Option<String>,
    #[serde(default)]
    pub arc_color: Option<String>,
    #[serde(default)]
    pub arc_phase: Option<String>,
    #[serde(default)]
    pub arcs: Option<serde_json::Value>,
    #[serde(default)]
    pub m_abs: Option<i64>,
    #[serde(default)]
    pub calendar_id: Option<String>,
    #[serde(default)]
    pub date_fields: Option<serde_json::Value>,
    #[serde(default)]
    pub timeline_event_id: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct CharacterJourneyDto {
    pub entity_id: String,
    pub entity_name: String,
    pub entity_type: String,
    pub attributes: serde_json::Value,
    pub appearances: Vec<JourneyAppearanceDto>,
    pub events: Vec<JourneyEventDto>,
    pub relations: Vec<JourneyRelationDto>,
    pub promises: Vec<JourneyPromiseDto>,
}

