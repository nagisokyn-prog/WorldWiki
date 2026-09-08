use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ResearchMode {
    Direct,
    Research,
    DeepResearch,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ResearchStatus {
    Planning,
    Searching,
    Reading,
    Synthesizing,
    Verifying,
    Completed,
    Failed,
    Cancelled,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ClaimStatus {
    Supported,
    Contradicted,
    Unverified,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResearchClaim {
    pub id: String,
    pub text: String,
    pub status: ClaimStatus,
    pub evidence_ids: Vec<String>,
    pub confidence: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CitationItem {
    pub index: usize,
    pub evidence_id: String,
    pub page_id: String,
    pub url: String,
    pub domain: String,
    pub title: String,
    pub claim_text: String,
    pub excerpt: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", content = "payload", rename_all = "snake_case")]
pub enum ResearchEvent {
    Planning { objective: String },
    SearchStarted { query: String, round: usize },
    SearchCompleted { hits_count: usize },
    PagesFetched { count: usize, domains: Vec<String> },
    EvidenceExtracted { count: usize },
    ClaimsFormed { claims: Vec<ResearchClaim> },
    Synthesizing,
    Finished { citations_count: usize },
    Error { message: String },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResearchPolicy {
    pub preferred_domains: Vec<String>,
    pub min_domain_diversity: usize,
    pub max_pages_per_domain: usize,
    pub strict_citations: bool,
    pub preferred_languages: Vec<String>,
}

impl Default for ResearchPolicy {
    fn default() -> Self {
        Self {
            preferred_domains: Vec::new(),
            min_domain_diversity: 2,
            max_pages_per_domain: 2,
            strict_citations: true,
            preferred_languages: vec!["ru".to_string(), "en".to_string()],
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WebPageEntity {
    pub id: Option<String>,
    pub url: String,
    pub canonical_url: String,
    pub domain: String,
    pub title: Option<String>,
    pub content_type: String,
    pub charset: String,
    pub language: Option<String>,
    pub content_hash: String,
    pub content: String,
    pub extracted_markdown: Option<String>,
    pub status_code: i32,
    pub hit_count: u32,
    pub fetched_at: Option<String>,
    pub expires_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WebEvidence {
    pub id: Option<String>,
    pub page_id: String,
    pub project_id: String,
    pub chunk_index: u32,
    pub text: String,
    pub start_offset: usize,
    pub end_offset: usize,
    pub simhash: Option<String>,
    pub metadata: Option<serde_json::Value>,
    pub created_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResearchSession {
    pub id: Option<String>,
    pub project_id: String,
    pub conversation_id: String,
    pub user_message_id: String,
    pub mode: ResearchMode,
    pub status: ResearchStatus,
    pub objective: String,
    pub plan: Vec<String>,
    pub events: Vec<ResearchEvent>,
    pub claims: Vec<ResearchClaim>,
    pub used_page_ids: Vec<String>,
    pub used_evidence_ids: Vec<String>,
    pub search_count: u32,
    pub page_count: u32,
    pub created_at: Option<String>,
    pub finished_at: Option<String>,
}
