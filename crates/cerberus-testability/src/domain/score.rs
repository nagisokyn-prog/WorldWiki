use std::collections::HashMap;
use serde::{Deserialize, Serialize};
use super::friction::TestFriction;
use super::layer::LayerContext;

/// Качественный уровень (Tier) тестируемости
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum TestabilityTier {
    /// S: Идеально тестируемый код (90.0 ..= 100.0)
    S,
    /// A: Здоровый код с минимальным трением (80.0 .. < 90.0)
    A,
    /// B: Умеренные шероховатости изоляции (65.0 .. < 80.0)
    B,
    /// C: Затрудненная изоляция и побочные эффекты (50.0 .. < 65.0)
    C,
    /// D: Высокий риск гонок и жесткое связывание (30.0 .. < 50.0)
    D,
    /// F: Архитектурный хаос, нетестируемый спагетти (0.0 .. < 30.0)
    F,
}

impl TestabilityTier {
    #[must_use]
    pub const fn from_score(score: f64) -> Self {
        if score >= 90.0 {
            Self::S
        } else if score >= 80.0 {
            Self::A
        } else if score >= 65.0 {
            Self::B
        } else if score >= 50.0 {
            Self::C
        } else if score >= 30.0 {
            Self::D
        } else {
            Self::F
        }
    }

    #[must_use]
    pub const fn as_str(&self) -> &'static str {
        match self {
            Self::S => "S",
            Self::A => "A",
            Self::B => "B",
            Self::C => "C",
            Self::D => "D",
            Self::F => "F",
        }
    }
}

/// Отчет тестируемости для отдельного файла
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct FileTestabilityReport {
    pub file_path: String,
    pub layer: LayerContext,
    pub sloc: usize,
    pub t_unit: f64,
    pub t_integration: f64,
    pub t_composite: f64,
    pub tier: TestabilityTier,
    pub frictions: Vec<TestFriction>,
}

/// Сводный отчет тестируемости по воркспейсу / проекту
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct WorkspaceTestabilityReport {
    pub schema_version: String,
    pub workspace_score: f64,
    pub workspace_tier: TestabilityTier,
    pub total_files: usize,
    pub tier_counts: HashMap<TestabilityTier, usize>,
    pub files: Vec<FileTestabilityReport>,
}

impl WorkspaceTestabilityReport {
    #[must_use]
    pub fn new(files: Vec<FileTestabilityReport>) -> Self {
        let total_files = files.len();
        let mut tier_counts = HashMap::new();
        tier_counts.insert(TestabilityTier::S, 0);
        tier_counts.insert(TestabilityTier::A, 0);
        tier_counts.insert(TestabilityTier::B, 0);
        tier_counts.insert(TestabilityTier::C, 0);
        tier_counts.insert(TestabilityTier::D, 0);
        tier_counts.insert(TestabilityTier::F, 0);

        if total_files == 0 {
            return Self {
                schema_version: "2.0.0".to_string(),
                workspace_score: 100.0,
                workspace_tier: TestabilityTier::S,
                total_files: 0,
                tier_counts,
                files,
            };
        }

        let mut total_composite = 0.0;
        let mut min_composite = 100.0;
        let mut defective_files = 0;
        let mut max_category_weight = 1.0f64;

        for file in &files {
            *tier_counts.entry(file.tier).or_insert(0) += 1;
            total_composite += file.t_composite;
            if file.t_composite < min_composite {
                min_composite = file.t_composite;
            }
            if file.t_composite < 99.0 || !file.frictions.is_empty() {
                defective_files += 1;
                for f in &file.frictions {
                    let w = match f.factor {
                        super::factor::TestabilityFactor::F03SharedGlobalMutableState
                        | super::factor::TestabilityFactor::F02DirectOsFsAccess
                        | super::factor::TestabilityFactor::F04SideEffectingConstructor
                        | super::factor::TestabilityFactor::F06ConcreteCouplingInBoundary => 2.5,
                        super::factor::TestabilityFactor::F01HiddenAmbientIo
                        | super::factor::TestabilityFactor::Conc002OrphanConcurrency => 1.8,
                        super::factor::TestabilityFactor::F05HeavyMultiLineClosure => 1.0,
                    };
                    if w > max_category_weight {
                        max_category_weight = w;
                    }
                }
            }
        }

        let raw_workspace_score = if defective_files == 0 {
            100.0
        } else {
            let defect_rate = defective_files as f64 / total_files as f64;
            let mean_score = total_composite / total_files as f64;
            let base_penalty = 100.0 - mean_score;

            let density_weight = if defect_rate >= 0.25 {
                4.0
            } else if defect_rate >= 0.10 {
                2.5
            } else if defect_rate >= 0.05 {
                1.5
            } else {
                1.0
            };

            if defect_rate < 0.01 && defective_files <= 3 {
                // Isolated point defect in large repository: localized impact (Tier S: ~96.9)
                let isolated_penalty = ((100.0 - min_composite) * 0.04 * max_category_weight).clamp(0.5, 3.1);
                (100.0 - isolated_penalty).clamp(0.0, 100.0)
            } else {
                // Systemic defect density penalty
                let scaled_penalty = base_penalty * density_weight * (0.8 + 0.2 * max_category_weight);
                (100.0 - scaled_penalty).clamp(0.0, 100.0)
            }
        };

        let workspace_score = (raw_workspace_score * 10.0).round() / 10.0;
        let workspace_tier = TestabilityTier::from_score(workspace_score);

        Self {
            schema_version: "2.0.0".to_string(),
            workspace_score,
            workspace_tier,
            total_files,
            tier_counts,
            files,
        }
    }
}
