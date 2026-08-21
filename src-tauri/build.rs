fn main() {
    if cfg!(target_os = "windows") {
        println!("cargo:rustc-link-arg=/NODEFAULTLIB:libcmt.lib");
    }
    tauri_build::build()
}
