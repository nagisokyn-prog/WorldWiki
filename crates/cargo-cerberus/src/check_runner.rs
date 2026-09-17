use colored::*;
use std::collections::{HashMap, HashSet};
use std::path::{Path, PathBuf};
use std::sync::Arc;

use cerberus_application::{ScanScope, ScanWorkspaceUseCase};
use cerberus_domain::{PackageMetrics, Severity, Violation};
use cerberus_infrastructure::{
    CargoMetadataManifestAdapter, ConsoleReportAdapter, JsonReportAdapter, ParallelAstEngineAdapter,
    RulesJsonRepository, RustSynParserAdapter, SarifReportAdapter, VueSfcParserAdapter,
    WalkDirScannerAdapter,
};
use cerberus_ports::{AstParserPort, FileSystemScannerPort, ManifestParserPort, RulesRepositoryPort};

pub struct CheckExecutionOptions<'a> {
    pub rules_repo: Arc<RulesJsonRepository>,
    pub path: &'a Path,
    pub sarif_path: Option<&'a Path>,
    pub json_path: Option<&'a Path>,
    pub expanded: bool,
    pub ci: bool,
    pub frontend_only: bool,
    pub backend_only: bool,
}

pub fn run_check(options: CheckExecutionOptions) -> Result<(), String> {
    let scope = resolve_scope(options.frontend_only, options.backend_only);

    let parsers: Vec<Arc<dyn AstParserPort>> = vec![
        Arc::new(RustSynParserAdapter),
        Arc::new(VueSfcParserAdapter),
    ];

    let ast_engine = Arc::new(ParallelAstEngineAdapter::new(parsers));
    let raw_scanner = Arc::new(
        WalkDirScannerAdapter::new().with_ignores(options.rules_repo.config.ignore.to_vec()),
    );
    let scanner_port: Arc<dyn FileSystemScannerPort> = Arc::clone(&raw_scanner) as Arc<dyn FileSystemScannerPort>;
    let raw_manifest_parser = Arc::new(CargoMetadataManifestAdapter::new());
    let manifest_parser_port: Arc<dyn ManifestParserPort> = Arc::clone(&raw_manifest_parser) as Arc<dyn ManifestParserPort>;
    let rules_repo_port: Arc<dyn RulesRepositoryPort> = Arc::clone(&options.rules_repo) as Arc<dyn RulesRepositoryPort>;

    let use_case = ScanWorkspaceUseCase::new(
        scanner_port,
        ast_engine,
        rules_repo_port,
        scope,
    )
    .with_manifest_parser(manifest_parser_port);
    let mut scan_result = use_case.execute(options.path);

    if options.expanded {
        audit_macro_expansion(options.path, &mut scan_result.violations);
    }

    let martin_metrics = audit_martin_topology(options.path, scope, &raw_manifest_parser, &mut scan_result.violations);
    audit_blast_radius(options.path, scope, &raw_scanner, &mut scan_result.violations);

    for parse_err in &scan_result.parse_errors {
        eprintln!("{} {}", "⚠️".yellow(), parse_err);
    }

    validate_error_rate(scan_result.total_files_scanned, scan_result.parse_errors.len(), options.ci)?;

    ConsoleReportAdapter::print_violations(&scan_result.violations);
    ConsoleReportAdapter::print_martin_metrics(&martin_metrics);

    export_reports(options.sarif_path, options.json_path, &scan_result.violations);

    for v in &scan_result.violations {
        if v.severity == Severity::Deny {
            return Err("Violations found with severity Deny".into());
        }
    }

    Ok(())
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

fn audit_macro_expansion(path: &Path, violations: &mut Vec<Violation>) {
    match cerberus_infrastructure::MacroVisitor::run_cargo_expand(path) {
        Ok(expanded_code) => {
            let syn_parser = RustSynParserAdapter;
            if let Ok(expanded_violations) =
                syn_parser.parse_source(&expanded_code, path, "expanded_macro")
            {
                merge_unique_violations(violations, expanded_violations);
            }
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
        if let Ok((metrics, topology_violations)) = manifest_parser.compute_workspace_martin_metrics(path) {
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
    let all_paths: Vec<PathBuf> = scanned_source_files.iter().map(|f| f.path.to_path_buf()).collect();
    let mut file_imports_map: HashMap<PathBuf, HashSet<String>> = HashMap::new();

    for sf in &scanned_source_files {
        if sf.path.extension().and_then(|ext| ext.to_str()) == Some("rs") {
            if let Some(imports) = extract_rs_imports(&sf.path) {
                file_imports_map.insert(sf.path.to_path_buf(), imports);
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
        if !target.iter().any(|existing| existing.fingerprint == v.fingerprint) {
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
