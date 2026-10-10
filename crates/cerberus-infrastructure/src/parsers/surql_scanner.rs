use cerberus_domain::CerberusConfig;
use cerberus_surql::ast::document::SurqlDocument;
use cerberus_surql::ast::parser::SurqlParser;
use cerberus_surql::schema::registry::SchemaRegistry;
use std::fs;
use std::path::{Path, PathBuf};

pub fn collect_modular_schemas(path: &Path, doc: &SurqlDocument) -> Vec<SurqlDocument> {
    let mut all_docs = vec![doc.clone()];
    let mut dirs_to_scan = Vec::new();
    if let Some(parent) = path.parent() {
        dirs_to_scan.push(parent.to_path_buf());
        if let Some(grandparent) = parent.parent() {
            let has_surql_in_grandparent = fs::read_dir(grandparent)
                .ok()
                .map(|entries| {
                    entries.flatten().any(|e| {
                        e.path().is_file() && e.path().extension().is_some_and(|ext| ext == "surql")
                    })
                })
                .unwrap_or(false);

            if has_surql_in_grandparent {
                dirs_to_scan.push(grandparent.to_path_buf());
            }
        }
    }

    for dir in dirs_to_scan {
        if let Ok(entries) = fs::read_dir(dir) {
            for entry in entries.flatten() {
                let sibling_path = entry.path();
                if sibling_path != path && sibling_path.extension().is_some_and(|ext| ext == "surql") {
                    if let Ok(sibling_content) = fs::read_to_string(&sibling_path) {
                        all_docs.push(SurqlParser::parse(&sibling_content, sibling_path));
                    }
                } else if sibling_path.is_dir() {
                    if let Ok(sub_entries) = fs::read_dir(&sibling_path) {
                        for sub_entry in sub_entries.flatten() {
                            let sub_path = sub_entry.path();
                            if sub_path != path && sub_path.extension().is_some_and(|ext| ext == "surql") {
                                if let Ok(sub_content) = fs::read_to_string(&sub_path) {
                                    all_docs.push(SurqlParser::parse(&sub_content, sub_path));
                                }
                            }
                        }
                    }
                }
            }
        }
    }
    all_docs
}

pub fn resolve_workspace_root(path: &Path, configured_root: Option<&Path>) -> Option<PathBuf> {
    if let Some(root) = configured_root {
        return Some(root.to_path_buf());
    }

    let mut current = path.parent();
    while let Some(dir) = current {
        if dir.join("cerberus.json").exists()
            || dir.join("Cargo.lock").exists()
            || (dir.join("Cargo.toml").exists()
                && fs::read_to_string(dir.join("Cargo.toml"))
                    .map(|c| c.contains("[workspace]"))
                    .unwrap_or(false))
        {
            return Some(dir.to_path_buf());
        }
        current = dir.parent();
    }

    // Topmost candidate containing workspace marker
    let mut current = path.parent();
    let mut candidate = None;
    while let Some(dir) = current {
        if dir.join("Cargo.toml").exists() || dir.join("package.json").exists() {
            candidate = Some(dir.to_path_buf());
        }
        current = dir.parent();
    }
    candidate
}

pub fn resolve_scan_roots(root: &Path, cerberus_config: Option<&CerberusConfig>) -> Vec<PathBuf> {
    let mut scan_roots: Vec<PathBuf> = Vec::new();

    if let Some(cfg) = cerberus_config {
        if !cfg.layers.is_empty() {
            // 1. Resolve roots from configured layers in cerberus.json
            for layer_rule in cfg.layers.values() {
                for pat in &layer_rule.patterns {
                    let clean = pat.trim_start_matches("./");
                    // Extract direct folder prefix before wildcards (e.g. "src-tauri/**" -> "src-tauri")
                    if let Some(first_seg) = clean.trim_start_matches("**/").split('/').next() {
                        if !first_seg.is_empty() && !first_seg.contains('*') {
                            let dir_path = root.join(first_seg);
                            if dir_path.is_dir() && !scan_roots.contains(&dir_path) {
                                scan_roots.push(dir_path);
                            }
                        }
                    }
                }
            }

            // 2. Discover subdirectories matching deep layer patterns (e.g. nested submodules)
            if let Ok(entries) = fs::read_dir(root) {
                for entry in entries.flatten() {
                    let path = entry.path();
                    if !path.is_dir() {
                        continue;
                    }
                    let dir_name = match path.file_name().and_then(|n| n.to_str()) {
                        Some(name) => name,
                        None => continue,
                    };
                    if dir_name.starts_with('.')
                        || dir_name == "target"
                        || dir_name == "node_modules"
                        || dir_name == "dist"
                        || dir_name == "coverage"
                    {
                        continue;
                    }
                    if let Ok(rel) = path.strip_prefix(root) {
                        if cerberus_domain::is_path_ignored(rel, &cfg.ignore) {
                            continue;
                        }
                    }

                    // Check if this directory contains content matching any layer pattern
                    let matches_layers = cfg.layers.values().any(|layer_rule| {
                        layer_rule.patterns.iter().any(|pat| {
                            let clean = pat.trim_matches('*').trim_matches('/');
                            if clean.contains(dir_name) {
                                return true;
                            }
                            for seg in clean.split('/') {
                                if !seg.is_empty() && seg != "." && seg != ".." {
                                    if path.join(seg).exists() {
                                        return true;
                                    }
                                    if let Ok(sub_entries) = fs::read_dir(&path) {
                                        for sub in sub_entries.flatten() {
                                            if sub.path().is_dir() && sub.path().join(seg).exists() {
                                                return true;
                                            }
                                        }
                                    }
                                }
                            }
                            false
                        })
                    });

                    if matches_layers && !scan_roots.contains(&path) {
                        scan_roots.push(path);
                    }
                }
            }
        }
    }

    // 3. Fallback: if no layer-specific scan roots were discovered (or no config provided),
    // scan the workspace root directly
    if scan_roots.is_empty() {
        scan_roots.push(root.to_path_buf());
    }

    scan_roots
}

pub fn scan_codebase_for_fn_refs(
    dir: &Path,
    ws_root: &Path,
    fn_re: &regex::Regex,
    ignore_patterns: &[String],
    schema: &mut SchemaRegistry,
) {
    if let Ok(entries) = fs::read_dir(dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            let file_name = path.file_name().and_then(|n| n.to_str()).unwrap_or("");
            if file_name.starts_with('.')
                || file_name == "target"
                || file_name == "node_modules"
                || file_name == "dist"
                || file_name == "coverage"
            {
                continue;
            }
            if let Ok(rel) = path.strip_prefix(ws_root) {
                if cerberus_domain::is_path_ignored(rel, ignore_patterns) {
                    continue;
                }
            } else if cerberus_domain::is_path_ignored(&path, ignore_patterns) {
                continue;
            }
            if path.is_dir() {
                scan_codebase_for_fn_refs(&path, ws_root, fn_re, ignore_patterns, schema);
            } else if path.is_file() {
                let ext = path.extension().and_then(|e| e.to_str()).unwrap_or("");
                if ext == "rs" || ext == "ts" || ext == "vue" || ext == "js" {
                    if let Ok(content) = fs::read_to_string(&path) {
                        for cap in fn_re.captures_iter(&content) {
                            if let Some(m) = cap.get(1) {
                                schema.record_function_reference(m.as_str());
                            }
                        }
                    }
                }
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use cerberus_domain::LayerRule;
    use std::collections::HashMap;

    #[test]
    fn test_resolve_scan_roots_with_layers() {
        let temp_dir = tempfile::tempdir().unwrap();
        let ws_root = temp_dir.path();
        let custom_dir = ws_root.join("my_service");
        fs::create_dir_all(&custom_dir).unwrap();

        let mut layers = HashMap::new();
        layers.insert(
            "backend".to_string(),
            LayerRule {
                patterns: vec!["**/my_service/**".to_string()],
                ..Default::default()
            },
        );

        let cfg = CerberusConfig {
            layers,
            ..Default::default()
        };

        let roots = resolve_scan_roots(ws_root, Some(&cfg));
        assert!(roots.contains(&custom_dir));
    }

    #[test]
    fn test_resolve_scan_roots_fallback_flat() {
        let temp_dir = tempfile::tempdir().unwrap();
        let ws_root = temp_dir.path();
        let roots = resolve_scan_roots(ws_root, None);
        assert_eq!(roots, vec![ws_root.to_path_buf()]);
    }

    #[test]
    fn test_resolve_workspace_root_configured() {
        let custom_root = PathBuf::from("/configured/path");
        let found = resolve_workspace_root(Path::new("/some/dir/file.surql"), Some(&custom_root));
        assert_eq!(found, Some(custom_root));
    }

    #[test]
    fn test_scan_codebase_finds_refs_and_respects_ignores() {
        let temp_dir = tempfile::tempdir().unwrap();
        let ws_root = temp_dir.path();

        let src_dir = ws_root.join("src");
        let ignored_dir = ws_root.join("tests_ignored");
        fs::create_dir_all(&src_dir).unwrap();
        fs::create_dir_all(&ignored_dir).unwrap();

        fs::write(src_dir.join("api.rs"), "fn::active_func()").unwrap();
        fs::write(ignored_dir.join("dummy.rs"), "fn::ignored_func()").unwrap();

        let fn_re = regex::Regex::new(r"fn::([a-zA-Z0-9_]+)").unwrap();
        let mut schema = SchemaRegistry::default();
        let ignore_patterns = vec!["tests_ignored/**".to_string()];

        scan_codebase_for_fn_refs(&src_dir, ws_root, &fn_re, &ignore_patterns, &mut schema);
        scan_codebase_for_fn_refs(&ignored_dir, ws_root, &fn_re, &ignore_patterns, &mut schema);

        assert!(schema.is_function_referenced("fn::active_func"));
        assert!(!schema.referenced_functions.contains("ignored_func"));
    }
}
