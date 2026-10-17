use wasm_bindgen::prelude::*;
use worldwiki_calendar_core::*;
use crate::types::{WasmCultureConfig, WasmWeekdayPauseParams};
use crate::WasmCalendarEngine;

#[wasm_bindgen]
impl WasmCalendarEngine {
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

    /// Непрерывный расчет дня недели (без пауз)
    pub fn calculate_weekday(
        &self,
        cal_day: i64,
        origin_day: i64,
        start_weekday: usize,
        weekdays_count: usize,
    ) -> usize {
        weekdays::calculate_weekday(cal_day, origin_day, start_weekday, weekdays_count)
    }

    /// Расчет дня недели с учетом паузы (эпагоменов)
    pub fn calculate_weekday_with_pause(
        &self,
        year: i64,
        day_in_year: i64,
        params: JsValue,
    ) -> Result<JsValue, JsValue> {
        let p: WasmWeekdayPauseParams = serde_wasm_bindgen::from_value(params)
            .map_err(|e| JsValue::from_str(&e.to_string()))?;
        let config = weekdays::WeekdayPauseConfig {
            days_in_regular_months: p.days_in_regular_months,
            extra_days_base: p.extra_days_base,
            extra_days_leap: p.extra_days_leap,
            harmonics: &p.harmonics,
            origin_year: p.origin_year,
            origin_day: p.origin_day,
            start_weekday: p.start_weekday,
            weekdays_count: p.weekdays_count,
        };
        let res = weekdays::calculate_weekday_with_pause(year, day_in_year, &config);
        serde_wasm_bindgen::to_value(&res).map_err(|e| JsValue::from_str(&e.to_string()))
    }

    /// Перевод внутреннего индекса месяца в культурный
    pub fn to_cultural_month(&self, internal_m: usize, m_start: usize, total_months: usize) -> usize {
        holidays::to_cultural_month(internal_m, m_start, total_months)
    }

    /// Перевод культурного индекса месяца во внутренний
    pub fn to_internal_month(&self, cultural_m: usize, m_start: usize, total_months: usize) -> usize {
        holidays::to_internal_month(cultural_m, m_start, total_months)
    }

    /// Преобразует календарную дату в абсолютное время t_abs
    pub fn date_to_t_abs(&self, date: JsValue, config: JsValue) -> Result<i64, JsValue> {
        let d: DateCoordinate = serde_wasm_bindgen::from_value(date)
            .map_err(|e| JsValue::from_str(&e.to_string()))?;
        let cfg: WasmCultureConfig = serde_wasm_bindgen::from_value(config)
            .map_err(|e| JsValue::from_str(&e.to_string()))?;
        let core_cfg = cfg.as_core();
        Ok(conversion::date_to_t_abs(&d, &core_cfg))
    }

    /// Преобразует абсолютное время t_abs в календарную дату
    pub fn t_abs_to_date(&self, t_abs: i64, config: JsValue) -> Result<JsValue, JsValue> {
        let cfg: WasmCultureConfig = serde_wasm_bindgen::from_value(config)
            .map_err(|e| JsValue::from_str(&e.to_string()))?;
        let core_cfg = cfg.as_core();
        let date = conversion::t_abs_to_date(t_abs, &core_cfg);
        serde_wasm_bindgen::to_value(&date).map_err(|e| JsValue::from_str(&e.to_string()))
    }
}
