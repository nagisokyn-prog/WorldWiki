pub mod arc_services;

pub use arc_services::StoryArcServices;
use std::sync::Arc;
use serde::{Deserialize, Serialize};
use worldwiki_domain::plot::{PlotPromise, Plan};
use worldwiki_ports::repositories::{PlotPromiseRepository, PlanRepository};
use worldwiki_ports::events::{EventPublisherPort, EventPublisherExt, PlotPromiseUpdatedEvent};
use crate::errors::ApplicationError;
use chrono::Utc;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VolumeAuditReport {
    pub volume_id: String,
    pub has_blockers: bool,
    pub pending_plans_count: usize,
    pub pending_plans: Vec<Plan>,
    pub unresolved_promises_count: usize,
    pub unresolved_promises: Vec<PlotPromise>,
}

pub struct PlotServices {
    pub promise_repo: Arc<dyn PlotPromiseRepository>,
    pub plan_repo: Arc<dyn PlanRepository>,
    pub events: Arc<dyn EventPublisherPort>,
}

impl PlotServices {
    pub fn new(
        promise_repo: Arc<dyn PlotPromiseRepository>,
        plan_repo: Arc<dyn PlanRepository>,
        events: Arc<dyn EventPublisherPort>,
    ) -> Self {
        Self {
            promise_repo,
            plan_repo,
            events,
        }
    }

    pub async fn plant_promise(&self, promise: &PlotPromise) -> Result<(), ApplicationError> {
        self.promise_repo.save(promise).await?;
        self.events
            .publish(PlotPromiseUpdatedEvent {
                promise_id: promise.id.clone(),
                status: "planted".to_string(),
                timestamp: Utc::now().timestamp(),
            })
            .await?;
        Ok(())
    }

    pub async fn complete_plan(&self, plan_id: &str) -> Result<(), ApplicationError> {
        if let Some(mut plan) = self.plan_repo.get_by_id(plan_id).await? {
            plan.complete();
            self.plan_repo.save(&plan).await?;
            Ok(())
        } else {
            Err(ApplicationError::NotFound(format!("Plan {plan_id} not found")))
        }
    }

    pub async fn audit_volume(&self, volume_id: &str) -> Result<VolumeAuditReport, ApplicationError> {
        let pending_plans = self.plan_repo.list_pending_by_volume(volume_id).await?;
        let unresolved_promises = self.promise_repo.list_unresolved_by_volume(volume_id).await?;

        let has_blockers = !pending_plans.is_empty() || !unresolved_promises.is_empty();

        Ok(VolumeAuditReport {
            volume_id: volume_id.to_string(),
            has_blockers,
            pending_plans_count: pending_plans.len(),
            pending_plans,
            unresolved_promises_count: unresolved_promises.len(),
            unresolved_promises,
        })
    }
}
