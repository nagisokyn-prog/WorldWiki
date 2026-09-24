use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "snake_case")]
pub enum AppearanceSource {
    #[default]
    Mention, // Автоматически найдено парсером ((Сущность))
    Manual,  // Вручную добавлено автором в сайдбаре
    Scene,   // Добавлено через привязку к сцене / блоку текста
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct EntityAppearance {
    pub entity_id: String,
    pub chapter_id: String,
    pub source: AppearanceSource,
    pub role: Option<String>,
    pub created_at: DateTime<Utc>,
}

impl EntityAppearance {
    pub fn new(
        entity_id: impl Into<String>,
        chapter_id: impl Into<String>,
        source: AppearanceSource,
    ) -> Self {
        Self {
            entity_id: entity_id.into(),
            chapter_id: chapter_id.into(),
            source,
            role: None,
            created_at: DateTime::UNIX_EPOCH,
        }
    }
}
