use crate::{Category, Severity};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct RuleDocEntry {
    pub id: String,
    pub name: String,
    pub category: Category,
    pub default_severity: Severity,
    pub summary: String,
    pub rationale: String,
    pub bad_example: String,
    pub good_example: String,
    pub remediation_recipe: String,
    pub configuration_hint: String,
}

pub struct RuleCatalog;

impl RuleCatalog {
    pub fn all() -> Vec<RuleDocEntry> {
        let bespoke = vec![
            RuleDocEntry {
                id: "ARCH-001".to_string(),
                name: "Domain Layer Zero-SDK Invariant".to_string(),
                category: Category::Architecture,
                default_severity: Severity::Deny,
                summary: "Domain layer must have zero external SDK/IO dependencies.".to_string(),
                rationale: "The pure domain core (entities, business logic) must remain 100% decoupled from transport, databases, and frameworks (tokio, reqwest, tauri, sqlx) to ensure instant, deterministic testing and portability.".to_string(),
                bad_example: "// In crates/worldwiki-domain/src/user.rs\nuse reqwest::Client;\npub async fn fetch(id: &str) { Client::new().get(...).send().await; }".to_string(),
                good_example: "// In crates/worldwiki-ports/src/user_client.rs\npub trait UserClientPort: Send + Sync {\n    async fn fetch(&self, id: &str) -> Result<UserDto, PortError>;\n}".to_string(),
                remediation_recipe: "1. Define an abstract trait in 'worldwiki-ports'.\n2. Implement the trait with reqwest/sqlx in 'worldwiki-infrastructure'.\n3. Keep domain entities completely pure.".to_string(),
                configuration_hint: "\"layers\": { \"domain\": { \"forbidden_external\": [\"reqwest\", \"tokio\", \"tauri\"] } }".to_string(),
            },
            RuleDocEntry {
                id: "ARCH-002".to_string(),
                name: "Application Layer Framework Decoupling".to_string(),
                category: Category::Architecture,
                default_severity: Severity::Deny,
                summary: "Application use cases must not directly import UI framework (Tauri).".to_string(),
                rationale: "Use cases coordinate domain and ports through plain DTOs. Direct coupling to Tauri IPC types breaks portability and blocks automated headless integration testing.".to_string(),
                bad_example: "// In crates/worldwiki-application/src/create_doc.rs\nuse tauri::command;\n#[tauri::command]\npub fn create_doc() { ... }".to_string(),
                good_example: "// In crates/worldwiki-application/src/create_doc.rs\npub struct CreateDocUseCase<R: DocRepositoryPort> { repo: R }\nimpl<R: DocRepositoryPort> CreateDocUseCase<R> {\n    pub async fn execute(&self, cmd: CreateDocCommand) -> Result<DocId, AppError> { ... }\n}".to_string(),
                remediation_recipe: "Move #[tauri::command] handlers to 'adapters/tauri/commands.rs' and call clean application use cases with plain DTOs.".to_string(),
                configuration_hint: "\"layers\": { \"application\": { \"forbidden_external\": [\"tauri\"] } }".to_string(),
            },
            RuleDocEntry {
                id: "ARCH-005".to_string(),
                name: "Unauthorized Framework Exposure".to_string(),
                category: Category::Architecture,
                default_severity: Severity::Deny,
                summary: "Only dedicated adapter crates may import UI framework binaries.".to_string(),
                rationale: "Isolating Tauri to 'worldwiki-tauri' ensures all other crates remain pure, reusable Rust libraries.".to_string(),
                bad_example: "// In crates/worldwiki-infrastructure/src/repo.rs\nuse tauri::AppHandle;".to_string(),
                good_example: "// In crates/worldwiki-tauri/src/main.rs\nuse tauri::AppHandle;".to_string(),
                remediation_recipe: "Move Tauri state managers and AppHandle parameters to 'crates/worldwiki-tauri'.".to_string(),
                configuration_hint: "\"layers\": { \"adapters_tauri\": { \"allowed_external\": [\"tauri\"] } }".to_string(),
            },
            RuleDocEntry {
                id: "ARCH-007".to_string(),
                name: "Layer Topology Inversion".to_string(),
                category: Category::Architecture,
                default_severity: Severity::Deny,
                summary: "Lower layer cannot import from higher layers in the architectural matrix.".to_string(),
                rationale: "Strict topological ordering prevents cyclic dependency spaghetti and unmaintainable coupling.".to_string(),
                bad_example: "// In Controller layer\nuse crate::repository::UserRepository; // Bypassing Service layer".to_string(),
                good_example: "// In Controller layer\nuse crate::service::UserService;\n// In Service layer\nuse crate::repository::UserRepository;".to_string(),
                remediation_recipe: "Follow allowed_deps hierarchy defined in workspace matrix.".to_string(),
                configuration_hint: "\"layers\": { \"controller\": { \"allowed_deps\": [\"service\", \"entity\"] } }".to_string(),
            },
            RuleDocEntry {
                id: "MOD-001".to_string(),
                name: "Module Boundary & Encapsulation Violation".to_string(),
                category: Category::Architecture,
                default_severity: Severity::Deny,
                summary: "Cannot access private/internal submodule of another bounded module.".to_string(),
                rationale: "In modular monoliths, internal implementation details must remain private to prevent cross-module rot.".to_string(),
                bad_example: "use crate::modules::billing::internal::SecretVault;".to_string(),
                good_example: "use crate::modules::billing::public_api::PaymentService;".to_string(),
                remediation_recipe: "Expose clean public interfaces via module api.rs or lib.rs and ban direct internal access.".to_string(),
                configuration_hint: "\"layers\": { \"module_orders\": { \"enforce_boundaries\": true } }".to_string(),
            },
            RuleDocEntry {
                id: "CQRS-001".to_string(),
                name: "CQRS Command/Query Pipeline Isolation".to_string(),
                category: Category::Architecture,
                default_severity: Severity::Deny,
                summary: "Write command pipeline cannot import Read projections or Read models.".to_string(),
                rationale: "CQRS mandates strict separation between mutating aggregates (Write) and optimized query models (Read).".to_string(),
                bad_example: "// In Command Handler\nuse crate::read_db::OrderSummaryView;".to_string(),
                good_example: "// In Command Handler\nuse crate::domain::OrderAggregate;\n// In Query Handler\nuse crate::projections::OrderSummaryView;".to_string(),
                remediation_recipe: "Query data exclusively through query repositories or event bus projections.".to_string(),
                configuration_hint: "\"layers\": { \"commands\": { \"forbidden_deps\": [\"queries\", \"projections\"] } }".to_string(),
            },
            RuleDocEntry {
                id: "EVT-001".to_string(),
                name: "Event Producer Direct Consumer Coupling".to_string(),
                category: Category::Architecture,
                default_severity: Severity::Deny,
                summary: "Event Producer must not synchronously import or invoke Consumers.".to_string(),
                rationale: "Event-driven systems require asynchronous, decoupled publish-subscribe over a message broker or EventBus.".to_string(),
                bad_example: "// In Producer\nuse crate::consumer::send_email_handler;".to_string(),
                good_example: "// In Producer\nevent_bus.publish(OrderCreatedEvent { id }).await?;".to_string(),
                remediation_recipe: "Publish domain events to the EventBus trait without referencing specific subscriber implementations.".to_string(),
                configuration_hint: "\"layers\": { \"producer\": { \"forbidden_deps\": [\"consumer\", \"subscriber\"] } }".to_string(),
            },
            RuleDocEntry {
                id: "VUE-001".to_string(),
                name: "Vue 3 SFC Script Setup Monolith".to_string(),
                category: Category::Frontend,
                default_severity: Severity::Deny,
                summary: "Heavy business logic must be extracted from <script setup> into a companion useFeature hook.".to_string(),
                rationale: "Vue SFC files must remain declarative presentation views with concise glue code (< 30 lines in script setup).".to_string(),
                bad_example: "<script setup lang=\"ts\">\n// 300 lines of state, handlers, fetch calls\n</script>".to_string(),
                good_example: "<script setup lang=\"ts\">\nimport { useFeature } from './useFeature';\nconst { state, handleSave } = useFeature();\n</script>".to_string(),
                remediation_recipe: "Extract reactive state and methods into use<Component>.ts and TypeScript interfaces into <Component>.model.ts.".to_string(),
                configuration_hint: "\"frontend\": { \"vue\": { \"enforce_shallow_heavy\": true } }".to_string(),
            },
            RuleDocEntry {
                id: "VUE-007".to_string(),
                name: "Vue 3 Reactivity Loss".to_string(),
                category: Category::Frontend,
                default_severity: Severity::Deny,
                summary: "Direct destructuring of props or Pinia store without toRefs breaks reactivity.".to_string(),
                rationale: "Destructuring props creates detached local variables that lose connection with the parent component's Proxy object.".to_string(),
                bad_example: "const { count, activeId } = props;".to_string(),
                good_example: "const { count, activeId } = toRefs(props);\n// Or direct access:\nconsole.log(props.count);".to_string(),
                remediation_recipe: "Use toRefs(props) or storeToRefs(store) when destructuring reactive objects.".to_string(),
                configuration_hint: "\"frontend\": { \"vue\": { \"ban_reactivity_loss\": true } }".to_string(),
            },
            RuleDocEntry {
                id: "VUE-008".to_string(),
                name: "Direct Props Mutation".to_string(),
                category: Category::Frontend,
                default_severity: Severity::Deny,
                summary: "Child components must not directly mutate input props.".to_string(),
                rationale: "Direct mutation violates one-way data flow in Vue and causes hard-to-debug state inconsistencies.".to_string(),
                bad_example: "props.list.push(newItem);\nprops.value = 42;".to_string(),
                good_example: "emit('update:value', 42);\nemit('add-item', newItem);".to_string(),
                remediation_recipe: "Emit events to the parent component instead of mutating props directly.".to_string(),
                configuration_hint: "\"frontend\": { \"vue\": { \"ban_prop_mutation\": true } }".to_string(),
            },
            RuleDocEntry {
                id: "FE-RAII-001".to_string(),
                name: "Frontend RAII & IPC Listener Memory Leak".to_string(),
                category: Category::Frontend,
                default_severity: Severity::Deny,
                summary: "All Tauri IPC listeners, channels, and timers must be cleaned up in onUnmounted.".to_string(),
                rationale: "Unreleased event listeners retain component instances in memory and accumulate duplicate callbacks on navigation.".to_string(),
                bad_example: "onMounted(async () => {\n    await listen('sync', (e) => { ... });\n});".to_string(),
                good_example: "let unlisten: (() => void) | null = null;\nonMounted(async () => {\n    unlisten = await listen('sync', (e) => { ... });\n});\nonUnmounted(() => { if (unlisten) unlisten(); });".to_string(),
                remediation_recipe: "Store the unlisten function returned by Tauri listen() and invoke it inside onUnmounted().".to_string(),
                configuration_hint: "\"frontend\": { \"raii_leak_detection\": { \"enforce_tauri_unlisten\": true } }".to_string(),
            },
            RuleDocEntry {
                id: "CSS-001".to_string(),
                name: "CSS Hex/RGB Hardcode Violation".to_string(),
                category: Category::Frontend,
                default_severity: Severity::Deny,
                summary: "Hardcoded colors (#fff, rgb(), hsl(), named colors) are forbidden; use design tokens.".to_string(),
                rationale: "Design tokens (var(--color-*)) ensure consistent theme switching (Dark/Light mode) and centralized styling.".to_string(),
                bad_example: "color: #3b82f6;\nbackground: rgba(0, 0, 0, 0.5);".to_string(),
                good_example: "color: var(--color-primary);\nbackground: var(--glass-surface);".to_string(),
                remediation_recipe: "Replace literal color codes with design tokens from your CSS token registry.".to_string(),
                configuration_hint: "\"frontend\": { \"css\": { \"tokens_only\": true, \"ban_hex\": true } }".to_string(),
            },
            RuleDocEntry {
                id: "FSD-001".to_string(),
                name: "Feature-Sliced Design Hierarchy Inversion".to_string(),
                category: Category::Frontend,
                default_severity: Severity::Deny,
                summary: "Lower FSD slice cannot import from higher slice (app -> pages -> widgets -> features -> entities -> shared).".to_string(),
                rationale: "FSD strictly defines slice dependency hierarchy to ensure horizontal isolation and maintainable refactoring.".to_string(),
                bad_example: "// In entities slice\nuse import { ChatFeature } from '@/features/chat';".to_string(),
                good_example: "// In features slice\nimport { UserEntity } from '@/entities/user';".to_string(),
                remediation_recipe: "Move shared logic down to entities or shared slices, or pass components via slots/composition.".to_string(),
                configuration_hint: "\"frontend\": { \"fsd\": { \"strict_hierarchy\": true } }".to_string(),
            },
            RuleDocEntry {
                id: "ASYNC-001".to_string(),
                name: "Synchronous Mutex Guard Held Across Await Point".to_string(),
                category: Category::Concurrency,
                default_severity: Severity::Deny,
                summary: "Holding std::sync::MutexGuard across .await causes worker thread starvation and deadlocks.".to_string(),
                rationale: "If an async task yields while holding a synchronous mutex, other tasks on the thread pool block indefinitely.".to_string(),
                bad_example: "let guard = self.mutex.lock().unwrap();\nlet res = client.fetch().await;\nguard.apply(res);".to_string(),
                good_example: "let params = { self.mutex.lock().unwrap().get_params() };\nlet res = client.fetch(&params).await;\nself.mutex.lock().unwrap().apply(res);".to_string(),
                remediation_recipe: "Drop synchronous mutex guards before calling .await, or switch to tokio::sync::Mutex.".to_string(),
                configuration_hint: "\"rules\": { \"ASYNC-001\": \"deny\" }".to_string(),
            },
            RuleDocEntry {
                id: "CONC-006".to_string(),
                name: "Double Lock Deadlock Vector".to_string(),
                category: Category::Concurrency,
                default_severity: Severity::Deny,
                summary: "Re-acquiring the same mutex in the same call scope causes unconditional deadlock.".to_string(),
                rationale: "Standard non-reentrant mutexes block forever when locked twice by the same thread.".to_string(),
                bad_example: "let g1 = self.lock.lock();\nlet g2 = self.lock.lock(); // Deadlock!".to_string(),
                good_example: "let g1 = self.lock.lock();\n// Use g1 and release before acquiring again".to_string(),
                remediation_recipe: "Ensure each critical section is scoped and dropped before subsequent lock acquisitions.".to_string(),
                configuration_hint: "\"rules\": { \"CONC-006\": \"deny\" }".to_string(),
            },
            RuleDocEntry {
                id: "SEC-001".to_string(),
                name: "Taint Injection into System Command Sink".to_string(),
                category: Category::Security,
                default_severity: Severity::Deny,
                summary: "Unsanitized user input flowed into system command execution sink.".to_string(),
                rationale: "Passing unsanitized strings to shell commands allows remote arbitrary command execution (Command Injection).".to_string(),
                bad_example: "Command::new(\"sh\").arg(\"-c\").arg(format!(\"cat {}\", input)).spawn();".to_string(),
                good_example: "let safe_path = sanitize_alphanumeric_path(input)?;\nCommand::new(\"cat\").arg(safe_path).spawn();".to_string(),
                remediation_recipe: "Validate input against a strict whitelist and pass arguments individually rather than through a shell string.".to_string(),
                configuration_hint: "\"rules\": { \"SEC-001\": \"deny\" }".to_string(),
            },
        ];

        let mut existing_ids: std::collections::HashSet<String> = bespoke.iter().map(|r| r.id.to_uppercase()).collect();
        let mut results = bespoke;

        for rule in crate::BuiltinRuleRegistry::all_rules() {
            if !existing_ids.contains(&rule.id.to_uppercase()) {
                existing_ids.insert(rule.id.to_uppercase());
                results.push(RuleDocEntry {
                    id: rule.id.clone(),
                    name: rule.title.clone(),
                    category: rule.category,
                    default_severity: rule.severity,
                    summary: rule.description.clone(),
                    rationale: format!("Enforces architectural integrity and quality standards for rule {}.", rule.id),
                    bad_example: format!("// Violates rule {}\n// Description: {}", rule.id, rule.description),
                    good_example: format!("// Remediated clean pattern for {}\n// Remediation: {}", rule.id, rule.remediation),
                    remediation_recipe: rule.remediation.clone(),
                    configuration_hint: format!("\"rules\": {{ \"{}\": \"{:?}\" }}", rule.id, rule.severity).to_lowercase(),
                });
            }
        }

        results.sort_by(|a, b| {
            let cat_cmp = format!("{:?}", a.category).cmp(&format!("{:?}", b.category));
            if cat_cmp == std::cmp::Ordering::Equal {
                a.id.cmp(&b.id)
            } else {
                cat_cmp
            }
        });

        results
    }

    pub fn get(id: &str) -> Option<RuleDocEntry> {
        let canonical = crate::BuiltinRuleRegistry::canonical_rule_id(id.trim());
        let id_upper = canonical.to_uppercase();
        Self::all().into_iter().find(|r| r.id.to_uppercase() == id_upper)
    }

    pub fn by_category(category: Category) -> Vec<RuleDocEntry> {
        Self::all().into_iter().filter(|r| r.category == category).collect()
    }

    pub fn search(query: &str) -> Vec<RuleDocEntry> {
        let q = query.to_lowercase();
        Self::all()
            .into_iter()
            .filter(|r| {
                r.id.to_lowercase().contains(&q)
                    || r.name.to_lowercase().contains(&q)
                    || r.summary.to_lowercase().contains(&q)
                    || r.rationale.to_lowercase().contains(&q)
            })
            .collect()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_rule_catalog_all_and_get() {
        let all = RuleCatalog::all();
        assert!(!all.is_empty());
        assert!(all.len() >= 50);

        let arch001 = RuleCatalog::get("ARCH-001");
        assert!(arch001.is_some());
        let entry = arch001.unwrap();
        assert_eq!(entry.id, "ARCH-001");
        assert_eq!(entry.category, Category::Architecture);
        assert_eq!(entry.default_severity, Severity::Deny);
        assert!(!entry.bad_example.is_empty());
        assert!(!entry.good_example.is_empty());

        // Case insensitivity & alias lookup
        assert_eq!(RuleCatalog::get("arch-001"), RuleCatalog::get("ARCH-001"));
        assert_eq!(RuleCatalog::get("arch/domain-purity"), RuleCatalog::get("ARCH-001"));
        assert_eq!(RuleCatalog::get("vue/no-destructure"), RuleCatalog::get("VUE-007"));
        assert!(RuleCatalog::get("NON-EXISTENT-RULE").is_none());

        // Test non-bespoke registry rule derived entry
        let arch020 = RuleCatalog::get("ARCH-020");
        assert!(arch020.is_some());
        let entry020 = arch020.unwrap();
        assert_eq!(entry020.id, "ARCH-020");
        assert!(entry020.rationale.contains("ARCH-020"));
    }

    #[test]
    fn test_rule_catalog_by_category() {
        let arch_rules = RuleCatalog::by_category(Category::Architecture);
        assert!(!arch_rules.is_empty());
        assert!(arch_rules.iter().all(|r| r.category == Category::Architecture));

        let fe_rules = RuleCatalog::by_category(Category::Frontend);
        assert!(!fe_rules.is_empty());
        assert!(fe_rules.iter().all(|r| r.category == Category::Frontend));

        let conc_rules = RuleCatalog::by_category(Category::Concurrency);
        assert!(!conc_rules.is_empty());
        assert!(conc_rules.iter().all(|r| r.category == Category::Concurrency));
    }

    #[test]
    fn test_rule_catalog_search() {
        let results = RuleCatalog::search("reactivity");
        assert!(!results.is_empty());
        assert!(results.iter().any(|r| r.id == "VUE-007"));

        let results_sdk = RuleCatalog::search("sdk");
        assert!(!results_sdk.is_empty());
        assert!(results_sdk.iter().any(|r| r.id == "ARCH-001"));

        let empty = RuleCatalog::search("xyznonexistentterm12345");
        assert!(empty.is_empty());
    }

    #[test]
    fn test_rule_doc_entry_serde() {
        let entry = RuleCatalog::get("ARCH-001").unwrap();
        let json = serde_json::to_string(&entry).unwrap();
        let deserialized: RuleDocEntry = serde_json::from_str(&json).unwrap();
        assert_eq!(entry, deserialized);
    }
}
