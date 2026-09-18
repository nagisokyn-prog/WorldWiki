use crate::synthetic_matrix::generator_trait::{ArchFixtureGenerator, GroundTruthManifest, SeededViolation};
use crate::synthetic_matrix::repo_builder::SyntheticRepoBuilder;
use crate::synthetic_matrix::scale_helper::ScaleHelper;

pub struct CqrsEsFixture;

impl ArchFixtureGenerator for CqrsEsFixture {
    fn name(&self) -> &'static str {
        "6. CQRS & Event Sourcing (Write / Read Decoupling)"
    }

    fn default_target_sloc(&self) -> usize {
        250_000
    }

    fn generate_clean(
        &self,
        builder: &mut SyntheticRepoBuilder,
        target_sloc: usize,
    ) -> Result<(), String> {
        builder.write_cargo_workspace(&["cqrs-app"], Some("cqrs"));
        builder.write_package_manifest("cqrs-app", "commands", &[]);

        let (mut files, _) =
            ScaleHelper::generate_rust_modules("cqrs-app", "commands", target_sloc, false);

        files.push((
            "cqrs-app/src/events/mod.rs".into(),
            "pub struct OrderCreatedEvent { pub id: u64 }\n".into(),
        ));
        files.push((
            "cqrs-app/src/command/mod.rs".into(),
            "use crate::events::OrderCreatedEvent;\npub struct CreateOrderCommand { pub id: u64 }\n".into(),
        ));
        files.push((
            "cqrs-app/src/query/mod.rs".into(),
            "pub struct OrderSummaryView { pub id: u64, pub status: String }\n".into(),
        ));

        builder.write_files_parallel(files);

        Ok(())
    }

    fn generate_seeded(
        &self,
        builder: &mut SyntheticRepoBuilder,
        target_sloc: usize,
    ) -> Result<GroundTruthManifest, String> {
        builder.write_cargo_workspace(&["cqrs-app"], Some("cqrs"));
        builder.write_package_manifest("cqrs-app", "commands", &[]);

        let (mut files, _) =
            ScaleHelper::generate_rust_modules("cqrs-app", "commands", target_sloc, false);

        files.push((
            "cqrs-app/src/command/bad_write.rs".into(),
            "use crate::read_db::OrderSummaryView;\npub fn mutate_and_read() {}\n".into(),
        ));
        let violations = vec![SeededViolation {
            rule_id: "CQRS-001".into(),
            target_file_suffix: "cqrs-app/src/command/bad_write.rs".into(),
            description: "CQRS boundary violation: Write pipeline cannot import Read model 'read_db'".into(),
        }];

        builder.write_files_parallel(files);

        Ok(GroundTruthManifest {
            paradigm_name: self.name(),
            total_files: builder.total_files,
            approximate_sloc: builder.total_sloc,
            expected_violations: violations,
        })
    }
}
