use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct JourneyAppearanceDto {
    pub chapter_id: String,
    pub chapter_title: String,
    pub chapter_order: i32,
    pub source: String,
    pub role: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct JourneyEventDto {
    pub event_id: String,
    pub event_title: String,
    pub m_abs: i64,
    pub role: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct JourneyRelationDto {
    pub id: String,
    pub target_name: String,
    pub rel_type: String,
    pub strength: i32,
    pub start_order: Option<i32>,
    pub end_order: Option<i32>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct JourneyPromiseDto {
    pub id: String,
    pub kind: String,
    pub quote: String,
    pub status: String,
    pub planted_order: Option<i32>,
    pub resolved_order: Option<i32>,
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
