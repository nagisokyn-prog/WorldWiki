use async_trait::async_trait;
use dashmap::DashMap;
use std::sync::Arc;
use worldwiki_domain::manuscript::Chapter;
use worldwiki_domain::knowledge::{Entity, EntityRelation};
use worldwiki_domain::plot::{PlotPromise, Plan, PromiseStatus};
use worldwiki_domain::errors::DomainError;
use worldwiki_ports::repositories::*;

#[derive(Default, Clone)]
pub struct InMemoryChapterRepository {
    storage: Arc<DashMap<String, Chapter>>,
}

#[async_trait]
impl ChapterRepository for InMemoryChapterRepository {
    async fn get_by_id(&self, id: &str) -> Result<Option<Chapter>, DomainError> {
        Ok(self.storage.get(id).map(|r| r.value().clone()))
    }

    async fn save(&self, chapter: &Chapter) -> Result<(), DomainError> {
        self.storage.insert(chapter.id.clone(), chapter.clone());
        Ok(())
    }

    async fn delete(&self, id: &str) -> Result<(), DomainError> {
        self.storage.remove(id);
        Ok(())
    }

    async fn list_by_project(&self, project_id: &str) -> Result<Vec<Chapter>, DomainError> {
        let list = self
            .storage
            .iter()
            .filter(|r| r.value().project_id == project_id)
            .map(|r| r.value().clone())
            .collect();
        Ok(list)
    }

    async fn list_by_volume(&self, volume_id: &str) -> Result<Vec<Chapter>, DomainError> {
        let list = self
            .storage
            .iter()
            .filter(|r| r.value().volume_id.as_deref() == Some(volume_id))
            .map(|r| r.value().clone())
            .collect();
        Ok(list)
    }
}

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

#[derive(Default, Clone)]
pub struct InMemoryPlotPromiseRepository {
    storage: Arc<DashMap<String, PlotPromise>>,
}

#[async_trait]
impl PlotPromiseRepository for InMemoryPlotPromiseRepository {
    async fn get_by_id(&self, id: &str) -> Result<Option<PlotPromise>, DomainError> {
        Ok(self.storage.get(id).map(|r| r.value().clone()))
    }

    async fn save(&self, promise: &PlotPromise) -> Result<(), DomainError> {
        self.storage.insert(promise.id.clone(), promise.clone());
        Ok(())
    }

    async fn delete(&self, id: &str) -> Result<(), DomainError> {
        self.storage.remove(id);
        Ok(())
    }

    async fn list_by_chapter(&self, chapter_id: &str) -> Result<Vec<PlotPromise>, DomainError> {
        let list = self
            .storage
            .iter()
            .filter(|r| r.value().chapter_id == chapter_id)
            .map(|r| r.value().clone())
            .collect();
        Ok(list)
    }

    async fn list_unresolved_by_volume(&self, volume_id: &str) -> Result<Vec<PlotPromise>, DomainError> {
        let list = self
            .storage
            .iter()
            .filter(|r| {
                r.value().resolved_in_volume.as_deref() == Some(volume_id)
                    && r.value().status != PromiseStatus::Resolved
            })
            .map(|r| r.value().clone())
            .collect();
        Ok(list)
    }
}

#[derive(Default, Clone)]
pub struct InMemoryPlanRepository {
    storage: Arc<DashMap<String, Plan>>,
}

#[async_trait]
impl PlanRepository for InMemoryPlanRepository {
    async fn get_by_id(&self, id: &str) -> Result<Option<Plan>, DomainError> {
        Ok(self.storage.get(id).map(|r| r.value().clone()))
    }

    async fn save(&self, plan: &Plan) -> Result<(), DomainError> {
        self.storage.insert(plan.id.clone(), plan.clone());
        Ok(())
    }

    async fn delete(&self, id: &str) -> Result<(), DomainError> {
        self.storage.remove(id);
        Ok(())
    }

    async fn list_by_parent(&self, parent_ref: &str) -> Result<Vec<Plan>, DomainError> {
        let list = self
            .storage
            .iter()
            .filter(|r| r.value().parent_ref.as_deref() == Some(parent_ref))
            .map(|r| r.value().clone())
            .collect();
        Ok(list)
    }

    async fn list_pending_by_volume(&self, volume_id: &str) -> Result<Vec<Plan>, DomainError> {
        let list = self
            .storage
            .iter()
            .filter(|r| r.value().parent_ref.as_deref() == Some(volume_id) && !r.value().completed)
            .map(|r| r.value().clone())
            .collect();
        Ok(list)
    }
}
