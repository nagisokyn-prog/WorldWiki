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

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "snake_case")]
pub enum JourneyFilterMode {
    #[default]
    Union,
    Intersection,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct JourneyParticipantArcDto {
    pub arc_id: String,
    pub arc_title: String,
    #[serde(default)]
    pub arc_phase: Option<String>,
    #[serde(default)]
    pub color: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct JourneyParticipantDto {
    pub entity_id: String,
    pub entity_name: String,
    #[serde(default)]
    pub role_in_story: Option<String>,
    #[serde(default)]
    pub status_category: Option<String>,
    #[serde(default)]
    pub age_label: Option<String>,
    #[serde(default)]
    pub is_before_birth: bool,
    #[serde(default)]
    pub is_deceased: bool,
    #[serde(default)]
    pub arcs: Vec<JourneyParticipantArcDto>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct JourneyMeetingGapDto {
    pub chapters_count: i32,
    #[serde(default)]
    pub minutes_delta: Option<i64>,
    pub formatted_label: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct MultiJourneySceneDto {
    pub id: String,
    pub item_type: String, // "chapter" | "event"
    #[serde(default)]
    pub chapter_id: Option<String>,
    #[serde(default)]
    pub chapter_title: Option<String>,
    #[serde(default)]
    pub volume_title: Option<String>,
    pub sort_order: i32,
    #[serde(default)]
    pub scene_m_abs: Option<i64>,
    #[serde(default)]
    pub scene_date_formatted: Option<String>,
    pub present_entities: Vec<JourneyParticipantDto>,
    #[serde(default)]
    pub meeting_gap: Option<JourneyMeetingGapDto>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct MultiJourneyResponseDto {
    pub total_scenes: usize,
    pub filter_mode: JourneyFilterMode,
    pub requested_entity_ids: Vec<String>,
    pub scenes: Vec<MultiJourneySceneDto>,
}

