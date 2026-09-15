use crate::rules::Violation;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ViolationCluster {
    pub cluster_id: usize,
    pub label: String,
    pub count: usize,
    pub rule_ids: Vec<String>,
    pub sample_violations: Vec<Violation>,
    pub explanation: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClusterAnalysisReport {
    pub total_violations: usize,
    pub total_clusters: usize,
    pub noise_count: usize,
    pub clusters: Vec<ViolationCluster>,
}
