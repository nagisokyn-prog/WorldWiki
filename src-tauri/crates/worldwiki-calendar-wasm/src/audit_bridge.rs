use wasm_bindgen::prelude::*;
use worldwiki_calendar_core::*;
use crate::types::WasmCultureConfig;
use crate::WasmCalendarEngine;

#[wasm_bindgen]
impl WasmCalendarEngine {
    /// Генерация предпросмотра структуры года
    pub fn generate_year_preview(
        &self,
        year: i64,
        config: JsValue,
        first_month_of_year: usize,
    ) -> Result<JsValue, JsValue> {
        let cfg: WasmCultureConfig = serde_wasm_bindgen::from_value(config)
            .map_err(|e| JsValue::from_str(&e.to_string()))?;
        let core_cfg = cfg.as_core();
        let preview = audit::generate_year_preview(year, &core_cfg, first_month_of_year);
        serde_wasm_bindgen::to_value(&preview).map_err(|e| JsValue::from_str(&e.to_string()))
    }

    /// Комплексный аудит культуры календаря
    pub fn audit_calendar_culture(
        &self,
        config: JsValue,
        tropical_year_num: i64,
        tropical_year_den: i64,
    ) -> Result<JsValue, JsValue> {
        let cfg: WasmCultureConfig = serde_wasm_bindgen::from_value(config)
            .map_err(|e| JsValue::from_str(&e.to_string()))?;
        let core_cfg = cfg.as_core();
        let report = audit::audit_calendar_culture(&core_cfg, tropical_year_num, tropical_year_den);
        serde_wasm_bindgen::to_value(&report).map_err(|e| JsValue::from_str(&e.to_string()))
    }

    /// Расчет anchor_world_day для сопряжения календарей
    pub fn calculate_linked_anchor_world_day(
        &self,
        master_date: JsValue,
        master_config: JsValue,
        local_date: JsValue,
        local_config: JsValue,
    ) -> Result<i64, JsValue> {
        let m_date: DateCoordinate = serde_wasm_bindgen::from_value(master_date)
            .map_err(|e| JsValue::from_str(&e.to_string()))?;
        let m_cfg: WasmCultureConfig = serde_wasm_bindgen::from_value(master_config)
            .map_err(|e| JsValue::from_str(&e.to_string()))?;
        let l_date: DateCoordinate = serde_wasm_bindgen::from_value(local_date)
            .map_err(|e| JsValue::from_str(&e.to_string()))?;
        let l_cfg: WasmCultureConfig = serde_wasm_bindgen::from_value(local_config)
            .map_err(|e| JsValue::from_str(&e.to_string()))?;

        let m_core = m_cfg.as_core();
        let l_core = l_cfg.as_core();
        Ok(sync::calculate_linked_anchor_world_day(&m_date, &m_core, &l_date, &l_core))
    }

    /// Параметрический расчет возраста персонажа
    pub fn calculate_age(&self, params: JsValue) -> Result<i32, JsValue> {
        #[derive(serde::Deserialize)]
        struct WasmAgeParams {
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
        }

        let p: WasmAgeParams = serde_wasm_bindgen::from_value(params)
            .map_err(|e| JsValue::from_str(&e.to_string()))?;
        let rule = AgeRule {
            age_at_birth: p.age_at_birth,
            step_on_new_year: p.step_on_new_year,
            year_only: p.year_only,
        };
        Ok(calculate_age(
            CalDate::new(p.birth_year, p.birth_month, p.birth_day),
            CalDate::new(p.current_year, p.current_month, p.current_day),
            &rule,
            p.max_days_in_birth_month,
        ))
    }
}
