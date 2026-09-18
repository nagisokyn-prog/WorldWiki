use serde::{Deserialize, Serialize};

fn default_min_recall() -> f64 {
    0.95
}

fn default_min_paradigm_precision() -> f64 {
    0.65
}

fn default_min_composite_precision() -> f64 {
    0.90
}

fn default_max_rss_mb() -> f64 {
    1200.0
}

/// Architecture-as-Config SLA definition for verification suites and quality gates.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct SlaConfig {
    #[serde(default = "default_min_recall")]
    pub min_recall: f64,
    #[serde(default = "default_min_paradigm_precision")]
    pub min_paradigm_precision: f64,
    #[serde(default = "default_min_composite_precision")]
    pub min_composite_precision: f64,
    #[serde(default = "default_max_rss_mb")]
    pub max_rss_mb: f64,
}

impl Default for SlaConfig {
    fn default() -> Self {
        Self {
            min_recall: 0.95,
            min_paradigm_precision: 0.65,
            min_composite_precision: 0.90,
            max_rss_mb: 1200.0,
        }
    }
}
