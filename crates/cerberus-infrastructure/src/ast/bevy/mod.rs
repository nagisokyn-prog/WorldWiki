pub mod api_checker;
pub mod async_checker;
pub mod context;
pub mod ecs_checker;
pub mod helpers;
pub mod perf_checker;
pub mod query_checker;
pub mod sched_checker;

pub use api_checker::BevyApiChecker;
pub use async_checker::BevyAsyncChecker;
pub use context::BevyScanContext;
pub use ecs_checker::BevyEcsChecker;
pub use helpers::*;
pub use perf_checker::BevyPerfChecker;
pub use query_checker::BevyQueryChecker;
pub use sched_checker::BevySchedChecker;

use cerberus_domain::{RuleDefinition, Violation};

/// Run all Bevy-specific AST checkers on a single parsed file
pub fn run_all_bevy_checks(
    syntax: &syn::File,
    file_path: &str,
    rules: &[RuleDefinition],
    ctx: &BevyScanContext,
) -> Vec<Violation> {
    if !ctx.is_bevy_project {
        return Vec::new();
    }

    let mut violations = Vec::new();

    let api_checker = BevyApiChecker::new(file_path, rules, ctx);
    violations.extend(api_checker.check_file(syntax));

    let sched_checker = BevySchedChecker::new(file_path, rules, ctx);
    violations.extend(sched_checker.check_file(syntax));

    let ecs_checker = BevyEcsChecker::new(file_path, rules, ctx);
    violations.extend(ecs_checker.check_file(syntax));

    let query_checker = BevyQueryChecker::new(file_path, rules, ctx);
    violations.extend(query_checker.check_file(syntax));

    let async_checker = BevyAsyncChecker::new(file_path, rules, ctx);
    violations.extend(async_checker.check_file(syntax));

    let perf_checker = BevyPerfChecker::new(file_path, rules, ctx);
    violations.extend(perf_checker.check_file(syntax));

    violations
}
