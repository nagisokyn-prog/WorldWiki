use std::fs;
use std::path::Path;
use walkdir::WalkDir;
use syn::Item;
use crate::domain::layer::LayerContext;
use crate::domain::score::WorkspaceTestabilityReport;
use super::calculate_score::ComputeTestabilityUseCase;

fn compare_reports_by_score(
    a: &crate::domain::score::FileTestabilityReport,
    b: &crate::domain::score::FileTestabilityReport,
) -> std::cmp::Ordering {
    match a.t_composite.partial_cmp(&b.t_composite) {
        Some(ord) => ord,
        None => std::cmp::Ordering::Equal,
    }
}

fn is_pure_composition_root(file_path: &str, source: &str) -> bool {
    let normalized = file_path.replace('\\', "/");
    let is_candidate = normalized.ends_with("/main.rs")
        || normalized == "main.rs"
        || normalized.ends_with("/lib.rs")
        || normalized == "lib.rs"
        || normalized.contains("/bin/");

    if !is_candidate {
        return false;
    }

    if let Ok(syn_file) = syn::parse_file(source) {
        for item in &syn_file.items {
            match item {
                Item::Mod(_) | Item::Use(_) | Item::ExternCrate(_) => continue,
                Item::Fn(f) if (f.sig.ident == "main" || f.sig.ident == "run") && f.block.stmts.is_empty() => continue,
                _ => return false,
            }
        }
        return true;
    }

    false
}

pub struct AnalyzeWorkspaceTestabilityUseCase;

impl AnalyzeWorkspaceTestabilityUseCase {
    pub fn analyze_path(root_path: &Path) -> Result<WorkspaceTestabilityReport, std::io::Error> {
        let mut reports = Vec::new();

        for entry in WalkDir::new(root_path).follow_links(false).into_iter().flatten() {
            let path = entry.path();
            if path.is_file() {
                if let Some(ext) = path.extension().and_then(|e| e.to_str()) {
                    if matches!(ext, "rs" | "vue" | "ts" | "js" | "tsx" | "jsx") {
                        let path_str = path.to_string_lossy();
                        // Пропускаем target, node_modules и сборки
                        if path_str.contains("target")
                            || path_str.contains(".git")
                            || path_str.contains("node_modules")
                            || path_str.contains("dist")
                        {
                            continue;
                        }

                        let layer = LayerContext::from_path(path);
                        if let Ok(source) = fs::read_to_string(path) {
                            let rel_path = path.strip_prefix(root_path).unwrap_or(path);
                            let rel_str = rel_path.to_string_lossy().replace('\\', "/");

                            // Exclude pure composition roots from workspace testability scoring
                            if is_pure_composition_root(&rel_str, &source) {
                                continue;
                            }

                            let report = ComputeTestabilityUseCase::compute_for_source(
                                &rel_str,
                                &source,
                                layer,
                            );
                            reports.push(report);
                        }
                    }
                }
            }
        }

        // Сортировка по ухудшению скора (сначала проблемные файлы)
        reports.sort_by(compare_reports_by_score);

        Ok(WorkspaceTestabilityReport::new(reports))
    }

    #[must_use]
    pub fn analyze_in_memory(files: &[(&str, &str, LayerContext)]) -> WorkspaceTestabilityReport {
        let mut reports = Vec::new();
        for (name, source, layer) in files {
            if is_pure_composition_root(name, source) {
                continue;
            }
            let report = ComputeTestabilityUseCase::compute_for_source(name, source, *layer);
            reports.push(report);
        }
        reports.sort_by(compare_reports_by_score);
        WorkspaceTestabilityReport::new(reports)
    }
}
