use arch_guard_domain::{ClusterAnalysisReport, Violation, ViolationCluster};
use arch_guard_ports::{ClustererPort, VectorEmbedderPort};
use std::collections::HashMap;
use std::sync::Arc;

pub struct ExplainClustersUseCase {
    embedder: Arc<dyn VectorEmbedderPort>,
    clusterer: Arc<dyn ClustererPort>,
    eps: f32,
    min_points: usize,
}

impl ExplainClustersUseCase {
    pub fn new(
        embedder: Arc<dyn VectorEmbedderPort>,
        clusterer: Arc<dyn ClustererPort>,
    ) -> Self {
        Self {
            embedder,
            clusterer,
            eps: 0.836, // sqrt(2 * 0.35) cosine-to-euclidean equivalent
            min_points: 5,
        }
    }

    pub fn with_params(
        embedder: Arc<dyn VectorEmbedderPort>,
        clusterer: Arc<dyn ClustererPort>,
        eps: f32,
        min_points: usize,
    ) -> Self {
        Self {
            embedder,
            clusterer,
            eps,
            min_points,
        }
    }

    pub fn execute(&self, violations: &[Violation]) -> Result<ClusterAnalysisReport, String> {
        if violations.is_empty() {
            return Ok(ClusterAnalysisReport {
                total_violations: 0,
                total_clusters: 0,
                noise_count: 0,
                clusters: Vec::new(),
            });
        }

        // 1. Format text representations according to 03_VECTOR_INTELLIGENCE.md template
        let texts: Vec<String> = violations
            .iter()
            .map(|v| {
                format!(
                    "Rule: {} (v{})\nCategory: {:?}\nSymbol: {}\nLocation: {}:{}\nMessage: {}\nCode Context:\n{}\nRemediation Intent: {}",
                    v.rule_id,
                    v.rule_version,
                    v.category,
                    v.symbol,
                    v.file.display(),
                    v.line,
                    v.message,
                    v.snippet.trim(),
                    v.remediation
                )
            })
            .collect();

        // 2. Generate vector embeddings
        let embeddings = self.embedder.embed_texts(&texts)?;

        // 3. Run DBSCAN clustering
        let assignments = self.clusterer.cluster(&embeddings, self.eps, self.min_points)?;

        // 4. Group by cluster ID
        let mut cluster_map: HashMap<usize, Vec<Violation>> = HashMap::new();
        let mut noise_count = 0;

        for (idx, cluster_id_opt) in assignments.into_iter().enumerate() {
            if let Some(c_id) = cluster_id_opt {
                cluster_map
                    .entry(c_id)
                    .or_default()
                    .push(violations[idx].clone());
            } else {
                noise_count += 1;
            }
        }

        // 5. Build cluster summaries
        let mut clusters = Vec::new();
        let mut sorted_cluster_ids: Vec<usize> = cluster_map.keys().copied().collect();
        sorted_cluster_ids.sort();

        for c_id in sorted_cluster_ids {
            let items = cluster_map.remove(&c_id).unwrap_or_default();
            let count = items.len();

            let mut rule_counts: HashMap<String, usize> = HashMap::new();
            for v in &items {
                *rule_counts.entry(v.rule_id.clone()).or_default() += 1;
            }

            let mut rule_ids: Vec<String> = rule_counts.into_keys().collect();
            rule_ids.sort();

            let sample_violations = items.iter().take(3).cloned().collect();
            let primary_rule = rule_ids.first().cloned().unwrap_or_else(|| "UNKNOWN".into());
            let label = format!("Cluster #{}: {} ({})", c_id, primary_rule, count);
            let explanation = format!(
                "Pervasive architectural pattern affecting {} locations. Dominant rule(s): {}.",
                count,
                rule_ids.join(", ")
            );

            clusters.push(ViolationCluster {
                cluster_id: c_id,
                label,
                count,
                rule_ids,
                sample_violations,
                explanation,
            });
        }

        let total_clusters = clusters.len();

        Ok(ClusterAnalysisReport {
            total_violations: violations.len(),
            total_clusters,
            noise_count,
            clusters,
        })
    }
}
