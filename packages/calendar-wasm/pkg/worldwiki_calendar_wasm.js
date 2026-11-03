/* @ts-self-types="./worldwiki_calendar_wasm.d.ts" */

export class WasmCalendarEngine {
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        WasmCalendarEngineFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_wasmcalendarengine_free(ptr, 0);
    }
    /**
     * Комплексный аудит культуры календаря
     * @param {any} config
     * @param {bigint} tropical_year_num
     * @param {bigint} tropical_year_den
     * @returns {any}
     */
    audit_calendar_culture(config, tropical_year_num, tropical_year_den) {
        const ret = wasm.wasmcalendarengine_audit_calendar_culture(this.__wbg_ptr, config, tropical_year_num, tropical_year_den);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return takeFromExternrefTable0(ret[0]);
    }
    /**
     * Параметрический расчет возраста персонажа
     * @param {any} params
     * @returns {number}
     */
    calculate_age(params) {
        const ret = wasm.wasmcalendarengine_calculate_age(this.__wbg_ptr, params);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return ret[0];
    }
    /**
     * Пакетный расчет фаз для множества спутников
     * @param {bigint} t_abs
     * @param {bigint} ticks_per_day
     * @param {any} moons
     * @returns {any}
     */
    calculate_all_moon_phases(t_abs, ticks_per_day, moons) {
        const ret = wasm.wasmcalendarengine_calculate_all_moon_phases(this.__wbg_ptr, t_abs, ticks_per_day, moons);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return takeFromExternrefTable0(ret[0]);
    }
    /**
     * Приближение високосных циклов через цепные дроби
     * @param {bigint} trop_num
     * @param {bigint} trop_den
     * @param {number} max_convergents
     * @returns {any}
     */
    calculate_leap_convergents(trop_num, trop_den, max_convergents) {
        const ret = wasm.wasmcalendarengine_calculate_leap_convergents(this.__wbg_ptr, trop_num, trop_den, max_convergents);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return takeFromExternrefTable0(ret[0]);
    }
    /**
     * Расчет anchor_world_day для сопряжения календарей
     * @param {any} master_date
     * @param {any} master_config
     * @param {any} local_date
     * @param {any} local_config
     * @returns {bigint}
     */
    calculate_linked_anchor_world_day(master_date, master_config, local_date, local_config) {
        const ret = wasm.wasmcalendarengine_calculate_linked_anchor_world_day(this.__wbg_ptr, master_date, master_config, local_date, local_config);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return ret[0];
    }
    /**
     * Непрерывный расчет дня недели (без пауз)
     * @param {bigint} cal_day
     * @param {bigint} origin_day
     * @param {number} start_weekday
     * @param {number} weekdays_count
     * @returns {number}
     */
    calculate_weekday(cal_day, origin_day, start_weekday, weekdays_count) {
        const ret = wasm.wasmcalendarengine_calculate_weekday(this.__wbg_ptr, cal_day, origin_day, start_weekday, weekdays_count);
        return ret >>> 0;
    }
    /**
     * Расчет дня недели с учетом паузы (эпагоменов)
     * @param {bigint} year
     * @param {bigint} day_in_year
     * @param {any} params
     * @returns {any}
     */
    calculate_weekday_with_pause(year, day_in_year, params) {
        const ret = wasm.wasmcalendarengine_calculate_weekday_with_pause(this.__wbg_ptr, year, day_in_year, params);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return takeFromExternrefTable0(ret[0]);
    }
    /**
     * Проверка конфликта билокации
     * @param {bigint} s1
     * @param {bigint} e1
     * @param {string} loc1
     * @param {bigint} s2
     * @param {bigint} e2
     * @param {string} loc2
     * @returns {boolean}
     */
    check_bilocation(s1, e1, loc1, s2, e2, loc2) {
        const ptr0 = passStringToWasm0(loc1, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ptr1 = passStringToWasm0(loc2, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len1 = WASM_VECTOR_LEN;
        const ret = wasm.wasmcalendarengine_check_bilocation(this.__wbg_ptr, s1, e1, ptr0, len0, s2, e2, ptr1, len1);
        return ret !== 0;
    }
    /**
     * Проверка нарушения смерти
     * @param {bigint} s
     * @param {bigint} e
     * @param {bigint} death_t_abs
     * @returns {boolean}
     */
    check_death_violation(s, e, death_t_abs) {
        const ret = wasm.wasmcalendarengine_check_death_violation(this.__wbg_ptr, s, e, death_t_abs);
        return ret !== 0;
    }
    /**
     * Преобразует календарную дату в абсолютное время t_abs
     * @param {any} date
     * @param {any} config
     * @returns {bigint}
     */
    date_to_t_abs(date, config) {
        const ret = wasm.wasmcalendarengine_date_to_t_abs(this.__wbg_ptr, date, config);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return ret[0];
    }
    /**
     * Преобразует тик суток в показания циферблата (floor)
     * @param {bigint} day_tick
     * @param {BigInt64Array} subdivisions
     * @param {bigint} ticks_per_day
     * @returns {BigInt64Array}
     */
    day_tick_to_units(day_tick, subdivisions, ticks_per_day) {
        const ptr0 = passArray64ToWasm0(subdivisions, wasm.__wbindgen_malloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.wasmcalendarengine_day_tick_to_units(this.__wbg_ptr, day_tick, ptr0, len0, ticks_per_day);
        var v2 = getArrayI64FromWasm0(ret[0], ret[1]).slice();
        wasm.__wbindgen_free(ret[0], ret[1] * 8, 8);
        return v2;
    }
    /**
     * Число дней в году
     * @param {bigint} year
     * @param {bigint} base_days
     * @param {any} harmonics
     * @param {bigint} leap_day_offset
     * @returns {bigint}
     */
    days_in_year(year, base_days, harmonics, leap_day_offset) {
        const ret = wasm.wasmcalendarengine_days_in_year(this.__wbg_ptr, year, base_days, harmonics, leap_day_offset);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return ret[0];
    }
    /**
     * Кумулятивное число дней от начала летоисчисления до начала заданного года
     * @param {bigint} year
     * @param {bigint} base_days
     * @param {any} harmonics
     * @param {bigint} leap_day_offset
     * @returns {bigint}
     */
    days_up_to_year(year, base_days, harmonics, leap_day_offset) {
        const ret = wasm.wasmcalendarengine_days_up_to_year(this.__wbg_ptr, year, base_days, harmonics, leap_day_offset);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return ret[0];
    }
    /**
     * Разложение рациональной дроби p/q на знаковые единичные гармоники (+1/-1)
     * @param {bigint} p
     * @param {bigint} q
     * @param {number} max_harmonics
     * @returns {any}
     */
    decompose_fraction_to_unit_harmonics(p, q, max_harmonics) {
        const ret = wasm.wasmcalendarengine_decompose_fraction_to_unit_harmonics(this.__wbg_ptr, p, q, max_harmonics);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return takeFromExternrefTable0(ret[0]);
    }
    /**
     * Вековой дрейф календаря относительно истинного года (в сутках за 100 лет)
     * @param {bigint} base_days
     * @param {any} harmonics
     * @param {number} target_year_length_days
     * @returns {number}
     */
    drift_per_century(base_days, harmonics, target_year_length_days) {
        const ret = wasm.wasmcalendarengine_drift_per_century(this.__wbg_ptr, base_days, harmonics, target_year_length_days);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return ret[0];
    }
    /**
     * Поиск момента ближайшего Двойного Полнолуния
     * @param {any} moon1
     * @param {any} moon2
     * @param {bigint} ticks_per_day
     * @param {bigint} start_t_abs
     * @param {bigint} max_days_to_search
     * @returns {any}
     */
    find_next_double_full_moon(moon1, moon2, ticks_per_day, start_t_abs, max_days_to_search) {
        const ret = wasm.wasmcalendarengine_find_next_double_full_moon(this.__wbg_ptr, moon1, moon2, ticks_per_day, start_t_abs, max_days_to_search);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return takeFromExternrefTable0(ret[0]);
    }
    /**
     * Генерация предпросмотра структуры года
     * @param {bigint} year
     * @param {any} config
     * @param {number} first_month_of_year
     * @returns {any}
     */
    generate_year_preview(year, config, first_month_of_year) {
        const ret = wasm.wasmcalendarengine_generate_year_preview(this.__wbg_ptr, year, config, first_month_of_year);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return takeFromExternrefTable0(ret[0]);
    }
    /**
     * Пакетный метод генерации сетки месяца за 1 вызов (120 FPS)
     * @param {any} params
     * @returns {any}
     */
    get_month_grid_bundle(params) {
        const ret = wasm.wasmcalendarengine_get_month_grid_bundle(this.__wbg_ptr, params);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return takeFromExternrefTable0(ret[0]);
    }
    /**
     * Проверка пересечения временных интервалов
     * @param {bigint} s1
     * @param {bigint} e1
     * @param {bigint} s2
     * @param {bigint} e2
     * @returns {boolean}
     */
    intervals_overlap(s1, e1, s2, e2) {
        const ret = wasm.wasmcalendarengine_intervals_overlap(this.__wbg_ptr, s1, e1, s2, e2);
        return ret !== 0;
    }
    /**
     * Проверка активности праздника с переходом через границу года
     * @param {number} curr_m
     * @param {bigint} curr_d
     * @param {number} start_m
     * @param {bigint} start_d
     * @param {number} end_m
     * @param {bigint} end_d
     * @returns {boolean}
     */
    is_holiday_active(curr_m, curr_d, start_m, start_d, end_m, end_d) {
        const ret = wasm.wasmcalendarengine_is_holiday_active(this.__wbg_ptr, curr_m, curr_d, start_m, start_d, end_m, end_d);
        return ret !== 0;
    }
    /**
     * Проверяет високосность года по набору гармоник
     * @param {bigint} year
     * @param {any} harmonics
     * @param {number} _days_offset
     * @returns {boolean}
     */
    is_leap_year(year, harmonics, _days_offset) {
        const ret = wasm.wasmcalendarengine_is_leap_year(this.__wbg_ptr, year, harmonics, _days_offset);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return ret[0] !== 0;
    }
    /**
     * Проверка активности многолетнего праздника
     * @param {bigint} curr_y
     * @param {number} curr_m
     * @param {bigint} curr_d
     * @param {any} holiday
     * @returns {boolean}
     */
    is_multi_year_holiday_active(curr_y, curr_m, curr_d, holiday) {
        const ret = wasm.wasmcalendarengine_is_multi_year_holiday_active(this.__wbg_ptr, curr_y, curr_m, curr_d, holiday);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return ret[0] !== 0;
    }
    /**
     * Климатический детектор конфликта сезона солнцестояния
     * @param {Uint32Array} season_months
     * @param {boolean} is_summer_season
     * @param {number} winter_solstice_month
     * @param {number} total_months
     * @returns {boolean}
     */
    is_season_conflicting_with_solstice(season_months, is_summer_season, winter_solstice_month, total_months) {
        const ptr0 = passArray32ToWasm0(season_months, wasm.__wbindgen_malloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.wasmcalendarengine_is_season_conflicting_with_solstice(this.__wbg_ptr, ptr0, len0, is_summer_season, winter_solstice_month, total_months);
        return ret !== 0;
    }
    /**
     * Климатический детектор конфликта с учетом полушария
     * @param {Uint32Array} season_months
     * @param {boolean} is_summer_season
     * @param {number} winter_solstice_month
     * @param {number} total_months
     * @param {string} hemisphere
     * @returns {boolean}
     */
    is_season_conflicting_with_solstice_hemisphere(season_months, is_summer_season, winter_solstice_month, total_months, hemisphere) {
        const ptr0 = passArray32ToWasm0(season_months, wasm.__wbindgen_malloc);
        const len0 = WASM_VECTOR_LEN;
        const ptr1 = passStringToWasm0(hemisphere, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len1 = WASM_VECTOR_LEN;
        const ret = wasm.wasmcalendarengine_is_season_conflicting_with_solstice_hemisphere(this.__wbg_ptr, ptr0, len0, is_summer_season, winter_solstice_month, total_months, ptr1, len1);
        return ret !== 0;
    }
    /**
     * Преобразует локальный момент планеты обратно в галактическое t_abs
     * @param {string} planet_id
     * @param {bigint} world_day
     * @param {bigint} day_tick
     * @param {bigint} ticks_per_day
     * @param {bigint} day_start_offset
     * @returns {bigint}
     */
    local_moment_to_t_abs(planet_id, world_day, day_tick, ticks_per_day, day_start_offset) {
        const ptr0 = passStringToWasm0(planet_id, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.wasmcalendarengine_local_moment_to_t_abs(this.__wbg_ptr, ptr0, len0, world_day, day_tick, ticks_per_day, day_start_offset);
        return ret;
    }
    /**
     * Рациональный расчет лунной фазы
     * @param {bigint} t_abs
     * @param {bigint} ticks_per_day
     * @param {bigint} period_days_num
     * @param {bigint} period_days_den
     * @param {bigint} initial_phase_bp
     * @returns {any}
     */
    moon_phase_rational(t_abs, ticks_per_day, period_days_num, period_days_den, initial_phase_bp) {
        const ret = wasm.wasmcalendarengine_moon_phase_rational(this.__wbg_ptr, t_abs, ticks_per_day, period_days_num, period_days_den, initial_phase_bp);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return takeFromExternrefTable0(ret[0]);
    }
    constructor() {
        const ret = wasm.wasmcalendarengine_new();
        this.__wbg_ptr = ret;
        WasmCalendarEngineFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
    /**
     * Позиция истинного полудня (солнечного зенита) в тиках суток
     * @param {bigint} ticks_per_day
     * @param {bigint} longitude_mdeg
     * @param {boolean} retrograde
     * @returns {bigint}
     */
    solar_noon_tick(ticks_per_day, longitude_mdeg, retrograde) {
        const ret = wasm.wasmcalendarengine_solar_noon_tick(this.__wbg_ptr, ticks_per_day, longitude_mdeg, retrograde);
        return ret;
    }
    /**
     * Угловое расстояние солнца от зенита в миллиградусах [0..180_000]
     * @param {bigint} day_tick
     * @param {bigint} ticks_per_day
     * @param {bigint} longitude_mdeg
     * @param {boolean} retrograde
     * @returns {bigint}
     */
    solar_zenith_distance_mdeg(day_tick, ticks_per_day, longitude_mdeg, retrograde) {
        const ret = wasm.wasmcalendarengine_solar_zenith_distance_mdeg(this.__wbg_ptr, day_tick, ticks_per_day, longitude_mdeg, retrograde);
        return ret;
    }
    /**
     * Инсоляция в базисных пунктах [0..10_000]
     * @param {bigint} day_tick
     * @param {bigint} ticks_per_day
     * @param {bigint} longitude_mdeg
     * @param {boolean} retrograde
     * @returns {bigint}
     */
    sunlight_basis_points(day_tick, ticks_per_day, longitude_mdeg, retrograde) {
        const ret = wasm.wasmcalendarengine_sunlight_basis_points(this.__wbg_ptr, day_tick, ticks_per_day, longitude_mdeg, retrograde);
        return ret;
    }
    /**
     * Преобразует абсолютное время t_abs в календарную дату
     * @param {bigint} t_abs
     * @param {any} config
     * @returns {any}
     */
    t_abs_to_date(t_abs, config) {
        const ret = wasm.wasmcalendarengine_t_abs_to_date(this.__wbg_ptr, t_abs, config);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return takeFromExternrefTable0(ret[0]);
    }
    /**
     * Преобразует абсолютное галактическое время t_abs в локальный момент планеты
     * @param {bigint} t_abs
     * @param {string} planet_id
     * @param {bigint} ticks_per_day
     * @param {bigint} day_start_offset
     * @returns {any}
     */
    t_abs_to_local_moment(t_abs, planet_id, ticks_per_day, day_start_offset) {
        const ptr0 = passStringToWasm0(planet_id, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.wasmcalendarengine_t_abs_to_local_moment(this.__wbg_ptr, t_abs, ptr0, len0, ticks_per_day, day_start_offset);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return takeFromExternrefTable0(ret[0]);
    }
    /**
     * Перевод внутреннего индекса месяца в культурный
     * @param {number} internal_m
     * @param {number} m_start
     * @param {number} total_months
     * @returns {number}
     */
    to_cultural_month(internal_m, m_start, total_months) {
        const ret = wasm.wasmcalendarengine_to_cultural_month(this.__wbg_ptr, internal_m, m_start, total_months);
        return ret >>> 0;
    }
    /**
     * Перевод культурного индекса месяца во внутренний
     * @param {number} cultural_m
     * @param {number} m_start
     * @param {number} total_months
     * @returns {number}
     */
    to_internal_month(cultural_m, m_start, total_months) {
        const ret = wasm.wasmcalendarengine_to_internal_month(this.__wbg_ptr, cultural_m, m_start, total_months);
        return ret >>> 0;
    }
    /**
     * Преобразует показания циферблата (единицы от старшей к младшей) в тик суток (ceil)
     * @param {BigInt64Array} unit_values
     * @param {BigInt64Array} subdivisions
     * @param {bigint} ticks_per_day
     * @returns {bigint}
     */
    units_to_day_tick(unit_values, subdivisions, ticks_per_day) {
        const ptr0 = passArray64ToWasm0(unit_values, wasm.__wbindgen_malloc);
        const len0 = WASM_VECTOR_LEN;
        const ptr1 = passArray64ToWasm0(subdivisions, wasm.__wbindgen_malloc);
        const len1 = WASM_VECTOR_LEN;
        const ret = wasm.wasmcalendarengine_units_to_day_tick(this.__wbg_ptr, ptr0, len0, ptr1, len1, ticks_per_day);
        return ret;
    }
    /**
     * Валидация набора гармоник по наименьшему общему кратному LCM
     * @param {any} harmonics
     * @returns {boolean}
     */
    validate_harmonics(harmonics) {
        const ret = wasm.wasmcalendarengine_validate_harmonics(this.__wbg_ptr, harmonics);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return ret[0] !== 0;
    }
    /**
     * O(1) обращение порядкового дня календаря в год и день внутри года
     * @param {bigint} cal_day
     * @param {bigint} base_days
     * @param {any} harmonics
     * @param {bigint} leap_day_offset
     * @returns {any}
     */
    year_from_days(cal_day, base_days, harmonics, leap_day_offset) {
        const ret = wasm.wasmcalendarengine_year_from_days(this.__wbg_ptr, cal_day, base_days, harmonics, leap_day_offset);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return takeFromExternrefTable0(ret[0]);
    }
}
if (Symbol.dispose) WasmCalendarEngine.prototype[Symbol.dispose] = WasmCalendarEngine.prototype.free;
function __wbg_get_imports() {
    const import0 = {
        __proto__: null,
        __wbg_Error_67e7344beaa85059: function(arg0, arg1) {
            const ret = Error(getStringFromWasm0(arg0, arg1));
            return ret;
        },
        __wbg_Number_c54e7112a3fa7e3e: function(arg0) {
            const ret = Number(arg0);
            return ret;
        },
        __wbg_String_8564e559799eccda: function(arg0, arg1) {
            const ret = String(arg1);
            const ptr1 = passStringToWasm0(ret, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
            const len1 = WASM_VECTOR_LEN;
            getDataViewMemory0().setInt32(arg0 + 4 * 1, len1, true);
            getDataViewMemory0().setInt32(arg0 + 4 * 0, ptr1, true);
        },
        __wbg___wbindgen_bigint_get_as_i64_b482365c149396c8: function(arg0, arg1) {
            const v = arg1;
            const ret = typeof(v) === 'bigint' ? v : undefined;
            getDataViewMemory0().setBigInt64(arg0 + 8 * 1, isLikeNone(ret) ? BigInt(0) : ret, true);
            getDataViewMemory0().setInt32(arg0 + 4 * 0, !isLikeNone(ret), true);
        },
        __wbg___wbindgen_boolean_get_7a12af2b3f899c5a: function(arg0) {
            const v = arg0;
            const ret = typeof(v) === 'boolean' ? v : undefined;
            return isLikeNone(ret) ? 0xFFFFFF : ret ? 1 : 0;
        },
        __wbg___wbindgen_debug_string_0e68cf47c9cbd9b0: function(arg0, arg1) {
            const ret = debugString(arg1);
            const ptr1 = passStringToWasm0(ret, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
            const len1 = WASM_VECTOR_LEN;
            getDataViewMemory0().setInt32(arg0 + 4 * 1, len1, true);
            getDataViewMemory0().setInt32(arg0 + 4 * 0, ptr1, true);
        },
        __wbg___wbindgen_in_50072d4d6e45c193: function(arg0, arg1) {
            const ret = arg0 in arg1;
            return ret;
        },
        __wbg___wbindgen_is_bigint_60fc0336cb14f5d7: function(arg0) {
            const ret = typeof(arg0) === 'bigint';
            return ret;
        },
        __wbg___wbindgen_is_function_fcda5e3902d732fe: function(arg0) {
            const ret = typeof(arg0) === 'function';
            return ret;
        },
        __wbg___wbindgen_is_object_edb6b15aa3afe12e: function(arg0) {
            const val = arg0;
            const ret = typeof(val) === 'object' && val !== null;
            return ret;
        },
        __wbg___wbindgen_is_string_c4f7cb494a2a21f1: function(arg0) {
            const ret = typeof(arg0) === 'string';
            return ret;
        },
        __wbg___wbindgen_is_undefined_8c687d0b90d5b524: function(arg0) {
            const ret = arg0 === undefined;
            return ret;
        },
        __wbg___wbindgen_jsval_eq_9fdcd3c0a860dd3b: function(arg0, arg1) {
            const ret = arg0 === arg1;
            return ret;
        },
        __wbg___wbindgen_jsval_loose_eq_3c30021c243b64cd: function(arg0, arg1) {
            const ret = arg0 == arg1;
            return ret;
        },
        __wbg___wbindgen_number_get_1dc732b810cb937c: function(arg0, arg1) {
            const obj = arg1;
            const ret = typeof(obj) === 'number' ? obj : undefined;
            getDataViewMemory0().setFloat64(arg0 + 8 * 1, isLikeNone(ret) ? 0 : ret, true);
            getDataViewMemory0().setInt32(arg0 + 4 * 0, !isLikeNone(ret), true);
        },
        __wbg___wbindgen_string_get_92ab86bb19cbc12f: function(arg0, arg1) {
            const obj = arg1;
            const ret = typeof(obj) === 'string' ? obj : undefined;
            var ptr1 = isLikeNone(ret) ? 0 : passStringToWasm0(ret, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
            var len1 = WASM_VECTOR_LEN;
            getDataViewMemory0().setInt32(arg0 + 4 * 1, len1, true);
            getDataViewMemory0().setInt32(arg0 + 4 * 0, ptr1, true);
        },
        __wbg___wbindgen_throw_5d9e815e6fdf150f: function(arg0, arg1) {
            throw new Error(getStringFromWasm0(arg0, arg1));
        },
        __wbg_call_269c5566fbede3eb: function() { return handleError(function (arg0, arg1) {
            const ret = arg0.call(arg1);
            return ret;
        }, arguments); },
        __wbg_done_cffed884d87aa22e: function(arg0) {
            const ret = arg0.done;
            return ret;
        },
        __wbg_entries_972a87586902cf87: function(arg0) {
            const ret = Object.entries(arg0);
            return ret;
        },
        __wbg_get_6cf5a4d4d8ad3c5a: function() { return handleError(function (arg0, arg1) {
            const ret = Reflect.get(arg0, arg1);
            return ret;
        }, arguments); },
        __wbg_get_b1f0ab13c737f856: function(arg0, arg1) {
            const ret = arg0[arg1 >>> 0];
            return ret;
        },
        __wbg_get_unchecked_363572bdd397d473: function(arg0, arg1) {
            const ret = arg0[arg1 >>> 0];
            return ret;
        },
        __wbg_get_with_ref_key_6412cf3094599694: function(arg0, arg1) {
            const ret = arg0[arg1];
            return ret;
        },
        __wbg_instanceof_ArrayBuffer_d4ff01f8247925ae: function(arg0) {
            let result;
            try {
                result = arg0 instanceof ArrayBuffer;
            } catch (_) {
                result = false;
            }
            const ret = result;
            return ret;
        },
        __wbg_instanceof_Uint8Array_598adc0fef426aa8: function(arg0) {
            let result;
            try {
                result = arg0 instanceof Uint8Array;
            } catch (_) {
                result = false;
            }
            const ret = result;
            return ret;
        },
        __wbg_isArray_5674713bb7b79043: function(arg0) {
            const ret = Array.isArray(arg0);
            return ret;
        },
        __wbg_isSafeInteger_8f51c743827d1ec5: function(arg0) {
            const ret = Number.isSafeInteger(arg0);
            return ret;
        },
        __wbg_iterator_22ddeb808cf55a6f: function() {
            const ret = Symbol.iterator;
            return ret;
        },
        __wbg_length_31bdaf014f5fbde2: function(arg0) {
            const ret = arg0.length;
            return ret;
        },
        __wbg_length_4e1adc0d42e23620: function(arg0) {
            const ret = arg0.length;
            return ret;
        },
        __wbg_new_1da3429bc3c4541c: function(arg0) {
            const ret = new Uint8Array(arg0);
            return ret;
        },
        __wbg_new_bebc3f4757acf305: function() {
            const ret = new Object();
            return ret;
        },
        __wbg_new_ffa92086ea89f79c: function() {
            const ret = new Array();
            return ret;
        },
        __wbg_next_95053e306b1c3aed: function(arg0) {
            const ret = arg0.next;
            return ret;
        },
        __wbg_next_f31ecb8646d2c605: function() { return handleError(function (arg0) {
            const ret = arg0.next();
            return ret;
        }, arguments); },
        __wbg_prototypesetcall_ae9f5e7459250748: function(arg0, arg1, arg2) {
            Uint8Array.prototype.set.call(getArrayU8FromWasm0(arg0, arg1), arg2);
        },
        __wbg_set_13d25b81ab403f5e: function(arg0, arg1, arg2) {
            arg0[arg1 >>> 0] = arg2;
        },
        __wbg_set_6be42768c690e380: function(arg0, arg1, arg2) {
            arg0[arg1] = arg2;
        },
        __wbg_value_c227f843d21da141: function(arg0) {
            const ret = arg0.value;
            return ret;
        },
        __wbindgen_generic_0000000000000001: function(arg0) {
            // Cast intrinsic for `F64 -> Externref`.
            const ret = arg0;
            return ret;
        },
        __wbindgen_generic_0000000000000002: function(arg0) {
            // Cast intrinsic for `I64 -> Externref`.
            const ret = arg0;
            return ret;
        },
        __wbindgen_generic_0000000000000003: function(arg0, arg1) {
            // Cast intrinsic for `Ref(String) -> Externref`.
            const ret = getStringFromWasm0(arg0, arg1);
            return ret;
        },
        __wbindgen_generic_0000000000000004: function(arg0) {
            // Cast intrinsic for `U64 -> Externref`.
            const ret = BigInt.asUintN(64, arg0);
            return ret;
        },
        __wbindgen_init_externref_table: function() {
            const table = wasm.__wbindgen_externrefs;
            const offset = table.grow(4);
            table.set(0, undefined);
            table.set(offset + 0, undefined);
            table.set(offset + 1, null);
            table.set(offset + 2, true);
            table.set(offset + 3, false);
        },
    };
    return {
        __proto__: null,
        "./worldwiki_calendar_wasm_bg.js": import0,
    };
}

const WasmCalendarEngineFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_wasmcalendarengine_free(ptr, 1));

function addToExternrefTable0(obj) {
    const idx = wasm.__externref_table_alloc();
    wasm.__wbindgen_externrefs.set(idx, obj);
    return idx;
}

function debugString(val) {
    // primitive types
    const type = typeof val;
    if (type == 'number' || type == 'boolean' || val == null) {
        return  `${val}`;
    }
    if (type == 'string') {
        return `"${val}"`;
    }
    if (type == 'symbol') {
        const description = val.description;
        if (description == null) {
            return 'Symbol';
        } else {
            return `Symbol(${description})`;
        }
    }
    if (type == 'function') {
        const name = val.name;
        if (typeof name == 'string' && name.length > 0) {
            return `Function(${name})`;
        } else {
            return 'Function';
        }
    }
    // objects
    if (Array.isArray(val)) {
        const length = val.length;
        let debug = '[';
        if (length > 0) {
            debug += debugString(val[0]);
        }
        for(let i = 1; i < length; i++) {
            debug += ', ' + debugString(val[i]);
        }
        debug += ']';
        return debug;
    }
    // Test for built-in
    const builtInMatches = /\[object ([^\]]+)\]/.exec(toString.call(val));
    let className;
    if (builtInMatches && builtInMatches.length > 1) {
        className = builtInMatches[1];
    } else {
        // Failed to match the standard '[object ClassName]'
        return toString.call(val);
    }
    if (className == 'Object') {
        // we're a user defined class or Object
        // JSON.stringify avoids problems with cycles, and is generally much
        // easier than looping through ownProperties of `val`.
        try {
            return 'Object(' + JSON.stringify(val) + ')';
        } catch (_) {
            return 'Object';
        }
    }
    // errors
    if (val instanceof Error) {
        return `${val.name}: ${val.message}\n${val.stack}`;
    }
    // TODO we could test for more things here, like `Set`s and `Map`s.
    return className;
}

function getArrayI64FromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    return getBigInt64ArrayMemory0().subarray(ptr / 8, ptr / 8 + len);
}

function getArrayU8FromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    return getUint8ArrayMemory0().subarray(ptr / 1, ptr / 1 + len);
}

let cachedBigInt64ArrayMemory0 = null;
function getBigInt64ArrayMemory0() {
    if (cachedBigInt64ArrayMemory0 === null || cachedBigInt64ArrayMemory0.byteLength === 0) {
        cachedBigInt64ArrayMemory0 = new BigInt64Array(wasm.memory.buffer);
    }
    return cachedBigInt64ArrayMemory0;
}

let cachedBigUint64ArrayMemory0 = null;
function getBigUint64ArrayMemory0() {
    if (cachedBigUint64ArrayMemory0 === null || cachedBigUint64ArrayMemory0.byteLength === 0) {
        cachedBigUint64ArrayMemory0 = new BigUint64Array(wasm.memory.buffer);
    }
    return cachedBigUint64ArrayMemory0;
}

let cachedDataViewMemory0 = null;
function getDataViewMemory0() {
    if (cachedDataViewMemory0 === null || cachedDataViewMemory0.buffer.detached === true || (cachedDataViewMemory0.buffer.detached === undefined && cachedDataViewMemory0.buffer !== wasm.memory.buffer)) {
        cachedDataViewMemory0 = new DataView(wasm.memory.buffer);
    }
    return cachedDataViewMemory0;
}

function getStringFromWasm0(ptr, len) {
    return decodeText(ptr >>> 0, len);
}

let cachedUint32ArrayMemory0 = null;
function getUint32ArrayMemory0() {
    if (cachedUint32ArrayMemory0 === null || cachedUint32ArrayMemory0.byteLength === 0) {
        cachedUint32ArrayMemory0 = new Uint32Array(wasm.memory.buffer);
    }
    return cachedUint32ArrayMemory0;
}

let cachedUint8ArrayMemory0 = null;
function getUint8ArrayMemory0() {
    if (cachedUint8ArrayMemory0 === null || cachedUint8ArrayMemory0.byteLength === 0) {
        cachedUint8ArrayMemory0 = new Uint8Array(wasm.memory.buffer);
    }
    return cachedUint8ArrayMemory0;
}

function handleError(f, args) {
    try {
        return f.apply(this, args);
    } catch (e) {
        const idx = addToExternrefTable0(e);
        wasm.__wbindgen_exn_store(idx);
    }
}

function isLikeNone(x) {
    return x === undefined || x === null;
}

function passArray32ToWasm0(arg, malloc) {
    const ptr = malloc(arg.length * 4, 4) >>> 0;
    getUint32ArrayMemory0().set(arg, ptr / 4);
    WASM_VECTOR_LEN = arg.length;
    return ptr;
}

function passArray64ToWasm0(arg, malloc) {
    const ptr = malloc(arg.length * 8, 8) >>> 0;
    getBigUint64ArrayMemory0().set(arg, ptr / 8);
    WASM_VECTOR_LEN = arg.length;
    return ptr;
}

function passStringToWasm0(arg, malloc, realloc) {
    if (realloc === undefined) {
        const buf = cachedTextEncoder.encode(arg);
        const ptr = malloc(buf.length, 1) >>> 0;
        getUint8ArrayMemory0().subarray(ptr, ptr + buf.length).set(buf);
        WASM_VECTOR_LEN = buf.length;
        return ptr;
    }

    let len = arg.length;
    let ptr = malloc(len, 1) >>> 0;

    const mem = getUint8ArrayMemory0();

    let offset = 0;

    for (; offset < len; offset++) {
        const code = arg.charCodeAt(offset);
        if (code > 0x7F) break;
        mem[ptr + offset] = code;
    }
    if (offset !== len) {
        if (offset !== 0) {
            arg = arg.slice(offset);
        }
        ptr = realloc(ptr, len, len = offset + arg.length * 3, 1) >>> 0;
        const view = getUint8ArrayMemory0().subarray(ptr + offset, ptr + len);
        const ret = cachedTextEncoder.encodeInto(arg, view);

        offset += ret.written;
        ptr = realloc(ptr, len, offset, 1) >>> 0;
    }

    WASM_VECTOR_LEN = offset;
    return ptr;
}

function takeFromExternrefTable0(idx) {
    const value = wasm.__wbindgen_externrefs.get(idx);
    wasm.__externref_table_dealloc(idx);
    return value;
}

let cachedTextDecoder = new TextDecoder('utf-8', { ignoreBOM: true, fatal: true });
cachedTextDecoder.decode();
const MAX_SAFARI_DECODE_BYTES = 2146435072;
let numBytesDecoded = 0;
function decodeText(ptr, len) {
    numBytesDecoded += len;
    if (numBytesDecoded >= MAX_SAFARI_DECODE_BYTES) {
        cachedTextDecoder = new TextDecoder('utf-8', { ignoreBOM: true, fatal: true });
        cachedTextDecoder.decode();
        numBytesDecoded = len;
    }
    return cachedTextDecoder.decode(getUint8ArrayMemory0().subarray(ptr, ptr + len));
}

const cachedTextEncoder = new TextEncoder();

if (!('encodeInto' in cachedTextEncoder)) {
    cachedTextEncoder.encodeInto = function (arg, view) {
        const buf = cachedTextEncoder.encode(arg);
        view.set(buf);
        return {
            read: arg.length,
            written: buf.length
        };
    };
}

let WASM_VECTOR_LEN = 0;

let wasmModule, wasmInstance, wasm;
function __wbg_finalize_init(instance, module) {
    wasmInstance = instance;
    wasm = instance.exports;
    wasmModule = module;
    cachedBigInt64ArrayMemory0 = null;
    cachedBigUint64ArrayMemory0 = null;
    cachedDataViewMemory0 = null;
    cachedUint32ArrayMemory0 = null;
    cachedUint8ArrayMemory0 = null;
    wasm.__wbindgen_start();
    return wasm;
}

async function __wbg_load(module, imports) {
    if (typeof Response === 'function' && module instanceof Response) {
        if (!module.ok) {
            throw new Error(`failed to fetch Wasm: ${module.status} ${module.statusText} fetching '${module.url}'`);
        }

        if (typeof WebAssembly.instantiateStreaming === 'function') {
            try {
                return await WebAssembly.instantiateStreaming(module, imports);
            } catch (e) {
                const validResponse = expectedResponseType(module.type);

                if (validResponse && module.headers.get('Content-Type') !== 'application/wasm') {
                    console.warn("`WebAssembly.instantiateStreaming` failed because your server does not serve Wasm with `application/wasm` MIME type. Falling back to `WebAssembly.instantiate` which is slower. Original error:\n", e);

                } else { throw e; }
            }
        }

        const bytes = await module.arrayBuffer();
        return await WebAssembly.instantiate(bytes, imports);
    } else {
        const instance = await WebAssembly.instantiate(module, imports);

        if (instance instanceof WebAssembly.Instance) {
            return { instance, module };
        } else {
            return instance;
        }
    }

    function expectedResponseType(type) {
        switch (type) {
            case 'basic': case 'cors': case 'default': return true;
        }
        return false;
    }
}

function initSync(module) {
    if (wasm !== undefined) return wasm;


    if (module !== undefined) {
        if (Object.getPrototypeOf(module) === Object.prototype) {
            ({module} = module)
        } else {
            console.warn('using deprecated parameters for `initSync()`; pass a single object instead')
        }
    }

    const imports = __wbg_get_imports();
    if (!(module instanceof WebAssembly.Module)) {
        module = new WebAssembly.Module(module);
    }
    const instance = new WebAssembly.Instance(module, imports);
    return __wbg_finalize_init(instance, module);
}

async function __wbg_init(module_or_path) {
    if (wasm !== undefined) return wasm;


    if (module_or_path !== undefined) {
        if (Object.getPrototypeOf(module_or_path) === Object.prototype) {
            ({module_or_path} = module_or_path)
        } else {
            console.warn('using deprecated parameters for the initialization function; pass a single object instead')
        }
    }

    if (module_or_path === undefined) {
        module_or_path = new URL('worldwiki_calendar_wasm_bg.wasm', import.meta.url);
    }
    const imports = __wbg_get_imports();

    if (typeof module_or_path === 'string' || (typeof Request === 'function' && module_or_path instanceof Request) || (typeof URL === 'function' && module_or_path instanceof URL)) {
        module_or_path = fetch(module_or_path);
    }

    const { instance, module } = await __wbg_load(await module_or_path, imports);

    return __wbg_finalize_init(instance, module);
}

export { initSync, __wbg_init as default };
