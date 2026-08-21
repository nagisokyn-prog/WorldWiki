use std::env;
use std::path::{Path, PathBuf};

fn main() {
    let manifest_dir = env::var("CARGO_MANIFEST_DIR").unwrap();
    let vendor_dir = Path::new(&manifest_dir).join("../../vendor/llama-turboquant-cpp");

    println!("cargo:rerun-if-changed={}", vendor_dir.join("CMakeLists.txt").display());
    println!("cargo:rerun-if-changed={}", vendor_dir.join("include").display());
    println!("cargo:rerun-if-changed={}", vendor_dir.join("src").display());
    println!("cargo:rerun-if-changed={}", vendor_dir.join("ggml").display());

    let mut cmake_config = cmake::Config::new(&vendor_dir);

    cmake_config
        .profile("Release")
        .define("BUILD_SHARED_LIBS", "OFF")
        .define("GGML_CUDA", "ON")
        .define("CMAKE_CUDA_ARCHITECTURES", "75;80;86;89;120;121")
        .define("LLAMA_BUILD_COMMON", "OFF")
        .define("LLAMA_BUILD_TESTS", "OFF")
        .define("LLAMA_BUILD_EXAMPLES", "OFF")
        .define("LLAMA_BUILD_TOOLS", "OFF")
        .define("LLAMA_BUILD_SERVER", "OFF")
        .define("LLAMA_BUILD_RPC", "OFF")
        .define("LLAMA_CURL", "OFF")
        .define("LLAMA_LLAMAFILE", "OFF")
        .define("GGML_TCQ", "ON")
        .define("LLAMA_SWA", "ON")
        .define("LLAMA_HYBRID_RECURRENT", "ON");

    let dst = cmake_config.build();

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
