/**
 * @file storage.purge.ts
 * @description Утилита для очистки всех изолированных ключей localStorage, связанных с проектом.
 */

/**
 * Удалить все ключи в localStorage, относящиеся к указанному проекту.
 * Предотвращает утечку и "воскрешение" сюжетных блоков, обещаний,
 * старых состояний глав и схем при удалении или пересоздании проекта.
 * 
 * @param projectName - Имя проекта (например, 'default' или 'projects:default')
 */
export function purgeProjectStorage(projectName?: string | null): void {
  if (typeof localStorage === 'undefined' || !projectName) return;

  const rawName = projectName.replace(/^projects:/, '').trim();
  if (!rawName) return;

  const staticKeys = [
    `ww_plot_promises_${rawName}`,
    `ww_plot_promises_projects:${rawName}`,
    `worldwiki-state-${rawName}`,
    `worldwiki-state-projects:${rawName}`,
    `ww_schema_synced_${rawName}`,
    `ww_schema_synced_projects:${rawName}`,
    `entity-editor-draft-${rawName}`,
    `chapters-sidebar-selected-arc-id`,
  ];

  staticKeys.forEach((k) => {
    try {
      localStorage.removeItem(k);
    } catch (err) {
      console.warn(`[storage.purge] Failed to remove static key ${k}:`, err);
    }
  });

  // Сканируем все ключи localStorage для удаления динамических записей (черновики, главы и т.д.)
  try {
    const keysToRemove: string[] = [];
    const len = localStorage.length;
    for (let i = 0; i < len; i++) {
      const key = localStorage.key(i);
      if (!key) continue;

      if (
        key.includes(`_${rawName}`) ||
        key.includes(`-${rawName}`) ||
        key.includes(`:${rawName}`)
      ) {
        keysToRemove.push(key);
      }
    }

    keysToRemove.forEach((k) => {
      try {
        localStorage.removeItem(k);
      } catch (err) {
        console.warn(`[storage.purge] Failed to remove dynamic key ${k}:`, err);
      }
    });
  } catch (err) {
    console.warn('[storage.purge] Failed to scan localStorage keys:', err);
  }
}
