use std::env;
use std::path::PathBuf;

fn main() {
    println!("cargo:rerun-if-changed=../../vendor/llama-turboquant-cpp");

    let dst = cmake::Config::new("../../vendor/llama-turboquant-cpp")
        .define("GGML_CUDA", "ON")
        .define("CMAKE_CUDA_ARCHITECTURES", "75-virtual")
        .build();

    println!("cargo:rustc-link-search=native={}/lib", dst.display());
    println!("cargo:rustc-link-search=native={}/lib64", dst.display()); // Some platforms use lib64
    println!("cargo:rustc-link-lib=static=llama");
    println!("cargo:rustc-link-lib=static=ggml");

    // Generate bindings
    let header_path = "../../vendor/llama-turboquant-cpp/llama.h";
    let bindings = bindgen::Builder::default()
        .header(header_path)
        .parse_callbacks(Box::new(bindgen::CargoCallbacks::new()))
        .generate()
        .expect("Unable to generate bindings");

    let out_path = PathBuf::from(env::var("OUT_DIR").unwrap());
    bindings
        .write_to_file(out_path.join("bindings.rs"))
        .expect("Couldn't write bindings!");
}
