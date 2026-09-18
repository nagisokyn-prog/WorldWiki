use crate::synthetic_matrix::generator_trait::{ArchFixtureGenerator, GroundTruthManifest, SeededViolation};
use crate::synthetic_matrix::repo_builder::SyntheticRepoBuilder;
use crate::synthetic_matrix::scale_helper::ScaleHelper;

pub struct MicroservicesFixture;

impl ArchFixtureGenerator for MicroservicesFixture {
    fn name(&self) -> &'static str {
        "4. Microservices Workspace (Bounded Context Isolation)"
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
            &["shared-proto", "service-auth", "service-billing"],
            Some("final_boss"),
        );

        builder.write_package_manifest("shared-proto", "shared_proto", &[]);
        builder.write_package_manifest(
            "service-auth",
            "service_auth",
            &[("shared-proto", Some("../shared-proto"))],
        );
        builder.write_package_manifest(
            "service-billing",
            "service_billing",
            &[("shared-proto", Some("../shared-proto"))],
        );

        let proto_sloc = target_sloc * 10 / 100;
        let auth_sloc = target_sloc * 45 / 100;
        let bill_sloc = target_sloc.saturating_sub(proto_sloc + auth_sloc);
        let mut all_files = Vec::new();

        let (proto_files, _) = ScaleHelper::generate_rust_modules(
            "shared-proto",
            "shared_proto",
            proto_sloc,
            false,
        );
        all_files.extend(proto_files);

        let (auth_files, _) =
            ScaleHelper::generate_rust_modules("service-auth", "service_auth", auth_sloc, false);
        all_files.extend(auth_files);

        let (bill_files, _) = ScaleHelper::generate_rust_modules(
            "service-billing",
            "service_billing",
            bill_sloc,
            false,
        );
        all_files.extend(bill_files);

        builder.write_files_parallel(all_files);

        Ok(())
    }

    fn generate_seeded(
        &self,
        builder: &mut SyntheticRepoBuilder,
        target_sloc: usize,
    ) -> Result<GroundTruthManifest, String> {
        builder.write_cargo_workspace(
            &["shared-proto", "service-auth", "service-billing"],
            Some("final_boss"),
        );

        builder.write_package_manifest("shared-proto", "shared_proto", &[]);

        // Seeded Violation: service-auth directly depends on service-billing (Bounded context leak)
        builder.write_package_manifest(
            "service-auth",
            "service_auth",
            &[
                ("shared-proto", Some("../shared-proto")),
                ("service-billing", Some("../service-billing")),
            ],
        );

        builder.write_package_manifest(
            "service-billing",
            "service_billing",
            &[("shared-proto", Some("../shared-proto"))],
        );

        let proto_sloc = target_sloc * 10 / 100;
        let auth_sloc = target_sloc * 45 / 100;
        let bill_sloc = target_sloc.saturating_sub(proto_sloc + auth_sloc);
        let mut all_files = Vec::new();
        let expected_violations = vec![SeededViolation {
            rule_id: "ARCH-020".into(),
            target_file_suffix: "service-auth/Cargo.toml".into(),
            description: "Bounded context violation: service_auth cannot depend directly on service_billing".into(),
        }];

        let (proto_files, _) = ScaleHelper::generate_rust_modules(
            "shared-proto",
            "shared_proto",
            proto_sloc,
            false,
        );
        all_files.extend(proto_files);

        let (auth_files, _) =
            ScaleHelper::generate_rust_modules("service-auth", "service_auth", auth_sloc, false);
        all_files.extend(auth_files);

        let (bill_files, _) = ScaleHelper::generate_rust_modules(
            "service-billing",
            "service_billing",
            bill_sloc,
            false,
        );
        all_files.extend(bill_files);

        builder.write_files_parallel(all_files);

        Ok(GroundTruthManifest {
            paradigm_name: self.name(),
            total_files: builder.total_files,
            approximate_sloc: builder.total_sloc,
            expected_violations,
        })
    }
}
