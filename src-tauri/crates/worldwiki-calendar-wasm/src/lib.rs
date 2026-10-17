pub mod astronomy;
pub mod audit_bridge;
pub mod conversions;
pub mod grid;
pub mod intervals;
pub mod seasons_holidays;
pub mod types;

pub use types::*;
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub struct WasmCalendarEngine;

#[wasm_bindgen]
impl WasmCalendarEngine {
    #[wasm_bindgen(constructor)]
    pub fn new() -> Self {
        Self
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
        let (year, day_in_year) = year_from_days_o1(cal_day, base_days, &h, leap_day_offset);

        #[derive(serde::Serialize)]
        struct YearResult {
            year: i64,
            day_in_year: i64,
        }

        serde_wasm_bindgen::to_value(&YearResult { year, day_in_year })
            .map_err(|e| JsValue::from_str(&e.to_string()))
    }

    /// Валидация набора гармоник по наименьшему общему кратному LCM
    pub fn validate_harmonics(&self, harmonics: JsValue) -> Result<bool, JsValue> {
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
        Ok(drift_per_century_f64(
            base_days,
            &h,
            target_year_length_days,
        ))
    }

    /// Пакетный метод генерации сетки месяца за 1 вызов (120 FPS)
    pub fn get_month_grid_bundle(&self, params: JsValue) -> Result<JsValue, JsValue> {
        let p: MonthGridParams = serde_wasm_bindgen::from_value(params)
            .map_err(|e| JsValue::from_str(&e.to_string()))?;

        let bundle = grid::build_month_grid_bundle(&p);
        serde_wasm_bindgen::to_value(&bundle).map_err(|e| JsValue::from_str(&e.to_string()))
    }
}

impl Default for WasmCalendarEngine {
    fn default() -> Self {
        Self::new()
    }
}
