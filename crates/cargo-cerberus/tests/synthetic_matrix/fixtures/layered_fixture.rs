use crate::synthetic_matrix::generator_trait::{ArchFixtureGenerator, GroundTruthManifest, SeededViolation};
use crate::synthetic_matrix::repo_builder::SyntheticRepoBuilder;

pub struct LayeredNTierFixture;

impl ArchFixtureGenerator for LayeredNTierFixture {
    fn name(&self) -> &'static str {
        "2. Layered N-Tier (Controller -> Service -> Repository -> Entity)"
    }

    fn generate_clean(&self, builder: &mut SyntheticRepoBuilder) -> Result<(), String> {
        builder.write_cargo_workspace(&["entity-crate", "repository-crate", "service-crate", "controller-crate"], Some("layered"));

        builder.write_package_manifest("entity-crate", "entity", &[]);
        builder.write_file("entity-crate/src/lib.rs", "pub struct User { pub id: u64, pub name: String }");

        builder.write_package_manifest("repository-crate", "repository", &[("entity-crate", Some("../entity-crate"))]);
        builder.write_file("repository-crate/src/lib.rs", "use entity_crate::User;\npub struct UserRepository;\nimpl UserRepository { pub fn find_by_id(&self, id: u64) -> Option<User> { Some(User { id, name: \"Alice\".into() }) } }");

        builder.write_package_manifest("service-crate", "service", &[("repository-crate", Some("../repository-crate")), ("entity-crate", Some("../entity-crate"))]);
        builder.write_file("service-crate/src/lib.rs", "use repository_crate::UserRepository;\nuse entity_crate::User;\npub struct UserService { repo: UserRepository }\nimpl UserService { pub fn get_user(&self, id: u64) -> Option<User> { self.repo.find_by_id(id) } }");

        builder.write_package_manifest("controller-crate", "controller", &[("service-crate", Some("../service-crate")), ("entity-crate", Some("../entity-crate"))]);
        builder.write_file("controller-crate/src/lib.rs", "use service_crate::UserService;\npub struct UserController { service: UserService };");

        Ok(())
    }

    fn generate_seeded(&self, builder: &mut SyntheticRepoBuilder) -> Result<GroundTruthManifest, String> {
        builder.write_cargo_workspace(&["entity-crate", "repository-crate", "service-crate", "controller-crate"], Some("layered"));

        builder.write_package_manifest("entity-crate", "entity", &[]);
        builder.write_file("entity-crate/src/lib.rs", "pub struct User { pub id: u64, pub name: String }");

        builder.write_package_manifest("repository-crate", "repository", &[("entity-crate", Some("../entity-crate"))]);
        builder.write_file("repository-crate/src/lib.rs", "use entity_crate::User;\npub struct UserRepository;");

        // Seeded Violation 1: Service depends on Controller (ARCH-020 on Cargo.toml + ARCH-007 on code)
        builder.write_package_manifest("service-crate", "service", &[("repository-crate", Some("../repository-crate")), ("entity-crate", Some("../entity-crate")), ("controller-crate", Some("../controller-crate"))]);
        builder.write_file("service-crate/src/lib.rs", "use controller_crate::UserController;\npub struct UserService;");

        // Seeded Violation 2: Controller directly depends on Repository (skipping Service)
        builder.write_package_manifest("controller-crate", "controller", &[("service-crate", Some("../service-crate")), ("repository-crate", Some("../repository-crate"))]);
        builder.write_file("controller-crate/src/lib.rs", "use repository_crate::UserRepository;\npub struct UserController;");

        Ok(GroundTruthManifest {
            paradigm_name: self.name(),
            total_files: builder.total_files,
            approximate_sloc: builder.total_sloc,
            expected_violations: vec![
                SeededViolation {
                    rule_id: "ARCH-020".into(),
                    target_file_suffix: "service-crate/Cargo.toml".into(),
                    description: "Layer 'service' cannot depend on layer 'controller'".into(),
                },
                SeededViolation {
                    rule_id: "ARCH-020".into(),
                    target_file_suffix: "controller-crate/Cargo.toml".into(),
                    description: "Layer 'controller' cannot depend directly on layer 'repository'".into(),
                },
            ],
        })
    }
}
