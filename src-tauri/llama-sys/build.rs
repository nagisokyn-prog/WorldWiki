#[path = "build_cmake.rs"]
mod build_cmake;

#[path = "build_bindings.rs"]
mod build_bindings;

use std::env;
use std::path::Path;

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let manifest_dir = env::var("CARGO_MANIFEST_DIR").unwrap_or_else(|_| ".".to_string());
    let vendor_dir = Path::new(&manifest_dir).join("../../vendor/llama-turboquant-cpp");
    let cache_dir = Path::new(&manifest_dir).join("prebuilt-libs");

    build_cmake::build_and_link(&vendor_dir, &cache_dir)?;
    build_bindings::generate(&vendor_dir, &cache_dir)?;

    Ok(())
}
