use crate::synthetic_matrix::generator_trait::{ArchFixtureGenerator, GroundTruthManifest, SeededViolation};
use crate::synthetic_matrix::repo_builder::SyntheticRepoBuilder;
use crate::synthetic_matrix::scale_helper::ScaleHelper;

pub struct CleanArchFixture;

impl ArchFixtureGenerator for CleanArchFixture {
    fn name(&self) -> &'static str {
        "3. Clean Architecture (Entities <- UseCases <- Controllers/Gateways)"
    }

    fn default_target_sloc(&self) -> usize {
        200_000
    }

    fn generate_clean(
        &self,
        builder: &mut SyntheticRepoBuilder,
        target_sloc: usize,
    ) -> Result<(), String> {
        builder.write_cargo_workspace(
            &["entities-crate", "usecases-crate", "controllers-crate"],
            Some("clean"),
        );

        builder.write_package_manifest("entities-crate", "entities", &[]);
        builder.write_package_manifest(
            "usecases-crate",
            "usecases",
            &[("entities-crate", Some("../entities-crate"))],
        );
        builder.write_package_manifest(
            "controllers-crate",
            "controllers",
            &[
                ("usecases-crate", Some("../usecases-crate")),
                ("entities-crate", Some("../entities-crate")),
            ],
        );

        let ent_sloc = target_sloc * 45 / 100;
        let uc_sloc = target_sloc * 25 / 100;
        let ctrl_sloc = target_sloc.saturating_sub(ent_sloc + uc_sloc);
        let mut all_files = Vec::new();

        let (ent_files, _) =
            ScaleHelper::generate_rust_modules("entities-crate", "entities", ent_sloc, false);
        all_files.extend(ent_files);

        let (uc_files, _) =
            ScaleHelper::generate_rust_modules("usecases-crate", "usecases", uc_sloc, false);
        all_files.extend(uc_files);

        let (ctrl_files, _) = ScaleHelper::generate_rust_modules(
            "controllers-crate",
            "controllers",
            ctrl_sloc,
            false,
        );
        all_files.extend(ctrl_files);

        builder.write_files_parallel(all_files);

        Ok(())
    }

    fn generate_seeded(
        &self,
        builder: &mut SyntheticRepoBuilder,
        target_sloc: usize,
    ) -> Result<GroundTruthManifest, String> {
        builder.write_cargo_workspace(
            &["entities-crate", "usecases-crate", "controllers-crate"],
            Some("clean"),
        );

        // Seeded Violation: Entities depends on UseCases (inverting Clean Architecture Dependency Rule)
        builder.write_package_manifest(
            "entities-crate",
            "entities",
            &[("usecases-crate", Some("../usecases-crate"))],
        );
        builder.write_package_manifest("usecases-crate", "usecases", &[]);
        builder.write_package_manifest(
            "controllers-crate",
            "controllers",
            &[("usecases-crate", Some("../usecases-crate"))],
        );

        let ent_sloc = target_sloc * 45 / 100;
        let uc_sloc = target_sloc * 25 / 100;
        let ctrl_sloc = target_sloc.saturating_sub(ent_sloc + uc_sloc);
        let mut all_files = Vec::new();
        let mut expected_violations = vec![SeededViolation {
            rule_id: "ARCH-020".into(),
            target_file_suffix: "entities-crate/Cargo.toml".into(),
            description: "Layer 'entities' cannot depend on layer 'usecases'".into(),
        }];

        let (ent_files, mut ent_viol) =
            ScaleHelper::generate_rust_modules("entities-crate", "entities", ent_sloc, true);
        all_files.extend(ent_files);
        expected_violations.append(&mut ent_viol);

        let (uc_files, mut uc_viol) =
            ScaleHelper::generate_rust_modules("usecases-crate", "usecases", uc_sloc, true);
        all_files.extend(uc_files);
        expected_violations.append(&mut uc_viol);

        let (ctrl_files, _) = ScaleHelper::generate_rust_modules(
            "controllers-crate",
            "controllers",
            ctrl_sloc,
            false,
        );
        all_files.extend(ctrl_files);

        builder.write_files_parallel(all_files);

        Ok(GroundTruthManifest {
            paradigm_name: self.name(),
            total_files: builder.total_files,
            approximate_sloc: builder.total_sloc,
            expected_violations,
        })
    }
}
