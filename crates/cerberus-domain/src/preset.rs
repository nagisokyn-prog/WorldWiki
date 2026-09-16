use std::str::FromStr;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Preset {
    HexagonalStrict,
    HardenedSandbox,
    Permissive,
}

impl Preset {
    pub fn from_name(name: &str) -> Option<Self> {
        name.parse().ok()
    }
}

impl FromStr for Preset {
    type Err = ();

    fn from_str(name: &str) -> Result<Self, Self::Err> {
        match name.to_lowercase().as_str() {
            "hexagonal-strict" | "hexagonal" => Ok(Self::HexagonalStrict),
            "hardened-sandbox" | "sandbox" => Ok(Self::HardenedSandbox),
            "permissive" => Ok(Self::Permissive),
            _ => Err(()),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_preset_parsing_happy_path() {
        assert_eq!(Preset::from_name("hexagonal"), Some(Preset::HexagonalStrict));
        assert_eq!(Preset::from_name("HEXAGONAL-STRICT"), Some(Preset::HexagonalStrict));
        assert_eq!(Preset::from_name("sandbox"), Some(Preset::HardenedSandbox));
        assert_eq!(Preset::from_name("permissive"), Some(Preset::Permissive));
    }

    #[test]
    fn test_preset_parsing_unknown_returns_none() {
        assert_eq!(Preset::from_name("unknown-preset"), None);
        assert_eq!(Preset::from_name(""), None);
    }
}


