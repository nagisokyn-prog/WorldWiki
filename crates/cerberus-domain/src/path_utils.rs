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
        assert!(path_ends_with(&win_path, "src/producer/sync_leak.rs"));
        assert!(path_ends_with(&win_path, "src\\producer\\sync_leak.rs"));
    }
}
