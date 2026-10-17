use wasm_bindgen::prelude::*;
use worldwiki_calendar_core::*;

#[derive(serde::Deserialize)]
pub struct WasmCultureConfig {
    pub planet_id: String,
    pub ticks_per_day: i64,
    pub day_start_offset: i64,
    pub base_year_days: i64,
    pub regular_months: Vec<i32>,
    pub harmonics: Vec<LeapHarmonic>,
    pub leap_target: LeapTarget,
    pub leap_day_offset: i64,
    pub calendar_origin_day: i64,
    pub dial: DialHierarchy,
    pub eras: Vec<CoreEra>,
}

impl WasmCultureConfig {
    pub fn as_core(&self) -> CalendarCultureConfig {
        CalendarCultureConfig {
            planet_id: &self.planet_id,
            ticks_per_day: self.ticks_per_day,
            day_start_offset: self.day_start_offset,
            base_year_days: self.base_year_days,
            regular_months: &self.regular_months,
            harmonics: &self.harmonics,
            leap_target: self.leap_target,
            leap_day_offset: self.leap_day_offset,
            calendar_origin_day: self.calendar_origin_day,
            dial: &self.dial,
            eras: &self.eras,
        }
    }
}

#[derive(serde::Deserialize)]
pub struct WasmWeekdayPauseParams {
    pub days_in_regular_months: i64,
    pub extra_days_base: i64,
    pub extra_days_leap: i64,
    pub harmonics: Vec<LeapHarmonic>,
    pub origin_year: i64,
    pub origin_day: i64,
    pub start_weekday: usize,
    pub weekdays_count: usize,
}

#[derive(serde::Deserialize)]
pub struct MonthGridParams {
    pub year: i64,
    pub month: usize,
    pub config: WasmCultureConfig,
    pub first_month_of_year: Option<usize>,
    pub pause_config: Option<WasmWeekdayPauseParams>,
    pub start_weekday: Option<usize>,
    pub weekdays_count: Option<usize>,
    pub holidays: Option<Vec<holidays::CoreHoliday>>,
    pub moons: Option<Vec<moons::MoonConfig>>,
}

#[derive(serde::Serialize)]
pub struct MoonDayPhase {
    pub moon_name: String,
    pub basis_points: i64,
    pub phase_name: String,
}

#[derive(serde::Serialize)]
pub struct MonthGridDayInfo {
    pub day: i64,
    pub cal_day: i64,
    pub weekday: Option<usize>,
    pub is_holiday: bool,
    pub holiday_names: Vec<String>,
    pub moon_phases: Vec<MoonDayPhase>,
}

#[derive(serde::Serialize)]
pub struct MonthGridBundle {
    pub year: i64,
    pub month: usize,
    pub days_count: i64,
    pub is_leap_year: bool,
    pub days: Vec<MonthGridDayInfo>,
}

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

    // ==========================================
    // НОВЫЕ МЕТОДЫ ЯДРА (Issue #39)
    // ==========================================

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
        let raw_phases = moons::calculate_all_moon_phases(t_abs, ticks_per_day, &moon_list);

        let formatted: Vec<MoonDayPhase> = raw_phases
            .into_iter()
            .zip(moon_list.iter())
            .map(|((bp, phase_enum), moon)| {
                let p_str = match phase_enum {
                    moons::MoonPhaseName::NewMoon => "new_moon",
                    moons::MoonPhaseName::WaxingCrescent => "waxing_crescent",
                    moons::MoonPhaseName::FirstQuarter => "first_quarter",
                    moons::MoonPhaseName::WaxingGibbous => "waxing_gibbous",
                    moons::MoonPhaseName::FullMoon => "full_moon",
                    moons::MoonPhaseName::WaningGibbous => "waning_gibbous",
                    moons::MoonPhaseName::LastQuarter => "last_quarter",
                    moons::MoonPhaseName::WaningCrescent => "waning_crescent",
                };
                MoonDayPhase {
                    moon_name: moon.name.clone(),
                    basis_points: bp,
                    phase_name: p_str.to_string(),
                }
            })
            .collect();

        serde_wasm_bindgen::to_value(&formatted).map_err(|e| JsValue::from_str(&e.to_string()))
    }

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

    /// Пакетный метод генерации сетки месяца за 1 вызов (120 FPS)
    pub fn get_month_grid_bundle(&self, params: JsValue) -> Result<JsValue, JsValue> {
        let p: MonthGridParams = serde_wasm_bindgen::from_value(params)
            .map_err(|e| JsValue::from_str(&e.to_string()))?;

        let core_cfg = p.config.as_core();
        let first_month = p.first_month_of_year.unwrap_or(0);
        let internal_m = holidays::to_internal_month(p.month, first_month, core_cfg.regular_months.len());

        let days_count = leap::days_in_month(
            p.year,
            internal_m,
            core_cfg.regular_months,
            &core_cfg.leap_target,
            core_cfg.leap_day_offset,
            core_cfg.harmonics,
        );

        let is_leap = leap::is_leap_year(p.year, core_cfg.harmonics) != 0;

        let days_before_year = leap::days_up_to_year(
            p.year,
            core_cfg.base_year_days,
            core_cfg.leap_day_offset,
            core_cfg.harmonics,
        );
        let days_before_month = leap::days_up_to_month(
            p.year,
            internal_m,
            core_cfg.regular_months,
            &core_cfg.leap_target,
            core_cfg.leap_day_offset,
            core_cfg.harmonics,
        );

        let weekdays_cnt = p.weekdays_count.unwrap_or(7);
        let start_wd = p.start_weekday.unwrap_or(0);

        let mut days = Vec::with_capacity(days_count as usize);

        for day_num in 1..=days_count {
            let day_in_year = days_before_month + (day_num - 1);
            let cal_day = days_before_year + day_in_year + core_cfg.calendar_origin_day;

            let weekday = if let Some(ref pause_p) = p.pause_config {
                let pause_cfg = weekdays::WeekdayPauseConfig {
                    days_in_regular_months: pause_p.days_in_regular_months,
                    extra_days_base: pause_p.extra_days_base,
                    extra_days_leap: pause_p.extra_days_leap,
                    harmonics: &pause_p.harmonics,
                    origin_year: pause_p.origin_year,
                    origin_day: pause_p.origin_day,
                    start_weekday: pause_p.start_weekday,
                    weekdays_count: pause_p.weekdays_count,
                };
                weekdays::calculate_weekday_with_pause(p.year, day_in_year, &pause_cfg)
            } else {
                Some(weekdays::calculate_weekday(cal_day, core_cfg.calendar_origin_day, start_wd, weekdays_cnt))
            };

            let mut active_holidays = Vec::new();
            if let Some(ref holidays_list) = p.holidays {
                for hol in holidays_list {
                    if holidays::is_multi_year_holiday_active(p.year, p.month, day_num, hol) {
                        active_holidays.push(hol.name.clone());
                    }
                }
            }

            let mut moon_phases = Vec::new();
            if let Some(ref moons_list) = p.moons {
                let noon_tick = core_cfg.ticks_per_day / 2;
                let moment = LocalMoment {
                    planet_id: p.config.planet_id.clone(),
                    world_day: cal_day,
                    day_tick: noon_tick,
                };
                let day_t_abs = local_moment_to_t_abs(&moment, core_cfg.ticks_per_day, core_cfg.day_start_offset);

                for moon in moons_list {
                    let (bp, phase_enum) = moons::moon_phase_rational(
                        day_t_abs,
                        core_cfg.ticks_per_day,
                        moon.period_days_num,
                        moon.period_days_den,
                        moon.initial_phase_bp,
                    );
                    let p_str = match phase_enum {
                        moons::MoonPhaseName::NewMoon => "new_moon",
                        moons::MoonPhaseName::WaxingCrescent => "waxing_crescent",
                        moons::MoonPhaseName::FirstQuarter => "first_quarter",
                        moons::MoonPhaseName::WaxingGibbous => "waxing_gibbous",
                        moons::MoonPhaseName::FullMoon => "full_moon",
                        moons::MoonPhaseName::WaningGibbous => "waning_gibbous",
                        moons::MoonPhaseName::LastQuarter => "last_quarter",
                        moons::MoonPhaseName::WaningCrescent => "waning_crescent",
                    };
                    moon_phases.push(MoonDayPhase {
                        moon_name: moon.name.clone(),
                        basis_points: bp,
                        phase_name: p_str.to_string(),
                    });
                }
            }

            days.push(MonthGridDayInfo {
                day: day_num,
                cal_day,
                weekday,
                is_holiday: !active_holidays.is_empty(),
                holiday_names: active_holidays,
                moon_phases,
            });
        }

        let bundle = MonthGridBundle {
            year: p.year,
            month: p.month,
            days_count,
            is_leap_year: is_leap,
            days,
        };

        serde_wasm_bindgen::to_value(&bundle).map_err(|e| JsValue::from_string(&e.to_string()))
    }
}

impl Default for WasmCalendarEngine {
    fn default() -> Self {
        Self::new()
    }
}
