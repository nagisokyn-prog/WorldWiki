use syn::visit::Visit;
use crate::domain::archetype::TestabilityArchetype;
use crate::domain::layer::LayerContext;
use crate::domain::score::{FileTestabilityReport, TestabilityTier};
use crate::infrastructure::frontend_visitor::FrontendTestabilityScanner;
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

        let is_frontend = file_path.ends_with(".vue")
            || file_path.ends_with(".ts")
            || file_path.ends_with(".js")
            || file_path.ends_with(".tsx")
            || file_path.ends_with(".jsx");

        let (archetype, frictions, triggers) = if is_frontend {
            let scan = FrontendTestabilityScanner::scan_source(source_code, file_path, layer);
            (scan.archetype, scan.frictions, scan.triggers)
        } else {
            let parsed = syn::parse_file(source_code);
            match parsed {
                Ok(ref syn_file) => {
                    let mut visitor = TestabilityAstVisitor::new(layer, source_code.to_string());
                    visitor.visit_file(syn_file);
                    (visitor.archetype, visitor.frictions, visitor.triggers)
                }
                Err(_) => {
                    (TestabilityArchetype::Pure, Vec::new(), Vec::new())
                }
            }
        };

        let t_unit = archetype.t_unit();
        let t_integration = archetype.t_int();
        let t_composite = archetype.ti();
        let tier = TestabilityTier::from_score(t_composite);

        FileTestabilityReport {
            file_path: file_path.to_string(),
            layer,
            archetype,
            sloc,
            t_unit,
            t_integration,
            t_composite,
            tier,
            frictions,
            triggers,
        }
    }
}
