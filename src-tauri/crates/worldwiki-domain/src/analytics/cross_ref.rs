use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum CellAppearanceKind {
    Scene,      // ● Сцена / ключевой эпизод
    Mention,    // ○ Упоминание в тексте
    Both,       // ● ○ Сцена и упоминание
    None,       // — Отсутствует
    Deceased,   // 💀 Погиб до этой главы
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct CellAppearanceDto {
    pub chapter_id: String,
    pub kind: CellAppearanceKind,
    pub source: Option<String>,
    pub role: Option<String>,
    #[serde(default)]
    pub has_scene: bool,
    #[serde(default)]
    pub has_mention: bool,
    #[serde(default)]
    pub count: i32,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct AbsenceWarningDto {
    pub entity_id: String,
    pub entity_name: String,
    pub missing_since_chapter_id: String,
    pub missing_since_order: i32,
    pub skipped_chapters_count: usize,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ChapterHeaderDto {
    pub id: String,
    pub title: String,
    #[serde(default)]
    pub volume_id: Option<String>,
    #[serde(default)]
    pub volume_title: Option<String>,
    #[serde(default)]
    pub sort_order: i32,
    #[serde(default)]
    pub word_count: i32,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct EntityRowDto {
    pub id: String,
    pub name: String,
    pub entity_type: String,
    pub is_deceased: bool,
    #[serde(default)]
    pub death_m_abs: Option<i64>,
    #[serde(default)]
    pub birth_m_abs: Option<i64>,
    #[serde(default)]
    pub role_in_story: Option<String>,
    #[serde(default)]
    pub status_category: Option<String>,
    pub appearances_by_chapter: Vec<CellAppearanceDto>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct CrossRefMatrixDto {
    pub chapters: Vec<ChapterHeaderDto>,
    pub entities: Vec<EntityRowDto>,
    pub absence_warnings: Vec<AbsenceWarningDto>,
}
