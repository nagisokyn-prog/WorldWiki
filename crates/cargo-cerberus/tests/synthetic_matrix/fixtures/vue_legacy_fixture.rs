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
        let (mut files, _) = ScaleHelper::generate_vue_modules("apps/spa", target_sloc, false);

        files.push((
            "apps/spa/src/components/CleanModal.vue".into(),
            "<template><div class=\"modal\"><slot /></div></template>\n<script setup lang=\"ts\">\n</script>\n<style scoped>\n.modal { color: var(--color-text-primary); border-radius: var(--border-radius-md); }\n</style>\n".into(),
        ));

        builder.write_files_parallel(files);

        Ok(())
    }

    fn generate_seeded(
        &self,
        builder: &mut SyntheticRepoBuilder,
        target_sloc: usize,
    ) -> Result<GroundTruthManifest, String> {
        let (mut files, _) = ScaleHelper::generate_vue_modules("apps/spa", target_sloc, false);

        // Seeded Violation 1: Direct Tauri IPC in Vue component (TAURI-002)
        // Seeded Violation 2: Hardcoded CSS Hex color (CSS-001)
        files.push((
            "apps/spa/src/components/LegacyGodComponent.vue".into(),
            "<template><div class=\"card\">Bad</div></template>\n<script setup lang=\"ts\">\nimport { invoke } from '@tauri-apps/api/core';\ninvoke('direct_db_save');\n</script>\n<style scoped>\n.card { color: #ff0055; }\n</style>\n".into(),
        ));

        builder.write_files_parallel(files);

        Ok(GroundTruthManifest {
            paradigm_name: self.name(),
            total_files: builder.total_files,
            approximate_sloc: builder.total_sloc,
            expected_violations: vec![
                SeededViolation {
                    rule_id: "TAURI-002".into(),
                    target_file_suffix: "LegacyGodComponent.vue".into(),
                    description: "Direct Tauri IPC in Vue SFC".into(),
                },
                SeededViolation {
                    rule_id: "CSS-004".into(),
                    target_file_suffix: "LegacyGodComponent.vue".into(),
                    description: "Hardcoded CSS hex color #ff0055".into(),
                },
            ],
        })
    }
}
