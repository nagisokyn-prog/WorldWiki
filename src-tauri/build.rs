fn main() {
    if std::env::var("CARGO_CFG_TARGET_OS").as_deref() == Ok("windows") {
        // Интеграционные тесты (tests/*.rs) не получают манифест от tauri_build
        // (тот линкует его только в bins через .res-ресурс). Без манифеста с
        // Common-Controls v6 тестовый exe биндится на comctl32 v5, где нет
        // TaskDialogIndirect (его тянет tauri/mock-runtime) ->
        // краш загрузки 0xc0000139 (STATUS_ENTRYPOINT_NOT_FOUND).
        // Встраиваем манифест ТОЛЬКО в тестовые таргеты (-tests не пересекается с -bins).
        let manifest_dir = std::env::var("CARGO_MANIFEST_DIR").unwrap_or_else(|_| ".".to_string());
        let manifest = std::path::PathBuf::from(manifest_dir)
            .join("tests.manifest");
        println!("cargo:rerun-if-changed={}", manifest.display());
        println!("cargo:rustc-link-arg-tests=/MANIFEST:EMBED");
        println!(
            "cargo:rustc-link-arg-tests=/MANIFESTINPUT:{}",
            manifest.display()
        );
    }
    tauri_build::build()
}
