use async_trait::async_trait;
use dashmap::DashMap;
use std::sync::Arc;
use worldwiki_domain::errors::DomainError;
use worldwiki_domain::knowledge::{Entity, EntityRelation};
use worldwiki_ports::repositories::{EntityRepository, RelationRepository};

#[derive(Default, Clone)]
pub struct InMemoryEntityRepository {
    storage: Arc<DashMap<String, Entity>>,
}

#[async_trait]
impl EntityRepository for InMemoryEntityRepository {
    async fn get_by_id(&self, id: &str) -> Result<Option<Entity>, DomainError> {
        Ok(self.storage.get(id).map(|r| r.value().clone()))
    }

    async fn save(&self, entity: &Entity) -> Result<(), DomainError> {
        self.storage.insert(entity.id.clone(), entity.clone());
        Ok(())
    }

    async fn delete(&self, id: &str) -> Result<(), DomainError> {
        self.storage.remove(id);
        Ok(())
    }

    async fn search(&self, project_id: &str, query: &str, top_k: usize) -> Result<Vec<Entity>, DomainError> {
        let q = query.to_lowercase();
        let results = self
            .storage
            .iter()
            .filter(|r| {
                r.value().project_id == project_id
                    && (r.value().name.to_lowercase().contains(&q)
                        || r.value().description.as_deref().unwrap_or("").to_lowercase().contains(&q))
            })
            .take(top_k)
            .map(|r| r.value().clone())
            .collect();
        Ok(results)
    }

    async fn list_by_type(&self, project_id: &str, type_key: &str) -> Result<Vec<Entity>, DomainError> {
        let list = self
            .storage
            .iter()
            .filter(|r| r.value().project_id == project_id && r.value().type_key == type_key)
            .map(|r| r.value().clone())
            .collect();
        Ok(list)
    }

    async fn list_by_project(&self, project_id: &str) -> Result<Vec<Entity>, DomainError> {
        let list = self
            .storage
            .iter()
            .filter(|r| r.value().project_id == project_id)
            .map(|r| r.value().clone())
            .collect();
        Ok(list)
    }
}

#[derive(Default, Clone)]
pub struct InMemoryRelationRepository {
    storage: Arc<DashMap<String, EntityRelation>>,
}

#[async_trait]
impl RelationRepository for InMemoryRelationRepository {
    async fn get_by_id(&self, id: &str) -> Result<Option<EntityRelation>, DomainError> {
        Ok(self.storage.get(id).map(|r| r.value().clone()))
    }

    async fn save(&self, rel: &EntityRelation) -> Result<(), DomainError> {
        self.storage.insert(rel.id.clone(), rel.clone());
        Ok(())
    }

    async fn delete(&self, id: &str) -> Result<(), DomainError> {
        self.storage.remove(id);
        Ok(())
    }

    async fn get_entity_relations(&self, entity_id: &str) -> Result<Vec<EntityRelation>, DomainError> {
        let list = self
            .storage
            .iter()
            .filter(|r| r.value().from_entity_id == entity_id || r.value().to_entity_id == entity_id)
            .map(|r| r.value().clone())
            .collect();
        Ok(list)
    }
}
