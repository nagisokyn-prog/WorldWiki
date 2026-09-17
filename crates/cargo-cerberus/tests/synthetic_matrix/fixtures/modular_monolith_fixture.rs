use crate::synthetic_matrix::generator_trait::{ArchFixtureGenerator, GroundTruthManifest, SeededViolation};
use crate::synthetic_matrix::repo_builder::SyntheticRepoBuilder;

pub struct ModularMonolithFixture;

impl ArchFixtureGenerator for ModularMonolithFixture {
    fn name(&self) -> &'static str {
        "5. Modular Monolith (Encapsulation & Boundary Capsules)"
    }

    fn generate_clean(&self, builder: &mut SyntheticRepoBuilder) -> Result<(), String> {
        builder.write_cargo_workspace(&["monolith-app"], Some("modular_monolith"));

        builder.write_package_manifest("monolith-app", "module", &[]);
        builder.write_file("monolith-app/src/lib.rs", "pub mod modules;");

        // Module A: Billing
        builder.write_file("monolith-app/src/modules/billing/api.rs", "pub struct InvoiceDto { pub id: u64 }");
        builder.write_file("monolith-app/src/modules/billing/internal.rs", "pub struct SecretVaultKey { pub key: String }");
        builder.write_file("monolith-app/src/modules/billing/mod.rs", "pub mod api;\npub mod internal;");

        // Module B: Orders (Cleanly imports billing API)
        builder.write_file("monolith-app/src/modules/orders/mod.rs", "use crate::modules::billing::api::InvoiceDto;\npub struct Order { pub invoice: InvoiceDto }");
        builder.write_file("monolith-app/src/modules/mod.rs", "pub mod billing;\npub mod orders;");

        Ok(())
    }

    fn generate_seeded(&self, builder: &mut SyntheticRepoBuilder) -> Result<GroundTruthManifest, String> {
        self.generate_clean(builder)?;

        // Seeded Violation: Orders illegally accesses Billing internal scope (MOD-001)
        builder.write_file(
            "monolith-app/src/modules/orders/leaky.rs",
            "use crate::modules::billing::internal::SecretVaultKey;\npub fn steal_key() {}",
        );

        Ok(GroundTruthManifest {
            paradigm_name: self.name(),
            total_files: builder.total_files,
            approximate_sloc: builder.total_sloc,
            expected_violations: vec![
                SeededViolation {
                    rule_id: "MOD-001".into(),
                    target_file_suffix: "monolith-app/src/modules/orders/leaky.rs".into(),
                    description: "Module boundary violation: Module 'orders' illegally accesses private internal scope of module 'billing'".into(),
                },
            ],
        })
    }
}
