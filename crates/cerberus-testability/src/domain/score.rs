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

use super::archetype::TestabilityArchetype;

/// Отчет тестируемости для отдельного файла
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct FileTestabilityReport {
    pub file_path: String,
    pub layer: LayerContext,
    pub archetype: TestabilityArchetype,
    pub sloc: usize,
    pub t_unit: f64,
    pub t_integration: f64,
    pub t_composite: f64,
    pub tier: TestabilityTier,
    pub frictions: Vec<TestFriction>,
    pub triggers: Vec<String>,
}

/// Сводный отчет тестируемости по воркспейсу / проекту
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct WorkspaceTestabilityReport {
    pub schema_version: String,
    pub workspace_score: f64,
    pub workspace_tier: TestabilityTier,
    pub workspace_t_unit: f64,
    pub workspace_t_integration: f64,
    pub total_files: usize,
    pub tier_counts: HashMap<TestabilityTier, usize>,
    pub archetype_counts: HashMap<TestabilityArchetype, usize>,
    pub archetype_percentages: HashMap<TestabilityArchetype, f64>,
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

        let mut archetype_counts = HashMap::new();
        archetype_counts.insert(TestabilityArchetype::Pure, 0);
        archetype_counts.insert(TestabilityArchetype::Mockable, 0);
        archetype_counts.insert(TestabilityArchetype::IntBound, 0);
        archetype_counts.insert(TestabilityArchetype::Flaky, 0);
        archetype_counts.insert(TestabilityArchetype::Poisoned, 0);

        if total_files == 0 {
            let mut archetype_percentages = HashMap::new();
            archetype_percentages.insert(TestabilityArchetype::Pure, 100.0);
            archetype_percentages.insert(TestabilityArchetype::Mockable, 0.0);
            archetype_percentages.insert(TestabilityArchetype::IntBound, 0.0);
            archetype_percentages.insert(TestabilityArchetype::Flaky, 0.0);
            archetype_percentages.insert(TestabilityArchetype::Poisoned, 0.0);

            return Self {
                schema_version: "2.3.0".to_string(),
                workspace_score: 100.0,
                workspace_tier: TestabilityTier::S,
                workspace_t_unit: 100.0,
                workspace_t_integration: 100.0,
                total_files: 0,
                tier_counts,
                archetype_counts,
                archetype_percentages,
                files,
            };
        }

        for file in &files {
            *tier_counts.entry(file.tier).or_insert(0) += 1;
            *archetype_counts.entry(file.archetype).or_insert(0) += 1;
        }

        let n_f64 = total_files as f64;
        let p_pure = *archetype_counts.get(&TestabilityArchetype::Pure).unwrap_or(&0) as f64 / n_f64;
        let p_mock = *archetype_counts.get(&TestabilityArchetype::Mockable).unwrap_or(&0) as f64 / n_f64;
        let p_int = *archetype_counts.get(&TestabilityArchetype::IntBound).unwrap_or(&0) as f64 / n_f64;
        let p_flaky = *archetype_counts.get(&TestabilityArchetype::Flaky).unwrap_or(&0) as f64 / n_f64;
        let p_poison = *archetype_counts.get(&TestabilityArchetype::Poisoned).unwrap_or(&0) as f64 / n_f64;

        let mut archetype_percentages = HashMap::new();
        archetype_percentages.insert(TestabilityArchetype::Pure, (p_pure * 1000.0).round() / 10.0);
        archetype_percentages.insert(TestabilityArchetype::Mockable, (p_mock * 1000.0).round() / 10.0);
        archetype_percentages.insert(TestabilityArchetype::IntBound, (p_int * 1000.0).round() / 10.0);
        archetype_percentages.insert(TestabilityArchetype::Flaky, (p_flaky * 1000.0).round() / 10.0);
        archetype_percentages.insert(TestabilityArchetype::Poisoned, (p_poison * 1000.0).round() / 10.0);

        // Каноническая линейная агрегация воркспейса по формулам раздела 3
        let raw_t_unit = (1.00 * p_pure + 0.85 * p_mock + 0.25 * p_int + 0.15 * p_flaky + 0.05 * p_poison) * 100.0;
        let raw_t_integration = (1.00 * p_pure + 0.90 * p_mock + 0.85 * p_int + 0.35 * p_flaky + 0.15 * p_poison) * 100.0;
        let raw_workspace_score = 0.70 * raw_t_unit + 0.30 * raw_t_integration;

        let workspace_score = (raw_workspace_score * 10.0).round() / 10.0;
        let workspace_tier = TestabilityTier::from_score(workspace_score);
        let workspace_t_unit = (raw_t_unit * 10.0).round() / 10.0;
        let workspace_t_integration = (raw_t_integration * 10.0).round() / 10.0;

        Self {
            schema_version: "2.3.0".to_string(),
            workspace_score,
            workspace_tier,
            workspace_t_unit,
            workspace_t_integration,
            total_files,
            tier_counts,
            archetype_counts,
            archetype_percentages,
            files,
        }
    }
}
