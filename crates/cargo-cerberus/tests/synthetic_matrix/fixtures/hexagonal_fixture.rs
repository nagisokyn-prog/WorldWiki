use crate::synthetic_matrix::generator_trait::{ArchFixtureGenerator, GroundTruthManifest, SeededViolation};
use crate::synthetic_matrix::repo_builder::SyntheticRepoBuilder;

pub struct HexagonalCleanFixture;

impl ArchFixtureGenerator for HexagonalCleanFixture {
    fn name(&self) -> &'static str {
        "1. Hexagonal (Ports & Adapters)"
    }

    fn generate_clean(&self, builder: &mut SyntheticRepoBuilder) -> Result<(), String> {
        builder.write_cargo_workspace(&["domain", "ports", "application", "infrastructure", "adapter-tauri"], Some("hexagonal"));
        
        builder.write_package_manifest("domain", "domain", &[]);
        builder.write_file("domain/src/lib.rs", "pub struct Order { pub id: u64, pub amount: f64 }\nimpl Order { pub fn total(&self) -> f64 { self.amount } }");

        builder.write_package_manifest("ports", "ports", &[("domain", Some("../domain"))]);
        builder.write_file("ports/src/lib.rs", "use domain::Order;\npub trait OrderRepositoryPort: Send + Sync {\n    fn save(&self, order: &Order) -> Result<(), String>;\n}");

        builder.write_package_manifest("application", "application", &[("domain", Some("../domain")), ("ports", Some("../ports"))]);
        builder.write_file("application/src/lib.rs", "use domain::Order;\nuse ports::OrderRepositoryPort;\npub struct CheckoutUseCase<R: OrderRepositoryPort> { repo: R }\nimpl<R: OrderRepositoryPort> CheckoutUseCase<R> {\n    pub fn new(repo: R) -> Self { Self { repo } }\n    pub fn execute(&self, order: &Order) -> Result<(), String> { self.repo.save(order) }\n}");

        builder.write_package_manifest("infrastructure", "infrastructure", &[("domain", Some("../domain")), ("ports", Some("../ports")), ("serde", None)]);
        builder.write_file("infrastructure/src/lib.rs", "use domain::Order;\nuse ports::OrderRepositoryPort;\npub struct MemoryOrderRepo;\nimpl OrderRepositoryPort for MemoryOrderRepo {\n    fn save(&self, _order: &Order) -> Result<(), String> { Ok(()) }\n}");

        builder.write_package_manifest("adapter-tauri", "adapter", &[("domain", Some("../domain")), ("ports", Some("../ports")), ("application", Some("../application"))]);
        builder.write_file("adapter-tauri/src/lib.rs", "pub fn init_tauri() {}");

        Ok(())
    }

    fn generate_seeded(&self, builder: &mut SyntheticRepoBuilder) -> Result<GroundTruthManifest, String> {
        self.generate_clean(builder)?;

        // Seeded Violation 1: Domain imports reqwest (ARCH-001)
        builder.write_file("domain/src/entity.rs", "use reqwest::Client;\npub fn leaky_fn() {}");

        // Seeded Violation 2: Application imports tauri (ARCH-002)
        builder.write_file("application/src/ipc.rs", "use tauri::command;\n#[command]\npub fn bad_ui_call() {}");

        Ok(GroundTruthManifest {
            paradigm_name: self.name(),
            total_files: builder.total_files,
            approximate_sloc: builder.total_sloc,
            expected_violations: vec![
                SeededViolation {
                    rule_id: "ARCH-001".into(),
                    target_file_suffix: "domain/src/entity.rs".into(),
                    description: "Domain crate cannot import external framework 'reqwest'".into(),
                },
                SeededViolation {
                    rule_id: "ARCH-002".into(),
                    target_file_suffix: "application/src/ipc.rs".into(),
                    description: "Application crate cannot import 'tauri'".into(),
                },
            ],
        })
    }
}
