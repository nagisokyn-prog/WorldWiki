use syn::visit::Visit;
use crate::domain::factor::TestabilityFactor;
use crate::domain::friction::{DampingMath, TestFriction};
use crate::domain::layer::LayerContext;
use crate::domain::score::{FileTestabilityReport, TestabilityTier};
use crate::infrastructure::syn_visitor::TestabilityAstVisitor;

pub struct ComputeTestabilityUseCase;

impl ComputeTestabilityUseCase {
    #[must_use]
    pub fn compute_for_source(
        file_path: &str,
        source_code: &str,
        layer: LayerContext,
    ) -> FileTestabilityReport {
        let sloc = source_code
            .lines()
            .filter(|line| {
                let trimmed = line.trim();
                !trimmed.is_empty() && !trimmed.starts_with("//") && !trimmed.starts_with("/*") && !trimmed.starts_with('*')
            })
            .count()
            .max(1);

        let parsed = syn::parse_file(source_code);
        let frictions = match parsed {
            Ok(ref syn_file) => {
                let mut visitor = TestabilityAstVisitor::new();
                visitor.visit_file(syn_file);
                visitor.frictions
            }
            Err(_) => Vec::new(),
        };

        // Подсчет количества каждого фактора
        let mut factor_counts = std::collections::HashMap::new();
        for friction in &frictions {
            *factor_counts.entry(friction.factor).or_insert(0) += 1;
        }

        let mut total_unit_penalty = 0.0;
        let mut total_int_penalty = 0.0;

        for (factor, count) in factor_counts {
            let (unit_p, int_p) = DampingMath::calculate_factor_penalty(factor, count, sloc, layer);
            total_unit_penalty += unit_p;
            total_int_penalty += int_p;
        }

        let t_unit = (100.0 - total_unit_penalty).clamp(0.0, 100.0);
        let t_integration = (100.0 - total_int_penalty).clamp(0.0, 100.0);

        let t_composite = (0.70 * t_unit + 0.30 * t_integration).clamp(0.0, 100.0);
        let t_composite_rounded = (t_composite * 10.0).round() / 10.0;
        let t_unit_rounded = (t_unit * 10.0).round() / 10.0;
        let t_integration_rounded = (t_integration * 10.0).round() / 10.0;

        let tier = TestabilityTier::from_score(t_composite_rounded);

        FileTestabilityReport {
            file_path: file_path.to_string(),
            layer,
            sloc,
            t_unit: t_unit_rounded,
            t_integration: t_integration_rounded,
            t_composite: t_composite_rounded,
            tier,
            frictions,
        }
    }
}
