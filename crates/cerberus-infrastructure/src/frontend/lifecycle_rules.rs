use cerberus_domain::{compute_fingerprint, Category, Severity, Violation};

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
                || content.contains("onScopeDispose(")
                || content.contains("tryOnScopeDispose(")
                || content.contains("tryOnUnmounted(")
                || content.contains("unmounted(")
                || content.contains("beforeUnmount(");

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

                let line = content
                    .lines()
                    .enumerate()
                    .find_map(|(idx, l)| {
                        if l.contains("addEventListener(")
                            || l.contains("setInterval(")
                            || l.contains("listen(")
                        {
                            Some(idx + 1)
                        } else {
                            None
                        }
                    })
                    .unwrap_or(1);

                violations.push(Violation {
                    rule_id: "LEAK-001".into(),
                    rule_version: "1.0".into(),
                    category: Category::Robustness,
                    severity: Severity::Deny,
                    file: file_path.to_path_buf(),
                    line,
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_lifecycle_rule_checker_memory_leak_leak001() {
        // 1. Missing cleanup for addEventListener
        let leak_listener = "window.addEventListener('resize', handleResize);";
        let v1 = LifecycleRuleChecker::check_typescript_file(leak_listener, Path::new("src/useWindow.ts"));
        assert_eq!(v1.len(), 1);
        assert_eq!(v1[0].rule_id, "LEAK-001");

        // 2. Missing cleanup for setInterval
        let leak_timer = "setInterval(tick, 1000);";
        let v2 = LifecycleRuleChecker::check_typescript_file(leak_timer, Path::new("src/useTimer.ts"));
        assert_eq!(v2.len(), 1);
        assert_eq!(v2[0].rule_id, "LEAK-001");

        // 3. Proper cleanup with onUnmounted
        let clean = r#"
            window.addEventListener('resize', handleResize);
            onUnmounted(() => { window.removeEventListener('resize', handleResize); });
        "#;
        let v3 = LifecycleRuleChecker::check_typescript_file(clean, Path::new("src/useWindow.ts"));
        assert!(v3.is_empty());

        // 4. Ignored in test / spec files
        let test_file = "window.addEventListener('click', fn);";
        let v4 = LifecycleRuleChecker::check_typescript_file(test_file, Path::new("src/useWindow.spec.ts"));
        assert!(v4.is_empty());

        // 5. Tauri listen without unmount
        let tauri_leak = "listen('sync-db', handle);";
        let v5 = LifecycleRuleChecker::check_typescript_file(tauri_leak, Path::new("src/useSync.ts"));
        assert_eq!(v5.len(), 1);

        // 6. Alternate cleanup hooks: tryOnScopeDispose / onBeforeUnmount / tryOnUnmounted
        let alt_clean1 = "listen('e', h); tryOnScopeDispose(() => {});";
        assert!(LifecycleRuleChecker::check_typescript_file(alt_clean1, Path::new("src/useSync.ts")).is_empty());

        let alt_clean2 = "listen('e', h); onBeforeUnmount(() => {});";
        assert!(LifecycleRuleChecker::check_typescript_file(alt_clean2, Path::new("src/useSync.ts")).is_empty());

        let alt_clean3 = "listen('e', h); tryOnUnmounted(() => {});";
        assert!(LifecycleRuleChecker::check_typescript_file(alt_clean3, Path::new("src/useSync.ts")).is_empty());
    }
}

