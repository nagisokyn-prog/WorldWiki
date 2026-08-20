# План 7: Интеграция llama-turboquant-cpp в бинарник WorldWiki
## 📋 Обзор
Полная интеграция форка `TheTom/llama-cpp-turboquant` (версия `tqp-v0.3.0+`) в Tauri-приложение WorldWiki через статическую линковку в единый `.exe` файл.
**Цель:** Локальный LLM инференс с поддержкой:
- TurboQuant квантование (TURBO2/3/4, TQ1/2)
- TCQ (Trellis-Coded Quantization) — 7x контекст в той же VRAM
- TriAttention KV-эвикция (рантайм, через `.triattention` файлы)
- DFlash Speculative Decoding (ускорение через draft модель)
- Context Checkpointing (save/restore сессии + KV кэш)
- SWA / Hybrid-Recurrent Memory
- CUDA на RTX 20/30/40/50 серии
---
## 🏗️ Архитектура
```
┌─────────────────────────────────────────────────────────────────┐
│ WorldWiki Tauri App │
├─────────────────────────────────────────────────────────────────┤
│ src-tauri/ │
│ ├── Cargo.toml ← features: ai-local = ["ai-cloud", "dep:llama-sys"] │
│ ├── build.rs ← (опционально) дополнительные проверки │
│ └── llama-sys/ ← Rust-обёртка над C++ библиотекой │
│ ├── Cargo.toml ← cmake=0.10, bindgen=0.69 │
│ ├── build.rs ← CMake конфигурация для llama-turboquant-cpp │
│ └── src/lib.rs ← re-export bindgen bindings │
│ │
│ └── src/logic/ai/ ← Бизнес-логика ИИ │
│ ├── mod.rs ← #[cfg(feature = "ai-local")] pub mod local_llm; │
│ ├── local_llm.rs ← FFI wrapper + high-level API │
│ ├── agent_runtime.rs ← Agent Loop интеграция │
│ ├── agent/ │
│ │ ├── mod.rs │
│ │ ├── prompt.rs │
│ │ └── runner.rs ← добавление "local" провайдера │
│ └── providers/ │
│ ├── mod.rs │
│ └── fetch.rs ← исправление "local" case │
└─────────────────────────────────────────────────────────────────┘
│
▼
┌─────────────────────────────────────────────────────────────────┐
│ vendor/llama-turboquant-cpp (git submodule / vendored) │
│ ├── include/llama.h ← C API (bindgen генерит отсюда) │
│ ├── src/ ← llama.cpp + TurboQuant + TriAttention │
│ ├── ggml/ ← ggml с TCQ, CUDA kernels │
│ └── CMakeLists.txt ← собирается через cmake crate │
└─────────────────────────────────────────────────────────────────┘
```
---
## 📦 Этап 0: Синхронизация вендора (30 мин)
### 0.1 Проверить текущее состояние
```bash
cd vendor/llama-turboquant-cpp
git log --oneline -1
git tag --contains HEAD
```
### 0.2 Переключиться на стабильный релиз `tqp-v0.3.0`
```bash
git fetch --tags
git checkout tqp-v0.3.0 # тег 30d6881 от 12 июля 2026
```
**Версия в vendor должна быть именно `tqp-v0.3.0`** — это гарантирует:
- Стабильный API (без breaking changes из main)
- Все фиксы P0/P1 до 12 июля
- TCQ, SWA, DFlash, Context Checkpointing доступны
- Prebuilts для Windows CUDA 12.4 существуют для верификации
---
## 🔧 Этап 1: Сборка `llama-sys` (1-2 часа) — БЛОКИРУЕТ ВСЁ
### 1.1 `llama-sys/Cargo.toml`
```toml
[package]
name = "llama-sys"
version = "0.1.0"
edition = "2021"
[build-dependencies]
cmake = "0.10"
bindgen = "0.69"
[dependencies]
libc = "0.2"
```
### 1.2 `llama-sys/build.rs` — Полная замена
```rust
// src-tauri/llama-sys/build.rs
use std::env;
use std::path::PathBuf;
fn main() {
// Ребилд при изменениях в вендоре
println!("cargo:rerun-if-changed=../../vendor/llama-turboquant-cpp/CMakeLists.txt");
println!("cargo:rerun-if-changed=../../vendor/llama-turboquant-cpp/include/llama.h");
println!("cargo:rerun-if-changed=../../vendor/llama-turboquant-cpp/src");
println!("cargo:rerun-if-changed=../../vendor/llama-turboquant-cpp/ggml");
let dst = cmake::Config::new("../../vendor/llama-turboquant-cpp")
// CUDA поддержка
.define("GGML_CUDA", "ON")
.define("CMAKE_CUDA_ARCHITECTURES", "75;80;86;89;120;121")
// Статическая линковка — ВШИВАЕМ В БИНАРНИК
.define("BUILD_SHARED_LIBS", "OFF")
// Отключаем лишние артефакты
.define("LLAMA_BUILD_COMMON", "OFF")
.define("LLAMA_BUILD_TESTS", "OFF")
.define("LLAMA_BUILD_EXAMPLES", "OFF")
.define("LLAMA_BUILD_TOOLS", "OFF")
.define("LLAMA_BUILD_RPC", "OFF")
.define("LLAMA_CURL", "OFF")
.define("LLAMA_LLAMAFILE", "OFF")
// NEW v0.3.0 features
.define("GGML_TCQ", "ON") // Trellis-Coded Quantization
.define("LLAMA_SWA", "ON") // Sliding Window Attention
.define("LLAMA_HYBRID_RECURRENT", "ON") // Hybrid recurrent memory
.build();
// Пути к статическим либам (Windows: lib/ или lib64/)
let lib_dir = dst.join("lib");
let lib_dir64 = dst.join("lib64");
println!("cargo:rustc-link-search=native={}", lib_dir.display());
if lib_dir64.exists() {
println!("cargo:rustc-link-search=native={}", lib_dir64.display());
}
// Порядок важен: llama зависит от ggml
println!("cargo:rustc-link-lib=static=llama");
println!("cargo:rustc-link-lib=static=ggml");
// Windows: системные либы для CUDA
if cfg!(target_os = "windows") {
println!("cargo:rustc-link-lib=cudart_static");
println!("cargo:rustc-link-lib=cublas_static");
}
// Bindgen — генерим FFI биндинги к llama.h
let header_path = "../../vendor/llama-turboquant-cpp/include/llama.h";
let bindings = bindgen::Builder::default()
.header(header_path)
.parse_callbacks(Box::new(bindgen::CargoCallbacks::new()))
// Фильтруем только llama_* и LLAMA_* / GGML_*
.allowlist_function("llama_.*")
.allowlist_type("llama_.*")
.allowlist_var("LLAMA_.*")
.allowlist_var("GGML_.*")
// NEW: TurboQuant / TriAttention / State API
.allowlist_var("GGML_TYPE_TURBO.*")
.allowlist_var("GGML_TYPE_TQ.*")
.allowlist_var("LLAMA_TRIATTENTION_.*")
.allowlist_function("llama_triattention_.*")
.allowlist_function("llama_state_.*")
.allowlist_function("llama_memory_.*")
.generate()
.expect("Unable to generate bindings");
let out_path = PathBuf::from(env::var("OUT_DIR").unwrap());
bindings
.write_to_file(out_path.join("bindings.rs"))
.expect("Couldn't write bindings!");
}
```
### 1.3 `llama-sys/src/lib.rs` — без изменений
```rust
#![allow(non_upper_case_globals)]
#![allow(non_camel_case_types)]
#![allow(non_snake_case)]
include!(concat!(env!("OUT_DIR"), "/bindings.rs"));
```
### 1.4 Тест сборки
```bash
cd src-tauri
cargo build -p llama-sys --features ai-local 2>&1 | tail -50
```
**Критерий успеха:** Сборка проходит, в `target/debug/build/llama-sys-*/out/bindings.rs` есть функции `llama_model_load_from_file`, `llama_triattention_init`, `llama_state_save_file`, `llama_state_load_file`.
---
## 🦙 Этап 2: `local_llm.rs` — High-level FFI Wrapper (3-5 часов)
### 2.1 Файл: `src-tauri/src/logic/ai/local_llm.rs`
```rust
//! High-level wrapper over llama-sys FFI for local LLM inference.
//! Provides safe Rust API for model loading, streaming generation,
//! and advanced features (TCQ, TriAttention, Checkpointing, Speculative).
use std::ffi::{CStr, CString};
use std::os::raw::c_char;
use std::path::Path;
use std::ptr;
use std::sync::mpsc;
use llama_sys::*;
#[derive(Debug, Clone)]
pub struct ModelParams {
pub n_ctx: u32,
pub n_batch: u32,
pub n_gpu_layers: i32,
pub use_mmap: bool,
pub use_mlock: bool,
pub rope_freq_base: f32,
rope_freq_scale: f32,
// v0.3.0 features
pub enable_tcq: bool,
pub enable_swa: bool,
pub swa_window: u32,
}
impl Default for ModelParams {
fn default() -> Self {
Self {
n_ctx: 8192,
n_batch: 512,
n_gpu_layers: -1, // все слои на GPU
use_mmap: true,
use_mlock: false,
rope_freq_base: 10000.0,
rope_freq_scale: 1.0,
enable_tcq: true,
enable_swa: true,
swa_window: 4096,
}
}
}
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum QuantType {
Unknown,
Turbo2,
Turbo3,
Turbo4,
Turbo3Tcq,
Turbo4Tcq,
Standard,
}
#[derive(Debug, Clone)]
pub struct TokenEvent {
pub token: String,
pub is_done: bool,
}
pub struct LocalLlm {
model: *mut llama_model,
ctx: *mut llama_context,
sampler: *mut llama_sampler,
vocab: *mut llama_vocab,
n_ctx: u32,
n_vocab: i32,
params: ModelParams,
// State
n_past: i32,
tokens: Vec<llama_token>,
}
impl LocalLlm {
/// Загрузить модель из .gguf файла
pub fn load_model(model_path: &str, params: ModelParams) -> Result<Self, String> {
// 1. Model params
let model_params = llama_model_default_params();
let model_params = llama_model_params {
n_gpu_layers: params.n_gpu_layers,
use_mmap: params.use_mmap,
use_mlock: params.use_mlock,
..model_params
};
// 2. Load model
let c_path = CString::new(model_path).map_err(|e| e.to_string())?;
let model = unsafe { llama_model_load_from_file(c_path.as_ptr(), model_params) };
if model.is_null() {
return Err(format!("Failed to load model from {}", model_path));
}
// 3. Detect quantization type
let quant_type = Self::detect_quant_type(model);
log::info!("Model loaded: {:?}, quant: {:?}", model_path, quant_type);
// 4. Context params
let ctx_params = llama_context_default_params();
let ctx_params = llama_context_params {
n_ctx: params.n_ctx as i32,
n_batch: params.n_batch as i32,
n_ubatch: params.n_batch as i32,
rope_freq_base: params.rope_freq_base,
rope_freq_scale: params.rope_freq_scale,
..ctx_params
};
// 5. Create context
let ctx = unsafe { llama_init_from_model(model, ctx_params) };
if ctx.is_null() {
unsafe { llama_model_free(model) };
return Err("Failed to create context".to_string());
}
// 6. Vocab & sampler
let vocab = unsafe { llama_model_get_vocab(model) };
let n_vocab = unsafe { llama_vocab_n_tokens(vocab) };
let sparams = llama_sampler_chain_default_params();
let sampler = unsafe { llama_sampler_chain_init(sparams) };
// Add default samplers: top-k, top-p, temp
unsafe {
llama_sampler_chain_add(sampler, llama_sampler_init_top_k(40));
llama_sampler_chain_add(sampler, llama_sampler_init_top_p(0.95, 1));
llama_sampler_chain_add(sampler, llama_sampler_init_temp(0.7));
llama_sampler_chain_add(sampler, llama_sampler_init_dist(LLAMA_DEFAULT_SEED));
}
Ok(Self {
model,
ctx,
sampler,
vocab,
n_ctx: params.n_ctx,
n_vocab,
params,
n_past: 0,
tokens: Vec::new(),
})
}
/// Авто-детект типа квантования модели
fn detect_quant_type(model: *mut llama_model) -> QuantType {
// llama_model_quantize_type не существует в API, используем метаданные
// Временно возвращаем Unknown, можно расширить через gguf метаданные
QuantType::Unknown
}
/// Включить TriAttention KV-эвикцию (требует .triattention файл калибровки)
pub fn enable_triattention(&mut self, stats_path: &str, budget: i32) -> Result<(), String> {
let c_path = CString::new(stats_path).map_err(|e| e.to_string())?;
let ok = unsafe {
llama_triattention_init(
self.ctx,
c_path.as_ptr(),
budget, // budget (e.g., 2048)
128, // divide_length / window
65536, // offset_max
0, // mode: global
0, // trigger: interval
0, // agg: mean
0, // seed
false, // normalize
true, // protect_prefill
false, // disable_mlr
false, // disable_trig
false, // enable_logging
)
};
if !ok {
return Err("TriAttention init failed: bad calibration file or model mismatch".to_string());
}
log::info!("TriAttention enabled with budget={}", budget);
Ok(())
}
/// Включить DFlash Speculative Decoding (draft модель)
pub fn enable_speculative(&mut self, draft_model_path: &str, p_min: f32) -> Result<(), String> {
// TODO: требует загрузки draft модели и llama_speculative_init
// API в llama.h: llama_speculative_init, llama_speculative_free
// Пока заглушка
log::warn!("Speculative decoding not yet implemented");
Ok(())
}
/// Сохранить контекст (session + KV cache checkpoint) — v0.3.0 feature
pub fn save_checkpoint(&self, base_path: &str) -> Result<(), String> {
// 1. Save session file (.session)
let session_path = format!("{}.session", base_path);
let c_session = CString::new(&session_path).map_err(|e| e.to_string())?;
let tokens_ptr = self.tokens.as_ptr();
let n_tokens = self.tokens.len();
let ok = unsafe {
llama_state_save_file(self.ctx, c_session.as_ptr(), tokens_ptr, n_tokens)
};
if !ok {
return Err("Failed to save session".to_string());
}
// 2. KV cache checkpoint сохраняется автоматически как .ckpt sidecar
// (llama.cpp v0.3.0 делает это внутри llama_state_save_file)
log::info!("Checkpoint saved: {}.session + {}.ckpt", base_path, base_path);
Ok(())
}
/// Загрузить контекст (session + KV cache checkpoint) — v0.3.0 feature
pub fn load_checkpoint(&mut self, base_path: &str) -> Result<(), String> {
let session_path = format!("{}.session", base_path);
let c_session = CString::new(&session_path).map_err(|e| e.to_string())?;
// Allocate buffer for tokens
let mut tokens_out = vec![0i32; self.n_ctx as usize];
let mut n_token_count = 0usize;
let ok = unsafe {
llama_state_load_file(
self.ctx,
c_session.as_ptr(),
tokens_out.as_mut_ptr(),
tokens_out.len(),
&mut n_token_count,
)
};
if !ok {
return Err("Failed to load session".to_string());
}
self.tokens = tokens_out[..n_token_count].to_vec();
self.n_past = n_token_count as i32;
log::info!("Checkpoint loaded: {} tokens restored", n_token_count);
Ok(())
}
/// Стриминг генерации токенов
pub fn generate_stream(
&mut self,
prompt: &str,
tx: mpsc::Sender<TokenEvent>,
) -> Result<(), String> {
// 1. Tokenize prompt
let c_prompt = CString::new(prompt).map_err(|e| e.to_string())?;
let mut tokens = vec![0i32; prompt.len() * 2]; // generous buffer
let n_tokens = unsafe {
llama_tokenize(
self.vocab,
c_prompt.as_ptr(),
prompt.len() as i32,
tokens.as_mut_ptr(),
tokens.len() as i32,
true, // add_bos
false, // parse_special
)
};
if n_tokens < 0 {
return Err("Tokenization failed".to_string());
}
tokens.truncate(n_tokens as usize);
// 2. Process prompt (prefill)
let batch = llama_batch_get_one(&mut tokens, self.n_past);
let ret = unsafe { llama_decode(self.ctx, batch) };
if ret != 0 {
return Err(format!("Prefill decode failed: {}", ret));
}
self.n_past += n_tokens as i32;
self.tokens.extend_from_slice(&tokens);
// 3. Generation loop
let mut n_decode = 0;
let max_tokens = self.n_ctx as i32 - self.n_past - 1;
while n_decode < max_tokens {
// Sample next token
let token = unsafe { llama_sampler_sample(self.sampler, self.ctx, -1) };
// Check for EOS
if llama_vocab_is_eog(self.vocab, token) {
let _ = tx.send(TokenEvent { token: String::new(), is_done: true });
break;
}
// Convert token to string
let mut buf = [0u8; 256];
let n = unsafe { llama_token_to_piece(self.vocab, token, buf.as_mut_ptr() as *mut c_char, buf.len() as i32, 0, true) };
if n > 0 {
let piece = std::str::from_utf8(&buf[..n as usize]).unwrap_or("");
if !piece.is_empty() {
let _ = tx.send(TokenEvent { token: piece.to_string(), is_done: false });
}
}
// Feed token back
let batch = llama_batch_get_one(&mut [token], self.n_past);
let ret = unsafe { llama_decode(self.ctx, batch) };
if ret != 0 {
return Err(format!("Decode failed at step {}: {}", n_decode, ret));
}
self.n_past += 1;
self.tokens.push(token);
n_decode += 1;
// Check if channel disconnected
if tx.send(TokenEvent { token: String::new(), is_done: false }).is_err() {
break;
}
}
let _ = tx.send(TokenEvent { token: String::new(), is_done: true });
Ok(())
}
/// Получить эмбеддинги (для RAG)
pub fn get_embeddings(&mut self, text: &str, layer: i32) -> Result<Vec<f32>, String> {
// Tokenize
let c_text = CString::new(text).map_err(|e| e.to_string())?;
let mut tokens = vec![0i32; text.len() * 2];
let n_tokens = unsafe {
llama_tokenize(self.vocab, c_text.as_ptr(), text.len() as i32, tokens.as_mut_ptr(), tokens.len() as i32, true, false)
};
if n_tokens < 0 { return Err("Tokenize failed".to_string()); }
tokens.truncate(n_tokens as usize);
// Process
let batch = llama_batch_get_one(&mut tokens, 0);
let ret = unsafe { llama_decode(self.ctx, batch) };
if ret != 0 { return Err("Decode failed".to_string()); }
// Get embeddings
let embeddings = unsafe { llama_get_embeddings_seq(self.ctx, layer) };
if embeddings.is_null() { return Err("No embeddings".to_string()); }
let n_embd = unsafe { llama_n_embd(self.model) };
let mut result = vec![0.0f32; n_embd as usize];
unsafe { ptr::copy_nonoverlapping(embeddings as *const f32, result.as_mut_ptr(), n_embd as usize) };
Ok(result)
}
}
impl Drop for LocalLlm {
fn drop(&mut self) {
unsafe {
if !self.sampler.is_null() { llama_sampler_free(self.sampler); }
if !self.ctx.is_null() { llama_free(self.ctx); }
if !self.model.is_null() { llama_model_free(self.model); }
}
}
}
// Helper для создания batch из одного токена/последовательности
fn llama_batch_get_one(tokens: &mut [llama_token], n_past: i32) -> llama_batch {
let mut batch = unsafe { llama_batch_init(tokens.len() as i32, 0, 1) };
batch.n_tokens = tokens.len() as i32;
for (i, &tok) in tokens.iter().enumerate() {
batch.token[i] = tok;
batch.pos[i] = n_past + i as i32;
batch.n_seq_id[i][0] = 0;
batch.seq_id[i][0] = 0;
batch.logits[i] = (i == tokens.len() - 1) as i32; // only last token logits
}
batch
}
// Unsafe: llama-sys не экспортирует все нужные функции, нужны ручные объявления
extern "C" {
fn llama_token_to_piece(vocab: *const llama_vocab, token: llama_token, buf: *mut c_char, length: i32, lstrip: i32, special: bool) -> i32;
fn llama_vocab_is_eog(vocab: *const llama_vocab, token: llama_token) -> bool;
fn llama_n_embd(model: *const llama_model) -> i32;
fn llama_get_embeddings_seq(ctx: *const llama_context, layer: i32) -> *const std::ffi::c_void;
}
```
### 2.2 Регистрация модуля в `src-tauri/src/logic/ai/mod.rs`
```rust
// src-tauri/src/logic/ai/mod.rs
#[cfg(feature = "ai-local")]
pub mod local_llm;
#[cfg(feature = "ai-local")]
pub mod agent_runtime;
pub mod agent;
pub mod chat;
pub mod providers;
pub mod tools;
```
---
## 🤖 Этап 3: Интеграция в Agent Loop (2-3 часа)
### 3.1 `src-tauri/src/logic/ai/agent/runner.rs` — Добавление local провайдера
В функции `build_provider_client` добавить branch:
```rust
// В build_provider_client, после строки 97 (other => Err(...))
"local" => {
// Local provider использует llama-sys напрямую, не HTTP
#[cfg(feature = "ai-local")]
{
// Возвращаем специальный enum variant или используем существующий
// Для простоты: возвращаем OpenAiCompatClient с base_url = "local://"
// А в stream_message обрабатываем отдельно
let client = OpenAiCompatClient::new(api_key, OpenAiCompatConfig::openai())
.with_base_url("local://".to_string())
.with_http_client(http_client);
Ok(ProviderClient::OpenAi(client))
}
#[cfg(not(feature = "ai-local"))]
{
Err("Local LLM support not compiled. Enable 'ai-local' feature.".to_string())
}
}
```
### 3.2 Новый файл: `src-tauri/src/logic/ai/agent_runtime.rs`
```rust
//! Agent Runtime для локального LLM — инкапсуляция цикла агента с llama-sys
use crate::logic::ai::local_llm::{LocalLlm, ModelParams, TokenEvent};
use crate::logic::ai::tools::WorldWikiTools;
use crate::AppState;
use serde::Serialize;
use serde_json::Value;
use std::sync::mpsc;
use tauri::{AppHandle, Emitter};
#[derive(Clone, Serialize)]
pub struct StreamChunk {
pub chat_id: String,
pub message_id: String,
pub text: String,
pub is_done: bool,
pub chunk_type: String,
}
#[derive(Clone, Serialize)]
pub struct AgentToolEvent {
pub chat_id: String,
pub message_id: String,
pub tool_name: String,
pub tool_args: Value,
}
pub struct LocalAgentRuntime {
llm: LocalLlm,
app_handle: AppHandle,
chat_id: String,
message_id: String,
}
impl LocalAgentRuntime {
pub fn new(
model_path: &str,
params: ModelParams,
app_handle: AppHandle,
chat_id: String,
message_id: String,
) -> Result<Self, String> {
let llm = LocalLlm::load_model(model_path, params)?;
Ok(Self { llm, app_handle, chat_id, message_id })
}
pub fn with_triattention(mut self, stats_path: &str, budget: i32) -> Result<Self, String> {
self.llm.enable_triattention(stats_path, budget)?;
Ok(self)
}
pub fn with_checkpoint(mut self, checkpoint_path: &str) -> Result<Self, String> {
self.llm.load_checkpoint(checkpoint_path)?;
Ok(self)
}
/// Запустить агентный цикл с локальной моделью
pub async fn run_agent_loop(
mut self,
prompt: String,
tools: WorldWikiTools,
auto_approval: AutoApprovalSettings,
) -> Result<String, String> {
let (tx, rx) = mpsc::channel::<TokenEvent>();
let chat_id = self.chat_id.clone();
let message_id = self.message_id.clone();
let app_handle = self.app_handle.clone();
// Spawn generation in blocking task
let generation_handle = tauri::async_runtime::spawn_blocking(move || {
self.llm.generate_stream(&prompt, tx)
});
// Stream tokens to frontend
let mut full_response = String::new();
while let Ok(event) = rx.recv() {
if event.is_done {
break;
}
if !event.token.is_empty() {
full_response.push_str(&event.token);
// Emit to frontend
let _ = app_handle.emit("ai_stream_chunk", StreamChunk {
chat_id: chat_id.clone(),
message_id: message_id.clone(),
text: event.token,
is_done: false,
chunk_type: "text".to_string(),
});
}
}
// Wait for generation to complete
let _ = generation_handle.await;
// Save checkpoint after response
let checkpoint_path = format!("{}/checkpoints/{}_{}",
std::env::var("APPDATA").unwrap_or_else(|_| ".".to_string()),
chat_id, message_id);
let _ = self.llm.save_checkpoint(&checkpoint_path);
// TODO: Handle tool calls from full_response
// Parse tool calls, check auto_approval, execute, feed back
Ok(full_response)
}
}
// Re-export auto approval settings
use crate::logic::models::AutoApprovalSettings;
```
### 3.3 Использование в Tauri команде
В `runner.rs` или новой команде:
```rust
#[tauri::command]
pub async fn run_local_agent(
chat_id: String,
message_id: String,
prompt: String,
model_path: String,
triattention_path: Option<String>,
checkpoint_path: Option<String>,
app: tauri::AppHandle,
) -> Result<(), String> {
#[cfg(feature = "ai-local")]
{
let params = ModelParams::default();
let mut runtime = LocalAgentRuntime::new(&model_path, params, app.clone(), chat_id.clone(), message_id.clone())?;
if let Some(path) = triattention_path {
runtime = runtime.with_triattention(&path, 2048)?;
}
if let Some(path) = checkpoint_path {
runtime = runtime.with_checkpoint(&path)?;
}
let tools = WorldWikiTools::new(app.state::<AppState>().surreal_db().clone());
let approval = AutoApprovalSettings::get_global(app.state::<AppState>().surreal_db().clone()).await?;
let response = runtime.run_agent_loop(prompt, tools, approval).await?;
// Save final message to DB
// ...
Ok(())
}
#[cfg(not(feature = "ai-local"))]
{
Err("Local LLM not enabled".to_string())
}
}
```
---
## 🌐 Этап 4: Исправление `fetch.rs` (30 мин)
### 4.1 `src-tauri/src/logic/ai/providers/fetch.rs` — Убрать HTTP fallback для "local"
```rust
// В fetch_ai_models, заменить "local" case (строки 203-231):
"local" => {
#[cfg(feature = "ai-local")]
{
// Возвращаем список доступных локальных моделей из папки models
let models_dir = dirs::data_local_dir()
.map(|p| p.join("WorldWiki/models"))
.unwrap_or_else(|| PathBuf::from("./models"));
if models_dir.exists() {
let mut models = Vec::new();
for entry in std::fs::read_dir(&models_dir).map_err(|e| e.to_string())? {
let entry = entry.map_err(|e| e.to_string())?;
let path = entry.path();
if path.extension().and_then(|s| s.to_str()) == Some("gguf") {
let name = path.file_stem().and_then(|s| s.to_str()).unwrap_or("unknown");
models.push(AiModelInfo {
value: path.to_string_lossy().to_string(),
label: name.to_string(),
description: "Local GGUF model".to_string(),
context_length: None,
max_completion_tokens: None,
});
}
}
models.sort_by(|a, b| a.label.cmp(&b.label));
return Ok(models);
}
Ok(vec![])
}
#[cfg(not(feature = "ai-local"))]
{
Ok(vec![])
}
}
```
---
## 📥 Этап 5: Model Hub (3-4 часа) — Опционально для v1.0
### 5.1 `src-tauri/src/logic/ai/model_hub.rs`
```rust
//! Встроенный магазин моделей (Hugging Face integration)
use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use tauri::AppHandle;
#[derive(Serialize, ts_rs::TS)]
#[ts(export)]
pub struct HfModelInfo {
pub id: String,
pub author: String,
pub name: String,
pub downloads: u64,
pub likes: u64,
pub tags: Vec<String>,
pub gguf_files: Vec<GgufFileInfo>,
}
#[derive(Serialize, ts_rs::TS)]
#[ts(export)]
pub struct GgufFileInfo {
pub filename: String,
pub quantization: String, // "Q4_K_M", "TURBO3_TCQ", etc.
pub size_gb: f32,
pub vram_required_gb: f32,
pub ram_required_gb: f32,
pub recommended: bool,
}
#[tauri::command]
pub async fn fetch_hf_models(query: Option<String>) -> Result<Vec<HfModelInfo>, String> {
let client = Client::new();
let url = "https://huggingface.co/api/models";
let mut req = client.get(url)
.query(&[
("filter", "gguf"),
("sort", "downloads"),
("direction", "-1"),
("limit", "50"),
]);
if let Some(q) = query {
req = req.query(&[("search", q)]);
}
let resp = req.send().await.map_err(|e| e.to_string())?;
let models: Vec<HfModelApiResponse> = resp.json().await.map_err(|e| e.to_string())?;
// Transform & enrich with quantization info
Ok(models.into_iter().map(transform_model).collect())
}
#[tauri::command]
pub async fn download_model(
repo_id: String,
filename: String,
app: AppHandle,
) -> Result<String, String> {
let models_dir = dirs::data_local_dir()
.map(|p| p.join("WorldWiki/models"))
.unwrap_or_else(|| PathBuf::from("./models"));
std::fs::create_dir_all(&models_dir).map_err(|e| e.to_string())?;
let url = format!("https://huggingface.co/{}/resolve/main/{}", repo_id, filename);
let dest = models_dir.join(&filename);
// Download with progress events
let client = Client::new();
let resp = client.get(&url).send().await.map_err(|e| e.to_string())?;
let total = resp.content_length().unwrap_or(0);
let mut file = std::fs::File::create(&dest).map_err(|e| e.to_string())?;
let mut downloaded = 0u64;
let mut stream = resp.bytes_stream();
use futures_util::StreamExt;
while let Some(chunk) = stream.next().await {
let chunk = chunk.map_err(|e| e.to_string())?;
std::io::copy(&mut chunk.as_ref(), &mut file).map_err(|e| e.to_string())?;
downloaded += chunk.len() as u64;
let _ = app.emit("model_download_progress", serde_json::json!({
"filename": filename,
"downloaded": downloaded,
"total": total,
"percent": if total > 0 { (downloaded as f64 / total as f64 * 100.0) as u32 } else { 0 }
}));
}
Ok(dest.to_string_lossy().to_string())
}
// Auto-select best quantization based on user hardware
pub fn select_best_quantization(files: &[GgufFileInfo], vram_gb: f32, ram_gb: f32) -> Option<&GgufFileInfo> {
// Priority: TCQ > TurboQuant > Standard Q4_K_M > Q8_0
// Filter by VRAM/RAM constraints
files.iter()
.filter(|f| f.vram_required_gb <= vram_gb * 0.9 && f.ram_required_gb <= ram_gb * 0.7)
.max_by_key(|f| match f.quantization.as_str() {
s if s.contains("TCQ") => 100,
s if s.contains("TURBO") => 80,
"Q4_K_M" => 60,
"Q5_K_M" => 50,
"Q8_0" => 40,
_ => 10,
})
}
```
---
## 🎨 Этап 6: UI Integration (параллельно фронтенду)
### 6.1 Настройки Local LLM в `AiSettingsModal.vue`
```vue
<!-- Новые секции для ai-local -->
<div v-if="hasAiLocalFeature" class="local-llm-settings">
<h3>🦙 Локальный LLM (llama-turboquant-cpp)</h3>
<!-- Model Selection -->
<div class="setting-group">
<label>Модель (.gguf)</label>
<ModelPicker v-model="settings.localModelPath" @refresh="refreshLocalModels" />
</div>
<!-- Quantization Badge -->
<div v-if="selectedModelQuant" class="quant-badge" :class="quantClass">
{{ selectedModelQuant }}
<span v-if="selectedModelQuant.includes('TCQ')" class="tooltip">7x контекст в VRAM</span>
</div>
<!-- Advanced Settings (hidden by default) -->
<details class="advanced-settings">
<summary>🔧 Настройки для гиков</summary>
<div class="setting-group">
<label>Context Size (n_ctx)</label>
<input type="number" v-model="settings.n_ctx" min="512" max="131072" step="512" />
</div>
<div class="setting-group">
<label>GPU Layers (-1 = all)</label>
<input type="number" v-model="settings.n_gpu_layers" min="-1" max="100" />
</div>
<!-- v0.3.0 Features -->
<div class="setting-group">
<label>TCQ (Trellis-Coded Quantization)</label>
<input type="checkbox" v-model="settings.enable_tcq" />
<span class="help">2.25 бит/значение, 7x контекст</span>
</div>
<div class="setting-group">
<label>SWA (Sliding Window Attention)</label>
<input type="checkbox" v-model="settings.enable_swa" />
<input type="number" v-model="settings.swa_window" placeholder="Window size" />
</div>
<div class="setting-group">
<label>TriAttention Calibration File</label>
<FilePicker v-model="settings.triattention_path" filter=".triattention" />
<span class="help">Файл калибровки для KV-эвикции</span>
</div>
<div class="setting-group">
<label>Speculative Decoding (Draft Model)</label>
<FilePicker v-model="settings.draft_model_path" filter=".gguf" />
<input type="number" v-model="settings.speculative_p_min" step="0.01" placeholder="p_min" />
</div>
<div class="setting-group">
<label>Context Checkpointing</label>
<input type="checkbox" v-model="settings.auto_checkpoint" />
<span class="help">Автосохранение контекста при закрытии</span>
</div>
</details>
</div>
```
---
## 🔍 Этап 7: RAG / Embeddings (2-3 часа)
### 7.1 Отдельный инстанс для эмбеддингов
```rust
// В local_llm.rs добавить:
pub struct EmbeddingModel {
llm: LocalLlm,
}
impl EmbeddingModel {
pub fn load(path: &str) -> Result<Self, String> {
let params = ModelParams {
n_ctx: 8192,
n_batch: 512,
n_gpu_layers: -1,
..Default::default()
};
let llm = LocalLlm::load_model(path, params)?;
Ok(Self { llm })
}
pub fn embed(&mut self, texts: &[&str]) -> Result<Vec<Vec<f32>>, String> {
texts.iter()
.map(|t| self.llm.get_embeddings(t, -1)) // -1 = last layer
.collect()
}
}
```
### 7.2 Индексация в SurrealDB
```sql
-- В surreal_schema.surql
DEFINE INDEX idx_chat_embedding ON TABLE chat_messages
FIELD embedding
MTREE DIMENSION 1024; -- для nomic-embed-text-v1.5
```
---
## ⏱️ ИТОГОВЫЙ ТАЙМЛАЙН
| Этап | Задача | Время | Статус |
|------|--------|-------|--------|
| 0 | Sync vendor to `tqp-v0.3.0` | 30 мин | ⬜ |
| 1 | `llama-sys` build.rs + Cargo.toml + test build | 1-2 ч | ⬜ |
| 2 | `local_llm.rs` (core FFI wrapper) | 3-5 ч | ⬜ |
| 3 | Agent Loop интеграция (`agent_runtime.rs`, `runner.rs`) | 2-3 ч | ⬜ |
| 4 | `fetch.rs` fix для "local" | 30 мин | ⬜ |
| 5 | Model Hub (`model_hub.rs`) | 3-4 ч | ⬜ |
| 6 | UI Settings (Vue) | 2-4 ч | ⬜ |
| 7 | Embeddings для RAG | 2-3 ч | ⬜ |
**MVP (0-4): ~7-11 часов** — рабочий локальный LLM в бинарнике
**Full (0-7): ~12-18 часов** — все v0.3.0 фичи + RAG + UI
---
## 🛠️ Требования к окружению (Dev Machine)
- **Visual Studio 2022** с workload "Desktop development with C++" + **CMake**
- **CUDA Toolkit 12.4+** (для `GGML_CUDA=ON`)
- **Rust 1.75+** (MSVC toolchain: `rustup default stable-msvc`)
- **Git** (для vendor submodule)
- **8 GB+ VRAM** рекомендуется для тестов
---
## ⚠️ Риски и митигация
| Риск | Вероятность | Митигация |
|------|-------------|-----------|
| CMake не находит CUDA | Высокая | Проверить `nvcc --version`, `cmake --version` |
| bindgen падает на макросах | Средняя | Добавить `.blocklist_function("ggml_.*")` при необходимости |
| Статическая линковка CUDA на Windows | Средняя | `cudart_static`, `cublas_static` в build.rs |
| TriAttention калибровка не загружается | Низкая (MVP без неё) | Отложить до v1.1, использовать только TurboQuant |
| TCQ модели недоступны на HF | Низкая | Использовать стандартные Q4_K_M / TURBO3 до появления TCQ моделей |
---
## 📝 Чек-лист готовности к релизу
- [ ] Vendor на теге `tqp-v0.3.0`
- [ ] `cargo build -p llama-sys --features ai-local` проходит
- [ ] `bindings.rs` содержит `llama_triattention_init`, `llama_state_save_file`
- [ ] `local_llm.rs` компилируется и загружает модель
- [ ] Генерация токенов стримится во frontend
- [ ] Tool calls работают через Agent Loop
- [ ] Checkpoint save/load работает
- [ ] Model Hub скачивает и показывает модели
- [ ] UI настройки отображаются корректно
- [ ] Embeddings для RAG работают
---
## 🔗 Полезные ссылки
- [llama-turboquant-cpp releases](https://github.com/TheTom/llama-cpp-turboquant/releases)
- [TRIATTENTION.md](vendor/llama-turboquant-cpp/docs/TRIATTENTION.md)
- [TRIATTENTION-API.md](vendor/llama-turboquant-cpp/docs/TRIATTENTION-API.md)
- [ggml.h types](vendor/llama-turboquant-cpp/ggml/include/ggml.h) — для GGML_TYPE_TURBO*
- [cmake crate docs](https://docs.rs/cmake/latest/cmake/)
- [bindgen users guide](https://rust-lang.github.io/rust-bindgen/)
---
*План создан: 21.08.2026*
*Версия llama-turboquant-cpp: tqp-v0.3.0 (30d6881)*
*Target: WorldWiki v1.0 с ai-local feature*