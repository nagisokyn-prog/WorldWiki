//! SurrealDB implementation of AnalyticsRepositoryPort invoking DDL fn::* stored functions.

pub mod character_journey;
pub mod item_tracker;
pub mod matrix;
pub mod multi_journey;
pub mod time_slice;
pub mod timeline_inspector;

use async_trait::async_trait;
use std::sync::Arc;
use surrealdb::engine::local::Db;
use surrealdb::Surreal;
use worldwiki_domain::analytics::{
    CharacterJourneyDto, CrossRefMatrixDto, GraphTimeSliceDto, ItemJourneyDto, ItemTrackerDto,
    JourneyFilterMode, MultiJourneyResponseDto, TimelineInspectorDto,
};
use worldwiki_domain::errors::DomainError;
use worldwiki_ports::repositories::AnalyticsRepositoryPort;

pub struct SurrealAnalyticsRepository {
    db: Arc<Surreal<Db>>,
}

impl SurrealAnalyticsRepository {
    pub fn new(db: Arc<Surreal<Db>>) -> Self {
        Self { db }
    }
}

#[async_trait]
impl AnalyticsRepositoryPort for SurrealAnalyticsRepository {
    async fn get_cross_reference_matrix(
        &self,
        project_id: &str,
    ) -> Result<CrossRefMatrixDto, DomainError> {
        matrix::get_cross_reference_matrix_impl(&self.db, project_id).await
    }

    async fn get_timeline_inspector_data(
        &self,
        project_id: &str,
    ) -> Result<TimelineInspectorDto, DomainError> {
        timeline_inspector::get_timeline_inspector_data_impl(&self.db, project_id).await
    }

    async fn get_graph_time_slice(
        &self,
        project_id: &str,
    ) -> Result<GraphTimeSliceDto, DomainError> {
        time_slice::get_graph_time_slice_impl(&self.db, project_id).await
    }

    async fn get_character_journey(
        &self,
        project_id: &str,
        entity_id: &str,
    ) -> Result<CharacterJourneyDto, DomainError> {
        character_journey::get_character_journey_impl(&self.db, project_id, entity_id).await
    }

    async fn get_multi_character_journey(
        &self,
        project_id: &str,
        entity_ids: &[String],
        mode: JourneyFilterMode,
    ) -> Result<MultiJourneyResponseDto, DomainError> {
        multi_journey::get_multi_character_journey_impl(&self.db, project_id, entity_ids, mode)
            .await
    }

    async fn get_item_tracker(
        &self,
        project_id: &str,
    ) -> Result<ItemTrackerDto, DomainError> {
        item_tracker::get_item_tracker_impl(&self.db, project_id).await
    }

    async fn get_item_journey(
        &self,
        project_id: &str,
        item_id: &str,
    ) -> Result<ItemJourneyDto, DomainError> {
        item_tracker::get_item_journey_impl(&self.db, project_id, item_id).await
    }
}

