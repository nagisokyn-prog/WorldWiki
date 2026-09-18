use crate::synthetic_matrix::generator_trait::{ArchFixtureGenerator, GroundTruthManifest, SeededViolation};
use crate::synthetic_matrix::repo_builder::SyntheticRepoBuilder;
use crate::synthetic_matrix::scale_helper::ScaleHelper;

pub struct HexagonalCleanFixture;

impl ArchFixtureGenerator for HexagonalCleanFixture {
    fn name(&self) -> &'static str {
        "1. Hexagonal (Ports & Adapters)"
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
            &["domain", "ports", "application", "infrastructure", "adapter-tauri"],
            Some("hexagonal"),
        );

        builder.write_package_manifest("domain", "domain", &[]);
        builder.write_package_manifest("ports", "ports", &[("domain", Some("../domain"))]);
        builder.write_package_manifest(
            "application",
            "application",
            &[("domain", Some("../domain")), ("ports", Some("../ports"))],
        );
        builder.write_package_manifest(
            "infrastructure",
            "infrastructure",
            &[("domain", Some("../domain")), ("ports", Some("../ports"))],
        );
        builder.write_package_manifest(
            "adapter-tauri",
            "adapter",
            &[
                ("domain", Some("../domain")),
                ("ports", Some("../ports")),
                ("application", Some("../application")),
            ],
        );

        let per_crate_sloc = target_sloc / 5;
        let mut all_files = Vec::new();

        let (dom_files, _) =
            ScaleHelper::generate_rust_modules("domain", "domain", per_crate_sloc, false);
        all_files.extend(dom_files);

        let (ports_files, _) =
            ScaleHelper::generate_rust_modules("ports", "ports", per_crate_sloc, false);
        all_files.extend(ports_files);

        let (app_files, _) =
            ScaleHelper::generate_rust_modules("application", "application", per_crate_sloc, false);
        all_files.extend(app_files);

        let (infra_files, _) = ScaleHelper::generate_rust_modules(
            "infrastructure",
            "infrastructure",
            per_crate_sloc,
            false,
        );
        all_files.extend(infra_files);

        let (adapter_files, _) = ScaleHelper::generate_rust_modules(
            "adapter-tauri",
            "adapter",
            per_crate_sloc,
            false,
        );
        all_files.extend(adapter_files);

        builder.write_files_parallel(all_files);

        Ok(())
    }

    fn generate_seeded(
        &self,
        builder: &mut SyntheticRepoBuilder,
        target_sloc: usize,
    ) -> Result<GroundTruthManifest, String> {
        builder.write_cargo_workspace(
            &["domain", "ports", "application", "infrastructure", "adapter-tauri"],
            Some("hexagonal"),
        );

        builder.write_package_manifest("domain", "domain", &[]);
        builder.write_package_manifest("ports", "ports", &[("domain", Some("../domain"))]);
        builder.write_package_manifest(
            "application",
            "application",
            &[("domain", Some("../domain")), ("ports", Some("../ports"))],
        );
        builder.write_package_manifest(
            "infrastructure",
            "infrastructure",
            &[("domain", Some("../domain")), ("ports", Some("../ports"))],
        );
        builder.write_package_manifest(
            "adapter-tauri",
            "adapter",
            &[
                ("domain", Some("../domain")),
                ("ports", Some("../ports")),
                ("application", Some("../application")),
            ],
        );

        let per_crate_sloc = target_sloc / 5;
        let mut all_files = Vec::new();
        let mut expected_violations = Vec::new();

        let (dom_files, mut dom_viol) =
            ScaleHelper::generate_rust_modules("domain", "domain", per_crate_sloc, true);
        all_files.extend(dom_files);
        expected_violations.append(&mut dom_viol);

        let (ports_files, _) =
            ScaleHelper::generate_rust_modules("ports", "ports", per_crate_sloc, false);
        all_files.extend(ports_files);

        let (app_files, mut app_viol) =
            ScaleHelper::generate_rust_modules("application", "application", per_crate_sloc, true);
        all_files.extend(app_files);
        expected_violations.append(&mut app_viol);

        let (infra_files, mut infra_viol) = ScaleHelper::generate_rust_modules(
            "infrastructure",
            "infrastructure",
            per_crate_sloc,
            true,
        );
        all_files.extend(infra_files);
        expected_violations.append(&mut infra_viol);

        let (adapter_files, _) = ScaleHelper::generate_rust_modules(
            "adapter-tauri",
            "adapter",
            per_crate_sloc,
            false,
        );
        all_files.extend(adapter_files);

        builder.write_files_parallel(all_files);

        Ok(GroundTruthManifest {
            paradigm_name: self.name(),
            total_files: builder.total_files,
            approximate_sloc: builder.total_sloc,
            expected_violations,
        })
    }
}
