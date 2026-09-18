use std::fs;
use std::path::PathBuf;
use std::sync::Arc;
use tempfile::TempDir;

use cerberus_application::{ScanResult, ScanScope, ScanWorkspaceUseCase};
use cerberus_infrastructure::{
    CargoMetadataManifestAdapter, ParallelAstEngineAdapter, RulesJsonRepository,
    RustSynParserAdapter, VueSfcParserAdapter, WalkDirScannerAdapter,
};
use cerberus_ports::AstParserPort;

#[allow(dead_code)]
pub struct SyntheticRepoBuilder {
    pub temp_dir: TempDir,
    pub root_path: PathBuf,
    pub total_files: usize,
    pub total_sloc: usize,
}

impl SyntheticRepoBuilder {
    pub fn new() -> Self {
        let temp_dir = tempfile::tempdir().expect("Failed to create tempdir for synthetic repo");
        let root_path = temp_dir.path().to_path_buf();
        Self {
            temp_dir,
            root_path,
            total_files: 0,
            total_sloc: 0,
        }
    }

    pub fn write_file(&mut self, relative_path: &str, content: &str) -> PathBuf {
        let full_path = self.root_path.join(relative_path);
        if let Some(parent) = full_path.parent() {
            fs::create_dir_all(parent)
                .expect("Failed to create parent directories for synthetic file");
        }
        fs::write(&full_path, content).expect("Failed to write synthetic file");
        self.total_files += 1;
        self.total_sloc += content.lines().count();
        full_path
    }

    pub fn write_files_parallel(&mut self, files: Vec<(String, String)>) {
        use rayon::prelude::*;
        let root = &self.root_path;

        let counts: Vec<(usize, usize)> = files
            .par_iter()
            .map(|(rel_path, content)| {
                let full_path = root.join(rel_path);
                if let Some(parent) = full_path.parent() {
                    let _ = fs::create_dir_all(parent);
                }
                let _ = fs::write(&full_path, content);
                (1, content.lines().count())
            })
            .collect();

        for (fc, sloc) in counts {
            self.total_files += fc;
            self.total_sloc += sloc;
        }
    }

    pub fn write_cargo_workspace(&mut self, members: &[&str], cerberus_preset: Option<&str>) {
        let members_toml: Vec<String> = members.iter().map(|m| format!("\"{}\"", m)).collect();
        let preset_section = match cerberus_preset {
            Some(p) => format!(
                "\n[workspace.metadata.cerberus]\npreset = \"{}\"\nenforce_module_boundaries = true\n",
                p
            ),
            None => String::new(),
        };

        let content = format!(
            "[workspace]\nmembers = [{}]\nresolver = \"2\"\n{}",
            members_toml.join(", "),
            preset_section
        );
        self.write_file("Cargo.toml", &content);
    }

    pub fn write_package_manifest(
        &mut self,
        crate_name: &str,
        layer: &str,
        deps: &[(&str, Option<&str>)], // (name, optional path)
    ) {
        let mut deps_str = String::from("[dependencies]\n");
        for (dep_name, dep_path) in deps {
            if let Some(p) = dep_path {
                deps_str.push_str(&format!("{} = {{ path = \"{}\" }}\n", dep_name, p));
            } else {
                deps_str.push_str(&format!("{} = \"1.0\"\n", dep_name));
            }
        }

        let content = format!(
            "[package]\nname = \"{}\"\nversion = \"0.1.0\"\nedition = \"2021\"\n\n[package.metadata.cerberus]\nlayer = \"{}\"\n\n{}",
            crate_name, layer, deps_str
        );
        let path = format!("{}/Cargo.toml", crate_name);
        self.write_file(&path, &content);
    }

    pub fn execute_scan(&self, matrix_preset: Option<&str>) -> ScanResult {
        let scanner = Arc::new(WalkDirScannerAdapter::new());
        let matrix = matrix_preset.map(cerberus_domain::LayerTopologyMatrix::preset_matrix);
        let rust_parser = match matrix {
            Some(m) => RustSynParserAdapter::with_matrix(m),
            None => RustSynParserAdapter::default(),
        };
        let parsers: Vec<Arc<dyn AstParserPort>> =
            vec![Arc::new(rust_parser), Arc::new(VueSfcParserAdapter)];
        let ast_engine = Arc::new(ParallelAstEngineAdapter::new(parsers));
        let manifest_parser = Arc::new(CargoMetadataManifestAdapter::new());
        let rules_repo = Arc::new(RulesJsonRepository::default());

        let use_case = ScanWorkspaceUseCase::new(scanner, ast_engine, rules_repo, ScanScope::All)
            .with_manifest_parser(manifest_parser);

        use_case.execute(&self.root_path)
    }
}
