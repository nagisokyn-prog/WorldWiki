use crate::synthetic_matrix::generator_trait::{ArchFixtureGenerator, GroundTruthManifest, SeededViolation};
use crate::synthetic_matrix::repo_builder::SyntheticRepoBuilder;
use crate::synthetic_matrix::scale_helper::ScaleHelper;

pub struct ActorSystemFixture;

impl ArchFixtureGenerator for ActorSystemFixture {
    fn name(&self) -> &'static str {
        "9. Actor System (Shared-Nothing Concurrency)"
    }

    fn default_target_sloc(&self) -> usize {
        350_000
    }

    fn generate_clean(
        &self,
        builder: &mut SyntheticRepoBuilder,
        target_sloc: usize,
    ) -> Result<(), String> {
        builder.write_cargo_workspace(&["actor-app"], Some("actor"));
        builder.write_package_manifest("actor-app", "actor", &[]);

        let (mut files, _) =
            ScaleHelper::generate_rust_modules("actor-app", "actor", target_sloc, false);

        files.push((
            "actor-app/src/messages/mod.rs".into(),
            "pub enum Msg { Ping, Pong }\n".into(),
        ));
        files.push((
            "actor-app/src/worker/mod.rs".into(),
            "use crate::messages::Msg;\npub struct WorkerActor;\nimpl WorkerActor { pub fn handle(&mut self, _m: Msg) {} }\n".into(),
        ));

        builder.write_files_parallel(files);

        Ok(())
    }

    fn generate_seeded(
        &self,
        builder: &mut SyntheticRepoBuilder,
        target_sloc: usize,
    ) -> Result<GroundTruthManifest, String> {
        builder.write_cargo_workspace(&["actor-app"], Some("actor"));
        builder.write_package_manifest("actor-app", "actor", &[]);

        let (mut files, _) =
            ScaleHelper::generate_rust_modules("actor-app", "actor", target_sloc, true);

        files.push((
            "actor-app/src/worker/leaky_state.rs".into(),
            "static mut GLOBAL_ACTOR_STATE: u64 = 0;\npub fn mutate_shared() { unsafe { GLOBAL_ACTOR_STATE += 1; } }\n".into(),
        ));

        builder.write_files_parallel(files);

        Ok(GroundTruthManifest {
            paradigm_name: self.name(),
            total_files: builder.total_files,
            approximate_sloc: builder.total_sloc,
            expected_violations: vec![
                SeededViolation {
                    rule_id: "AI-008".into(),
                    target_file_suffix: "actor-app/src/worker/leaky_state.rs".into(),
                    description: "Unverified unsafe block without SAFETY comment".into(),
                },
                SeededViolation {
                    rule_id: "CONC-008".into(),
                    target_file_suffix: "actor-app/src/worker/leaky_state.rs".into(),
                    description: "Mutable static state violates actor encapsulation".into(),
                },
            ],
        })
    }
}
