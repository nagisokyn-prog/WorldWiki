use wasm_bindgen::prelude::*;
use worldwiki_calendar_core::*;
use crate::WasmCalendarEngine;

#[wasm_bindgen]
impl WasmCalendarEngine {
    /// Проверка активности праздника с переходом через границу года
    pub fn is_holiday_active(
        &self,
        curr_m: usize,
        curr_d: i64,
        start_m: usize,
        start_d: i64,
        end_m: usize,
        end_d: i64,
    ) -> bool {
        holidays::is_holiday_active(curr_m, curr_d, start_m, start_d, end_m, end_d)
    }

    /// Проверка активности многолетнего праздника
    pub fn is_multi_year_holiday_active(
        &self,
        curr_y: i64,
        curr_m: usize,
        curr_d: i64,
        holiday: JsValue,
    ) -> Result<bool, JsValue> {
        let h: holidays::CoreHoliday = serde_wasm_bindgen::from_value(holiday)
            .map_err(|e| JsValue::from_str(&e.to_string()))?;
        Ok(holidays::is_multi_year_holiday_active(curr_y, curr_m, curr_d, &h))
    }

    /// Приближение високосных циклов через цепные дроби
    pub fn calculate_leap_convergents(
        &self,
        trop_num: i64,
        trop_den: i64,
        max_convergents: usize,
    ) -> Result<JsValue, JsValue> {
        let convergents = convergents::calculate_leap_convergents(trop_num, trop_den, max_convergents);
        serde_wasm_bindgen::to_value(&convergents).map_err(|e| JsValue::from_str(&e.to_string()))
    }

    /// Разложение рациональной дроби p/q на знаковые единичные гармоники (+1/-1)
    pub fn decompose_fraction_to_unit_harmonics(
        &self,
        p: i64,
        q: i64,
        max_harmonics: usize,
    ) -> Result<JsValue, JsValue> {
        let harmonics = convergents::decompose_fraction_to_unit_harmonics(p, q, max_harmonics);
        serde_wasm_bindgen::to_value(&harmonics).map_err(|e| JsValue::from_str(&e.to_string()))
    }

    /// Климатический детектор конфликта сезона солнцестояния
    pub fn is_season_conflicting_with_solstice(
        &self,
        season_months: Vec<usize>,
        is_summer_season: bool,
        winter_solstice_month: usize,
        total_months: usize,
    ) -> bool {
        seasons::is_season_conflicting_with_solstice(
            &season_months,
            is_summer_season,
            winter_solstice_month,
            total_months,
        )
    }

    /// Климатический детектор конфликта с учетом полушария
    pub fn is_season_conflicting_with_solstice_hemisphere(
        &self,
        season_months: Vec<usize>,
        is_summer_season: bool,
        winter_solstice_month: usize,
        total_months: usize,
        hemisphere: &str,
    ) -> bool {
        let hemi = if hemisphere.eq_ignore_ascii_case("southern") {
            seasons::Hemisphere::Southern
        } else {
            seasons::Hemisphere::Northern
        };
        seasons::is_season_conflicting_with_solstice_hemisphere(
            &season_months,
            is_summer_season,
            winter_solstice_month,
            total_months,
            hemi,
        )
    }
}
