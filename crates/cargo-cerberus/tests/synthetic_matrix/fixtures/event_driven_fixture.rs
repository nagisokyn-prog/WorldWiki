use crate::synthetic_matrix::generator_trait::{ArchFixtureGenerator, GroundTruthManifest, SeededViolation};
use crate::synthetic_matrix::repo_builder::SyntheticRepoBuilder;
use crate::synthetic_matrix::scale_helper::ScaleHelper;

pub struct EventDrivenFixture;

impl ArchFixtureGenerator for EventDrivenFixture {
    fn name(&self) -> &'static str {
        "14. Event-Driven (Producer / Consumer Decoupling)"
    }

    fn default_target_sloc(&self) -> usize {
        450_000
    }

    fn generate_clean(
        &self,
        builder: &mut SyntheticRepoBuilder,
        target_sloc: usize,
    ) -> Result<(), String> {
        builder.write_cargo_workspace(&["event-app"], Some("event_driven"));
        builder.write_package_manifest("event-app", "producer", &[]);

        let (mut files, _) =
            ScaleHelper::generate_rust_modules("event-app", "producer", target_sloc, false);

        files.push((
            "event-app/src/events/mod.rs".into(),
            "pub struct OrderPaidEvent { pub order_id: u64 }\n".into(),
        ));
        files.push((
            "event-app/src/producer/mod.rs".into(),
            "use crate::events::OrderPaidEvent;\npub fn publish_order_paid() -> OrderPaidEvent { OrderPaidEvent { order_id: 42 } }\n".into(),
        ));
        files.push((
            "event-app/src/consumer/mod.rs".into(),
            "use crate::events::OrderPaidEvent;\npub fn on_order_paid(_e: OrderPaidEvent) {}\n".into(),
        ));

        builder.write_files_parallel(files);

        Ok(())
    }

    fn generate_seeded(
        &self,
        builder: &mut SyntheticRepoBuilder,
        target_sloc: usize,
    ) -> Result<GroundTruthManifest, String> {
        builder.write_cargo_workspace(&["event-app"], Some("event_driven"));
        builder.write_package_manifest("event-app", "producer", &[]);

        let (mut files, mut expected_violations) =
            ScaleHelper::generate_rust_modules("event-app", "producer", target_sloc, true);

        files.push((
            "event-app/src/producer/sync_leak.rs".into(),
            "use crate::consumer::on_order_event;\npub fn sync_call() {}\n".into(),
        ));

        expected_violations.push(SeededViolation {
            rule_id: "EVT-001".into(),
            target_file_suffix: "event-app/src/producer/sync_leak.rs".into(),
            description: "Event-driven violation: Producer directly imports Consumer".into(),
        });

        builder.write_files_parallel(files);

        Ok(GroundTruthManifest {
            paradigm_name: self.name(),
            total_files: builder.total_files,
            approximate_sloc: builder.total_sloc,
            expected_violations,
        })
    }
}
