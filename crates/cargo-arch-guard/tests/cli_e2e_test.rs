use std::fs;
use std::path::PathBuf;
use std::process::Command;

use tempfile::tempdir;

fn cargo_bin() -> PathBuf {
    PathBuf::from(env!("CARGO_BIN_EXE_cargo-arch-guard"))
}

fn rules_path() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("../../firewall/rules.json")
}

fn fixture_dir(name: &str) -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("tests/fixtures")
        .join(name)
}

#[test]
fn test_cli_check_clean_project_exits_zero() {
    let clean_path = fixture_dir("valid_clean_hexagonal");
    if !clean_path.exists() {
        return;
    }

    let output = Command::new(cargo_bin())
        .arg("--rules-path")
        .arg(rules_path())
        .arg("check")
        .arg("--path")
        .arg(&clean_path)
        .output()
        .expect("Failed to execute cargo-arch-guard check");

    assert!(
        output.status.success(),
        "Clean project must exit with 0. stderr: {}",
        String::from_utf8_lossy(&output.stderr)
    );

    let stdout = String::from_utf8_lossy(&output.stdout);
    assert!(
        stdout.contains("0 architectural violations found"),
        "Stdout should indicate 0 violations"
    );
}

#[test]
fn test_cli_check_violating_project_exits_one() {
    let invalid_path = fixture_dir("invalid_domain_imports");
    if !invalid_path.exists() {
        return;
    }

    let output = Command::new(cargo_bin())
        .arg("--rules-path")
        .arg(rules_path())
        .arg("check")
        .arg("--path")
        .arg(&invalid_path)
        .output()
        .expect("Failed to execute cargo-arch-guard check");

    assert!(
        !output.status.success(),
        "Violating project must exit with non-zero code"
    );

    let combined = format!(
        "{} {}",
        String::from_utf8_lossy(&output.stdout),
        String::from_utf8_lossy(&output.stderr)
    );
    assert!(
        combined.contains("ARCH-001"),
        "Output should contain the violated rule ARCH-001: {}",
        combined
    );
}


#[test]
fn test_cli_check_exports_sarif_and_json_reports() {
    let clean_path = fixture_dir("valid_clean_hexagonal");
    if !clean_path.exists() {
        return;
    }

    let temp = tempdir().unwrap();
    let sarif_path = temp.path().join("report.sarif");
    let json_path = temp.path().join("report.json");

    let output = Command::new(cargo_bin())
        .arg("--rules-path")
        .arg(rules_path())
        .arg("check")
        .arg("--path")
        .arg(&clean_path)
        .arg("--sarif")
        .arg(&sarif_path)
        .arg("--json")
        .arg(&json_path)
        .output()
        .expect("Failed to execute cargo-arch-guard check with reports");

    assert!(output.status.success());
    assert!(sarif_path.exists(), "SARIF report file must be created");
    assert!(json_path.exists(), "JSON report file must be created");

    let sarif_content = fs::read_to_string(&sarif_path).unwrap();
    assert!(
        sarif_content.contains("sarif-schema-2.1.0"),
        "SARIF report must follow schema"
    );

    let json_content = fs::read_to_string(&json_path).unwrap();
    assert!(
        json_content.contains("\"total_violations\": 0"),
        "JSON report must contain total_violations"
    );
}

#[test]
fn test_cli_validate_rules_flag() {
    let output = Command::new(cargo_bin())
        .arg("--rules-path")
        .arg(rules_path())
        .arg("--validate-rules")
        .output()
        .expect("Failed to execute with --validate-rules");

    assert!(
        output.status.success(),
        "Rules validation against rules.json must succeed"
    );
}

#[test]
fn test_cli_baseline_reconcile_command() {
    let temp = tempdir().unwrap();
    let baseline_file = temp.path().join("guardian-baseline.json");

    // Create a messy baseline with duplicate and unsorted hashes
    let messy_json = r#"[
  "b84293f0b2401f80e9a65d9333535900de5deba621531e08cb08ff1e3e01869e",
  "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2",
  "b84293f0b2401f80e9a65d9333535900de5deba621531e08cb08ff1e3e01869e"
]"#;
    fs::write(&baseline_file, messy_json).unwrap();

    let output = Command::new(cargo_bin())
        .arg("--rules-path")
        .arg(rules_path())
        .arg("baseline")
        .arg("reconcile")
        .arg("--file")
        .arg(&baseline_file)
        .output()
        .expect("Failed to execute baseline reconcile");

    assert!(output.status.success());
    let stdout = String::from_utf8_lossy(&output.stdout);
    assert!(stdout.contains("2 entries"), "Must reconcile 3 items into 2 unique entries");

    let reconciled = fs::read_to_string(&baseline_file).unwrap();
    assert!(reconciled.contains("a1b2c3d4"), "Must contain deduplicated entry");
}

#[test]
fn test_cli_ledger_sign_and_verify_command() {
    let temp = tempdir().unwrap();
    let key_dir = temp.path().join(".archguard/keys");
    fs::create_dir_all(&key_dir).unwrap();
    fs::write(key_dir.join("secret.key"), [0x42u8; 32]).unwrap();

    let output = Command::new(cargo_bin())
        .arg("--rules-path")
        .arg(rules_path())
        .arg("ledger")
        .arg("sign")
        .arg("--rule")
        .arg("ARCH-001")
        .arg("--fingerprint")
        .arg("abc123hash")
        .arg("--reason")
        .arg("Legacy migration")
        .arg("--author")
        .arg("lead-arch")
        .current_dir(temp.path())
        .output()
        .expect("Failed to execute ledger sign");

    assert!(
        output.status.success(),
        "stderr: {}",
        String::from_utf8_lossy(&output.stderr)
    );
    let stdout = String::from_utf8_lossy(&output.stdout);
    assert!(stdout.contains("Signature:"), "Output must contain computed HMAC signature");

    let lock_file = temp.path().join("guardian-ledger.lock");
    fs::write(&lock_file, "{}").unwrap();

    let verify_output = Command::new(cargo_bin())
        .arg("--rules-path")
        .arg(rules_path())
        .arg("ledger")
        .arg("verify")
        .arg("--file")
        .arg(&lock_file)
        .output()
        .expect("Failed to execute ledger verify");

    assert!(verify_output.status.success());
}

#[test]
fn test_cli_explain_clusters_command() {
    let clean_path = fixture_dir("valid_clean_hexagonal");
    if !clean_path.exists() {
        return;
    }

    let output = Command::new(cargo_bin())
        .arg("--rules-path")
        .arg(rules_path())
        .arg("explain")
        .arg("--path")
        .arg(&clean_path)
        .output()
        .expect("Failed to execute explain command");

    assert!(output.status.success());
    let stdout = String::from_utf8_lossy(&output.stdout);
    assert!(stdout.contains("ARCHITECTURAL DEBT CLUSTER REPORT"));
}

#[test]
fn test_cli_init_hooks_command() {
    let temp = tempdir().unwrap();
    let git_dir = temp.path().join(".git");
    let hooks_dir = git_dir.join("hooks");
    fs::create_dir_all(&hooks_dir).unwrap();

    let output = Command::new(cargo_bin())
        .arg("--rules-path")
        .arg(rules_path())
        .arg("init")
        .arg("--hooks")
        .current_dir(temp.path())
        .output()
        .expect("Failed to execute init --hooks");

    assert!(
        output.status.success(),
        "stderr: {}",
        String::from_utf8_lossy(&output.stderr)
    );
    assert!(hooks_dir.join("pre-commit").exists(), "pre-commit hook must be created");
    assert!(hooks_dir.join("post-merge").exists(), "post-merge hook must be created");
    assert!(temp.path().join(".gitattributes").exists(), ".gitattributes must be updated");
}

#[test]
fn test_cli_check_frontend_and_backend_only_flags() {
    let clean_path = fixture_dir("valid_clean_hexagonal");
    if !clean_path.exists() {
        return;
    }

    // 1. Frontend only
    let out_front = Command::new(cargo_bin())
        .arg("--rules-path")
        .arg(rules_path())
        .arg("check")
        .arg("--path")
        .arg(&clean_path)
        .arg("--frontend-only")
        .output()
        .unwrap();
    assert!(out_front.status.success());

    // 2. Backend only
    let out_back = Command::new(cargo_bin())
        .arg("--rules-path")
        .arg(rules_path())
        .arg("check")
        .arg("--path")
        .arg(&clean_path)
        .arg("--backend-only")
        .output()
        .unwrap();
    assert!(out_back.status.success());
}

