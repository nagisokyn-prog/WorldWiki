/* tslint:disable */
/* eslint-disable */

export class WasmCalendarEngine {
    free(): void;
    [Symbol.dispose](): void;
    /**
     * Комплексный аудит культуры календаря
     */
    audit_calendar_culture(config: any, tropical_year_num: bigint, tropical_year_den: bigint): any;
    /**
     * Параметрический расчет возраста персонажа
     */
    calculate_age(params: any): number;
    /**
     * Пакетный расчет фаз для множества спутников
     */
    calculate_all_moon_phases(t_abs: bigint, ticks_per_day: bigint, moons: any): any;
    /**
     * Приближение високосных циклов через цепные дроби
     */
    calculate_leap_convergents(trop_num: bigint, trop_den: bigint, max_convergents: number): any;
    /**
     * Расчет anchor_world_day для сопряжения календарей
     */
    calculate_linked_anchor_world_day(master_date: any, master_config: any, local_date: any, local_config: any): bigint;
    /**
     * Непрерывный расчет дня недели (без пауз)
     */
    calculate_weekday(cal_day: bigint, origin_day: bigint, start_weekday: number, weekdays_count: number): number;
    /**
     * Расчет дня недели с учетом паузы (эпагоменов)
     */
    calculate_weekday_with_pause(year: bigint, day_in_year: bigint, params: any): any;
    /**
     * Проверка конфликта билокации
     */
    check_bilocation(s1: bigint, e1: bigint, loc1: string, s2: bigint, e2: bigint, loc2: string): boolean;
    /**
     * Проверка нарушения смерти
     */
    check_death_violation(s: bigint, e: bigint, death_t_abs: bigint): boolean;
    /**
     * Преобразует календарную дату в абсолютное время t_abs
     */
    date_to_t_abs(date: any, config: any): bigint;
    /**
     * Преобразует тик суток в показания циферблата (floor)
     */
    day_tick_to_units(day_tick: bigint, subdivisions: BigInt64Array, ticks_per_day: bigint): BigInt64Array;
    /**
     * Число дней в году
     */
    days_in_year(year: bigint, base_days: bigint, harmonics: any, leap_day_offset: bigint): bigint;
    /**
     * Кумулятивное число дней от начала летоисчисления до начала заданного года
     */
    days_up_to_year(year: bigint, base_days: bigint, harmonics: any, leap_day_offset: bigint): bigint;
    /**
     * Разложение рациональной дроби p/q на знаковые единичные гармоники (+1/-1)
     */
    decompose_fraction_to_unit_harmonics(p: bigint, q: bigint, max_harmonics: number): any;
    /**
     * Вековой дрейф календаря относительно истинного года (в сутках за 100 лет)
     */
    drift_per_century(base_days: bigint, harmonics: any, target_year_length_days: number): number;
    /**
     * Поиск момента ближайшего Двойного Полнолуния
     */
    find_next_double_full_moon(moon1: any, moon2: any, ticks_per_day: bigint, start_t_abs: bigint, max_days_to_search: bigint): any;
    /**
     * Генерация предпросмотра структуры года
     */
    generate_year_preview(year: bigint, config: any, first_month_of_year: number): any;
    /**
     * Пакетный метод генерации сетки месяца за 1 вызов (120 FPS)
     */
    get_month_grid_bundle(params: any): any;
    /**
     * Проверка пересечения временных интервалов
     */
    intervals_overlap(s1: bigint, e1: bigint, s2: bigint, e2: bigint): boolean;
    /**
     * Проверка активности праздника с переходом через границу года
     */
    is_holiday_active(curr_m: number, curr_d: bigint, start_m: number, start_d: bigint, end_m: number, end_d: bigint): boolean;
    /**
     * Проверяет високосность года по набору гармоник
     */
    is_leap_year(year: bigint, harmonics: any, _days_offset: number): boolean;
    /**
     * Проверка активности многолетнего праздника
     */
    is_multi_year_holiday_active(curr_y: bigint, curr_m: number, curr_d: bigint, holiday: any): boolean;
    /**
     * Климатический детектор конфликта сезона солнцестояния
     */
    is_season_conflicting_with_solstice(season_months: Uint32Array, is_summer_season: boolean, winter_solstice_month: number, total_months: number): boolean;
    /**
     * Климатический детектор конфликта с учетом полушария
     */
    is_season_conflicting_with_solstice_hemisphere(season_months: Uint32Array, is_summer_season: boolean, winter_solstice_month: number, total_months: number, hemisphere: string): boolean;
    /**
     * Преобразует локальный момент планеты обратно в галактическое t_abs
     */
    local_moment_to_t_abs(planet_id: string, world_day: bigint, day_tick: bigint, ticks_per_day: bigint, day_start_offset: bigint): bigint;
    /**
     * Рациональный расчет лунной фазы
     */
    moon_phase_rational(t_abs: bigint, ticks_per_day: bigint, period_days_num: bigint, period_days_den: bigint, initial_phase_bp: bigint): any;
    constructor();
    /**
     * Позиция истинного полудня (солнечного зенита) в тиках суток
     */
    solar_noon_tick(ticks_per_day: bigint, longitude_mdeg: bigint, retrograde: boolean): bigint;
    /**
     * Угловое расстояние солнца от зенита в миллиградусах [0..180_000]
     */
    solar_zenith_distance_mdeg(day_tick: bigint, ticks_per_day: bigint, longitude_mdeg: bigint, retrograde: boolean): bigint;
    /**
     * Инсоляция в базисных пунктах [0..10_000]
     */
    sunlight_basis_points(day_tick: bigint, ticks_per_day: bigint, longitude_mdeg: bigint, retrograde: boolean): bigint;
    /**
     * Преобразует абсолютное время t_abs в календарную дату
     */
    t_abs_to_date(t_abs: bigint, config: any): any;
    /**
     * Преобразует абсолютное галактическое время t_abs в локальный момент планеты
     */
    t_abs_to_local_moment(t_abs: bigint, planet_id: string, ticks_per_day: bigint, day_start_offset: bigint): any;
    /**
     * Перевод внутреннего индекса месяца в культурный
     */
    to_cultural_month(internal_m: number, m_start: number, total_months: number): number;
    /**
     * Перевод культурного индекса месяца во внутренний
     */
    to_internal_month(cultural_m: number, m_start: number, total_months: number): number;
    /**
     * Преобразует показания циферблата (единицы от старшей к младшей) в тик суток (ceil)
     */
    units_to_day_tick(unit_values: BigInt64Array, subdivisions: BigInt64Array, ticks_per_day: bigint): bigint;
    /**
     * Валидация набора гармоник по наименьшему общему кратному LCM
     */
    validate_harmonics(harmonics: any): boolean;
    /**
     * O(1) обращение порядкового дня календаря в год и день внутри года
     */
    year_from_days(cal_day: bigint, base_days: bigint, harmonics: any, leap_day_offset: bigint): any;
}

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly __wbg_wasmcalendarengine_free: (a: number, b: number) => void;
    readonly wasmcalendarengine_audit_calendar_culture: (a: number, b: any, c: bigint, d: bigint) => [number, number, number];
    readonly wasmcalendarengine_calculate_age: (a: number, b: any) => [number, number, number];
    readonly wasmcalendarengine_calculate_all_moon_phases: (a: number, b: bigint, c: bigint, d: any) => [number, number, number];
    readonly wasmcalendarengine_calculate_leap_convergents: (a: number, b: bigint, c: bigint, d: number) => [number, number, number];
    readonly wasmcalendarengine_calculate_linked_anchor_world_day: (a: number, b: any, c: any, d: any, e: any) => [bigint, number, number];
    readonly wasmcalendarengine_calculate_weekday: (a: number, b: bigint, c: bigint, d: number, e: number) => number;
    readonly wasmcalendarengine_calculate_weekday_with_pause: (a: number, b: bigint, c: bigint, d: any) => [number, number, number];
    readonly wasmcalendarengine_check_bilocation: (a: number, b: bigint, c: bigint, d: number, e: number, f: bigint, g: bigint, h: number, i: number) => number;
    readonly wasmcalendarengine_check_death_violation: (a: number, b: bigint, c: bigint, d: bigint) => number;
    readonly wasmcalendarengine_date_to_t_abs: (a: number, b: any, c: any) => [bigint, number, number];
    readonly wasmcalendarengine_day_tick_to_units: (a: number, b: bigint, c: number, d: number, e: bigint) => [number, number];
    readonly wasmcalendarengine_days_in_year: (a: number, b: bigint, c: bigint, d: any, e: bigint) => [bigint, number, number];
    readonly wasmcalendarengine_days_up_to_year: (a: number, b: bigint, c: bigint, d: any, e: bigint) => [bigint, number, number];
    readonly wasmcalendarengine_decompose_fraction_to_unit_harmonics: (a: number, b: bigint, c: bigint, d: number) => [number, number, number];
    readonly wasmcalendarengine_drift_per_century: (a: number, b: bigint, c: any, d: number) => [number, number, number];
    readonly wasmcalendarengine_find_next_double_full_moon: (a: number, b: any, c: any, d: bigint, e: bigint, f: bigint) => [number, number, number];
    readonly wasmcalendarengine_generate_year_preview: (a: number, b: bigint, c: any, d: number) => [number, number, number];
    readonly wasmcalendarengine_get_month_grid_bundle: (a: number, b: any) => [number, number, number];
    readonly wasmcalendarengine_intervals_overlap: (a: number, b: bigint, c: bigint, d: bigint, e: bigint) => number;
    readonly wasmcalendarengine_is_holiday_active: (a: number, b: number, c: bigint, d: number, e: bigint, f: number, g: bigint) => number;
    readonly wasmcalendarengine_is_leap_year: (a: number, b: bigint, c: any, d: number) => [number, number, number];
    readonly wasmcalendarengine_is_multi_year_holiday_active: (a: number, b: bigint, c: number, d: bigint, e: any) => [number, number, number];
    readonly wasmcalendarengine_is_season_conflicting_with_solstice: (a: number, b: number, c: number, d: number, e: number, f: number) => number;
    readonly wasmcalendarengine_is_season_conflicting_with_solstice_hemisphere: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number) => number;
    readonly wasmcalendarengine_local_moment_to_t_abs: (a: number, b: number, c: number, d: bigint, e: bigint, f: bigint, g: bigint) => bigint;
    readonly wasmcalendarengine_moon_phase_rational: (a: number, b: bigint, c: bigint, d: bigint, e: bigint, f: bigint) => [number, number, number];
    readonly wasmcalendarengine_new: () => number;
    readonly wasmcalendarengine_solar_noon_tick: (a: number, b: bigint, c: bigint, d: number) => bigint;
    readonly wasmcalendarengine_solar_zenith_distance_mdeg: (a: number, b: bigint, c: bigint, d: bigint, e: number) => bigint;
    readonly wasmcalendarengine_sunlight_basis_points: (a: number, b: bigint, c: bigint, d: bigint, e: number) => bigint;
    readonly wasmcalendarengine_t_abs_to_date: (a: number, b: bigint, c: any) => [number, number, number];
    readonly wasmcalendarengine_t_abs_to_local_moment: (a: number, b: bigint, c: number, d: number, e: bigint, f: bigint) => [number, number, number];
    readonly wasmcalendarengine_to_cultural_month: (a: number, b: number, c: number, d: number) => number;
    readonly wasmcalendarengine_to_internal_month: (a: number, b: number, c: number, d: number) => number;
    readonly wasmcalendarengine_units_to_day_tick: (a: number, b: number, c: number, d: number, e: number, f: bigint) => bigint;
    readonly wasmcalendarengine_validate_harmonics: (a: number, b: any) => [number, number, number];
    readonly wasmcalendarengine_year_from_days: (a: number, b: bigint, c: bigint, d: any, e: bigint) => [number, number, number];
    readonly __wbindgen_malloc: (a: number, b: number) => number;
    readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
    readonly __wbindgen_exn_store: (a: number) => void;
    readonly __externref_table_alloc: () => number;
    readonly __wbindgen_externrefs: WebAssembly.Table;
    readonly __externref_table_dealloc: (a: number) => void;
    readonly __wbindgen_free: (a: number, b: number, c: number) => void;
    readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;

/**
 * Instantiates the given `module`, which can either be bytes or
 * a precompiled `WebAssembly.Module`.
 *
 * @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
 *
 * @returns {InitOutput}
 */
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
 * If `module_or_path` is {RequestInfo} or {URL}, makes a request and
 * for everything else, calls `WebAssembly.instantiate` directly.
 *
 * @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
 *
 * @returns {Promise<InitOutput>}
 */
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
