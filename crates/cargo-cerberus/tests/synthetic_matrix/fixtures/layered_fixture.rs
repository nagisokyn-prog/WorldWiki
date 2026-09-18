use crate::synthetic_matrix::generator_trait::{ArchFixtureGenerator, GroundTruthManifest, SeededViolation};
use crate::synthetic_matrix::repo_builder::SyntheticRepoBuilder;
use crate::synthetic_matrix::scale_helper::ScaleHelper;

pub struct LayeredNTierFixture;

impl ArchFixtureGenerator for LayeredNTierFixture {
    fn name(&self) -> &'static str {
        "2. Layered N-Tier (Controller -> Service -> Repository -> Entity)"
    }

    fn default_target_sloc(&self) -> usize {
        150_000
    }

    fn generate_clean(
        &self,
        builder: &mut SyntheticRepoBuilder,
        target_sloc: usize,
    ) -> Result<(), String> {
        builder.write_cargo_workspace(
            &["entity-crate", "repository-crate", "service-crate", "controller-crate"],
            Some("layered"),
        );

        builder.write_package_manifest("entity-crate", "entity", &[]);
        builder.write_package_manifest(
            "repository-crate",
            "repository",
            &[("entity-crate", Some("../entity-crate"))],
        );
        builder.write_package_manifest(
            "service-crate",
            "service",
            &[
                ("repository-crate", Some("../repository-crate")),
                ("entity-crate", Some("../entity-crate")),
            ],
        );
        builder.write_package_manifest(
            "controller-crate",
            "controller",
            &[
                ("service-crate", Some("../service-crate")),
                ("entity-crate", Some("../entity-crate")),
            ],
        );

        let per_crate_sloc = target_sloc / 4;
        let mut all_files = Vec::new();

        let (ent_files, _) =
            ScaleHelper::generate_rust_modules("entity-crate", "entity", per_crate_sloc, false);
        all_files.extend(ent_files);

        let (repo_files, _) = ScaleHelper::generate_rust_modules(
            "repository-crate",
            "repository",
            per_crate_sloc,
            false,
        );
        all_files.extend(repo_files);

        let (svc_files, _) =
            ScaleHelper::generate_rust_modules("service-crate", "service", per_crate_sloc, false);
        all_files.extend(svc_files);

        let (ctrl_files, _) = ScaleHelper::generate_rust_modules(
            "controller-crate",
            "controller",
            per_crate_sloc,
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
            &["entity-crate", "repository-crate", "service-crate", "controller-crate"],
            Some("layered"),
        );

        builder.write_package_manifest("entity-crate", "entity", &[]);
        builder.write_package_manifest(
            "repository-crate",
            "repository",
            &[("entity-crate", Some("../entity-crate"))],
        );

        // Seeded Violation 1: Service depends on Controller (ARCH-020)
        builder.write_package_manifest(
            "service-crate",
            "service",
            &[
                ("repository-crate", Some("../repository-crate")),
                ("entity-crate", Some("../entity-crate")),
                ("controller-crate", Some("../controller-crate")),
            ],
        );

        // Seeded Violation 2: Controller directly depends on Repository (skipping Service, ARCH-020)
        builder.write_package_manifest(
            "controller-crate",
            "controller",
            &[
                ("repository-crate", Some("../repository-crate")),
                ("entity-crate", Some("../entity-crate")),
            ],
        );

        let per_crate_sloc = target_sloc / 4;
        let mut all_files = Vec::new();
        let mut expected_violations = vec![
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
        ];

        let (ent_files, mut ent_viol) =
            ScaleHelper::generate_rust_modules("entity-crate", "entity", per_crate_sloc, true);
        all_files.extend(ent_files);
        expected_violations.append(&mut ent_viol);

        let (repo_files, mut repo_viol) = ScaleHelper::generate_rust_modules(
            "repository-crate",
            "repository",
            per_crate_sloc,
            true,
        );
        all_files.extend(repo_files);
        expected_violations.append(&mut repo_viol);

        let (svc_files, mut svc_viol) =
            ScaleHelper::generate_rust_modules("service-crate", "service", per_crate_sloc, true);
        all_files.extend(svc_files);
        expected_violations.append(&mut svc_viol);

        let (ctrl_files, mut ctrl_viol) = ScaleHelper::generate_rust_modules(
            "controller-crate",
            "controller",
            per_crate_sloc,
            true,
        );
        all_files.extend(ctrl_files);
        expected_violations.append(&mut ctrl_viol);

        builder.write_files_parallel(all_files);

        Ok(GroundTruthManifest {
            paradigm_name: self.name(),
            total_files: builder.total_files,
            approximate_sloc: builder.total_sloc,
            expected_violations,
        })
    }
}
