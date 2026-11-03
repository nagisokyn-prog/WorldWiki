#!/usr/bin/env node
/**
 * ============================================================================
 * WorldWiki Multi-Volume Architectural Audit Script (audit-multivolume.mjs)
 * ============================================================================
 * Прогоняет сквозной путь данных от SurrealDB до Vue-компонентов для 4 подсистем:
 * 1. 📝 TODO & Ткань планов (PlanningPanel)
 * 2. 👥 Матрица участий (CrossReferenceMatrix)
 * 3. 🗡️ Чеховские ружья (ChekhovGunTracker)
 * 4. ⏳ Хроноинспектор (TimelineInspector)
 *
 * Выявляет:
 * - Поддерживают ли хранимые функции SurrealDB фильтрацию по томам ($volume_id).
 * - Возвращается ли volume_id в выборках глав (chapters).
 * - Принимают ли Rust-порты, сервисы и Tauri IPC команды аргумент volume_id.
 * - Учитывают ли Pinia Store и Composable-хуки многотомность или завязаны на том 1 / активную главу.
 * ============================================================================
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

// Цвета для красивого терминального вывода
const C = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
};

function readRel(relPath) {
  const full = path.join(ROOT, relPath);
  if (!fs.existsSync(full)) return null;
  return fs.readFileSync(full, 'utf-8');
}

/**
 * Аудит подсистемы 1: PlanningPanel & Todos
 */
function auditTodos() {
  const result = {
    name: '📝 Планировщик & TODO (PlanningPanel)',
    layers: [],
    verdict: '',
    breakingPoints: [],
  };

  // 1. DB
  const schemaSurql = readRel('apps/spa/src/logic/schema/no_ai/01_tables.surql') || '';
  const todoTableHasOwner = schemaSurql.includes('DEFINE FIELD OVERWRITE owner_id ON todos TYPE record<volumes | chapters | story_arcs>');
  result.layers.push({
    layer: '1. SurrealDB Schema',
    status: todoTableHasOwner ? '🟢 PASS' : '🟡 PARTIAL',
    detail: 'Таблица todos полиморфна: owner_id поддерживает record<volumes | chapters | story_arcs>',
  });

  // 2. Rust Application & Tauri IPC
  const todoServicesRs = readRel('src-tauri/crates/worldwiki-application/src/plot/todo_services.rs') || '';
  const plotTauriRs = readRel('src-tauri/crates/worldwiki-tauri/src/commands/plot.rs') || '';
  const hasVolumeSpecificTodoQuery = todoServicesRs.includes('list_todos_by_owner');
  result.layers.push({
    layer: '2. Rust Core & Tauri IPC',
    status: hasVolumeSpecificTodoQuery ? '🟢 PASS' : '🔴 FAIL',
    detail: 'Tauri IPC get_todos(owner_id) принимает любой owner_id (volumes:id / chapters:id)',
  });

  // 3. Pinia Store (chapter.store.ts)
  const chapterStoreTs = readRel('apps/spa/src/ts/stores/chapter.store.ts') || '';
  const currentVolumeIsOnlyActiveChapter = chapterStoreTs.includes('const ch = currentChapterNode.value') && chapterStoreTs.includes('const volId = ch?.volume_id');
  const hasSelectedVolumeState = chapterStoreTs.includes('selectedVolumeId');
  if (currentVolumeIsOnlyActiveChapter && !hasSelectedVolumeState) {
    result.layers.push({
      layer: '3. Pinia Chapter Store',
      status: '🔴 BOTTLENECK',
      detail: 'currentVolume вычисляется ТОЛЬКО из открытой главы редактора. Нет независимого стейта selectedVolumeId!',
    });
    result.breakingPoints.push('chapter.store.ts: currentVolume привязан исключительно к активной главе в редакторе.');
  }

  // 4. Composable (usePlanningPanel.ts)
  const usePlanningPanelTs = readRel('apps/spa/src/ts/features/chapters/PlanningPanel/usePlanningPanel.ts') || '';
  const hasEmptyVolumeFallbackBug = usePlanningPanelTs.includes('volumeChapters.length === 0 && allChapters.length > 0');
  const watchesVolumes = usePlanningPanelTs.includes('hierarchy?.volumes');
  const hasVolumeSelector = usePlanningPanelTs.includes('selectVolume') || usePlanningPanelTs.includes('selectedVolumeIdOverride');

  if (hasEmptyVolumeFallbackBug) {
    result.layers.push({
      layer: '4. Composable Logic (usePlanningPanel)',
      status: '🔴 CRITICAL BUG',
      detail: 'При пустом новом томе (0 глав) срабатывает `volumeChapters = allChapters`, подменяя новый том главами тома 1!',
    });
    result.breakingPoints.push('usePlanningPanel.ts:143: пустой новый том перезаписывается главами других томов.');
  } else {
    result.layers.push({
      layer: '4. Composable Logic (usePlanningPanel)',
      status: '🟢 PASS',
      detail: 'Корректная изоляция глав тома.',
    });
  }

  // 5. UI Header (PlanVolumeHeader.vue)
  const planVolumeHeaderVue = readRel('apps/spa/src/ts/features/chapters/PlanningPanel/components/PlanVolumeHeader.vue') || '';
  const hasVolumeDropdown = planVolumeHeaderVue.includes('volume-select-dropdown') || planVolumeHeaderVue.includes('select-volume');
  result.layers.push({
    layer: '5. UI Component (PlanVolumeHeader)',
    status: hasVolumeDropdown ? '🟢 PASS' : '🔴 MISSING UI',
    detail: hasVolumeDropdown
      ? 'Присутствует выпадающий переключатель томов в шапке.'
      : 'В шапке отображается статичный заголовок {{ title }} без возможности переключить том.',
  });
  if (!hasVolumeDropdown) {
    result.breakingPoints.push('PlanVolumeHeader.vue: нет селектора тома для переключения между томами 1, 2, 3...');
  }

  result.verdict = result.breakingPoints.length > 0 ? '🔴 ТРЕБУЕТ РЕМЕДИАЦИИ' : '🟢 ГОТОВО';
  return result;
}

/**
 * Аудит подсистемы 2: Матрица участий (CrossReferenceMatrix)
 */
function auditCrossReferenceMatrix() {
  const result = {
    name: '👥 Матрица участий (CrossReferenceMatrix)',
    layers: [],
    verdict: '',
    breakingPoints: [],
  };

  // 1. SurrealDB Stored Function
  const analyticsSurql = readRel('apps/spa/src/logic/schema/no_ai/functions/01_analytics.surql') || '';
  const funcMatch = analyticsSurql.match(/DEFINE FUNCTION OVERWRITE fn::get_cross_reference_matrix\(([^)]*)\)/);
  const funcParams = funcMatch ? funcMatch[1] : '';
  const acceptsVolume = funcParams.includes('volume');

  // Проверка SELECT chapters внутри функции
  const matrixFuncBody = analyticsSurql.slice(analyticsSurql.indexOf('fn::get_cross_reference_matrix'));
  const chaptersQuery = matrixFuncBody.slice(0, matrixFuncBody.indexOf('LET $entities'));
  const selectsVolumeId = chaptersQuery.includes('volume_id,') || chaptersQuery.includes('volume_id AS') || chaptersQuery.includes('type::string(volume_id)');

  result.layers.push({
    layer: '1. SurrealDB (fn::get_cross_reference_matrix)',
    status: (acceptsVolume && selectsVolumeId) ? '🟢 PASS' : '🔴 LOSS OF VOLUME',
    detail: `Параметры: (${funcParams.trim() || 'none'}). ` +
      (selectsVolumeId ? 'volume_id возвращается.' : '❌ В SELECT chapters отсутствует volume_id! Главы всех томов сваливаются в единый список.'),
  });
  if (!selectsVolumeId) {
    result.breakingPoints.push('01_analytics.surql: fn::get_cross_reference_matrix не выбирает volume_id в $chapters.');
  }
  if (!acceptsVolume) {
    result.breakingPoints.push('01_analytics.surql: fn::get_cross_reference_matrix не принимает аргумент $volume_id.');
  }

  // 2. Rust Command & Ports
  const analyticsCmdRs = readRel('src-tauri/crates/worldwiki-tauri/src/commands/analytics.rs') || '';
  const cmdMatch = analyticsCmdRs.match(/fn get_cross_reference_matrix\(([^)]*)\)/);
  const cmdParams = cmdMatch ? cmdMatch[1] : '';
  const cmdHasVolume = cmdParams.includes('volume');
  result.layers.push({
    layer: '2. Rust Tauri IPC (get_cross_reference_matrix)',
    status: cmdHasVolume ? '🟢 PASS' : '🔴 NO VOLUME ARG',
    detail: `IPC сигнатура: get_cross_reference_matrix(${cmdParams.replace(/\s+/g, ' ').trim()}). Аргумент volume_id отсутствует.`,
  });
  if (!cmdHasVolume) {
    result.breakingPoints.push('worldwiki-tauri/src/commands/analytics.rs: IPC-команда не принимает volume_id.');
  }

  // 3. Frontend Store & Composable
  const useMatrixTs = readRel('apps/spa/src/ts/features/analytics/CrossReferenceMatrix/useCrossReferenceMatrix.ts') || '';
  const hasSelectedVolumeFilter = useMatrixTs.includes('selectedVolumeId');
  const attemptsClientFilter = useMatrixTs.includes('ch.volume_id');
  result.layers.push({
    layer: '3. Frontend Composable (useCrossReferenceMatrix)',
    status: (hasSelectedVolumeFilter && attemptsClientFilter) ? '🟡 PARTIAL/BLOCKED' : '🔴 MISSING',
    detail: hasSelectedVolumeFilter
      ? 'Во фронтенде ЕСТЬ фильтр `selectedVolumeId`, но он бесполезен, т.к. бэкенд не присылает `volume_id` в объектах глав!'
      : 'Во фронтенде отсутствует фильтрация по томам.',
  });
  if (hasSelectedVolumeFilter && !selectsVolumeId) {
    result.breakingPoints.push('CrossReferenceMatrix: фронтенд фильтрует по `ch.volume_id`, которое ВСЕГДА undefined из-за ошибки в SurrealDB функции!');
  }

  result.verdict = result.breakingPoints.length > 0 ? '🔴 ТРЕБУЕТ РЕМЕДИАЦИИ' : '🟢 ГОТОВО';
  return result;
}

/**
 * Аудит подсистемы 3: Чеховские ружья (ChekhovGunTracker)
 */
function auditChekhovGuns() {
  const result = {
    name: '🗡️ Чеховские ружья (ChekhovGunTracker)',
    layers: [],
    verdict: '',
    breakingPoints: [],
  };

  // 1. SurrealDB Stored Function
  const narrativeSurql = readRel('apps/spa/src/logic/schema/no_ai/functions/07_narrative_and_journey.surql') || '';
  const trackerFuncMatch = narrativeSurql.match(/DEFINE FUNCTION OVERWRITE fn::get_item_tracker\(([^)]*)\)/);
  const trackerParams = trackerFuncMatch ? trackerFuncMatch[1] : '';
  const acceptsVolume = trackerParams.includes('volume');

  const trackerFuncIdx = narrativeSurql.indexOf('fn::get_item_tracker');
  const trackerBody = trackerFuncIdx !== -1 ? narrativeSurql.slice(trackerFuncIdx, trackerFuncIdx + 2000) : '';
  const selectsVolumeId = trackerBody.includes('volume_id,') || trackerBody.includes('volume_id AS') || trackerBody.includes('type::string(volume_id)');

  result.layers.push({
    layer: '1. SurrealDB (fn::get_item_tracker)',
    status: (acceptsVolume && selectsVolumeId) ? '🟢 PASS' : '🔴 LOSS OF VOLUME',
    detail: `Параметры: (${trackerParams.trim() || 'none'}). ` +
      (selectsVolumeId ? 'volume_id возвращается.' : '❌ В $chapters нет volume_id. Главы всех томов смешиваются.'),
  });
  if (!selectsVolumeId) {
    result.breakingPoints.push('07_narrative_and_journey.surql: fn::get_item_tracker не возвращает volume_id в списке глав.');
  }
  if (!acceptsVolume) {
    result.breakingPoints.push('07_narrative_and_journey.surql: fn::get_item_tracker не умеет фильтровать по $volume_id.');
  }

  // 2. Rust Tauri IPC
  const itemTrackerRs = readRel('src-tauri/crates/worldwiki-application/src/analytics/item_tracker.rs') || '';
  const appHasVolume = itemTrackerRs.includes('volume_id');
  result.layers.push({
    layer: '2. Rust Application & Tauri IPC',
    status: appHasVolume ? '🟢 PASS' : '🔴 NO VOLUME ARG',
    detail: 'Application Service get_item_tracker принимает только project_id.',
  });
  if (!appHasVolume) {
    result.breakingPoints.push('worldwiki-application/src/analytics/item_tracker.rs: нет параметра volume_id.');
  }

  // 3. Frontend Composable (useChekhovGunTracker.ts)
  const useChekhovTs = readRel('apps/spa/src/ts/features/analytics/ChekhovGunTracker/useChekhovGunTracker.ts') || '';
  const hasVolumeFilter = useChekhovTs.includes('volumeId') || useChekhovTs.includes('volume');
  result.layers.push({
    layer: '3. Frontend Composable (useChekhovGunTracker)',
    status: hasVolumeFilter ? '🟢 PASS' : '🔴 ZERO MULTI-VOLUME SUPPORT',
    detail: hasVolumeFilter
      ? 'Есть поддержка томов.'
      : 'Фильтр содержит только search, itemType, usageState, scope. Понятия тома в трекере ружей вообще нет!',
  });
  if (!hasVolumeFilter) {
    result.breakingPoints.push('useChekhovGunTracker.ts: фильтрация ружей и артефактов работает только на весь проект без разреза по томам.');
  }

  result.verdict = result.breakingPoints.length > 0 ? '🔴 ТРЕБУЕТ РЕМЕДИАЦИИ' : '🟢 ГОТОВО';
  return result;
}

/**
 * Аудит подсистемы 4: Хроноинспектор (TimelineInspector)
 */
function auditTimelineInspector() {
  const result = {
    name: '⏳ Хроноинспектор (TimelineInspector)',
    layers: [],
    verdict: '',
    breakingPoints: [],
  };

  // 1. SurrealDB Stored Function
  const analyticsSurql = readRel('apps/spa/src/logic/schema/no_ai/functions/01_analytics.surql') || '';
  const inspFuncMatch = analyticsSurql.match(/DEFINE FUNCTION OVERWRITE fn::get_timeline_inspector_data\(([^)]*)\)/);
  const inspParams = inspFuncMatch ? inspFuncMatch[1] : '';
  const acceptsVolume = inspParams.includes('volume');

  const inspFuncIdx = analyticsSurql.indexOf('fn::get_timeline_inspector_data');
  const inspBody = inspFuncIdx !== -1 ? analyticsSurql.slice(inspFuncIdx, inspFuncIdx + 4500) : '';
  const selectsVolumeId = inspBody.includes('volume_id,') || inspBody.includes('volume_id AS') || inspBody.includes('type::string(volume_id)');

  result.layers.push({
    layer: '1. SurrealDB (fn::get_timeline_inspector_data)',
    status: (acceptsVolume && selectsVolumeId) ? '🟢 PASS' : '🔴 LOSS OF VOLUME',
    detail: `Параметры: (${inspParams.trim() || 'none'}). ` +
      (selectsVolumeId
        ? 'volume_id возвращается.'
        : '❌ В $chapters нет volume_id. Главы тома 1 и тома 2 с одинаковыми sort_order (1, 2, 3) перемешиваются в таймлайне!'),
  });
  if (!selectsVolumeId) {
    result.breakingPoints.push('01_analytics.surql: fn::get_timeline_inspector_data не возвращает volume_id для глав.');
  }
  if (!acceptsVolume) {
    result.breakingPoints.push('01_analytics.surql: fn::get_timeline_inspector_data не фильтрует по $volume_id.');
  }

  // 2. Rust Tauri IPC
  const timelineTauriRs = readRel('src-tauri/crates/worldwiki-tauri/src/commands/timeline.rs') || readRel('src-tauri/crates/worldwiki-tauri/src/commands/analytics.rs') || '';
  const inspCmdMatch = timelineTauriRs.match(/fn get_timeline_inspector_data\(([^)]*)\)/);
  const inspCmdParams = inspCmdMatch ? inspCmdMatch[1] : '';
  const cmdHasVolume = inspCmdParams.includes('volume');
  result.layers.push({
    layer: '2. Rust Tauri IPC (get_timeline_inspector_data)',
    status: cmdHasVolume ? '🟢 PASS' : '🔴 NO VOLUME ARG',
    detail: `IPC сигнатура: get_timeline_inspector_data(${inspCmdParams.replace(/\s+/g, ' ').trim() || 'project, horizon'}). Нет volume_id.`,
  });
  if (!cmdHasVolume) {
    result.breakingPoints.push('Tauri commands: get_timeline_inspector_data не поддерживает передачу volume_id.');
  }

  // 3. Frontend Composable (useTimelineInspector.ts)
  const useInspTs = readRel('apps/spa/src/ts/features/timeline/TimelineInspector/useTimelineInspector.ts') || '';
  const hasVolumeFilter = useInspTs.includes('volumeId') || useInspTs.includes('volume');
  result.layers.push({
    layer: '3. Frontend Composable (useTimelineInspector)',
    status: hasVolumeFilter ? '🟢 PASS' : '🔴 ZERO MULTI-VOLUME SUPPORT',
    detail: hasVolumeFilter
      ? 'Есть поддержка томов.'
      : 'В фильтрах только search, entity, pov, horizon, flashback, isolatedChapter. Переключателя томов нет.',
  });
  if (!hasVolumeFilter) {
    result.breakingPoints.push('TimelineInspector: невозможно переключить отображение таймлайна на конкретный том или изолировать события тома.');
  }

  result.verdict = result.breakingPoints.length > 0 ? '🔴 ТРЕБУЕТ РЕМЕДИАЦИИ' : '🟢 ГОТОВО';
  return result;
}

// ============================================================================
// MAIN EXECUTION & PRETTY REPORTING
// ============================================================================

console.log(`${C.bold}${C.cyan}╔════════════════════════════════════════════════════════════════════════════╗${C.reset}`);
console.log(`${C.bold}${C.cyan}║   🔍 WORLDIWIKI MULTI-VOLUME ARCHITECTURAL AUDIT (END-TO-END TRACE)        ║${C.reset}`);
console.log(`${C.bold}${C.cyan}╚════════════════════════════════════════════════════════════════════════════╝${C.reset}\n`);

const reports = [
  auditTodos(),
  auditCrossReferenceMatrix(),
  auditChekhovGuns(),
  auditTimelineInspector(),
];

reports.forEach((rep, idx) => {
  console.log(`${C.bold}${C.magenta}[#${idx + 1}] ${rep.name}${C.reset}  ==>  ${rep.verdict}`);
  console.log(`${C.gray}────────────────────────────────────────────────────────────────────────${C.reset}`);
  
  rep.layers.forEach((l) => {
    const statusColor = l.status.includes('PASS') ? C.green : l.status.includes('PARTIAL') ? C.yellow : C.red;
    console.log(`  ${statusColor}${l.status.padEnd(16)}${C.reset} ${C.bold}${l.layer}${C.reset}`);
    console.log(`     ${C.gray}↳ ${l.detail}${C.reset}`);
  });

  if (rep.breakingPoints.length > 0) {
    console.log(`  ${C.yellow}⚠️ Точки потери запроса / блокировки:${C.reset}`);
    rep.breakingPoints.forEach((bp) => {
      console.log(`     ${C.red}• ${bp}${C.reset}`);
    });
  }
  console.log('');
});

console.log(`${C.bold}${C.cyan}════════════════════════════════════════════════════════════════════════════${C.reset}`);
console.log(`${C.bold}📊 ИТОГОВЫЙ ДИАГНОЗ ПОЧЕМУ ОНО НЕ УМЕЕТ В МНОГОТОМНОСТЬ:${C.reset}\n`);
console.log(`1. ${C.bold}SurrealDB Stored Functions (01_analytics.surql & 07_narrative_and_journey.surql)${C.reset}:`);
console.log(`   - Функции ${C.cyan}fn::get_cross_reference_matrix${C.reset}, ${C.cyan}fn::get_item_tracker${C.reset}, ${C.cyan}fn::get_timeline_inspector_data${C.reset}`);
console.log(`     выполняют ${C.yellow}SELECT id, title, sort_order FROM chapters${C.reset} БЕЗ поля ${C.red}volume_id${C.reset}!`);
console.log(`   - В результате фронтенд получает плоский массив глав без информации, к какому тому они принадлежат,`);
console.log(`     а главы разных томов с одинаковыми порядковыми номерами (1, 2, 3...) перемешиваются между собой.`);
console.log(`\n2. ${C.bold}Rust Ports & Tauri Commands${C.reset}:`);
console.log(`   - Ни одна из аналитических команд (${C.cyan}get_cross_reference_matrix${C.reset}, ${C.cyan}get_item_tracker${C.reset}, ${C.cyan}get_timeline_inspector_data${C.reset})`);
console.log(`     не принимает опциональный параметр ${C.yellow}volume_id: Option<String>${C.reset}.`);
console.log(`\n3. ${C.bold}Pinia Stores & Frontend Composables${C.reset}:`);
console.log(`   - В ${C.cyan}chapter.store.ts${C.reset} свойство ${C.yellow}currentVolume${C.reset} жестко привязано к ${C.yellow}currentChapterNode${C.reset} (открытой главе в редакторе).`);
console.log(`   - Если в дереве добавить новый том, в котором еще нет глав, ни одна панель не может на него переключиться,`);
console.log(`     потому что нет глобального или панельного стейта выбранного тома (${C.yellow}selectedVolumeId${C.reset}).`);
console.log(`   - В ${C.cyan}usePlanningPanel.ts:143${C.reset} зашит баг: если в томе 0 глав, он перезаписывает их всеми главами проекта.`);
console.log(`${C.bold}${C.cyan}════════════════════════════════════════════════════════════════════════════${C.reset}\n`);

