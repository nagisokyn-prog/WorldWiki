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
    fs::write(key_dir.join("secret.key"), "42".repeat(32)).unwrap();

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

#[test]
fn test_cli_invalid_rules_path_fails() {
    let output = Command::new(cargo_bin())
        .arg("--rules-path")
        .arg("non_existent_rules.json")
        .arg("check")
        .output()
        .expect("Failed to execute with invalid rules path");

    assert!(!output.status.success(), "Must fail on non-existent rules path");
}

#[test]
fn test_cli_explain_clusters_with_violations() {
    let invalid_path = fixture_dir("invalid_domain_imports");
    if !invalid_path.exists() {
        return;
    }

    let output = Command::new(cargo_bin())
        .arg("--rules-path")
        .arg(rules_path())
        .arg("explain")
        .arg("--path")
        .arg(&invalid_path)
        .output()
        .expect("Failed to execute explain command");

    assert!(output.status.success());
    let stdout = String::from_utf8_lossy(&output.stdout);
    assert!(stdout.contains("Total Violations:"));
}

#[test]
fn test_cli_default_command_no_subcommand() {
    let clean_path = fixture_dir("valid_clean_hexagonal");
    if !clean_path.exists() {
        return;
    }

    let output = Command::new(cargo_bin())
        .arg("--rules-path")
        .arg(rules_path())
        .current_dir(&clean_path)
        .output()
        .expect("Failed to execute default check");

    assert!(output.status.success());
}

#[test]
fn test_cli_validate_rules_failure_on_incomplete_rules() {
    let temp = tempdir().unwrap();
    let partial_rules = temp.path().join("partial_rules.json");
    let content = r#"{
        "version": "1.0",
        "rules": [
            {
                "id": "ARCH-001",
                "version": "1.0",
                "category": "Architecture",
                "severity": "Deny",
                "title": "T1",
                "description": "D1",
                "remediation": "R1"
            }
        ]
    }"#;
    fs::write(&partial_rules, content).unwrap();

    let output = Command::new(cargo_bin())
        .arg("--rules-path")
        .arg(&partial_rules)
        .arg("--validate-rules")
        .output()
        .expect("Failed to execute validate-rules");

    assert!(!output.status.success(), "Must fail when rules.json lacks required rules");
}

#[test]
fn test_cli_init_already_existing_baseline() {
    let temp = tempdir().unwrap();
    let baseline_file = temp.path().join("guardian-baseline.json");
    fs::write(&baseline_file, "[\"existing_hash\"]\n").unwrap();

    let output = Command::new(cargo_bin())
        .arg("--rules-path")
        .arg(rules_path())
        .arg("init")
        .current_dir(temp.path())
        .output()
        .expect("Failed to execute init");

    assert!(output.status.success());
    let content = fs::read_to_string(&baseline_file).unwrap();
    assert!(content.contains("existing_hash"), "Must not overwrite existing baseline");
}

#[test]
fn test_e2e_git_merge_conflict_reconcile() {
    let temp = tempdir().unwrap();
    let baseline_file = temp.path().join("guardian-baseline.json");

    let conflict_content = r#"<<<<<<< HEAD
[
  "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
]
=======
[
  "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
  "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc"
]
>>>>>>> feature/refactor-domain
"#;
    fs::write(&baseline_file, conflict_content).unwrap();

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
    let content = fs::read_to_string(&baseline_file).unwrap();
    assert!(!content.contains("<<<<<<<"), "Conflict markers must be removed");
    assert!(!content.contains(">>>>>>>"), "Conflict markers must be removed");
    assert!(!content.contains("======="), "Conflict markers must be removed");

    let parsed: Vec<String> = serde_json::from_str(&content).expect("Must be valid JSON array");
    assert_eq!(parsed.len(), 3, "Must deduplicate into 3 unique hashes");
    assert_eq!(parsed[0], "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa");
    assert_eq!(parsed[1], "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb");
    assert_eq!(parsed[2], "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc");
}

#[test]
fn test_e2e_ledger_re_sign_all_command() {
    let temp = tempdir().unwrap();
    let lock_file = temp.path().join("guardian-ledger.lock");

    let old_key_file = temp.path().join("old.key");
    let new_key_file = temp.path().join("new.key");
    fs::write(&old_key_file, "11".repeat(32)).unwrap();
    fs::write(&new_key_file, "22".repeat(32)).unwrap();

    // Initial sign
    let output_sign = Command::new(cargo_bin())
        .arg("--rules-path")
        .arg(rules_path())
        .arg("ledger")
        .arg("sign")
        .arg("--rule")
        .arg("ARCH-001")
        .arg("--fingerprint")
        .arg("fp123")
        .arg("--reason")
        .arg("Refactor")
        .arg("--author")
        .arg("Alice")
        .current_dir(temp.path())
        .output()
        .unwrap();
    assert!(output_sign.status.success());

    // Create a mock ledger lock with initial signature
    let expires = chrono::Utc::now() + chrono::Duration::days(30);
    let initial_supp = vec![serde_json::json!({
        "rule_id": "ARCH-001",
        "fingerprint": "fp123",
        "reason": "Refactor",
        "author": "Alice",
        "expires": expires.to_rfc3339(),
        "signature": "initial_sig"
    })];
    fs::write(&lock_file, serde_json::to_string_pretty(&initial_supp).unwrap()).unwrap();

    // Force re-sign with new key
    let output_resign = Command::new(cargo_bin())
        .arg("--rules-path")
        .arg(rules_path())
        .arg("ledger")
        .arg("re-sign")
        .arg("--all")
        .arg("--file")
        .arg(&lock_file)
        .arg("--new-key-path")
        .arg(&new_key_file)
        .arg("--force")
        .output()
        .expect("Failed to execute ledger re-sign");

    assert!(
        output_resign.status.success(),
        "stderr: {}",
        String::from_utf8_lossy(&output_resign.stderr)
    );
    let stdout = String::from_utf8_lossy(&output_resign.stdout);
    assert!(stdout.contains("Successfully re-signed 1 suppression"));

    // Verify lock file contains valid updated signature
    let updated_content = fs::read_to_string(&lock_file).unwrap();
    assert!(!updated_content.contains("initial_sig"), "Old signature must be replaced");
}

#[test]
fn test_e2e_pure_vue_project_scan() {
    let temp = tempdir().unwrap();
    let src_dir = temp.path().join("src/components");
    fs::create_dir_all(&src_dir).unwrap();

    // 1. Vue component with hardcoded hex colors and monolith script
    let mut heavy_script = String::from("<script setup>\nimport { ref } from 'vue';\nconst val = ref(0);\n");
    for i in 0..40 {
        heavy_script.push_str(&format!("function job_{}() {{ val.value += {}; }}\n", i, i));
    }
    heavy_script.push_str("</script>\n<template><div class=\"box\">Hello</div></template>\n<style>\n.box { color: #ff0000; background: #000000; }\n</style>\n");
    fs::write(src_dir.join("HeavyMonolith.vue"), heavy_script).unwrap();

    let output = Command::new(cargo_bin())
        .arg("--rules-path")
        .arg(rules_path())
        .arg("check")
        .arg("--path")
        .arg(temp.path())
        .arg("--frontend-only")
        .output()
        .expect("Failed to execute check on pure Vue project");

    let combined = format!(
        "{} {}",
        String::from_utf8_lossy(&output.stdout),
        String::from_utf8_lossy(&output.stderr)
    );

    assert!(
        combined.contains("VUE-001") || combined.contains("CSS-001") || combined.contains("CSS-004"),
        "Must detect Vue frontend violations: {}",
        combined
    );
}

#[test]
fn test_e2e_ledger_security_tamper_and_expiry() {
    let temp = tempdir().unwrap();
    let lock_file = temp.path().join("guardian-ledger.lock");
    let old_key_file = temp.path().join("old.key");
    let new_key_file = temp.path().join("new.key");
    fs::write(&old_key_file, "33".repeat(32)).unwrap();
    fs::write(&new_key_file, "44".repeat(32)).unwrap();

    // 1. Valid initial suppression signed with old key
    let expires = chrono::Utc::now() + chrono::Duration::days(30);
    let old_storage = cargo_arch_guard::infrastructure::FileStorageAdapter::new(old_key_file.clone());
    let sig = cargo_arch_guard::application::SignSuppressionUseCase::sign(
        &old_storage,
        "ARCH-001",
        "fp123",
        "Valid reason",
        "Lead",
        &expires,
    ).unwrap();

    let entry = serde_json::json!({
        "rule_id": "ARCH-001",
        "fingerprint": "fp123",
        "reason": "Tampered reason", // Tampered reason!
        "author": "Lead",
        "expires": expires.to_rfc3339(),
        "signature": sig
    });
    fs::write(&lock_file, serde_json::to_string_pretty(&vec![entry]).unwrap()).unwrap();

    // Re-signing without --force must fail on tampered content
    let output_tamper = Command::new(cargo_bin())
        .arg("--rules-path")
        .arg(rules_path())
        .arg("ledger")
        .arg("re-sign")
        .arg("--all")
        .arg("--file")
        .arg(&lock_file)
        .arg("--old-key-path")
        .arg(&old_key_file)
        .arg("--new-key-path")
        .arg(&new_key_file)
        .output()
        .expect("Failed to execute ledger re-sign");

    assert!(!output_tamper.status.success(), "Tampered entry must be rejected during re-sign verification");
}

#[test]
fn test_e2e_check_with_expanded_flag() {
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
        .arg("--expanded")
        .output()
        .expect("Failed to execute check with --expanded");

    // Must exit 0 (either successfully expanded or gracefully fallen back with warning)
    assert!(output.status.success(), "Expanded mode check on clean project must succeed");
}

#[test]
fn test_e2e_model_status_and_clean_command() {
    let output_status = Command::new(cargo_bin())
        .arg("--rules-path")
        .arg(rules_path())
        .arg("model")
        .arg("status")
        .output()
        .expect("Failed to execute model status");

    assert!(output_status.status.success());
    let stdout = String::from_utf8_lossy(&output_status.stdout);
    assert!(stdout.contains("ARCH GUARD NEURAL MODEL STATUS"));

    let output_clean = Command::new(cargo_bin())
        .arg("--rules-path")
        .arg(rules_path())
        .arg("model")
        .arg("clean")
        .output()
        .expect("Failed to execute model clean");

    assert!(output_clean.status.success());
}
