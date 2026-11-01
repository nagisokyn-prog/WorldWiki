pub mod bind_helpers;
pub mod calendar_ops;
pub mod error;
pub mod id_helpers;
pub mod json_helpers;
pub mod mock;
pub mod read_ops;
pub mod repo;
pub mod types;
pub mod write_ops;

pub use bind_helpers::*;
pub use error::SurrealDomainError;
pub use id_helpers::*;
pub use mock::MockSurrealRepo;
pub use repo::{SurrealDb, SurrealRepository};
pub use types::{
    ChapterRange, EdgeDirection, GraphEdge, GraphNeighborhood, SearchKind, SearchResult,
    SimilarResult,
};

pub use ts_rs;
