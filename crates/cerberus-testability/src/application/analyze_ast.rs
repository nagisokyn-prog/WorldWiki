use std::fs;
use std::path::Path;
use walkdir::WalkDir;
use crate::domain::layer::LayerContext;
use crate::domain::score::{FileTestabilityReport, WorkspaceTestabilityReport};
use super::calculate_score::ComputeTestabilityUseCase;

pub struct AnalyzeWorkspaceTestabilityUseCase;

impl AnalyzeWorkspaceTestabilityUseCase {
    pub fn analyze_path(root_path: &Path) -> Result<WorkspaceTestabilityReport, std::io::Error> {
        let mut reports = Vec::new();

        for entry in WalkDir::new(root_path)
            .follow_links(false)
            .into_iter()
            .filter_map(Result::ok)
        {
            let path = entry.path();
            if path.is_file() && path.extension().is_some_and(|ext| ext == "rs") {
                let path_str = path.to_string_lossy();
                // Пропускаем target и сборки
                if path_str.contains("target") || path_str.contains(".git") {
                    continue;
                }

                let layer = LayerContext::from_path(path);
                if let Ok(source) = fs::read_to_string(path) {
                    let rel_path = path.strip_prefix(root_path).unwrap_or(path);
                    let report = ComputeTestabilityUseCase::compute_for_source(
                        &rel_path.to_string_lossy().replace('\\', "/"),
                        &source,
                        layer,
                    );
                    reports.push(report);
                }
            }
        }

        // Сортировка по ухудшению скора (сначала проблемные файлы)
        reports.sort_by(|a, b| a.t_composite.partial_cmp(&b.t_composite).unwrap_or(std::cmp::Ordering::Equal));

        Ok(WorkspaceTestabilityReport::new(reports))
    }

    #[must_use]
    pub fn analyze_in_memory(files: &[(&str, &str, LayerContext)]) -> WorkspaceTestabilityReport {
        let mut reports = Vec::new();
        for (name, source, layer) in files {
            let report = ComputeTestabilityUseCase::compute_for_source(name, source, *layer);
            reports.push(report);
        }
        reports.sort_by(|a, b| a.t_composite.partial_cmp(&b.t_composite).unwrap_or(std::cmp::Ordering::Equal));
        WorkspaceTestabilityReport::new(reports)
    }
}
