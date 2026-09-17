use serde::{Deserialize, Serialize};
use super::layer::LayerContext;

/// Фактор архитектурного сопротивления тестированию (Test Friction Factor)
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum TestabilityFactor {
    /// F-01: Скрытый недетерминированный I/O (SystemTime, Instant, rand, Uuid::new_v4)
    F01HiddenAmbientIo,
    /// F-02: Прямой доступ к FS / OS / Сети (std::fs, tokio::fs, reqwest)
    F02DirectOsFsAccess,
    /// F-03: Разделяемое глобальное изменяемое состояние (static mut, OnceLock<Mutex>)
    F03SharedGlobalMutableState,
    /// F-04: Конструктор с побочными эффектами (I/O в fn new() / Default::default())
    F04SideEffectingConstructor,
    /// F-05: Тяжелое многострочное анонимное замыкание (> 3 строк в комбинаторе)
    F05HeavyMultiLineClosure,
    /// F-06: Жесткое связывание с конкретными структурами инфраструктуры в сигнатуре
    F06ConcreteCouplingInBoundary,
    /// CONC-002: Неуправляемая фоновая асинхронная задача (tokio::spawn без отмены)
    Conc002OrphanConcurrency,
}

impl TestabilityFactor {
    #[must_use]
    pub const fn code(&self) -> &'static str {
        match self {
            Self::F01HiddenAmbientIo => "F-01",
            Self::F02DirectOsFsAccess => "F-02",
            Self::F03SharedGlobalMutableState => "F-03",
            Self::F04SideEffectingConstructor => "F-04",
            Self::F05HeavyMultiLineClosure => "F-05",
            Self::F06ConcreteCouplingInBoundary => "F-06",
            Self::Conc002OrphanConcurrency => "CONC-002",
        }
    }

    #[must_use]
    pub const fn name(&self) -> &'static str {
        match self {
            Self::F01HiddenAmbientIo => "Hidden Ambient I/O",
            Self::F02DirectOsFsAccess => "Direct OS / FS Access",
            Self::F03SharedGlobalMutableState => "Shared Global Mutable State",
            Self::F04SideEffectingConstructor => "Side-Effecting Constructor",
            Self::F05HeavyMultiLineClosure => "Heavy Multi-Line Closure",
            Self::F06ConcreteCouplingInBoundary => "Concrete Coupling in Boundary",
            Self::Conc002OrphanConcurrency => "Orphan Concurrency",
        }
    }

    #[must_use]
    pub const fn description(&self) -> &'static str {
        match self {
            Self::F01HiddenAmbientIo => "Использование системного времени, генераторов случайных чисел или UUID без инверсии управления через порты",
            Self::F02DirectOsFsAccess => "Прямой вызов файловой системы или сети без абстракции через порт",
            Self::F03SharedGlobalMutableState => "Глобальные мутабельные переменные или синглтоны с внутренней блокировкой",
            Self::F04SideEffectingConstructor => "Конструктор `new()` или `default()` выполняет сетевые/дисковые операции или IPC",
            Self::F05HeavyMultiLineClosure => "Сложное многострочное анонимное замыкание внутри .map_err/.unwrap_or_else",
            Self::F06ConcreteCouplingInBoundary => "Публичный интерфейс завязан на конкретные типы инфраструктуры вместо трейтов",
            Self::Conc002OrphanConcurrency => "tokio::spawn без сохранения JoinHandle или передачи CancellationToken",
        }
    }

    #[must_use]
    pub fn base_weight(&self, layer: LayerContext) -> f64 {
        match (self, layer) {
            (Self::F01HiddenAmbientIo, LayerContext::Domain) => 25.0,
            (Self::F01HiddenAmbientIo, LayerContext::Application) => 15.0,
            (Self::F01HiddenAmbientIo, _) => 5.0,

            (Self::F02DirectOsFsAccess, LayerContext::Domain) => 35.0,
            (Self::F02DirectOsFsAccess, LayerContext::Application) => 20.0,
            (Self::F02DirectOsFsAccess, _) => 0.0,

            (Self::F03SharedGlobalMutableState, LayerContext::Domain) => 60.0,
            (Self::F03SharedGlobalMutableState, LayerContext::Application) => 45.0,
            (Self::F03SharedGlobalMutableState, _) => 30.0,

            (Self::F04SideEffectingConstructor, LayerContext::Domain) => 30.0,
            (Self::F04SideEffectingConstructor, LayerContext::Application) => 20.0,
            (Self::F04SideEffectingConstructor, _) => 10.0,

            (Self::F05HeavyMultiLineClosure, LayerContext::Domain) => 15.0,
            (Self::F05HeavyMultiLineClosure, LayerContext::Application) => 10.0,
            (Self::F05HeavyMultiLineClosure, _) => 5.0,

            (Self::F06ConcreteCouplingInBoundary, LayerContext::Domain) => 25.0,
            (Self::F06ConcreteCouplingInBoundary, LayerContext::Application) => 20.0,
            (Self::F06ConcreteCouplingInBoundary, _) => 5.0,

            (Self::Conc002OrphanConcurrency, LayerContext::Domain) => 30.0,
            (Self::Conc002OrphanConcurrency, LayerContext::Application) => 20.0,
            (Self::Conc002OrphanConcurrency, _) => 15.0,
        }
    }

    #[must_use]
    pub const fn unit_ratio(&self) -> f64 {
        match self {
            Self::F01HiddenAmbientIo => 1.0,
            Self::F02DirectOsFsAccess => 1.0,
            Self::F03SharedGlobalMutableState => 1.0,
            Self::F04SideEffectingConstructor => 0.9,
            Self::F05HeavyMultiLineClosure => 0.8,
            Self::F06ConcreteCouplingInBoundary => 0.9,
            Self::Conc002OrphanConcurrency => 0.8,
        }
    }

    #[must_use]
    pub const fn integration_ratio(&self) -> f64 {
        match self {
            Self::F01HiddenAmbientIo => 0.2,
            Self::F02DirectOsFsAccess => 0.1,
            Self::F03SharedGlobalMutableState => 1.0,
            Self::F04SideEffectingConstructor => 0.4,
            Self::F05HeavyMultiLineClosure => 0.1,
            Self::F06ConcreteCouplingInBoundary => 0.2,
            Self::Conc002OrphanConcurrency => 0.9,
        }
    }
}
