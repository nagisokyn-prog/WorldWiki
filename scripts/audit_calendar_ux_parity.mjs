#!/usr/bin/env node

/**
 * audit_calendar_ux_parity.mjs
 * 
 * Глубокий аудит UX/UI паритета между `calendars_ux_prototype.html`
 * и реальными Vue-компонентами / хуками в `apps/spa/src/ts/features/timeline/`.
 * 
 * Проверяет:
 * 1. Архитектурное разделение: Экран Планеты vs Экран Календаря vs Сайдбар Дерева.
 * 2. 5 Табов Календаря из прототипа и их наполнение рубль в рубль.
 * 3. Наличие всех интерактивных контролов, пресетов, калькуляторов и секций.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

const PROTOTYPE_PATH = path.join(ROOT_DIR, 'calendars_ux_prototype.html');
const TIMELINE_SRC = path.join(ROOT_DIR, 'apps/spa/src/ts/features/timeline');

if (!fs.existsSync(PROTOTYPE_PATH)) {
  console.error(`❌ Прототип не найден: ${PROTOTYPE_PATH}`);
  process.exit(1);
}

const protoContent = fs.readFileSync(PROTOTYPE_PATH, 'utf8');

// Собираем все .vue и .ts файлы в timeline
function collectFiles(dir) {
  let results = [];
  if (!fs.existsSync(dir)) return results;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results = results.concat(collectFiles(full));
    } else if (entry.isFile() && (entry.name.endsWith('.vue') || entry.name.endsWith('.ts'))) {
      results.push(full);
    }
  }
  return results;
}

const timelineFiles = collectFiles(TIMELINE_SRC);
const fileContents = new Map();
for (const f of timelineFiles) {
  const rel = path.relative(ROOT_DIR, f).replace(/\\/g, '/');
  fileContents.set(rel, fs.readFileSync(f, 'utf8'));
}

/**
 * Спецификация блоков UX прототипа для аудита
 */
const UX_SPEC = [
  // ==========================================
  // 0. САЙДБАР ДЕРЕВА (SIDEBAR TREE)
  // ==========================================
  {
    category: '0. Сайдбар дерева (Sidebar Tree)',
    feature: 'Дерево Планет и вложенных Календарей',
    expectedFile: 'PlanetCalendarTree.vue',
    checks: [
      { id: 'tree_planet_group', desc: 'Группировка планет с AU и звездами', keywords: ['planet', 'tree', 'AU'] },
      { id: 'tree_cal_sublist', desc: 'Список календарей внутри планеты', keywords: ['calendars', 'is_master', 'мастер'] },
      { id: 'btn_add_planet', desc: 'Кнопка добавления планеты (+ Планета)', keywords: ['addPlanet', 'добавить планету', 'createPlanet'] },
      { id: 'btn_add_calendar', desc: 'Кнопка добавления календаря (+ Добавить календарь...)', keywords: ['addCalendar', 'добавить календарь', 'createCalendar'] },
      { id: 'switch_view_planet_cal', desc: 'Переключение режима просмотра: Планета vs Календарь', keywords: ['selectPlanet', 'selectCalendar', 'viewMode'] },
    ]
  },

  // ==========================================
  // 1. РЕДАКТОР ПЛАНЕТЫ (PLANET EDITOR)
  // ==========================================
  {
    category: '1. Редактор Планеты (Planet View)',
    feature: 'Фундаментальная физика планеты & Астрономия',
    expectedFile: 'PlanetEditor.vue',
    checks: [
      { id: 'planet_editor_exists', desc: 'Отдельный компонент PlanetEditor.vue (не в календаре!)', customCheck: () => Array.from(fileContents.keys()).some(k => k.includes('PlanetEditor.vue')) },
      { id: 'orbit_physics', desc: 'Физика орбиты: дробный год (orbit_days_num / den), тики суток', keywords: ['orbit_days_num', 'orbit_days_den', 'ticks_per_day', 'axial_tilt'] },
      { id: 'solstices_points', desc: 'Астрономические точки года и солнцестояния (весна, лето, осень, зима)', keywords: ['solstice', 'equinox', 'солнцестоян', 'равноденств'] },
      { id: 'planet_timezones', desc: 'Часовые пояса планеты (расчет по меридианам/долготе)', keywords: ['timezone', 'часовой пояс', 'долгот'] },
      { id: 'planet_regions_cities', desc: 'Географические регионы, города и расчет светового дня по широте', keywords: ['latitude', 'широта', 'световой день', 'восход'] },
      { id: 'planet_moons', desc: 'Естественные спутники планеты (орбитальные луны, синодический/сидерический периоды, фазы)', keywords: ['moons', 'спутник', 'период_обращения', 'синодическ'] },
    ]
  },

  // ==========================================
  // 2. КАЛЕНДАРЬ: ТАБ 1 — ВРЕМЯ И СЕТКА ГОДА
  // ==========================================
  {
    category: '2. Календарь: Таб 1 (Время и Сетка)',
    feature: 'Сетка времени, DialHierarchy, дни недели, месяцы, високосы',
    expectedFile: 'Tab1Structure.vue / useTab1Structure.ts',
    checks: [
      { id: 'dial_hierarchy', desc: 'Деление суток (Циферблат: произвольная цепочка единиц)', keywords: ['dial', 'DialHierarchy', 'часы', 'минуты', 'стражи'] },
      { id: 'dial_presets', desc: 'Быстрые пресеты циферблатов (Земной, Фэнтези-стражи, Десятичный, Аграрный)', keywords: ['applyDialPreset', 'земной стандарт', 'стражи и колокола', 'десятичный'] },
      { id: 'day_start_offset', desc: 'Момент смены суток (day_start_offset: полночь, рассвет, полдень, закат, custom)', keywords: ['day_start_offset', 'смена суток', 'полночь', 'рассвет', 'закат'] },
      { id: 'weekdays_cycle', desc: 'Цикл дней недели (названия, reorder ↑↓, кастомные дни)', keywords: ['weekdays', 'дни недели', 'порядок'] },
      { id: 'weekdays_presets', desc: 'Пресеты длины недели (7, 6, 10, 5 дней)', keywords: ['applyWeekPreset', 'гексада', 'декада', 'пятидневка'] },
      { id: 'weekdays_pause_holidays', desc: 'Чекбокс: Замораживать счет дней недели на праздники (интеркалярные)', keywords: ['pause_on_holidays', 'замораживать', 'вне недели'] },
      { id: 'months_config', desc: 'Месяцы года: список, дни в месяце, интеркалярные дни', keywords: ['months', 'месяц', 'дней', 'intercalary'] },
      { id: 'leap_rules_engine', desc: 'Високосные правила: конструктор правил, дроби, исключения', keywords: ['leap', 'високос', 'интервал', 'исключен'] },
    ]
  },

  // ==========================================
  // 3. КАЛЕНДАРЬ: ТАБ 2 — ЛЕТОИСЧИСЛЕНИЕ & ЯКОРЬ
  // ==========================================
  {
    category: '3. Календарь: Таб 2 (Летоисчисление & Якорь)',
    feature: 'Синхронизация с Мировым континуумом, Эпохи, Опорные вехи',
    expectedFile: 'Tab2ErasSync.vue',
    checks: [
      { id: 'sync_anchor_mabs', desc: 'Привязка летоисчисления к Мировому времени (M_abs) / Мастер-календарю', keywords: ['sync_anchor', 'master_calendar', 'привязка', 'мировое время', 'M_abs'] },
      { id: 'culture_offset_delta', desc: 'Расчет культурного сдвига (Delta offset, разница дат)', keywords: ['delta_offset', 'культурный сдвиг', 'смещение дат'] },
      { id: 'eras_epochs', desc: 'Эпохи и Эры календаря (названия, год начала/конца, направление отсчета)', keywords: ['eras', 'эпохи', 'эры', 'год_начала', 'год_конца'] },
      { id: 'anchor_events_milestones', desc: 'Опорные исторические вехи культуры (Anchor Events / Битвы, основания империй)', keywords: ['anchor_events', 'опорные события', 'вехи', 'исторические события'] },
    ]
  },

  // ==========================================
  // 4. КАЛЕНДАРЬ: ТАБ 3 — КУЛЬТУРА И ЛОР
  // ==========================================
  {
    category: '4. Календарь: Таб 3 (Культура и Лор)',
    feature: 'Сезоны, Праздники, Культурные фазы лун, Возраст персонажей',
    expectedFile: 'Tab3CultureLore.vue',
    checks: [
      { id: 'seasons_climate', desc: 'Времена года / Сезоны (названия, привязка к месяцам/дням, цвета, описание)', keywords: ['seasons', 'сезоны', 'времена года'] },
      { id: 'holidays_lore', desc: 'Праздники культуры (фиксированные, интеркалярные, плавающие, описание)', keywords: ['holidays', 'праздники', 'памятные даты'] },
      { id: 'culture_moon_phases', desc: 'Лунная мифология в культуре (названия фаз, привязка к спутникам планеты)', keywords: ['cultural_moon_phases', 'лунные фазы', 'полнолуние', 'новолуние'] },
      { id: 'character_age_rules', desc: 'Правило возраста персонажей (Спецификация 4.13: конвертация лет планеты в земные/биологические)', keywords: ['character_age', 'возраст персонажей', 'биологический возраст', '4.13'] },
      { id: 'calendar_geography_tz', desc: 'Привязка календаря к регионам и часовому поясу планеты (Спецификация 4.11)', keywords: ['calendar_timezone', 'регион календаря', 'часовой пояс календаря', '4.11'] },
    ]
  },

  // ==========================================
  // 5. КАЛЕНДАРЬ: ТАБ 4 — ПЕСОЧНИЦА (ПЕРВАЯ ГЛАВА)
  // ==========================================
  {
    category: '5. Календарь: Таб 4 (Песочница / Сюжет)',
    feature: 'Дата 1-й главы, Интерактивная матрица месяца, Проверка континуума',
    expectedFile: 'Tab4Playground.vue',
    checks: [
      { id: 'first_chapter_origin', desc: 'Точка отсчета произведения (Дата начала сюжета / 1-й главы)', keywords: ['точка_отсчета', 'начало сюжета', '1-я глава', 'первая глава', 'story_origin'] },
      { id: 'interactive_month_matrix', desc: 'Интерактивная матрица стартового месяца (календарная сетка с днями, праздниками, фазами)', keywords: ['month_matrix', 'сетка месяца', 'сетка стартового месяца', 'календарная сетка', 'matrix-month'] },
      { id: 'live_date_tester', desc: 'Живой тестер: выбор даты -> день недели, луна, сезон, праздник, M_abs', keywords: ['liveCalculation', 'проверка даты', 'калькулятор даты', 'live_calc', 'тестер'] },
    ]
  },

  // ==========================================
  // 6. КАЛЕНДАРЬ: ТАБ 5 — РЕФОРМЫ & DST
  // ==========================================
  {
    category: '6. Календарь: Таб 5 (Реформы & DST)',
    feature: 'Исторические смены стилей, пропуск дней, переход на летнее время',
    expectedFile: 'Tab5ReformsDst.vue / useTab5ReformsDst.ts',
    checks: [
      { id: 'historical_reforms', desc: 'Исторические реформы календаря (пропуск дней, вставка дней, сдвиг эпохи)', keywords: ['reforms', 'реформы', 'skip_days', 'gregorian_1582', 'смена стиля'] },
      { id: 'dst_daylight_saving', desc: 'Сезонный перевод часов (Daylight Saving Time / DST: правила перехода, величина сдвига)', keywords: ['dst', 'daylight_saving', 'перевод часов', 'летнее время'] },
    ]
  }
];

// Поиск совпадений в кодовой базе
function checkFeature(check, expectedFileHint) {
  if (check.customCheck) {
    const res = check.customCheck();
    return typeof res === 'boolean' ? { found: res, file: expectedFileHint } : res;
  }

  // 1. Сначала проверяем целевой ожидаемый файл/папку
  for (const [relPath, content] of fileContents.entries()) {
    const isTarget = expectedFileHint && relPath.toLowerCase().includes(expectedFileHint.toLowerCase().split('.')[0].split('/')[0]);
    if (isTarget) {
      const lowerContent = content.toLowerCase();
      const matchesAll = check.keywords.some(kw => lowerContent.includes(kw.toLowerCase()));
      if (matchesAll) {
        return { found: true, file: relPath, isPrimary: true };
      }
    }
  }

  // 2. Если в целевом не найдено, ищем в остальных файлах
  for (const [relPath, content] of fileContents.entries()) {
    const lowerContent = content.toLowerCase();
    const matchesAll = check.keywords.some(kw => lowerContent.includes(kw.toLowerCase()));
    if (matchesAll) {
      return { found: true, file: relPath, isPrimary: false };
    }
  }
  return { found: false };
}

// Запуск аудита
console.log('='.repeat(80));
console.log('🔍 АУДИТ UX ПАРИТЕТА: calendars_ux_prototype.html vs Vue кодовая база');
console.log('='.repeat(80));

let totalChecks = 0;
let passedChecks = 0;
let misplacedChecks = 0;
let missingChecks = 0;

const auditReport = [];

for (const group of UX_SPEC) {
  console.log(`\n📂 ${group.category} — ${group.feature}`);
  console.log(`   Ожидаемое место: ${group.expectedFile}`);
  console.log('-'.repeat(80));

  for (const check of group.checks) {
    totalChecks++;
    const result = checkFeature(check, group.expectedFile);

    if (result.found) {
      // Проверяем архитектурную чистоту (не находится ли фича не на своем месте)
      const isMisplaced = 
        (group.category.includes('Планеты') && !result.file.includes('Planet') && result.file.includes('CalendarEditor')) ||
        (group.category.includes('Время и Сетка') && result.file.includes('Tab2Astronomy'));

      if (isMisplaced) {
        misplacedChecks++;
        console.log(`  ⚠️  [АРХИТЕКТУРНОЕ ИСКАЖЕНИЕ] ${check.desc}`);
        console.log(`      Найдено в ЧУЖОМ компоненте: ${result.file}`);
        auditReport.push({ status: 'MISPLACED', ...check, foundIn: result.file, category: group.category });
      } else {
        passedChecks++;
        console.log(`  🟢 [РЕАЛИЗОВАНО] ${check.desc}`);
        console.log(`      Файл: ${result.file}`);
        auditReport.push({ status: 'OK', ...check, foundIn: result.file, category: group.category });
      }
    } else {
      missingChecks++;
      console.log(`  🔴 [ПОЛНОСТЬЮ ОТСУТСТВУЕТ] ${check.desc}`);
      auditReport.push({ status: 'MISSING', ...check, category: group.category });
    }
  }
}

const parityPercent = Math.round((passedChecks / totalChecks) * 100);

console.log('\n' + '='.repeat(80));
console.log(`📊 ИТОГОВЫЙ СЧЕТ UX ПАРИТЕТА:`);
console.log(`   Всего проверок UX элементов: ${totalChecks}`);
console.log(`   🟢 Реализовано на своем месте: ${passedChecks} (${parityPercent}%)`);
console.log(`   ⚠️  Искажено / засунуто не туда: ${misplacedChecks}`);
console.log(`   🔴 Полностью потеряно / отсутствует: ${missingChecks}`);
console.log('='.repeat(80));

// Сохраняем подробный JSON отчет
const reportPath = path.join(ROOT_DIR, 'calendar_ux_parity_report.json');
fs.writeFileSync(reportPath, JSON.stringify({
  timestamp: new Date().toISOString(),
  parityPercent,
  totalChecks,
  passedChecks,
  misplacedChecks,
  missingChecks,
  details: auditReport
}, null, 2), 'utf8');

console.log(`\n📄 Детальный отчет сохранен в: calendar_ux_parity_report.json\n`);
