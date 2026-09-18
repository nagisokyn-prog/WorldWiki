use crate::synthetic_matrix::generator_trait::{ArchFixtureGenerator, GroundTruthManifest, SeededViolation};
use crate::synthetic_matrix::repo_builder::SyntheticRepoBuilder;
use crate::synthetic_matrix::scale_helper::ScaleHelper;

pub struct OnionFixture;

impl ArchFixtureGenerator for OnionFixture {
    fn name(&self) -> &'static str {
        "7. Onion Architecture (Core Zero-Dep Invariant)"
    }

    fn default_target_sloc(&self) -> usize {
        300_000
    }

    fn generate_clean(
        &self,
        builder: &mut SyntheticRepoBuilder,
        target_sloc: usize,
    ) -> Result<(), String> {
        builder.write_cargo_workspace(
            &["onion-core", "onion-services", "onion-infra"],
            Some("onion"),
        );

        builder.write_package_manifest("onion-core", "domain_core", &[]);
        builder.write_package_manifest(
            "onion-services",
            "domain_services",
            &[("onion-core", Some("../onion-core"))],
        );
        builder.write_package_manifest(
            "onion-infra",
            "infra",
            &[
                ("onion-core", Some("../onion-core")),
                ("onion-services", Some("../onion-services")),
            ],
        );

        let per_crate_sloc = target_sloc / 3;
        let mut all_files = Vec::new();

        let (core_files, _) =
            ScaleHelper::generate_rust_modules("onion-core", "domain_core", per_crate_sloc, false);
        all_files.extend(core_files);

        let (svc_files, _) = ScaleHelper::generate_rust_modules(
            "onion-services",
            "domain_services",
            per_crate_sloc,
            false,
        );
        all_files.extend(svc_files);

        let (infra_files, _) =
            ScaleHelper::generate_rust_modules("onion-infra", "infra", per_crate_sloc, false);
        all_files.extend(infra_files);

        builder.write_files_parallel(all_files);

        Ok(())
    }

    fn generate_seeded(
        &self,
        builder: &mut SyntheticRepoBuilder,
        target_sloc: usize,
    ) -> Result<GroundTruthManifest, String> {
        builder.write_cargo_workspace(
            &["onion-core", "onion-services", "onion-infra"],
            Some("onion"),
        );

        builder.write_package_manifest("onion-core", "domain_core", &[]);
        builder.write_package_manifest(
            "onion-services",
            "domain_services",
            &[("onion-core", Some("../onion-core"))],
        );
        builder.write_package_manifest(
            "onion-infra",
            "infra",
            &[
                ("onion-core", Some("../onion-core")),
                ("onion-services", Some("../onion-services")),
            ],
        );

        let per_crate_sloc = target_sloc / 3;
        let mut all_files = Vec::new();
        let mut expected_violations = Vec::new();

        let (core_files, mut core_viol) =
            ScaleHelper::generate_rust_modules("onion-core", "domain_core", per_crate_sloc, true);
        all_files.extend(core_files);
        expected_violations.append(&mut core_viol);

        let (svc_files, _) = ScaleHelper::generate_rust_modules(
            "onion-services",
            "domain_services",
            per_crate_sloc,
            false,
        );
        all_files.extend(svc_files);

        let (infra_files, _) =
            ScaleHelper::generate_rust_modules("onion-infra", "infra", per_crate_sloc, false);
        all_files.extend(infra_files);

        builder.write_files_parallel(all_files);

        Ok(GroundTruthManifest {
            paradigm_name: self.name(),
            total_files: builder.total_files,
            approximate_sloc: builder.total_sloc,
            expected_violations,
        })
    }
}
