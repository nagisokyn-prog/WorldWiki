# 🔌 apps/spa/src/ts/services/api — Справочник IPC-Ручек и Доменных API-Фасадов

> **Назначение**: Полный справочник транспортных IPC-ручек (`Tauri invoke`) из автогенерируемого [`../api.client.ts`](../api.client.ts) и доменных обёрток в `services/api/`.  
> **Кодогенерация**: `api.client.ts` генерируется скриптом `node scripts/codegen.js` — **не редактируйте его вручную**.

---

## 📁 Структура `services/api/`

- **Доменные фасады (`*.api.ts`)**: `project.api.ts` (`projectRecordId`, `projectApi`), `chapter.api.ts`, `calendar.api.ts`, `plot.api.ts` (`plotApi`), `batch.api.ts`, `connection.api.ts`, `cloud.api.ts` (`cloudApi`), `search.api.ts`, `tag.api.ts`.
- **Низкоуровневые и модульные обёртки**: `api.ai.ts`, `api.calendars.ts`, `api.chapters.ts`, `api.entities.ts`, `api.projects.ts`, `api.system.ts`, `ai.ts`, `entities.ts`, `manuscript.ts`, `plot_calendar.ts`, `projects.ts`.
- **Типы и реэкспорты**: [`api.types.ts`](./api.types.ts), [`types.ts`](./types.ts) (`SearchResult<T>`, `AutoExtendResult`, `ChapterHierarchy`, `ProjectSummary` и типы из `@/types/generated/*`).
- **Тесты (`__tests__/`)**: `batch.api.spec.ts`, `calendar.api.spec.ts`, `chapter.api.spec.ts`, `cloud.api.spec.ts`, `connection.api.spec.ts`, `plot.api.spec.ts`, `project.api.spec.ts`, `search.api.spec.ts`, `tag.api.spec.ts`.

---

## 📡 Реестр IPC-Ручек (`api.client.ts` -> Tauri `invoke`)

### 1. Проекты и Конфигурация
| Функция TS | Tauri команда | Параметры | Возврат |
|---|---|---|---|
| `getProjects()` | `get_projects` | — | `ProjectSummary[]` |
| `createProject(projectData)` | `create_project` | `projectData: unknown` | `string` |
| `getProjectConfig(name)` | `get_project_config` | `name: string` | `unknown` |
| `saveProjectConfig(name, config)` | `save_project_config` | `name: string, config: unknown` | `unknown` |
| `deleteProject(name)` | `delete_project` | `name: string` | `string` |

### 2. Сущности, Схемы, Связи и Ревизии
| Функция TS | Tauri команда | Параметры | Возврат |
|---|---|---|---|
| `getEntities` | `get_entities` | `project, entityType: string \| null` | `Entity[]` |
| `getEntitiesBatch` | `get_entities_batch` | `project, entityTypes: string[]` | `Record<string, Entity[]>` |
| `getEntity` | `get_entity` | `id: string` | `Entity \| null` |
| `saveEntity` | `save_entity` | `project, entity: Entity` | `Entity` |
| `saveEntityWithRelations` | `save_entity_with_relations` | `project, entity: Entity, foreignUpdates: Entity[]` | `Entity` |
| `deleteEntity` | `delete_entity` | `id: string` | `void` |
| `searchEntities` | `search_entities` | `project, query, entityType: string \| null` | `Entity[]` |
| `getEntityFullCard` | `get_entity_full_card` | `entityId: string` | `unknown` |
| `addEntityRelation` | `add_entity_relation` | `relation: unknown` | `void` |
| `getEntitySchemas` | `get_entity_schemas` | `project: string` | `EntitySchema[]` |
| `saveEntitySchema` | `save_entity_schema` | `project, schema: EntitySchema, maxSaves: number \| null` | `EntitySchema` |
| `deleteEntitySchema` | `delete_entity_schema` | `project, typeKey: string` | `void` |
| `getSchemaHistory` | `get_schema_history` | `project, typeKey: string` | `Record<string, unknown>[]` |
| `getEntityRevisions` | `get_entity_revisions` | `project, entityId: string` | `Record<string, unknown>[]` |
| `toggleSchemaHistoryPin` | `toggle_schema_history_pin` | `historyId, isPinned` | `void` |
| `toggleEntityHistoryPin` | `toggle_entity_history_pin` | `historyId, isPinned` | `void` |
| `getEntityRelations` | `get_entity_relations` | `project, entityId: string \| null` | `EntityRel[]` |
| `createEntityRelation` | `create_entity_relation` | `project, fromId, toId, rel: EntityRel` | `EntityRel` |
| `deleteEntityRelation` | `delete_entity_relation` | `id: string` | `void` |
| `getRelationSchemas` | `get_relation_schemas` | `project: string` | `RelationSchema[]` |
| `saveRelationSchema` | `save_relation_schema` | `project, schema: RelationSchema` | `RelationSchema` |
| `deleteRelationSchema` | `delete_relation_schema` | `project, relKey: string` | `void` |

### 3. Рукопись: Главы, Тома, Текстовые Блоки и Связи
| Функция TS | Tauri команда | Параметры | Возврат |
|---|---|---|---|
| `getChapters` | `get_chapters` | `project: string` | `Chapter[]` |
| `getChapter` | `get_chapter` | `id: string` | `Chapter \| null` |
| `createChapter` | `create_chapter` | `project, chapter: Chapter` | `Chapter` |
| `saveChapter` | `save_chapter` | `chapter: Chapter` | `Chapter` |
| `deleteChapter` | `delete_chapter` | `id: string` | `void` |
| `getChapterHierarchy` | `get_chapter_hierarchy` | `project: string` | `ChapterHierarchy` |
| `getChapterRevisions` | `get_chapter_revisions` | `project, chapterId` | `Record<string, unknown>[]` |
| `toggleChapterHistoryPin` | `toggle_chapter_history_pin` | `historyId, isPinned` | `void` |
| `saveTextBlocks` | `save_text_blocks` | `project, chapterId, html` | `void` |
| `createVolume` | `create_volume` | `project, title` | `unknown` |
| `updateVolume` | `update_volume` | `project, id, title` | `void` |
| `assignChapter` | `assign_chapter` | `project, chapterId, volumeId: string \| null` | `unknown` |
| `reorderNode` | `reorder_node` | `project, nodeType, id, sortOrder` | `void` |
| `autoExtendTimeline` | `auto_extend_timeline` | `project, chapterId, volumeId: string \| null` | `unknown` |
| `healDeletedChapter` | `heal_deleted_chapter` | `project, deletedChapterId, fallbackPoint` | `number` |
| `getConnections` | `get_connections` | `project, chapter: string \| null` | `unknown` |
| `saveConnections` | `save_connections` | `project, sourceId, data` | `void` |
| `upsertConnectionsBatch` | `upsert_connections_batch` | `project, sourceType, sourceId, connections: EntityRel[]` | `void` |
| `removeConnectionsBySource` | `remove_connections_by_source` | `project, eType, eId` | `number` |

### 4. Сюжет: Обещания, Планы, Задачи и Арки
| Функция TS | Tauri команда | Параметры | Возврат |
|---|---|---|---|
| `getPlotPromises` | `get_plot_promises` | `project` | `unknown[]` |
| `getPlotPromise` | `get_plot_promise` | `id` | `unknown \| null` |
| `plantPlotPromise` | `plant_plot_promise` | `promise: PlotPromise` | `void` |
| `savePlotPromise` | `save_plot_promise` | `project, data: PlotPromise` | `PlotPromise` |
| `deletePlotPromise` | `delete_plot_promise` | `id` | `void` |
| `completePlan` | `complete_plan` | `planId` | `void` |
| `auditVolumeConsistency` | `audit_volume_consistency` | `volumeId` | `unknown` |
| `getTodos` | `get_todos` | `ownerId` | `Todo[]` |
| `createTodo` | `create_todo` | `ownerId, text, sortOrder, arcId, dependsOn` | `string` |
| `setTodoStatus` | `set_todo_status` | `id, status` | `Todo` |
| `setTodoDependency` | `set_todo_dependency` | `id, dependsOn` | `Todo` |
| `autoStartChapter` | `auto_start_chapter` | `chapterId` | `void` |
| `updateTodo` | `update_todo` | `id, text` | `void` |
| `toggleTodo` | `toggle_todo` | `id` | `Todo` |
| `deleteTodo` | `delete_todo` | `id` | `void` |
| `getStoryArcs` | `get_story_arcs` | `projectId` | `StoryArc[]` |
| `saveStoryArc` | `save_story_arc` | `arc: StoryArc` | `string` |
| `deleteStoryArc` | `delete_story_arc` | `id` | `void` |
| `assignArcChapter` / `removeArcChapter` | `assign_arc_chapter` / `remove_arc_chapter` | `relation` / `arcId, chapterId` | `void` |
| `assignArcEntity` / `removeArcEntity` | `assign_arc_entity` / `remove_arc_entity` | `relation` / `arcId, entityId` | `void` |
| `getArcChapters` / `getArcsForChapter` / `getArcEntities` | `get_arc_*` | `arcId` / `chapterId` | `unknown[]` |

### 5. Календарь, Планеты и Таймлайн
| Функция TS | Tauri команда | Параметры | Возврат |
|---|---|---|---|
| `getGlobalTimeline` / `saveGlobalTimeline` | `get_global_timeline` / `save_global_timeline` | `project` / `project, data` | `unknown` |
| `getPlanetCalendarBundle` | `get_planet_calendar_bundle` | `project` | `unknown` |
| `savePlanet` / `deletePlanet` | `save_planet` / `delete_planet` | `params` / `project, planetId, cascade` | `unknown` |
| `saveCalendarDirect` / `deleteCalendarDirect` | `save_calendar_direct` / `delete_calendar_direct` | `project, calendarId, planetId, name, isMaster, data` / `calendarId` | `unknown` |
| `setMasterCalendar` | `set_master_calendar` | `project, planetId, calendarId` | `unknown` |
| `convertAbsoluteToLocal` | `convert_absolute_to_local` | `absoluteMinute, calendar, eraIndex` | `unknown` |
| `convertCalendarDate` | `convert_calendar_date` | `params` | `unknown` |

### 6. Литературная Аналитика
| Функция TS | Tauri команда | Параметры | Возврат |
|---|---|---|---|
| `getCrossReferenceMatrix` | `get_cross_reference_matrix` | `projectId` | `unknown` |
| `getTimelineInspectorData` | `get_timeline_inspector_data` | `projectId, readerChapterOrderLimit` | `unknown` |
| `getCharacterJourney` | `get_character_journey` | `projectId, entityId` | `unknown` |
| `getMultiCharacterJourney` | `get_multi_character_journey` | `projectId, entityIds, mode` | `unknown` |
| `getItemTracker` / `getItemJourney` | `get_item_tracker` / `get_item_journey` | `projectId` / `projectId, itemId` | `unknown` |
| `getManuscriptStatistics` | `get_manuscript_statistics` | `projectId` | `unknown` |

### 7. AI-Чат, Локальные Модели, HF Hub, RAG и AI-Фасады
- **Чат и ветки**: `getChatTree`, `getChatMessages`, `getMessageBranch`, `forkChat`, `saveChat`, `updateChatParent`, `sendChatMessage`, `cancelGeneration`, `deleteChatMessage`, `switchMessageVariant`, `editChatMessage`, `regenerateChatMessage`, `deleteAiChat`.
- **Профили, модели и разрешения**: `fetchAiModels`, `getAiprofiles`, `saveAiprofile`, `deleteAiprofile`, `executeAiToolDirect`, `aiRespondToolApproval`, `getToolPermissionsCatalog`, `saveToolPermission`, `saveAllToolPermissions`.
- **Локальный LLM & Hardware**: `getHardwareInfo`, `calculateQuantizationEstimates`, `getRecommendedLocalModels`, `listInstalledModels`, `loadLocalModel`, `unloadLocalModel`, `unloadAllLocalModels`, `deleteLocalModel`, `getAiCompletion`.
- **Hugging Face & RAG**: `fetchHfModels`, `downloadHfModel`, `reindexProjectLore`.
- **Консолидированные AI-фасады**: `aiQueryWorld`, `aiInspectEntity`, `aiManageEntity`, `aiReadManuscript`, `aiEditManuscript`, `aiChronology`, `aiTimelineManager`, `aiAuditConsistency`, `aiDelegateTask`.

### 8. Бэкапы, Яндекс.Диск, Экспорт, Система и DevTools
- **Бэкапы и облако**: `createCloudBackup`, `exportLocalBackup`, `restoreFromBackup`, `exchangeYandexToken`, `uploadToYandexDisk`, `syncYandexMedia`, `listYandexDiskBackups`, `downloadAndRestoreYandex`, `getLaunchArgs`.
- **Экспорт**: `exportChapters(project, chapters, format)`.
- **Медиа и система**: `uploadPhoto`, `copyBackgroundFile`, `getLocalFile`, `runPerformanceBenchmark`, `getPerformanceStyles`, `saveSettings`, `loadSettings`, `toggleFullscreen`, `getCustomThemes`, `loadTheme`, `saveCustomTheme`.
- **DevTools**: `executeRawSurql(query)`.

### 9. Макро-сгенерированные Entities & Relations CRUD (`surreal_domain`)
Автоматически сгенерированные `get*`, `get*s`, `save*`, `delete*`, `search*` для таблиц:
- **Сущности**: `StoryArc` (`getStoryArc`), `Volume`, `Todo`, `Calendar`, `Chat`, `AutoApprovalSetting`, `AiProfile`, `AiMode`, `Artifact`, `AiSkill`, `TextBlock`, `ChatMessage`, `AgentMemory`, `WebCache`, `DictionaryWord`.
- **Графовые рёбра** (`get*`, `create*`, `delete*`): `Cites`, `ParticipantOf`, `AdvancesArc`, `OccursAt`, `RevealedIn`.

---

## 🧪 Тестирование

```bash
pnpm test apps/spa/src/ts/services/api
```
