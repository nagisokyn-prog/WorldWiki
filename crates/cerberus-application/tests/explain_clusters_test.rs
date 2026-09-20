use cerberus_application::ExplainClustersUseCase;
use cerberus_domain::{Category, Severity, Violation};
use cerberus_ports::{ClustererPort, VectorEmbedderPort};
use std::path::PathBuf;
use std::sync::Arc;

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

    let embed_err_case = ExplainClustersUseCase::new(Arc::new(FailingEmbedder), Arc::new(DummyClusterer));
    assert!(embed_err_case.execute(&violations).is_err());

    let cluster_err_case = ExplainClustersUseCase::new(Arc::new(DummyEmbedder), Arc::new(FailingClusterer));
    assert!(cluster_err_case.execute(&violations).is_err());

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

#[test]
fn test_explain_clusters_samples_include_all_dominant_rules() {
    let violations = vec![
        Violation {
            rule_id: "CSS-002".into(),
            rule_version: "1.0".into(),
            category: Category::Convention,
            severity: Severity::Deny,
            file: PathBuf::from("app.css"),
            line: 1,
            column: 1,
            symbol: "taxonomy".into(),
            snippet: "tax".into(),
            message: "msg".into(),
            remediation: "rem".into(),
            fingerprint: "fp1".into(),
        },
        Violation {
            rule_id: "CSS-002".into(),
            rule_version: "1.0".into(),
            category: Category::Convention,
            severity: Severity::Deny,
            file: PathBuf::from("app.css"),
            line: 2,
            column: 1,
            symbol: "taxonomy".into(),
            snippet: "tax2".into(),
            message: "msg".into(),
            remediation: "rem".into(),
            fingerprint: "fp2".into(),
        },
        Violation {
            rule_id: "CSS-004".into(),
            rule_version: "1.0".into(),
            category: Category::Convention,
            severity: Severity::Deny,
            file: PathBuf::from("app.css"),
            line: 3,
            column: 1,
            symbol: "color".into(),
            snippet: "col".into(),
            message: "msg".into(),
            remediation: "rem".into(),
            fingerprint: "fp3".into(),
        },
        Violation {
            rule_id: "CSS-006".into(),
            rule_version: "1.0".into(),
            category: Category::Convention,
            severity: Severity::Deny,
            file: PathBuf::from("app.css"),
            line: 4,
            column: 1,
            symbol: "important".into(),
            snippet: "!imp".into(),
            message: "msg".into(),
            remediation: "rem".into(),
            fingerprint: "fp4".into(),
        },
    ];

    let use_case = ExplainClustersUseCase::new(Arc::new(DummyEmbedder), Arc::new(DummyClusterer));
    let report = use_case.execute(&violations).unwrap();
    assert_eq!(report.clusters.len(), 1);
    let sample_rules: Vec<String> = report.clusters[0].sample_violations.iter().map(|s| s.rule_id.clone()).collect();
    assert!(sample_rules.contains(&"CSS-002".to_string()));
    assert!(sample_rules.contains(&"CSS-004".to_string()));
    assert!(sample_rules.contains(&"CSS-006".to_string()));
}
