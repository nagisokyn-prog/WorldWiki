use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct GraphNodeDto {
    pub id: String,
    pub name: String,
    pub entity_type: String,
    pub tags: Vec<String>,
    pub attributes: serde_json::Value,
    pub x: f32,
    pub y: f32,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct DirectedRelationshipEdgeDto {
    pub id: String,
    pub source_id: String,
    pub target_id: String,
    pub rel_type: String,
    pub description: Option<String>,
    pub strength: i32,                 // -100 .. +100
    pub is_directed: bool,
    pub start_chapter_id: Option<String>,
    pub start_chapter_order: Option<i32>,
    pub end_chapter_id: Option<String>,
    pub end_chapter_order: Option<i32>,
    pub start_m_abs: Option<i64>,      // Комбо-вычисление
    pub end_m_abs: Option<i64>,
    pub needs_m_abs_warning: bool,     // Предупреждение ⚠️ (нет события у главы)
    pub is_revealed_to_reader: bool,   // Пунктир vs Сплошная
    pub offset_px: f32,                // ±6px для параллельных кривых Безье
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct GraphTimeSliceDto {
    pub nodes: Vec<GraphNodeDto>,
    pub edges: Vec<DirectedRelationshipEdgeDto>,
}
