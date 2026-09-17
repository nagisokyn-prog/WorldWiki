use crate::synthetic_matrix::generator_trait::{ArchFixtureGenerator, GroundTruthManifest, SeededViolation};
use crate::synthetic_matrix::repo_builder::SyntheticRepoBuilder;

pub struct MicroservicesFixture;

impl ArchFixtureGenerator for MicroservicesFixture {
    fn name(&self) -> &'static str {
        "4. Microservices Workspace (Bounded Context Isolation)"
    }

    fn generate_clean(&self, builder: &mut SyntheticRepoBuilder) -> Result<(), String> {
        builder.write_cargo_workspace(&["shared-proto", "service-auth", "service-billing"], Some("final_boss"));

        builder.write_package_manifest("shared-proto", "shared_proto", &[]);
        builder.write_file("shared-proto/src/lib.rs", "pub struct AuthToken { pub token: String }\npub struct Invoice { pub id: u64 }");

        builder.write_package_manifest("service-auth", "service_auth", &[("shared-proto", Some("../shared-proto"))]);
        builder.write_file("service-auth/src/lib.rs", "use shared_proto::AuthToken;\npub fn authenticate() -> AuthToken { AuthToken { token: \"xyz\".into() } }");

        builder.write_package_manifest("service-billing", "service_billing", &[("shared-proto", Some("../shared-proto"))]);
        builder.write_file("service-billing/src/lib.rs", "use shared_proto::Invoice;\npub fn create_invoice() -> Invoice { Invoice { id: 1 } }");

        Ok(())
    }

    fn generate_seeded(&self, builder: &mut SyntheticRepoBuilder) -> Result<GroundTruthManifest, String> {
        builder.write_cargo_workspace(&["shared-proto", "service-auth", "service-billing"], Some("final_boss"));

        builder.write_package_manifest("shared-proto", "shared_proto", &[]);
        builder.write_file("shared-proto/src/lib.rs", "pub struct AuthToken;");

        // Seeded Violation: service-auth directly depends on service-billing (Bounded context leak)
        builder.write_package_manifest("service-auth", "service_auth", &[("shared-proto", Some("../shared-proto")), ("service-billing", Some("../service-billing"))]);
        builder.write_file("service-auth/src/lib.rs", "pub fn authenticate() {}");

        builder.write_package_manifest("service-billing", "service_billing", &[("shared-proto", Some("../shared-proto"))]);
        builder.write_file("service-billing/src/lib.rs", "pub fn create_invoice() {}");

        Ok(GroundTruthManifest {
            paradigm_name: self.name(),
            total_files: builder.total_files,
            approximate_sloc: builder.total_sloc,
            expected_violations: vec![
                SeededViolation {
                    rule_id: "ARCH-020".into(),
                    target_file_suffix: "service-auth/Cargo.toml".into(),
                    description: "Bounded context violation: service_auth cannot depend directly on service_billing".into(),
                },
            ],
        })
    }
}
