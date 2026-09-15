use crate::domain::rules::{Category, Severity, Violation, compute_fingerprint};
use std::path::Path;

pub struct LifecycleRuleChecker;

impl LifecycleRuleChecker {
    pub fn check_typescript_file(content: &str, file_path: &Path) -> Vec<Violation> {
        let mut violations = Vec::new();

        let path_str = file_path.to_string_lossy();
        if path_str.contains(".spec.") || path_str.contains(".test.") || path_str.contains("__tests__") {
            return violations;
        }

        let has_event_listener = content.contains("addEventListener(");
        let has_interval = content.contains("setInterval(");
        let has_tauri_listen = content.contains("listen(") && !path_str.contains("test");

        if has_event_listener || has_interval || has_tauri_listen {
            let has_unmounted = content.contains("onUnmounted(")
                || content.contains("onBeforeUnmount(")
                || content.contains("tryOnScopeDispose(")
                || content.contains("tryOnUnmounted(");

            if !has_unmounted {
                let trigger = if has_tauri_listen {
                    "Tauri event listener 'listen()'"
                } else if has_event_listener {
                    "DOM listener 'addEventListener()'"
                } else {
                    "Timer 'setInterval()'"
                };

                let snippet = content
                    .lines()
                    .filter(|l| {
                        l.contains("addEventListener(")
                            || l.contains("setInterval(")
                            || l.contains("listen(")
                    })
                    .take(3)
                    .collect::<Vec<_>>()
                    .join("\n");

                let file_stem = file_path.file_stem().map_or("ts_module", |s| s.to_str().unwrap_or("ts_module"));
                let fingerprint = compute_fingerprint("LEAK-001", "1.0", file_stem, &snippet);

                violations.push(Violation {
                    rule_id: "LEAK-001".into(),
                    rule_version: "1.0".into(),
                    category: Category::Robustness,
                    severity: Severity::Deny,
                    file: file_path.to_path_buf(),
                    line: 1,
                    column: 1,
                    symbol: file_stem.to_string(),
                    snippet,
                    message: format!("{} registered without symmetric onUnmounted cleanup hook.", trigger),
                    remediation: "Add onUnmounted(() => { unlisten(); removeEventListener(...); clearInterval(...); }) to prevent memory leaks.".into(),
                    fingerprint,
                });
            }
        }

        violations
    }
}
