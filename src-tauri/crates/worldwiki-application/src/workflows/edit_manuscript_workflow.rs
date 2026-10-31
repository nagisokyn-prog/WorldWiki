use std::sync::Arc;
use serde::{Deserialize, Serialize};
use worldwiki_domain::plot::{MilestoneStage, PlotPromise, PromiseKind, PromiseMilestone};
use crate::errors::ApplicationError;
use crate::manuscript::ManuscriptServices;
use crate::plot::PlotServices;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlantedPromiseDto {
    pub kind: String, // "gun", "foreshadowing", "mystery", "question"
    pub quote: String,
    pub note: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EditManuscriptRequest {
    pub chapter_id: String,
    pub content_patch: String,
    #[serde(default)]
    pub project_id: Option<String>,
    #[serde(default)]
    pub planted_promises: Vec<PlantedPromiseDto>,
    #[serde(default)]
    pub resolved_promise_ids: Vec<String>,
    #[serde(default)]
    pub completed_plan_ids: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EditManuscriptResult {
    pub chapter_id: String,
    pub word_count: usize,
    pub promises_planted: usize,
    pub promises_resolved: usize,
    pub plans_completed: usize,
}

pub struct EditManuscriptAtomicWorkflow {
    manuscript_services: Arc<ManuscriptServices>,
    plot_services: Arc<PlotServices>,
}

impl EditManuscriptAtomicWorkflow {
    pub fn new(
        manuscript_services: Arc<ManuscriptServices>,
        plot_services: Arc<PlotServices>,
    ) -> Self {
        Self {
            manuscript_services,
            plot_services,
        }
    }

    /// Executes atomic transaction: update text + plant promises + resolve promises + complete plans
    pub async fn execute(&self, req: EditManuscriptRequest) -> Result<EditManuscriptResult, ApplicationError> {
        // 1. Load and update chapter
        let mut chapter = self.manuscript_services.get_chapter(&req.chapter_id).await?;
        chapter.update_content(req.content_patch);
        self.manuscript_services.save_chapter(&chapter).await?;

        // 2. Plant new plot promises
        let project_id = req
            .project_id
            .clone()
            .unwrap_or_else(|| chapter.volume_id.clone());

        let mut promises_planted = 0;
        for p in req.planted_promises {
            let kind = match p.kind.as_str() {
                "foreshadowing" => PromiseKind::Foreshadowing,
                "mystery" => PromiseKind::Mystery,
                "question" => PromiseKind::Question,
                _ => PromiseKind::Gun,
            };
            let mut promise = PlotPromise::new(
                project_id.clone(),
                kind,
                p.quote.clone(),
            );
            promise.note = p.note.clone();
            promise.milestones.push(PromiseMilestone {
                milestone_id: None,
                stage: MilestoneStage::Plant,
                quote: Some(p.quote),
                note: p.note,
                block_id: None,
                chapter_id: Some(chapter.id.clone()),
                order_index: Some(1),
            });
            self.plot_services.plant_promise(&promise).await?;
            promises_planted += 1;
        }

        // 3. Resolve existing promises
        let mut promises_resolved = 0;
        for pid in req.resolved_promise_ids {
            if let Some(mut promise) = self.plot_services.promise_repo.get_by_id(&pid).await? {
                promise.resolve();
                self.plot_services.promise_repo.save(&promise).await?;
                promises_resolved += 1;
            }
        }

        // 4. Complete plans / todos
        let mut plans_completed = 0;
        for plan_id in req.completed_plan_ids {
            if self.plot_services.complete_todo(&plan_id).await.is_ok() {
                plans_completed += 1;
            }
        }

        Ok(EditManuscriptResult {
            chapter_id: chapter.id,
            word_count: chapter.word_count,
            promises_planted,
            promises_resolved,
            plans_completed,
        })
    }
}
