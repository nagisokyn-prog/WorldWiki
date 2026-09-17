use crate::domain::score::TestabilityTier;

/// Описание синтетического эталона калибровки
#[derive(Debug, Clone, Copy)]
pub struct SyntheticAnchor {
    pub id: usize,
    pub name: &'static str,
    pub expected_tier: TestabilityTier,
    pub target_score_range: (f64, f64),
    pub source_code: &'static str,
}

pub const ANCHOR_0_PURE: SyntheticAnchor = SyntheticAnchor {
    id: 0,
    name: "Anchor 0: Pure Domain Arithmetic",
    expected_tier: TestabilityTier::S,
    target_score_range: (100.0, 100.0),
    source_code: r#"
pub fn add(a: i32, b: i32) -> i32 {
    a + b
}

pub fn calculate_tax(base: f64, rate: f64) -> Result<f64, String> {
    if rate < 0.0 || rate > 1.0 {
        return Err("Invalid tax rate".to_string());
    }
    Ok(base * rate)
}
"#,
};

pub const ANCHOR_1_DI_PORTS: SyntheticAnchor = SyntheticAnchor {
    id: 1,
    name: "Anchor 1: Hexagonal Ports & Inversion of Control",
    expected_tier: TestabilityTier::S,
    target_score_range: (95.0, 100.0),
    source_code: r#"
pub trait ClockPort {
    fn now_millis(&self) -> u64;
}

pub trait OrderRepositoryPort {
    fn save(&self, id: &str, amount: f64) -> Result<(), String>;
}

pub fn process_order(
    order_id: &str,
    amount: f64,
    clock: &dyn ClockPort,
    repo: &dyn OrderRepositoryPort,
) -> Result<u64, String> {
    let timestamp = clock.now_millis();
    repo.save(order_id, amount)?;
    Ok(timestamp)
}
"#,
};

pub const ANCHOR_2_NAMED_MAP: SyntheticAnchor = SyntheticAnchor {
    id: 2,
    name: "Anchor 2: Clean Named Error Mapping",
    expected_tier: TestabilityTier::S,
    target_score_range: (95.0, 100.0),
    source_code: r#"
pub trait StoragePort {
    fn read(&self, path: &str) -> Result<Vec<u8>, std::io::Error>;
}

pub fn load_profile(path: &str, storage: &dyn StoragePort) -> Result<Vec<u8>, String> {
    storage.read(path).map_err(|e| e.to_string())
}
"#,
};

pub const ANCHOR_3_THICK_LAMBDA: SyntheticAnchor = SyntheticAnchor {
    id: 3,
    name: "Anchor 3: Thick Multi-Line Closure in Pipeline",
    expected_tier: TestabilityTier::S,
    target_score_range: (85.0, 98.0),
    source_code: r#"
pub trait StoragePort {
    fn read(&self, path: &str) -> Result<Vec<u8>, std::io::Error>;
}

pub fn load_profile(path: &str, storage: &dyn StoragePort) -> Result<Vec<u8>, String> {
    storage.read(path).map_err(|e| {
        let msg = format!("Storage failure at {}: {:?}", path, e);
        let timestamp = "2026-09-17";
        format!("[{}] {}", timestamp, msg)
    })
}
"#,
};

pub const ANCHOR_4_SIDE_EFFECT_CTOR: SyntheticAnchor = SyntheticAnchor {
    id: 4,
    name: "Anchor 4: Side-Effecting Constructor with Direct I/O",
    expected_tier: TestabilityTier::B,
    target_score_range: (65.0, 80.0),
    source_code: r#"
pub struct DatabaseConnection;
impl DatabaseConnection {
    pub fn connect(_url: &str) -> Result<Self, String> {
        Ok(Self)
    }
}

pub struct Service {
    pub db: DatabaseConnection,
}

impl Service {
    pub fn new() -> Self {
        let db = DatabaseConnection::connect("surrealdb://localhost:8000").unwrap();
        Self { db }
    }
}
"#,
};

pub const ANCHOR_5_GLOBAL_STATE: SyntheticAnchor = SyntheticAnchor {
    id: 5,
    name: "Anchor 5: Shared Global Mutable State",
    expected_tier: TestabilityTier::C,
    target_score_range: (50.0, 68.0),
    source_code: r#"
use std::collections::HashMap;

static mut GLOBAL_CACHE: Option<HashMap<String, Vec<u8>>> = None;

pub fn fetch_cached(key: &str) -> Option<Vec<u8>> {
    unsafe {
        GLOBAL_CACHE.as_ref()?.get(key).cloned()
    }
}
"#,
};

pub const ANCHOR_6_FULL_CHAOS: SyntheticAnchor = SyntheticAnchor {
    id: 6,
    name: "Anchor 6: Full Architectural Chaos",
    expected_tier: TestabilityTier::F,
    target_score_range: (0.0, 20.0),
    source_code: r#"
use std::collections::HashMap;

static mut RUNTIME_STATE: Option<Vec<String>> = None;

pub struct GodService;

impl GodService {
    pub fn new() -> Self {
        let _ = std::fs::write("/tmp/log.txt", "started");
        let _now = std::time::SystemTime::now();
        let _id = uuid::Uuid::new_v4();
        tokio::spawn(async {
            loop {
                tokio::time::sleep(tokio::time::Duration::from_secs(1)).await;
            }
        });
        Self
    }
}
"#,
};

pub const ALL_ANCHORS: &[SyntheticAnchor] = &[
    ANCHOR_0_PURE,
    ANCHOR_1_DI_PORTS,
    ANCHOR_2_NAMED_MAP,
    ANCHOR_3_THICK_LAMBDA,
    ANCHOR_4_SIDE_EFFECT_CTOR,
    ANCHOR_5_GLOBAL_STATE,
    ANCHOR_6_FULL_CHAOS,
];
