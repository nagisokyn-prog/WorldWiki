use crate::synthetic_matrix::generator_trait::{ArchFixtureGenerator, GroundTruthManifest, SeededViolation};
use crate::synthetic_matrix::repo_builder::SyntheticRepoBuilder;

pub struct MicrokernelFixture;

impl ArchFixtureGenerator for MicrokernelFixture {
    fn name(&self) -> &'static str {
        "8. Microkernel (Plugin Architecture)"
    }

    fn generate_clean(&self, builder: &mut SyntheticRepoBuilder) -> Result<(), String> {
        builder.write_cargo_workspace(&["kernel-core", "kernel-api", "kernel-plugin-pdf"], Some("microkernel"));

        builder.write_package_manifest("kernel-api", "plugin_api", &[]);
        builder.write_file("kernel-api/src/lib.rs", "pub trait Plugin { fn name(&self) -> &str; }");

        builder.write_package_manifest("kernel-core", "core", &[("kernel-api", Some("../kernel-api"))]);
        builder.write_file("kernel-core/src/lib.rs", "use kernel_api::Plugin;\npub fn load_plugin(_p: &dyn Plugin) {}");

        builder.write_package_manifest("kernel-plugin-pdf", "plugin", &[("kernel-api", Some("../kernel-api"))]);
        builder.write_file("kernel-plugin-pdf/src/lib.rs", "use kernel_api::Plugin;\npub struct PdfPlugin;\nimpl Plugin for PdfPlugin { fn name(&self) -> &str { \"pdf\" } }");

        Ok(())
    }

    fn generate_seeded(&self, builder: &mut SyntheticRepoBuilder) -> Result<GroundTruthManifest, String> {
        builder.write_cargo_workspace(&["kernel-core", "kernel-api", "kernel-plugin-pdf"], Some("microkernel"));

        builder.write_package_manifest("kernel-api", "plugin_api", &[]);
        builder.write_file("kernel-api/src/lib.rs", "pub trait Plugin { fn name(&self) -> &str; }");

        builder.write_package_manifest("kernel-core", "core", &[("kernel-api", Some("../kernel-api"))]);
        builder.write_file("kernel-core/src/lib.rs", "pub fn load_plugin() {}");

        // Seeded Violation: Plugin directly depends on Kernel Core instead of Kernel API (ARCH-020)
        builder.write_package_manifest("kernel-plugin-pdf", "plugin", &[("kernel-api", Some("../kernel-api")), ("kernel-core", Some("../kernel-core"))]);
        builder.write_file("kernel-plugin-pdf/src/lib.rs", "use kernel_api::Plugin;\npub struct PdfPlugin;");

        Ok(GroundTruthManifest {
            paradigm_name: self.name(),
            total_files: builder.total_files,
            approximate_sloc: builder.total_sloc,
            expected_violations: vec![
                SeededViolation {
                    rule_id: "ARCH-020".into(),
                    target_file_suffix: "kernel-plugin-pdf/Cargo.toml".into(),
                    description: "Plugin cannot directly depend on core in microkernel preset".into(),
                },
            ],
        })
    }
}
