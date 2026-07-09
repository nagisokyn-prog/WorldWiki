/**
 * Сервис сохранения двунаправленных отношений.
 * Использует динамическое чтение JSON-схемы сущностей, чтобы избежать хардкода путей.
 */

import { apiService } from './api.service';

function getDeepProp(obj: any, path: string): any {
  if (!path || !obj) return undefined;
  return path.split('.').reduce((cur, k) => (cur && cur[k] !== undefined ? cur[k] : undefined), obj);
}

function setDeepProp(obj: any, path: string, value: any) {
  const parts = path.split('.');
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    if (!cur[parts[i]]) cur[parts[i]] = {};
    cur = cur[parts[i]];
  }
  cur[parts[parts.length - 1]] = value;
}

/**
 * Подготавливает сущность к сохранению в БД.
 * Синхронизирует вложенные списки (например, динамика_отношений -> relationshipStates)
 * на основе JSON-схемы, без использования хардкодных ключей.
 */
export async function prepareEntityForSave(entityType: string, dataToSave: any): Promise<void> {
  let schema: any;
  try {
    const res = await fetch(`/struct/editor/${entityType}.json`);
    if (res.ok) schema = await res.json();
  } catch (e) {
    console.warn(`[RelSave] Не удалось загрузить схему для ${entityType}`);
    return;
  }

  if (!schema) return;

  for (const section of schema.sections || []) {
    for (const dc of section.dynamicContainers || []) {
      const containerId = dc.id;
      const arrayPath = dc.dataPath || dc.id;

      // СИНХРОНИЗАЦИЯ: Если UI использует плоский путь (containerId), а БД требует структурированный (arrayPath)
      if (containerId !== arrayPath && dataToSave[containerId] && Array.isArray(dataToSave[containerId])) {
        setDeepProp(dataToSave, arrayPath, JSON.parse(JSON.stringify(dataToSave[containerId])));
      }

      const tpl = schema.templates?.[dc.template];
      if (tpl && tpl.dynamicContainers) {
        const arr = getDeepProp(dataToSave, arrayPath);
        
        if (Array.isArray(arr)) {
          for (const item of arr) {
            for (const nestedDc of tpl.dynamicContainers) {
              const nestedDataPath = nestedDc.dataPath || nestedDc.id;
              if (item[nestedDataPath] && Array.isArray(item[nestedDataPath])) {
                // Копируем данные из frontend-поля во внутреннее поле (id) для Rust
                item[nestedDc.id] = JSON.parse(JSON.stringify(item[nestedDataPath]));
              }
            }
          }
        }
      }
    }
  }
}

/**
 * Сохраняет встречные отношения B→A для всех записей foreignUpdates.
 */
export async function saveForeignRelationships(
  projectName: string,
  sourceEntityRawId: string,
  foreignUpdates: Record<string, any>
): Promise<void> {
  if (!foreignUpdates || Object.keys(foreignUpdates).length === 0) return;

  for (const key in foreignUpdates) {
    const update = foreignUpdates[key];
    if (!update?.entityType || !update?.entityId) continue;

    try {
      // 1. Загружаем целевую сущность
      const targetEntity: any = await apiService.getEntity(projectName, update.entityType, update.entityId);
      if (!targetEntity) continue;

      // 2. Загружаем схему целевой сущности
      let schema: any;
      try {
        const res = await fetch(`/struct/editor/${update.entityType}.json`);
        if (res.ok) schema = await res.json();
      } catch (e) {
        console.warn(`[RelSave] Не удалось загрузить схему ${update.entityType}`);
        continue;
      }

      if (!schema) continue;

      // 3. Ищем двунаправленный контейнер в схеме
      let targetDataPath = '';
      let targetLinkClass = '';
      let targetContainerId = '';
      let nestedContainers: any[] = [];

      for (const section of schema.sections || []) {
        for (const dc of section.dynamicContainers || []) {
          const tpl = schema.templates?.[dc.template];
          if (tpl && tpl.isBidirectional) {
            targetContainerId = dc.id;
            targetDataPath = dc.dataPath || dc.id;
            targetLinkClass = tpl.bidirectionalLinkClass;
            nestedContainers = tpl.dynamicContainers || [];
            
            // Если класс связи совпадает с тем, что пришел в обновлении (например, целевая_сущность)
            // ИЛИ если это вообще единственная связь
            if (targetLinkClass === update.linkClass) {
              break;
            }
          }
        }
        if (targetDataPath && targetLinkClass === update.linkClass) break;
      }

      if (!targetDataPath || !targetLinkClass) {
        console.warn(`[RelSave] В схеме ${update.entityType} не найден двунаправленный контейнер для ${update.linkClass}`);
        continue;
      }

      // 4. Получаем массив связей из целевой сущности
      let relationshipArray = getDeepProp(targetEntity, targetDataPath);
      if (!Array.isArray(relationshipArray)) relationshipArray = [];

      // 5. Удаляем старое встречное отношение
      const filtered = relationshipArray.filter(
        (r: any) => {
            const currentVal = String(r[targetLinkClass]);
            return currentVal !== String(sourceEntityRawId) && currentVal !== String(update.backLinkValue);
        }
      );
      
      if (!update.__deleted) {
        const reverseRel = JSON.parse(JSON.stringify(update.data));
        reverseRel[targetLinkClass] = update.backLinkValue || sourceEntityRawId;

        // 6. Синхронизируем вложенные списки для встречного отношения (динамика_отношений -> relationshipStates)
        for (const nc of nestedContainers) {
          const ncDataPath = nc.dataPath || nc.id;
          if (reverseRel[ncDataPath] && Array.isArray(reverseRel[ncDataPath])) {
            reverseRel[nc.id] = JSON.parse(JSON.stringify(reverseRel[ncDataPath]));
          }
        }

        filtered.push(reverseRel);
      } else {
         console.log(`[RelSave] 🗑️ Удаление встречной связи ${sourceEntityRawId} из ${update.entityId}`);
      }

      // 7. Сохраняем в целевую сущность по правильному пути
      setDeepProp(targetEntity, targetDataPath, filtered);
      if (targetContainerId && targetContainerId !== targetDataPath) {
        setDeepProp(targetEntity, targetContainerId, JSON.parse(JSON.stringify(filtered)));
      }

      // Также прогоняем всю сущность через prepareEntityForSave на всякий случай
      await prepareEntityForSave(update.entityType, targetEntity);

      // 8. Сохраняем в БД
      const titleField = schema.titleField || 'название';
      const nameField = targetEntity[titleField] || targetEntity.название || targetEntity.name || '';
      
      await apiService.saveEntity(projectName, update.entityType, targetEntity, update.entityId, nameField);

    } catch (err) {
      console.error(`[RelSave] ❌ Ошибка сохранения встречного отношения для ${update.entityId}:`, err);
    }
  }
}
