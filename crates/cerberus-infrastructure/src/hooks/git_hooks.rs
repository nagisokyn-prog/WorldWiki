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
# Cerberus Pre-commit hook
echo "🛡️  [Cerberus] Checking architectural invariants..."
cargo run --manifest-path crates/cargo-cerberus/Cargo.toml -- check || {
    echo "❌ Architectural firewall violations found. Commit blocked."
    exit 1
}
"#;
        let pre_commit_path = hooks_dir.join("pre-commit");
        fs::write(&pre_commit_path, pre_commit_script)
            .map_err(|e| format!("Failed to write pre-commit hook: {}", e))?;

        // 2. Post-merge hook
        let post_merge_script = r#"#!/bin/sh
# Cerberus Post-merge hook: reconcile baseline merge conflicts
echo "🛡️  [Cerberus] Reconciling cerberus-baseline.json..."
cargo run --manifest-path crates/cargo-cerberus/Cargo.toml -- baseline reconcile || true
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

        if !gitattributes_content.contains("cerberus-baseline.json") {
            gitattributes_content.push_str("\ncerberus-baseline.json merge=union\nguardian-baseline.json merge=union\n");
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

        // Re-install when .gitattributes already contains the union merge driver
        let result2 = GitHooksInstaller::install(temp.path());
        assert!(result2.is_ok());
    }

    #[test]
    fn test_git_hooks_install_non_git_repo_fails() {
        let temp = tempdir().unwrap();
        let result = GitHooksInstaller::install(temp.path());
        assert!(result.is_err(), "Must fail if .git does not exist");
    }

    #[test]
    fn test_git_hooks_install_hooks_dir_creation_failure() {
        let temp = tempdir().unwrap();
        let git_dir = temp.path().join(".git");
        fs::create_dir_all(&git_dir).unwrap();
        // Create .git/hooks as a file so fs::create_dir_all fails
        fs::write(git_dir.join("hooks"), "not a directory").unwrap();

        let result = GitHooksInstaller::install(temp.path());
        assert!(result.is_err());
    }

    #[test]
    fn test_git_hooks_install_pre_commit_and_post_merge_write_failures() {
        // Pre-commit write failure
        let temp1 = tempdir().unwrap();
        let hooks1 = temp1.path().join(".git/hooks");
        fs::create_dir_all(&hooks1).unwrap();
        fs::create_dir_all(hooks1.join("pre-commit")).unwrap(); // directory instead of file causes fs::write to fail
        assert!(GitHooksInstaller::install(temp1.path()).is_err());

        // Post-merge write failure
        let temp2 = tempdir().unwrap();
        let hooks2 = temp2.path().join(".git/hooks");
        fs::create_dir_all(&hooks2).unwrap();
        fs::create_dir_all(hooks2.join("post-merge")).unwrap();
        assert!(GitHooksInstaller::install(temp2.path()).is_err());
    }
}


