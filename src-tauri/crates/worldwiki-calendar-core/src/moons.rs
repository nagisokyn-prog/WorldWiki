extern crate alloc;

/// Фаза луны (8 классических секторов)
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
#[cfg_attr(feature = "serde", derive(serde::Serialize, serde::Deserialize))]
pub enum MoonPhaseName {
    NewMoon,
    WaxingCrescent,
    FirstQuarter,
    WaxingGibbous,
    FullMoon,
    WaningGibbous,
    LastQuarter,
    WaningCrescent,
}

/// Рациональный расчет фазы луны без плавающей запятой (п. 9.5, 9.6)
///
/// Архитектурный инвариант:
/// Расчет является строго целочисленным (дискретным), исключая недетерминизм f64.
///
/// Параметры:
/// - `t_abs`: абсолютное астрономическое время в тиках
/// - `ticks_per_day`: число тиков в одних сутках планеты
/// - `period_days_num` / `period_days_den`: рациональный синодический период Луны в сутках
/// - `initial_phase_basis_points`: начальная фаза в базисных пунктах 0..10_000 (0 = новолуние, 5000 = полнолуние)
///
/// Границы применимости и точность (п. 9.6):
/// Для Земли синодический месяц равен 29.530588853 сут.
/// При представлении `period_days_num = 29_530_589`, `period_days_den = 1_000_000`:
/// относительная погрешность составляет 4.97e-9 (~0.15 секунды в год),
/// что гарантирует фазовый сдвиг менее чем на 1 день за 500 000 лет.
pub fn moon_phase_rational(
    t_abs: i64,
    ticks_per_day: i64,
    period_days_num: i64,
    period_days_den: i64,
    initial_phase_basis_points: i64,
) -> (i64, MoonPhaseName) {
    if ticks_per_day <= 0 || period_days_num <= 0 || period_days_den <= 0 {
        return (0, MoonPhaseName::NewMoon);
    }

    // Полный период в тиках выражается через дробь:
    // T_cycle = (period_days_num * ticks_per_day) / period_days_den
    let num_ticks = period_days_num as i128 * ticks_per_day as i128;
    let den_ticks = period_days_den as i128;

    // Фазовый сдвиг в масштабе числителя:
    let phase_shift_scaled = (initial_phase_basis_points as i128 * num_ticks) / 10_000;
    let total_scaled = t_abs as i128 * den_ticks + phase_shift_scaled;

    // Остаток по модулю num_ticks (длины цикла):
    let rem = total_scaled.rem_euclid(num_ticks);

    // Доля цикла в базисных пунктах: (rem * 10_000) / num_ticks
    let current_bp = ((rem * 10_000) / num_ticks) as i64;

    let phase_name = match current_bp {
        bp if (0..625).contains(&bp) || (9375..10_000).contains(&bp) => MoonPhaseName::NewMoon,
        bp if (625..1875).contains(&bp) => MoonPhaseName::WaxingCrescent,
        bp if (1875..3125).contains(&bp) => MoonPhaseName::FirstQuarter,
        bp if (3125..4375).contains(&bp) => MoonPhaseName::WaxingGibbous,
        bp if (4375..5625).contains(&bp) => MoonPhaseName::FullMoon,
        bp if (5625..6875).contains(&bp) => MoonPhaseName::WaningGibbous,
        bp if (6875..8125).contains(&bp) => MoonPhaseName::LastQuarter,
        _ => MoonPhaseName::WaningCrescent,
    };

    (current_bp, phase_name)
}

/// Точный расчет фазы Луны при задании начальной фазы в виде рациональной дроби (num / den)
pub fn moon_phase_exact(
    t_abs: i64,
    ticks_per_day: i64,
    period_days_num: i64,
    period_days_den: i64,
    initial_phase_num: i64,
    initial_phase_den: i64,
) -> (i64, MoonPhaseName) {
    let den = if initial_phase_den <= 0 { 1 } else { initial_phase_den };
    let bp = ((initial_phase_num as i128 * 10_000) / den as i128).rem_euclid(10_000) as i64;
    moon_phase_rational(t_abs, ticks_per_day, period_days_num, period_days_den, bp)
}

/// Конфигурация спутника / луны с рациональными параметрами (п. 17.1, 17.2)
#[derive(Debug, Clone, PartialEq, Eq)]
#[cfg_attr(feature = "serde", derive(serde::Serialize, serde::Deserialize))]
pub struct MoonConfig {
    pub name: alloc::string::String,
    pub period_days_num: i64,
    pub period_days_den: i64,
    pub initial_phase_bp: i64, // Базисные пункты: 0..10_000
}

/// Ошибки валидации параметров луны (п. 17.2)
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum MoonValidationError {
    NonPositivePeriod,
    InvalidPhaseBasisPoints,
}

impl MoonConfig {
    pub fn validate(&self) -> Result<(), MoonValidationError> {
        if self.period_days_num <= 0 || self.period_days_den <= 0 {
            return Err(MoonValidationError::NonPositivePeriod);
        }
        if self.initial_phase_bp < 0 || self.initial_phase_bp >= 10_000 {
            return Err(MoonValidationError::InvalidPhaseBasisPoints);
        }
        Ok(())
    }
}

/// Ищет момент ближайшего одновременного полнолуния (Двойного Полнолуния) двух лун
/// с ограничением по числу проверяемых суток (п. 17.3, защита от бесконечного цикла)
pub fn find_next_double_full_moon(
    moon1: &MoonConfig,
    moon2: &MoonConfig,
    ticks_per_day: i64,
    start_t_abs: i64,
    max_days_to_search: i64,
) -> Option<i64> {
    if moon1.validate().is_err() || moon2.validate().is_err() || ticks_per_day <= 0 {
        return None;
    }

    for day in 0..max_days_to_search {
        let t_test = start_t_abs + day * ticks_per_day;
        let (_, phase1) = moon_phase_rational(
            t_test,
            ticks_per_day,
            moon1.period_days_num,
            moon1.period_days_den,
            moon1.initial_phase_bp,
        );
        let (_, phase2) = moon_phase_rational(
            t_test,
            ticks_per_day,
            moon2.period_days_num,
            moon2.period_days_den,
            moon2.initial_phase_bp,
        );

        if phase1 == MoonPhaseName::FullMoon && phase2 == MoonPhaseName::FullMoon {
            return Some(t_test);
        }
    }

    None
}

/// Пакетный расчет фаз для произвольного множества лун (п. 20.4)
/// Эффективен для миров с десятками спутников: 0 аллокаций на вычисление каждой фазы.
pub fn calculate_all_moon_phases(
    t_abs: i64,
    ticks_per_day: i64,
    moons: &[MoonConfig],
) -> alloc::vec::Vec<(i64, MoonPhaseName)> {
    let mut results = alloc::vec::Vec::with_capacity(moons.len());
    for moon in moons {
        let res = moon_phase_rational(
            t_abs,
            ticks_per_day,
            moon.period_days_num,
            moon.period_days_den,
            moon.initial_phase_bp,
        );
        results.push(res);
    }
    results
}
