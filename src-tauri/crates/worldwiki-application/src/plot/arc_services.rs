use std::sync::Arc;
use worldwiki_domain::plot::{ArcChapterRelation, ArcEntityRelation, ChapterArcRelation, StoryArc};
use worldwiki_ports::repositories::StoryArcRepository;
use crate::errors::ApplicationError;

pub struct StoryArcServices {
    pub repo: Arc<dyn StoryArcRepository>,
}

impl StoryArcServices {
    pub fn new(repo: Arc<dyn StoryArcRepository>) -> Self {
        Self { repo }
    }

    pub async fn get_arc(&self, id: &str) -> Result<StoryArc, ApplicationError> {
        match self.repo.get_by_id(id).await? {
            Some(a) => Ok(a),
            None => Err(ApplicationError::NotFound(format!("Story arc {id} not found"))),
        }
    }

    pub async fn save_arc(&self, arc: &StoryArc) -> Result<String, ApplicationError> {
        Ok(self.repo.save(arc).await?)
    }

    pub async fn delete_arc(&self, id: &str) -> Result<(), ApplicationError> {
        self.repo.delete(id).await?;
        Ok(())
    }

    pub async fn list_by_project(&self, project_id: &str) -> Result<Vec<StoryArc>, ApplicationError> {
        Ok(self.repo.list_by_project(project_id).await?)
    }

    pub async fn assign_chapter(&self, relation: &ArcChapterRelation) -> Result<(), ApplicationError> {
        self.repo.assign_chapter(relation).await?;
        Ok(())
    }

    pub async fn remove_chapter(&self, arc_id: &str, chapter_id: &str) -> Result<(), ApplicationError> {
        self.repo.remove_chapter(arc_id, chapter_id).await?;
        Ok(())
    }

    pub async fn assign_entity(&self, relation: &ArcEntityRelation) -> Result<(), ApplicationError> {
        self.repo.assign_entity(relation).await?;
        Ok(())
    }

    pub async fn remove_entity(&self, arc_id: &str, entity_id: &str) -> Result<(), ApplicationError> {
        self.repo.remove_entity(arc_id, entity_id).await?;
        Ok(())
    }

    pub async fn list_chapters_for_arc(&self, arc_id: &str) -> Result<Vec<ArcChapterRelation>, ApplicationError> {
        Ok(self.repo.list_chapters_for_arc(arc_id).await?)
    }

    pub async fn list_entities_for_arc(&self, arc_id: &str) -> Result<Vec<ArcEntityRelation>, ApplicationError> {
        Ok(self.repo.list_entities_for_arc(arc_id).await?)
    }

    pub async fn list_arcs_for_chapter(&self, chapter_id: &str) -> Result<Vec<ChapterArcRelation>, ApplicationError> {
        Ok(self.repo.list_arcs_for_chapter(chapter_id).await?)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use async_trait::async_trait;
    use tokio::sync::Mutex;
    use worldwiki_domain::errors::DomainError;

    struct MockStoryArcRepo {
        arcs: Mutex<Vec<StoryArc>>,
    }

    #[async_trait]
    impl StoryArcRepository for MockStoryArcRepo {
        async fn get_by_id(&self, id: &str) -> Result<Option<StoryArc>, DomainError> {
            let arcs = self.arcs.lock().await;
            Ok(arcs.iter().find(|a| a.id == id).cloned())
        }
        async fn save(&self, arc: &StoryArc) -> Result<String, DomainError> {
            let mut arcs = self.arcs.lock().await;
            let mut a = arc.clone();
            if a.id.is_empty() {
                a.id = "story_arcs:arc_1".to_string();
            }
            arcs.push(a.clone());
            Ok(a.id)
        }
        async fn delete(&self, id: &str) -> Result<(), DomainError> {
            let mut arcs = self.arcs.lock().await;
            arcs.retain(|a| a.id != id);
            Ok(())
        }
        async fn list_by_project(&self, proj: &str) -> Result<Vec<StoryArc>, DomainError> {
            let arcs = self.arcs.lock().await;
            Ok(arcs.iter().filter(|a| a.project_id == proj).cloned().collect())
        }
        async fn assign_chapter(&self, _relation: &ArcChapterRelation) -> Result<(), DomainError> {
            Ok(())
        }
        async fn remove_chapter(&self, _arc_id: &str, _ch_id: &str) -> Result<(), DomainError> {
            Ok(())
        }
        async fn assign_entity(&self, _relation: &ArcEntityRelation) -> Result<(), DomainError> {
            Ok(())
        }
        async fn remove_entity(&self, _arc_id: &str, _ent_id: &str) -> Result<(), DomainError> {
            Ok(())
        }
        async fn list_chapters_for_arc(&self, _arc_id: &str) -> Result<Vec<ArcChapterRelation>, DomainError> {
            Ok(vec![])
        }
        async fn list_entities_for_arc(&self, _arc_id: &str) -> Result<Vec<ArcEntityRelation>, DomainError> {
            Ok(vec![])
        }
        async fn list_arcs_for_chapter(&self, _chapter_id: &str) -> Result<Vec<ChapterArcRelation>, DomainError> {
            Ok(vec![])
        }
    }

    #[tokio::test]
    async fn test_story_arc_services_crud() {
        let repo = Arc::new(MockStoryArcRepo {
            arcs: Mutex::new(Vec::new()),
        });
        let services = StoryArcServices::new(repo);

        let arc = StoryArc::new("proj_1", "Война Кольца");
        let id = services.save_arc(&arc).await.unwrap();
        assert_eq!(id, "story_arcs:arc_1");

        let fetched = services.get_arc("story_arcs:arc_1").await.unwrap();
        assert_eq!(fetched.title, "Война Кольца");

        let list = services.list_by_project("proj_1").await.unwrap();
        assert_eq!(list.len(), 1);

        services.delete_arc("story_arcs:arc_1").await.unwrap();
        let list_after = services.list_by_project("proj_1").await.unwrap();
        assert_eq!(list_after.len(), 0);
    }

    #[tokio::test]
    async fn test_story_arc_services_not_found_and_relations() {
        let repo = Arc::new(MockStoryArcRepo {
            arcs: Mutex::new(Vec::new()),
        });
        let services = StoryArcServices::new(repo);

        // NotFound
        let err = services.get_arc("missing").await.unwrap_err();
        assert!(matches!(err, ApplicationError::NotFound(_)));

        // Relations
        let ch_rel = ArcChapterRelation {
            arc_id: "arc_1".into(),
            chapter_id: "ch_1".into(),
            sort_order: 1,
            phase: Some("climax".into()),
        };
        services.assign_chapter(&ch_rel).await.unwrap();
        assert!(services.list_chapters_for_arc("arc_1").await.unwrap().is_empty());
        assert!(services.list_arcs_for_chapter("ch_1").await.unwrap().is_empty());
        services.remove_chapter("arc_1", "ch_1").await.unwrap();

        let ent_rel = ArcEntityRelation {
            arc_id: "arc_1".into(),
            entity_id: "ent_1".into(),
        };
        services.assign_entity(&ent_rel).await.unwrap();
        assert!(services.list_entities_for_arc("arc_1").await.unwrap().is_empty());
        services.remove_entity("arc_1", "ent_1").await.unwrap();
    }

    struct FailingStoryArcRepo;

    #[async_trait]
    impl StoryArcRepository for FailingStoryArcRepo {
        async fn get_by_id(&self, _id: &str) -> Result<Option<StoryArc>, DomainError> {
            Err(DomainError::validation("arc db err"))
        }
        async fn save(&self, _arc: &StoryArc) -> Result<String, DomainError> {
            Err(DomainError::validation("arc db err"))
        }
        async fn delete(&self, _id: &str) -> Result<(), DomainError> {
            Err(DomainError::validation("arc db err"))
        }
        async fn list_by_project(&self, _proj: &str) -> Result<Vec<StoryArc>, DomainError> {
            Err(DomainError::validation("arc db err"))
        }
        async fn assign_chapter(&self, _relation: &ArcChapterRelation) -> Result<(), DomainError> {
            Err(DomainError::validation("arc db err"))
        }
        async fn remove_chapter(&self, _arc_id: &str, _ch_id: &str) -> Result<(), DomainError> {
            Err(DomainError::validation("arc db err"))
        }
        async fn assign_entity(&self, _relation: &ArcEntityRelation) -> Result<(), DomainError> {
            Err(DomainError::validation("arc db err"))
        }
        async fn remove_entity(&self, _arc_id: &str, _ent_id: &str) -> Result<(), DomainError> {
            Err(DomainError::validation("arc db err"))
        }
        async fn list_chapters_for_arc(&self, _arc_id: &str) -> Result<Vec<ArcChapterRelation>, DomainError> {
            Err(DomainError::validation("arc db err"))
        }
        async fn list_entities_for_arc(&self, _arc_id: &str) -> Result<Vec<ArcEntityRelation>, DomainError> {
            Err(DomainError::validation("arc db err"))
        }
        async fn list_arcs_for_chapter(&self, _chapter_id: &str) -> Result<Vec<ChapterArcRelation>, DomainError> {
            Err(DomainError::validation("arc db err"))
        }
    }

    #[tokio::test]
    async fn test_story_arc_services_error_propagation() {
        let services = StoryArcServices::new(Arc::new(FailingStoryArcRepo));
        let arc = StoryArc::new("p1", "Title");
        assert!(services.get_arc("a1").await.is_err());
        assert!(services.save_arc(&arc).await.is_err());
        assert!(services.delete_arc("a1").await.is_err());
        assert!(services.list_by_project("p1").await.is_err());
        assert!(services
            .assign_chapter(&ArcChapterRelation {
                arc_id: "a".into(),
                chapter_id: "c".into(),
                sort_order: 0,
                phase: None,
            })
            .await
            .is_err());
        assert!(services.remove_chapter("a", "c").await.is_err());
        assert!(services
            .assign_entity(&ArcEntityRelation {
                arc_id: "a".into(),
                entity_id: "e".into(),
            })
            .await
            .is_err());
        assert!(services.remove_entity("a", "e").await.is_err());
        assert!(services.list_chapters_for_arc("a").await.is_err());
        assert!(services.list_entities_for_arc("a").await.is_err());
        assert!(services.list_arcs_for_chapter("c").await.is_err());
    }
}
