use crate::synthetic_matrix::generator_trait::{ArchFixtureGenerator, GroundTruthManifest, SeededViolation};
use crate::synthetic_matrix::repo_builder::SyntheticRepoBuilder;

pub struct BffFixture;

impl ArchFixtureGenerator for BffFixture {
    fn name(&self) -> &'static str {
        "13. Backend-for-Frontend (BFF Gateway Layer)"
    }

    fn generate_clean(&self, builder: &mut SyntheticRepoBuilder) -> Result<(), String> {
        builder.write_cargo_workspace(&["bff-gateway"], Some("bff"));

        builder.write_package_manifest("bff-gateway", "bff", &[]);
        builder.write_file("bff-gateway/src/lib.rs", "pub struct UserDto { pub id: u64 }\npub fn get_profile() -> UserDto { UserDto { id: 1 } }");

        Ok(())
    }

    fn generate_seeded(&self, builder: &mut SyntheticRepoBuilder) -> Result<GroundTruthManifest, String> {
        self.generate_clean(builder)?;

        // Seeded Violation: BFF connects directly to database via sqlx (ARCH-001)
        builder.write_file(
            "bff-gateway/src/db_leak.rs",
            "use sqlx::PgPool;\npub fn direct_sql() {}",
        );

        Ok(GroundTruthManifest {
            paradigm_name: self.name(),
            total_files: builder.total_files,
            approximate_sloc: builder.total_sloc,
            expected_violations: vec![
                SeededViolation {
                    rule_id: "ARCH-001".into(),
                    target_file_suffix: "bff-gateway/src/db_leak.rs".into(),
                    description: "BFF layer forbids direct SQL driver dependency 'sqlx'".into(),
                },
            ],
        })
    }
}
