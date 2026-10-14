use std::env;
use std::path::{Path, PathBuf};

pub fn generate(vendor_dir: &Path, cache_dir: &Path) -> Result<(), Box<dyn std::error::Error>> {
    let header_path = vendor_dir.join("include/llama.h");
    let include_dir = vendor_dir.join("include");
    let ggml_include_dir = vendor_dir.join("ggml/include");

    let header_str = header_path.to_str().unwrap_or("include/llama.h");
    let mut builder = bindgen::Builder::default()
        .header(header_str)
        .clang_arg(format!("-I{}", include_dir.display()))
        .clang_arg(format!("-I{}", ggml_include_dir.display()))
        .parse_callbacks(Box::new(bindgen::CargoCallbacks::new()))
        .allowlist_function("llama_.*")
        .allowlist_function("ggml_.*")
        .allowlist_type("llama_.*")
        .allowlist_type("ggml_.*")
        .allowlist_var("LLAMA_.*")
        .allowlist_var("GGML_.*")
        .layout_tests(false);

    if cfg!(target_os = "windows") {
        configure_windows_clang();
        builder = configure_windows_includes(builder);
    }

    let out_dir = env::var("OUT_DIR").unwrap_or_else(|_| ".".to_string());
    let out_file = PathBuf::from(&out_dir).join("bindings.rs");
    let cached_bindings = cache_dir.join("bindings.rs");

    match builder.generate() {
        Ok(bindings) => {
            bindings
                .write_to_file(&out_file)
                .map_err(|e| format!("[llama-sys] Failed to write bindings to OUT_DIR: {e}"))?;
            if let Err(e) = bindings.write_to_file(&cached_bindings) {
                eprintln!("[llama-sys] Warning: failed to write cached bindings: {e}");
            }
        }
        Err(e) => {
            if cached_bindings.exists() {
                eprintln!("[llama-sys] Warning: bindgen failed ({e}), using cached bindings from {}", cached_bindings.display());
                std::fs::copy(&cached_bindings, &out_file)
                    .map_err(|err| format!("[llama-sys] Failed to copy cached bindings to OUT_DIR: {err}"))?;
            } else {
                return Err(format!("[llama-sys] bindgen failed to generate bindings and no cached bindings.rs found in {}: {e}", cached_bindings.display()).into());
            }
        }
    }

    Ok(())
}

fn configure_windows_clang() {
    if env::var("LIBCLANG_PATH").is_ok() {
        return;
    }
    let possible_clang_dirs = [
        "C:\\Program Files\\LLVM\\bin",
        "C:\\Program Files\\Microsoft Visual Studio\\2022\\Community\\VC\\Tools\\Llvm\\x64\\bin",
        "C:\\Program Files\\Microsoft Visual Studio\\2022\\Professional\\VC\\Tools\\Llvm\\x64\\bin",
        "C:\\Program Files\\Microsoft Visual Studio\\2022\\Enterprise\\VC\\Tools\\Llvm\\x64\\bin",
        "C:\\Program Files\\Microsoft Visual Studio\\2022\\BuildTools\\VC\\Tools\\Llvm\\x64\\bin",
    ];
    for dir in possible_clang_dirs {
        let p = Path::new(dir);
        if p.join("libclang.dll").exists() {
            // SAFETY: Build script runs in single-threaded context during Cargo build setup; setting LIBCLANG_PATH initializes clang toolchain safely.
            unsafe {
                env::set_var("LIBCLANG_PATH", dir);
            }
            break;
        }
    }
}

fn configure_windows_includes(mut builder: bindgen::Builder) -> bindgen::Builder {
    let mut include_found = false;
    if let Ok(include_env) = env::var("INCLUDE") {
        for path in env::split_paths(&include_env) {
            if path.exists() {
                builder = builder.clang_arg(format!("-I{}", path.display()));
                include_found = true;
            }
        }
    }
    if include_found {
        return builder;
    }

    if let Ok(tool) = cc::Build::new().try_get_compiler() {
        for (key, val) in tool.get_envs() {
            if key.to_string_lossy().eq_ignore_ascii_case("INCLUDE") {
                for path in env::split_paths(val) {
                    if path.exists() {
                        builder = builder.clang_arg(format!("-I{}", path.display()));
                    }
                }
            }
        }
    }
    builder
}
