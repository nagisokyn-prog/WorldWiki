use serde::{Deserialize, Serialize};
use super::factor::TestabilityFactor;
use super::layer::LayerContext;

/// Точка архитектурного сопротивления тестированию в коде
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct TestFriction {
    pub factor: TestabilityFactor,
    pub line: usize,
    pub column: usize,
    pub snippet: String,
    pub message: String,
}

/// Математический аппарат расчета демпфирования и штрафов
pub struct DampingMath;

impl DampingMath {
    /// Коэффициент масштаба размера файла δ(SLOC)
    /// δ(SLOC) = 1.0 / max(1.0, log10(SLOC / 30.0) + 1.0)
    #[must_use]
    pub fn calculate_sloc_damping(sloc: usize) -> f64 {
        if sloc <= 30 {
            return 1.0;
        }
        let ratio = sloc as f64 / 30.0;
        let log_val = ratio.log10();
        let denom = (log_val + 1.0).max(1.0);
        1.0 / denom
    }

    /// Расчет штрафа фактора (unit penalty, integration penalty)
    /// Penalty = w_k * ln(1 + n_k) * δ(SLOC)
    #[must_use]
    pub fn calculate_factor_penalty(
        factor: TestabilityFactor,
        count: usize,
        sloc: usize,
        layer: LayerContext,
    ) -> (f64, f64) {
        if count == 0 {
            return (0.0, 0.0);
        }

        let base_weight = factor.base_weight(layer);
        let compression = (1.0 + count as f64).ln();
        let damping = Self::calculate_sloc_damping(sloc);

        let raw_penalty = base_weight * compression * damping;

        let unit_penalty = raw_penalty * factor.unit_ratio();
        let integration_penalty = raw_penalty * factor.integration_ratio();

        (unit_penalty, integration_penalty)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_sloc_damping_curve() {
        assert_eq!(DampingMath::calculate_sloc_damping(10), 1.0);
        assert_eq!(DampingMath::calculate_sloc_damping(30), 1.0);
        assert!(DampingMath::calculate_sloc_damping(300) < 1.0);
    }

    #[test]
    fn test_calculate_factor_penalty_zero_count() {
        let (u, i) = DampingMath::calculate_factor_penalty(TestabilityFactor::F01HiddenAmbientIo, 0, 50, LayerContext::Domain);
        assert_eq!(u, 0.0);
        assert_eq!(i, 0.0);
    }

    #[test]
    fn test_calculate_factor_penalty_non_zero() {
        let (u, i) = DampingMath::calculate_factor_penalty(TestabilityFactor::F01HiddenAmbientIo, 2, 50, LayerContext::Domain);
        assert!(u > 0.0);
        assert!(i >= 0.0);
    }
}

