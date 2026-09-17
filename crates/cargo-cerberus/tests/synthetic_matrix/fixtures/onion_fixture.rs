use crate::synthetic_matrix::generator_trait::{ArchFixtureGenerator, GroundTruthManifest, SeededViolation};
use crate::synthetic_matrix::repo_builder::SyntheticRepoBuilder;

pub struct OnionFixture;

impl ArchFixtureGenerator for OnionFixture {
    fn name(&self) -> &'static str {
        "7. Onion Architecture (Core Zero-Dep Invariant)"
    }

    fn generate_clean(&self, builder: &mut SyntheticRepoBuilder) -> Result<(), String> {
        builder.write_cargo_workspace(&["onion-core", "onion-services", "onion-infra"], Some("onion"));

        builder.write_package_manifest("onion-core", "domain_core", &[]);
        builder.write_file("onion-core/src/lib.rs", "pub struct DomainEntity { pub id: u64 }");

        builder.write_package_manifest("onion-services", "domain_services", &[("onion-core", Some("../onion-core"))]);
        builder.write_file("onion-services/src/lib.rs", "use onion_core::DomainEntity;\npub fn process(e: &DomainEntity) {}");

        builder.write_package_manifest("onion-infra", "infra", &[("onion-core", Some("../onion-core")), ("onion-services", Some("../onion-services"))]);
        builder.write_file("onion-infra/src/lib.rs", "pub fn start_server() {}");

        Ok(())
    }

    fn generate_seeded(&self, builder: &mut SyntheticRepoBuilder) -> Result<GroundTruthManifest, String> {
        self.generate_clean(builder)?;

        // Seeded Violation: Onion Core imports forbidden external framework (ARCH-001)
        builder.write_file(
            "onion-core/src/leaky_core.rs",
            "use reqwest::Client;\npub fn external_http_in_core() {}",
        );

        Ok(GroundTruthManifest {
            paradigm_name: self.name(),
            total_files: builder.total_files,
            approximate_sloc: builder.total_sloc,
            expected_violations: vec![
                SeededViolation {
                    rule_id: "ARCH-001".into(),
                    target_file_suffix: "onion-core/src/leaky_core.rs".into(),
                    description: "Onion domain_core forbids external dependency 'reqwest'".into(),
                },
            ],
        })
    }
}
