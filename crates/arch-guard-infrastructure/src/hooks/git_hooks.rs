use std::fs;
use std::path::Path;

pub struct GitHooksInstaller;

impl GitHooksInstaller {
    pub fn install(workspace_root: &Path) -> Result<(), String> {
        let git_dir = workspace_root.join(".git");
        if !git_dir.exists() {
            return Err("Not a git repository: .git directory not found".into());
        }

        let hooks_dir = git_dir.join("hooks");
        fs::create_dir_all(&hooks_dir)
            .map_err(|e| format!("Failed to create hooks directory: {}", e))?;

        // 1. Pre-commit hook
        let pre_commit_script = r#"#!/bin/sh
# Arch Guard Pre-commit hook
echo "🛡️  [Arch Guard] Checking architectural invariants..."
cargo run --manifest-path crates/cargo-arch-guard/Cargo.toml -- check || {
    echo "❌ Architectural firewall violations found. Commit blocked."
    exit 1
}
"#;
        let pre_commit_path = hooks_dir.join("pre-commit");
        fs::write(&pre_commit_path, pre_commit_script)
            .map_err(|e| format!("Failed to write pre-commit hook: {}", e))?;

        // 2. Post-merge hook
        let post_merge_script = r#"#!/bin/sh
# Arch Guard Post-merge hook: reconcile baseline merge conflicts
echo "🛡️  [Arch Guard] Reconciling guardian-baseline.json..."
cargo run --manifest-path crates/cargo-arch-guard/Cargo.toml -- baseline reconcile || true
"#;
        let post_merge_path = hooks_dir.join("post-merge");
        fs::write(&post_merge_path, post_merge_script)
            .map_err(|e| format!("Failed to write post-merge hook: {}", e))?;

        // 3. Update .gitattributes with union merge driver
        let gitattributes_path = workspace_root.join(".gitattributes");
        let mut gitattributes_content = if gitattributes_path.exists() {
            fs::read_to_string(&gitattributes_path).unwrap_or_default()
        } else {
            String::new()
        };

        if !gitattributes_content.contains("guardian-baseline.json") {
            gitattributes_content.push_str("\nguardian-baseline.json merge=union\n");
            let _ = fs::write(&gitattributes_path, gitattributes_content);
        }

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn test_git_hooks_install_success() {
        let temp = tempdir().unwrap();
        let git_dir = temp.path().join(".git");
        fs::create_dir_all(&git_dir).unwrap();

        let result = GitHooksInstaller::install(temp.path());
        assert!(result.is_ok());

        assert!(git_dir.join("hooks/pre-commit").exists());
        assert!(git_dir.join("hooks/post-merge").exists());
        assert!(temp.path().join(".gitattributes").exists());
    }

    #[test]
    fn test_git_hooks_install_non_git_repo_fails() {
        let temp = tempdir().unwrap();
        let result = GitHooksInstaller::install(temp.path());
        assert!(result.is_err(), "Must fail if .git does not exist");
    }
}

