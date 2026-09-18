use crate::synthetic_matrix::generator_trait::{ArchFixtureGenerator, GroundTruthManifest, SeededViolation};
use crate::synthetic_matrix::repo_builder::SyntheticRepoBuilder;
use crate::synthetic_matrix::scale_helper::ScaleHelper;

pub struct BffFixture;

impl ArchFixtureGenerator for BffFixture {
    fn name(&self) -> &'static str {
        "13. Backend-for-Frontend (BFF Gateway Layer)"
    }

    fn default_target_sloc(&self) -> usize {
        450_000
    }

    fn generate_clean(
        &self,
        builder: &mut SyntheticRepoBuilder,
        target_sloc: usize,
    ) -> Result<(), String> {
        builder.write_cargo_workspace(&["bff-gateway"], Some("bff"));
        builder.write_package_manifest("bff-gateway", "bff", &[]);

        let (mut files, _) =
            ScaleHelper::generate_rust_modules("bff-gateway", "bff", target_sloc, false);

        files.push((
            "bff-gateway/src/profile.rs".into(),
            "pub struct UserDto { pub id: u64 }\npub fn get_profile() -> UserDto { UserDto { id: 1 } }\n".into(),
        ));

        builder.write_files_parallel(files);

        Ok(())
    }

    fn generate_seeded(
        &self,
        builder: &mut SyntheticRepoBuilder,
        target_sloc: usize,
    ) -> Result<GroundTruthManifest, String> {
        builder.write_cargo_workspace(&["bff-gateway"], Some("bff"));
        builder.write_package_manifest("bff-gateway", "bff", &[]);

        let (mut files, _) =
            ScaleHelper::generate_rust_modules("bff-gateway", "bff", target_sloc, true);

        // Seeded Violation: BFF connects directly to database via sqlx (ARCH-001)
        files.push((
            "bff-gateway/src/db_leak.rs".into(),
            "use sqlx::PgPool;\npub fn direct_sql() {}\n".into(),
        ));

        builder.write_files_parallel(files);

        Ok(GroundTruthManifest {
            paradigm_name: self.name(),
            total_files: builder.total_files,
            approximate_sloc: builder.total_sloc,
            expected_violations: vec![SeededViolation {
                rule_id: "ARCH-001".into(),
                target_file_suffix: "bff-gateway/src/db_leak.rs".into(),
                description: "BFF layer forbids direct SQL driver dependency 'sqlx'".into(),
            }],
        })
    }
}
