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
        for file in &files {
            *tier_counts.entry(file.tier).or_insert(0) += 1;
            total_composite += file.t_composite;
        }

        let workspace_score = (total_composite / total_files as f64 * 10.0).round() / 10.0;
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
