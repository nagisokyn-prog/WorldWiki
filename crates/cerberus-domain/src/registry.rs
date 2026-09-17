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
        vec![
            // 1. Rust & Hexagonal Backend Rules
            r("ARCH-001", Category::Architecture, Severity::Deny, "Domain crate cannot import external frameworks", "worldwiki-domain must remain pure without dependencies on tauri, tokio, surrealdb, or reqwest.", "Move infrastructure dependencies to ports and adapter traits in infrastructure."),
            r("ARCH-002", Category::Architecture, Severity::Deny, "Application layer cannot import Tauri", "worldwiki-application use cases must not depend on tauri::* types.", "Pass UI parameters as clean DTOs into use case methods."),
            r("ARCH-003", Category::Architecture, Severity::Deny, "Ports layer cannot depend on infrastructure SDKs", "Ports layer defines pure traits and interfaces only.", "Move concrete client SDKs to infrastructure adapters."),
            r("ARCH-005", Category::Architecture, Severity::Deny, "Only adapters/tauri crate is authorized to import Tauri", "Tauri IPC commands and dependencies are strictly isolated to adapter layer.", "Move Tauri IPC commands and dependencies to worldwiki-tauri (adapters/tauri)."),
            r("ARCH-020", Category::Architecture, Severity::Deny, "Layer Dependency Hierarchy Violation in Cargo.toml", "Crate dependencies in Cargo.toml must strictly comply with the allowed dependency matrix.", "Invert dependency direction: pure domain/ports layers cannot depend on outer layers."),
            r("ARCH-013", Category::Architecture, Severity::Warn, "Package entered Zone of Pain (High Coupling with Zero Abstraction)", "Package has high afferent coupling (Ca > 3) with low instability (I < 0.2) and low abstractness (A < 0.2).", "Introduce abstract traits and interfaces to reduce direct coupling to concrete types."),
            r("ARCH-021", Category::Architecture, Severity::Warn, "Missing Architectural Layer Metadata", "Every workspace crate should explicitly declare [package.metadata.cerberus] layer = \"...\" in Cargo.toml.", "Add [package.metadata.cerberus] layer = \"domain|ports|application|infrastructure|adapter\" to Cargo.toml."),
            r("ARCH-030", Category::Architecture, Severity::Warn, "High Architectural Pressure Score (S_arch)", "File exceeds configured multi-dimensional Architectural Pressure threshold.", "Decompose module into smaller single-responsibility components and pure domain models."),
            r("ARCH-031", Category::Architecture, Severity::Deny, "Source Lines of Code (SLOC) limit exceeded", "File SLOC exceeds layer threshold.", "Extract helper functions and logic into cohesive submodules."),
            r("ARCH-040", Category::Architecture, Severity::Warn, "God Object with Critical Architectural Blast Radius (Fan-In > 80%)", "Module is directly imported by excessive number of components.", "Split God Object into cohesive domain interfaces and domain event contracts."),
            r("ASYNC-001", Category::Robustness, Severity::Deny, "Holding std::sync::MutexGuard across .await point", "Holding std::sync::MutexGuard across .await point causes Tokio worker starvation and deadlocks.", "Use tokio::sync::Mutex or explicitly drop the guard before .await."),
            r("ASYNC-002", Category::Robustness, Severity::Warn, "Zombie Background Task or Blocking Sleep in Async Context", "tokio::spawn without JoinHandle/CancellationToken or std::thread::sleep in async function blocks runtime.", "Store JoinHandle, pass CancellationToken, or use tokio::time::sleep()."),
            r("ROB-001", Category::Robustness, Severity::Warn, "High Panic Collapse Vector (.unwrap / .expect / raw indexing)", "Module execution paths can panic at runtime due to unwrap(), expect(), or unchecked slice indexing.", "Replace .unwrap() with ? error propagation and vec[i] with .get(i)."),
            r("SEC-001", Category::Security, Severity::Deny, "Taint-to-Sink Command Execution Vulnerability", "Unsanitized user input reaches system command execution sink.", "Sanitize path via validate_safe_path() or annotate function with #[cerberus(sanitizes)]."),
            r("SEC-002", Category::Security, Severity::Warn, "Transitive Capability Leakage in Pure Layer", "Pure domain or ports layer pulls transitive dependencies with network sockets or OS process execution capabilities.", "Remove bloated transitive dependencies from pure layer Cargo.toml."),
            r("SLOP-001", Category::Convention, Severity::Warn, "AI-Slop and Indirection Tax Detected", "Excessive .clone() density, mutable state in global lazy_static/RwLock, or unnecessary thread wrappers detected.", "Fix lifetimes instead of defensive cloning; avoid global mutable locks."),

            // 2. Vue SFC & Component Anatomy Rules
            r("VUE-001", Category::Convention, Severity::Deny, "Heavy business logic in <script setup>", "<script setup> block exceeds 30 lines of glue code. Logic must be decomposed into companion hook.", "Extract state, computed, and methods into use<Component>.ts hook."),
            r("VUE-002", Category::Convention, Severity::Deny, "Missing companion use<Component>.ts hook", "Non-trivial Vue component must have a companion use<Component>.ts hook.", "Create use<Component>.ts alongside <Component>.vue."),
            r("VUE-003", Category::Convention, Severity::Deny, "Declaring types inside .vue file is forbidden", "Interface Props, Emits, and DTO declarations must be placed in .model.ts or .types.ts.", "Move interfaces and types to <Component>.model.ts."),

            // 3. CSS & Design Tokens Rules
            r("CSS-001", Category::Convention, Severity::Deny, "Hardcoded Hex/RGB/HSL color in CSS", "Direct Hex/RGB/HSL and named HTML colors are prohibited. Design system tokens must be used.", "Replace hardcoded color with var(--color-*) design token."),
            r("CSS-002", Category::Convention, Severity::Deny, "Missing design tokens for border-radius/transitions", "Hardcoded border-radius (8px, 4px) and transition durations violate design token standard.", "Use var(--border-radius-*) and var(--transition-*)."),
            r("CSS-004", Category::Convention, Severity::Deny, "CSS bloat in <style> block", "Scoped <style> block exceeds 70 lines. Style sheets must be decomposed with atomic subcomponents.", "Decompose template and styles into smaller subcomponents."),

            // 4. Feature-Sliced Design (FSD) Rules
            r("FSD-001", Category::Architecture, Severity::Deny, "FSD Layer Boundary Violation", "Lower FSD layer cannot import from upper layers.", "Follow FSD hierarchy: app -> pages -> widgets -> features -> entities -> shared."),
            r("FSD-002", Category::Architecture, Severity::Deny, "FSD Public API bypass", "Cross-slice import must strictly go through slice index.ts Public API.", "Export module via index.ts and import from slice root."),
            r("FSD-003", Category::Architecture, Severity::Deny, "UI-Kit package cannot import business stores", "@worldwiki/components UI kit must remain pure and cannot import business stores/Pinia.", "Pass callbacks and props into UI-Kit components from host application."),
            r("FSD-004", Category::Architecture, Severity::Deny, "FSD Cross-slice direct dependency", "Sibling slices at the same level cannot directly depend on each other.", "Compose slices at widgets or pages level."),

            // 5. High-Performance & Reactive Integrity (Rule 08) Rules
            r("PERF-001", Category::Performance, Severity::Deny, "Deep reactivity on large data structure / AST", "Wrapping 1000+ AST nodes or large logs in ref()/reactive() causes massive CPU overhead.", "Use shallowRef() + triggerRef(), markRaw(), or Object.freeze()."),
            r("PERF-002", Category::Performance, Severity::Deny, "Deep reactivity on Three.js / Canvas / Monaco instances", "Wrapping Canvas/WebGL/Monaco instances in Vue Proxy causes memory leaks.", "Wrap instance in markRaw(new Instance())."),
            r("PERF-003", Category::Performance, Severity::Deny, "Memory allocation inside requestAnimationFrame render loop", "Allocating objects inside RAF loop triggers GC frame drops.", "Preallocate reusable vectors and buffers outside render loop."),
            r("PERF-004", Category::Performance, Severity::Deny, "Uncached function call in v-for template", "Calling regular methods inside v-for runs on every render frame without dependency caching.", "Precompute mapped data into computed() property."),
            r("PERF-005", Category::Performance, Severity::Deny, "Cascading deep watcher without depth limit", "Using watch(..., { deep: true }) on complex objects causes reactive cascading re-renders.", "Use scalar getters or Vue 3.5+ depth limit { deep: 1 }."),

            // 6. Memory & IPC Leak Rules
            r("LEAK-001", Category::Robustness, Severity::Deny, "Uncleaned Tauri IPC listener or setInterval timer", "Calling listen() or setInterval() without corresponding cleanup leaks memory.", "Save unlisten handle and clean up symmetrically in onUnmounted()."),
        ]
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
            ("async/no-sync-mutex-in-await", "ASYNC-001"),
            ("async/no-zombie-spawn", "ASYNC-002"),
            ("robustness/no-raw-unwrap-panic", "ROB-001"),
            ("sec/taint-sink-execution", "SEC-001"),
            ("sec/transitive-capabilities", "SEC-002"),
            ("quality/ai-slop-detector", "SLOP-001"),
            ("vue/no-monolith-script-setup", "VUE-001"),
            ("vue/require-companion-hook", "VUE-002"),
            ("vue/no-types-in-sfc", "VUE-003"),
            ("css/no-hardcoded-colors", "CSS-001"),
            ("css/require-design-tokens", "CSS-002"),
            ("css/max-style-lines", "CSS-004"),
            ("fsd/layer-imports-hierarchy", "FSD-001"),
            ("fsd/public-api-only", "FSD-002"),
            ("fsd/ui-kit-zero-domain", "FSD-003"),
            ("fsd/no-cross-slice-imports", "FSD-004"),
            ("perf/shallow-ref-for-heavy-ast", "PERF-001"),
            ("perf/no-reactive-canvas-three", "PERF-002"),
            ("perf/no-allocations-in-raf", "PERF-003"),
            ("perf/no-template-methods-in-loops", "PERF-004"),
            ("perf/no-deep-watch-cascades", "PERF-005"),
            ("leak/uncleaned-ipc-listener", "LEAK-001"),
        ];

        let mut map = HashMap::new();
        for (k, v) in pairs {
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
