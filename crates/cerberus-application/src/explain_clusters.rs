use cerberus_domain::{ClusterAnalysisReport, Violation, ViolationCluster};
use cerberus_ports::{ClustererPort, VectorEmbedderPort};
use std::collections::HashMap;
use std::sync::Arc;

pub struct ExplainClustersUseCase {
    embedder: Arc<dyn VectorEmbedderPort>,
    clusterer: Arc<dyn ClustererPort>,
    eps: f32,
    min_points: usize,
}

impl ExplainClustersUseCase {
    pub fn new(embedder: Arc<dyn VectorEmbedderPort>, clusterer: Arc<dyn ClustererPort>) -> Self {
        Self {
            embedder,
            clusterer,
            eps: 0.836,
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

        let texts: Vec<String> = violations.iter().map(format_violation_prompt).collect();
        let embeddings = self.embedder.embed_texts(&texts)?;
        let assignments = self.clusterer.cluster(&embeddings, self.eps, self.min_points)?;

        let (cluster_map, noise_count) = group_by_cluster(violations, assignments);
        let clusters = build_cluster_summaries(cluster_map);
        let total_clusters = clusters.len();

        Ok(ClusterAnalysisReport {
            total_violations: violations.len(),
            total_clusters,
            noise_count,
            clusters,
        })
    }
}

fn format_violation_prompt(v: &Violation) -> String {
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
}

fn group_by_cluster(
    violations: &[Violation],
    assignments: Vec<Option<usize>>,
) -> (HashMap<usize, Vec<Violation>>, usize) {
    let mut cluster_map: HashMap<usize, Vec<Violation>> = HashMap::new();
    let mut noise_count = 0;

    for (idx, cluster_id_opt) in assignments.into_iter().enumerate() {
        if let Some(c_id) = cluster_id_opt {
            if let Some(violation) = violations.get(idx) {
                cluster_map.entry(c_id).or_default().push(violation.clone());
            }
        } else {
            noise_count += 1;
        }
    }

    (cluster_map, noise_count)
}

fn build_cluster_summaries(mut cluster_map: HashMap<usize, Vec<Violation>>) -> Vec<ViolationCluster> {
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
        let primary_rule = rule_ids.first().cloned().unwrap_or_default();
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

    clusters
}
