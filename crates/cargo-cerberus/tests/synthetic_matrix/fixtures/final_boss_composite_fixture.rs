use crate::synthetic_matrix::generator_trait::{ArchFixtureGenerator, GroundTruthManifest, SeededViolation};
use crate::synthetic_matrix::repo_builder::SyntheticRepoBuilder;
use crate::synthetic_matrix::scale_helper::ScaleHelper;

pub struct FinalBossCompositeFixture;

impl ArchFixtureGenerator for FinalBossCompositeFixture {
    fn name(&self) -> &'static str {
        "15. Final Boss (Composite Mega-Monorepo)"
    }

    fn default_target_sloc(&self) -> usize {
        500_000
    }

    fn generate_clean(
        &self,
        builder: &mut SyntheticRepoBuilder,
        target_sloc: usize,
    ) -> Result<(), String> {
        builder.write_cargo_workspace(
            &["domain", "commands", "queries", "infrastructure"],
            Some("final_boss"),
        );

        builder.write_package_manifest("domain", "domain", &[]);
        builder.write_package_manifest("commands", "commands", &[("domain", Some("../domain"))]);
        builder.write_package_manifest("queries", "queries", &[("domain", Some("../domain"))]);
        builder.write_package_manifest(
            "infrastructure",
            "infrastructure",
            &[
                ("domain", Some("../domain")),
                ("commands", Some("../commands")),
                ("queries", Some("../queries")),
            ],
        );

        let per_crate_sloc = target_sloc / 5;
        let mut all_files = Vec::new();

        let (dom_files, _) =
            ScaleHelper::generate_rust_modules("domain", "domain", per_crate_sloc, false);
        all_files.extend(dom_files);

        let (cmd_files, _) =
            ScaleHelper::generate_rust_modules("commands", "commands", per_crate_sloc, false);
        all_files.extend(cmd_files);

        let (query_files, _) =
            ScaleHelper::generate_rust_modules("queries", "queries", per_crate_sloc, false);
        all_files.extend(query_files);

        let (infra_files, _) = ScaleHelper::generate_rust_modules(
            "infrastructure",
            "infrastructure",
            per_crate_sloc,
            false,
        );
        all_files.extend(infra_files);

        let (spa_files, _) =
            ScaleHelper::generate_vue_modules("apps/spa", per_crate_sloc, false);
        all_files.extend(spa_files);

        builder.write_files_parallel(all_files);

        Ok(())
    }

    fn generate_seeded(
        &self,
        builder: &mut SyntheticRepoBuilder,
        target_sloc: usize,
    ) -> Result<GroundTruthManifest, String> {
        builder.write_cargo_workspace(
            &["domain", "commands", "queries", "infrastructure"],
            Some("final_boss"),
        );

        builder.write_package_manifest("domain", "domain", &[]);
        builder.write_package_manifest("commands", "commands", &[("domain", Some("../domain"))]);
        builder.write_package_manifest("queries", "queries", &[("domain", Some("../domain"))]);
        builder.write_package_manifest(
            "infrastructure",
            "infrastructure",
            &[
                ("domain", Some("../domain")),
                ("commands", Some("../commands")),
                ("queries", Some("../queries")),
            ],
        );

        let per_crate_sloc = target_sloc / 5;
        let mut all_files = Vec::new();
        let mut expected_violations = Vec::new();

        let (dom_files, mut dom_viol) =
            ScaleHelper::generate_rust_modules("domain", "domain", per_crate_sloc, true);
        all_files.extend(dom_files);
        expected_violations.append(&mut dom_viol);

        let (cmd_files, mut cmd_viol) =
            ScaleHelper::generate_rust_modules("commands", "commands", per_crate_sloc, true);
        all_files.extend(cmd_files);
        expected_violations.append(&mut cmd_viol);

        let (query_files, _) =
            ScaleHelper::generate_rust_modules("queries", "queries", per_crate_sloc, false);
        all_files.extend(query_files);

        let (infra_files, mut infra_viol) = ScaleHelper::generate_rust_modules(
            "infrastructure",
            "infrastructure",
            per_crate_sloc,
            true,
        );
        all_files.extend(infra_files);
        expected_violations.append(&mut infra_viol);

        let (spa_files, mut spa_viol) =
            ScaleHelper::generate_vue_modules("apps/spa", per_crate_sloc, true);
        all_files.extend(spa_files);
        expected_violations.append(&mut spa_viol);

        builder.write_files_parallel(all_files);

        Ok(GroundTruthManifest {
            paradigm_name: self.name(),
            total_files: builder.total_files,
            approximate_sloc: builder.total_sloc,
            expected_violations,
        })
    }
}
