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

        let mut sample_violations = Vec::new();
        let mut sampled_rules = std::collections::HashSet::new();

        // 1. Pick at least one representative sample for each distinct rule in the cluster
        for v in &items {
            if sampled_rules.insert(v.rule_id.clone()) {
                sample_violations.push(v.clone());
                if sample_violations.len() >= 5 {
                    break;
                }
            }
        }

        // 2. If we have fewer than 3 samples, fill up to 3 with remaining violations
        if sample_violations.len() < 3 {
            for v in &items {
                if !sample_violations.iter().any(|s| s.fingerprint == v.fingerprint && s.line == v.line && s.file == v.file) {
                    sample_violations.push(v.clone());
                    if sample_violations.len() >= 3 {
                        break;
                    }
                }
            }
        }

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

#[cfg(test)]
mod tests {
    use super::*;
    use cerberus_domain::{Category, Severity, Violation};
    use cerberus_ports::{ClustererPort, VectorEmbedderPort};
    use std::path::PathBuf;
    use std::sync::Arc;

    struct MockEmbedder {
        fail: bool,
    }

    impl VectorEmbedderPort for MockEmbedder {
        fn dimension(&self) -> usize {
            3
        }

        fn embed_texts(&self, texts: &[String]) -> Result<Vec<Vec<f32>>, String> {
            if self.fail {
                return Err("Mock embedder intentional failure".into());
            }
            Ok(texts.iter().map(|_| vec![0.1, 0.2, 0.3]).collect())
        }
    }

    struct MockClusterer {
        fail: bool,
        assignments: Vec<Option<usize>>,
    }

    impl ClustererPort for MockClusterer {
        fn cluster(
            &self,
            _embeddings: &[Vec<f32>],
            _eps: f32,
            _min_points: usize,
        ) -> Result<Vec<Option<usize>>, String> {
            if self.fail {
                return Err("Mock clusterer intentional failure".into());
            }
            Ok(self.assignments.clone())
        }
    }

    fn make_test_violation(rule_id: &str, line: usize) -> Violation {
        Violation {
            rule_id: rule_id.to_string(),
            rule_version: "1.0".to_string(),
            category: Category::Architecture,
            severity: Severity::Deny,
            file: PathBuf::from(format!("src/{}.rs", rule_id.to_lowercase())),
            line,
            column: 1,
            symbol: format!("sym_{}", rule_id),
            snippet: format!("// snippet for {}", rule_id),
            message: format!("Violation of {}", rule_id),
            remediation: format!("Fix {}", rule_id),
            fingerprint: format!("fp_{}_{}", rule_id, line),
        }
    }

    #[test]
    fn test_explain_clusters_new_positive() {
        let embedder = Arc::new(MockEmbedder { fail: false });
        let clusterer = Arc::new(MockClusterer {
            fail: false,
            assignments: vec![Some(0), Some(0)],
        });

        let use_case = ExplainClustersUseCase::new(embedder.clone(), clusterer);
        assert_eq!(embedder.dimension(), 3);
        assert_eq!(use_case.eps, 0.836);
        assert_eq!(use_case.min_points, 5);

        let v1 = make_test_violation("ARCH-001", 10);
        let v2 = make_test_violation("ARCH-002", 20);
        let violations = vec![v1, v2];

        let report = use_case.execute(&violations).expect("Should succeed");
        assert_eq!(report.total_violations, 2);
        assert_eq!(report.total_clusters, 1);
        assert_eq!(report.noise_count, 0);
        assert_eq!(report.clusters.len(), 1);
        assert_eq!(report.clusters[0].cluster_id, 0);
        assert_eq!(report.clusters[0].count, 2);
        assert_eq!(report.clusters[0].rule_ids, vec!["ARCH-001", "ARCH-002"]);
    }

    #[test]
    fn test_explain_clusters_with_params_positive() {
        let embedder = Arc::new(MockEmbedder { fail: false });
        let clusterer = Arc::new(MockClusterer {
            fail: false,
            assignments: vec![Some(1), None],
        });

        let use_case = ExplainClustersUseCase::with_params(embedder, clusterer, 0.42, 3);
        assert_eq!(use_case.eps, 0.42);
        assert_eq!(use_case.min_points, 3);

        let v1 = make_test_violation("SEC-001", 5);
        let v2 = make_test_violation("SEC-002", 15);
        let violations = vec![v1, v2];

        let report = use_case.execute(&violations).expect("Should succeed");
        assert_eq!(report.total_violations, 2);
        assert_eq!(report.total_clusters, 1);
        assert_eq!(report.noise_count, 1);
        assert_eq!(report.clusters.len(), 1);
        assert_eq!(report.clusters[0].cluster_id, 1);
        assert_eq!(report.clusters[0].count, 1);
    }

    #[test]
    fn test_explain_clusters_empty_violations() {
        let embedder = Arc::new(MockEmbedder { fail: false });
        let clusterer = Arc::new(MockClusterer {
            fail: false,
            assignments: vec![],
        });

        let use_case = ExplainClustersUseCase::new(embedder, clusterer);
        let report = use_case.execute(&[]).expect("Empty violations should return Ok report");
        assert_eq!(report.total_violations, 0);
        assert_eq!(report.total_clusters, 0);
        assert_eq!(report.noise_count, 0);
        assert!(report.clusters.is_empty());
    }

    #[test]
    fn test_explain_clusters_embedder_failure_negative() {
        let embedder = Arc::new(MockEmbedder { fail: true });
        let clusterer = Arc::new(MockClusterer {
            fail: false,
            assignments: vec![Some(0)],
        });

        let use_case = ExplainClustersUseCase::new(embedder, clusterer);
        let violations = vec![make_test_violation("ARCH-001", 1)];
        let result = use_case.execute(&violations);
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("Mock embedder intentional failure"));
    }

    #[test]
    fn test_explain_clusters_clusterer_failure_negative() {
        let embedder = Arc::new(MockEmbedder { fail: false });
        let clusterer = Arc::new(MockClusterer {
            fail: true,
            assignments: vec![],
        });

        let use_case = ExplainClustersUseCase::new(embedder, clusterer);
        let violations = vec![make_test_violation("ARCH-001", 1)];
        let result = use_case.execute(&violations);
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("Mock clusterer intentional failure"));
    }

    #[test]
    fn test_explain_clusters_many_rules_break_branch() {
        // Cluster with 6 distinct rules to hit `if sample_violations.len() >= 5 { break; }`
        let violations = vec![
            make_test_violation("RULE-A", 1),
            make_test_violation("RULE-B", 2),
            make_test_violation("RULE-C", 3),
            make_test_violation("RULE-D", 4),
            make_test_violation("RULE-E", 5),
            make_test_violation("RULE-F", 6),
            make_test_violation("RULE-G", 7),
        ];

        let embedder = Arc::new(MockEmbedder { fail: false });
        let clusterer = Arc::new(MockClusterer {
            fail: false,
            assignments: vec![Some(0); violations.len()],
        });

        let use_case = ExplainClustersUseCase::new(embedder, clusterer);
        let report = use_case.execute(&violations).expect("Should succeed");
        assert_eq!(report.total_clusters, 1);
        let cluster = &report.clusters[0];
        assert_eq!(cluster.sample_violations.len(), 5);
        assert_eq!(cluster.count, 7);
    }

    #[test]
    fn test_group_by_cluster_mismatched_assignments_bounds() {
        // Tests line 90: when assignments has more entries than violations slice
        let violations = vec![make_test_violation("RULE-1", 1)];
        let assignments = vec![Some(0), Some(0), None];

        let (cluster_map, noise_count) = group_by_cluster(&violations, assignments);
        assert_eq!(noise_count, 1);
        assert_eq!(cluster_map.get(&0).map(|v| v.len()), Some(1));
    }

    #[test]
    fn test_format_violation_prompt() {
        let v = make_test_violation("TEST-001", 42);
        let prompt = format_violation_prompt(&v);
        assert!(prompt.contains("Rule: TEST-001"));
        assert!(prompt.contains("42"));
        assert!(prompt.contains("sym_TEST-001"));
        assert!(prompt.contains("Fix TEST-001"));
    }
}
