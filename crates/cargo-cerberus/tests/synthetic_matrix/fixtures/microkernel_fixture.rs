use crate::synthetic_matrix::generator_trait::{ArchFixtureGenerator, GroundTruthManifest, SeededViolation};
use crate::synthetic_matrix::repo_builder::SyntheticRepoBuilder;
use crate::synthetic_matrix::scale_helper::ScaleHelper;

pub struct MicrokernelFixture;

impl ArchFixtureGenerator for MicrokernelFixture {
    fn name(&self) -> &'static str {
        "8. Microkernel (Plugin Architecture)"
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
            &["kernel-core", "kernel-api", "kernel-plugin-pdf"],
            Some("microkernel"),
        );

        builder.write_package_manifest("kernel-api", "plugin_api", &[]);
        builder.write_package_manifest(
            "kernel-core",
            "core",
            &[("kernel-api", Some("../kernel-api"))],
        );
        builder.write_package_manifest(
            "kernel-plugin-pdf",
            "plugin",
            &[("kernel-api", Some("../kernel-api"))],
        );

        let per_crate_sloc = target_sloc / 3;
        let mut all_files = Vec::new();

        let (api_files, _) =
            ScaleHelper::generate_rust_modules("kernel-api", "plugin_api", per_crate_sloc, false);
        all_files.extend(api_files);

        let (core_files, _) =
            ScaleHelper::generate_rust_modules("kernel-core", "core", per_crate_sloc, false);
        all_files.extend(core_files);

        let (plugin_files, _) = ScaleHelper::generate_rust_modules(
            "kernel-plugin-pdf",
            "plugin",
            per_crate_sloc,
            false,
        );
        all_files.extend(plugin_files);

        builder.write_files_parallel(all_files);

        Ok(())
    }

    fn generate_seeded(
        &self,
        builder: &mut SyntheticRepoBuilder,
        target_sloc: usize,
    ) -> Result<GroundTruthManifest, String> {
        builder.write_cargo_workspace(
            &["kernel-core", "kernel-api", "kernel-plugin-pdf"],
            Some("microkernel"),
        );

        builder.write_package_manifest("kernel-api", "plugin_api", &[]);
        builder.write_package_manifest(
            "kernel-core",
            "core",
            &[("kernel-api", Some("../kernel-api"))],
        );

        // Seeded Violation: Plugin directly depends on Kernel Core instead of Kernel API (ARCH-020)
        builder.write_package_manifest(
            "kernel-plugin-pdf",
            "plugin",
            &[
                ("kernel-api", Some("../kernel-api")),
                ("kernel-core", Some("../kernel-core")),
            ],
        );

        let per_crate_sloc = target_sloc / 3;
        let mut all_files = Vec::new();
        let expected_violations = vec![SeededViolation {
            rule_id: "ARCH-020".into(),
            target_file_suffix: "kernel-plugin-pdf/Cargo.toml".into(),
            description: "Plugin cannot directly depend on core in microkernel preset".into(),
        }];

        let (api_files, _) =
            ScaleHelper::generate_rust_modules("kernel-api", "plugin_api", per_crate_sloc, false);
        all_files.extend(api_files);

        let (core_files, _) =
            ScaleHelper::generate_rust_modules("kernel-core", "core", per_crate_sloc, false);
        all_files.extend(core_files);

        let (plugin_files, _) = ScaleHelper::generate_rust_modules(
            "kernel-plugin-pdf",
            "plugin",
            per_crate_sloc,
            false,
        );
        all_files.extend(plugin_files);

        builder.write_files_parallel(all_files);

        Ok(GroundTruthManifest {
            paradigm_name: self.name(),
            total_files: builder.total_files,
            approximate_sloc: builder.total_sloc,
            expected_violations,
        })
    }
}
