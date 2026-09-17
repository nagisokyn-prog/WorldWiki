use crate::synthetic_matrix::generator_trait::{ArchFixtureGenerator, GroundTruthManifest, SeededViolation};
use crate::synthetic_matrix::repo_builder::SyntheticRepoBuilder;

pub struct ActorSystemFixture;

impl ArchFixtureGenerator for ActorSystemFixture {
    fn name(&self) -> &'static str {
        "9. Actor System (Shared-Nothing Concurrency)"
    }

    fn generate_clean(&self, builder: &mut SyntheticRepoBuilder) -> Result<(), String> {
        builder.write_cargo_workspace(&["actor-app"], Some("actor"));

        builder.write_package_manifest("actor-app", "actor", &[]);
        builder.write_file("actor-app/src/lib.rs", "pub mod messages;\npub mod worker;");

        builder.write_file("actor-app/src/messages/mod.rs", "pub enum Msg { Ping, Pong }");
        builder.write_file("actor-app/src/worker/mod.rs", "use crate::messages::Msg;\npub struct WorkerActor;\nimpl WorkerActor { pub fn handle(&mut self, _m: Msg) {} }");

        Ok(())
    }

    fn generate_seeded(&self, builder: &mut SyntheticRepoBuilder) -> Result<GroundTruthManifest, String> {
        self.generate_clean(builder)?;

        // Seeded Violation: Shared global mutable state violation in Actor system (AI-008 unsafe without safety contract)
        builder.write_file(
            "actor-app/src/worker/leaky_state.rs",
            "static mut GLOBAL_ACTOR_STATE: u64 = 0;\npub fn mutate_shared() { unsafe { GLOBAL_ACTOR_STATE += 1; } }",
        );

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
            ],
        })
    }
}
