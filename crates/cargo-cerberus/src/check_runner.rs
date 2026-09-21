use colored::*;
use std::collections::{HashMap, HashSet};
use std::path::{Path, PathBuf};
use std::sync::Arc;

use cerberus_application::{ReconcileBaselineUseCase, ScanScope, ScanWorkspaceUseCase};
use cerberus_domain::{PackageMetrics, Severity, Violation};
use cerberus_infrastructure::{
    CargoMetadataManifestAdapter, ConsoleReportAdapter, FileBaselineStorageAdapter,
    JsonReportAdapter, ParallelAstEngineAdapter, RulesJsonRepository, RustSynParserAdapter,
    SarifReportAdapter, VueSfcParserAdapter, WalkDirScannerAdapter,
};
use cerberus_ports::{
    AstParserPort, BaselineStoragePort, FileSystemScannerPort, ManifestParserPort,
    RulesRepositoryPort,
};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, PartialOrd, Ord)]
pub struct BaselineEntry {
    pub rule: String,
    pub file: String,
    pub line: usize,
    pub symbol: String,
    pub message: String,
    pub fingerprint: String,
}

pub struct CheckExecutionOptions<'a> {
    pub rules_repo: Arc<RulesJsonRepository>,
    pub path: &'a Path,
    pub sarif_path: Option<&'a Path>,
    pub json_path: Option<&'a Path>,
    pub expanded: bool,
    pub ci: bool,
    pub frontend_only: bool,
    pub backend_only: bool,
    pub record_baseline: bool,
    pub baseline_path: Option<&'a Path>,
}

pub fn run_check(options: CheckExecutionOptions) -> Result<(), String> {
    let scope = resolve_scope(options.frontend_only, options.backend_only);

    let manifest_path = if options.path.is_file() && options.path.ends_with("Cargo.toml") {
        options.path.to_path_buf()
    } else {
        options.path.join("Cargo.toml")
    };

    let matrix = if manifest_path.exists() {
        if let Ok(metadata) = cargo_metadata::MetadataCommand::new().manifest_path(&manifest_path).exec() {
            let ws_arch: cerberus_domain::WorkspaceArchMetadata = metadata
                .workspace_metadata
                .get("cerberus")
                .and_then(|v| serde_json::from_value(v.clone()).ok())
                .unwrap_or_default();
            let mut mat = cerberus_domain::LayerTopologyMatrix::from_workspace_metadata(&ws_arch);
            for pkg in &metadata.packages {
                if let Some(pkg_meta) = pkg.metadata.get("cerberus") {
                    if let Ok(arch_meta) = serde_json::from_value::<cerberus_domain::PackageArchMetadata>(pkg_meta.clone()) {
                        if let Some(layer) = arch_meta.layer {
                            mat.layer_aliases.entry(layer.clone()).or_default().insert(pkg.name.clone().to_lowercase());
                        }
                    }
                }
            }
            mat
        } else {
            cerberus_domain::LayerTopologyMatrix::default()
        }
    } else {
        cerberus_domain::LayerTopologyMatrix::default()
    };

    let parsers: Vec<Arc<dyn AstParserPort>> = vec![
        Arc::new(RustSynParserAdapter::with_matrix_and_config(
            matrix,
            options.rules_repo.cerberus_config.clone(),
        )),
        Arc::new(VueSfcParserAdapter::with_config(
            options.rules_repo.cerberus_config.clone(),
        )),
    ];

    let ast_engine = Arc::new(ParallelAstEngineAdapter::new(parsers));
    let raw_scanner = Arc::new(
        WalkDirScannerAdapter::new().with_ignores(options.rules_repo.config.ignore.to_vec()),
    );
    let scanner_port: Arc<dyn FileSystemScannerPort> =
        Arc::clone(&raw_scanner) as Arc<dyn FileSystemScannerPort>;
    let raw_manifest_parser = Arc::new(CargoMetadataManifestAdapter::new());
    let manifest_parser_port: Arc<dyn ManifestParserPort> =
        Arc::clone(&raw_manifest_parser) as Arc<dyn ManifestParserPort>;
    let rules_repo_port: Arc<dyn RulesRepositoryPort> =
        Arc::clone(&options.rules_repo) as Arc<dyn RulesRepositoryPort>;

    let use_case = ScanWorkspaceUseCase::new(scanner_port, ast_engine, rules_repo_port, scope)
        .with_manifest_parser(manifest_parser_port);
    let mut scan_result = use_case.execute(options.path);

    if options.expanded {
        audit_macro_expansion(options.path, &mut scan_result.violations);
    }

    let martin_metrics = audit_martin_topology(
        options.path,
        scope,
        &raw_manifest_parser,
        &mut scan_result.violations,
    );
    audit_blast_radius(
        options.path,
        scope,
        &raw_scanner,
        &mut scan_result.violations,
    );

    for parse_err in &scan_result.parse_errors {
        eprintln!("{} {}", "⚠️".yellow(), parse_err);
    }

    validate_error_rate(
        scan_result.total_files_scanned,
        scan_result.parse_errors.len(),
        options.ci,
    )?;

    let baseline_path = resolve_baseline_path(options.baseline_path, options.path);
    let baseline_storage = FileBaselineStorageAdapter::new();

    if options.record_baseline {
        let mut entries: Vec<BaselineEntry> = Vec::new();

        for v in &scan_result.violations {
            entries.push(BaselineEntry {
                rule: v.rule_id.clone(),
                file: v.file.to_string_lossy().replace('\\', "/"),
                line: v.line,
                symbol: v.symbol.clone(),
                message: v.message.clone(),
                fingerprint: v.fingerprint.to_lowercase(),
            });
        }

        entries.sort();

        let json_output = format!(
            "{}\n",
            serde_json::to_string_pretty(&entries).unwrap_or_default()
        );

        if let Err(e) = baseline_storage.write(&baseline_path, &json_output) {
            return Err(format!(
                "{} Failed to write baseline file: {}",
                "❌".red().bold(),
                e
            ));
        }

        println!(
            "{} Recorded {} structured baseline entries to {}",
            "✅".green().bold(),
            entries.len(),
            baseline_path.display()
        );
        return Ok(());
    }

    if baseline_path.exists() {
        if let Ok(Some(baseline_content)) = baseline_storage.read(&baseline_path) {
            let baseline_hashes =
                ReconcileBaselineUseCase::extract_unique_hashes(&baseline_content);
            if !baseline_hashes.is_empty() {
                let initial_count = scan_result.violations.len();
                let mut filtered = Vec::new();
                for v in scan_result.violations {
                    if !baseline_hashes.contains(&v.fingerprint.to_lowercase()) {
                        filtered.push(v);
                    }
                }
                let grandfathered = initial_count - filtered.len();
                scan_result.violations = filtered;
                if grandfathered > 0 {
                    println!(
                        "{} {} violations grandfathered from baseline ({})",
                        "💡".cyan().bold(),
                        grandfathered,
                        baseline_path.display()
                    );
                }
            }
        }
    }

    ConsoleReportAdapter::print_violations(&scan_result.violations);
    ConsoleReportAdapter::print_martin_metrics(&martin_metrics);

    export_reports(
        options.sarif_path,
        options.json_path,
        &scan_result.violations,
    );

    for v in &scan_result.violations {
        if v.severity == Severity::Deny {
            return Err("Violations found with severity Deny".into());
        }
    }

    Ok(())
}

fn resolve_baseline_path(custom: Option<&Path>, scan_path: &Path) -> PathBuf {
    if let Some(p) = custom {
        return p.to_path_buf();
    }
    let local = scan_path.join("cerberus-baseline.json");
    if local.exists() {
        return local;
    }
    let local_guard = scan_path.join("guardian-baseline.json");
    if local_guard.exists() {
        return local_guard;
    }
    scan_path.join("cerberus-baseline.json")
}

fn resolve_scope(frontend_only: bool, backend_only: bool) -> ScanScope {
    if frontend_only {
        ScanScope::FrontendOnly
    } else if backend_only {
        ScanScope::BackendOnly
    } else {
        ScanScope::All
    }
}

fn validate_error_rate(total_files: usize, error_count: usize, ci: bool) -> Result<(), String> {
    if total_files == 0 {
        return Ok(());
    }
    let error_rate = (error_count as f64) / (total_files as f64);
    let max_tolerated = if ci { 0.02 } else { 0.05 };
    if error_rate > max_tolerated {
        return Err(format!(
            "{} Parse error rate ({:.1}%) exceeds limit ({:.1}%). Failing build.",
            "❌ [PARSE-ERROR-LIMIT]".red().bold(),
            error_rate * 100.0,
            max_tolerated * 100.0
        ));
    }
    Ok(())
}

pub(crate) fn process_expanded_code(expanded_code: &str, path: &Path, violations: &mut Vec<Violation>) {
    let syn_parser = RustSynParserAdapter::default();
    if let Ok(expanded_violations) =
        syn_parser.parse_source(expanded_code, path, "expanded_macro")
    {
        merge_unique_violations(violations, expanded_violations);
    }
}

fn audit_macro_expansion(path: &Path, violations: &mut Vec<Violation>) {
    match cerberus_infrastructure::MacroVisitor::run_cargo_expand(path) {
        Ok(expanded_code) => {
            process_expanded_code(&expanded_code, path, violations);
        }
        Err(err) => {
            eprintln!(
                "{} Expanded mode requires nightly compiler (+nightly rustc -Zunpretty=expanded), falling back to Level 1 syn parsing: {}",
                "⚠️ [MACRO-EXPAND-FALLBACK]".yellow(),
                err
            );
        }
    }
}

fn audit_martin_topology(
    path: &Path,
    scope: ScanScope,
    manifest_parser: &CargoMetadataManifestAdapter,
    violations: &mut Vec<Violation>,
) -> Vec<PackageMetrics> {
    if scope == ScanScope::All || scope == ScanScope::BackendOnly {
        if let Ok((metrics, topology_violations)) =
            manifest_parser.compute_workspace_martin_metrics(path)
        {
            merge_unique_violations(violations, topology_violations);
            return metrics;
        }
    }
    Vec::new()
}

fn audit_blast_radius(
    path: &Path,
    scope: ScanScope,
    scanner: &WalkDirScannerAdapter,
    violations: &mut Vec<Violation>,
) {
    let scanned_source_files = scanner.scan_files(path, scope);
    let mut all_paths: Vec<PathBuf> = Vec::new();
    for f in &scanned_source_files {
        all_paths.push(f.path.clone());
    }
    let mut file_imports_map: HashMap<PathBuf, HashSet<String>> = HashMap::new();

    for sf in &scanned_source_files {
        if let Some(ext) = sf.path.extension() {
            if ext == "rs" {
                if let Some(imports) = extract_rs_imports(&sf.path) {
                    file_imports_map.insert(sf.path.clone(), imports);
                }
            }
        }
    }

    let blast_violations = cerberus_infrastructure::BlastRadiusAnalyzer::analyze_blast_radius(
        &all_paths,
        &file_imports_map,
    );
    merge_unique_violations(violations, blast_violations);
}

fn extract_rs_imports(path: &Path) -> Option<HashSet<String>> {
    let code = std::fs::read_to_string(path).ok()?;
    let parsed = syn::parse_file(&code).ok()?;
    let mut imports = HashSet::new();

    for item in &parsed.items {
        if let syn::Item::Use(item_use) = item {
            collect_use_segments(item_use, &mut imports);
        }
    }
    Some(imports)
}

fn collect_use_segments(item_use: &syn::ItemUse, imports: &mut HashSet<String>) {
    let use_str = quote::quote!(#item_use).to_string();
    for segment in use_str.split_whitespace() {
        if !segment.is_empty()
            && segment != "use"
            && segment != "pub"
            && segment != "crate"
            && segment != "::"
            && segment != ";"
        {
            imports.insert(segment.trim_matches(';').to_string());
        }
    }
}

fn merge_unique_violations(target: &mut Vec<Violation>, incoming: Vec<Violation>) {
    for v in incoming {
        let mut exists = false;
        for existing in target.iter() {
            if existing.fingerprint == v.fingerprint {
                exists = true;
                break;
            }
        }
        if !exists {
            target.push(v);
        }
    }
}

fn export_reports(sarif_path: Option<&Path>, json_path: Option<&Path>, violations: &[Violation]) {
    if let Some(sp) = sarif_path {
        if let Err(e) = SarifReportAdapter::write_report(sp, violations) {
            eprintln!("{} {}", "Failed to write SARIF report:".red(), e);
        }
    }

    if let Some(jp) = json_path {
        if let Err(e) = JsonReportAdapter::write_report(jp, violations) {
            eprintln!("{} {}", "Failed to write JSON report:".red(), e);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn test_check_runner_helpers() {
        assert_eq!(resolve_scope(true, false), ScanScope::FrontendOnly);
        assert_eq!(resolve_scope(false, true), ScanScope::BackendOnly);
        assert_eq!(resolve_scope(false, false), ScanScope::All);

        assert!(validate_error_rate(0, 0, false).is_ok());
        assert!(validate_error_rate(100, 1, false).is_ok());
        assert!(validate_error_rate(100, 10, true).is_err());
        assert!(validate_error_rate(100, 10, false).is_err());

        let temp = tempdir().unwrap();
        let rs_file = temp.path().join("lib.rs");
        std::fs::write(&rs_file, "use std::path::Path;\npub fn foo() {}").unwrap();

        let imports = extract_rs_imports(&rs_file);
        assert!(imports.is_some());
        assert!(imports.unwrap().contains("std"));

        let non_existent = temp.path().join("none.rs");
        assert!(extract_rs_imports(&non_existent).is_none());

        let mut v1 = Vec::new();
        let sample_v = Violation {
            rule_id: "TEST-001".into(),
            rule_version: "1.0".into(),
            category: cerberus_domain::Category::Architecture,
            severity: Severity::Warn,
            file: PathBuf::from("test.rs"),
            line: 1,
            column: 1,
            symbol: "sym".into(),
            snippet: "code".into(),
            message: "msg".into(),
            remediation: "fix".into(),
            fingerprint: "fp123".into(),
        };
        merge_unique_violations(&mut v1, vec![sample_v.clone(), sample_v.clone()]);
        assert_eq!(v1.len(), 1);

        // Test export reports
        let sarif_out = temp.path().join("out.sarif");
        let json_out = temp.path().join("out.json");
        export_reports(Some(&sarif_out), Some(&json_out), &v1);
        assert!(sarif_out.exists());
        assert!(json_out.exists());

        // Test macro expansion fallback
        let mut violations = Vec::new();
        audit_macro_expansion(temp.path(), &mut violations);

        let manifest_adapter = CargoMetadataManifestAdapter::new();
        let _ = audit_martin_topology(temp.path(), ScanScope::All, &manifest_adapter, &mut violations);
        let _ = audit_martin_topology(temp.path(), ScanScope::FrontendOnly, &manifest_adapter, &mut violations);

        let scanner_adapter = WalkDirScannerAdapter::new();
        audit_blast_radius(temp.path(), ScanScope::All, &scanner_adapter, &mut violations);

        // Test resolve_baseline_path
        let direct_base = temp.path().join("my-base.json");
        assert_eq!(
            resolve_baseline_path(Some(&direct_base), temp.path()),
            direct_base
        );

        let default_base = resolve_baseline_path(None, temp.path());
        assert_eq!(default_base, temp.path().join("cerberus-baseline.json"));

        let guardian_base = temp.path().join("guardian-baseline.json");
        std::fs::write(&guardian_base, "[]").unwrap();
        assert_eq!(resolve_baseline_path(None, temp.path()), guardian_base);

        let cerb_base = temp.path().join("cerberus-baseline.json");
        std::fs::write(&cerb_base, "[]").unwrap();
        assert_eq!(resolve_baseline_path(None, temp.path()), cerb_base);
    }

    #[test]
    fn test_check_runner_baseline_record_and_grandfathering() {
        let temp = tempdir().unwrap();
        let src_dir = temp.path().join("src");
        std::fs::create_dir_all(&src_dir).unwrap();
        let bad_rs1 = src_dir.join("lib.rs");
        std::fs::write(&bad_rs1, "pub fn fail1() { panic!(\"bad1\"); }").unwrap();
        let bad_rs2 = src_dir.join("other.rs");
        std::fs::write(&bad_rs2, "pub fn fail2() { panic!(\"bad2\"); }").unwrap();

        let rules_file = temp.path().join("rules.json");
        std::fs::write(
            &rules_file,
            "{\"version\": \"1.0\", \"rules\": {\"ERR-005\": \"deny\"}}",
        )
        .unwrap();
        let rules_repo = Arc::new(RulesJsonRepository::load_from_file(&rules_file).unwrap());

        let base_file = temp.path().join("cerberus-baseline.json");

        // 1. First run without baseline -> fails with Deny
        let fail_run = run_check(CheckExecutionOptions {
            rules_repo: Arc::clone(&rules_repo),
            path: temp.path(),
            sarif_path: None,
            json_path: None,
            expanded: false,
            ci: false,
            frontend_only: false,
            backend_only: true,
            record_baseline: false,
            baseline_path: Some(&base_file),
        });
        assert!(fail_run.is_err());

        // 2. Record baseline -> succeeds and writes structured entries
        let record_run = run_check(CheckExecutionOptions {
            rules_repo: Arc::clone(&rules_repo),
            path: temp.path(),
            sarif_path: None,
            json_path: None,
            expanded: false,
            ci: false,
            frontend_only: false,
            backend_only: true,
            record_baseline: true,
            baseline_path: Some(&base_file),
        });
        assert!(record_run.is_ok());
        assert!(base_file.exists());

        // 2.1 Re-record baseline to exercise reloading existing structured entries
        let re_record_run = run_check(CheckExecutionOptions {
            rules_repo: Arc::clone(&rules_repo),
            path: temp.path(),
            sarif_path: None,
            json_path: None,
            expanded: false,
            ci: false,
            frontend_only: false,
            backend_only: true,
            record_baseline: true,
            baseline_path: Some(&base_file),
        });
        assert!(re_record_run.is_ok());

        // 3. Run with recorded baseline -> grandfathered and passes!
        let pass_run = run_check(CheckExecutionOptions {
            rules_repo: Arc::clone(&rules_repo),
            path: temp.path(),
            sarif_path: None,
            json_path: None,
            expanded: false,
            ci: false,
            frontend_only: false,
            backend_only: true,
            record_baseline: false,
            baseline_path: Some(&base_file),
        });
        assert!(pass_run.is_ok());

        // 3.1 Introduce a NEW bad file that is NOT in the baseline
        let bad_rs3 = src_dir.join("new_bad.rs");
        std::fs::write(&bad_rs3, "pub fn fail3() { unimplemented!(\"bad3\"); }").unwrap();

        let partial_fail_run = run_check(CheckExecutionOptions {
            rules_repo: Arc::clone(&rules_repo),
            path: temp.path(),
            sarif_path: None,
            json_path: None,
            expanded: false,
            ci: false,
            frontend_only: false,
            backend_only: true,
            record_baseline: false,
            baseline_path: Some(&base_file),
        });
        assert!(partial_fail_run.is_err());

        // Test BaselineEntry serde and Ord
        let entry = BaselineEntry {
            rule: "ERR-005".into(),
            file: "src/lib.rs".into(),
            line: 1,
            symbol: "fail".into(),
            message: "msg".into(),
            fingerprint: "fp123".into(),
        };
        let serialized = serde_json::to_string(&entry).unwrap();
        let deserialized: BaselineEntry = serde_json::from_str(&serialized).unwrap();
        assert_eq!(entry, deserialized);
        assert_eq!(entry.clone(), entry);
        assert!(!format!("{:?}", entry).is_empty());

        let entry2 = BaselineEntry {
            rule: "ERR-006".into(),
            file: "src/lib.rs".into(),
            line: 2,
            symbol: "fail2".into(),
            message: "msg2".into(),
            fingerprint: "fp456".into(),
        };
        assert!(entry < entry2);
        assert_eq!(entry.cmp(&entry2), std::cmp::Ordering::Less);
    }

    #[test]
    fn test_check_runner_negative_and_edge_cases() {
        let temp = tempdir().unwrap();
        let rules_file = temp.path().join("rules.json");
        std::fs::write(&rules_file, "{\"version\": \"1.0\", \"rules\": {}}").unwrap();
        let rules_repo = Arc::new(RulesJsonRepository::load_from_file(&rules_file).unwrap());

        // 1. Negative: run_check with record_baseline to an invalid/unwritable directory
        let unwritable_base = temp.path().join("non_existent_folder/sub/base.json");
        let write_fail_run = run_check(CheckExecutionOptions {
            rules_repo: Arc::clone(&rules_repo),
            path: temp.path(),
            sarif_path: None,
            json_path: None,
            expanded: false,
            ci: false,
            frontend_only: false,
            backend_only: false,
            record_baseline: true,
            baseline_path: Some(&unwritable_base),
        });
        assert!(write_fail_run.is_err());
        assert!(write_fail_run.unwrap_err().contains("Failed to write baseline file"));

        // 2. Positive: run_check with path directly pointing to Cargo.toml
        let cargo_toml = temp.path().join("Cargo.toml");
        std::fs::write(&cargo_toml, "[package]\nname = \"dummy\"\nversion = \"0.1.0\"\nedition = \"2021\"\n[lib]\npath = \"src/lib.rs\"").unwrap();
        let dummy_src = temp.path().join("src");
        std::fs::create_dir_all(&dummy_src).unwrap();
        std::fs::write(dummy_src.join("lib.rs"), "pub fn dummy() {}").unwrap();

        let direct_cargo_run = run_check(CheckExecutionOptions {
            rules_repo: Arc::clone(&rules_repo),
            path: &cargo_toml,
            sarif_path: None,
            json_path: None,
            expanded: false,
            ci: false,
            frontend_only: false,
            backend_only: true,
            record_baseline: false,
            baseline_path: None,
        });
        assert!(direct_cargo_run.is_ok());

        // 3. Negative: extract_rs_imports with invalid syntax
        let bad_syntax_file = temp.path().join("bad_syntax.rs");
        std::fs::write(&bad_syntax_file, "enum { broken syntax @@@ }").unwrap();
        assert!(extract_rs_imports(&bad_syntax_file).is_none());

        // 4. Positive & Negative: export_reports with unwritable path (does not panic, logs error)
        let block_file = temp.path().join("block_file.txt");
        std::fs::write(&block_file, "not a directory").unwrap();
        let invalid_sarif = block_file.join("sub/out.sarif");
        let invalid_json = block_file.join("sub/out.json");
        export_reports(Some(&invalid_sarif), Some(&invalid_json), &[]);
        assert!(!invalid_sarif.exists());
        assert!(!invalid_json.exists());

        // 5. Positive: export_reports with None paths
        export_reports(None, None, &[]);

        // 6. Positive: collect_use_segments with nested segments
        let mut segments = HashSet::new();
        let use_item: syn::ItemUse = syn::parse_str("pub use crate::foo::bar::Baz;").unwrap();
        collect_use_segments(&use_item, &mut segments);
        assert!(segments.contains("foo::bar::Baz") || segments.contains("Baz") || !segments.is_empty());

        // 7. Positive: merge_unique_violations empty inputs
        let mut target = Vec::new();
        merge_unique_violations(&mut target, Vec::new());
        assert!(target.is_empty());

        // 8. Positive & Negative: audit_martin_topology with Scope
        let mut violations = Vec::new();
        let manifest_adapter = CargoMetadataManifestAdapter::new();
        let metrics_frontend = audit_martin_topology(temp.path(), ScanScope::FrontendOnly, &manifest_adapter, &mut violations);
        assert!(metrics_frontend.is_empty());

        let metrics_backend = audit_martin_topology(temp.path(), ScanScope::BackendOnly, &manifest_adapter, &mut violations);
        assert_eq!(metrics_backend.len(), 1);

        let empty_temp = tempdir().unwrap();
        let empty_metrics = audit_martin_topology(empty_temp.path(), ScanScope::BackendOnly, &manifest_adapter, &mut violations);
        assert!(empty_metrics.is_empty());

        // 9. Positive & Negative: audit_blast_radius with empty and non-empty directory
        let scanner_adapter = WalkDirScannerAdapter::new();
        audit_blast_radius(temp.path(), ScanScope::BackendOnly, &scanner_adapter, &mut violations);
        audit_blast_radius(temp.path(), ScanScope::FrontendOnly, &scanner_adapter, &mut violations);

        // 10. Positive: run_check with frontend_only, expanded, ci, sarif_path and json_path
        let sarif_target = temp.path().join("check_run.sarif");
        let json_target = temp.path().join("check_run.json");
        let frontend_run = run_check(CheckExecutionOptions {
            rules_repo: Arc::clone(&rules_repo),
            path: temp.path(),
            sarif_path: Some(&sarif_target),
            json_path: Some(&json_target),
            expanded: true,
            ci: true,
            frontend_only: true,
            backend_only: false,
            record_baseline: false,
            baseline_path: None,
        });
        assert!(frontend_run.is_ok());
        assert!(sarif_target.exists());
        assert!(json_target.exists());

        // 11. Positive: run_check with parse errors present in scanned files
        let bad_parse_file = temp.path().join("src/syntax_err.rs");
        std::fs::write(&bad_parse_file, "fn bad( { broken").unwrap();
        let parse_err_run = run_check(CheckExecutionOptions {
            rules_repo: Arc::clone(&rules_repo),
            path: temp.path(),
            sarif_path: None,
            json_path: None,
            expanded: false,
            ci: false,
            frontend_only: false,
            backend_only: true,
            record_baseline: false,
            baseline_path: None,
        });
        let _ = parse_err_run; // exercised parse_errors loop

        // 12. Positive: run_check with empty and invalid baseline file
        let empty_base_file = temp.path().join("empty_base.json");
        std::fs::write(&empty_base_file, "[]").unwrap();
        let empty_base_run = run_check(CheckExecutionOptions {
            rules_repo: Arc::clone(&rules_repo),
            path: temp.path(),
            sarif_path: None,
            json_path: None,
            expanded: false,
            ci: false,
            frontend_only: true,
            backend_only: false,
            record_baseline: false,
            baseline_path: Some(&empty_base_file),
        });
        assert!(empty_base_run.is_ok());

        let invalid_base_file = temp.path().join("invalid_base.json");
        std::fs::write(&invalid_base_file, "{ not valid json").unwrap();
        let invalid_base_run = run_check(CheckExecutionOptions {
            rules_repo: Arc::clone(&rules_repo),
            path: temp.path(),
            sarif_path: None,
            json_path: None,
            expanded: false,
            ci: false,
            frontend_only: true,
            backend_only: false,
            record_baseline: false,
            baseline_path: Some(&invalid_base_file),
        });
        assert!(invalid_base_run.is_ok());

        // Test parse error limit failure when bad syntax files exceed max error rate
        let error_rate_fail_run = run_check(CheckExecutionOptions {
            rules_repo: Arc::clone(&rules_repo),
            path: temp.path(),
            sarif_path: None,
            json_path: None,
            expanded: false,
            ci: false,
            frontend_only: false,
            backend_only: false,
            record_baseline: false,
            baseline_path: None,
        });
        assert!(error_rate_fail_run.is_err());
        assert!(error_rate_fail_run.unwrap_err().contains("Parse error rate"));

        // Test scope All on a clean workspace with workspace metadata
        let clean_ws = tempdir().unwrap();
        let ws_cargo = clean_ws.path().join("Cargo.toml");
        std::fs::write(&ws_cargo, r#"
            [package]
            name = "clean_pkg"
            version = "0.1.0"
            edition = "2021"

            [package.metadata.cerberus]
            layer = "tauri"

            [workspace]
            members = ["."]

            [workspace.metadata.cerberus]
            preset = "hexagonal"

            [lib]
            path = "src/lib.rs"
        "#).unwrap();
        let ws_src = clean_ws.path().join("src");
        std::fs::create_dir_all(&ws_src).unwrap();
        std::fs::write(ws_src.join("lib.rs"), "pub fn lib() {}").unwrap();
        std::fs::write(ws_src.join("comp.vue"), "<template><div>Hello</div></template>").unwrap();
        std::fs::write(ws_src.join("note.txt"), "some notes").unwrap();

        let clean_scope_run = run_check(CheckExecutionOptions {
            rules_repo: Arc::clone(&rules_repo),
            path: clean_ws.path(),
            sarif_path: None,
            json_path: None,
            expanded: false,
            ci: false,
            frontend_only: false,
            backend_only: false,
            record_baseline: false,
            baseline_path: None,
        });
        assert!(clean_scope_run.is_ok());

        // Test broken Cargo.toml triggering metadata parse error branch in run_check
        let broken_ws = tempdir().unwrap();
        let broken_cargo = broken_ws.path().join("Cargo.toml");
        std::fs::write(&broken_cargo, "[broken toml").unwrap();
        let broken_scope_run = run_check(CheckExecutionOptions {
            rules_repo: Arc::clone(&rules_repo),
            path: broken_ws.path(),
            sarif_path: None,
            json_path: None,
            expanded: false,
            ci: false,
            frontend_only: false,
            backend_only: false,
            record_baseline: false,
            baseline_path: None,
        });
        assert!(broken_scope_run.is_ok());

        // 13. Positive and negative tests for process_expanded_code
        let mut macro_violations = Vec::new();
        process_expanded_code("pub fn bad() { panic!(\"boom\"); }", Path::new("dummy.rs"), &mut macro_violations);
        assert!(!macro_violations.is_empty());

        let mut clean_macro_violations = Vec::new();
        process_expanded_code("pub fn good() { let _x = 42; }", Path::new("dummy.rs"), &mut clean_macro_violations);
        assert!(clean_macro_violations.is_empty());

        let mut invalid_syntax_violations = Vec::new();
        process_expanded_code("invalid syntax @@@ @@", Path::new("dummy.rs"), &mut invalid_syntax_violations);
        assert!(invalid_syntax_violations.is_empty());

        // 14. BaselineEntry comparison methods
        let e1 = BaselineEntry {
            rule: "A".into(),
            file: "a.rs".into(),
            line: 1,
            symbol: "s".into(),
            message: "m".into(),
            fingerprint: "1".into(),
        };
        let e2 = BaselineEntry {
            rule: "B".into(),
            file: "b.rs".into(),
            line: 2,
            symbol: "s2".into(),
            message: "m2".into(),
            fingerprint: "2".into(),
        };
        assert!(e1 <= e2);
        assert!(e2 > e1);
        assert!(e2 >= e1);
        assert_eq!(e1.partial_cmp(&e2), Some(std::cmp::Ordering::Less));
        assert_ne!(e1, e2);
    }
}
