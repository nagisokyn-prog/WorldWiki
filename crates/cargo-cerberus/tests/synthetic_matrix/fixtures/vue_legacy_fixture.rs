use crate::synthetic_matrix::generator_trait::{ArchFixtureGenerator, GroundTruthManifest, SeededViolation};
use crate::synthetic_matrix::repo_builder::SyntheticRepoBuilder;

pub struct VueLegacyFixture;

impl ArchFixtureGenerator for VueLegacyFixture {
    fn name(&self) -> &'static str {
        "12. Vue Options API & Legacy Anti-Pattern Guard"
    }

    fn generate_clean(&self, builder: &mut SyntheticRepoBuilder) -> Result<(), String> {
        builder.write_file(
            "src/components/CleanModal.vue",
            "<template><div class=\"modal\"><slot /></div></template>\n<script setup lang=\"ts\">\n</script>\n<style scoped>\n.modal { color: var(--color-text-primary); border-radius: var(--border-radius-md); }\n</style>",
        );
        Ok(())
    }

    fn generate_seeded(&self, builder: &mut SyntheticRepoBuilder) -> Result<GroundTruthManifest, String> {
        self.generate_clean(builder)?;

        // Seeded Violation 1: Direct Tauri IPC in Vue component (TAURI-002)
        // Seeded Violation 2: Hardcoded CSS Hex color (CSS-001)
        builder.write_file(
            "src/components/LegacyGodComponent.vue",
            "<template><div class=\"card\">Bad</div></template>\n<script setup lang=\"ts\">\nimport { invoke } from '@tauri-apps/api/core';\ninvoke('direct_db_save');\n</script>\n<style scoped>\n.card { color: #ff0055; }\n</style>",
        );

        Ok(GroundTruthManifest {
            paradigm_name: self.name(),
            total_files: builder.total_files,
            approximate_sloc: builder.total_sloc,
            expected_violations: vec![
                SeededViolation {
                    rule_id: "TAURI-002".into(),
                    target_file_suffix: "src/components/LegacyGodComponent.vue".into(),
                    description: "Direct Tauri IPC in Vue SFC".into(),
                },
                SeededViolation {
                    rule_id: "CSS-001".into(),
                    target_file_suffix: "src/components/LegacyGodComponent.vue".into(),
                    description: "Hardcoded CSS hex color #ff0055".into(),
                },
            ],
        })
    }
}
