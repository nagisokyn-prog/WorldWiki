use cerberus_infrastructure::RulesJsonRepository;
use cerberus_sfc::app_runner::{run_app, run_check, CheckExecutionOptions};
use cerberus_sfc::cli::{parse_cli_from, Cli, Commands};
use clap::Parser;
use std::path::PathBuf;
use std::sync::Arc;
use tempfile::tempdir;

#[test]
fn test_main_entrypoint_and_cli_parsing() {
    let cli_sfc_arg = parse_cli_from(["cargo", "cerberus-sfc", "init"]);
    assert!(matches!(cli_sfc_arg.command, Some(Commands::Init { .. })));

    let cli1 = Cli::try_parse_from(["cerberus-sfc", "check", "--path", "src", "--ci", "--sarif", "s.sarif", "--json", "j.json"]).unwrap();
    assert!(matches!(cli1.command, Some(Commands::Check { ci: true, .. })));
    let _ = format!("{:?}", cli1);
    let _ = format!("{:?}", cli1.command);

    let cli2 = Cli::try_parse_from(["cerberus-sfc", "init", "--force"]).unwrap();
    assert!(matches!(cli2.command, Some(Commands::Init { force: true })));
    let _ = format!("{:?}", cli2);
    let _ = format!("{:?}", cli2.command);

    let cli3 = Cli::try_parse_from(["cerberus-sfc", "--validate-rules", "--rules-path", "cerberus.json"]).unwrap();
    assert!(cli3.validate_rules);
    let _ = format!("{:?}", cli3);
    let _ = format!("{:?}", cli3.command);
}

#[test]
fn test_sfc_run_app_init_and_check() {
    let temp = tempdir().unwrap();
    let src_dir = temp.path().join("src");
    std::fs::create_dir_all(&src_dir).unwrap();
    std::fs::write(src_dir.join("Card.vue"), "<template><div>OK</div></template>").unwrap();

    let config_file = temp.path().join("cerberus.json");
    std::fs::write(&config_file, "{\"version\": \"1.0\", \"rules\": {}}").unwrap();

    assert!(run_app(Cli {
        rules_path: Some(config_file.clone()),
        validate_rules: false,
        command: Some(Commands::Check {
            path: temp.path().to_path_buf(),
            sarif: None,
            json: None,
            ci: false,
        }),
    }).is_ok());

    assert!(run_app(Cli {
        rules_path: Some(config_file.clone()),
        validate_rules: false,
        command: Some(Commands::Init { force: true }),
    }).is_ok());

    // Test Tree command
    let tree_json = temp.path().join("sfc_tree.json");
    assert!(run_app(Cli {
        rules_path: Some(config_file.clone()),
        validate_rules: false,
        command: Some(Commands::Tree {
            path: temp.path().to_path_buf(),
            json: Some(tree_json.clone()),
        }),
    }).is_ok());
    assert!(tree_json.exists());

    assert!(run_app(Cli {
        rules_path: Some(config_file.clone()),
        validate_rules: false,
        command: Some(Commands::Tree {
            path: temp.path().to_path_buf(),
            json: None,
        }),
    }).is_ok());

    // Tree error branches
    assert!(run_app(Cli {
        rules_path: Some(config_file.clone()),
        validate_rules: false,
        command: Some(Commands::Tree {
            path: PathBuf::from("non_existent_sfc_tree_path_123"),
            json: None,
        }),
    }).is_err());

    let invalid_json_dir = temp.path().join("invalid_json_dir");
    std::fs::create_dir_all(&invalid_json_dir).unwrap();
    assert!(run_app(Cli {
        rules_path: Some(config_file.clone()),
        validate_rules: false,
        command: Some(Commands::Tree {
            path: temp.path().to_path_buf(),
            json: Some(invalid_json_dir),
        }),
    }).is_err());

    assert!(run_app(Cli {
        rules_path: Some(config_file),
        validate_rules: false,
        command: Some(Commands::Init { force: false }),
    }).is_ok());

    // Test Init write failure when cerberus.json is a directory
    let temp_err = tempdir().unwrap();
    std::fs::create_dir(temp_err.path().join("cerberus.json")).unwrap();
    let prev_cwd = std::env::current_dir().unwrap();
    let _ = std::env::set_current_dir(temp_err.path());
    assert!(run_app(Cli {
        rules_path: None,
        validate_rules: false,
        command: Some(Commands::Init { force: true }),
    }).is_err());
    let _ = std::env::set_current_dir(prev_cwd);
}

#[test]
fn test_sfc_validate_rules_success_and_err() {
    let temp = tempdir().unwrap();
    let config_file = temp.path().join("cerberus.json");
    std::fs::write(
        &config_file,
        "{\"version\": \"1.0\", \"rules\": {\"VUE-001\": \"deny\"}}",
    )
    .unwrap();

    assert!(run_app(Cli {
        rules_path: Some(config_file),
        validate_rules: true,
        command: None,
    }).is_ok());

    let mismatch_config = temp.path().join("mismatch.json");
    std::fs::write(
        &mismatch_config,
        "{\"version\": \"1.0\", \"rules\": [{\"id\": \"ONLY_ONE_RULE\", \"version\": \"1.0\", \"category\": \"Architecture\", \"severity\": \"deny\", \"title\": \"t\", \"description\": \"d\", \"remediation\": \"r\"}]}",
    )
    .unwrap();
    assert!(run_app(Cli {
        rules_path: Some(mismatch_config),
        validate_rules: true,
        command: None,
    }).is_err());

    let invalid_file = temp.path().join("invalid.json");
    std::fs::write(&invalid_file, "{\"version\": \"1.0\", \"rules\": []}").unwrap();
    assert!(run_app(Cli {
        rules_path: Some(invalid_file),
        validate_rules: true,
        command: None,
    }).is_err());

    let non_existent = temp.path().join("does_not_exist.json");
    assert!(run_app(Cli {
        rules_path: Some(non_existent),
        validate_rules: false,
        command: None,
    }).is_err());
}

#[test]
fn test_sfc_run_check_reports_and_errors() {
    let temp = tempdir().unwrap();
    let src_dir = temp.path().join("src");
    std::fs::create_dir_all(&src_dir).unwrap();
    std::fs::write(src_dir.join("Card.vue"), "<template><div>OK</div></template>").unwrap();

    let config_file = temp.path().join("cerberus.json");
    std::fs::write(&config_file, "{\"version\": \"1.0\", \"rules\": {}}").unwrap();
    let rules_repo = Arc::new(RulesJsonRepository::load_from_file(&config_file).unwrap());

    let sarif_file = temp.path().join("report.sarif");
    let json_file = temp.path().join("report.json");

    let check_opts = CheckExecutionOptions {
        rules_repo: rules_repo.clone(),
        path: temp.path(),
        sarif_path: Some(&sarif_file),
        json_path: Some(&json_file),
        ci: false,
    };
    let _ = format!("{:?}", check_opts);
    assert!(run_check(check_opts).is_ok());

    assert!(sarif_file.exists());
    assert!(json_file.exists());

    assert!(run_app(Cli {
        rules_path: Some(config_file.clone()),
        validate_rules: false,
        command: None,
    }).is_ok());

    let bad_src_dir = temp.path().join("bad_src");
    std::fs::create_dir_all(&bad_src_dir).unwrap();
    std::fs::write(
        bad_src_dir.join("Bad.vue"),
        "<template><div>Fail</div></template>\n<style>\n.btn { color: #ff0000; }\n</style>",
    )
    .unwrap();

    assert!(run_check(CheckExecutionOptions {
        rules_repo,
        path: &bad_src_dir,
        sarif_path: None,
        json_path: None,
        ci: true,
    }).is_err());

    let invalid_export_dir = temp.path().join("invalid_export_dir");
    std::fs::create_dir_all(&invalid_export_dir).unwrap();
    let repo_ok = Arc::new(RulesJsonRepository::load_from_file(&config_file).unwrap());
    assert!(run_check(CheckExecutionOptions {
        rules_repo: repo_ok.clone(),
        path: &src_dir,
        sarif_path: Some(&invalid_export_dir),
        json_path: Some(&invalid_export_dir),
        ci: false,
    }).is_ok());

    let locked_temp = tempdir().unwrap();
    let locked_file_path = locked_temp.path().join("locked.vue");
    #[cfg(windows)]
    {
        use std::fs::OpenOptions;
        use std::os::windows::fs::OpenOptionsExt;
        let _locked_handle = OpenOptions::new()
            .read(true)
            .write(true)
            .create(true)
            .truncate(true)
            .share_mode(0)
            .open(&locked_file_path)
            .unwrap();

        assert!(run_check(CheckExecutionOptions {
            rules_repo: repo_ok,
            path: locked_temp.path(),
            sarif_path: None,
            json_path: None,
            ci: true,
        }).is_err());
    }
}

#[test]
fn test_sfc_binary_e2e_and_parse_cli() {
    let _ = cerberus_sfc::cli::parse_cli();

    let bin = PathBuf::from(env!("CARGO_BIN_EXE_cerberus-sfc"));
    if bin.exists() {
        let temp = tempdir().unwrap();
        let src_dir = temp.path().join("src");
        std::fs::create_dir_all(&src_dir).unwrap();
        std::fs::write(src_dir.join("Component.vue"), "<template><div>OK</div></template>").unwrap();

        let output = std::process::Command::new(&bin)
            .arg("check")
            .arg("--path")
            .arg(temp.path())
            .output()
            .expect("Failed to execute cerberus-sfc binary");
        assert!(output.status.success());

        let init_output = std::process::Command::new(&bin)
            .arg("init")
            .output()
            .expect("Failed to execute cerberus-sfc init");
        assert!(init_output.status.success() || !init_output.stdout.is_empty());

        let err_output = std::process::Command::new(&bin)
            .env("CERBERUS_TEST_MAIN", "1")
            .arg("--rules-path")
            .arg("non_existent_rules_file_123.json")
            .arg("check")
            .output()
            .expect("Failed to execute cerberus-sfc binary for error branch");
        assert!(!err_output.status.success() || !err_output.stderr.is_empty());
    }
}
