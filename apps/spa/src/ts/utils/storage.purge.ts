/**
 * @file storage.purge.ts
 * @description Утилита для очистки всех ключей localStorage, связанных с проектом.
 *
 * Реестр ключей (актуализировано):
 *
 * === PER-PROJECT (динамические) ===
 * ww_plot_promises_{project}                  — usePromisesPanel / usePromiseActions
 * ww_plot_promises_projects:{project}         — алиас с префиксом
 * worldwiki-state-{project}                   — shell.persistence (getStateKey)
 * worldwiki-state-projects:{project}          — алиас с префиксом
 * worldwiki_schema_sync_v2_{project}          — entity.api (schema sync flag)
 * worldwiki:planets:{project}                 — calendar.store (planets)
 * editor-state-{project}-*                    — useTiptapState (getStateKey: `editor-state-${project}-${title}`)
 * entity-editor-draft-{project}               — entity editor draft
 * calendar-state-{project}-*                  — useCalendarEditor (getStateKey: `calendar-state-${project}-${calendarId}`)
 * calendar-scroll-{project}-*                 — useCalendarEditor (getScrollKey: `calendar-scroll-${project}-${calendarId}`)
 *
 * === PER-SESSION / GLOBAL (сбрасываем при смене/удалении проекта) ===
 * chapters-sidebar-selected-arc-id            — useChapterRightSidebar
 * chapters-sidebar-active-tab                 — useChapterRightSidebar
 * chapters-sidebar-plan-scope                 — useChapterRightSidebar
 *
 * === DEVICE-LEVEL (НЕ чистим — привязаны к устройству, не к проекту) ===
 * app-zoom                                    — zoom.ts
 * app-panel-height                            — shell.layout
 * app-sidebar-width                           — shell.layout
 * app-split-width                             — shell.layout
 * chapters-sidebar-width                      — useChapterLayout
 * chapters-right-panel-visible                — useChapterLayout
 * chapters-tools-panel-width                  — useChapterLayout
 * chapters-panel-promises-h                   — usePromiseResize
 * chapters-panel-timeline-h                   — useChapterRightSidebar
 * chapters-panel-participants-h               — useChapterRightSidebar
 * chapters-panel-volplan-h                    — useChapterRightSidebar
 * chapters-panel-chaplan-h                    — useChapterRightSidebar
 * split-view-show-structure                   — useTiptapSplitView
 * split-view-left-width                       — useTiptapSplitView
 * split-view-right-width                      — useTiptapSplitView
 * worldwiki-calendar-widget-height            — useCalendarResize
 * default-editor-mode                         — useTiptapState
 * quickLinkPanelHidden                        — useChapterLayout
 * hideQuickLinkHintForever                    — useChapterLayout
 * surreal_console_history_v1                  — useSurrealConsole
 * yandex_disk_token                           — useCloudSyncModal
 * perfLevel / perfCpuScore / perfMemoryMb / perfCores — Splash
 */

/**
 * Список глобальных ключей (не привязаны к имени проекта),
 * которые нужно сбрасывать при удалении/смене проекта.
 */
const GLOBAL_SESSION_KEYS: readonly string[] = [
  'chapters-sidebar-selected-arc-id',
  'chapters-sidebar-active-tab',
  'chapters-sidebar-plan-scope',
];

/**
 * Строит список префиксов и суффиксов, которые идентифицируют
 * ключ localStorage как принадлежащий конкретному проекту.
 *
 * Мы намеренно используем строгие разделители (`_`, `-`, `:`)
 * чтобы не зацепить ключи других проектов с похожим именем.
 */
function buildProjectMatchers(rawName: string): Array<(key: string) => boolean> {
  // Все варианты разделителей, после которых может стоять rawName
  const suffixPatterns = [
    `_${rawName}`,       // ww_plot_promises_novel1
    `-${rawName}`,       // worldwiki-state-novel1
    `:${rawName}`,       // worldwiki:planets:novel1  |  ww_plot_promises_projects:novel1
    `_${rawName}-`,      // editor-state-novel1-chapter (prefixed — начало)
    `-${rawName}-`,      // editor-state-novel1- (title after)
  ];

  return suffixPatterns.map((pattern) => (key: string) => {
    if (key.includes(pattern)) return true;
    // Также проверяем начало ключа (редкие случаи)
    if (key.startsWith(`${rawName}_`) || key.startsWith(`${rawName}-`) || key.startsWith(`${rawName}:`)) {
      return true;
    }
    return false;
  });
}

/**
 * Удалить все ключи в localStorage, относящиеся к указанному проекту.
 * Предотвращает утечку и «воскрешение» сюжетных блоков, обещаний,
 * старых состояний глав и схем при удалении или пересоздании проекта.
 *
 * @param projectName - Имя проекта (например, 'default' или 'projects:default')
 */
export function purgeProjectStorage(projectName?: string | null): void {
  if (typeof localStorage === 'undefined' || !projectName) return;

  // Нормализуем: убираем префикс 'projects:' если он есть
  const rawName = projectName.replace(/^projects:/, '').trim();
  if (!rawName) return;

  // --- 1. Явные статические ключи ---
  const staticKeys: string[] = [
    // Обещания (plot promises) — обе формы ключа
    `ww_plot_promises_${rawName}`,
    `ww_plot_promises_projects:${rawName}`,
    // Состояние shell (вкладки, открытые панели)
    `worldwiki-state-${rawName}`,
    `worldwiki-state-projects:${rawName}`,
    // Флаг синхронизации схем сущностей (РЕАЛЬНЫЙ ключ из entity.api.ts)
    `worldwiki_schema_sync_v2_${rawName}`,
    `worldwiki_schema_sync_v2_projects:${rawName}`,
    // Планеты (calendar.store)
    `worldwiki:planets:${rawName}`,
    `worldwiki:planets:projects:${rawName}`,
    // Черновик редактора сущностей
    `entity-editor-draft-${rawName}`,
    // Легаси-ключ (старое имя флага синхронизации — может остаться в старых профилях)
    `ww_schema_synced_${rawName}`,
    `ww_schema_synced_projects:${rawName}`,
    // Глобальные сессионные ключи
    ...GLOBAL_SESSION_KEYS,
  ];

  for (const key of staticKeys) {
    try {
      localStorage.removeItem(key);
    } catch (err) {
      console.warn(`[storage.purge] Failed to remove static key "${key}":`, err);
    }
  }

  // --- 2. Динамическое сканирование: editor-state-{project}-{title}, calendar entries, etc. ---
  // Сначала собираем снимок ключей (ВАЖНО: не итерируем и не удаляем одновременно —
  // это ломает индексы localStorage.key(i) в некоторых движках)
  const allKeys: string[] = [];
  try {
    const len = localStorage.length;
    for (let i = 0; i < len; i++) {
      const k = localStorage.key(i);
      if (k !== null) allKeys.push(k);
    }
  } catch (err) {
    console.warn('[storage.purge] Failed to snapshot localStorage keys:', err);
    return;
  }

  const matchers = buildProjectMatchers(rawName);
  const keysToRemove = allKeys.filter((key) =>
    // Пропускаем уже удалённые статические ключи (чтобы не дублировать предупреждения)
    !staticKeys.includes(key) &&
    matchers.some((match) => match(key))
  );

  for (const key of keysToRemove) {
    try {
      localStorage.removeItem(key);
    } catch (err) {
      console.warn(`[storage.purge] Failed to remove dynamic key "${key}":`, err);
    }
  }

  if (keysToRemove.length > 0) {
    console.info(`[storage.purge] Purged ${staticKeys.length} static + ${keysToRemove.length} dynamic keys for project "${rawName}"`);
  }
}
