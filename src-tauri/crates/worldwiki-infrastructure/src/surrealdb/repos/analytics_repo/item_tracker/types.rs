#[derive(serde::Deserialize, Default)]
pub struct RawItemTrackerBundle {
    #[serde(default)]
    pub entities: Vec<RawEntity>,
    #[serde(default)]
    pub chapters: Vec<RawChapter>,
    #[serde(default)]
    pub promises: Vec<RawPromise>,
    #[serde(default)]
    pub events: Vec<RawEvent>,
}

#[derive(serde::Deserialize, Default)]
pub struct RawItemJourneyBundle {
    #[serde(default)]
    pub item: Option<RawEntity>,
    #[serde(default)]
    pub characters: Vec<RawCharacterBrief>,
    #[serde(default)]
    pub chapters: Vec<RawChapter>,
    #[serde(default)]
    pub promises: Vec<RawPromise>,
    #[serde(default)]
    pub events: Vec<RawEvent>,
}

#[derive(serde::Deserialize)]
pub struct RawCharacterBrief {
    pub id: String,
    pub name: String,
}

#[derive(serde::Deserialize)]
pub struct RawEntity {
    pub id: String,
    pub name: String,
    pub entity_type: String,
    #[serde(default)]
    pub attributes: serde_json::Value,
}

#[derive(serde::Deserialize)]
pub struct RawChapter {
    pub id: String,
    pub title: String,
    #[serde(default)]
    pub sort_order: Option<i32>,
}

#[derive(serde::Deserialize)]
pub struct RawPromise {
    pub id: String,
    pub chapter_id: Option<String>,
    #[serde(default)]
    pub m_abs: Option<i64>,
    #[serde(default)]
    pub participant_ids: Vec<String>,
    #[serde(default)]
    pub title: String,
    #[serde(default)]
    pub description: String,
}

#[derive(serde::Deserialize)]
pub struct RawEvent {
    pub id: String,
    pub chapter_id: Option<String>,
    #[serde(default)]
    pub m_abs: Option<i64>,
    #[serde(default)]
    pub participants: Vec<String>,
    #[serde(default)]
    pub title: String,
    #[serde(default)]
    pub description: String,
}

pub fn clean_id(raw: &str) -> &str {
    raw.trim_start_matches("entities:")
        .trim_start_matches("chapters:")
        .trim_start_matches("projects:")
}
