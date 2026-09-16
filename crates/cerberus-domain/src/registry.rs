use crate::rules::{Category, RuleDefinition, Severity};
use std::collections::HashMap;

pub struct BuiltinRuleRegistry;

impl BuiltinRuleRegistry {
    pub fn all_rules() -> Vec<RuleDefinition> {
        vec![
            // 1. Rust & Hexagonal Backend Rules
            RuleDefinition {
                id: "ARCH-001".into(),
                version: "1.0".into(),
                category: Category::Architecture,
                severity: Severity::Deny,
                title: "Domain crate cannot import external frameworks".into(),
                description: "worldwiki-domain must remain pure without dependencies on tauri, tokio, surrealdb, or reqwest.".into(),
                remediation: "Move infrastructure dependencies to ports and adapter traits in infrastructure.".into(),
            },
            RuleDefinition {
                id: "ARCH-002".into(),
                version: "1.0".into(),
                category: Category::Architecture,
                severity: Severity::Deny,
                title: "Application layer cannot import Tauri".into(),
                description: "worldwiki-application use cases must not depend on tauri::* types.".into(),
                remediation: "Pass UI parameters as clean DTOs into use case methods.".into(),
            },
            RuleDefinition {
                id: "ARCH-003".into(),
                version: "1.0".into(),
                category: Category::Architecture,
                severity: Severity::Deny,
                title: "Ports layer cannot depend on infrastructure SDKs".into(),
                description: "Ports layer defines pure traits and interfaces only.".into(),
                remediation: "Move concrete client SDKs to infrastructure adapters.".into(),
            },
            RuleDefinition {
                id: "ARCH-005".into(),
                version: "1.0".into(),
                category: Category::Architecture,
                severity: Severity::Deny,
                title: "Only adapters/tauri crate is authorized to import Tauri".into(),
                description: "Tauri IPC commands and dependencies are strictly isolated to adapter layer.".into(),
                remediation: "Move Tauri IPC commands and dependencies to worldwiki-tauri (adapters/tauri).".into(),
            },
            RuleDefinition {
                id: "ARCH-020".into(),
                version: "1.0".into(),
                category: Category::Architecture,
                severity: Severity::Deny,
                title: "Layer Dependency Hierarchy Violation in Cargo.toml".into(),
                description: "Crate dependencies in Cargo.toml must strictly comply with the allowed dependency matrix.".into(),
                remediation: "Invert dependency direction: pure domain/ports layers cannot depend on outer layers.".into(),
            },
            RuleDefinition {
                id: "ARCH-013".into(),
                version: "1.0".into(),
                category: Category::Architecture,
                severity: Severity::Warn,
                title: "Package entered Zone of Pain (High Coupling with Zero Abstraction)".into(),
                description: "Package has high afferent coupling (Ca > 3) with low instability (I < 0.2) and low abstractness (A < 0.2), making changes extremely rigid.".into(),
                remediation: "Introduce abstract traits and interfaces to reduce direct coupling to concrete types.".into(),
            },
            RuleDefinition {
                id: "ARCH-021".into(),
                version: "1.0".into(),
                category: Category::Architecture,
                severity: Severity::Warn,
                title: "Missing Architectural Layer Metadata".into(),
                description: "Every workspace crate should explicitly declare [package.metadata.cerberus] layer = \"...\" in Cargo.toml.".into(),
                remediation: "Add [package.metadata.cerberus] layer = \"domain|ports|application|infrastructure|adapter\" to Cargo.toml.".into(),
            },
            RuleDefinition {
                id: "ARCH-030".into(),
                version: "1.0".into(),
                category: Category::Architecture,
                severity: Severity::Warn,
                title: "High Architectural Pressure Score (S_arch)".into(),
                description: "File exceeds configured multi-dimensional Architectural Pressure threshold (SLOC + Functions + Cyclomatic + Dependencies + AST Depth + Distance).".into(),
                remediation: "Decompose module into smaller single-responsibility components and pure domain models.".into(),
            },
            RuleDefinition {
                id: "ARCH-031".into(),
                version: "1.0".into(),
                category: Category::Architecture,
                severity: Severity::Deny,
                title: "Source Lines of Code (SLOC) limit exceeded".into(),
                description: "File SLOC exceeds layer threshold (ignoring comments, empty lines, and unit tests).".into(),
                remediation: "Extract helper functions and logic into cohesive submodules.".into(),
            },
            RuleDefinition {
                id: "ARCH-040".into(),
                version: "1.0".into(),
                category: Category::Architecture,
                severity: Severity::Warn,
                title: "God Object with Critical Architectural Blast Radius (Fan-In > 80%)".into(),
                description: "Module is directly imported by excessive number of components, making any change propagate system-wide failure risks.".into(),
                remediation: "Split God Object into cohesive domain interfaces and domain event contracts.".into(),
            },
            RuleDefinition {
                id: "ASYNC-001".into(),
                version: "1.0".into(),
                category: Category::Robustness,
                severity: Severity::Deny,
                title: "Holding std::sync::MutexGuard across .await point".into(),
                description: "Holding std::sync::MutexGuard across .await point causes Tokio worker starvation and deadlocks.".into(),
                remediation: "Use tokio::sync::Mutex or explicitly drop the guard before .await.".into(),
            },
            RuleDefinition {
                id: "ASYNC-002".into(),
                version: "1.0".into(),
                category: Category::Robustness,
                severity: Severity::Warn,
                title: "Zombie Background Task or Blocking Sleep in Async Context".into(),
                description: "tokio::spawn without JoinHandle/CancellationToken or std::thread::sleep in async function blocks runtime.".into(),
                remediation: "Store JoinHandle, pass CancellationToken, or use tokio::time::sleep().".into(),
            },
            RuleDefinition {
                id: "ROB-001".into(),
                version: "1.0".into(),
                category: Category::Robustness,
                severity: Severity::Warn,
                title: "High Panic Collapse Vector (.unwrap / .expect / raw indexing)".into(),
                description: "Module execution paths can panic at runtime due to unwrap(), expect(), or unchecked slice indexing.".into(),
                remediation: "Replace .unwrap() with ? error propagation and vec[i] with .get(i).".into(),
            },
            RuleDefinition {
                id: "SEC-001".into(),
                version: "1.0".into(),
                category: Category::Security,
                severity: Severity::Deny,
                title: "Taint-to-Sink Command Execution Vulnerability".into(),
                description: "Unsanitized user input reaches system command execution sink.".into(),
                remediation: "Sanitize path via validate_safe_path() or annotate function with #[cerberus(sanitizes)].".into(),
            },
            RuleDefinition {
                id: "SEC-002".into(),
                version: "1.0".into(),
                category: Category::Security,
                severity: Severity::Warn,
                title: "Transitive Capability Leakage in Pure Layer".into(),
                description: "Pure domain or ports layer pulls transitive dependencies with network sockets or OS process execution capabilities.".into(),
                remediation: "Remove bloated transitive dependencies from pure layer Cargo.toml.".into(),
            },
            RuleDefinition {
                id: "SLOP-001".into(),
                version: "1.0".into(),
                category: Category::Convention,
                severity: Severity::Warn,
                title: "AI-Slop and Indirection Tax Detected".into(),
                description: "Excessive .clone() density, mutable state in global lazy_static/RwLock, or unnecessary thread wrappers detected.".into(),
                remediation: "Fix lifetimes instead of defensive cloning; avoid global mutable locks.".into(),
            },

            // 2. Vue SFC & Component Anatomy Rules
            RuleDefinition {
                id: "VUE-001".into(),
                version: "1.0".into(),
                category: Category::Convention,
                severity: Severity::Deny,
                title: "Heavy business logic in <script setup>".into(),
                description: "<script setup> block exceeds 30 lines of glue code. Logic must be decomposed into companion hook.".into(),
                remediation: "Extract state, computed, and methods into use<Component>.ts hook.".into(),
            },
            RuleDefinition {
                id: "VUE-002".into(),
                version: "1.0".into(),
                category: Category::Convention,
                severity: Severity::Deny,
                title: "Missing companion use<Component>.ts hook".into(),
                description: "Non-trivial Vue component must have a companion use<Component>.ts hook.".into(),
                remediation: "Create use<Component>.ts alongside <Component>.vue.".into(),
            },
            RuleDefinition {
                id: "VUE-003".into(),
                version: "1.0".into(),
                category: Category::Convention,
                severity: Severity::Deny,
                title: "Declaring types inside .vue file is forbidden".into(),
                description: "Interface Props, Emits, and DTO declarations must be placed in .model.ts or .types.ts.".into(),
                remediation: "Move interfaces and types to <Component>.model.ts.".into(),
            },

            // 3. CSS & Design Tokens Rules
            RuleDefinition {
                id: "CSS-001".into(),
                version: "1.0".into(),
                category: Category::Convention,
                severity: Severity::Deny,
                title: "Hardcoded Hex/RGB/HSL color in CSS".into(),
                description: "Direct Hex/RGB/HSL and named HTML colors are prohibited. Design system tokens must be used.".into(),
                remediation: "Replace hardcoded color with var(--color-*) design token.".into(),
            },
            RuleDefinition {
                id: "CSS-002".into(),
                version: "1.0".into(),
                category: Category::Convention,
                severity: Severity::Deny,
                title: "Missing design tokens for border-radius/transitions".into(),
                description: "Hardcoded border-radius (8px, 4px) and transition durations violate design token standard.".into(),
                remediation: "Use var(--border-radius-*) and var(--transition-*).".into(),
            },
            RuleDefinition {
                id: "CSS-004".into(),
                version: "1.0".into(),
                category: Category::Convention,
                severity: Severity::Deny,
                title: "CSS bloat in <style> block".into(),
                description: "Scoped <style> block exceeds 70 lines. Style sheets must be decomposed with atomic subcomponents.".into(),
                remediation: "Decompose template and styles into smaller subcomponents.".into(),
            },

            // 4. Feature-Sliced Design (FSD) Rules
            RuleDefinition {
                id: "FSD-001".into(),
                version: "1.0".into(),
                category: Category::Architecture,
                severity: Severity::Deny,
                title: "FSD Layer Boundary Violation".into(),
                description: "Lower FSD layer cannot import from upper layers (e.g. entities cannot import features/pages).".into(),
                remediation: "Follow FSD hierarchy: app -> pages -> widgets -> features -> entities -> shared.".into(),
            },
            RuleDefinition {
                id: "FSD-002".into(),
                version: "1.0".into(),
                category: Category::Architecture,
                severity: Severity::Deny,
                title: "FSD Public API bypass".into(),
                description: "Cross-slice import must strictly go through slice index.ts Public API.".into(),
                remediation: "Export module via index.ts and import from slice root.".into(),
            },
            RuleDefinition {
                id: "FSD-003".into(),
                version: "1.0".into(),
                category: Category::Architecture,
                severity: Severity::Deny,
                title: "UI-Kit package cannot import business stores".into(),
                description: "@worldwiki/components UI kit must remain pure and cannot import business stores/Pinia.".into(),
                remediation: "Pass callbacks and props into UI-Kit components from host application.".into(),
            },
            RuleDefinition {
                id: "FSD-004".into(),
                version: "1.0".into(),
                category: Category::Architecture,
                severity: Severity::Deny,
                title: "FSD Cross-slice direct dependency".into(),
                description: "Sibling slices at the same level cannot directly depend on each other.".into(),
                remediation: "Compose slices at widgets or pages level.".into(),
            },

            // 5. High-Performance & Reactive Integrity (Rule 08) Rules
            RuleDefinition {
                id: "PERF-001".into(),
                version: "1.0".into(),
                category: Category::Performance,
                severity: Severity::Deny,
                title: "Deep reactivity on large data structure / AST".into(),
                description: "Wrapping 1000+ AST nodes or large logs in ref()/reactive() causes massive CPU overhead.".into(),
                remediation: "Use shallowRef() + triggerRef(), markRaw(), or Object.freeze().".into(),
            },
            RuleDefinition {
                id: "PERF-002".into(),
                version: "1.0".into(),
                category: Category::Performance,
                severity: Severity::Deny,
                title: "Deep reactivity on Three.js / Canvas / Monaco instances".into(),
                description: "Wrapping Canvas/WebGL/Monaco instances in Vue Proxy causes memory leaks and performance drop.".into(),
                remediation: "Wrap instance in markRaw(new Instance()).".into(),
            },
            RuleDefinition {
                id: "PERF-003".into(),
                version: "1.0".into(),
                category: Category::Performance,
                severity: Severity::Deny,
                title: "Memory allocation inside requestAnimationFrame render loop".into(),
                description: "Allocating objects (new Object, map, filter) inside RAF loop triggers GC frame drops.".into(),
                remediation: "Preallocate reusable vectors and buffers outside render loop.".into(),
            },
            RuleDefinition {
                id: "PERF-004".into(),
                version: "1.0".into(),
                category: Category::Performance,
                severity: Severity::Deny,
                title: "Uncached function call in v-for template".into(),
                description: "Calling regular methods inside v-for runs on every render frame without dependency caching.".into(),
                remediation: "Precompute mapped data into computed() property.".into(),
            },
            RuleDefinition {
                id: "PERF-005".into(),
                version: "1.0".into(),
                category: Category::Performance,
                severity: Severity::Deny,
                title: "Cascading deep watcher without depth limit".into(),
                description: "Using watch(..., { deep: true }) on complex objects causes reactive cascading re-renders.".into(),
                remediation: "Use scalar getters or Vue 3.5+ depth limit { deep: 1 }.".into(),
            },

            // 6. Memory & IPC Leak Rules
            RuleDefinition {
                id: "LEAK-001".into(),
                version: "1.0".into(),
                category: Category::Robustness,
                severity: Severity::Deny,
                title: "Uncleaned Tauri IPC listener or setInterval timer".into(),
                description: "Calling listen() or setInterval() without corresponding unlisten/clearInterval in onUnmounted leaks memory.".into(),
                remediation: "Save unlisten handle and clean up symmetrically in onUnmounted().".into(),
            },
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
        let mut map = HashMap::new();
        map.insert("arch/domain-purity".into(), "ARCH-001".into());
        map.insert("arch/app-purity".into(), "ARCH-002".into());
        map.insert("arch/ports-isolation".into(), "ARCH-003".into());
        map.insert("arch/tauri-isolation".into(), "ARCH-005".into());
        map.insert("arch/manifest-hierarchy".into(), "ARCH-020".into());
        map.insert("arch/missing-layer".into(), "ARCH-021".into());
        map.insert("arch/zone-of-pain".into(), "ARCH-013".into());
        map.insert("arch/god-object-blast-radius".into(), "ARCH-040".into());
        map.insert("code/max-pressure".into(), "ARCH-030".into());
        map.insert("code/max-sloc".into(), "ARCH-031".into());
        map.insert("async/no-sync-mutex-in-await".into(), "ASYNC-001".into());
        map.insert("async/no-zombie-spawn".into(), "ASYNC-002".into());
        map.insert("robustness/no-raw-unwrap-panic".into(), "ROB-001".into());
        map.insert("sec/taint-sink-execution".into(), "SEC-001".into());
        map.insert("sec/transitive-capabilities".into(), "SEC-002".into());
        map.insert("quality/ai-slop-detector".into(), "SLOP-001".into());
        map.insert("vue/no-monolith-script-setup".into(), "VUE-001".into());
        map.insert("vue/require-companion-hook".into(), "VUE-002".into());
        map.insert("vue/no-types-in-sfc".into(), "VUE-003".into());
        map.insert("css/no-hardcoded-colors".into(), "CSS-001".into());
        map.insert("css/require-design-tokens".into(), "CSS-002".into());
        map.insert("css/max-style-lines".into(), "CSS-004".into());
        map.insert("fsd/layer-imports-hierarchy".into(), "FSD-001".into());
        map.insert("fsd/public-api-only".into(), "FSD-002".into());
        map.insert("fsd/ui-kit-zero-domain".into(), "FSD-003".into());
        map.insert("fsd/no-cross-slice-imports".into(), "FSD-004".into());
        map.insert("perf/shallow-ref-for-heavy-ast".into(), "PERF-001".into());
        map.insert("perf/no-reactive-canvas-three".into(), "PERF-002".into());
        map.insert("perf/no-allocations-in-raf".into(), "PERF-003".into());
        map.insert("perf/no-template-methods-in-loops".into(), "PERF-004".into());
        map.insert("perf/no-deep-watch-cascades".into(), "PERF-005".into());
        map.insert("leak/uncleaned-ipc-listener".into(), "LEAK-001".into());
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
