#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SeededViolation {
    pub rule_id: String,
    pub target_file_suffix: String,
    pub description: String,
}

#[derive(Debug, Clone, Default)]
#[allow(dead_code)]
pub struct GroundTruthManifest {
    pub paradigm_name: &'static str,
    pub total_files: usize,
    pub approximate_sloc: usize,
    pub expected_violations: Vec<SeededViolation>,
}

#[derive(Debug, Clone, Default)]
pub struct BenchmarkScorecardEntry {
    pub paradigm_name: String,
    pub total_files: usize,
    pub total_sloc: usize,
    pub duration_ms: f64,
    pub throughput_sloc_per_sec: f64,
    pub peak_rss_mb: f64,
    pub true_positives: usize,
    pub false_positives: usize,
    pub false_negatives: usize,
    pub recall: f64,
    pub precision: f64,
    pub f1_score: f64,
    pub testability_score: f64,
    pub testability_tier: String,
}

pub trait ArchFixtureGenerator: Send + Sync {
    fn name(&self) -> &'static str;
    fn default_target_sloc(&self) -> usize {
        150_000
    }
    fn generate_clean(
        &self,
        builder: &mut crate::synthetic_matrix::repo_builder::SyntheticRepoBuilder,
        target_sloc: usize,
    ) -> Result<(), String>;
    fn generate_seeded(
        &self,
        builder: &mut crate::synthetic_matrix::repo_builder::SyntheticRepoBuilder,
        target_sloc: usize,
    ) -> Result<GroundTruthManifest, String>;
}
