use crate::synthetic_matrix::generator_trait::{ArchFixtureGenerator, GroundTruthManifest, SeededViolation};
use crate::synthetic_matrix::repo_builder::SyntheticRepoBuilder;

pub struct ServerlessFixture;

impl ArchFixtureGenerator for ServerlessFixture {
    fn name(&self) -> &'static str {
        "10. Serverless & FaaS (Stateless Ephemeral Handlers)"
    }

    fn generate_clean(&self, builder: &mut SyntheticRepoBuilder) -> Result<(), String> {
        builder.write_cargo_workspace(&["faas-app"], Some("serverless"));

        builder.write_package_manifest("faas-app", "function", &[]);
        builder.write_file("faas-app/src/lib.rs", "pub mod handler;\npub mod shared;");

        builder.write_file("faas-app/src/shared/mod.rs", "pub struct Request { pub id: String }");
        builder.write_file("faas-app/src/handler/mod.rs", "use crate::shared::Request;\npub fn handle_event(req: Request) -> String { req.id }");

        Ok(())
    }

    fn generate_seeded(&self, builder: &mut SyntheticRepoBuilder) -> Result<GroundTruthManifest, String> {
        self.generate_clean(builder)?;

        // Seeded Violation: FaaS handler holding unsafe mutable global state
        builder.write_file(
            "faas-app/src/handler/bad_state.rs",
            "static mut HANDLER_EXEC_COUNTER: u32 = 0;\npub fn handle_bad() { unsafe { HANDLER_EXEC_COUNTER += 1; } }",
        );

        Ok(GroundTruthManifest {
            paradigm_name: self.name(),
            total_files: builder.total_files,
            approximate_sloc: builder.total_sloc,
            expected_violations: vec![
                SeededViolation {
                    rule_id: "AI-008".into(),
                    target_file_suffix: "faas-app/src/handler/bad_state.rs".into(),
                    description: "Unverified unsafe state mutation in serverless handler".into(),
                },
            ],
        })
    }
}
