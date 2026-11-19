# 🪐 worldwiki-calendar-wasm — WebAssembly-обёртка для календарного ядра

> **Слой Cerberus**: `core` (`crate-type = ["cdylib", "rlib"]`).  
> **Назначение**: Экспорт математического ядра [`worldwiki-calendar-core`](../worldwiki-calendar-core/README.md) во фронтенд (SPA) через `wasm-bindgen` для высокочастотных расчётов сеток месяцев, конвертации дат, астрономии и аудита без обращений к IPC.

---

## 📦 Зависимости (`Cargo.toml`)

- [`worldwiki-calendar-core`](../worldwiki-calendar-core/README.md) (с фичей `serde`).
- `wasm-bindgen`, `serde`, `serde-wasm-bindgen`.

---

## 🏛️ Структура модулей (`src/`)

| Модуль | Назначение и ключевые методы `WasmCalendarEngine` |
|---|---|
| [`lib.rs`](./src/lib.rs) | Определение `WasmCalendarEngine`: базовые расчёты високосности (`is_leap_year`, `days_in_year`, `days_up_to_year`, `year_from_days`, `validate_harmonics`, `drift_per_century`) и пакетная генерация сетки месяца (`get_month_grid_bundle`). |
| [`types.rs`](./src/types.rs) | WASM DTO-структуры: `WasmCultureConfig`, `WasmWeekdayPauseParams`, `MonthGridParams`, `MonthGridBundle`, `MonthGridDayInfo`, `MoonDayPhase`. |
| [`grid.rs`](./src/grid.rs) | `build_month_grid_bundle` — генерация полной сетки месяца (дни, дни недели с учётом пауз, активные праздники, фазы лун) за один вызов. |
| [`conversions.rs`](./src/conversions.rs) | Перевод `t_abs_to_local_moment`, `local_moment_to_t_abs`, квантование циферблатов (`units_to_day_tick`, `day_tick_to_units`) и конвертация дат. |
| [`astronomy.rs`](./src/astronomy.rs) | `solar_noon_tick`, `solar_zenith_distance_mdeg`, `sunlight_basis_points`, `moon_phase_rational`, расчёты восхода/заката и фаз спутников. |
| [`audit_bridge.rs`](./src/audit_bridge.rs) | `generate_year_preview`, `audit_calendar_culture`, `calculate_linked_anchor_world_day`, `calculate_age`. |
| [`intervals.rs`](./src/intervals.rs) | Consistency Engine: `intervals_overlap`, `check_bilocation`, `check_death_violation`. |
| [`seasons_holidays.rs`](./src/seasons_holidays.rs) | `is_holiday_active`, `is_multi_year_holiday_active`, `calculate_leap_convergents`, `decompose_fraction_to_unit_harmonics`, `is_season_conflicting_with_solstice`. |

---

## 🧪 Тестирование (`tests/`)

Юнит-тесты в [`tests/native_unit.rs`](./tests/native_unit.rs):

```bash
cargo test -p worldwiki-calendar-wasm
```
