pub mod ai;
pub mod analytics;
pub mod calendar;
pub mod common;
pub mod errors;
pub mod knowledge;
pub mod manuscript;
pub mod plot;
pub mod workflows;

pub use errors::ApplicationError;

#[cfg(test)]
mod tests {
    use crate::ai::AiToolFacades;
    use crate::calendar::CalendarServices;
    use crate::common::JobManager;
    use crate::knowledge::KnowledgeServices;
    use crate::manuscript::ManuscriptServices;
    use crate::plot::PlotServices;
    use crate::workflows::{
        EditManuscriptAtomicWorkflow, EditManuscriptRequest, HybridSemanticSearchWorkflow,
        PlantedPromiseDto,
    };
    use std::sync::Arc;
    use worldwiki_domain::manuscript::Chapter;
    use worldwiki_domain::plot::Todo;

    struct TestEventPublisher;
    #[async_trait::async_trait]
    impl worldwiki_ports::EventPublisherPort for TestEventPublisher {
        async fn publish_raw(&self, _event_name: &str, _payload: serde_json::Value) -> Result<(), worldwiki_domain::errors::DomainError> {
            Ok(())
        }
    }

    #[derive(Default)]
    struct TestChapterRepository {
        storage: std::sync::Mutex<std::collections::HashMap<String, Chapter>>,
    }
    #[async_trait::async_trait]
    impl worldwiki_ports::repositories::ChapterRepository for TestChapterRepository {
        async fn get_by_id(&self, id: &str) -> Result<Option<Chapter>, worldwiki_domain::errors::DomainError> {
            Ok(self.storage.lock().unwrap().get(id).cloned())
        }
        async fn save(&self, chapter: &Chapter) -> Result<(), worldwiki_domain::errors::DomainError> {
            self.storage.lock().unwrap().insert(chapter.id.clone(), chapter.clone());
            Ok(())
        }
        async fn delete(&self, id: &str) -> Result<(), worldwiki_domain::errors::DomainError> {
            self.storage.lock().unwrap().remove(id);
            Ok(())
        }
        async fn list_by_project(&self, _project_id: &str) -> Result<Vec<Chapter>, worldwiki_domain::errors::DomainError> {
            Ok(self.storage.lock().unwrap().values().cloned().collect())
        }
        async fn list_by_volume(&self, volume_id: &str) -> Result<Vec<Chapter>, worldwiki_domain::errors::DomainError> {
            Ok(self.storage.lock().unwrap().values().filter(|c| c.volume_id == volume_id).cloned().collect())
        }
        async fn sync_mentions_appearances(&self, _chapter_id: &str, _entity_names: &[String]) -> Result<(), worldwiki_domain::errors::DomainError> {
            Ok(())
        }
    }

    #[derive(Default)]
    struct TestEntityRepository {
        storage: std::sync::Mutex<std::collections::HashMap<String, worldwiki_domain::knowledge::Entity>>,
    }
    #[async_trait::async_trait]
    impl worldwiki_ports::repositories::EntityRepository for TestEntityRepository {
        async fn get_by_id(&self, id: &str) -> Result<Option<worldwiki_domain::knowledge::Entity>, worldwiki_domain::errors::DomainError> {
            Ok(self.storage.lock().unwrap().get(id).cloned())
        }
        async fn save(&self, entity: &worldwiki_domain::knowledge::Entity) -> Result<(), worldwiki_domain::errors::DomainError> {
            self.storage.lock().unwrap().insert(entity.id.clone(), entity.clone());
            Ok(())
        }
        async fn delete(&self, id: &str) -> Result<(), worldwiki_domain::errors::DomainError> {
            self.storage.lock().unwrap().remove(id);
            Ok(())
        }
        async fn search(&self, _project_id: &str, _query: &str, _top_k: usize) -> Result<Vec<worldwiki_domain::knowledge::Entity>, worldwiki_domain::errors::DomainError> {
            Ok(self.storage.lock().unwrap().values().cloned().collect())
        }
        async fn list_by_type(&self, _project_id: &str, type_key: &str) -> Result<Vec<worldwiki_domain::knowledge::Entity>, worldwiki_domain::errors::DomainError> {
            Ok(self.storage.lock().unwrap().values().filter(|e| e.type_key == type_key).cloned().collect())
        }
        async fn list_by_project(&self, project_id: &str) -> Result<Vec<worldwiki_domain::knowledge::Entity>, worldwiki_domain::errors::DomainError> {
            Ok(self.storage.lock().unwrap().values().filter(|e| e.project_id == project_id).cloned().collect())
        }
    }

    #[derive(Default)]
    struct TestRelationRepository {
        storage: std::sync::Mutex<std::collections::HashMap<String, worldwiki_domain::knowledge::EntityRelation>>,
    }
    #[async_trait::async_trait]
    impl worldwiki_ports::repositories::RelationRepository for TestRelationRepository {
        async fn get_by_id(&self, id: &str) -> Result<Option<worldwiki_domain::knowledge::EntityRelation>, worldwiki_domain::errors::DomainError> {
            Ok(self.storage.lock().unwrap().get(id).cloned())
        }
        async fn save(&self, rel: &worldwiki_domain::knowledge::EntityRelation) -> Result<(), worldwiki_domain::errors::DomainError> {
            self.storage.lock().unwrap().insert(rel.id.clone(), rel.clone());
            Ok(())
        }
        async fn delete(&self, id: &str) -> Result<(), worldwiki_domain::errors::DomainError> {
            self.storage.lock().unwrap().remove(id);
            Ok(())
        }
        async fn get_entity_relations(&self, entity_id: &str) -> Result<Vec<worldwiki_domain::knowledge::EntityRelation>, worldwiki_domain::errors::DomainError> {
            Ok(self.storage.lock().unwrap().values().filter(|r| r.from_entity_id == entity_id || r.to_entity_id == entity_id).cloned().collect())
        }
    }

    #[derive(Default)]
    struct TestPlotPromiseRepository {
        storage: std::sync::Mutex<std::collections::HashMap<String, worldwiki_domain::plot::PlotPromise>>,
    }
    #[async_trait::async_trait]
    impl worldwiki_ports::repositories::PlotPromiseRepository for TestPlotPromiseRepository {
        async fn get_by_id(&self, id: &str) -> Result<Option<worldwiki_domain::plot::PlotPromise>, worldwiki_domain::errors::DomainError> {
            Ok(self.storage.lock().unwrap().get(id).cloned())
        }
        async fn save(&self, promise: &worldwiki_domain::plot::PlotPromise) -> Result<(), worldwiki_domain::errors::DomainError> {
            self.storage.lock().unwrap().insert(promise.id.clone(), promise.clone());
            Ok(())
        }
        async fn delete(&self, id: &str) -> Result<(), worldwiki_domain::errors::DomainError> {
            self.storage.lock().unwrap().remove(id);
            Ok(())
        }
        async fn list_by_chapter(&self, chapter_id: &str) -> Result<Vec<worldwiki_domain::plot::PlotPromise>, worldwiki_domain::errors::DomainError> {
            Ok(self.storage.lock().unwrap().values().filter(|p| p.chapter_id.as_deref() == Some(chapter_id)).cloned().collect())
        }
        async fn list_unresolved_by_volume(&self, _volume_id: &str) -> Result<Vec<worldwiki_domain::plot::PlotPromise>, worldwiki_domain::errors::DomainError> {
            Ok(self.storage.lock().unwrap().values().filter(|p| p.status != worldwiki_domain::plot::PromiseStatus::Resolved).cloned().collect())
        }
    }

    #[derive(Default)]
    struct TestTodoRepository {
        storage: std::sync::Mutex<std::collections::HashMap<String, Todo>>,
    }
    #[async_trait::async_trait]
    impl worldwiki_ports::repositories::TodoRepository for TestTodoRepository {
        async fn get_by_id(&self, id: &str) -> Result<Option<Todo>, worldwiki_domain::errors::DomainError> {
            Ok(self.storage.lock().unwrap().get(id).cloned())
        }
        async fn save(&self, todo: &Todo) -> Result<String, worldwiki_domain::errors::DomainError> {
            let id = if todo.id.is_empty() {
                format!("todo_{}", self.storage.lock().unwrap().len() + 1)
            } else {
                todo.id.clone()
            };
            let mut t = todo.clone();
            t.id = id.clone();
            self.storage.lock().unwrap().insert(id.clone(), t);
            Ok(id)
        }
        async fn set_status(&self, id: &str, status: &str) -> Result<Option<Todo>, worldwiki_domain::errors::DomainError> {
            let mut map = self.storage.lock().unwrap();
            if let Some(t) = map.get_mut(id) {
                let parsed = match status {
                    "done" => worldwiki_domain::plot::TodoStatus::Done,
                    "in_progress" => worldwiki_domain::plot::TodoStatus::InProgress,
                    "blocked" => worldwiki_domain::plot::TodoStatus::Blocked,
                    _ => worldwiki_domain::plot::TodoStatus::Planned,
                };
                t.set_status(parsed);
                Ok(Some(t.clone()))
            } else {
                Ok(None)
            }
        }
        async fn delete(&self, id: &str) -> Result<(), worldwiki_domain::errors::DomainError> {
            self.storage.lock().unwrap().remove(id);
            Ok(())
        }
        async fn list_by_owner(&self, owner_id: &str) -> Result<Vec<Todo>, worldwiki_domain::errors::DomainError> {
            Ok(self.storage.lock().unwrap().values().filter(|t| t.owner_id == owner_id).cloned().collect())
        }
        async fn list_by_owners(&self, owner_ids: &[&str]) -> Result<Vec<Todo>, worldwiki_domain::errors::DomainError> {
            Ok(self.storage.lock().unwrap().values().filter(|t| owner_ids.contains(&t.owner_id.as_str())).cloned().collect())
        }
    }

    struct TestRagPort;
    #[async_trait::async_trait]
    impl worldwiki_ports::ai::RAGContextPort for TestRagPort {
        async fn retrieve_context(
            &self,
            project_id: &str,
            query: &str,
            scope: &str,
            _top_k: usize,
        ) -> Result<Vec<serde_json::Value>, worldwiki_domain::errors::DomainError> {
            Ok(vec![serde_json::json!({
                "project_id": project_id,
                "scope": scope,
                "match": format!("Context match for query: '{query}'")
            })])
        }
        async fn retrieve_chapter_multi_hop_context(
            &self,
            project_id: &str,
            chapter_id: &str,
        ) -> Result<serde_json::Value, worldwiki_domain::errors::DomainError> {
            Ok(serde_json::json!({
                "project_id": project_id,
                "chapter_id": chapter_id,
                "participants": [],
                "relations": [],
                "timeline": [],
                "plot_promises": []
            }))
        }
    }

    fn setup_test_services() -> AiToolFacades {
        let events: Arc<dyn worldwiki_ports::EventPublisherPort> = Arc::new(TestEventPublisher);
        let manuscript = Arc::new(ManuscriptServices::new(
            Arc::new(TestChapterRepository::default()),
            Arc::clone(&events),
        ));
        let knowledge = Arc::new(KnowledgeServices::new(
            Arc::new(TestEntityRepository::default()),
            Arc::new(TestRelationRepository::default()),
            Arc::clone(&events),
        ));
        let calendar = Arc::new(CalendarServices::new());
        let plot = Arc::new(PlotServices::new(
            Arc::new(TestPlotPromiseRepository::default()),
            Arc::new(TestTodoRepository::default()),
            events,
        ));
        let job_manager = Arc::new(JobManager::new());

        let edit_workflow = Arc::new(EditManuscriptAtomicWorkflow::new(
            Arc::clone(&manuscript),
            Arc::clone(&plot),
        ));
        let search_workflow = Arc::new(HybridSemanticSearchWorkflow::new(Arc::new(TestRagPort)));

        AiToolFacades::new(
            manuscript,
            knowledge,
            calendar,
            plot,
            edit_workflow,
            search_workflow,
            job_manager,
        )
    }

    #[tokio::test]
    async fn test_edit_manuscript_atomic_workflow() {
        let facades = setup_test_services();

        // 1. Create initial chapter
        let mut chapter = Chapter::new("vol_1", "Глава 1: Начало", 1);
        chapter.id = "ch_1".to_string();
        let ch_id = chapter.id.clone();
        facades.manuscript.save_chapter(&chapter).await.unwrap();

        // 2. Execute atomic edit workflow
        let req = EditManuscriptRequest {
            chapter_id: ch_id.clone(),
            content_patch: "В комнате на стене висел странный меч ((Экскалибур)).".to_string(),
            project_id: Some("proj_1".to_string()),
            planted_promises: vec![PlantedPromiseDto {
                kind: "gun".to_string(),
                quote: "странный меч ((Экскалибур))".to_string(),
                note: Some("Понадобится в битве с драконом".to_string()),
            }],
            resolved_promise_ids: vec![],
            completed_plan_ids: vec![],
        };

        let res = facades.edit_manuscript(req).await.unwrap();
        assert_eq!(res.promises_planted, 1);
        assert_eq!(res.word_count, 8);

        // Verify chapter content was updated
        let updated_ch = facades.manuscript.get_chapter(&ch_id).await.unwrap();
        assert_eq!(
            updated_ch.content,
            "В комнате на стене висел странный меч ((Экскалибур))."
        );
    }

    #[tokio::test]
    async fn test_volume_audit_consistency_detects_blockers() {
        let facades = setup_test_services();

        // 1. Add uncompleted task item to volume
        let todo = Todo::new("vol_1", "Завершить финальную битву", 1);
        let id = facades.plot.todo_repo.save(&todo).await.unwrap();

        // 2. Audit volume
        let report = facades.plot.audit_volume("vol_1").await.unwrap();
        assert!(report.has_blockers);
        assert_eq!(report.pending_todos_count, 1);

        // 3. Complete task item and re-audit
        facades.plot.toggle_todo(&id).await.unwrap();
        let report_after = facades.plot.audit_volume("vol_1").await.unwrap();
        assert!(!report_after.has_blockers);
        assert_eq!(report_after.pending_todos_count, 0);
    }

    #[tokio::test]
    async fn test_all_8_ai_facades_smoke() {
        let facades = setup_test_services();

        // 1. query_world
        let search_res = facades
            .query_world("proj_1", "магия", "all", 5)
            .await
            .unwrap();
        assert!(!search_res.is_empty());

        // 2. manage_entity create
        let create_res = facades
            .manage_entity(
                "create",
                serde_json::json!({
                    "id": "char_1",
                    "project_id": "proj_1",
                    "type_key": "character",
                    "name": "Гэндальф",
                    "attributes": {},
                    "tags": [],
                    "created_at": chrono::Utc::now(),
                    "updated_at": chrono::Utc::now()
                }),
            )
            .await
            .unwrap();
        assert_eq!(create_res["status"], "created");

        // 3. inspect_entity
        let card = facades.inspect_entity("proj_1", "char_1").await.unwrap();
        assert_eq!(card["entity"]["name"], "Гэндальф");

        // 4. read_manuscript
        let mut ch = Chapter::new("proj_1", "Глава A", 1);
        ch.id = "ch_a".to_string();
        let ch_id = ch.id.clone();
        facades.manuscript.save_chapter(&ch).await.unwrap();
        let read_val = facades.read_manuscript("proj_1", &ch_id).await.unwrap();
        assert_eq!(read_val["title"], "Глава A");

        // 5. delegate_task
        let task_res = facades
            .delegate_task("task_001", "Проанализируй диалог")
            .await
            .unwrap();
        assert_eq!(task_res["status"], "completed");
    }

    #[derive(Default, Clone, Debug)]
    struct LocalTestAiMock;

    impl worldwiki_ports::ai::HardwareDetectorPort for LocalTestAiMock {
        fn get_hardware_info(&self) -> worldwiki_domain::ai::HardwareInfo {
            worldwiki_domain::ai::HardwareInfo {
                total_ram_gb: 16.0,
                free_ram_gb: 8.0,
                gpu_name: "Mock GPU".to_string(),
                total_vram_gb: 8.0,
                free_vram_gb: 6.0,
                is_gpu_available: false,
            }
        }
        fn calculate_quantization_estimates(
            &self,
            _params_billions: f32,
            _context_tokens: Option<usize>,
        ) -> Vec<worldwiki_domain::ai::MemoryEstimation> {
            vec![worldwiki_domain::ai::MemoryEstimation {
                quant_name: "Q4_K_M".to_string(),
                estimated_vram_gb: 4.5,
                status: "ok".to_string(),
                is_recommended: true,
                size_gb: 4.0,
            }]
        }
        fn get_recommended_local_models(&self) -> Vec<worldwiki_domain::ai::RecommendedModelCard> {
            vec![
                worldwiki_domain::ai::RecommendedModelCard {
                    id: "model_1".to_string(),
                    name: "Model 1".to_string(),
                    tagline: "Fast and lightweight".to_string(),
                    description: "Test".to_string(),
                    parameters: "7B".to_string(),
                    recommended_quant: "Q4_K_M".to_string(),
                    size_gb: 4.5,
                    repo_id: "test/m1".to_string(),
                    filename: "m1.gguf".to_string(),
                    tags: vec![],
                    license_name: "Apache-2.0".to_string(),
                    is_commercial_allowed: true,
                },
                worldwiki_domain::ai::RecommendedModelCard {
                    id: "model_2".to_string(),
                    name: "Model 2".to_string(),
                    tagline: "Balanced".to_string(),
                    description: "Test".to_string(),
                    parameters: "8B".to_string(),
                    recommended_quant: "Q4_K_M".to_string(),
                    size_gb: 5.0,
                    repo_id: "test/m2".to_string(),
                    filename: "m2.gguf".to_string(),
                    tags: vec![],
                    license_name: "Apache-2.0".to_string(),
                    is_commercial_allowed: true,
                },
                worldwiki_domain::ai::RecommendedModelCard {
                    id: "model_3".to_string(),
                    name: "Model 3".to_string(),
                    tagline: "Compact".to_string(),
                    description: "Test".to_string(),
                    parameters: "3B".to_string(),
                    recommended_quant: "Q4_K_M".to_string(),
                    size_gb: 2.0,
                    repo_id: "test/m3".to_string(),
                    filename: "m3.gguf".to_string(),
                    tags: vec![],
                    license_name: "Apache-2.0".to_string(),
                    is_commercial_allowed: true,
                },
            ]
        }
    }

    impl worldwiki_ports::ai::LocalModelManagerPort for LocalTestAiMock {
        fn list_installed(&self) -> Result<Vec<worldwiki_domain::ai::InstalledModelInfo>, worldwiki_domain::errors::DomainError> {
            Ok(vec![])
        }
        fn load_model(&self, _filename: &str) -> Result<String, worldwiki_domain::errors::DomainError> {
            Ok("Loaded".to_string())
        }
        fn unload_model(&self, _filename: &str) -> Result<String, worldwiki_domain::errors::DomainError> {
            Ok("Unloaded".to_string())
        }
        fn unload_all(&self) -> Result<String, worldwiki_domain::errors::DomainError> {
            Ok("All unloaded".to_string())
        }
        fn delete_model(&self, _filename: &str) -> Result<String, worldwiki_domain::errors::DomainError> {
            Ok("Deleted".to_string())
        }
    }

    impl worldwiki_ports::ai::PermissionsPort for LocalTestAiMock {
        fn get_tool_permissions_catalog(&self) -> Vec<worldwiki_domain::ai::ToolPermissionConfig> {
            (1..=5).map(|i| {
                worldwiki_domain::ai::ToolPermissionConfig {
                    id: format!("tool_{i}"),
                    name: format!("Tool {i}"),
                    description: format!("Desc {i}"),
                    category: worldwiki_domain::ai::ToolCategory::Read,
                    risk: worldwiki_domain::ai::RiskLevel::Low,
                    default_level: worldwiki_domain::ai::PermissionLevel::Allow,
                    user_level: None,
                }
            }).collect()
        }
        fn save_tool_permission(&self, _tool_id: &str, _level: &str) -> Result<(), worldwiki_domain::errors::DomainError> {
            Ok(())
        }
        fn save_all_tool_permissions(&self, _permissions: &std::collections::HashMap<String, String>) -> Result<(), worldwiki_domain::errors::DomainError> {
            Ok(())
        }
    }

    #[test]
    fn test_local_ai_services_hardware_and_manager() {
        use crate::ai::LocalAiServices;

        let mock = Arc::new(LocalTestAiMock);
        let local_ai = LocalAiServices::new(mock.clone(), mock.clone(), mock);

        let info = local_ai.get_hardware_info();
        assert!(info.total_ram_gb > 0.0);

        let quants = local_ai.calculate_quantization_estimates(7.0, Some(4096));
        assert!(!quants.is_empty());

        let recommended = local_ai.get_recommended_local_models();
        assert_eq!(recommended.len(), 3);

        let catalog = local_ai.get_tool_permissions_catalog();
        assert!(catalog.len() >= 5);

        let installed = local_ai
            .list_installed_models()
            .expect("list_installed_models must succeed");
        let _ = installed;
    }
}
