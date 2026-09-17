use crate::synthetic_matrix::generator_trait::{ArchFixtureGenerator, GroundTruthManifest, SeededViolation};
use crate::synthetic_matrix::repo_builder::SyntheticRepoBuilder;

pub struct CleanArchFixture;

impl ArchFixtureGenerator for CleanArchFixture {
    fn name(&self) -> &'static str {
        "3. Clean Architecture (Entities <- UseCases <- Controllers/Gateways)"
    }

    fn generate_clean(&self, builder: &mut SyntheticRepoBuilder) -> Result<(), String> {
        builder.write_cargo_workspace(&["entities-crate", "usecases-crate", "controllers-crate"], Some("clean"));

        builder.write_package_manifest("entities-crate", "entities", &[]);
        builder.write_file("entities-crate/src/lib.rs", "pub struct Product { pub id: u64, pub price: f64 }");

        builder.write_package_manifest("usecases-crate", "usecases", &[("entities-crate", Some("../entities-crate"))]);
        builder.write_file("usecases-crate/src/lib.rs", "use entities_crate::Product;\npub fn calculate_discount(p: &Product) -> f64 { p.price * 0.9 }");

        builder.write_package_manifest("controllers-crate", "controllers", &[("usecases-crate", Some("../usecases-crate")), ("entities-crate", Some("../entities-crate"))]);
        builder.write_file("controllers-crate/src/lib.rs", "use usecases_crate::calculate_discount;\npub fn handle_http_request() {}");

        Ok(())
    }

    fn generate_seeded(&self, builder: &mut SyntheticRepoBuilder) -> Result<GroundTruthManifest, String> {
        builder.write_cargo_workspace(&["entities-crate", "usecases-crate", "controllers-crate"], Some("clean"));

        // Seeded Violation: Entities depends on UseCases (inverting Clean Architecture Dependency Rule)
        builder.write_package_manifest("entities-crate", "entities", &[("usecases-crate", Some("../usecases-crate"))]);
        builder.write_file("entities-crate/src/lib.rs", "use usecases_crate::calculate_discount;\npub struct Product;");

        builder.write_package_manifest("usecases-crate", "usecases", &[]);
        builder.write_file("usecases-crate/src/lib.rs", "pub fn calculate_discount() {}");

        builder.write_package_manifest("controllers-crate", "controllers", &[("usecases-crate", Some("../usecases-crate"))]);
        builder.write_file("controllers-crate/src/lib.rs", "pub fn handle_http_request() {}");

        Ok(GroundTruthManifest {
            paradigm_name: self.name(),
            total_files: builder.total_files,
            approximate_sloc: builder.total_sloc,
            expected_violations: vec![
                SeededViolation {
                    rule_id: "ARCH-020".into(),
                    target_file_suffix: "entities-crate/Cargo.toml".into(),
                    description: "Layer 'entities' cannot depend on layer 'usecases'".into(),
                },
            ],
        })
    }
}
