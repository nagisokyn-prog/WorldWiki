use serde::{Deserialize, Serialize};

/// Trait that the user's AppState must implement to use generated Tauri commands.
/// This keeps the macro crate independent from any specific application structure.
///
/// # Example
/// use surreal_domain::SurrealDb;
/// use surrealdb::{Surreal, engine::local::Db};
///
/// struct AppState { db: Surreal<Db> }
///
/// impl SurrealDb for AppState {
///     fn surreal_db(&self) -> &Surreal<Db> { &self.db }
/// }
/// ```
pub trait SurrealDb: Send + Sync + 'static {
    type Connection: surrealdb::Connection;
    fn surreal_db(&self) -> &surrealdb::Surreal<Self::Connection>;
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum SearchKind {
    Fulltext,
    Vector,
    Hybrid,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchResult<T> {
    pub entity: T,
    pub score: f64,
    pub kind: SearchKind,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SimilarResult<T> {
    pub entity: T,
    pub similarity: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum EdgeDirection {
    Outgoing,
    Incoming,
    Both,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GraphEdge<E, T> {
    pub edge_id: String,
    pub edge_data: E,
    pub node: T,
    pub direction: EdgeDirection,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GraphNeighborhood {
    pub center_id: String,
    pub nodes: Vec<serde_json::Value>,
    pub edges: Vec<serde_json::Value>,
    pub depth: u8,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ChapterRange {
    pub start_chapter: Option<String>,
    pub end_chapter: Option<String>,
}
