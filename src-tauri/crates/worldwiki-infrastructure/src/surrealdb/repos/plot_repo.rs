//! SurrealDB implementation of plot promise and task repositories.

use super::helpers::{clean_id, prepare_data_for_upsert};
use async_trait::async_trait;
use std::sync::Arc;
use surrealdb::Surreal;
use surrealdb::engine::local::Db;
use worldwiki_domain::errors::DomainError;
use worldwiki_domain::plot::PlotPromise;
use worldwiki_ports::repositories::PlotPromiseRepository;

pub struct SurrealPlotPromiseRepository {
    db: Arc<Surreal<Db>>,
}

impl SurrealPlotPromiseRepository {
    pub fn new(db: Arc<Surreal<Db>>) -> Self {
        Self { db }
    }
}

#[async_trait]
impl PlotPromiseRepository for SurrealPlotPromiseRepository {
    async fn get_by_id(&self, id: &str) -> Result<Option<PlotPromise>, DomainError> {
        let clean = clean_id("plot_promises", id);
        surreal_take_one!(self.db, "RETURN fn::get_plot_promise($id);", ("id", clean))
    }

    async fn save(&self, promise: &PlotPromise) -> Result<(), DomainError> {
        let clean = clean_id("plot_promises", &promise.id);
        let data = prepare_data_for_upsert(
            serde_json::to_value(promise).map_err(|e| DomainError::Validation(e.to_string()))?,
        );
        surreal_exec!(
            self.db,
            "RETURN fn::upsert_plot_promise($id, $data);",
            ("id", clean),
            ("data", data),
        )
    }

    async fn delete(&self, id: &str) -> Result<(), DomainError> {
        let clean = clean_id("plot_promises", id);
        surreal_exec!(self.db, "RETURN fn::delete_plot_promise($id);", ("id", clean))
    }

    async fn list_by_chapter(&self, chapter_id: &str) -> Result<Vec<PlotPromise>, DomainError> {
        let clean = clean_id("chapters", chapter_id);
        surreal_take_list!(
            self.db,
            "RETURN fn::list_plot_promises_by_chapter($chapter_id);",
            ("chapter_id", clean),
        )
    }

    async fn list_unresolved_by_volume(
        &self,
        volume_id: &str,
    ) -> Result<Vec<PlotPromise>, DomainError> {
        let clean_vol = clean_id("volumes", volume_id);
        surreal_take_list!(
            self.db,
            "RETURN fn::list_unresolved_promises_by_volume($volume);",
            ("volume", clean_vol),
        )
    }
}
