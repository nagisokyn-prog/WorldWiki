use crate::synthetic_matrix::generator_trait::{ArchFixtureGenerator, GroundTruthManifest, SeededViolation};
use crate::synthetic_matrix::repo_builder::SyntheticRepoBuilder;

pub struct VueFsdFixture;

impl ArchFixtureGenerator for VueFsdFixture {
    fn name(&self) -> &'static str {
        "11. Vue Feature-Sliced Design (Strict Slice Hierarchy)"
    }

    fn generate_clean(&self, builder: &mut SyntheticRepoBuilder) -> Result<(), String> {
        builder.write_file("src/shared/ui/Button.vue", "<template><button><slot /></button></template>\n<script setup lang=\"ts\">\n</script>");
        builder.write_file("src/entities/user/UserCard.vue", "<template><div class=\"user-card\">User</div></template>\n<script setup lang=\"ts\">\n</script>");
        builder.write_file("src/features/auth/LoginForm.vue", "<template><form>Login</form></template>\n<script setup lang=\"ts\">\n</script>");
        builder.write_file("src/widgets/header/Header.vue", "<template><header>Header</header></template>\n<script setup lang=\"ts\">\n</script>");
        builder.write_file("src/pages/home/HomePage.vue", "<template><main>Home</main></template>\n<script setup lang=\"ts\">\n</script>");
        Ok(())
    }

    fn generate_seeded(&self, builder: &mut SyntheticRepoBuilder) -> Result<GroundTruthManifest, String> {
        self.generate_clean(builder)?;

        // Seeded Violation: Entity imports from Feature layer (FSD layer inversion)
        builder.write_file(
            "src/entities/user/InvertedCard.vue",
            "<template><div>Inverted</div></template>\n<script setup lang=\"ts\">\nimport { LoginForm } from '@/features/auth/LoginForm.vue';\n</script>",
        );

        Ok(GroundTruthManifest {
            paradigm_name: self.name(),
            total_files: builder.total_files,
            approximate_sloc: builder.total_sloc,
            expected_violations: vec![
                SeededViolation {
                    rule_id: "FSD-001".into(),
                    target_file_suffix: "src/entities/user/InvertedCard.vue".into(),
                    description: "FSD slice violation: 'entities' cannot import from higher slice 'features'".into(),
                },
            ],
        })
    }
}
