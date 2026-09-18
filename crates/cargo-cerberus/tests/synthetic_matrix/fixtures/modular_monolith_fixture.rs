use crate::synthetic_matrix::generator_trait::{ArchFixtureGenerator, GroundTruthManifest, SeededViolation};
use crate::synthetic_matrix::repo_builder::SyntheticRepoBuilder;
use crate::synthetic_matrix::scale_helper::ScaleHelper;

pub struct ModularMonolithFixture;

impl ArchFixtureGenerator for ModularMonolithFixture {
    fn name(&self) -> &'static str {
        "5. Modular Monolith (Encapsulation & Boundary Capsules)"
    }

    fn default_target_sloc(&self) -> usize {
        250_000
    }

    fn generate_clean(
        &self,
        builder: &mut SyntheticRepoBuilder,
        target_sloc: usize,
    ) -> Result<(), String> {
        builder.write_cargo_workspace(&["monolith-app"], Some("modular_monolith"));
        builder.write_package_manifest("monolith-app", "module", &[]);

        let (mut files, _) =
            ScaleHelper::generate_rust_modules("monolith-app", "module", target_sloc, false);

        // Core capsule definitions
        files.push((
            "monolith-app/src/modules/billing/api.rs".into(),
            "pub struct InvoiceDto { pub id: u64 }\npub trait BillingApi { fn create(&self) -> InvoiceDto; }\n".into(),
        ));
        files.push((
            "monolith-app/src/modules/billing/internal.rs".into(),
            "pub struct SecretVaultKey { pub key: String }\n".into(),
        ));
        files.push((
            "monolith-app/src/modules/orders/api.rs".into(),
            "use crate::modules::billing::api::InvoiceDto;\npub struct OrderDto { pub invoice: InvoiceDto }\n".into(),
        ));

        builder.write_files_parallel(files);

        Ok(())
    }

    fn generate_seeded(
        &self,
        builder: &mut SyntheticRepoBuilder,
        target_sloc: usize,
    ) -> Result<GroundTruthManifest, String> {
        builder.write_cargo_workspace(&["monolith-app"], Some("modular_monolith"));
        builder.write_package_manifest("monolith-app", "module", &[]);

        let (mut files, _) =
            ScaleHelper::generate_rust_modules("monolith-app", "module", target_sloc, false);

        files.push((
            "monolith-app/src/modules/billing/api.rs".into(),
            "pub struct InvoiceDto { pub id: u64 }\npub trait BillingApi { fn create(&self) -> InvoiceDto; }\n".into(),
        ));
        files.push((
            "monolith-app/src/modules/billing/internal.rs".into(),
            "pub struct SecretVaultKey { pub key: String }\n".into(),
        ));
        files.push((
            "monolith-app/src/modules/orders/leaky.rs".into(),
            "use crate::modules::billing::internal::SecretVaultKey;\npub fn steal_key() {}\n".into(),
        ));

        builder.write_files_parallel(files);

        Ok(GroundTruthManifest {
            paradigm_name: self.name(),
            total_files: builder.total_files,
            approximate_sloc: builder.total_sloc,
            expected_violations: vec![SeededViolation {
                rule_id: "MOD-001".into(),
                target_file_suffix: "monolith-app/src/modules/orders/leaky.rs".into(),
                description: "Module boundary violation: Module 'orders' illegally accesses private internal scope of module 'billing'".into(),
            }],
        })
    }
}
