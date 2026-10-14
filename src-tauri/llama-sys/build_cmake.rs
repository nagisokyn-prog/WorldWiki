use std::env;
use std::path::Path;
use std::process::Command;

pub fn build_and_link(vendor_dir: &Path, cache_dir: &Path) -> Result<(), Box<dyn std::error::Error>> {
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
            let clean_result = std::fs::remove_dir_all(&build_dir);
            if let Err(e) = clean_result {
                eprintln!("[llama-sys] Warning: failed to clean build dir: {e}");
            }
        }
        if let Err(e) = std::fs::create_dir_all(&build_dir) {
            eprintln!("[llama-sys] Warning: failed to create build dir: {e}");
        }

        let mut configure = Command::new("cmake");
        configure.arg("-S").arg(vendor_dir).arg("-B").arg(&build_dir);
        for (k, v) in [
            ("CMAKE_BUILD_TYPE", "Release"),
            ("BUILD_SHARED_LIBS", "OFF"),
            ("GGML_CUDA", "ON"),
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
        run(&mut configure)?;

        run(Command::new("cmake")
            .arg("--build").arg(&build_dir)
            .arg("--config").arg("Release")
            .arg("--parallel"))?;

        if let Err(e) = std::fs::write(&marker_file, "ok") {
            eprintln!("[llama-sys] Warning: failed to write build marker: {e}");
        }
    }

    emit_link_directives(cache_dir);
    Ok(())
}

fn emit_link_directives(dst: &Path) {
    let lib_dirs = [
        dst.join("lib"),
        dst.join("lib/static"),
        dst.join("lib64"),
        dst.join("build/src/Release"),
        dst.join("build/ggml/src/Release"),
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
        println!("cargo:rustc-link-lib=msvcprt");
    }
}

fn run(cmd: &mut Command) -> Result<(), Box<dyn std::error::Error>> {
    let status = cmd
        .stdout(std::process::Stdio::inherit())
        .stderr(std::process::Stdio::inherit())
        .status()
        .map_err(|e| format!("failed to spawn {:?}: {}", cmd.get_program(), e))?;
    if !status.success() {
        return Err(format!("command failed with {}: {:?}", status, cmd).into());
    }
    Ok(())
}
