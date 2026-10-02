use async_trait::async_trait;
use worldwiki_domain::analytics::*;
use worldwiki_domain::calendar::{EventReveal, TimelineEvent};
use worldwiki_domain::errors::DomainError;
use worldwiki_domain::knowledge::Entity;
use worldwiki_domain::manuscript::Chapter;
use worldwiki_domain::plot::PlotPromise;
use worldwiki_ports::repositories::{
    AnalyticsRepositoryPort, ChapterRepository, EntityRepository, PlotPromiseRepository,
    TimelineEventRepository,
};

pub struct MockAnalyticsRepo {
    pub matrix: CrossRefMatrixDto,
    pub timeline: TimelineInspectorDto,
    pub items: Option<ItemTrackerDto>,
}

#[async_trait]
impl AnalyticsRepositoryPort for MockAnalyticsRepo {
    async fn get_cross_reference_matrix(
        &self,
        _proj: &str,
    ) -> Result<CrossRefMatrixDto, DomainError> {
        Ok(self.matrix.clone())
    }
    async fn get_timeline_inspector_data(
        &self,
        _proj: &str,
    ) -> Result<TimelineInspectorDto, DomainError> {
        Ok(self.timeline.clone())
    }
    async fn get_graph_time_slice(&self, _proj: &str) -> Result<GraphTimeSliceDto, DomainError> {
        Ok(GraphTimeSliceDto {
            nodes: vec![],
            edges: vec![],
        })
    }
    async fn get_character_journey(
        &self,
        _proj: &str,
        _ent: &str,
    ) -> Result<CharacterJourneyDto, DomainError> {
        Err(DomainError::Validation(
            "Mock character journey not implemented".to_string(),
        ))
    }
    async fn get_multi_character_journey(
        &self,
        _proj: &str,
        _ents: &[String],
        _mode: worldwiki_domain::analytics::JourneyFilterMode,
    ) -> Result<worldwiki_domain::analytics::MultiJourneyResponseDto, DomainError> {
        Err(DomainError::Validation(
            "Mock multi character journey not implemented".to_string(),
        ))
    }
    async fn get_item_tracker(&self, _proj: &str) -> Result<ItemTrackerDto, DomainError> {
        if let Some(ref it) = self.items {
            Ok(it.clone())
        } else {
            Ok(ItemTrackerDto {
                summary: ItemTrackerSummaryDto {
                    total_items: 0,
                    active_count: 0,
                    sleeping_count: 0,
                    forgotten_count: 0,
                    destroyed_count: 0,
                },
                items: vec![],
            })
        }
    }
    async fn get_item_journey(
        &self,
        _proj: &str,
        _item: &str,
    ) -> Result<ItemJourneyDto, DomainError> {
        Err(DomainError::Validation(
            "Mock item journey not implemented".to_string(),
        ))
    }
}

pub struct MockEntityRepo;
#[async_trait]
impl EntityRepository for MockEntityRepo {
    async fn get_by_id(&self, _id: &str) -> Result<Option<Entity>, DomainError> {
        Ok(None)
    }
    async fn save(&self, _entity: &Entity) -> Result<(), DomainError> {
        Ok(())
    }
    async fn delete(&self, _id: &str) -> Result<(), DomainError> {
        Ok(())
    }
    async fn search(
        &self,
        _project_id: &str,
        _query: &str,
        _top_k: usize,
    ) -> Result<Vec<Entity>, DomainError> {
        Ok(vec![])
    }
    async fn list_by_type(
        &self,
        _project_id: &str,
        _type_key: &str,
    ) -> Result<Vec<Entity>, DomainError> {
        Ok(vec![])
    }
    async fn list_by_project(&self, _proj: &str) -> Result<Vec<Entity>, DomainError> {
        Ok(vec![])
    }
}

pub struct MockChapterRepo;
#[async_trait]
impl ChapterRepository for MockChapterRepo {
    async fn get_by_id(&self, _id: &str) -> Result<Option<Chapter>, DomainError> {
        Ok(None)
    }
    async fn save(&self, _chapter: &Chapter) -> Result<(), DomainError> {
        Ok(())
    }
    async fn delete(&self, _id: &str) -> Result<(), DomainError> {
        Ok(())
    }
    async fn list_by_project(&self, _proj: &str) -> Result<Vec<Chapter>, DomainError> {
        Ok(vec![])
    }
    async fn list_by_volume(&self, _volume_id: &str) -> Result<Vec<Chapter>, DomainError> {
        Ok(vec![])
    }
    async fn sync_mentions_appearances(
        &self,
        _chapter_id: &str,
        _names: &[String],
    ) -> Result<(), DomainError> {
        Ok(())
    }
}

pub struct MockTimelineRepo;
#[async_trait]
impl TimelineEventRepository for MockTimelineRepo {
    async fn get_by_id(&self, _id: &str) -> Result<Option<TimelineEvent>, DomainError> {
        Ok(None)
    }
    async fn save(&self, _event: &TimelineEvent) -> Result<String, DomainError> {
        Ok(String::new())
    }
    async fn delete(&self, _id: &str) -> Result<(), DomainError> {
        Ok(())
    }
    async fn list_by_project(&self, _project_id: &str) -> Result<Vec<TimelineEvent>, DomainError> {
        Ok(vec![])
    }
    async fn add_reveal(&self, _reveal: &EventReveal) -> Result<(), DomainError> {
        Ok(())
    }
    async fn remove_reveal(&self, _event_id: &str, _chapter_id: &str) -> Result<(), DomainError> {
        Ok(())
    }
}

pub struct MockPromiseRepo;
#[async_trait]
impl PlotPromiseRepository for MockPromiseRepo {
    async fn get_by_id(&self, _id: &str) -> Result<Option<PlotPromise>, DomainError> {
        Ok(None)
    }
    async fn save(&self, _promise: &PlotPromise) -> Result<(), DomainError> {
        Ok(())
    }
    async fn delete(&self, _id: &str) -> Result<(), DomainError> {
        Ok(())
    }
    async fn list_by_chapter(&self, _chapter_id: &str) -> Result<Vec<PlotPromise>, DomainError> {
        Ok(vec![])
    }
    async fn list_unresolved_by_volume(
        &self,
        _volume_id: &str,
    ) -> Result<Vec<PlotPromise>, DomainError> {
        Ok(vec![])
    }
}
