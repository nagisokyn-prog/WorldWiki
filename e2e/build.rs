fn main() {
    napi_build::setup();

    if std::env::var("CARGO_CFG_TARGET_OS").as_deref() == Ok("windows") {
        // Link Windows UCRT and MSVC dynamic runtime import libraries for cdylib / N-API addon
        println!("cargo:rustc-link-lib=ucrt");
        println!("cargo:rustc-link-lib=vcruntime");
        println!("cargo:rustc-link-lib=msvcrt");
        println!("cargo:rustc-link-lib=msvcprt");
    }
}
