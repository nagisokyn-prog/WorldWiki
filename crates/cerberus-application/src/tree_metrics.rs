use cerberus_domain::{FileMetricsNode, HealthLevel, LimitsConfig, PressureWeights};
use std::fs;
use std::path::{Path, PathBuf};

pub struct TreeMetricsCollector<'a> {
    pub limits: &'a LimitsConfig,
    pub weights: &'a PressureWeights,
}

impl<'a> TreeMetricsCollector<'a> {
    pub fn new(limits: &'a LimitsConfig, weights: &'a PressureWeights) -> Self {
        Self { limits, weights }
    }

    pub fn find_cargo_tomls(&self, root: &Path) -> Vec<PathBuf> {
        let mut results = Vec::new();
        let ignore_dirs = ["target", "node_modules", ".git", "dist", "build"];
        walk_cargo(root, &mut results, &ignore_dirs);
        results
    }

    pub fn extract_package_name(&self, cargo_toml: &Path) -> Option<String> {
        let content = fs::read_to_string(cargo_toml).ok()?;
        for line in content.lines() {
            let trimmed = line.trim();
            if trimmed.starts_with("name =") || trimmed.starts_with("name=") {
                let parts: Vec<&str> = trimmed.split('=').collect();
                if let Some(val) = parts.get(1) {
                    return Some(val.trim().trim_matches('"').trim_matches('\'').to_string());
                }
            }
        }
        None
    }

    pub fn collect_source_files(&self, dir: &Path, files: &mut Vec<FileMetricsNode>) {
        let ignore_dirs = ["target", "node_modules", ".git", "dist", "build"];
        let valid_exts = ["rs", "vue", "ts", "js", "css"];

        if let Ok(entries) = fs::read_dir(dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                let name = entry.file_name().to_string_lossy().to_string();

                if path.is_dir() {
                    if !ignore_dirs.contains(&name.as_str()) {
                        self.collect_source_files(&path, files);
                    }
                } else if let Some(ext_os) = path.extension() {
                    if let Some(ext) = ext_os.to_str() {
                        if valid_exts.contains(&ext) {
                            let metrics = self.compute_file_metrics(&path, &name);
                            files.push(metrics);
                        }
                    }
                }
            }
        }
    }

    pub fn compute_file_metrics(&self, path: &Path, name: &str) -> FileMetricsNode {
        let content = fs::read_to_string(path).unwrap_or_default();
        let (sloc, functions, cyclomatic, dependencies, ast_depth) = scan_line_metrics(&content);

        let pressure = (self.weights.w_sloc * sloc as f64)
            + (self.weights.w_functions * functions as f64)
            + (self.weights.w_cyclomatic * cyclomatic as f64)
            + (self.weights.w_dependencies * dependencies as f64)
            + (self.weights.w_ast_depth * ast_depth as f64);

        let health = if sloc >= self.limits.max_sloc_deny || pressure >= self.limits.max_pressure_deny {
            HealthLevel::Critical
        } else if sloc >= self.limits.max_sloc_warn || pressure >= self.limits.max_pressure_warn {
            HealthLevel::Warning
        } else {
            HealthLevel::Healthy
        };

        FileMetricsNode {
            name: name.to_string(),
            path: path.to_path_buf(),
            sloc,
            functions,
            cyclomatic,
            dependencies,
            ast_depth,
            pressure,
            health,
        }
    }
}

fn walk_cargo(dir: &Path, results: &mut Vec<PathBuf>, ignore_dirs: &[&str]) {
    if let Ok(entries) = fs::read_dir(dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            let name = entry.file_name().to_string_lossy().to_string();

            if path.is_dir() {
                if !ignore_dirs.contains(&name.as_str()) {
                    walk_cargo(&path, results, ignore_dirs);
                }
            } else if name == "Cargo.toml" {
                results.push(path);
            }
        }
    }
}

fn scan_line_metrics(content: &str) -> (usize, usize, usize, usize, usize) {
    let mut sloc = 0;
    let mut functions = 0;
    let mut cyclomatic = 1;
    let mut dependencies = 0;
    let mut ast_depth = 1;
    let mut current_depth = 1;

    for line in content.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() || trimmed.starts_with("//") || trimmed.starts_with("/*") || trimmed.starts_with('*') {
            continue;
        }
        sloc += 1;

        if trimmed.contains('{') {
            current_depth += 1;
            if current_depth > ast_depth {
                ast_depth = current_depth;
            }
        }
        if trimmed.contains('}') && current_depth > 1 {
            current_depth -= 1;
        }

        if trimmed.starts_with("fn ") || trimmed.starts_with("pub fn ") || trimmed.starts_with("async fn ") || trimmed.starts_with("function ") || trimmed.contains("() {") || trimmed.contains("() => {") {
            functions += 1;
        }

        if trimmed.starts_with("if ") || trimmed.starts_with("match ") || trimmed.starts_with("for ") || trimmed.starts_with("while ") || trimmed.contains("&&") || trimmed.contains("||") {
            cyclomatic += 1;
        }

        if trimmed.starts_with("use ") || trimmed.starts_with("import ") || trimmed.starts_with("from ") {
            dependencies += 1;
        }
    }

    (sloc, functions, cyclomatic, dependencies, ast_depth)
}
