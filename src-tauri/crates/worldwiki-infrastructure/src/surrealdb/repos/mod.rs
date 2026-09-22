//! SurrealDB repository implementations and adapters for WorldWiki ports.

pub mod chapter_repo;
pub mod entity_repo;
pub mod helpers;
pub mod plot_repo;
pub mod rag_repo;
pub mod relation_repo;
pub mod volume_repo;

pub use chapter_repo::SurrealChapterRepository;
pub use entity_repo::SurrealEntityRepository;
pub use helpers::*;
pub use plot_repo::{SurrealPlanRepository, SurrealPlotPromiseRepository};
pub use rag_repo::{
    format_entity_dossier_value, format_entity_search_dto, ChapterSearchDto, EntityRelationSearchDto,
    EntitySearchDto, LoreChunkSearchDto, RagBundleDto, SurrealRAGAdapter,
};
pub use relation_repo::SurrealRelationRepository;
pub use volume_repo::SurrealVolumeRepository;
