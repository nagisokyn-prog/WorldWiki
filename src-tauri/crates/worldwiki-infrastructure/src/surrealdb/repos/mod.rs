//! SurrealDB repository implementations and adapters for WorldWiki ports.

pub mod analytics_repo;
pub mod chapter_repo;
pub mod entity_repo;
pub mod fuzzy;
pub mod helpers;
pub mod plot_repo;
pub mod rag_repo;
pub mod relation_repo;
pub mod story_arc_repo;
pub mod timeline_repo;
pub mod volume_repo;

pub use analytics_repo::SurrealAnalyticsRepository;
pub use chapter_repo::SurrealChapterRepository;
pub use entity_repo::SurrealEntityRepository;
pub use helpers::*;
pub use plot_repo::{SurrealPlotPromiseRepository, SurrealTodoRepository};
pub use rag_repo::{
    format_entity_dossier_value, format_entity_search_dto, ChapterSearchDto, EntityRelationSearchDto,
    EntitySearchDto, LoreChunkSearchDto, RagBundleDto, SurrealRAGAdapter,
};
pub use relation_repo::SurrealRelationRepository;
pub use story_arc_repo::SurrealStoryArcRepository;
pub use timeline_repo::SurrealTimelineRepository;
pub use volume_repo::SurrealVolumeRepository;

