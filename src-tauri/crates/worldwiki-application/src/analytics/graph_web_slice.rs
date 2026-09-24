use std::sync::Arc;
use worldwiki_domain::analytics::GraphTimeSliceDto;
use worldwiki_ports::repositories::AnalyticsRepositoryPort;
use crate::errors::ApplicationError;

pub struct GraphWebSliceService {
    pub repo: Arc<dyn AnalyticsRepositoryPort>,
}

impl GraphWebSliceService {
    pub fn new(repo: Arc<dyn AnalyticsRepositoryPort>) -> Self {
        Self { repo }
    }

    pub async fn get_time_slice(
        &self,
        project_id: &str,
        reader_chapter_order: Option<i32>,
        m_abs_limit: Option<i64>,
    ) -> Result<GraphTimeSliceDto, ApplicationError> {
        let mut slice = self.repo.get_graph_time_slice(project_id).await?;

        // 1. Filter edges according to temporal criteria
        if let Some(limit) = reader_chapter_order {
            for edge in &mut slice.edges {
                if let Some(start_order) = edge.start_chapter_order {
                    edge.is_revealed_to_reader = start_order <= limit;
                }
            }
        }

        if let Some(m_abs) = m_abs_limit {
            slice.edges.retain(|e| {
                if let Some(start_m) = e.start_m_abs {
                    start_m <= m_abs
                } else {
                    true
                }
            });
        }

        // 2. Compute bidirectional Bezier offsets (+6px / 0px)
        let pairs: std::collections::HashSet<(String, String)> = slice
            .edges
            .iter()
            .map(|e| (e.source_id.clone(), e.target_id.clone()))
            .collect();

        for edge in &mut slice.edges {
            let reverse_key = (edge.target_id.clone(), edge.source_id.clone());
            if pairs.contains(&reverse_key) {
                edge.offset_px = 6.0;
            } else {
                edge.offset_px = 0.0;
            }
        }

        Ok(slice)
    }
}
