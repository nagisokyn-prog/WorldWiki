fn main() {
    napi_build::setup();
    // Линкер для e2e переопределён на link.exe в e2e/.cargo/config.toml.
    // link.exe сам находит ucrt.lib, vcruntime.lib, msvcprt.lib через
    // переменную среды LIB (которую rustup + VS устанавливают при сборке).
    // Явные cargo:rustc-link-lib здесь не нужны и только мешают —
    // они заставляли lld-link искать .lib по /LIBPATH путям из OUT_DIR,
    // где tauri-build кладёт 82-байтные заглушки.
}
