use std::path::Path;

/// Canonical path normalization: converts backslashes to forward slashes, trims whitespace, and lowercases.
#[inline]
#[must_use]
pub fn normalize_path(path: &Path) -> String {
    path.to_string_lossy()
        .replace('\\', "/")
        .to_lowercase()
}

/// Normalizes a string-based path or path segment.
#[inline]
#[must_use]
pub fn normalize_path_str(path_str: &str) -> String {
    path_str.replace('\\', "/").to_lowercase()
}

/// Checks if a normalized path contains the specified normalized segment.
#[inline]
#[must_use]
pub fn path_contains(path: &Path, segment: &str) -> bool {
    let norm_path = normalize_path(path);
    let norm_seg = normalize_path_str(segment);
    norm_path.contains(&norm_seg)
}

/// Checks if a normalized path starts with the specified normalized prefix.
#[inline]
#[must_use]
pub fn path_starts_with(path: &Path, prefix: &str) -> bool {
    let norm_path = normalize_path(path);
    let norm_prefix = normalize_path_str(prefix);
    norm_path.starts_with(&norm_prefix)
}

/// Checks if a normalized path ends with the specified normalized suffix.
#[inline]
#[must_use]
pub fn path_ends_with(path: &Path, suffix: &str) -> bool {
    let norm_path = normalize_path(path);
    let norm_suffix = normalize_path_str(suffix);
    norm_path.ends_with(&norm_suffix)
}

/// Checks if a relative path string matches an ignore glob or directory pattern.
#[must_use]
pub fn matches_ignore_pattern(rel_path: &str, pattern: &str) -> bool {
    let norm_path = rel_path.replace('\\', "/");
    let norm_pat = pattern.replace('\\', "/");

    if norm_pat.contains('*') {
        if let Some(suffix) = norm_pat.strip_prefix("**/*") {
            if norm_path.ends_with(suffix) {
                return true;
            }
        }
        if let Some(suffix) = norm_pat.strip_prefix("*") {
            if norm_path.ends_with(suffix) {
                return true;
            }
        }
        if let Some(prefix) = norm_pat.strip_suffix("/**") {
            let clean_prefix = prefix.trim_start_matches("**/").trim_matches('/');
            if !clean_prefix.is_empty()
                && (norm_path == clean_prefix
                    || norm_path.starts_with(&format!("{clean_prefix}/"))
                    || norm_path.contains(&format!("/{clean_prefix}/"))
                    || norm_path.ends_with(&format!("/{clean_prefix}")))
            {
                return true;
            }
        }
    }

    let clean = norm_pat.trim_matches('*').trim_matches('/');
    if !clean.is_empty()
        && (norm_path == clean
            || norm_path.starts_with(&format!("{clean}/"))
            || norm_path.contains(&format!("/{clean}/"))
            || norm_path.ends_with(&format!("/{clean}")))
    {
        return true;
    }

    false
}

/// Checks if a path relative to workspace/root should be ignored according to ignore patterns and hidden dirs.
#[must_use]
pub fn is_path_ignored(rel_path: &Path, ignore_patterns: &[String]) -> bool {
    for comp in rel_path.components() {
        let s = comp.as_os_str().to_string_lossy();
        if s.starts_with('.') && s != "." && s != ".." {
            return true;
        }
    }

    let rel_str = rel_path.to_string_lossy().replace('\\', "/");
    for pat in ignore_patterns {
        if matches_ignore_pattern(&rel_str, pat) {
            return true;
        }
    }
    false
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    #[test]
    fn test_cross_platform_normalization() {
        let win_path = PathBuf::from("C:\\Users\\Kuzma\\Project\\src\\producer\\sync_leak.rs");
        let unix_path = PathBuf::from("/home/kuzma/project/src/producer/sync_leak.rs");

        assert!(path_contains(&win_path, "/producer/"));
        assert!(path_contains(&win_path, "\\producer\\"));
        assert!(path_contains(&unix_path, "/producer/"));
        assert!(path_starts_with(&win_path, "c:/users/kuzma"));
        assert!(path_starts_with(&unix_path, "/home/kuzma"));
        assert!(path_ends_with(&win_path, "src/producer/sync_leak.rs"));
        assert!(path_ends_with(&win_path, "src\\producer\\sync_leak.rs"));
    }

    #[test]
    fn test_matches_ignore_pattern_and_is_path_ignored() {
        assert!(matches_ignore_pattern("dist/bundle.min.js", "**/*.min.js"));
        assert!(matches_ignore_pattern("temp/file.tmp", "*.tmp"));
        assert!(matches_ignore_pattern("docs/architecture/spec.md", "docs/**"));
        assert!(matches_ignore_pattern("crates/pkg/target/debug/app", "**/target/**"));
        assert!(matches_ignore_pattern("vendor/claw-code/rust/crates/api/src/providers/openai_compat.rs", "vendor/**"));

        let ignores = vec![
            "target/**".into(),
            "vendor/**".into(),
            "node_modules/**".into(),
            "**/*.min.js".into(),
        ];

        let p_vendor = Path::new("vendor/claw-code/rust/crates/api/src/providers/openai_compat.rs");
        assert!(is_path_ignored(p_vendor, &ignores));

        let p_hidden = Path::new("src-tauri/.logic_legacy/something.rs");
        assert!(is_path_ignored(p_hidden, &ignores));

        let p_clean = Path::new("src/main.rs");
        assert!(!is_path_ignored(p_clean, &ignores));
    }
}
