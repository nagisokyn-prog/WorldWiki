use crate::synthetic_matrix::generator_trait::{ArchFixtureGenerator, GroundTruthManifest, SeededViolation};
use crate::synthetic_matrix::repo_builder::SyntheticRepoBuilder;

pub struct CqrsEsFixture;

impl ArchFixtureGenerator for CqrsEsFixture {
    fn name(&self) -> &'static str {
        "6. CQRS & Event Sourcing (Write / Read Decoupling)"
    }

    fn generate_clean(&self, builder: &mut SyntheticRepoBuilder) -> Result<(), String> {
        builder.write_cargo_workspace(&["cqrs-app"], Some("cqrs"));

        builder.write_package_manifest("cqrs-app", "commands", &[]);
        builder.write_file("cqrs-app/src/lib.rs", "pub mod command;\npub mod query;\npub mod events;");

        builder.write_file("cqrs-app/src/events/mod.rs", "pub struct OrderCreatedEvent { pub id: u64 }");
        builder.write_file("cqrs-app/src/command/mod.rs", "use crate::events::OrderCreatedEvent;\npub struct CreateOrderCommand { pub id: u64 }");
        builder.write_file("cqrs-app/src/query/mod.rs", "pub struct OrderSummaryView { pub id: u64, pub status: String }");

        Ok(())
    }

    fn generate_seeded(&self, builder: &mut SyntheticRepoBuilder) -> Result<GroundTruthManifest, String> {
        self.generate_clean(builder)?;

        // Seeded Violation: Command Write handler directly imports Read DB Query View (CQRS-001)
        builder.write_file(
            "cqrs-app/src/command/bad_write.rs",
            "use crate::read_db::OrderSummaryView;\npub fn mutate_and_read() {}",
        );

        Ok(GroundTruthManifest {
            paradigm_name: self.name(),
            total_files: builder.total_files,
            approximate_sloc: builder.total_sloc,
            expected_violations: vec![
                SeededViolation {
                    rule_id: "CQRS-001".into(),
                    target_file_suffix: "cqrs-app/src/command/bad_write.rs".into(),
                    description: "CQRS boundary violation: Write pipeline cannot import Read model 'read_db'".into(),
                },
            ],
        })
    }
}
