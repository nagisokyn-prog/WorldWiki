use crate::synthetic_matrix::generator_trait::{ArchFixtureGenerator, GroundTruthManifest, SeededViolation};
use crate::synthetic_matrix::repo_builder::SyntheticRepoBuilder;
use crate::synthetic_matrix::scale_helper::ScaleHelper;

pub struct VueFsdFixture;

impl ArchFixtureGenerator for VueFsdFixture {
    fn name(&self) -> &'static str {
        "11. Vue Feature-Sliced Design (Strict Slice Hierarchy)"
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
            "apps/spa/src/shared/ui/Button.vue".into(),
            "<template><button><slot /></button></template>\n<script setup lang=\"ts\">\n</script>\n<style scoped>\nbutton { color: var(--color-text-primary); }\n</style>\n".into(),
        ));
        files.push((
            "apps/spa/src/entities/user/UserCard.vue".into(),
            "<template><div class=\"user-card\">User</div></template>\n<script setup lang=\"ts\">\n</script>\n<style scoped>\n.user-card { color: var(--color-text-primary); }\n</style>\n".into(),
        ));
        files.push((
            "apps/spa/src/features/auth/LoginForm.vue".into(),
            "<template><form>Login</form></template>\n<script setup lang=\"ts\">\n</script>\n<style scoped>\nform { color: var(--color-text-primary); }\n</style>\n".into(),
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

        // Seeded Violation: Entity imports from Feature layer (FSD layer inversion)
        files.push((
            "apps/spa/src/entities/user/InvertedCard.vue".into(),
            "<template><div>Inverted</div></template>\n<script setup lang=\"ts\">\nimport { LoginForm } from '@/features/auth/LoginForm.vue';\n</script>\n".into(),
        ));

        builder.write_files_parallel(files);

        Ok(GroundTruthManifest {
            paradigm_name: self.name(),
            total_files: builder.total_files,
            approximate_sloc: builder.total_sloc,
            expected_violations: vec![SeededViolation {
                rule_id: "FSD-001".into(),
                target_file_suffix: "entities/user/InvertedCard.vue".into(),
                description: "FSD slice violation: 'entities' cannot import from higher slice 'features'".into(),
            }],
        })
    }
}
