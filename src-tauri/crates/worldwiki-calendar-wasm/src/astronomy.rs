use wasm_bindgen::prelude::*;
use worldwiki_calendar_core::*;
use crate::grid;
use crate::WasmCalendarEngine;

#[wasm_bindgen]
impl WasmCalendarEngine {
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

    /// Поиск момента ближайшего Двойного Полнолуния
    pub fn find_next_double_full_moon(
        &self,
        moon1: JsValue,
        moon2: JsValue,
        ticks_per_day: i64,
        start_t_abs: i64,
        max_days_to_search: i64,
    ) -> Result<JsValue, JsValue> {
        let m1: moons::MoonConfig = serde_wasm_bindgen::from_value(moon1)
            .map_err(|e| JsValue::from_str(&e.to_string()))?;
        let m2: moons::MoonConfig = serde_wasm_bindgen::from_value(moon2)
            .map_err(|e| JsValue::from_str(&e.to_string()))?;
        let res = moons::find_next_double_full_moon(&m1, &m2, ticks_per_day, start_t_abs, max_days_to_search);
        serde_wasm_bindgen::to_value(&res).map_err(|e| JsValue::from_str(&e.to_string()))
    }

    /// Пакетный расчет фаз для множества спутников
    pub fn calculate_all_moon_phases(
        &self,
        t_abs: i64,
        ticks_per_day: i64,
        moons: JsValue,
    ) -> Result<JsValue, JsValue> {
        let moon_list: Vec<moons::MoonConfig> = serde_wasm_bindgen::from_value(moons)
            .map_err(|e| JsValue::from_str(&e.to_string()))?;
        let formatted = grid::format_all_moon_phases(t_abs, ticks_per_day, &moon_list);
        serde_wasm_bindgen::to_value(&formatted).map_err(|e| JsValue::from_str(&e.to_string()))
    }
}
