/**
 * @file api.service.ts
 * @description Barrel-файл, агрегирующий доменные API-модули в единый apiService.
 *   Реальная реализация разбита по файлам в ./api/*.api.ts
 *   (project.api, entity.api, chapter.api, calendar.api, tag.api, connection.api, cloud.api, search.api).
 *   Интерфейс apiService сохранён для обратной совместимости со всеми существующими импортами.
 * @rust-ready ✅ Все invoke вызовы делегируются в доменные модули
 */

import { projectApi, type ProjectConfig, projectRecordId } from './api/project.api';
import { entityApi } from './Entity/entity.api';
import type { EntityData, SchemaInfo, EntityType } from './Entity/entity.types';
import { chapterApi } from './api/chapter.api';
import { calendarApi } from './api/calendar.api';
import { tagApi, type TagData } from './api/tag.api';
import { connectionApi, type ConnectionData } from './api/connection.api';
import { cloudApi } from './api/cloud.api';
import { batchApi } from './api/batch.api';
import { searchApi } from './api/search.api';

export type {
  ProjectConfig,
  EntityData,
  SchemaInfo,
  EntityType,
  TagData,
  ConnectionData
};

export { projectRecordId };

export const apiService = {
  ...projectApi,
  ...entityApi,
  ...chapterApi,
  ...calendarApi,
  ...tagApi,
  ...connectionApi,
  ...cloudApi,
  ...searchApi,
  ...batchApi,
};