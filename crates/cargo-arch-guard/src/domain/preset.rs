#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Preset {
    HexagonalStrict,
    HardenedSandbox,
    Permissive,
}

impl Preset {
    pub fn from_str(name: &str) -> Option<Self> {
        match name.to_lowercase().as_str() {
            "hexagonal-strict" | "hexagonal" => Some(Self::HexagonalStrict),
            "hardened-sandbox" | "sandbox" => Some(Self::HardenedSandbox),
            "permissive" => Some(Self::Permissive),
            _ => None,
        }
    }
}
