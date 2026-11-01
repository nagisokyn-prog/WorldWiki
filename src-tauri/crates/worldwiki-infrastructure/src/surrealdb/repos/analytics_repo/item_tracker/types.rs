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

#[derive(serde::Deserialize, Default)]
pub struct RawCharacterBrief {
    #[serde(default)]
    pub id: String,
    #[serde(default)]
    pub name: Option<String>,
}

#[derive(serde::Deserialize, Default)]
pub struct RawEntity {
    #[serde(default)]
    pub id: String,
    #[serde(default)]
    pub name: Option<String>,
    #[serde(default)]
    pub entity_type: Option<String>,
    #[serde(default)]
    pub attributes: serde_json::Value,
}

#[derive(serde::Deserialize, Default)]
pub struct RawChapter {
    #[serde(default)]
    pub id: String,
    #[serde(default)]
    pub title: Option<String>,
    #[serde(default)]
    pub sort_order: Option<i32>,
}

#[derive(serde::Deserialize, Default)]
pub struct RawPromise {
    #[serde(default)]
    pub id: String,
    #[serde(default)]
    pub chapter_id: Option<String>,
    #[serde(default)]
    pub resolved_at_chapter_id: Option<String>,
    #[serde(default)]
    pub m_abs: Option<i64>,
    #[serde(default)]
    pub participant_ids: Vec<String>,
    #[serde(default)]
    pub title: Option<String>,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub kind: Option<String>,
    #[serde(default)]
    pub status: Option<String>,
}

#[derive(serde::Deserialize, Default)]
pub struct RawEvent {
    #[serde(default)]
    pub id: String,
    #[serde(default)]
    pub chapter_id: Option<String>,
    #[serde(default)]
    pub m_abs: Option<i64>,
    #[serde(default)]
    pub participants: Vec<String>,
    #[serde(default)]
    pub title: Option<String>,
    #[serde(default)]
    pub description: Option<String>,
}

pub fn clean_id(raw: &str) -> &str {
    raw.trim_start_matches("entities:")
        .trim_start_matches("chapters:")
        .trim_start_matches("projects:")
        .trim_start_matches("plot_promises:")
}
