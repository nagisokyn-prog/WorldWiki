use std::sync::Arc;
use serde::{Deserialize, Serialize};
use worldwiki_domain::knowledge::{Entity, EntityRelation};
use worldwiki_ports::repositories::{EntityRepository, RelationRepository};
use worldwiki_ports::events::{EventPublisherPort, EventPublisherExt, EntityChangedEvent};
use crate::errors::ApplicationError;
use chrono::Utc;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EntityCardDto {
    pub entity: Entity,
    pub relations: Vec<EntityRelation>,
}

pub struct KnowledgeServices {
    pub entity_repo: Arc<dyn EntityRepository>,
    pub relation_repo: Arc<dyn RelationRepository>,
    pub events: Arc<dyn EventPublisherPort>,
}

impl KnowledgeServices {
    pub fn new(
        entity_repo: Arc<dyn EntityRepository>,
        relation_repo: Arc<dyn RelationRepository>,
        events: Arc<dyn EventPublisherPort>,
    ) -> Self {
        Self {
            entity_repo,
            relation_repo,
            events,
        }
    }

    pub async fn get_entity(&self, id: &str) -> Result<Entity, ApplicationError> {
        self.entity_repo
            .get_by_id(id)
            .await?
            .ok_or_else(|| ApplicationError::NotFound(format!("Entity {id} not found")))
    }

    pub async fn get_full_card(&self, id: &str) -> Result<EntityCardDto, ApplicationError> {
        let entity = self.get_entity(id).await?;
        let relations = self.relation_repo.get_entity_relations(id).await?;
        Ok(EntityCardDto { entity, relations })
    }

    pub async fn save_entity(&self, entity: &Entity) -> Result<(), ApplicationError> {
        self.entity_repo.save(entity).await?;
        self.events
            .publish(EntityChangedEvent {
                entity_id: entity.id.clone(),
                action: "saved".to_string(),
                timestamp: Utc::now().timestamp(),
            })
            .await?;
        Ok(())
    }

    pub async fn add_relation(&self, rel: &EntityRelation) -> Result<(), ApplicationError> {
        self.relation_repo.save(rel).await?;
        Ok(())
    }
}
