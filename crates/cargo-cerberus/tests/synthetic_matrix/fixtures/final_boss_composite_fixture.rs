use crate::synthetic_matrix::generator_trait::{ArchFixtureGenerator, GroundTruthManifest, SeededViolation};
use crate::synthetic_matrix::repo_builder::SyntheticRepoBuilder;

pub struct FinalBossCompositeFixture;

impl ArchFixtureGenerator for FinalBossCompositeFixture {
    fn name(&self) -> &'static str {
        "15. Final Boss (Composite Mega-Monorepo)"
    }

    fn generate_clean(&self, builder: &mut SyntheticRepoBuilder) -> Result<(), String> {
        builder.write_cargo_workspace(&["domain", "commands", "queries", "infrastructure"], Some("final_boss"));

        builder.write_package_manifest("domain", "domain", &[]);
        builder.write_file("domain/src/lib.rs", "pub struct CoreEntity { pub id: u64 }");

        builder.write_package_manifest("commands", "commands", &[("domain", Some("../domain"))]);
        builder.write_file("commands/src/lib.rs", "pub fn execute_cmd() {}");

        builder.write_package_manifest("queries", "queries", &[("domain", Some("../domain"))]);
        builder.write_file("queries/src/lib.rs", "pub fn execute_query() {}");

        builder.write_package_manifest("infrastructure", "infrastructure", &[("domain", Some("../domain")), ("commands", Some("../commands")), ("queries", Some("../queries"))]);
        builder.write_file("infrastructure/src/lib.rs", "pub fn init_infra() {}");

        builder.write_file("apps/spa/src/components/Card.vue", "<template><div class=\"card\">Clean</div></template>\n<script setup lang=\"ts\"></script>");

        Ok(())
    }

    fn generate_seeded(&self, builder: &mut SyntheticRepoBuilder) -> Result<GroundTruthManifest, String> {
        self.generate_clean(builder)?;

        // Seeded Violation 1: Domain imports reqwest (ARCH-001)
        builder.write_file("domain/src/leak.rs", "use reqwest::Client;\npub fn leaky() {}");

        // Seeded Violation 2: Direct Tauri IPC in Vue SFC (TAURI-002)
        builder.write_file("apps/spa/src/components/BadIpc.vue", "<template><div>Bad</div></template>\n<script setup lang=\"ts\">\nimport { invoke } from '@tauri-apps/api/core';\ninvoke('do_something');\n</script>");

        Ok(GroundTruthManifest {
            paradigm_name: self.name(),
            total_files: builder.total_files,
            approximate_sloc: builder.total_sloc,
            expected_violations: vec![
                SeededViolation {
                    rule_id: "ARCH-001".into(),
                    target_file_suffix: "domain/src/leak.rs".into(),
                    description: "Domain crate cannot import external framework 'reqwest'".into(),
                },
                SeededViolation {
                    rule_id: "TAURI-002".into(),
                    target_file_suffix: "apps/spa/src/components/BadIpc.vue".into(),
                    description: "Direct Tauri IPC in Vue SFC".into(),
                },
            ],
        })
    }
}
