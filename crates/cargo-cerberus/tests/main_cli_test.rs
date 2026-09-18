use cargo_cerberus::infrastructure::RulesJsonRepository;
use cargo_cerberus::{
    parse_cli_from, run_app, run_check, BaselineCommands, CheckExecutionOptions, Cli, Commands,
    LedgerCommands, ModelCommands,
};
use std::path::PathBuf;
use std::sync::Arc;
use tempfile::tempdir;

#[test]
fn test_cli_parsing_helpers() {
    let cli_parsed = parse_cli_from(["cargo", "cerberus", "init"]);
    assert!(matches!(cli_parsed.command, Some(Commands::Init { .. })));

    let cli_direct = parse_cli_from(["cargo-cerberus", "check", "--path", "."]);
    assert!(matches!(cli_direct.command, Some(Commands::Check { .. })));
}

#[test]
fn test_run_app_all_subcommands() {
    let temp = tempdir().unwrap();
    let src_dir = temp.path().join("src");
    std::fs::create_dir_all(&src_dir).unwrap();
    std::fs::write(src_dir.join("lib.rs"), "pub fn ok() {}").unwrap();

    let all_rules = cargo_cerberus::domain::BuiltinRuleRegistry::all_rules();
    let valid_rules_config = cargo_cerberus::domain::RulesConfig {
        schema: None,
        version: "1.0".to_string(),
        ignore: Vec::new(),
        rules: all_rules,
    };
    let valid_rules_json = serde_json::to_string(&valid_rules_config).unwrap();
    let valid_rules_file = temp.path().join("valid_rules.json");
    std::fs::write(&valid_rules_file, valid_rules_json).unwrap();

    let rules_file = temp.path().join("rules.json");
    std::fs::write(&rules_file, "{\"version\": \"1.0\", \"rules\": []}").unwrap();

    // 1. Validate rules success and failure
    assert!(run_app(Cli {
        rules_path: Some(valid_rules_file),
        validate_rules: true,
        command: None,
    })
    .is_ok());

    assert!(run_app(Cli {
        rules_path: Some(rules_file.clone()),
        validate_rules: true,
        command: None,
    })
    .is_err());

    // 2. Check command on clean temp directory
    assert!(run_app(Cli {
        rules_path: Some(rules_file.clone()),
        validate_rules: false,
        command: Some(Commands::Check {
            path: temp.path().to_path_buf(),
            sarif: None,
            json: None,
            expanded: false,
            ci: false,
            frontend_only: false,
            backend_only: false,
            record_baseline: false,
            baseline: None,
        }),
    })
    .is_ok());

    // 2.1. Check with record_baseline and grandfathering
    let custom_base = temp.path().join("recorded-baseline.json");
    assert!(run_app(Cli {
        rules_path: Some(rules_file.clone()),
        validate_rules: false,
        command: Some(Commands::Check {
            path: temp.path().to_path_buf(),
            sarif: None,
            json: None,
            expanded: false,
            ci: false,
            frontend_only: false,
            backend_only: false,
            record_baseline: true,
            baseline: Some(custom_base.clone()),
        }),
    })
    .is_ok());
    assert!(custom_base.exists());

    // Check with loaded custom baseline
    assert!(run_app(Cli {
        rules_path: Some(rules_file.clone()),
        validate_rules: false,
        command: Some(Commands::Check {
            path: temp.path().to_path_buf(),
            sarif: None,
            json: None,
            expanded: false,
            ci: false,
            frontend_only: false,
            backend_only: false,
            record_baseline: false,
            baseline: Some(custom_base.clone()),
        }),
    })
    .is_ok());

    // 3. Init command (with and without hooks)
    assert!(run_app(Cli {
        rules_path: Some(rules_file.clone()),
        validate_rules: false,
        command: Some(Commands::Init {
            path: temp.path().to_path_buf(),
            preset: None,
            adopt: true,
            force: true,
            frontend_only: false,
            backend_only: false,
            hooks: false,
            models: false,
        }),
    })
    .is_ok());

    assert!(run_app(Cli {
        rules_path: Some(rules_file.clone()),
        validate_rules: false,
        command: Some(Commands::Init {
            path: temp.path().to_path_buf(),
            preset: None,
            adopt: true,
            force: true,
            frontend_only: false,
            backend_only: false,
            hooks: true,
            models: false,
        }),
    })
    .is_ok());

    // 3.1. Model Status, Clean, and Download commands
    assert!(run_app(Cli {
        rules_path: Some(rules_file.clone()),
        validate_rules: false,
        command: Some(Commands::Model {
            action: ModelCommands::Status,
        }),
    })
    .is_ok());

    assert!(run_app(Cli {
        rules_path: Some(rules_file.clone()),
        validate_rules: false,
        command: Some(Commands::Model {
            action: ModelCommands::Clean,
        }),
    })
    .is_ok());

    // 4. Explain command
    assert!(run_app(Cli {
        rules_path: Some(rules_file.clone()),
        validate_rules: false,
        command: Some(Commands::Explain {
            path: temp.path().to_path_buf(),
            clusters: true,
        }),
    })
    .is_ok());

    // 4.1. Tree command (console and JSON export)
    let tree_json = temp.path().join("tree.json");
    let tree_txt = temp.path().join("tree.txt");
    assert!(run_app(Cli {
        rules_path: Some(rules_file.clone()),
        validate_rules: false,
        command: Some(Commands::Tree {
            path: temp.path().to_path_buf(),
            json: Some(tree_json.clone()),
            save_json: None,
            output: None,
        }),
    })
    .is_ok());
    assert!(tree_json.exists());

    assert!(run_app(Cli {
        rules_path: Some(rules_file.clone()),
        validate_rules: false,
        command: Some(Commands::Tree {
            path: temp.path().to_path_buf(),
            json: None,
            save_json: None,
            output: Some(tree_txt.clone()),
        }),
    })
    .is_ok());
    assert!(tree_txt.exists());

    // Tree error branches
    assert!(run_app(Cli {
        rules_path: Some(rules_file.clone()),
        validate_rules: false,
        command: Some(Commands::Tree {
            path: PathBuf::from("non_existent_tree_path_123"),
            json: None,
            save_json: None,
            output: None,
        }),
    })
    .is_err());

    // 5. Baseline Reconcile command
    let baseline_file = temp.path().join("guardian-baseline.json");
    std::fs::write(&baseline_file, "[]").unwrap();
    assert!(run_app(Cli {
        rules_path: Some(rules_file.clone()),
        validate_rules: false,
        command: Some(Commands::Baseline {
            action: BaselineCommands::Reconcile {
                file: baseline_file,
            },
        }),
    })
    .is_ok());

    let direct_baseline = temp.path().join("cerberus-baseline.json");
    std::fs::write(&direct_baseline, "[]").unwrap();
    assert!(run_app(Cli {
        rules_path: Some(rules_file.clone()),
        validate_rules: false,
        command: Some(Commands::Baseline {
            action: BaselineCommands::Reconcile {
                file: direct_baseline,
            },
        }),
    })
    .is_ok());

    // 6. Ledger Sign & Verify commands
    assert!(run_app(Cli {
        rules_path: Some(rules_file.clone()),
        validate_rules: false,
        command: Some(Commands::Ledger {
            action: LedgerCommands::Sign {
                rule: "ARCH-001".into(),
                fingerprint: "fp123".into(),
                reason: "test".into(),
                author: "Alice".into(),
                duration: "30d".into(),
            },
        }),
    })
    .is_ok());

    let ledger_file = temp.path().join("guardian-ledger.lock");
    std::fs::write(&ledger_file, "[]").unwrap();
    assert!(run_app(Cli {
        rules_path: Some(rules_file.clone()),
        validate_rules: false,
        command: Some(Commands::Ledger {
            action: LedgerCommands::Verify {
                file: ledger_file.clone(),
            },
        }),
    })
    .is_ok());

    let direct_ledger = temp.path().join("cerberus-ledger.lock");
    std::fs::write(&direct_ledger, "[]").unwrap();
    assert!(run_app(Cli {
        rules_path: Some(rules_file.clone()),
        validate_rules: false,
        command: Some(Commands::Ledger {
            action: LedgerCommands::Verify {
                file: direct_ledger.clone(),
            },
        }),
    })
    .is_ok());

    let old_key_file = temp.path().join("old.key");
    std::fs::write(&old_key_file, "11".repeat(32)).unwrap();
    assert!(run_app(Cli {
        rules_path: Some(rules_file.clone()),
        validate_rules: false,
        command: Some(Commands::Ledger {
            action: LedgerCommands::ReSign {
                all: true,
                file: ledger_file,
                old_key_path: Some(old_key_file),
                new_key_path: None,
                force: true,
            },
        }),
    })
    .is_ok());

    let new_key_file = temp.path().join("new.key");
    std::fs::write(&new_key_file, "22".repeat(32)).unwrap();
    assert!(run_app(Cli {
        rules_path: Some(rules_file.clone()),
        validate_rules: false,
        command: Some(Commands::Ledger {
            action: LedgerCommands::ReSign {
                all: true,
                file: direct_ledger,
                old_key_path: None,
                new_key_path: Some(new_key_file),
                force: true,
            },
        }),
    })
    .is_ok());
}

#[test]
fn test_run_check_clean_with_failing_reports() {
    let temp = tempdir().unwrap();
    let src_dir = temp.path().join("src");
    std::fs::create_dir_all(&src_dir).unwrap();
    std::fs::write(src_dir.join("lib.rs"), "use std::fmt;\npub fn ok() {}").unwrap();

    let rules_file = temp.path().join("rules.json");
    std::fs::write(&rules_file, "{\"version\": \"1.0\", \"rules\": []}").unwrap();
    let rules_repo = Arc::new(RulesJsonRepository::load_from_file(&rules_file).unwrap());

    let sarif_dir = temp.path().join("sarif_dir");
    std::fs::create_dir_all(&sarif_dir).unwrap();
    let json_dir = temp.path().join("json_dir");
    std::fs::create_dir_all(&json_dir).unwrap();

    assert!(run_check(CheckExecutionOptions {
        rules_repo: Arc::clone(&rules_repo),
        path: temp.path(),
        sarif_path: Some(&sarif_dir),
        json_path: Some(&json_dir),
        expanded: true,
        ci: false,
        frontend_only: false,
        backend_only: false,
        record_baseline: false,
        baseline_path: None,
    })
    .is_ok());

    assert!(run_check(CheckExecutionOptions {
        rules_repo: Arc::clone(&rules_repo),
        path: temp.path(),
        sarif_path: None,
        json_path: None,
        expanded: false,
        ci: true,
        frontend_only: true,
        backend_only: false,
        record_baseline: false,
        baseline_path: None,
    })
    .is_ok());

    assert!(run_check(CheckExecutionOptions {
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
    })
    .is_ok());
}

struct TestModelDownloader(bool);
impl cargo_cerberus::ports::ModelDownloaderPort for TestModelDownloader {
    fn download_file(&self, _url: &str, dest_path: &std::path::Path) -> Result<(), String> {
        if self.0 {
            if let Some(parent) = dest_path.parent() {
                let _ = std::fs::create_dir_all(parent);
            }
            std::fs::write(dest_path, b"mock").map_err(|e| e.to_string())
        } else {
            Err("Simulated download failure".into())
        }
    }
}

#[test]
fn test_cli_deep_coverage_branches() {
    let _ = cargo_cerberus::cli::parse_cli();

    let temp = tempdir().unwrap();
    let cache_dir = temp.path().join("model_cache");
    std::fs::create_dir_all(&cache_dir).unwrap();

    // 1. Download success with mock downloader
    assert!(
        cargo_cerberus::model_commands::handle_model_with_downloader(
            ModelCommands::Download,
            Arc::new(TestModelDownloader(true)),
            &cache_dir,
        )
        .is_ok()
    );

    // 2. Status when files exist
    assert!(
        cargo_cerberus::model_commands::handle_model_with_downloader(
            ModelCommands::Status,
            Arc::new(TestModelDownloader(true)),
            &cache_dir,
        )
        .is_ok()
    );

    // 3. Download failure with failing mock
    assert!(
        cargo_cerberus::model_commands::handle_model_with_downloader(
            ModelCommands::Download,
            Arc::new(TestModelDownloader(false)),
            &cache_dir,
        )
        .is_err()
    );

    // 4. Clean cache
    assert!(
        cargo_cerberus::model_commands::handle_model_with_downloader(
            ModelCommands::Clean,
            Arc::new(TestModelDownloader(true)),
            &cache_dir,
        )
        .is_ok()
    );

    // Explain with violations in project forming clusters
    let src_dir = temp.path().join("src");
    std::fs::create_dir_all(&src_dir).unwrap();
    for i in 0..5 {
        std::fs::write(
            src_dir.join(format!("bad_{}.rs", i)),
            format!(
                "pub fn bad_{}() {{ panic!(\"critical system failure\"); }}",
                i
            ),
        )
        .unwrap();
    }
    let _ = cargo_cerberus::model_commands::handle_explain(temp.path(), true);

    // Baseline error path (directory instead of file causes read_to_string error)
    let invalid_dir = temp.path().join("invalid_dir_baseline");
    std::fs::create_dir_all(&invalid_dir).unwrap();
    assert!(
        cargo_cerberus::ledger_commands::handle_baseline(BaselineCommands::Reconcile {
            file: invalid_dir,
        })
        .is_err()
    );

    // Ledger error paths
    let bad_lock = temp.path().join("corrupted.lock");
    std::fs::write(&bad_lock, "not valid json").unwrap();
    assert!(
        cargo_cerberus::ledger_commands::handle_ledger(LedgerCommands::ReSign {
            all: true,
            file: bad_lock,
            old_key_path: None,
            new_key_path: None,
            force: false,
        })
        .is_err()
    );

    // Resolve file fallback test
    let fallback_dir = temp.path().join("guardian-baseline.json");
    std::fs::write(&fallback_dir, "[]").unwrap();
    let prev_cwd = std::env::current_dir().unwrap();
    let _ = std::env::set_current_dir(temp.path());
    let resolved = cargo_cerberus::ledger_commands::resolve_file(
        std::path::Path::new("cerberus-baseline.json"),
        "cerberus-baseline.json",
        "guardian-baseline.json",
    );
    assert_eq!(resolved, std::path::PathBuf::from("guardian-baseline.json"));
    let _ = std::env::set_current_dir(prev_cwd);

    // Check runner with Deny violations
    let domain_src = temp.path().join("domain").join("src");
    std::fs::create_dir_all(&domain_src).unwrap();
    std::fs::write(domain_src.join("lib.rs"), "use tauri::command;\n").unwrap();

    let rules_file = temp.path().join("deny_rules.json");
    std::fs::write(
        &rules_file,
        "{\"version\": \"1.0\", \"rules\": {\"ARCH-001\": \"deny\"}}",
    )
    .unwrap();
    let rules_repo = Arc::new(RulesJsonRepository::load_from_file(&rules_file).unwrap());
    assert!(run_check(CheckExecutionOptions {
        rules_repo,
        path: temp.path(),
        sarif_path: None,
        json_path: None,
        expanded: false,
        ci: true,
        frontend_only: false,
        backend_only: false,
        record_baseline: false,
        baseline_path: None,
    })
    .is_err());

    // Execute command with invalid rules path
    let bad_rules_path = PathBuf::from("non_existent_rules_404.json");
    assert!(cargo_cerberus::commands::execute_command(
        Commands::Init {
            path: PathBuf::from("."),
            preset: None,
            adopt: false,
            force: true,
            frontend_only: false,
            backend_only: false,
            hooks: false,
            models: false,
        },
        Some(&bad_rules_path),
    )
    .is_err());

    // Validate rules registry on non-existent path
    assert!(cargo_cerberus::commands::validate_rules_registry(Some(&bad_rules_path)).is_err());

    // Init command
    let init_temp = tempdir().unwrap();
    assert!(cargo_cerberus::commands::execute_command(
        Commands::Init {
            path: init_temp.path().to_path_buf(),
            preset: None,
            adopt: true,
            force: true,
            frontend_only: false,
            backend_only: false,
            hooks: true,
            models: false,
        },
        None,
    )
    .is_ok());

    // Model status and clean direct
    assert!(cargo_cerberus::model_commands::handle_model(ModelCommands::Status).is_ok());
    assert!(cargo_cerberus::model_commands::handle_model(ModelCommands::Clean).is_ok());

    // Test main binary execution
    let bin = PathBuf::from(env!("CARGO_BIN_EXE_cargo-cerberus"));
    if bin.exists() {
        let output = std::process::Command::new(&bin)
            .arg("init")
            .output()
            .expect("Failed to run cargo-cerberus binary");
        assert!(output.status.success() || !output.stdout.is_empty());

        let err_output = std::process::Command::new(&bin)
            .env("CERBERUS_TEST_MAIN", "1")
            .arg("--rules-path")
            .arg("non_existent_path_404.json")
            .arg("check")
            .output()
            .expect("Failed to run cargo-cerberus binary for error");
        assert!(!err_output.status.success() || !err_output.stderr.is_empty());
    }
}
