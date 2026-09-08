use std::collections::HashSet;
use std::sync::Arc;
use tokio::task::JoinSet;
use worldwiki_domain::ai::{
    CitationItem, ResearchClaim, ResearchEvent, ResearchMode, ResearchPolicy,
    WebEvidence, WebPageEntity,
};
use worldwiki_ports::ai::WebResearchPort;
use super::ranker::SourceRanker;
use super::stopping::StoppingCriteriaEvaluator;

pub struct ResearchOrchestrator {
    web_port: Arc<dyn WebResearchPort>,
    policy: ResearchPolicy,
}

impl ResearchOrchestrator {
    pub fn new(web_port: Arc<dyn WebResearchPort>, policy: Option<ResearchPolicy>) -> Self {
        Self {
            web_port,
            policy: policy.unwrap_or_default(),
        }
    }

    /// Запуск оркестрации исследовательского цикла
    pub async fn execute_research<F>(
        &self,
        project_id: &str,
        _conversation_id: &str,
        _user_message_id: &str,
        objective: &str,
        mode: ResearchMode,
        mut on_event: F,
    ) -> Result<(Vec<WebEvidence>, Vec<CitationItem>), String>
    where
        F: FnMut(ResearchEvent),
    {
        on_event(ResearchEvent::Planning {
            objective: objective.to_string(),
        });

        let mut all_evidences: Vec<WebEvidence> = Vec::new();
        let mut all_pages: Vec<WebPageEntity> = Vec::new();
        let claims: Vec<ResearchClaim> = Vec::new();
        let mut seen_domains: HashSet<String> = HashSet::new();
        let mut round = 0;

        let query = objective.to_string();

        while round < 4 {
            round += 1;

            on_event(ResearchEvent::SearchStarted {
                query: query.clone(),
                round,
            });

            let search_limit = match mode {
                ResearchMode::Direct => 4,
                ResearchMode::Research => 10,
                ResearchMode::DeepResearch => 20,
            };

            let hits = self.web_port.search_duckduckgo(&query, search_limit).await.unwrap_or_default();
            on_event(ResearchEvent::SearchCompleted {
                hits_count: hits.len(),
            });

            if hits.is_empty() {
                break;
            }

            // Параллельная загрузка найденных страниц
            let mut join_set = JoinSet::new();
            for hit in hits {
                let port = self.web_port.clone();
                join_set.spawn(async move {
                    port.fetch_page(&hit.url).await
                });
            }

            let mut fetched_pages = Vec::new();
            while let Some(res) = join_set.join_next().await {
                if let Ok(Ok(page)) = res {
                    seen_domains.insert(page.domain.clone());
                    fetched_pages.push(page);
                }
            }

            // Domain Diversity & Ranking
            let ranked_pages = SourceRanker::rank_pages(fetched_pages, &self.policy);
            let fetched_domains: Vec<String> = ranked_pages.iter().map(|p| p.domain.clone()).collect();

            on_event(ResearchEvent::PagesFetched {
                count: ranked_pages.len(),
                domains: fetched_domains,
            });

            // Извлечение чанков доказательств
            for page in &ranked_pages {
                let chunks = extract_evidence_from_page(page, "page_temp", project_id);
                all_evidences.extend(chunks);
            }
            all_pages.extend(ranked_pages);

            all_evidences = SourceRanker::deduplicate_evidences(all_evidences);

            on_event(ResearchEvent::EvidenceExtracted {
                count: all_evidences.len(),
            });

            // Проверка критериев остановки
            let should_stop = StoppingCriteriaEvaluator::should_stop(
                &mode,
                round,
                &claims,
                seen_domains.len(),
                0.0,
                &self.policy,
            );

            if should_stop {
                break;
            }
        }

        on_event(ResearchEvent::Synthesizing);

        // Генерация структурных цитат из лучших evidence чанков
        let mut citations = Vec::new();
        for (idx, ev) in all_evidences.iter().take(8).enumerate() {
            let page_match = all_pages.iter().find(|p| p.url == ev.page_id || ev.page_id == "page_temp");
            let domain = page_match.map(|p| p.domain.clone()).unwrap_or_else(|| "web.source".to_string());
            let title = page_match.and_then(|p| p.title.clone()).unwrap_or_else(|| domain.clone());
            let url = page_match.map(|p| p.url.clone()).unwrap_or_else(|| format!("https://{}", domain));

            citations.push(CitationItem {
                index: idx + 1,
                evidence_id: ev.id.clone().unwrap_or_else(|| format!("ev_{}", idx + 1)),
                page_id: page_match.and_then(|p| p.id.clone()).unwrap_or_else(|| "page_1".to_string()),
                url,
                domain,
                title,
                claim_text: ev.text.chars().take(80).collect(),
                excerpt: ev.text.clone(),
            });
        }

        on_event(ResearchEvent::Finished {
            citations_count: citations.len(),
        });

        Ok((all_evidences, citations))
    }
}

fn extract_evidence_from_page(
    page: &WebPageEntity,
    page_id: &str,
    project_id: &str,
) -> Vec<WebEvidence> {
    let mut chunks = Vec::new();
    let mut offset = 0;
    let mut index = 0;

    for paragraph in page.content.split("\n\n") {
        let trimmed = paragraph.trim();
        if trimmed.len() < 40 {
            offset += paragraph.len() + 2;
            continue;
        }

        chunks.push(WebEvidence {
            id: None,
            page_id: page_id.to_string(),
            project_id: project_id.to_string(),
            chunk_index: index,
            text: trimmed.to_string(),
            start_offset: offset,
            end_offset: offset + trimmed.len(),
            simhash: None,
            metadata: None,
            created_at: None,
        });

        index += 1;
        offset += paragraph.len() + 2;
    }

    chunks
}
