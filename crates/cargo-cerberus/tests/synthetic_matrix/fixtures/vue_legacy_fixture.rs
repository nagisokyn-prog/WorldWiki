use crate::synthetic_matrix::generator_trait::{ArchFixtureGenerator, GroundTruthManifest, SeededViolation};
use crate::synthetic_matrix::repo_builder::SyntheticRepoBuilder;
use crate::synthetic_matrix::scale_helper::ScaleHelper;

pub struct VueLegacyFixture;

impl ArchFixtureGenerator for VueLegacyFixture {
    fn name(&self) -> &'static str {
        "12. Vue Options API & Legacy Anti-Pattern Guard"
    }

    fn default_target_sloc(&self) -> usize {
        400_000
    }

    fn generate_clean(
        &self,
        builder: &mut SyntheticRepoBuilder,
        target_sloc: usize,
    ) -> Result<(), String> {
        let (files, _) = ScaleHelper::generate_vue_legacy_modules("apps/spa", target_sloc, false);
        builder.write_files_parallel(files);
        Ok(())
    }

    fn generate_seeded(
        &self,
        builder: &mut SyntheticRepoBuilder,
        target_sloc: usize,
    ) -> Result<GroundTruthManifest, String> {
        let (files, expected_violations) =
            ScaleHelper::generate_vue_legacy_modules("apps/spa", target_sloc, true);

        builder.write_files_parallel(files);

        Ok(GroundTruthManifest {
            paradigm_name: self.name(),
            total_files: builder.total_files,
            approximate_sloc: builder.total_sloc,
            expected_violations,
        })
    }
}
