use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct EntitySearchDto {
    pub id: Option<Value>,
    pub name: Option<String>,
    pub type_key: Option<String>,
    pub description: Option<String>,
    pub tags: Option<Vec<String>>,
    pub attributes: Option<Value>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct LoreChunkSearchDto {
    pub id: Option<Value>,
    pub entity_id: Option<Value>,
    pub content: Option<String>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct ChapterSearchDto {
    pub id: Option<Value>,
    pub title: Option<String>,
    pub content: Option<String>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct EntityRelationSearchDto {
    #[serde(rename = "in")]
    pub from: Option<Value>,
    pub out: Option<Value>,
    pub rel_type: Option<String>,
    pub description: Option<String>,
    pub strength: Option<i32>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct RagBundleDto {
    #[serde(default)]
    pub entities: Vec<EntitySearchDto>,
    #[serde(default)]
    pub chunks: Vec<LoreChunkSearchDto>,
    #[serde(default)]
    pub chapters: Vec<ChapterSearchDto>,
    #[serde(default)]
    pub relations: Vec<EntityRelationSearchDto>,
}
