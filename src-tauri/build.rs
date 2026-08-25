fn main() {
    if cfg!(target_os = "windows") {
        println!("cargo:rustc-link-arg=/NODEFAULTLIB:libcmt.lib");
        // Тестовые бинари не получают манифест от tauri_build (тот линкует его
        // только в bins). Без манифеста тестовый exe биндится на comctl32 v5,
        // где нет TaskDialogIndirect (его тянет tauri/mock-runtime) ->
        // краш загрузки 0xc0000139 (STATUS_ENTRYPOINT_NOT_FOUND).
        // Встраиваем манифест с Common-Controls v6 только в тестовые таргеты.
        println!("cargo:rustc-link-arg-tests=/MANIFEST:EMBED");
        let manifest_dir = std::env::var("CARGO_MANIFEST_DIR").unwrap();
        println!("cargo:rustc-link-arg-tests=/MANIFESTINPUT:{manifest_dir}\\tests.manifest");
    }
    tauri_build::build()
}
