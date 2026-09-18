use crate::synthetic_matrix::generator_trait::SeededViolation;

/// Deterministic, zero-dependency Xorshift64Star PRNG
#[derive(Clone, Copy, Debug)]
pub struct FastRng(u64);

impl FastRng {
    pub const fn new(seed: u64) -> Self {
        Self(if seed == 0 { 0xdead_beef_cafe_babe } else { seed })
    }

    #[inline]
    pub fn next_u64(&mut self) -> u64 {
        let mut x = self.0;
        x ^= x << 13;
        x ^= x >> 7;
        x ^= x << 17;
        self.0 = x;
        x.wrapping_mul(0x2545_f491_4f6c_dd1d)
    }

    #[inline]
    pub fn gen_range(&mut self, min: usize, max: usize) -> usize {
        if min >= max {
            return min;
        }
        min + (self.next_u64() as usize % (max - min))
    }

    #[inline]
    pub fn chance(&mut self, percentage: f64) -> bool {
        (self.next_u64() % 10000) < (percentage * 100.0) as u64
    }
}

pub struct ScaleHelper;

impl ScaleHelper {
    /// Generates structured Rust modules for a given crate and layer with canonical archetype distribution
    pub fn generate_rust_modules(
        crate_name: &str,
        layer: &str,
        target_sloc: usize,
        inject_violations: bool,
    ) -> (Vec<(String, String)>, Vec<SeededViolation>) {
        let lines_per_file = 60;
        let num_files = (target_sloc / lines_per_file).max(10);
        let mut files = Vec::with_capacity(num_files + 1);
        let mut violations = Vec::new();

        let group_size = 50;
        let num_groups = num_files.div_ceil(group_size);
        let mut lib_mods = Vec::with_capacity(num_groups);
        for g_idx in 0..num_groups {
            lib_mods.push(format!("pub mod group_{:02};", g_idx));
        }
        files.push((
            format!("{}/src/lib.rs", crate_name),
            format!("//! Crate '{}' layer '{}'\n{}\n", crate_name, layer, lib_mods.join("\n")),
        ));

        for g_idx in 0..num_groups {
            let start = g_idx * group_size;
            let end = (start + group_size).min(num_files);
            let mut group_mods = Vec::new();
            for f_idx in start..end {
                group_mods.push(format!("pub mod mod_{:03};", f_idx));
            }
            files.push((
                format!("{}/src/group_{:02}/mod.rs", crate_name, g_idx),
                format!("//! Group {:02}\n{}\n", g_idx, group_mods.join("\n")),
            ));
        }

        let seed = 0x5a17_e409_cafe_1337
            ^ (target_sloc as u64)
            ^ (layer.as_bytes().iter().map(|b| *b as u64).sum::<u64>() << 16);
        let mut rng = FastRng::new(seed);

        for f_idx in 0..num_files {
            let g_idx = f_idx / group_size;
            let file_name = format!("mod_{:03}.rs", f_idx);
            let mut content = String::with_capacity(2000);
            content.push_str("//! Auto-generated synthetic enterprise module\n\n");

            let method_body_extra = String::new();
            let file_rel_path = format!("{}/src/{}_group_{:02}/{}", crate_name, layer, g_idx, file_name);

            // 1. Seeded Firewall Rule Violations (Decoupled from testability archetypes)
            if inject_violations && rng.chance(12.5) {
                match layer {
                    "domain" | "core" | "entities" | "entity" | "domain_core" => {
                        content.push_str("use reqwest::Client;\n");
                        violations.push(SeededViolation {
                            rule_id: "ARCH-001".into(),
                            target_file_suffix: file_rel_path.clone(),
                            description: format!("Domain crate '{}' cannot import 'reqwest'", crate_name),
                        });
                    }
                    "application" | "app" | "usecases" | "service" | "services" | "domain_services" => {
                        content.push_str("use tauri::command;\n");
                        violations.push(SeededViolation {
                            rule_id: "ARCH-002".into(),
                            target_file_suffix: file_rel_path.clone(),
                            description: format!("Application crate '{}' cannot import 'tauri'", crate_name),
                        });
                    }
                    "infrastructure" | "infra" | "repository" | "database" | "adapter" | "controller" | "controllers" => {
                        content.push_str("use tauri::AppHandle;\n");
                        violations.push(SeededViolation {
                            rule_id: "ARCH-005".into(),
                            target_file_suffix: file_rel_path.clone(),
                            description: format!("Infrastructure crate '{}' is not authorized to import 'tauri'", crate_name),
                        });
                    }
                    "commands" | "write" => {
                        content.push_str("use crate::read_db::UserProjection;\n");
                        violations.push(SeededViolation {
                            rule_id: "CQRS-001".into(),
                            target_file_suffix: file_rel_path.clone(),
                            description: "Write pipeline cannot import Read projection".into(),
                        });
                    }
                    "producer" => {
                        content.push_str("use crate::consumer::on_order_event;\n");
                        violations.push(SeededViolation {
                            rule_id: "EVT-001".into(),
                            target_file_suffix: file_rel_path.clone(),
                            description: "Event Producer cannot directly import Consumer".into(),
                        });
                    }
                    _ => {}
                }
            }

            // 2. Canonical Realistic Archetype Distribution per Layer
            let mut testability_extra = String::new();
            let bucket_20 = f_idx % 20;

            let (trait_def, struct_def) = match layer {
                "domain" | "core" | "entities" | "entity" | "domain_core" => {
                    // 100% Pure Domain Entities / Aggregates
                    (
                        String::new(),
                        format!(
                            "#[derive(Debug, Clone, PartialEq, Eq)]\npub struct OrderAggregate_{} {{\n    pub id: u64,\n    pub customer_id: u64,\n    pub items: Vec<(u64, u64, u32)>,\n    pub status: u32,\n    pub discount_cents: u64,\n}}\n\nimpl OrderAggregate_{} {{\n    pub fn calculate_total(&self, tax_rate_bps: u64) -> Result<u64, &'static str> {{\n{}\n        if self.items.is_empty() {{\n            return Err(\"Order cannot be empty\");\n        }}\n        let mut subtotal: u64 = 0;\n        for (_, price, qty) in &self.items {{\n            if *price == 0 || *qty == 0 {{\n                return Err(\"Invalid item price or quantity\");\n            }}\n            subtotal = subtotal.saturating_add(price.saturating_mul(*qty as u64));\n        }}\n        let discounted = subtotal.saturating_sub(self.discount_cents);\n        let tax = (discounted * tax_rate_bps) / 10_000;\n        Ok(discounted.saturating_add(tax))\n    }}\n\n    pub fn transition_to(&mut self, next_status: u32) -> Result<(), &'static str> {{\n        match (self.status, next_status) {{\n            (0, 1) => {{ self.status = 1; Ok(()) }}\n            (1, 2) => {{ self.status = 2; Ok(()) }}\n            (1, 3) => {{ self.status = 3; Ok(()) }}\n            (2, 4) => {{ self.status = 4; Ok(()) }}\n            (_, 5) => {{ self.status = 5; Ok(()) }}\n            _ => Err(\"Invalid state transition\"),\n        }}\n    }}\n}}\n\n",
                            f_idx, f_idx, method_body_extra
                        )
                    )
                }
                "ports" | "api" | "plugin_api" => {
                    // 100% Pure Interface Contracts
                    (
                        format!(
                            "pub trait ServicePort_{} {{\n    fn process(&self, input: u64) -> Result<u64, &'static str>;\n}}\n\n",
                            f_idx
                        ),
                        format!(
                            "#[derive(Debug, Clone)]\npub struct PortData_{} {{\n    pub code: u32,\n}}\n\n",
                            f_idx
                        )
                    )
                }
                "application" | "app" | "usecases" | "services" | "service" | "domain_services" => {
                    // 100% Mockable Inverted Use Cases
                    (
                        format!(
                            "pub trait ServicePort_{} {{\n    fn process(&self, input: u64) -> Result<u64, &'static str>;\n}}\n\n",
                            f_idx
                        ),
                        format!(
                            "pub struct UseCase_{} {{\n    pub port: Box<dyn ServicePort_{}>,\n}}\n\nimpl UseCase_{} {{\n    pub fn execute(&self, val: u64) -> Result<u64, &'static str> {{\n{}\n        self.port.process(val)\n    }}\n}}\n\n",
                            f_idx, f_idx, f_idx, method_body_extra
                        )
                    )
                }
                "infrastructure" | "infra" | "repository" | "database" | "adapter" | "adapter-tauri" | "tauri" => {
                    // 100% IntBound I/O / Storage Adapters
                    testability_extra.push_str("        let f_data = std::fs::read_to_string(\"db_pool.cfg\").unwrap_or_default();\n        let _data_len = f_data.len();\n");
                    let method_inject = format!("{}{}", method_body_extra, testability_extra);
                    (
                        format!(
                            "pub trait ServicePort_{} {{\n    fn process(&self, input: u64) -> Result<u64, &'static str>;\n}}\n\n",
                            f_idx
                        ),
                        format!(
                            "#[derive(Debug, Clone, PartialEq, Eq)]\npub struct Adapter_{} {{\n    pub id: u64,\n}}\n\nimpl Adapter_{} {{\n    pub fn handle(&self, val: u64) -> Result<u64, &'static str> {{\n{}\n        Ok(val.saturating_add(1))\n    }}\n}}\n\n",
                            f_idx, f_idx, method_inject
                        )
                    )
                }
                "onion_infra" => {
                    // Onion Infrastructure: 70% IntBound (25% total), 30% Flaky (10% total)
                    if bucket_20 < 14 {
                        testability_extra.push_str("        let f_data = std::fs::read_to_string(\"db_pool.cfg\").unwrap_or_default();\n        let _data_len = f_data.len();\n");
                        let method_inject = format!("{}{}", method_body_extra, testability_extra);
                        (
                            format!(
                                "pub trait ServicePort_{} {{\n    fn process(&self, input: u64) -> Result<u64, &'static str>;\n}}\n\n",
                                f_idx
                            ),
                            format!(
                                "#[derive(Debug, Clone, PartialEq, Eq)]\npub struct Adapter_{} {{\n    pub id: u64,\n}}\n\nimpl Adapter_{} {{\n    pub fn handle(&self, val: u64) -> Result<u64, &'static str> {{\n{}\n        Ok(val.saturating_add(1))\n    }}\n}}\n\n",
                                f_idx, f_idx, method_inject
                            )
                        )
                    } else {
                        testability_extra.push_str("        let cur_inst = std::time::Instant::now();\n        let _t = cur_inst.elapsed().as_millis();\n");
                        let method_inject = format!("{}{}", method_body_extra, testability_extra);
                        (
                            String::new(),
                            format!(
                                "pub struct InfraTimeout_{};\nimpl InfraTimeout_{} {{\n    pub fn check_timeout(&self) {{\n{}\n    }}\n}}\n\n",
                                f_idx, f_idx, method_inject
                            )
                        )
                    }
                }
                "controller" => {
                    // Layered Controllers: 80% Flaky (Timeouts/Clocks), 20% Poisoned (Constructor I/O)
                    if bucket_20 < 16 {
                        testability_extra.push_str("        let cur_inst = std::time::Instant::now();\n        let _t = cur_inst.elapsed().as_millis();\n");
                        let method_inject = format!("{}{}", method_body_extra, testability_extra);
                        (
                            String::new(),
                            format!(
                                "pub struct LayeredController_{};\nimpl LayeredController_{} {{\n    pub fn handle_request(&self) {{\n{}\n    }}\n}}\n\n",
                                f_idx, f_idx, method_inject
                            )
                        )
                    } else {
                        (
                            String::new(),
                            format!(
                                "pub struct LayeredControllerPoison_{};\nimpl LayeredControllerPoison_{} {{\n    pub fn new() -> Self {{\n        let env_cfg = std::fs::read_to_string(\"controller_env.cfg\").unwrap_or_default();\n        let _len = env_cfg.len();\n        Self\n    }}\n}}\n\n",
                                f_idx, f_idx
                            )
                        )
                    }
                }
                "controllers" | "gateway" | "bff" => {
                    // BFF / Clean Gateway: 5% Mockable Services, 45% IntBound HTTP, 40% Flaky Timeouts, 10% Poisoned Constructor
                    if bucket_20 < 1 {
                        (
                            format!(
                                "pub trait GatewayPort_{} {{\n    fn process(&self, input: u64) -> Result<u64, &'static str>;\n}}\n\n",
                                f_idx
                            ),
                            format!(
                                "pub struct GatewayHandler_{} {{\n    pub port: Box<dyn GatewayPort_{}>,\n}}\n\nimpl GatewayHandler_{} {{\n    pub fn handle(&self, val: u64) -> Result<u64, &'static str> {{\n        self.port.process(val)\n    }}\n}}\n\n",
                                f_idx, f_idx, f_idx
                            )
                        )
                    } else if bucket_20 < 10 {
                        testability_extra.push_str("        let http_cli = reqwest::Client::new();\n        let _cli_ref = &http_cli;\n");
                        let method_inject = format!("{}{}", method_body_extra, testability_extra);
                        (
                            String::new(),
                            format!(
                                "#[derive(Debug, Clone, PartialEq, Eq)]\npub struct GatewayClient_{} {{\n    pub id: u64,\n}}\n\nimpl GatewayClient_{} {{\n    pub fn call(&self, val: u64) -> Result<u64, &'static str> {{\n{}\n        Ok(val)\n    }}\n}}\n\n",
                                f_idx, f_idx, method_inject
                            )
                        )
                    } else if bucket_20 < 18 {
                        testability_extra.push_str("        let cur_inst = std::time::Instant::now();\n        let _t = cur_inst.elapsed().as_millis();\n");
                        let method_inject = format!("{}{}", method_body_extra, testability_extra);
                        (
                            String::new(),
                            format!(
                                "pub struct CircuitBreaker_{};\nimpl CircuitBreaker_{} {{\n    pub fn check_timeout(&self) {{\n{}\n    }}\n}}\n\n",
                                f_idx, f_idx, method_inject
                            )
                        )
                    } else {
                        (
                            String::new(),
                            format!(
                                "pub struct GatewayNative_{};\nimpl GatewayNative_{} {{\n    pub fn new() -> Self {{\n        let env_cfg = std::fs::read_to_string(\"gateway_env.cfg\").unwrap_or_default();\n        let _len = env_cfg.len();\n        Self\n    }}\n}}\n\n",
                                f_idx, f_idx
                            )
                        )
                    }
                }
                "plugin" | "kernel" => {
                    // Microkernel Plugins: 10% Mockable Ports, 40% IntBound Config, 25% Flaky Hot-Reload, 25% Poisoned Dynamic Link
                    if bucket_20 < 2 {
                        (
                            format!(
                                "pub trait PluginPort_{} {{\n    fn execute(&self, input: u64) -> Result<u64, &'static str>;\n}}\n\n",
                                f_idx
                            ),
                            format!(
                                "pub struct PluginHost_{} {{\n    pub port: Box<dyn PluginPort_{}>,\n}}\n\nimpl PluginHost_{} {{\n    pub fn run_plugin(&self, val: u64) -> Result<u64, &'static str> {{\n        self.port.execute(val)\n    }}\n}}\n\n",
                                f_idx, f_idx, f_idx
                            )
                        )
                    } else if bucket_20 < 10 {
                        testability_extra.push_str("        let f_data = std::fs::read_to_string(\"plugin_cfg.json\").unwrap_or_default();\n        let _data_len = f_data.len();\n");
                        let method_inject = format!("{}{}", method_body_extra, testability_extra);
                        (
                            String::new(),
                            format!(
                                "#[derive(Debug, Clone)]\npub struct PluginStorage_{} {{\n    pub id: u32,\n}}\n\nimpl PluginStorage_{} {{\n    pub fn load_config(&self) {{\n{}\n    }}\n}}\n\n",
                                f_idx, f_idx, method_inject
                            )
                        )
                    } else if bucket_20 < 15 {
                        testability_extra.push_str("        let bg_task = tokio::spawn(async {});\n        let _task_done = bg_task.is_finished();\n");
                        let method_inject = format!("{}{}", method_body_extra, testability_extra);
                        (
                            String::new(),
                            format!(
                                "pub struct PluginWatcher_{};\nimpl PluginWatcher_{} {{\n    pub fn watch_reloads(&self) {{\n{}\n    }}\n}}\n\n",
                                f_idx, f_idx, method_inject
                            )
                        )
                    } else {
                        (
                            String::new(),
                            format!(
                                "#[derive(Debug, Clone)]\npub struct PluginDynamic_{};\nimpl PluginDynamic_{} {{\n    pub fn new() -> Self {{\n        let plugin_env = std::fs::read_to_string(\"plugin_dyn.cfg\").unwrap_or_default();\n        let _len = plugin_env.len();\n        Self\n    }}\n}}\n\n",
                                f_idx, f_idx
                            )
                        )
                    }
                }
                "actor" | "worker" | "actors" => {
                    // Actor System: 10% Pure Messages, 5% Mockable Behaviors, 15% IntBound Storage, 65% Flaky Spawn, 5% Poisoned Constructor
                    if bucket_20 < 2 {
                        (
                            String::new(),
                            format!(
                                "pub enum ActorMsg_{} {{\n    Ping(u64),\n    Pong(u64),\n}}\n\n",
                                f_idx
                            )
                        )
                    } else if bucket_20 < 3 {
                        (
                            format!(
                                "pub trait ActorBehavior_{} {{\n    fn on_message(&mut self, val: u64);\n}}\n\n",
                                f_idx
                            ),
                            format!(
                                "pub struct ActorHandler_{} {{\n    pub behavior: Box<dyn ActorBehavior_{}>,\n}}\n\n",
                                f_idx, f_idx
                            )
                        )
                    } else if bucket_20 < 6 {
                        testability_extra.push_str("        let f_data = std::fs::read_to_string(\"actor_journal.dat\").unwrap_or_default();\n        let _data_len = f_data.len();\n");
                        let method_inject = format!("{}{}", method_body_extra, testability_extra);
                        (
                            String::new(),
                            format!(
                                "pub struct ActorStorage_{};\nimpl ActorStorage_{} {{\n    pub fn load_state(&self) {{\n{}\n    }}\n}}\n\n",
                                f_idx, f_idx, method_inject
                            )
                        )
                    } else if bucket_20 < 19 {
                        testability_extra.push_str("        let bg_task = tokio::spawn(async {});\n        let _task_done = bg_task.is_finished();\n");
                        let method_inject = format!("{}{}", method_body_extra, testability_extra);
                        (
                            String::new(),
                            format!(
                                "pub struct ActorWorker_{};\nimpl ActorWorker_{} {{\n    pub fn start(&self) {{\n{}\n    }}\n}}\n\n",
                                f_idx, f_idx, method_inject
                            )
                        )
                    } else {
                        (
                            String::new(),
                            format!(
                                "pub struct ActorPoison_{};\nimpl ActorPoison_{} {{\n    pub fn new() -> Self {{\n        let actor_cfg = std::fs::read_to_string(\"actor_env.dat\").unwrap_or_default();\n        let _len = actor_cfg.len();\n        Self\n    }}\n}}\n\n",
                                f_idx, f_idx
                            )
                        )
                    }
                }
                "function" | "handler" | "serverless" => {
                    // Serverless: 5% Pure DTOs, 10% Mockable Handlers, 35% IntBound HTTP, 35% Flaky Timer, 15% Poisoned Constructor
                    if bucket_20 < 2 {
                        (
                            format!(
                                "pub trait FunctionService_{} {{\n    fn handle(&self, input: u64) -> Result<u64, &'static str>;\n}}\n\n",
                                f_idx
                            ),
                            format!(
                                "pub struct FunctionHandler_{} {{\n    pub service: Box<dyn FunctionService_{}>,\n}}\n\n",
                                f_idx, f_idx
                            )
                        )
                    } else if bucket_20 < 9 {
                        testability_extra.push_str("        let http_cli = reqwest::Client::new();\n        let _cli_ref = &http_cli;\n");
                        let method_inject = format!("{}{}", method_body_extra, testability_extra);
                        (
                            String::new(),
                            format!(
                                "pub struct FaaSClient_{};\nimpl FaaSClient_{} {{\n    pub fn invoke(&self) {{\n{}\n    }}\n}}\n\n",
                                f_idx, f_idx, method_inject
                            )
                        )
                    } else if bucket_20 < 17 {
                        testability_extra.push_str("        let cur_inst = std::time::Instant::now();\n        let _t = cur_inst.elapsed().as_millis();\n");
                        let method_inject = format!("{}{}", method_body_extra, testability_extra);
                        (
                            String::new(),
                            format!(
                                "pub struct EphemeralContext_{};\nimpl EphemeralContext_{} {{\n    pub fn timeout_check(&self) {{\n{}\n    }}\n}}\n\n",
                                f_idx, f_idx, method_inject
                            )
                        )
                    } else {
                        (
                            String::new(),
                            format!(
                                "pub struct EphemeralPoison_{};\nimpl EphemeralPoison_{} {{\n    pub fn new() -> Self {{\n        let faas_env = std::fs::read_to_string(\"faas_env.dat\").unwrap_or_default();\n        let _len = faas_env.len();\n        Self\n    }}\n}}\n\n",
                                f_idx, f_idx
                            )
                        )
                    }
                }
                "producer" | "consumer" | "events" => {
                    // Event-Driven: 5% Pure Events, 5% Mockable Handlers, 20% IntBound Storage, 55% Flaky Streams, 15% Poisoned Constructor
                    if bucket_20 < 1 {
                        (
                            String::new(),
                            format!(
                                "#[derive(Debug, Clone, PartialEq, Eq)]\npub struct DomainEvent_{} {{\n    pub event_id: u64,\n    pub occurred_at: u64,\n}}\n\n",
                                f_idx
                            )
                        )
                    } else if bucket_20 < 2 {
                        (
                            format!(
                                "pub trait EventSubscriber_{} {{\n    fn on_event(&self, val: u64);\n}}\n\n",
                                f_idx
                            ),
                            format!(
                                "pub struct EventHandler_{} {{\n    pub sub: Box<dyn EventSubscriber_{}>,\n}}\n\n",
                                f_idx, f_idx
                            )
                        )
                    } else if bucket_20 < 6 {
                        testability_extra.push_str("        let f_data = std::fs::read_to_string(\"event_queue.dat\").unwrap_or_default();\n        let _data_len = f_data.len();\n");
                        let method_inject = format!("{}{}", method_body_extra, testability_extra);
                        (
                            String::new(),
                            format!(
                                "pub struct QueuePublisher_{};\nimpl QueuePublisher_{} {{\n    pub fn publish(&self) {{\n{}\n    }}\n}}\n\n",
                                f_idx, f_idx, method_inject
                            )
                        )
                    } else if bucket_20 < 17 {
                        testability_extra.push_str("        let bg_task = tokio::spawn(async {});\n        let _task_done = bg_task.is_finished();\n");
                        let method_inject = format!("{}{}", method_body_extra, testability_extra);
                        (
                            String::new(),
                            format!(
                                "pub struct StreamConsumer_{};\nimpl StreamConsumer_{} {{\n    pub fn poll_events(&self) {{\n{}\n    }}\n}}\n\n",
                                f_idx, f_idx, method_inject
                            )
                        )
                    } else {
                        (
                            String::new(),
                            format!(
                                "pub struct EventPoison_{};\nimpl EventPoison_{} {{\n    pub fn new() -> Self {{\n        let evt_env = std::fs::read_to_string(\"evt_env.dat\").unwrap_or_default();\n        let _len = evt_env.len();\n        Self\n    }}\n}}\n\n",
                                f_idx, f_idx
                            )
                        )
                    }
                }
                "commands" | "write" => {
                    // CQRS Command Pipeline: 20% Pure Commands, 10% Mockable Handlers, 40% IntBound Journal, 25% Flaky Bus, 5% Poisoned Constructor
                    if bucket_20 < 4 {
                        (
                            String::new(),
                            format!(
                                "#[derive(Debug, Clone, PartialEq, Eq)]\npub struct CommandPayload_{} {{\n    pub cmd_id: u64,\n}}\n\n",
                                f_idx
                            )
                        )
                    } else if bucket_20 < 6 {
                        (
                            format!(
                                "pub trait CommandPort_{} {{\n    fn handle(&self, cmd: u64) -> Result<(), &'static str>;\n}}\n\n",
                                f_idx
                            ),
                            format!(
                                "pub struct CommandHandler_{} {{\n    pub port: Box<dyn CommandPort_{}>,\n}}\n\n",
                                f_idx, f_idx
                            )
                        )
                    } else if bucket_20 < 14 {
                        testability_extra.push_str("        let f_data = std::fs::read_to_string(\"command_journal.dat\").unwrap_or_default();\n        let _data_len = f_data.len();\n");
                        let method_inject = format!("{}{}", method_body_extra, testability_extra);
                        (
                            String::new(),
                            format!(
                                "pub struct JournalWriter_{};\nimpl JournalWriter_{} {{\n    pub fn write_entry(&self) {{\n{}\n    }}\n}}\n\n",
                                f_idx, f_idx, method_inject
                            )
                        )
                    } else if bucket_20 < 19 {
                        testability_extra.push_str("        let bg_task = tokio::spawn(async {});\n        let _task_done = bg_task.is_finished();\n");
                        let method_inject = format!("{}{}", method_body_extra, testability_extra);
                        (
                            String::new(),
                            format!(
                                "pub struct AsyncCommandBus_{};\nimpl AsyncCommandBus_{} {{\n    pub fn dispatch(&self) {{\n{}\n    }}\n}}\n\n",
                                f_idx, f_idx, method_inject
                            )
                        )
                    } else {
                        (
                            String::new(),
                            format!(
                                "pub struct CommandPoison_{};\nimpl CommandPoison_{} {{\n    pub fn new() -> Self {{\n        let cmd_env = std::fs::read_to_string(\"cmd_env.dat\").unwrap_or_default();\n        let _len = cmd_env.len();\n        Self\n    }}\n}}\n\n",
                                f_idx, f_idx
                            )
                        )
                    }
                }
                "queries" | "read" => {
                    // CQRS Query Pipeline: 20% Pure Views, 10% Mockable Handlers, 40% IntBound Cache, 25% Flaky Sync, 5% Poisoned Constructor
                    if bucket_20 < 4 {
                        (
                            String::new(),
                            format!(
                                "#[derive(Debug, Clone, PartialEq, Eq)]\npub struct QueryView_{} {{\n    pub view_id: u64,\n}}\n\n",
                                f_idx
                            )
                        )
                    } else if bucket_20 < 6 {
                        (
                            format!(
                                "pub trait QueryPort_{} {{\n    fn query(&self, id: u64) -> Result<u64, &'static str>;\n}}\n\n",
                                f_idx
                            ),
                            format!(
                                "pub struct QueryHandler_{} {{\n    pub port: Box<dyn QueryPort_{}>,\n}}\n\n",
                                f_idx, f_idx
                            )
                        )
                    } else if bucket_20 < 14 {
                        testability_extra.push_str("        let f_data = std::fs::read_to_string(\"query_cache.dat\").unwrap_or_default();\n        let _data_len = f_data.len();\n");
                        let method_inject = format!("{}{}", method_body_extra, testability_extra);
                        (
                            String::new(),
                            format!(
                                "pub struct CacheReader_{};\nimpl CacheReader_{} {{\n    pub fn read_entry(&self) {{\n{}\n    }}\n}}\n\n",
                                f_idx, f_idx, method_inject
                            )
                        )
                    } else if bucket_20 < 19 {
                        testability_extra.push_str("        let bg_task = tokio::spawn(async {});\n        let _task_done = bg_task.is_finished();\n");
                        let method_inject = format!("{}{}", method_body_extra, testability_extra);
                        (
                            String::new(),
                            format!(
                                "pub struct AsyncProjectionSync_{};\nimpl AsyncProjectionSync_{} {{\n    pub fn sync(&self) {{\n{}\n    }}\n}}\n\n",
                                f_idx, f_idx, method_inject
                            )
                        )
                    } else {
                        (
                            String::new(),
                            format!(
                                "pub struct QueryPoison_{};\nimpl QueryPoison_{} {{\n    pub fn new() -> Self {{\n        let q_env = std::fs::read_to_string(\"query_env.dat\").unwrap_or_default();\n        let _len = q_env.len();\n        Self\n    }}\n}}\n\n",
                                f_idx, f_idx
                            )
                        )
                    }
                }
                "module" => {
                    // Modular Monolith: 20% Pure Entities, 20% Mockable Services, 45% IntBound Storage, 10% Flaky Spawns, 5% Poisoned Constructor
                    if bucket_20 < 4 {
                        (
                            String::new(),
                            format!(
                                "#[derive(Debug, Clone, PartialEq, Eq)]\npub struct ModuleEntity_{} {{\n    pub id: u64,\n}}\n\n",
                                f_idx
                            )
                        )
                    } else if bucket_20 < 8 {
                        (
                            format!(
                                "pub trait ModulePort_{} {{\n    fn execute(&self, val: u64) -> Result<u64, &'static str>;\n}}\n\n",
                                f_idx
                            ),
                            format!(
                                "pub struct ModuleService_{} {{\n    pub port: Box<dyn ModulePort_{}>,\n}}\n\n",
                                f_idx, f_idx
                            )
                        )
                    } else if bucket_20 < 17 {
                        testability_extra.push_str("        let f_data = std::fs::read_to_string(\"module_store.dat\").unwrap_or_default();\n        let _data_len = f_data.len();\n");
                        let method_inject = format!("{}{}", method_body_extra, testability_extra);
                        (
                            String::new(),
                            format!(
                                "pub struct ModuleStorage_{};\nimpl ModuleStorage_{} {{\n    pub fn persist(&self) {{\n{}\n    }}\n}}\n\n",
                                f_idx, f_idx, method_inject
                            )
                        )
                    } else if bucket_20 < 19 {
                        testability_extra.push_str("        let bg_task = tokio::spawn(async {});\n        let _task_done = bg_task.is_finished();\n");
                        let method_inject = format!("{}{}", method_body_extra, testability_extra);
                        (
                            String::new(),
                            format!(
                                "pub struct ModuleWorker_{};\nimpl ModuleWorker_{} {{\n    pub fn run_bg(&self) {{\n{}\n    }}\n}}\n\n",
                                f_idx, f_idx, method_inject
                            )
                        )
                    } else {
                        (
                            String::new(),
                            format!(
                                "pub struct ModulePoison_{};\nimpl ModulePoison_{} {{\n    pub fn new() -> Self {{\n        let mod_cfg = std::fs::read_to_string(\"module_env.dat\").unwrap_or_default();\n        let _len = mod_cfg.len();\n        Self\n    }}\n}}\n\n",
                                f_idx, f_idx
                            )
                        )
                    }
                }
                "proto" | "shared_proto" | "contracts" | "messages" => {
                    // 100% Pure Proto / Contracts / DTOs
                    (
                        String::new(),
                        format!(
                            "#[derive(Debug, Clone, PartialEq, Eq)]\npub struct ProtoMessage_{} {{\n    pub msg_id: u64,\n    pub payload_code: u32,\n}}\n\n",
                            f_idx
                        )
                    )
                }
                "microservice" | "service_auth" | "service_billing" => {
                    // Microservice Internals: 10% Pure DTOs, 15% Mockable, 50% IntBound RPC/Storage, 15% Flaky Spawns, 10% Poisoned Constructor
                    if bucket_20 < 2 {
                        (
                            String::new(),
                            format!(
                                "#[derive(Debug, Clone, PartialEq, Eq)]\npub struct ServiceEntity_{} {{\n    pub id: u64,\n}}\n\n",
                                f_idx
                            )
                        )
                    } else if bucket_20 < 5 {
                        (
                            format!(
                                "pub trait ServicePort_{} {{\n    fn execute(&self, val: u64) -> Result<u64, &'static str>;\n}}\n\n",
                                f_idx
                            ),
                            format!(
                                "pub struct ServiceUseCase_{} {{\n    pub port: Box<dyn ServicePort_{}>,\n}}\n\n",
                                f_idx, f_idx
                            )
                        )
                    } else if bucket_20 < 15 {
                        testability_extra.push_str("        let http_cli = reqwest::Client::new();\n        let _cli_ref = &http_cli;\n");
                        let method_inject = format!("{}{}", method_body_extra, testability_extra);
                        (
                            String::new(),
                            format!(
                                "pub struct ServiceClient_{};\nimpl ServiceClient_{} {{\n    pub fn call_rpc(&self) {{\n{}\n    }}\n}}\n\n",
                                f_idx, f_idx, method_inject
                            )
                        )
                    } else if bucket_20 < 18 {
                        testability_extra.push_str("        let bg_task = tokio::spawn(async {});\n        let _task_done = bg_task.is_finished();\n");
                        let method_inject = format!("{}{}", method_body_extra, testability_extra);
                        (
                            String::new(),
                            format!(
                                "pub struct ServiceWorker_{};\nimpl ServiceWorker_{} {{\n    pub fn start_worker(&self) {{\n{}\n    }}\n}}\n\n",
                                f_idx, f_idx, method_inject
                            )
                        )
                    } else {
                        (
                            String::new(),
                            format!(
                                "pub struct ServicePoison_{};\nimpl ServicePoison_{} {{\n    pub fn new() -> Self {{\n        let cfg_data = std::fs::read_to_string(\"service_env.dat\").unwrap_or_default();\n        let _len = cfg_data.len();\n        Self\n    }}\n}}\n\n",
                                f_idx, f_idx
                            )
                        )
                    }
                }
                _ => {
                    if bucket_20 < 6 {
                        (
                            String::new(),
                            format!(
                                "#[derive(Debug, Clone, PartialEq, Eq)]\npub struct GenericEntity_{} {{\n    pub id: u64,\n}}\n\n",
                                f_idx
                            )
                        )
                    } else if bucket_20 < 14 {
                        (
                            format!(
                                "pub trait GenericPort_{} {{\n    fn execute(&self, input: u64) -> Result<u64, &'static str>;\n}}\n\n",
                                f_idx
                            ),
                            format!(
                                "pub struct GenericService_{} {{\n    pub port: Box<dyn GenericPort_{}>,\n}}\n\n",
                                f_idx, f_idx
                            )
                        )
                    } else {
                        (
                            String::new(),
                            format!(
                                "#[derive(Debug, Clone, PartialEq, Eq)]\npub struct GenericModule_{};\nimpl GenericModule_{} {{\n    pub fn run(&self) {{\n        let _ = 42;\n    }}\n}}\n\n",
                                f_idx, f_idx
                            )
                        )
                    }
                }
            };

            content.push_str(&trait_def);
            content.push_str(&struct_def);

            files.push((file_rel_path, content));
        }

        (files, violations)
    }

    /// Generates structured Vue SFCs and TypeScript companion composables
    pub fn generate_vue_modules(
        app_dir: &str,
        target_sloc: usize,
        inject_violations: bool,
    ) -> (Vec<(String, String)>, Vec<SeededViolation>) {
        let lines_per_comp = 80;
        let num_comps = (target_sloc / lines_per_comp).max(10);
        let mut files = Vec::with_capacity(num_comps * 2 + 1);
        let mut violations = Vec::new();

        let slices = ["features", "widgets", "pages", "entities", "shared"];
        let mut rng = FastRng::new(0x9922_cafe_babe_7788 ^ (target_sloc as u64));

        // Distribution: 30% Pure (6/20), 25% Mockable (5/20), 30% IntBound (6/20), 10% Flaky (2/20), 5% Poisoned (1/20)
        for idx in 0..num_comps {
            let slice = slices[idx % slices.len()];
            let comp_name = format!("Component_{:03}", idx);
            let vue_file = format!("{}.vue", comp_name);
            let ts_file = format!("use{}.ts", comp_name);
            let rel_vue = format!("{}/src/{}/{}/{}", app_dir, slice, comp_name, vue_file);
            let rel_ts = format!("{}/src/{}/{}/{}", app_dir, slice, comp_name, ts_file);

            let bucket = idx % 20;
            let (mut vue_content, ts_content) = if bucket < 6 {
                // 30% Pure
                (
                    format!(
                        "<template>\n  <div class=\"box\">\n    <h2>{{ label }}</h2>\n    <span>{{ doubled }}</span>\n  </div>\n</template>\n\n<script setup lang=\"ts\">\nimport {{ use{} }} from './use{}';\n\nconst {{ label, doubled }} = use{}();\n</script>\n\n<style scoped>\n.box {{ padding: var(--spacing-md); color: var(--color-text-primary); }}\n</style>\n",
                        comp_name, comp_name, comp_name
                    ),
                    format!(
                        "//! Pure Composable for {}\nimport {{ ref, computed }} from 'vue';\n\nexport function use{}() {{\n  const count = ref(10);\n  const label = 'Pure Metric';\n  const doubled = computed(() => count.value * 2);\n  return {{ count, label, doubled }};\n}}\n",
                        comp_name, comp_name
                    )
                )
            } else if bucket < 11 {
                // 25% Mockable: Explicit interfaces and contracts
                (
                    String::from(
                        "<template>\n  <div class=\"box\">\n    <h2>{{ props.title }}</h2>\n    <button @click=\"emit('click')\">Action</button>\n  </div>\n</template>\n\n<script setup lang=\"ts\">\ninterface Props {\n  title: string;\n}\nconst props = defineProps<Props>();\nconst emit = defineEmits<{ (e: 'click'): void }>();\n</script>\n\n<style scoped>\n.box { padding: var(--spacing-md); color: var(--color-text-primary); }\n</style>\n",
                    ),
                    format!(
                        "//! Mockable Service Contract for {}\nexport interface {}ServicePort {{\n  fetchData(id: number): Promise<string>;\n}}\n\nexport function use{}(port: {}ServicePort) {{\n  const load = (id: number) => port.fetchData(id);\n  return {{ load }};\n}}\n",
                        comp_name, comp_name, comp_name, comp_name
                    )
                )
            } else if bucket < 17 {
                // 30% IntBound: Direct fetch in both .vue and .ts
                (
                    format!(
                        "<template>\n  <div class=\"box\">\n    <h2>Data View</h2>\n    <p>{{ data }}</p>\n  </div>\n</template>\n\n<script setup lang=\"ts\">\nimport {{ use{} }} from './use{}';\n\nconst {{ data }} = use{}();\nconst fetchMore = async () => {{ await fetch('/api/v1/metrics'); }};\n</script>\n\n<style scoped>\n.box {{ padding: var(--spacing-md); color: var(--color-text-primary); }}\n</style>\n",
                        comp_name, comp_name, comp_name
                    ),
                    format!(
                        "//! IntBound Composable for {}\nimport {{ ref }} from 'vue';\n\nexport function use{}() {{\n  const data = ref('');\n  const load = async () => {{\n    const res = await fetch('/api/v1/metrics');\n    data.value = await res.text();\n  }};\n  return {{ data, load }};\n}}\n",
                        comp_name, comp_name
                    )
                )
            } else if bucket < 19 {
                // 10% Flaky: Date.now() / Math.random() in both .vue and .ts
                (
                    format!(
                        "<template>\n  <div class=\"box\">\n    <h2>Flaky View</h2>\n  </div>\n</template>\n\n<script setup lang=\"ts\">\nimport {{ use{} }} from './use{}';\n\nconst {{ curTime }} = use{}();\nconst localTimestamp = Date.now();\n</script>\n\n<style scoped>\n.box {{ padding: var(--spacing-md); color: var(--color-text-primary); }}\n</style>\n",
                        comp_name, comp_name, comp_name
                    ),
                    format!(
                        "//! Flaky Composable for {}\nimport {{ ref }} from 'vue';\n\nexport function use{}() {{\n  const curTime = ref(Date.now());\n  const rand = ref(Math.random());\n  return {{ curTime, rand }};\n}}\n",
                        comp_name, comp_name
                    )
                )
            } else {
                // 5% Poisoned: localStorage / global state in both .vue and .ts
                (
                    format!(
                        "<template>\n  <div class=\"box\">\n    <h2>Poisoned View</h2>\n  </div>\n</template>\n\n<script setup lang=\"ts\">\nimport {{ use{} }} from './use{}';\n\nconst {{ token }} = use{}();\nconst localTok = localStorage.getItem('auth_token');\n</script>\n\n<style scoped>\n.box {{ padding: var(--spacing-md); color: var(--color-text-primary); }}\n</style>\n",
                        comp_name, comp_name, comp_name
                    ),
                    format!(
                        "//! Poisoned Composable for {}\nimport {{ ref }} from 'vue';\n\nexport function use{}() {{\n  const token = ref(localStorage.getItem('auth_token'));\n  return {{ token }};\n}}\n",
                        comp_name, comp_name
                    )
                )
            };

            if inject_violations {
                // VUE-001: Raw business logic functions inside <script setup> (~15% density)
                if rng.chance(15.0) {
                    vue_content = vue_content.replace(
                        "</script>",
                        "function raw_calc() { return 42; }\n</script>",
                    );
                    violations.push(SeededViolation {
                        rule_id: "VUE-001".into(),
                        target_file_suffix: format!("{}/{}/{}", slice, comp_name, vue_file),
                        description: "Raw business logic functions in <script setup>".into(),
                    });
                }

                // CSS-004: Hex color hardcoding (~12% density)
                if rng.chance(12.0) {
                    vue_content = vue_content.replace(
                        "</style>",
                        ".card_error { background: #ef4444; border: 1px solid #000000; }\n</style>",
                    );
                    violations.push(SeededViolation {
                        rule_id: "CSS-004".into(),
                        target_file_suffix: format!("{}/{}/{}", slice, comp_name, vue_file),
                        description: "Hex color hardcoded in <style>".into(),
                    });
                }
            }

            files.push((rel_vue, vue_content));
            files.push((rel_ts, ts_content));
        }

        (files, violations)
    }

    /// Generates legacy Options API monolithic Vue components with realistic legacy distribution
    pub fn generate_vue_legacy_modules(
        app_dir: &str,
        target_sloc: usize,
        inject_violations: bool,
    ) -> (Vec<(String, String)>, Vec<SeededViolation>) {
        let lines_per_comp = 40;
        let num_comps = (target_sloc / lines_per_comp).max(10);
        let mut files = Vec::with_capacity(num_comps + 1);
        let mut violations = Vec::new();

        let mut rng = FastRng::new(0x1337_dead_beef_0042 ^ (target_sloc as u64));

        for idx in 0..num_comps {
            let comp_name = format!("LegacyGodView_{:03}", idx);
            let rel_vue = format!("{}/src/views/{}.vue", app_dir, comp_name);

            // Canonical Distribution: 70% Poisoned (14/20), 10% IntBound (2/20), 15% Flaky (3/20), 5% Pure (1/20)
            let bucket = idx % 20;
            let mut script_body = if bucket < 14 {
                // 70% Poisoned: created lifecycle hook with fetch & localStorage
                String::from(
                    "export default {\n  data() {\n    return {\n      items: [],\n      total: 0,\n      lastSync: new Date(),\n      token: localStorage.getItem('auth_token'),\n    };\n  },\n  created() {\n    fetch('/api/v1/orders').then(r => r.json()).then(d => this.items = d);\n    window.addEventListener('resize', this.onResize);\n  },\n  methods: {\n    onResize() {\n      this.total = window.innerWidth * 2;\n    },\n    calculate_tax(val) {\n      return val * 0.20 + Math.random();\n    },\n    save() {\n      localStorage.setItem('cached_orders', JSON.stringify(this.items));\n    }\n  }\n};\n"
                )
            } else if bucket < 16 {
                // 10% IntBound: Direct fetch in method without created hook or globals
                String::from(
                    "export default {\n  data() {\n    return {\n      items: [],\n    };\n  },\n  methods: {\n    loadData() {\n      fetch('/api/v1/orders').then(r => r.json()).then(d => this.items = d);\n    }\n  }\n};\n"
                )
            } else if bucket < 19 {
                // 15% Flaky: Math.random, Date
                String::from(
                    "export default {\n  props: ['title'],\n  data() {\n    return {\n      count: 0,\n      lastClick: new Date(),\n    };\n  },\n  methods: {\n    increment() {\n      this.count++;\n      this.lastClick = new Date();\n    }\n  }\n};\n"
                )
            } else {
                // 5% Pure: simple presentational template
                String::new()
            };

            let mut style_body = String::from(".god_view { padding: 20px; font-size: 14px; }\n");

            if inject_violations && rng.chance(15.0) {
                if script_body.is_empty() {
                    script_body = String::from("export default {\n  methods: {\n    invokeIpc() {\n      window.__TAURI__.invoke('direct_db_save');\n    }\n  }\n};\n");
                } else {
                    script_body.push_str("window.__TAURI__.invoke('direct_db_save');\n");
                }
                style_body.push_str(".god_error { background: #ff0055; color: #ffffff; }\n");

                violations.push(SeededViolation {
                    rule_id: "TAURI-002".into(),
                    target_file_suffix: format!("{}.vue", comp_name),
                    description: "Direct Tauri IPC in Vue component".into(),
                });
                violations.push(SeededViolation {
                    rule_id: "CSS-004".into(),
                    target_file_suffix: format!("{}.vue", comp_name),
                    description: "Hex color hardcoded in <style>".into(),
                });
            }

            let vue_content = if script_body.is_empty() {
                format!(
                    "<template>\n  <div class=\"god_view\">\n    <h1>Pure Static View {}</h1>\n  </div>\n</template>\n\n<style scoped>\n{}\n</style>\n",
                    idx, style_body
                )
            } else {
                format!(
                    "<template>\n  <div class=\"god_view\">\n    <h1>Legacy God View {}</h1>\n    <ul><li v-for=\"i in items\" :key=\"i\">{{{{ i }}}}</li></ul>\n  </div>\n</template>\n\n<script>\n{}\n</script>\n\n<style scoped>\n{}\n</style>\n",
                    idx, script_body, style_body
                )
            };

            files.push((rel_vue, vue_content));
        }

        (files, violations)
    }
}
