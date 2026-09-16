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

        let total_clusters = clusters.len();

        Ok(ClusterAnalysisReport {
            total_violations: violations.len(),
            total_clusters,
            noise_count,
            clusters,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use cerberus_domain::{Category, Severity};
    use std::path::PathBuf;

    struct DummyEmbedder;
    impl VectorEmbedderPort for DummyEmbedder {
        fn dimension(&self) -> usize {
            2
        }
        fn embed_texts(&self, texts: &[String]) -> Result<Vec<Vec<f32>>, String> {
            Ok(texts.iter().map(|_| vec![1.0, 0.0]).collect())
        }
    }

    struct DummyClusterer;
    impl ClustererPort for DummyClusterer {
        fn cluster(
            &self,
            embeddings: &[Vec<f32>],
            _eps: f32,
            _min_points: usize,
        ) -> Result<Vec<Option<usize>>, String> {
            Ok(embeddings.iter().map(|_| Some(0)).collect())
        }
    }

    #[test]
    fn test_explain_clusters_empty_and_populated() {
        let embedder = Arc::new(DummyEmbedder);
        let clusterer = Arc::new(DummyClusterer);
        let use_case = ExplainClustersUseCase::new(embedder.clone(), clusterer.clone());

        // 1. Empty violations
        let report_empty = use_case.execute(&[]).unwrap();
        assert_eq!(report_empty.total_violations, 0);
        assert_eq!(report_empty.total_clusters, 0);

        // 2. Populated violations
        let violations = vec![
            Violation {
                rule_id: "ARCH-001".into(),
                rule_version: "1.0".into(),
                category: Category::Architecture,
                severity: Severity::Deny,
                file: PathBuf::from("src/lib.rs"),
                line: 1,
                column: 1,
                symbol: "sym1".into(),
                snippet: "use tauri;".into(),
                message: "msg1".into(),
                remediation: "rem1".into(),
                fingerprint: "fp1".into(),
            },
            Violation {
                rule_id: "ARCH-001".into(),
                rule_version: "1.0".into(),
                category: Category::Architecture,
                severity: Severity::Deny,
                file: PathBuf::from("src/domain.rs"),
                line: 2,
                column: 1,
                symbol: "sym2".into(),
                snippet: "use tauri;".into(),
                message: "msg2".into(),
                remediation: "rem2".into(),
                fingerprint: "fp2".into(),
            },
        ];

        let custom_use_case = ExplainClustersUseCase::with_params(embedder, clusterer, 0.5, 2);
        let report = custom_use_case.execute(&violations).unwrap();
        assert_eq!(report.total_violations, 2);
        assert_eq!(report.total_clusters, 1);
        assert_eq!(report.clusters[0].count, 2);
    }

    struct FailingEmbedder;
    impl VectorEmbedderPort for FailingEmbedder {
        fn dimension(&self) -> usize { 2 }
        fn embed_texts(&self, _texts: &[String]) -> Result<Vec<Vec<f32>>, String> {
            Err("Embedding model failed".into())
        }
    }

    struct FailingClusterer;
    impl ClustererPort for FailingClusterer {
        fn cluster(&self, _embeddings: &[Vec<f32>], _eps: f32, _min_points: usize) -> Result<Vec<Option<usize>>, String> {
            Err("DBSCAN failed".into())
        }
    }

    #[test]
    fn test_explain_clusters_embedder_and_clusterer_errors() {
        let violations = vec![Violation {
            rule_id: "ARCH-001".into(),
            rule_version: "1.0".into(),
            category: Category::Architecture,
            severity: Severity::Deny,
            file: PathBuf::from("src/lib.rs"),
            line: 1,
            column: 1,
            symbol: "sym".into(),
            snippet: "code".into(),
            message: "msg".into(),
            remediation: "rem".into(),
            fingerprint: "fp".into(),
        }];

        // 1. Embedder error
        let embed_err_case = ExplainClustersUseCase::new(Arc::new(FailingEmbedder), Arc::new(DummyClusterer));
        assert!(embed_err_case.execute(&violations).is_err());

        // 2. Clusterer error
        let cluster_err_case = ExplainClustersUseCase::new(Arc::new(DummyEmbedder), Arc::new(FailingClusterer));
        assert!(cluster_err_case.execute(&violations).is_err());

        // 3. Dimension call
        assert_eq!(DummyEmbedder.dimension(), 2);
        assert_eq!(FailingEmbedder.dimension(), 2);
    }

    struct MixedClusterer;
    impl ClustererPort for MixedClusterer {
        fn cluster(&self, _embeddings: &[Vec<f32>], _eps: f32, _min_points: usize) -> Result<Vec<Option<usize>>, String> {
            Ok(vec![Some(0), None])
        }
    }

    #[test]
    fn test_explain_clusters_with_noise() {
        let violations = vec![
            Violation {
                rule_id: "ARCH-001".into(),
                rule_version: "1.0".into(),
                category: Category::Architecture,
                severity: Severity::Deny,
                file: PathBuf::from("src/lib.rs"),
                line: 1,
                column: 1,
                symbol: "sym1".into(),
                snippet: "code".into(),
                message: "msg".into(),
                remediation: "rem".into(),
                fingerprint: "fp1".into(),
            },
            Violation {
                rule_id: "ARCH-002".into(),
                rule_version: "1.0".into(),
                category: Category::Architecture,
                severity: Severity::Deny,
                file: PathBuf::from("src/app.rs"),
                line: 2,
                column: 1,
                symbol: "sym2".into(),
                snippet: "code".into(),
                message: "msg".into(),
                remediation: "rem".into(),
                fingerprint: "fp2".into(),
            },
        ];

        let use_case = ExplainClustersUseCase::new(Arc::new(DummyEmbedder), Arc::new(MixedClusterer));
        let report = use_case.execute(&violations).unwrap();
        assert_eq!(report.total_violations, 2);
        assert_eq!(report.total_clusters, 1);
        assert_eq!(report.noise_count, 1);
    }
}


