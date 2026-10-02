use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ItemUsageState {
    Active,           // Активно используется в текущей арке / главах
    Sleeping,         // В спящем режиме (5..9 глав без упоминаний)
    Forgotten,        // 10+ глав без упоминаний (потенциальная сюжетная дыра)
    DestroyedOrLost,  // Уничтожен или утерян
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct CustodyEventDto {
    pub owner_id: Option<String>,
    pub owner_name: Option<String>,
    pub chapter_id: Option<String>,
    pub chapter_order: Option<i32>,
    pub chapter_title: Option<String>,
    pub m_abs: Option<i64>,
    pub circumstances: String,
    pub status_on_stage: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct TrackedItemDto {
    pub id: String,
    pub name: String,
    pub item_type: String,
    pub status_category: String,
    pub current_owner_id: Option<String>,
    pub current_owner_name: Option<String>,
    pub first_chapter_order: Option<i32>,
    pub last_chapter_order: Option<i32>,
    pub skipped_chapters: i32,
    pub total_mentions: usize,
    pub usage_state: ItemUsageState,
    pub custody_chain: Vec<CustodyEventDto>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ItemTrackerSummaryDto {
    pub total_items: usize,
    pub active_count: usize,
    pub sleeping_count: usize,
    pub forgotten_count: usize,
    pub destroyed_count: usize,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ItemTrackerDto {
    pub summary: ItemTrackerSummaryDto,
    pub items: Vec<TrackedItemDto>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ItemJourneyNodeDto {
    pub id: String,
    pub title: String,
    pub node_type: String, // "creation", "custody", "scene", "destruction"
    pub m_abs: Option<i64>,
    pub chapter_order: Option<i32>,
    pub chapter_id: Option<String>,
    pub chapter_title: Option<String>,
    pub owner_id: Option<String>,
    pub owner_name: Option<String>,
    pub description: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ItemJourneyDto {
    pub item_id: String,
    pub item_name: String,
    pub item_type: String,
    pub status_category: String,
    pub nodes: Vec<ItemJourneyNodeDto>,
}
