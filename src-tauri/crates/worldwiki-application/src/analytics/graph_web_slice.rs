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

        // 2. Compute bidirectional Bezier offsets (+6px / -6px)
        for i in 0..slice.edges.len() {
            let src = slice.edges[i].source_id.clone();
            let tgt = slice.edges[i].target_id.clone();
            
            let has_reverse = slice.edges.iter().enumerate().any(|(j, e)| {
                j != i && e.source_id == tgt && e.target_id == src
            });

            if has_reverse {
                slice.edges[i].offset_px = 6.0;
            } else {
                slice.edges[i].offset_px = 0.0;
            }
        }

        Ok(slice)
    }
}
