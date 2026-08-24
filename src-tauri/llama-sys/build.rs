use std::env;
use std::path::{Path, PathBuf};
use std::process::Command;

fn main() {
    let manifest_dir = env::var("CARGO_MANIFEST_DIR").unwrap();
    let vendor_dir = Path::new(&manifest_dir).join("../../vendor/llama-turboquant-cpp");
    // Постоянный кэш вне target/: переживает cargo clean.
    let cache_dir = Path::new(&manifest_dir).join("prebuilt-libs");
    let build_dir = cache_dir.join("build");
    let marker_file = cache_dir.join(".build-ok");

    println!("cargo:rerun-if-changed={}", vendor_dir.join("CMakeLists.txt").display());
    println!("cargo:rerun-if-changed={}", vendor_dir.join("include").display());
    println!("cargo:rerun-if-changed={}", vendor_dir.join("src").display());
    println!("cargo:rerun-if-changed={}", vendor_dir.join("ggml").display());
    println!("cargo:rerun-if-env-changed=LLAMA_SYS_FORCE_REBUILD");

    let force_rebuild = env::var("LLAMA_SYS_FORCE_REBUILD")
        .map(|v| v == "1" || v.eq_ignore_ascii_case("true"))
        .unwrap_or(false);

    if force_rebuild || !marker_file.exists() {
        if force_rebuild && build_dir.exists() {
            let _ = std::fs::remove_dir_all(&build_dir);
        }
        let _ = std::fs::create_dir_all(&build_dir);

        // 1. Configure
        let mut configure = Command::new("cmake");
        configure.arg("-S").arg(&vendor_dir).arg("-B").arg(&build_dir);
        for (k, v) in [
            ("CMAKE_BUILD_TYPE", "Release"),
            ("BUILD_SHARED_LIBS", "OFF"),
            ("GGML_CUDA", "ON"),
            // Только PTX-совместимая базовая архитектура: лёгкий fatbin,
            // JIT-компиляция драйвером на любых более новых GPU (кэшируется).
            ("CMAKE_CUDA_ARCHITECTURES", "75"),
            ("LLAMA_BUILD_COMMON", "OFF"),
            ("LLAMA_BUILD_TESTS", "OFF"),
            ("LLAMA_BUILD_EXAMPLES", "OFF"),
            ("LLAMA_BUILD_TOOLS", "OFF"),
            ("LLAMA_BUILD_SERVER", "OFF"),
            ("LLAMA_BUILD_RPC", "OFF"),
            ("LLAMA_CURL", "OFF"),
            ("LLAMA_LLAMAFILE", "OFF"),
            ("GGML_TCQ", "ON"),
            ("LLAMA_SWA", "ON"),
            ("LLAMA_HYBRID_RECURRENT", "ON"),
        ] {
            configure.arg(format!("-D{k}={v}"));
        }
        run(&mut configure);

        // 2. Build
        run(Command::new("cmake")
            .arg("--build").arg(&build_dir)
            .arg("--config").arg("Release")
            .arg("--parallel"));

        std::fs::write(&marker_file, "ok").expect("failed to write build marker");
    }

    let dst = &cache_dir;

    let lib_dirs = [
        dst.join("lib"),
        dst.join("lib/static"),
        dst.join("lib64"),
        dst.join("build/src"),
        dst.join("build/src/Debug"),
        dst.join("build/src/Release"),
        dst.join("build/ggml/src"),
        dst.join("build/ggml/src/Debug"),
        dst.join("build/ggml/src/Release"),
        dst.join("build/ggml/src/ggml-cuda/Debug"),
        dst.join("build/ggml/src/ggml-cuda/Release"),
    ];

    for lib_dir in &lib_dirs {
        if lib_dir.exists() {
            println!("cargo:rustc-link-search=native={}", lib_dir.display());
        }
    }

    println!("cargo:rustc-link-lib=static=llama");
    println!("cargo:rustc-link-lib=static=ggml");
    println!("cargo:rustc-link-lib=static=ggml-base");
    println!("cargo:rustc-link-lib=static=ggml-cpu");
    println!("cargo:rustc-link-lib=static=ggml-cuda");

    if cfg!(target_os = "windows") {
        if let Ok(cuda_path) = env::var("CUDA_PATH") {
            println!("cargo:rustc-link-search=native={}\\lib\\x64", cuda_path);
        } else if let Ok(cuda_path) = env::var("CUDA_TOOLKIT_ROOT_DIR") {
            println!("cargo:rustc-link-search=native={}\\lib\\x64", cuda_path);
        }
        println!("cargo:rustc-link-lib=cudart_static");
        println!("cargo:rustc-link-lib=cublas");
        println!("cargo:rustc-link-lib=cublasLt");
        println!("cargo:rustc-link-lib=cuda");
        println!("cargo:rustc-link-arg=/NODEFAULTLIB:libcmt.lib");
        println!("cargo:rustc-link-arg=/NODEFAULTLIB:libcmtd.lib");
    }

    let header_path = vendor_dir.join("include/llama.h");
    let include_dir = vendor_dir.join("include");
    let ggml_include_dir = vendor_dir.join("ggml/include");

    let mut builder = bindgen::Builder::default()
        .header(header_path.to_str().unwrap())
        .clang_arg(format!("-I{}", include_dir.display()))
        .clang_arg(format!("-I{}", ggml_include_dir.display()))
        .parse_callbacks(Box::new(bindgen::CargoCallbacks::new()))
        .allowlist_function("llama_.*")
        .allowlist_function("ggml_.*")
        .allowlist_type("llama_.*")
        .allowlist_type("ggml_.*")
        .allowlist_var("LLAMA_.*")
        .allowlist_var("GGML_.*");

    if cfg!(target_os = "windows") {
        let target = env::var("TARGET").unwrap_or_else(|_| "x86_64-pc-windows-msvc".to_string());
        if let Some(tool) = cc::windows_registry::find_tool(&target, "cl.exe") {
            for (k, v) in tool.env() {
                if k.to_string_lossy().eq_ignore_ascii_case("INCLUDE") {
                    for path in env::split_paths(&v) {
                        if path.exists() {
                            builder = builder.clang_arg(format!("-I{}", path.display()));
                        }
                    }
                }
            }
        }
    }

    let bindings = builder
        .generate()
        .expect("Unable to generate bindings");

    let out_path = PathBuf::from(env::var("OUT_DIR").unwrap());
    bindings
        .write_to_file(out_path.join("bindings.rs"))
        .expect("Couldn't write bindings!");
}

/// Запускает команду, наследуя stdout/stderr; паникует при ошибке.
fn run(cmd: &mut Command) {
    let status = cmd
        .stdout(std::process::Stdio::inherit())
        .stderr(std::process::Stdio::inherit())
        .status()
        .unwrap_or_else(|e| panic!("failed to spawn {:?}: {}", cmd.get_program(), e));
    if !status.success() {
        panic!("command failed with {}: {:?}", status, cmd);
    }
}
