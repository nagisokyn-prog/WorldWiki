#[derive(Debug, Clone, Default)]
pub struct ExtractedIntent {
    pub chapter_num: Option<i64>,
    pub volume_num: Option<i64>,
    pub is_chitchat: bool,
    pub semantic_query: String,
}
