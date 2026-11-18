#![allow(dead_code)]

use async_trait::async_trait;
use std::collections::HashMap;
use std::sync::Mutex;
use worldwiki_domain::ai::{
    HardwareInfo, InstalledModelInfo, MemoryEstimation, PermissionLevel, RecommendedModelCard,
    RiskLevel, ToolCategory, ToolPermissionConfig,
};
use worldwiki_domain::analytics::{
    ChapterHeaderDto, CharacterJourneyDto, CrossRefMatrixDto, ItemJourneyDto, ItemTrackerDto,
    ItemTrackerSummaryDto, JourneyFilterMode, MultiJourneyResponseDto, TimelineInspectorDto,
    TimelineInspectorEventNode, TimelineRevealLink,
};
use worldwiki_domain::errors::DomainError;
use worldwiki_domain::knowledge::{Entity, EntityRelation};
use worldwiki_domain::manuscript::Chapter;
use worldwiki_domain::plot::{PlotPromise, PromiseStatus, Todo, TodoStatus};
use worldwiki_ports::ai::{
    HardwareDetectorPort, LocalModelManagerPort, PermissionsPort, RAGContextPort,
};
use worldwiki_ports::repositories::{
    AnalyticsRepositoryPort, ChapterRepository, EntityRepository, PlotPromiseRepository,
    RelationRepository, TodoRepository,
};
use worldwiki_ports::EventPublisherPort;

#[derive(Default)]
pub struct FakeEventPublisher {
    pub fail: bool,
    pub published: Mutex<Vec<String>>,
}

#[async_trait]
impl EventPublisherPort for FakeEventPublisher {
    async fn publish_raw(
        &self,
        event_type: &str,
        _payload: serde_json::Value,
    ) -> Result<(), DomainError> {
        if self.fail {
            return Err(DomainError::validation("event err"));
        }
        self.published.lock().unwrap().push(event_type.to_string());
        Ok(())
    }
}

#[derive(Default)]
pub struct FakeChapterRepo {
    pub storage: Mutex<HashMap<String, Chapter>>,
    pub synced_mentions: Mutex<Vec<String>>,
    pub fail_list: bool,
    pub fail_get: bool,
    pub fail_save: bool,
    pub fail_sync_mentions: bool,
}

#[async_trait]
impl ChapterRepository for FakeChapterRepo {
    async fn get_by_id(&self, id: &str) -> Result<Option<Chapter>, DomainError> {
        if self.fail_get {
            return Err(DomainError::validation("chapter get err"));
        }
        Ok(self.storage.lock().unwrap().get(id).cloned())
    }
    async fn save(&self, chapter: &Chapter) -> Result<(), DomainError> {
        if self.fail_save {
            return Err(DomainError::validation("chapter save err"));
        }
        self.storage
            .lock()
            .unwrap()
            .insert(chapter.id.clone(), chapter.clone());
        Ok(())
    }
    async fn delete(&self, id: &str) -> Result<(), DomainError> {
        self.storage.lock().unwrap().remove(id);
        Ok(())
    }
    async fn list_by_project(&self, _project_id: &str) -> Result<Vec<Chapter>, DomainError> {
        if self.fail_list {
            return Err(DomainError::validation("chapter err"));
        }
        Ok(self.storage.lock().unwrap().values().cloned().collect())
    }
    async fn list_by_volume(&self, volume_id: &str) -> Result<Vec<Chapter>, DomainError> {
        Ok(self
            .storage
            .lock()
            .unwrap()
            .values()
            .filter(|c| c.volume_id == volume_id)
            .cloned()
            .collect())
    }
    async fn sync_mentions_appearances(
        &self,
        _chapter_id: &str,
        entity_names: &[String],
    ) -> Result<(), DomainError> {
        if self.fail_sync_mentions {
            return Err(DomainError::validation("sync mentions err"));
        }
        *self.synced_mentions.lock().unwrap() = entity_names.to_vec();
        Ok(())
    }
}

#[derive(Default)]
pub struct FakeEntityRepo {
    pub storage: Mutex<HashMap<String, Entity>>,
    pub fail_list: bool,
    pub fail_get: bool,
    pub fail_save: bool,
}

#[async_trait]
impl EntityRepository for FakeEntityRepo {
    async fn get_by_id(&self, id: &str) -> Result<Option<Entity>, DomainError> {
        if self.fail_get {
            return Err(DomainError::validation("entity get err"));
        }
        Ok(self.storage.lock().unwrap().get(id).cloned())
    }
    async fn save(&self, entity: &Entity) -> Result<(), DomainError> {
        if self.fail_save {
            return Err(DomainError::validation("entity save err"));
        }
        self.storage
            .lock()
            .unwrap()
            .insert(entity.id.clone(), entity.clone());
        Ok(())
    }
    async fn delete(&self, id: &str) -> Result<(), DomainError> {
        self.storage.lock().unwrap().remove(id);
        Ok(())
    }
    async fn search(
        &self,
        _project_id: &str,
        _query: &str,
        _top_k: usize,
    ) -> Result<Vec<Entity>, DomainError> {
        Ok(self.storage.lock().unwrap().values().cloned().collect())
    }
    async fn list_by_type(
        &self,
        _project_id: &str,
        type_key: &str,
    ) -> Result<Vec<Entity>, DomainError> {
        Ok(self
            .storage
            .lock()
            .unwrap()
            .values()
            .filter(|e| e.type_key == type_key)
            .cloned()
            .collect())
    }
    async fn list_by_project(&self, project_id: &str) -> Result<Vec<Entity>, DomainError> {
        if self.fail_list {
            return Err(DomainError::validation("entity err"));
        }
        Ok(self
            .storage
            .lock()
            .unwrap()
            .values()
            .filter(|e| e.project_id == project_id)
            .cloned()
            .collect())
    }
}

#[derive(Default)]
pub struct FakeRelationRepo {
    pub storage: Mutex<HashMap<String, EntityRelation>>,
    pub fail: bool,
}

#[async_trait]
impl RelationRepository for FakeRelationRepo {
    async fn get_by_id(&self, id: &str) -> Result<Option<EntityRelation>, DomainError> {
        Ok(self.storage.lock().unwrap().get(id).cloned())
    }
    async fn save(&self, rel: &EntityRelation) -> Result<(), DomainError> {
        if self.fail {
            return Err(DomainError::validation("rel save err"));
        }
        self.storage
            .lock()
            .unwrap()
            .insert(rel.id.clone(), rel.clone());
        Ok(())
    }
    async fn delete(&self, id: &str) -> Result<(), DomainError> {
        self.storage.lock().unwrap().remove(id);
        Ok(())
    }
    async fn get_entity_relations(
        &self,
        entity_id: &str,
    ) -> Result<Vec<EntityRelation>, DomainError> {
        if self.fail {
            return Err(DomainError::validation("rel list err"));
        }
        Ok(self
            .storage
            .lock()
            .unwrap()
            .values()
            .filter(|r| r.from_entity_id == entity_id || r.to_entity_id == entity_id)
            .cloned()
            .collect())
    }
}

#[derive(Default)]
pub struct FakePromiseRepo {
    pub storage: Mutex<HashMap<String, PlotPromise>>,
    pub fail: bool,
}

#[async_trait]
impl PlotPromiseRepository for FakePromiseRepo {
    async fn get_by_id(&self, id: &str) -> Result<Option<PlotPromise>, DomainError> {
        Ok(self.storage.lock().unwrap().get(id).cloned())
    }
    async fn save(&self, promise: &PlotPromise) -> Result<(), DomainError> {
        if self.fail {
            return Err(DomainError::validation("promise save err"));
        }
        self.storage
            .lock()
            .unwrap()
            .insert(promise.id.clone(), promise.clone());
        Ok(())
    }
    async fn delete(&self, id: &str) -> Result<(), DomainError> {
        if self.fail {
            return Err(DomainError::validation("promise delete err"));
        }
        self.storage.lock().unwrap().remove(id);
        Ok(())
    }
    async fn list_by_chapter(&self, chapter_id: &str) -> Result<Vec<PlotPromise>, DomainError> {
        Ok(self
            .storage
            .lock()
            .unwrap()
            .values()
            .filter(|p| p.chapter_id.as_deref() == Some(chapter_id))
            .cloned()
            .collect())
    }
    async fn list_unresolved_by_volume(
        &self,
        _volume_id: &str,
    ) -> Result<Vec<PlotPromise>, DomainError> {
        if self.fail {
            return Err(DomainError::validation("audit err"));
        }
        Ok(self
            .storage
            .lock()
            .unwrap()
            .values()
            .filter(|p| p.status != PromiseStatus::Resolved)
            .cloned()
            .collect())
    }
}

#[derive(Default)]
pub struct FakeTodoRepo {
    pub storage: Mutex<HashMap<String, Todo>>,
    pub set_status_returns_none: bool,
    pub fail: bool,
}

pub fn parse_todo_status(status: &str) -> TodoStatus {
    match status {
        "in_progress" => TodoStatus::InProgress,
        "done" => TodoStatus::Done,
        "blocked" => TodoStatus::Blocked,
        _ => TodoStatus::Planned,
    }
}

#[async_trait]
impl TodoRepository for FakeTodoRepo {
    async fn get_by_id(&self, id: &str) -> Result<Option<Todo>, DomainError> {
        if self.fail {
            return Err(DomainError::validation("todo get err"));
        }
        Ok(self.storage.lock().unwrap().get(id).cloned())
    }
    async fn save(&self, todo: &Todo) -> Result<String, DomainError> {
        if self.fail {
            return Err(DomainError::validation("todo save err"));
        }
        let mut map = self.storage.lock().unwrap();
        let id = if todo.id.is_empty() {
            format!("todo_{}", map.len() + 1)
        } else {
            todo.id.clone()
        };
        let mut t = todo.clone();
        t.id = id.clone();
        map.insert(id.clone(), t);
        Ok(id)
    }
    async fn set_status(&self, id: &str, status: &str) -> Result<Option<Todo>, DomainError> {
        if self.fail {
            return Err(DomainError::validation("todo status err"));
        }
        if self.set_status_returns_none {
            return Ok(None);
        }
        let mut map = self.storage.lock().unwrap();
        if let Some(t) = map.get_mut(id) {
            t.set_status(parse_todo_status(status));
            Ok(Some(t.clone()))
        } else {
            Ok(None)
        }
    }
    async fn delete(&self, id: &str) -> Result<(), DomainError> {
        if self.fail {
            return Err(DomainError::validation("todo delete err"));
        }
        self.storage.lock().unwrap().remove(id);
        Ok(())
    }
    async fn list_by_owner(&self, owner_id: &str) -> Result<Vec<Todo>, DomainError> {
        if self.fail {
            return Err(DomainError::validation("todo list err"));
        }
        let mut items: Vec<Todo> = self
            .storage
            .lock()
            .unwrap()
            .values()
            .filter(|t| t.owner_id == owner_id)
            .cloned()
            .collect();
        items.sort_by_key(|t| (t.sort_order, t.id.clone()));
        Ok(items)
    }
    async fn list_by_owners(&self, owner_ids: &[&str]) -> Result<Vec<Todo>, DomainError> {
        let mut items: Vec<Todo> = self
            .storage
            .lock()
            .unwrap()
            .values()
            .filter(|t| owner_ids.contains(&t.owner_id.as_str()))
            .cloned()
            .collect();
        items.sort_by_key(|t| (t.sort_order, t.id.clone()));
        Ok(items)
    }
}

pub struct FakeRagPort;

#[async_trait]
impl RAGContextPort for FakeRagPort {
    async fn retrieve_context(
        &self,
        project_id: &str,
        query: &str,
        scope: &str,
        _top_k: usize,
    ) -> Result<Vec<serde_json::Value>, DomainError> {
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
    ) -> Result<serde_json::Value, DomainError> {
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

pub struct FakeAnalyticsRepo {
    pub fail: bool,
}

#[async_trait]
impl AnalyticsRepositoryPort for FakeAnalyticsRepo {
    async fn get_cross_reference_matrix(
        &self,
        _project_id: &str,
    ) -> Result<CrossRefMatrixDto, DomainError> {
        if self.fail {
            return Err(DomainError::validation("matrix err"));
        }
        Ok(CrossRefMatrixDto {
            chapters: vec![ChapterHeaderDto {
                id: "c1".into(),
                title: "Ch 1".into(),
                volume_id: None,
                volume_title: None,
                sort_order: 1,
                word_count: 100,
            }],
            entities: vec![],
            absence_warnings: vec![],
        })
    }

    async fn get_timeline_inspector_data(
        &self,
        _project_id: &str,
    ) -> Result<TimelineInspectorDto, DomainError> {
        if self.fail {
            return Err(DomainError::validation("inspector err"));
        }
        Ok(TimelineInspectorDto {
            events: vec![
                TimelineInspectorEventNode {
                    event_id: "e1".into(),
                    title: "Ev 1".into(),
                    description: None,
                    m_abs: 10,
                    calendar_id: "cal1".into(),
                    participants: vec![],
                    reveals: vec![
                        TimelineRevealLink {
                            chapter_id: "c1".into(),
                            chapter_title: "Ch 1".into(),
                            chapter_sort_order: 1,
                            pov_id: None,
                            kind: "direct".into(),
                            block_id: None,
                            is_anachronism: false,
                        },
                        TimelineRevealLink {
                            chapter_id: "c5".into(),
                            chapter_title: "Ch 5".into(),
                            chapter_sort_order: 5,
                            pov_id: None,
                            kind: "flashback".into(),
                            block_id: None,
                            is_anachronism: true,
                        },
                    ],
                    kind: None,
                    location_id: None,
                    parent_id: None,
                },
                TimelineInspectorEventNode {
                    event_id: "e2".into(),
                    title: "Ev 2 (future)".into(),
                    description: None,
                    m_abs: 20,
                    calendar_id: "cal1".into(),
                    participants: vec![],
                    reveals: vec![TimelineRevealLink {
                        chapter_id: "c6".into(),
                        chapter_title: "Ch 6".into(),
                        chapter_sort_order: 6,
                        pov_id: None,
                        kind: "direct".into(),
                        block_id: None,
                        is_anachronism: false,
                    }],
                    kind: None,
                    location_id: None,
                    parent_id: None,
                },
            ],
            chapters: vec![
                ChapterHeaderDto {
                    id: "c1".into(),
                    title: "Ch 1".into(),
                    volume_id: None,
                    volume_title: None,
                    sort_order: 1,
                    word_count: 100,
                },
                ChapterHeaderDto {
                    id: "c5".into(),
                    title: "Ch 5".into(),
                    volume_id: None,
                    volume_title: None,
                    sort_order: 5,
                    word_count: 200,
                },
            ],
            entity_swimlanes: vec![],
            detected_crossings: 1,
        })
    }

    async fn get_character_journey(
        &self,
        _project_id: &str,
        entity_id: &str,
    ) -> Result<CharacterJourneyDto, DomainError> {
        if self.fail {
            return Err(DomainError::validation(entity_id));
        }
        Ok(CharacterJourneyDto {
            entity_id: entity_id.into(),
            entity_name: "Hero".into(),
            entity_type: "character".into(),
            attributes: serde_json::json!({}),
            appearances: vec![],
            events: vec![],
            relations: vec![],
            promises: vec![],
        })
    }

    async fn get_multi_character_journey(
        &self,
        _project_id: &str,
        entity_ids: &[String],
        mode: JourneyFilterMode,
    ) -> Result<MultiJourneyResponseDto, DomainError> {
        if self.fail {
            return Err(DomainError::validation("multi err"));
        }
        Ok(MultiJourneyResponseDto {
            total_scenes: 0,
            filter_mode: mode,
            requested_entity_ids: entity_ids.to_vec(),
            scenes: vec![],
        })
    }

    async fn get_item_tracker(&self, _project_id: &str) -> Result<ItemTrackerDto, DomainError> {
        if self.fail {
            return Err(DomainError::validation("tracker err"));
        }
        Ok(ItemTrackerDto {
            summary: ItemTrackerSummaryDto {
                total_items: 1,
                active_count: 1,
                sleeping_count: 0,
                forgotten_count: 0,
                destroyed_count: 0,
            },
            items: vec![],
        })
    }

    async fn get_item_journey(
        &self,
        _project_id: &str,
        item_id: &str,
    ) -> Result<ItemJourneyDto, DomainError> {
        if self.fail {
            return Err(DomainError::validation(item_id));
        }
        Ok(ItemJourneyDto {
            item_id: item_id.into(),
            item_name: "Sword".into(),
            item_type: "item".into(),
            status_category: "active".into(),
            nodes: vec![],
        })
    }
}

#[derive(Default, Clone, Debug)]
pub struct LocalTestAiMock;

impl HardwareDetectorPort for LocalTestAiMock {
    fn get_hardware_info(&self) -> HardwareInfo {
        HardwareInfo {
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
    ) -> Vec<MemoryEstimation> {
        vec![MemoryEstimation {
            quant_name: "Q4_K_M".to_string(),
            estimated_vram_gb: 4.5,
            status: "ok".to_string(),
            is_recommended: true,
            size_gb: 4.0,
        }]
    }
    fn get_recommended_local_models(&self) -> Vec<RecommendedModelCard> {
        (1..=3)
            .map(|i| RecommendedModelCard {
                id: format!("model_{i}"),
                name: format!("Model {i}"),
                tagline: "Fast".to_string(),
                description: "Test".to_string(),
                parameters: "7B".to_string(),
                recommended_quant: "Q4_K_M".to_string(),
                size_gb: 4.5,
                repo_id: format!("test/m{i}"),
                filename: format!("m{i}.gguf"),
                tags: vec![],
                license_name: "Apache-2.0".to_string(),
                is_commercial_allowed: true,
            })
            .collect()
    }
}

impl LocalModelManagerPort for LocalTestAiMock {
    fn list_installed(&self) -> Result<Vec<InstalledModelInfo>, DomainError> {
        Ok(vec![])
    }
    fn load_model(&self, _filename: &str) -> Result<String, DomainError> {
        Ok("Loaded".to_string())
    }
    fn unload_model(&self, _filename: &str) -> Result<String, DomainError> {
        Ok("Unloaded".to_string())
    }
    fn unload_all(&self) -> Result<String, DomainError> {
        Ok("All unloaded".to_string())
    }
    fn delete_model(&self, _filename: &str) -> Result<String, DomainError> {
        Ok("Deleted".to_string())
    }
}

impl PermissionsPort for LocalTestAiMock {
    fn get_tool_permissions_catalog(&self) -> Vec<ToolPermissionConfig> {
        (1..=5)
            .map(|i| ToolPermissionConfig {
                id: format!("tool_{i}"),
                name: format!("Tool {i}"),
                description: format!("Desc {i}"),
                category: ToolCategory::Read,
                risk: RiskLevel::Low,
                default_level: PermissionLevel::Allow,
                user_level: None,
            })
            .collect()
    }
    fn save_tool_permission(&self, _tool_id: &str, _level: &str) -> Result<(), DomainError> {
        Ok(())
    }
    fn save_all_tool_permissions(
        &self,
        _permissions: &HashMap<String, String>,
    ) -> Result<(), DomainError> {
        Ok(())
    }
}
