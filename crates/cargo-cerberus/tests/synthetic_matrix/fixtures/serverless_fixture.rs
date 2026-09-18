use crate::synthetic_matrix::generator_trait::{ArchFixtureGenerator, GroundTruthManifest, SeededViolation};
use crate::synthetic_matrix::repo_builder::SyntheticRepoBuilder;
use crate::synthetic_matrix::scale_helper::ScaleHelper;

pub struct ServerlessFixture;

impl ArchFixtureGenerator for ServerlessFixture {
    fn name(&self) -> &'static str {
        "10. Serverless & FaaS (Stateless Ephemeral Handlers)"
    }

    fn default_target_sloc(&self) -> usize {
        350_000
    }

    fn generate_clean(
        &self,
        builder: &mut SyntheticRepoBuilder,
        target_sloc: usize,
    ) -> Result<(), String> {
        builder.write_cargo_workspace(&["faas-app"], Some("serverless"));
        builder.write_package_manifest("faas-app", "function", &[]);

        let (mut files, _) =
            ScaleHelper::generate_rust_modules("faas-app", "function", target_sloc, false);

        files.push((
            "faas-app/src/shared/mod.rs".into(),
            "pub struct Request { pub id: String }\n".into(),
        ));
        files.push((
            "faas-app/src/handler/mod.rs".into(),
            "use crate::shared::Request;\npub fn handle_event(req: Request) -> String { req.id }\n".into(),
        ));

        builder.write_files_parallel(files);

        Ok(())
    }

    fn generate_seeded(
        &self,
        builder: &mut SyntheticRepoBuilder,
        target_sloc: usize,
    ) -> Result<GroundTruthManifest, String> {
        builder.write_cargo_workspace(&["faas-app"], Some("serverless"));
        builder.write_package_manifest("faas-app", "function", &[]);

        let (mut files, _) =
            ScaleHelper::generate_rust_modules("faas-app", "function", target_sloc, false);

        files.push((
            "faas-app/src/handler/bad_state.rs".into(),
            "static mut HANDLER_EXEC_COUNTER: u32 = 0;\npub fn handle_bad() { unsafe { HANDLER_EXEC_COUNTER += 1; } }\n".into(),
        ));

        builder.write_files_parallel(files);

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
                SeededViolation {
                    rule_id: "CONC-008".into(),
                    target_file_suffix: "faas-app/src/handler/bad_state.rs".into(),
                    description: "Mutable static state violates serverless statelessness".into(),
                },
            ],
        })
    }
}
