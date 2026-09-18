use serde::{Deserialize, Serialize};
use super::score::TestabilityTier;

/// Пять дискретных инженерных архетипов тестируемости файла
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum TestabilityArchetype {
    /// Pure: 100% чистый детерминизм, 0 I/O, 0 времени, 0 синглтонов
    Pure,
    /// Mockable: Бизнес-логика с инверсией зависимостей через трейты/порты
    Mockable,
    /// IntBound: Прямой I/O / FS / DB без мутабельного глобального состояния
    IntBound,
    /// Flaky: Источник недетерминизма (таймеры, random, tokio::spawn, атомики, unwrap)
    Flaky,
    /// Poisoned: Нетестируемый архитектурный блокер (static mut, I/O в new, Domain I/O)
    Poisoned,
}

impl TestabilityArchetype {
    #[must_use]
    pub const fn code(&self) -> &'static str {
        match self {
            Self::Pure => "PURE",
            Self::Mockable => "MOCKABLE",
            Self::IntBound => "INT_BOUND",
            Self::Flaky => "FLAKY",
            Self::Poisoned => "POISONED",
        }
    }

    #[must_use]
    pub const fn name(&self) -> &'static str {
        match self {
            Self::Pure => "Pure Deterministic Unit",
            Self::Mockable => "Inverted / Mockable Unit",
            Self::IntBound => "Integration Bound",
            Self::Flaky => "Flaky / Concurrency Hazard",
            Self::Poisoned => "Poisoned God / Architectural Blocker",
        }
    }

    #[must_use]
    pub const fn t_unit(&self) -> f64 {
        match self {
            Self::Pure => 100.0,
            Self::Mockable => 85.0,
            Self::IntBound => 25.0,
            Self::Flaky => 15.0,
            Self::Poisoned => 5.0,
        }
    }

    #[must_use]
    pub const fn t_int(&self) -> f64 {
        match self {
            Self::Pure => 100.0,
            Self::Mockable => 90.0,
            Self::IntBound => 85.0,
            Self::Flaky => 35.0,
            Self::Poisoned => 15.0,
        }
    }

    #[must_use]
    pub const fn ti_file(&self) -> f64 {
        match self {
            Self::Pure => 100.0,
            Self::Mockable => 86.5,
            Self::IntBound => 43.0,
            Self::Flaky => 21.0,
            Self::Poisoned => 8.0,
        }
    }

    #[must_use]
    pub const fn ti(&self) -> f64 {
        self.ti_file()
    }

    #[must_use]
    pub const fn tier(&self) -> TestabilityTier {
        match self {
            Self::Pure => TestabilityTier::S,
            Self::Mockable => TestabilityTier::A,
            Self::IntBound => TestabilityTier::D,
            Self::Flaky => TestabilityTier::F,
            Self::Poisoned => TestabilityTier::F,
        }
    }

    #[must_use]
    pub const fn rank(&self) -> u8 {
        match self {
            Self::Pure => 0,
            Self::Mockable => 1,
            Self::IntBound => 2,
            Self::Flaky => 3,
            Self::Poisoned => 4,
        }
    }

    /// Строгий приоритет доминирования худшего:
    /// Poisoned > Flaky > IntBound > Mockable > Pure
    #[must_use]
    pub const fn combine(self, other: Self) -> Self {
        if self.rank() >= other.rank() {
            self
        } else {
            other
        }
    }

    #[must_use]
    pub const fn dominance_combine(self, other: Self) -> Self {
        self.combine(other)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_all_archetype_properties_and_dominance() {
        let archetypes = [
            TestabilityArchetype::Pure,
            TestabilityArchetype::Mockable,
            TestabilityArchetype::IntBound,
            TestabilityArchetype::Flaky,
            TestabilityArchetype::Poisoned,
        ];

        for a in archetypes {
            assert!(!a.code().is_empty());
            assert!(!a.name().is_empty());
            assert!(a.t_unit() >= 0.0 && a.t_unit() <= 100.0);
            assert!(a.t_int() >= 0.0 && a.t_int() <= 100.0);
            assert!(a.ti_file() >= 0.0 && a.ti_file() <= 100.0);
            assert_eq!(a.ti(), a.ti_file());
            let _tier = a.tier();
            assert_eq!(a.dominance_combine(a), a);
        }

        assert_eq!(
            TestabilityArchetype::Pure.combine(TestabilityArchetype::Poisoned),
            TestabilityArchetype::Poisoned
        );
        assert_eq!(
            TestabilityArchetype::Mockable.combine(TestabilityArchetype::Flaky),
            TestabilityArchetype::Flaky
        );
        assert_eq!(
            TestabilityArchetype::IntBound.combine(TestabilityArchetype::Mockable),
            TestabilityArchetype::IntBound
        );
    }
}
