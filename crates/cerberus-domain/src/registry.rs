use crate::rules::{Category, RuleDefinition, Severity};
use std::collections::HashMap;

pub struct BuiltinRuleRegistry;

#[inline]
fn r(id: &str, cat: Category, sev: Severity, title: &str, desc: &str, rem: &str) -> RuleDefinition {
    RuleDefinition {
        id: id.into(),
        version: "1.0".into(),
        category: cat,
        severity: sev,
        title: title.into(),
        description: desc.into(),
        remediation: rem.into(),
    }
}

impl BuiltinRuleRegistry {
    pub fn all_rules() -> Vec<RuleDefinition> {
        let mut base = vec![
            // 1. Rust & Hexagonal Backend Rules
            r("ARCH-001", Category::Architecture, Severity::Deny, "Domain crate cannot import external frameworks", "Domain layer must remain pure without dependencies on framework SDKs (tauri, tokio, surrealdb, reqwest).", "Move infrastructure dependencies to ports and adapter traits in infrastructure."),
            r("ARCH-002", Category::Architecture, Severity::Deny, "Application layer cannot import Tauri", "Application use cases must not depend on UI/IPC framework types (tauri::*).", "Pass UI parameters as clean DTOs into use case methods."),
            r("ARCH-003", Category::Architecture, Severity::Deny, "Ports layer cannot depend on infrastructure SDKs", "Ports layer defines pure traits and interfaces only.", "Move concrete client SDKs to infrastructure adapters."),
            r("ARCH-005", Category::Architecture, Severity::Deny, "Only adapters/tauri crate is authorized to import Tauri", "UI/IPC framework commands and dependencies are strictly isolated to authorized adapter layer.", "Move UI/IPC commands and dependencies to authorized adapter layer (adapters/tauri)."),
            r("ARCH-020", Category::Architecture, Severity::Deny, "Layer Dependency Hierarchy Violation in Cargo.toml", "Crate dependencies in Cargo.toml must strictly comply with the allowed dependency matrix.", "Invert dependency direction: pure domain/ports layers cannot depend on outer layers."),
            r("ARCH-013", Category::Architecture, Severity::Warn, "Package entered Zone of Pain (High Coupling with Zero Abstraction)", "Package has high afferent coupling (Ca > 3) with low instability (I < 0.2) and low abstractness (A < 0.2).", "Introduce abstract traits and interfaces to reduce direct coupling to concrete types."),
            r("ARCH-021", Category::Architecture, Severity::Warn, "Missing Architectural Layer Metadata", "Every workspace crate should explicitly declare [package.metadata.cerberus] layer = \"...\" in Cargo.toml.", "Add [package.metadata.cerberus] layer = \"domain|ports|application|infrastructure|adapter\" to Cargo.toml."),
            r("ARCH-030", Category::Architecture, Severity::Warn, "High Architectural Pressure Score (S_arch)", "File exceeds configured multi-dimensional Architectural Pressure threshold.", "Decompose module into smaller single-responsibility components and pure domain models."),
            r("ARCH-031", Category::Architecture, Severity::Deny, "Source Lines of Code (SLOC) limit exceeded", "File SLOC exceeds layer threshold.", "Extract helper functions and logic into cohesive submodules."),
            r("ARCH-032", Category::Architecture, Severity::Deny, "Too Many Functions in Single Module", "File exceeds maximum allowed function count. High function density breaks Single Responsibility and hampers unit testing.", "Decompose large module into cohesive submodules with dedicated responsibilities."),
            r("ARCH-040", Category::Architecture, Severity::Warn, "God Object with Critical Architectural Blast Radius (Fan-In > 80%)", "Module is directly imported by excessive number of components.", "Split God Object into cohesive domain interfaces and domain event contracts."),
            r("ASYNC-001", Category::Robustness, Severity::Deny, "Holding std::sync::MutexGuard across .await point", "Holding std::sync::MutexGuard across .await point causes Tokio worker starvation and deadlocks.", "Use tokio::sync::Mutex or explicitly drop the guard before .await."),
            r("ASYNC-002", Category::Robustness, Severity::Warn, "Zombie Background Task or Blocking Sleep in Async Context", "tokio::spawn without JoinHandle/CancellationToken or std::thread::sleep in async function blocks runtime.", "Store JoinHandle, pass CancellationToken, or use tokio::time::sleep()."),
            r("ROB-001", Category::Robustness, Severity::Warn, "High Panic Collapse Vector (.unwrap / .expect / raw indexing)", "Module execution paths can panic at runtime due to unwrap(), expect(), or unchecked slice indexing.", "Replace .unwrap() with ? error propagation and vec[i] with .get(i)."),
            r("SEC-001", Category::Security, Severity::Deny, "Taint-to-Sink Command Execution Vulnerability", "Unsanitized user input reaches system command execution sink.", "Sanitize path via validate_safe_path() or annotate function with #[cerberus(sanitizes)]."),
            r("SEC-002", Category::Security, Severity::Warn, "Transitive Capability Leakage in Pure Layer", "Pure domain or ports layer pulls transitive dependencies with network sockets or OS process execution capabilities.", "Remove bloated transitive dependencies from pure layer Cargo.toml."),
            r("SEC-003", Category::Security, Severity::Deny, "Command Injection Vector", "Tainted external arguments flow directly into Process Command execution.", "Use allowlisted commands and sanitize arguments."),
            r("SEC-008", Category::Security, Severity::Deny, "Timing Attack on Secret Comparison", "Direct == comparison of authentication tokens or crypto hashes is vulnerable to side-channel timing attacks.", "Use subtle::ConstantTimeEq for constant-time comparison."),
            r("SEC-009", Category::Security, Severity::Deny, "Hardcoded API Secrets or Private Keys", "Static API keys or token signatures detected in source code.", "Load secrets dynamically from environment variables or OS keyring."),
            r("SLOP-001", Category::Convention, Severity::Warn, "AI-Slop and Indirection Tax Detected", "Excessive .clone() density, mutable state in global lazy_static/RwLock, or unnecessary thread wrappers detected.", "Fix lifetimes instead of defensive cloning; avoid global mutable locks."),

            // 2. Vue SFC & Component Anatomy Rules
            r("VUE-001", Category::Convention, Severity::Deny, "Heavy business logic in <script setup>", "<script setup> block exceeds 30 lines of glue code. Logic must be decomposed into companion hook.", "Extract state, computed, and methods into use<Component>.ts hook."),
            r("VUE-002", Category::Convention, Severity::Deny, "Missing companion use<Component>.ts hook", "Non-trivial Vue component must have a companion use<Component>.ts hook.", "Create use<Component>.ts alongside <Component>.vue."),
            r("VUE-003", Category::Convention, Severity::Deny, "Declaring types inside .vue file is forbidden", "Interface Props, Emits, and DTO declarations must be placed in .model.ts or .types.ts.", "Move interfaces and types to <Component>.model.ts."),
            r("VUE-007", Category::Robustness, Severity::Deny, "Reactivity Destructuring Loss", "Destructuring props or store directly breaks Vue 3 reactive Proxy connections.", "Use toRefs(props) or storeToRefs(store) to maintain reactive signals."),
            r("VUE-008", Category::Convention, Severity::Deny, "Direct Prop Mutation Violation", "Directly mutating props (props.x = val or props.list.push()) violates one-way data flow.", "Emit update events to parent (emit('update:...')) instead of mutating props."),
            r("VUE-009", Category::Performance, Severity::Deny, "Heavy Template Method in Loop Anti-pattern", "Calling heavy functions or methods in v-for without stable key causes frame drops on every render.", "Precompute mapped data into computed() property or use stable unique :key."),
            r("TAURI-002", Category::Architecture, Severity::Deny, "Direct IPC in UI Component", "Calling invoke() or importing @tauri-apps/api directly from .vue presentation component is prohibited.", "Isolate Tauri IPC calls into shared API client services (@/shared/api/*.ts)."),

            // 3. CSS & Design Tokens Rules
            r("CSS-001", Category::Convention, Severity::Deny, "Hardcoded Hex/RGB/HSL color in CSS", "Direct Hex/RGB/HSL and named HTML colors are prohibited. Design system tokens must be used.", "Replace hardcoded color with var(--color-*) design token."),
            r("CSS-002", Category::Convention, Severity::Deny, "Missing design tokens for border-radius/transitions", "Hardcoded border-radius (8px, 4px) and transition durations violate design token standard.", "Use var(--border-radius-*) and var(--transition-*)."),
            r("CSS-004", Category::Convention, Severity::Deny, "CSS bloat in <style> block", "Scoped <style> block exceeds 70 lines. Style sheets must be decomposed with atomic subcomponents.", "Decompose template and styles into smaller subcomponents."),
            r("CSS-005", Category::Convention, Severity::Deny, "Raw Color Literal in TypeScript Logic", "Hardcoded Hex, RGB, or RGBA color strings detected inside TypeScript/Composable logic. Visual styling and colors must be expressed via CSS tokens, classes, or semantic variants.", "Replace hardcoded color string in TypeScript with semantic variant (e.g. timeOfDay: 'morning') or CSS custom property."),
            r("CSS-006", Category::Convention, Severity::Deny, "Important Rule Abuse in Scoped CSS", "Using !important in scoped component styles breaks CSS cascade specificity and theme overrides.", "Refactor CSS selector specificity instead of using !important."),
            r("CSS-PERF-001", Category::Performance, Severity::Warn, "Compositing Layer Budget Overuse", "Applying will-change on general selectors (div, button, *) or with all/auto risks excessive GPU VRAM consumption and layer explosion.", "Use will-change strictly on interactive states (:hover, .is-animating) with specific properties (transform, opacity)."),
            r("CSS-PERF-002", Category::Performance, Severity::Warn, "Excessive Filter and Blur Complexity Threshold", "Large blur radius in backdrop-filter/filter (> 30px) or > 4 chained filter functions causes severe GPU fill-rate degradation.", "Reduce blur radius to <= 30px and simplify chained filter functions."),
            r("CSS-PERF-003", Category::Performance, Severity::Deny, "Non-Composited Layout Property in Animation", "Animating layout-triggering properties (width, height, margin, padding, top, left, right, bottom, box-shadow) in keyframes or transitions causes expensive main-thread reflows.", "Animate compositor-only properties (transform, opacity) or use pseudo-elements for visual shadows."),
            r("CSS-PERF-004", Category::Performance, Severity::Deny, "Wildcard transition: all Prohibited", "Using transition: all or transition: inherit blindly animates future layout properties and induces layout thrashing.", "Explicitly declare animated properties (e.g. transition: opacity 0.2s, transform 0.2s)."),
            r("CSS-PERF-005", Category::Performance, Severity::Warn, "Missing prefers-reduced-motion for Heavy Animations", "Continuous (infinite) or long (> 300ms) animations must respect user vestibular accessibility preferences via prefers-reduced-motion.", "Add @media (prefers-reduced-motion: reduce) { ... } override."),
            r("DS-001", Category::Convention, Severity::Deny, "Direct Tier-1 Primitive Spectral Color Token in UI", "Direct use of primitive spectral color tokens (e.g. --blue-500, --slate-900) in component stylesheets breaks semantic abstraction and theme adaptability.", "Use Tier-2 semantic alias tokens (e.g. --bg-primary, --text-muted, --accent)."),
            r("DS-002", Category::Convention, Severity::Deny, "Local Theme Override in Leaf Stylesheet", "Overriding themes via html[data-theme], body.dark, or @media (prefers-color-scheme) inside leaf component stylesheets fragments centralized theming.", "Declare themes exclusively in global design tokens root files."),
            r("DS-003", Category::Convention, Severity::Deny, "Design Token Role Mismatch", "Applying background tokens (--bg-*, --surface-*) to text color: or text tokens (--text-*, --fg-*) to background: breaks contrast in inverted themes.", "Match token roles with CSS properties (color: var(--text-*), background: var(--bg-*), border: var(--border-*))."),

            // 4. Feature-Sliced Design (FSD) Rules
            r("FSD-001", Category::Architecture, Severity::Deny, "FSD Layer Boundary Violation", "Lower FSD layer cannot import from upper layers.", "Follow FSD hierarchy: app -> pages -> widgets -> features -> entities -> shared."),
            r("FSD-002", Category::Architecture, Severity::Deny, "FSD Public API bypass", "Cross-slice import must strictly go through slice index.ts Public API.", "Export module via index.ts and import from slice root."),
            r("FSD-003", Category::Architecture, Severity::Deny, "UI-Kit package cannot import business stores", "Pure UI kit packages cannot import business stores or application domain state.", "Pass callbacks and props into UI-Kit components from host application."),
            r("FSD-004", Category::Architecture, Severity::Deny, "FSD Cross-slice direct dependency", "Sibling slices at the same level cannot directly depend on each other.", "Compose slices at widgets or pages level."),

            // 5. Performance & Reactive Rules
            r("PERF-001", Category::Performance, Severity::Deny, "Deep reactivity on large data structure / AST", "Wrapping 1000+ AST nodes or large logs in ref()/reactive() causes massive CPU overhead.", "Use shallowRef() + triggerRef(), markRaw(), or Object.freeze()."),
            r("PERF-002", Category::Performance, Severity::Deny, "Deep reactivity on Three.js / Canvas / Monaco instances", "Wrapping Canvas/WebGL/Monaco instances in Vue Proxy causes memory leaks.", "Wrap instance in markRaw(new Instance())."),
            r("PERF-003", Category::Performance, Severity::Deny, "Memory allocation inside requestAnimationFrame render loop", "Allocating objects inside RAF loop triggers GC frame drops.", "Preallocate reusable vectors and buffers outside render loop."),
            r("PERF-004", Category::Performance, Severity::Deny, "Uncached function call in v-for template", "Calling regular methods inside v-for runs on every render frame without dependency caching.", "Precompute mapped data into computed() property."),
            r("PERF-005", Category::Performance, Severity::Deny, "Cascading deep watcher without depth limit", "Using watch(..., { deep: true }) on complex objects causes reactive cascading re-renders.", "Use scalar getters or Vue 3.5+ depth limit { deep: 1 }."),
            r("PERF-006", Category::Performance, Severity::Deny, "Blocking I/O in Drop Implementation", "Calling filesystem, process spawn or thread sleep in Drop can block runtime or cause deadlock.", "Perform asynchronous graceful shutdown explicitly."),
            r("PERF-011", Category::Performance, Severity::Warn, "I/O Operation in Iteration Loop", "Invoking filesystem or network operations in for/while loops causes N+1 performance collapse.", "Batch I/O operations outside the loop."),
            r("PERF-012", Category::Performance, Severity::Warn, "Unbounded Async Channel", "tokio::sync::mpsc::unbounded_channel() without capacity causes out-of-memory under high load.", "Use bounded channel with backpressure."),
            r("PERF-DOM-001", Category::Performance, Severity::Warn, "Layout Thrashing / Forced Synchronous Reflow", "Interleaving DOM geometry reads (offsetHeight, scrollTop) and style writes in loops causes forced reflow.", "Batch DOM reads first, then apply writes using requestAnimationFrame()."),

            // 6. Concurrency Rules
            r("CONC-002", Category::Concurrency, Severity::Deny, "Orphan Background Tokio Task", "tokio::spawn without storing JoinHandle or passing CancellationToken risks task leakage.", "Store JoinHandle or attach CancellationToken."),
            r("CONC-006", Category::Concurrency, Severity::Deny, "Double Lock Deadlock Vector", "Acquiring same Mutex/RwLock twice within single execution scope guarantees deadlock.", "Decompose lock guards into distinct lexical blocks."),
            r("CONC-008", Category::Concurrency, Severity::Deny, "Mutable Static State", "static mut causes undefined behavior and data races.", "Use Atomic types or OnceLock<Mutex<T>>."),

            // 7. Error Handling & Observability Rules
            r("ERR-001", Category::ErrorHandling, Severity::Deny, "Silent Result Dropping via Wildcard Let", "let _ = result; silently suppresses error propagation on fallible operations.", "Handle error explicitly or propagate with ? operator."),
            r("ERR-002", Category::ErrorHandling, Severity::Deny, "Panic or Unwrap in Drop Implementation", "Unwrapping or panicking inside Drop during stack unwinding causes double-panic process abort.", "Log error via tracing::error! without panicking."),
            r("ERR-003", Category::ErrorHandling, Severity::Warn, "Untyped String Error in Public API", "Result<T, String> loses structured error context.", "Define strongly typed enum Error with thiserror."),
            r("ERR-004", Category::ErrorHandling, Severity::Deny, "Result Swallowing via unwrap_or_default / unwrap_or", "Calling .unwrap_or_default() or .unwrap_or() on Result hides database/IO failures as default values.", "Propagate Result with ? or map to domain error."),
            r("ERR-005", Category::ErrorHandling, Severity::Deny, "Panic or Unimplemented in Library Target", "Libraries must not panic or abort host applications.", "Return Result<T, Error> instead of panicking."),
            r("ERR-006", Category::ErrorHandling, Severity::Deny, "Lossy .ok()? on Fallible I/O or Database", "Calling .ok()? on database/IO Result erases the failure reason into None.", "Propagate Result with ? instead of erasing context into Option."),
            r("ERR-007", Category::ErrorHandling, Severity::Deny, "Tauri IPC Command Error Stringification", "Converting domain errors to raw String in Tauri IPC handlers breaks typed client handling.", "Return structured Result<T, IpcError> from commands."),
            r("SDB-009", Category::DataIntegrity, Severity::Deny, "SurrealDB Statement Result Take Without Error Check", "Calling res.take(index).unwrap_or_default() ignores SQL runtime and schema coercion failures.", "Check statement error with res.take(index)? and map to domain error."),
            r("FE-ERR-001", Category::Frontend, Severity::Deny, "Empty Catch Block in Store or Composable", "try { ... } catch { } swallows runtime exceptions without analysis or recovery.", "Log error with context or rethrow."),
            r("FE-ERR-002", Category::Frontend, Severity::Deny, "Silent Mutation Catch Without User Notification", "Catching errors in create/save/delete/update operations without showing Toast/Alert leaves user in the dark.", "Show user notification via addToast or appAlert in catch block."),
            r("FE-ERR-003", Category::Frontend, Severity::Deny, "Raw Project ID String Interpolation", "Directly concatenating projects:${name} with unescaped angle brackets causes SurrealDB record coercion errors.", "Use projectRecordId(name) utility."),
            r("FE-ERR-004", Category::Frontend, Severity::Deny, "Unchecked (e as any) in Catch Block", "Casting caught error to any or Error crashes at runtime if a string or custom object was thrown.", "Use formatErrorMessage(e) or instanceof Error narrowing."),
            r("FE-ERR-007", Category::Frontend, Severity::Deny, "Error Rethrow Without ES2022 Cause", "throw new Error(msg) inside catch block without { cause: e } erases original stack trace.", "Pass { cause: e } into new Error constructor."),
            r("OBS-007", Category::Observability, Severity::Deny, "Sensitive Secret Leakage in Log Macro", "Passing api_key, password or secret into tracing/println log macros.", "Redact sensitive fields with secrecy or #[debug(skip)]."),

            // 8. AI-Agent Defense & Zero-Trust Rules
            r("AI-001", Category::AiDefense, Severity::Deny, "Unauthorized Firewall Configuration Tampering", "Modifying .cerberus/rules.json or suppressions.lock without cryptographic HMAC signature is prohibited.", "Use cargo cerberus ledger sign to record authorized suppressions."),
            r("AI-003", Category::AiDefense, Severity::Deny, "Suspicious Reflection / Environment Probe", "Reading current_exe, /proc or ~/.cargo outside infrastructure layer indicates unauthorized sandbox probe.", "Perform platform probing exclusively within infrastructure adapter."),
            r("AI-008", Category::AiDefense, Severity::Deny, "Unverified Unsafe Block", "unsafe blocks must be preceded by // SAFETY: explanation comment.", "Add // SAFETY: comment proving memory safety invariants."),
            r("AI-009", Category::AiDefense, Severity::Warn, "Undated / Unbounded TODO Stub", "TODO or FIXME without expiration date or issue link causes technical debt accumulation.", "Use format // TODO(YYYY-MM-DD, #issue): description."),
            r("AI-013", Category::AiDefense, Severity::Deny, "Unauthorized Compiler Warning Suppression", "Adding #[allow(dead_code)], #[allow(unused)] or clippy suppressions without ledger signature is prohibited.", "Sign suppression in cerberus ledger or eliminate root cause."),

            // 9. Testability, Type Safety & Domain Rules
            r("TEST-002", Category::Testability, Severity::Deny, "Mutable Global State in Testable Code", "Global mutable locks hinder deterministic parallel testing.", "Inject dependencies and state through struct constructors."),
            r("TEST-003", Category::Testability, Severity::Warn, "Direct Adapter Instantiation in Domain", "Domain creating concrete storage adapter directly violates Dependency Inversion.", "Accept Arc<dyn Port> through constructor."),
            r("TEST-005", Category::Testability, Severity::Deny, "Non-Deterministic System Call in Domain", "Direct calls to SystemTime::now(), Instant::now(), or Uuid::new_v4() inside domain violate deterministic domain purity.", "Inject time/id provider port or pass timestamp as method argument."),
            r("TS-BORROW-001", Category::Architecture, Severity::Deny, "Store State Direct Aliasing Mutation", "Directly mutating store.state.* properties from presentation components bypasses store actions.", "Call typed store actions to modify application state."),
            r("TS-MATCH-001", Category::Robustness, Severity::Deny, "Non-Exhaustive Tagged Union Pattern Match", "Switch on external or multi-variant tagged union lacks exhaustive assertNever default branch.", "Add default: return assertNever(discriminant); to guarantee compile-time exhaustiveness."),

            // 10. Data Integrity Rules
            r("DATA-001", Category::DataIntegrity, Severity::Deny, "Network or Blocking I/O inside Database Transaction", "Performing network calls within open DB transaction causes connection pool starvation.", "Move external I/O outside transaction boundary."),
            r("DATA-005", Category::DataIntegrity, Severity::Deny, "Floating Point Used for Financial / Currency Values", "f32/f64 suffer from binary rounding errors for currency.", "Use integer cents (i64) or rust_decimal::Decimal."),

            // 11. Memory, IPC Leak & Drift Rules
            r("LEAK-001", Category::Robustness, Severity::Deny, "Uncleaned Tauri IPC listener or setInterval timer", "Calling listen() or setInterval() without corresponding cleanup leaks memory.", "Save unlisten handle and clean up symmetrically in onUnmounted()."),
            r("FE-RAII-001", Category::Robustness, Severity::Deny, "Symmetric Lifecycle Cleanup Violation", "Global event listeners, timers or IPC subscriptions are not symmetrically released in onUnmounted().", "Release all allocated handles in onUnmounted()."),
            r("TAURI-DRIFT-001", Category::Architecture, Severity::Warn, "Cross-Language DTO Schema Drift", "Field names, types or serde renaming modifiers in Rust tauri commands mismatch TypeScript client DTOs.", "Sync Rust DTO struct and TypeScript interface fields."),
        ];
        base.extend(crate::bevy_rules::all_bevy_rules());
        base.extend(crate::surql_rules::all_surql_rules());
        base
    }

    pub fn rule_map() -> HashMap<String, RuleDefinition> {
        let mut map = HashMap::new();
        for rule in Self::all_rules() {
            map.insert(rule.id.clone(), rule);
        }
        map
    }

    pub fn alias_map() -> HashMap<String, String> {
        let pairs = [
            ("arch/domain-purity", "ARCH-001"),
            ("arch/app-purity", "ARCH-002"),
            ("arch/ports-isolation", "ARCH-003"),
            ("arch/tauri-isolation", "ARCH-005"),
            ("arch/manifest-hierarchy", "ARCH-020"),
            ("arch/missing-layer", "ARCH-021"),
            ("arch/zone-of-pain", "ARCH-013"),
            ("arch/god-object-blast-radius", "ARCH-040"),
            ("code/max-pressure", "ARCH-030"),
            ("code/max-sloc", "ARCH-031"),
            ("code/max-functions", "ARCH-032"),
            ("async/no-sync-mutex-in-await", "ASYNC-001"),
            ("async/no-zombie-spawn", "ASYNC-002"),
            ("robustness/no-raw-unwrap-panic", "ROB-001"),
            ("sec/taint-sink-execution", "SEC-001"),
            ("sec/transitive-capabilities", "SEC-002"),
            ("sec/command-injection", "SEC-003"),
            ("sec/timing-attack", "SEC-008"),
            ("sec/hardcoded-secrets", "SEC-009"),
            ("quality/ai-slop-detector", "SLOP-001"),
            ("vue/no-monolith-script-setup", "VUE-001"),
            ("vue/require-companion-hook", "VUE-002"),
            ("vue/no-types-in-sfc", "VUE-003"),
            ("vue/no-destructure", "VUE-007"),
            ("vue/no-prop-mutation", "VUE-008"),
            ("vue/no-template-methods", "VUE-009"),
            ("tauri/no-direct-ipc", "TAURI-002"),
            ("css/no-hardcoded-colors", "CSS-001"),
            ("css/require-design-tokens", "CSS-002"),
            ("css/max-style-lines", "CSS-004"),
            ("css/no-raw-colors-in-ts", "CSS-005"),
            ("css/no-important", "CSS-006"),
            ("css/no-will-change-overuse", "CSS-PERF-001"),
            ("css/blur-budget-exceeded", "CSS-PERF-002"),
            ("css/compositor-only-animations", "CSS-PERF-003"),
            ("css/no-transition-all", "CSS-PERF-004"),
            ("css/require-reduced-motion", "CSS-PERF-005"),
            ("ds/no-primitive-spectral-tokens", "DS-001"),
            ("ds/no-local-theme-overrides", "DS-002"),
            ("ds/token-role-mismatch", "DS-003"),
            ("fsd/layer-imports-hierarchy", "FSD-001"),
            ("fsd/public-api-only", "FSD-002"),
            ("fsd/ui-kit-zero-domain", "FSD-003"),
            ("fsd/no-cross-slice-imports", "FSD-004"),
            ("perf/shallow-ref-for-heavy-ast", "PERF-001"),
            ("perf/no-reactive-canvas-three", "PERF-002"),
            ("perf/no-allocations-in-raf", "PERF-003"),
            ("perf/no-template-methods-in-loops", "PERF-004"),
            ("perf/no-deep-watch-cascades", "PERF-005"),
            ("perf/no-blocking-in-drop", "PERF-006"),
            ("perf/no-io-in-loops", "PERF-011"),
            ("perf/no-unbounded-channels", "PERF-012"),
            ("perf/layout-thrashing", "PERF-DOM-001"),
            ("conc/no-orphan-spawn", "CONC-002"),
            ("conc/no-double-lock", "CONC-006"),
            ("conc/no-static-mut", "CONC-008"),
            ("err/no-silent-result-drop", "ERR-001"),
            ("err/no-panic-in-drop", "ERR-002"),
            ("err/no-string-error-in-pub-api", "ERR-003"),
            ("err/no-panic-in-library", "ERR-005"),
            ("obs/no-secret-in-logs", "OBS-007"),
            ("ai/no-unauthorized-config", "AI-001"),
            ("ai/no-reflection-probe", "AI-003"),
            ("ai/require-safety-comment", "AI-008"),
            ("ai/no-undated-todo", "AI-009"),
            ("ai/no-unauthorized-allow", "AI-013"),
            ("test/no-mutable-global-state", "TEST-002"),
            ("test/no-direct-adapter-instantiation", "TEST-003"),
            ("test/deterministic-domain", "TEST-005"),
            ("ts/store-aliasing", "TS-BORROW-001"),
            ("ts/exhaustive-match", "TS-MATCH-001"),
            ("data/no-io-in-transactions", "DATA-001"),
            ("data/no-float-money", "DATA-005"),
            ("leak/uncleaned-ipc-listener", "LEAK-001"),
            ("fe/raii-cleanup", "FE-RAII-001"),
            ("tauri/dto-drift", "TAURI-DRIFT-001"),
            ("err/no-silent-wildcard-let", "ERR-001"),
            ("err/no-drop-panic", "ERR-002"),
            ("err/no-untyped-string-err", "ERR-003"),
            ("err/no-result-swallow", "ERR-004"),
            ("err/no-lib-panic", "ERR-005"),
            ("err/no-lossy-ok", "ERR-006"),
            ("err/typed-ipc-error", "ERR-007"),
            ("sdb/explicit-take-check", "SDB-009"),
            ("fe/no-empty-catch", "FE-ERR-001"),
            ("fe/mutation-toast-required", "FE-ERR-002"),
            ("fe/project-record-id", "FE-ERR-003"),
            ("fe/no-catch-as-any", "FE-ERR-004"),
            ("fe/rethrow-with-cause", "FE-ERR-007"),
        ];

        let mut map = HashMap::new();
        for (k, v) in pairs {
            map.insert(k.to_string(), v.to_string());
        }
        for (k, v) in crate::bevy_rules::bevy_alias_pairs() {
            map.insert(k.to_string(), v.to_string());
        }
        map
    }

    pub fn canonical_rule_id(key: &str) -> String {
        let aliases = Self::alias_map();
        if let Some(canonical) = aliases.get(key) {
            canonical.clone()
        } else {
            key.to_string()
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_builtin_rule_registry_consistency() {
        let rules = BuiltinRuleRegistry::all_rules();
        assert!(!rules.is_empty());

        let map = BuiltinRuleRegistry::rule_map();
        for rule in &rules {
            assert!(map.contains_key(&rule.id));
        }

        assert_eq!(
            BuiltinRuleRegistry::canonical_rule_id("arch/domain-purity"),
            "ARCH-001"
        );
        assert_eq!(
            BuiltinRuleRegistry::canonical_rule_id("vue/no-monolith-script-setup"),
            "VUE-001"
        );
        assert_eq!(
            BuiltinRuleRegistry::canonical_rule_id("ARCH-001"),
            "ARCH-001"
        );
    }
}
