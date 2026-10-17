use wasm_bindgen::prelude::*;
use worldwiki_calendar_core::*;
use crate::WasmCalendarEngine;

#[wasm_bindgen]
impl WasmCalendarEngine {
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
