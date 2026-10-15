use wasm_bindgen::prelude::*;
use worldwiki_calendar_core::*;

#[wasm_bindgen]
pub struct WasmCalendarEngine;

#[wasm_bindgen]
impl WasmCalendarEngine {
    #[wasm_bindgen(constructor)]
    pub fn new() -> Self {
        Self
    }

    /// Преобразует абсолютное галактическое время t_abs в локальный момент планеты
    pub fn t_abs_to_local_moment(
        &self,
        t_abs: i64,
        planet_id: &str,
        ticks_per_day: i64,
        day_start_offset: i64,
    ) -> Result<JsValue, JsValue> {
        let moment = t_abs_to_local_moment(t_abs, planet_id, ticks_per_day, day_start_offset);
        serde_wasm_bindgen::to_value(&moment).map_err(|e| JsValue::from_str(&e.to_string()))
    }

    /// Преобразует локальный момент планеты обратно в галактическое t_abs
    pub fn local_moment_to_t_abs(
        &self,
        planet_id: &str,
        world_day: i64,
        day_tick: i64,
        ticks_per_day: i64,
        day_start_offset: i64,
    ) -> i64 {
        let moment = LocalMoment {
            planet_id: planet_id.into(),
            world_day,
            day_tick,
        };
        local_moment_to_t_abs(&moment, ticks_per_day, day_start_offset)
    }

    /// Проверяет високосность года по набору гармоник
    pub fn is_leap_year(
        &self,
        year: i64,
        harmonics: JsValue,
        _days_offset: i32,
    ) -> Result<bool, JsValue> {
        let h: Vec<LeapHarmonic> = serde_wasm_bindgen::from_value(harmonics)
            .map_err(|e| JsValue::from_str(&e.to_string()))?;
        Ok(is_leap_year(year, &h) != 0)
    }

    /// Число дней в году
    pub fn days_in_year(
        &self,
        year: i64,
        base_days: i64,
        harmonics: JsValue,
        leap_day_offset: i64,
    ) -> Result<i64, JsValue> {
        let h: Vec<LeapHarmonic> = serde_wasm_bindgen::from_value(harmonics)
            .map_err(|e| JsValue::from_str(&e.to_string()))?;
        Ok(days_in_year(year, base_days, leap_day_offset, &h))
    }

    /// Кумулятивное число дней от начала летоисчисления до начала заданного года
    pub fn days_up_to_year(
        &self,
        year: i64,
        base_days: i64,
        harmonics: JsValue,
        leap_day_offset: i64,
    ) -> Result<i64, JsValue> {
        let h: Vec<LeapHarmonic> = serde_wasm_bindgen::from_value(harmonics)
            .map_err(|e| JsValue::from_str(&e.to_string()))?;
        Ok(days_up_to_year(year, base_days, leap_day_offset, &h))
    }

    /// O(1) обращение порядкового дня календаря в год и день внутри года
    pub fn year_from_days(
        &self,
        cal_day: i64,
        base_days: i64,
        harmonics: JsValue,
        leap_day_offset: i64,
    ) -> Result<JsValue, JsValue> {
        let h: Vec<LeapHarmonic> = serde_wasm_bindgen::from_value(harmonics)
            .map_err(|e| JsValue::from_str(&e.to_string()))?;
        let (year, day_in_year) =
            year_from_days_o1(cal_day, base_days, &h, leap_day_offset);

        #[derive(serde::Serialize)]
        struct YearResult {
            year: i64,
            day_in_year: i64,
        }

        serde_wasm_bindgen::to_value(&YearResult { year, day_in_year })
            .map_err(|e| JsValue::from_str(&e.to_string()))
    }

    /// Валидация набора гармоник по наименьшему общему кратному LCM
    pub fn validate_harmonics(
        &self,
        harmonics: JsValue,
    ) -> Result<bool, JsValue> {
        let h: Vec<LeapHarmonic> = serde_wasm_bindgen::from_value(harmonics)
            .map_err(|e| JsValue::from_str(&e.to_string()))?;
        Ok(validate_harmonics_lcm(&h))
    }

    /// Вековой дрейф календаря относительно истинного года (в сутках за 100 лет)
    pub fn drift_per_century(
        &self,
        base_days: i64,
        harmonics: JsValue,
        target_year_length_days: f64,
    ) -> Result<f64, JsValue> {
        let h: Vec<LeapHarmonic> = serde_wasm_bindgen::from_value(harmonics)
            .map_err(|e| JsValue::from_str(&e.to_string()))?;
        Ok(drift_per_century_f64(base_days, &h, target_year_length_days))
    }

    /// Преобразует показания циферблата (единицы от старшей к младшей) в тик суток (ceil)
    pub fn units_to_day_tick(
        &self,
        unit_values: Vec<i64>,
        subdivisions: Vec<i64>,
        ticks_per_day: i64,
    ) -> i64 {
        let hierarchy = DialHierarchy {
            units: subdivisions
                .into_iter()
                .map(|s| DialUnit {
                    name: String::new(),
                    subdivisions: s,
                })
                .collect(),
        };
        units_to_day_tick(&unit_values, &hierarchy, ticks_per_day)
    }

    /// Преобразует тик суток в показания циферблата (floor)
    pub fn day_tick_to_units(
        &self,
        day_tick: i64,
        subdivisions: Vec<i64>,
        ticks_per_day: i64,
    ) -> Vec<i64> {
        let hierarchy = DialHierarchy {
            units: subdivisions
                .into_iter()
                .map(|s| DialUnit {
                    name: String::new(),
                    subdivisions: s,
                })
                .collect(),
        };
        day_tick_to_units(day_tick, &hierarchy, ticks_per_day)
    }

    /// Позиция истинного полудня (солнечного зенита) в тиках суток
    pub fn solar_noon_tick(
        &self,
        ticks_per_day: i64,
        longitude_mdeg: i64,
        retrograde: bool,
    ) -> i64 {
        solar_noon_tick(ticks_per_day, longitude_mdeg, retrograde)
    }

    /// Угловое расстояние солнца от зенита в миллиградусах [0..180_000]
    pub fn solar_zenith_distance_mdeg(
        &self,
        day_tick: i64,
        ticks_per_day: i64,
        longitude_mdeg: i64,
        retrograde: bool,
    ) -> i64 {
        solar_zenith_distance_mdeg(day_tick, ticks_per_day, longitude_mdeg, retrograde)
    }

    /// Инсоляция в базисных пунктах [0..10_000]
    pub fn sunlight_basis_points(
        &self,
        day_tick: i64,
        ticks_per_day: i64,
        longitude_mdeg: i64,
        retrograde: bool,
    ) -> i64 {
        sunlight_basis_points(day_tick, ticks_per_day, longitude_mdeg, retrograde)
    }

    /// Рациональный расчет лунной фазы
    pub fn moon_phase_rational(
        &self,
        t_abs: i64,
        ticks_per_day: i64,
        period_days_num: i64,
        period_days_den: i64,
        initial_phase_bp: i64,
    ) -> Result<JsValue, JsValue> {
        let (bp, name) = moon_phase_rational(
            t_abs,
            ticks_per_day,
            period_days_num,
            period_days_den,
            initial_phase_bp,
        );

        let phase_str = match name {
            MoonPhaseName::NewMoon => "new_moon",
            MoonPhaseName::WaxingCrescent => "waxing_crescent",
            MoonPhaseName::FirstQuarter => "first_quarter",
            MoonPhaseName::WaxingGibbous => "waxing_gibbous",
            MoonPhaseName::FullMoon => "full_moon",
            MoonPhaseName::WaningGibbous => "waning_gibbous",
            MoonPhaseName::LastQuarter => "last_quarter",
            MoonPhaseName::WaningCrescent => "waning_crescent",
        };

        #[derive(serde::Serialize)]
        struct MoonResult<'a> {
            basis_points: i64,
            phase_name: &'a str,
        }

        serde_wasm_bindgen::to_value(&MoonResult {
            basis_points: bp,
            phase_name: phase_str,
        })
        .map_err(|e| JsValue::from_str(&e.to_string()))
    }

    /// Параметрический расчет возраста персонажа
    pub fn calculate_age(
        &self,
        birth_year: i64,
        birth_month: usize,
        birth_day: i64,
        current_year: i64,
        current_month: usize,
        current_day: i64,
        age_at_birth: i32,
        step_on_new_year: bool,
        year_only: bool,
        max_days_in_birth_month: i64,
    ) -> i32 {
        let rule = AgeRule {
            age_at_birth,
            step_on_new_year,
            year_only,
        };
        calculate_age(
            CalDate::new(birth_year, birth_month, birth_day),
            CalDate::new(current_year, current_month, current_day),
            &rule,
            max_days_in_birth_month,
        )
    }

    /// Проверка пересечения временных интервалов
    pub fn intervals_overlap(&self, s1: i64, e1: i64, s2: i64, e2: i64) -> bool {
        let a = TimeInterval { start: s1, end: e1 };
        let b = TimeInterval { start: s2, end: e2 };
        intervals_overlap(&a, &b)
    }

    /// Проверка конфликта билокации
    pub fn check_bilocation(
        &self,
        s1: i64,
        e1: i64,
        loc1: &str,
        s2: i64,
        e2: i64,
        loc2: &str,
    ) -> bool {
        let a = TimeInterval { start: s1, end: e1 };
        let b = TimeInterval { start: s2, end: e2 };
        check_bilocation(&a, loc1, &b, loc2)
    }

    /// Проверка нарушения смерти
    pub fn check_death_violation(&self, s: i64, e: i64, death_t_abs: i64) -> bool {
        let interval = TimeInterval { start: s, end: e };
        check_death_violation(&interval, death_t_abs)
    }
}
