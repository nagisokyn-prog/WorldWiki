use crate::synthetic_matrix::generator_trait::{ArchFixtureGenerator, GroundTruthManifest, SeededViolation};
use crate::synthetic_matrix::repo_builder::SyntheticRepoBuilder;

pub struct EventDrivenFixture;

impl ArchFixtureGenerator for EventDrivenFixture {
    fn name(&self) -> &'static str {
        "14. Event-Driven (Producer / Consumer Decoupling)"
    }

    fn generate_clean(&self, builder: &mut SyntheticRepoBuilder) -> Result<(), String> {
        builder.write_cargo_workspace(&["event-app"], Some("event_driven"));

        builder.write_package_manifest("event-app", "producer", &[]);
        builder.write_file("event-app/src/lib.rs", "pub mod producer;\npub mod consumer;\npub mod events;");

        builder.write_file("event-app/src/events/mod.rs", "pub struct OrderPaidEvent { pub order_id: u64 }");
        builder.write_file("event-app/src/producer/mod.rs", "use crate::events::OrderPaidEvent;\npub fn publish_order_paid() -> OrderPaidEvent { OrderPaidEvent { order_id: 42 } }");
        builder.write_file("event-app/src/consumer/mod.rs", "use crate::events::OrderPaidEvent;\npub fn on_order_paid(_e: OrderPaidEvent) {}");

        Ok(())
    }

    fn generate_seeded(&self, builder: &mut SyntheticRepoBuilder) -> Result<GroundTruthManifest, String> {
        self.generate_clean(builder)?;

        // Seeded Violation: Producer synchronously couples directly to Consumer (EVT-001)
        builder.write_file(
            "event-app/src/producer/sync_leak.rs",
            "use crate::consumer::on_order_paid;\npub fn sync_call() { on_order_paid(crate::events::OrderPaidEvent { order_id: 1 }); }",
        );

        Ok(GroundTruthManifest {
            paradigm_name: self.name(),
            total_files: builder.total_files,
            approximate_sloc: builder.total_sloc,
            expected_violations: vec![
                SeededViolation {
                    rule_id: "EVT-001".into(),
                    target_file_suffix: "event-app/src/producer/sync_leak.rs".into(),
                    description: "Event-driven violation: Producer directly imports Consumer".into(),
                },
            ],
        })
    }
}
