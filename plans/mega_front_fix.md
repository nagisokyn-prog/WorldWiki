# MEGA FRONTEND FIX PLAN
## Полный план анализа и исправления фронтенда WorldWiki

> **Создан:** 26.07.2026  
> **Контекст:** Анализ 30+ файлов API/сервисов/сторов, ревью монорепо-архитектуры, обсуждение codegen'а Rust↔TS

---

## 📋 ОГЛАВЛЕНИЕ

1. [Исполнительное резюме](#1-исполнительное-резюме)
2. [Оценка текущей архитектуры](#2-оценка-текущей-архитектуры)
3. [Критические бутылочные горлышки](#3-критические-бутылочные-горлышки)
4. [Проблемы среднего приоритета](#4-проблемы-среднего-приоритета)
5. [Архитектурный техдолг](#5-архитектурный-техдолг)
6. [Фаза 1: Быстрые победы (1-2 дня)](#6-фаза-1-быстрые-победы-1-2-дня)
7. [Фаза 2: Batch API + Rust контракты (3-5 дней)](#7-фаза-2-batch-api--rust-контракты-3-5-дней)
8. [Фаза 3: Codegen Rust→TypeScript (1 неделя)](#8-фаза-3-codegen-rusttypescript-1-неделя)
9. [Фаза 4: Очистка архитектуры (1 неделя)](#9-фаза-4-очистка-архитектуры-1-неделя)
10. [Чек-лист миграции](#10-чек-лист-миграции)

---

## 1. ИСПОЛНИТЕЛЬНОЕ РЕЗЮМЕ

**Общая оценка архитектуры: 7/10** — Прагматичное, "surreal-first" Tauri+SurrealDB приложение. Работает для MVP, нужны системные фиксы для масштабирования.

**Ключевые сильные стороны:**
- ✅ Монорепо (pnpm + Turborepo) с чистым разделением: `apps/spa` | `packages/components` | `packages/resources`
- ✅ Component-Behind паттерн (`.vue` + `use*.ts` + `.model.ts` + `.style.css`)
- ✅ Pinia сторы мигрированы (shell, schema, console, floating, zoom)
- ✅ Доменное разделение API (`api/*.api.ts` + `Entity/` + `Calendars/`)
- ✅ Schema-driven UI (JSON схемы → динамические формы)
- ✅ CalendarMath — чистая TS доменная логика, портируемая в WASM/Rust

**Критические пробелы:**
- 🔴 **Нет синхронизации типов Rust↔TypeScript** — ручное дублирование, рантайм-баги
- 🔴 **N+1 паттерны invoke** — `entity.tree.ts`, `connections.service.ts`, `relationship-save.service.ts`
- 🔴 **God-object `apiService`** — 9 доменов в одном barrel export
- 🔴 **Смешанные паттерны стейта** — Class, Object, Composable, Pinia, `window.xxx` globals
- 🔴 **Клиентская логика связей** — должна быть в Rust транзакциях

---

## 2. ОЦЕНКА ТЕКУЩЕЙ АРХИТЕКТУРЫ

### 2.1 Структура монорепо (✅ Готово)
```
WorldWiki/
├─ apps/spa/                    # @worldwiki/spa — Бизнес-приложение
├─ packages/components/         # @worldwiki/components — Generic Vue lib (RCL)
├─ packages/resources/          # @worldwiki/resources — i18n, CSS, fonts, types
├─ tauri-surreal-kit/           # Rust backend (surreal_domain + tauri_shell)
└─ src-tauri/                   # Tauri host app
```

### 2.2 Фронтенд стек
- **TS target: ES2025**, `verbatimModuleSyntax: true`, `strict: true`
- **Vue 3.5+** (`<script setup>`, `defineModel`, `useTemplateRef`)
- **Vite 8** (multi-entry: splash, launcher, app, settings, ui_editor)
- **Pinia** для UI state
- **UnoCSS** (в ожидании фикса Vite 8 плагина)
- **Vitest 3+** + `@vue/test-utils`

### 2.3 API слой (Проанализированные файлы)
| Файл | Строк | Домен | Статус |
|------|-------|-------|--------|
| `api.service.ts` | 50 | Barrel export | 🔴 God object |
| `api/project.api.ts` | 30 | Проекты | ✅ Простое |
| `Entity/entity.api.ts` | 154 | Сущности | 🟡 N+1 в `getEntityList` |
| `api/chapter.api.ts` | 210 | Главы | 🟡 HTML парсинг в главном потоке |
| `api/calendar.api.ts` | 35 | Календари | ✅ Простое |
| `api/tag.api.ts` | 32 | Теги | 🟡 Race condition в `createNewTag` |
| `api/connection.api.ts` | 37 | Связи | ✅ Тонкое |
| `api/cloud.api.ts` | 18 | Облако/Экспорт | ✅ Простое |
| `api/search.api.ts` | 45 | Поиск/Медиа | 🔴 Утечка памяти (`URL.createObjectURL` без revoke) |

### 2.4 Сервисы (Проанализированные)
| Сервис | Паттерн | Проблемы |
|--------|---------|----------|
| `calendar.service.ts` | Class | Race condition в `getCalendars` (auto-create master) |
| `chapter.service.ts` | Class | Тонкая обёртка |
| `connections.service.ts` | Class + reactive state | O(N²) save, дублирование логики с relationship-save |
| `entity.service.ts` | Class | Тонкая обёртка |
| `project.service.ts` | Object | Вызывает `getProjects()` внутри `getProjectMetadata` = N+1 |
| `timeline.service.ts` | Class | Загружает все таймлайны сразу |
| `editor.service.ts` | Class | ToastUI wrapper, DOM-bound |
| `export.service.ts` | Class | Тонкая обёртка |
| `footnote.service.ts` | Class | Только локальный state |
| `relationship-save.service.ts` | Functions | **Каскад N×(fetch+save)** для обратных связей |
| `tags.service.ts` | Class + DOM | Race condition, нет дедупа |
| `Calendars/timeline-panel.ts` | Vue Component | Deep clone на каждый keystroke |

### 2.5 Сторы (✅ Мигрированы в Pinia)
- `shell.ts` — App shell, редакторы, сущности, главы, save manager
- `schema.ts` — Schema cache
- `console.ts` — Логи
- `floating.ts` — Floating windows
- `zoom.ts` — Zoom state
- `chapter.store.ts` — Иерархия глав, текущая глава

### 2.6 Типы (Текущее состояние — Ручное дублирование)
| Файл | Назначение | Проблема |
|------|------------|----------|
| `types/chapters.d.ts` | Интерфейсы глав | Дублирует типы `chapter.api.ts` |
| `types/entities.d.ts` | BaseEntity, Connection | Generic, теряет специфичные поля |
| `Entity/entity.types.ts` | Доменные типы | `Record<string, unknown>` везде |
| `Calendars/calendar.types.ts` | CalendarData, MoonConfig | Дублирует API типы |
| `api/tag.api.ts` | TagData | Inline интерфейс |

---

## 3. КРИТИЧЕСКИЕ БУТЫЛОЧНЫЕ ГОРЛЫШКИ

### 3.1 N+1 запросы в `entity.tree.ts:loadEntities()` 🔴
**Файл:** `apps/spa/src/ts/services/Entity/entity.tree.ts:105-111`
```typescript
for (const sect of entitySections.value) {
  const list = await entityApi.getEntityList(project, sect.type); // ← ОТДЕЛЬНЫЙ invoke НА КАЖДЫЙ ТИП
  newEntities[sect.type] = list;
}
```
**Влияние:** 5-10 типов сущностей = 5-10 round-trips к Rust при открытии проекта.  
**Фикс:** Batch API `get_entities_batch(project, types[]) → { type: EntityData[] }`

### 3.2 Полная перезагрузка иерархии при сохранении главы 🔴
**Файлы:** `chapter.store.ts:156` + `chapter.api.ts:113-126`
```typescript
await chapterService.save(project, newCh);
hierarchy.value = await apiService.getHierarchy(project); // ← ПЕРЕЗАГРУЖАЕТ ВСЕ ТОМА/АРКИ/ГЛАВЫ
```
**Влияние:** 100+ глав = полная сериализация + парсинг дерева при каждом сохранении.  
**Фикс:** Optimistic UI + инкрементальное обновление (`hierarchy.value.chapters.push(newCh)`)

### 3.3 Дубликат поисковых API 🔴
**Файлы:** `api/search.api.ts:10-17` vs `Entity/entity.api.ts:11-18`
```typescript
// Оба вызывают: invoke('search_entities', { project, query })
```
**Влияние:** Путаница, дрифт, двойное сопровождение.  
**Фикс:** Единый источник — `entityApi.searchEntities`, убрать из `searchApi`.

### 3.4 O(N²) сохранение связей + обратные отношения 🔴
**Файлы:** `connections.service.ts:188-283` + `relationship-save.service.ts:73-178`

**`connections.service.ts`:** На каждый элемент отношения → создаёт **2 записи** (прямая + обратная) → батч `save_connections`.

**`relationship-save.service.ts`:** Для КАЖДОЙ обратной связи:
1. `fetch target entity` (invoke)
2. `fetch target schema` (fetch `/struct/editor/{type}.json`)
3. `filter array` (клиентская сторона)
4. `saveEntity` (invoke)

**Влияние:** 20 связей = **40 round-trips** + фетчи схем.  
**Фикс:** Перенести в Rust — `upsert_connections_batch` + `save_entity_with_relations` (транзакционно).

### 3.5 Race condition в тегах 🔴
**Файл:** `tags.service.ts:136-146`
```typescript
async createNewTag(name: string) {
  const existing = this.globalTags.find(t => t.name.toLowerCase() === name.toLowerCase());
  if (existing) return;
  await apiService.saveTag(this.project!, { name, color: '#3498db' }); // ← НЕТ БЛОКИРОВКИ
  this.globalTags.push({ name, color: '#3498db' });
}
```
**Влияние:** Быстрый ввод → дубликаты тегов в БД.  
**Фикс:** Debounce + клиентский дедуп + `upsert_tag` в Rust.

### 3.6 Утечка памяти: Blob URL никогда не отзывается 🔴
**Файл:** `search.api.ts:25-44`
```typescript
const blob = new Blob([new Uint8Array(bytes)], { type: mimeType });
return URL.createObjectURL(blob); // ← НИКОГДА НЕ revokeObjectURL
```
**Влияние:** 50+ фото = утечка памяти, краш вкладки.  
**Фикс:** Отслеживать URL'ы, `URL.revokeObjectURL` на unmount/уничтожении компонента.

### 3.7 Race condition в календаре 🔴
**Файл:** `calendar.service.ts:15-50`
```typescript
async getCalendars(projectName) {
  const list = await apiService.getCalendars(projectName);
  if (!hasMaster) {
    // Auto-create master — ДВА параллельных вызова = ДВА календаря создано
    await this.saveCalendar(...);
  }
}
```
**Влияние:** Двойной мастер-календарь при конкурентных вызовах.  
**Фикс:** `once` флаг / мьютекс на уровне сервиса.

---

## 4. ПРОБЛЕМЫ СРЕДНЕГО ПРИОРИТЕТА

| # | Проблема | Файл | Фикс |
|---|----------|------|------|
| 8 | HTML парсинг в `saveChapter` в главном потоке | `chapter.api.ts:71-95` | Web Worker или lazy |
| 9 | Нет дедупа/кэширования запросов | Все `api/*.ts` | LRU кэш (TTL 10-30с) для `getSchemas`, `getHierarchy`, `getTags`, `getCalendars` |
| 10 | `entity.api.getEntityList` — клиентский `processIds` + маппинг | `entity.api.ts:20-28` | Нормализовать в Rust |
| 11 | Deep clone на каждый keystroke в таймлайне | `timeline-panel.ts:288,310,319,338,350` | `shallowRef` + точечная мутация / Immer |
| 12 | `projectService.getProjectMetadata` вызывает `getProjects()` | `project.service.ts:111` | Отдельный эндпоинт или кэш |
| 13 | `invoke<any>`, `unknown[]` — нет type safety | Все API файлы | Codegen (Фаза 3) |

---

## 5. АРХИТЕКТУРНЫЙ ТЕХДОЛГ

| Долг | Местоположение | Последствия |
|------|----------------|-------------|
| God-object `apiService` | `api.service.ts` | Нет tree-shaking, риск циклических депов, 9 доменов зацеплены |
| Смешанные паттерны стейта | Class (`CalendarService`), Object (`projectService`), Composable (`useEntityTree`), Pinia (`chapterStore`), Globals (`window.xxx`) | Когнитивная нагрузка, адское тестирование, проблемы HMR |
| `window.xxxService` globals | Все сервисы | Загрязняет глобальную область, ломает HMR, мешает SSR |
| Клиентская логика связей | `relationship-save.service.ts`, `connections.service.ts` | Должна быть в Rust транзакциях (ACID) |
| Нет codegen Rust→TS | Ручные `.d.ts` | Дрифт, рантайм-ошибки, 30 мин на новый тип сущности |
| Нет TanStack Query | Прямые `invoke` | Нет кэша, нет дедупа, нет optimistic updates |

---

## 6. ФАЗА 1: БЫСТРЫЕ ПОБЕДЫ (1-2 ДНЯ)

| Задача | Файл | Усилия | Влияние |
|--------|------|--------|---------|
| ✅ Убрать дубликат `searchApi.searchEntities` | `api/search.api.ts` | 10 мин | Устраняет путаницу |
| ✅ Добавить `URL.revokeObjectURL` в `getLocalPhotoUrl` | `api/search.api.ts:39` | 15 мин | Чинит утечку памяти |
| ✅ Добавить `once` флаг в `calendarService.getCalendars` | `calendar.service.ts:15` | 20 мин | Предотвращает двойной мастер |
| ✅ Debounce + дедуп в `tagsManager.createNewTag` | `tags.service.ts:136` | 30 мин | Предотвращает дубли тегов |
| ✅ Убрать `window.xxxService` присваивания | Все сервисы | 1 час | Включает HMR, тестирование |
| ✅ Добавить простой LRU кэш для `getSchemas`, `getHierarchy`, `getTags`, `getCalendars` | Новый `utils/requestCache.ts` | 2 часа | Режет 50%+ invoke вызовов |

### 6.1 Утилита Request Cache (Новый файл)
```typescript
// apps/spa/src/ts/utils/requestCache.ts
interface CacheEntry<T> { data: T; timestamp: number; }
const cache = new Map<string, CacheEntry<any>>();
const DEFAULT_TTL = 15_000; // 15с

export function getCached<T>(key: string): T | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > DEFAULT_TTL) { cache.delete(key); return null; }
  return entry.data;
}

export function setCache<T>(key: string, data: T): void {
  cache.set(key, { data, timestamp: Date.now() });
}

export function invalidateCache(prefix: string): void {
  for (const key of cache.keys()) { if (key.startsWith(prefix)) cache.delete(key); }
}
```

### 6.2 Пример использования
```typescript
// entity.tree.ts
const cached = getCached(`schemas:${project}`);
if (cached) return cached;
const schemas = await entityApi.getSchemas(project);
setCache(`schemas:${project}`, schemas);
```

---

## 7. ФАЗА 2: BATCH API + RUST КОНТРАКТЫ (3-5 ДНЕЙ)

### 7.1 Rust сторона: Новые батч-команды
**Файл:** `tauri-surreal-kit/backend/surreal_domain_macros/src/entity.rs` (расширить макрос)

```rust
// 1. Batch get entities
#[tauri::command]
pub async fn get_entities_batch(
    project: String,
    types: Vec<String>,
    state: tauri::State<'_, AppState>
) -> Result<serde_json::Value, String> {
    let mut result = serde_json::Map::new();
    for t in types {
        let items = ENTITY_REGISTRY.get(&t).find_all(state.surreal_db(), &project).await?;
        result.insert(t, serde_json::json!(items));
    }
    Ok(serde_json::json!(result))
}

// 2. Batch upsert connections (идемпотентно)
#[tauri::command]
pub async fn upsert_connections_batch(
    project: String,
    connections: Vec<ConnectionInput>, // { source, target, type, role, ... }
    state: tauri::State<'_, AppState>
) -> Result<serde_json::Value, String> {
    // Одиночная транзакция: DELETE existing для (source,target,type) + INSERT new
    // RETURNING created
}

// 3. Save entity with relations (транзакционно)
#[tauri::command]
pub async fn save_entity_with_relations(
    project: String,
    entity: serde_json::Value,
    relations: Vec<RelationInput>, // { link_class, target_id, data }
    state: tauri::State<'_, AppState>
) -> Result<serde_json::Value, String> {
    // 1. Upsert entity
    // 2. Для каждой relation: upsert connection + upsert reverse connection
    // 3. ВСЁ в ОДНОЙ SurrealDB транзакции
}
```

### 7.2 Фронтенд: Новый Batch API модуль
**Файл:** `apps/spa/src/ts/services/api/batch.api.ts`
```typescript
import { invoke } from '@worldwiki/components';

export const batchApi = {
  getEntitiesBatch: (project: string, types: string[]) =>
    invoke<Record<string, EntityData[]>>('get_entities_batch', { project, types }),

  upsertConnectionsBatch: (project: string, connections: ConnectionData[]) =>
    invoke<{ success: boolean; created: string[] }>('upsert_connections_batch', { project, connections }),

  saveEntityWithRelations: (project: string, entity: Record<string, unknown>, relations: RelationInput[]) =>
    invoke<{ success: boolean; entityId: string }>('save_entity_with_relations', { project, entity, relations }),
};
```

### 7.3 Фронтенд: Переписать потребителей
| Потребитель | Было | Стало |
|-------------|------|-------|
| `entity.tree.ts:loadEntities` | N × `getEntityList` | 1 × `getEntitiesBatch` |
| `connections.service.saveConnections` | 2N × `save_connections` | 1 × `upsertConnectionsBatch` |
| `relationship-save.service.saveForeignRelationships` | N × (fetch+save) | 1 × `saveEntityWithRelations` (включить reverse в payload) |

**Ожидаемое сокращение invoke:** 80-90% меньше round-trips при сохранении сущности.

---

## 8. ФАЗА 3: CODEGEN RUST → TYPESCRIPT (1 НЕДЕЛЯ)

### 8.1 Зачем Codegen?
- **Single source of truth** — Rust структуры определяют схему
- **Нулевые рантайм-ошибки типов** — TS компилируется против реальных Rust типов
- **Скорость** — Новый тип сущности = добавить Rust struct + `cargo build` → TS типы появляются
- **Безопасность рефакторинга** — Переименовать поле в Rust → TS ошибки покажут все использования

### 8.2 Инструментарий: `ts-rs` + Кастомные метаданные команд

#### Шаг 1: Добавить `ts-rs` к Rust сущностям
```toml
# surreal_domain_macros/Cargo.toml
[dependencies]
ts-rs = { version = "8", features = ["serde"] }
```

```rust
// В выходе макроса (генерируемый entity.rs struct)
use ts_rs::TS;

#[derive(TS, Serialize, Deserialize)]
#[ts(export, export_to = "../../../../apps/spa/src/ts/types/generated/")]
pub struct Character {
    pub id: Option<String>,
    pub project_id: Option<serde_json::Value>,
    pub name: String,
    pub age: i32,
    pub biography: String,
    // ...
}
```

#### Шаг 2: Генерация метаданных команд в JSON
```rust
// В макросе: собирать сигнатуры команд
#[derive(Serialize)]
struct CommandMeta {
    name: String,
    args: Vec<ArgMeta>,      // { name, ts_type: String }
    returns: String,         // TS type reference
    is_mutation: bool,
}

#[derive(Serialize)]
struct ArgMeta { name: String, ts_type: String }
```

Выход: `apps/spa/src/ts/api/generated/commands.meta.json`

#### Шаг 3: TypeScript Codegen скрипт
**Файл:** `scripts/codegen.ts`
```typescript
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { resolve } from 'path';

function generateCommands() {
  const meta = JSON.parse(readFileSync(resolve('apps/spa/src/ts/api/generated/commands.meta.json'), 'utf-8'));
  
  let output = `// AUTO-GENERATED - DO NOT EDIT\nimport { invoke } from '@worldwiki/components';\n\n`;
  
  for (const cmd of meta.commands) {
    const args = cmd.args.map(a => `${a.name}: ${a.ts_type}`).join(', ');
    const ret = cmd.returns;
    output += `export const ${cmd.name} = (${args}) => invoke<${ret}>('${cmd.name}', { ${cmd.args.map(a => a.name).join(', ')} });\n`;
  }
  
  writeFileSync(resolve('apps/spa/src/ts/api/generated/commands.ts'), output);
  
  // Barrel export
  writeFileSync(resolve('apps/spa/src/ts/api/generated/index.ts'), 
    `export * from './commands';\nexport * from '../types/generated';`);
}
```

#### Шаг 4: Vite плагин для дева
```typescript
// apps/spa/vite.config.ts
import { defineConfig } from 'vite';
import { generateCommands } from './scripts/codegen';

export default defineConfig({
  plugins: [{
    name: 'rust-ts-codegen',
    configureServer(server) {
      server.watcher.on('change', (file) => {
        if (file.endsWith('.rs') && file.includes('surreal_domain')) {
          console.log('[codegen] Rust changed, regenerating TS types...');
          generateCommands();
        }
      });
    }
  }]
});
```

#### Шаг 5: Использование во фронтенде
```typescript
// apps/spa/src/ts/services/api/character.api.ts
import { get_characters, save_character, delete_character } from '../api/generated';
import type { Character, CharacterInput } from '../types/generated';

export const characterApi = {
  list: (project: string) => get_characters(project),
  get: (id: string) => get_character(id),
  save: (data: CharacterInput) => save_character(data),
  delete: (id: string) => delete_character(id),
};
```

**Результат:** Ноль `any`, полный автокомплит, compile-time safety.

---

## 9. ФАЗА 4: ОЧИСТКА АРХИТЕКТУРЫ (1 НЕДЕЛЯ)

| Задача | Описание |
|--------|----------|
| **Разбить `apiService`** | Заменить barrel export на доменные composables: `useProjectApi()`, `useEntityApi()`, `useChapterApi()` через `provide/inject` |
| **Унифицировать паттерн стейта** | Мигрировать все Class/Object сервисы → Pinia stores + composables. Убрать `window.xxxService`. |
| **Добавить TanStack Query** | Обернуть все `invoke` в `useQuery`/`useMutation`. Авто-кэш, дедуп, инвалидация, optimistic updates. |
| **Перенести логику связей в Rust** | `upsert_connections_batch`, `save_entity_with_relations` — ACID в SurrealDB транзакции. |
| **Web Worker для HTML парсинга** | `chapter.api.ts` text-block extraction → вынести в worker. |
| **Immer для таймлайна** | Заменить `JSON.parse(JSON.stringify(events))` на `produce(draft => ...)` в `timeline-panel.ts`. |

---

## 10. ЧЕК-ЛИСТ МИГРАЦИИ

### Фаза 1: Быстрые победы ✅
- [x] Убрать дубликат `searchApi.searchEntities`
- [x] Починить `URL.revokeObjectURL` утечку в `search.api.ts`
- [x] Добавить мьютекс/once флаг в `calendarService.getCalendars`
- [x] Debounce + дедуп в `tagsManager.createNewTag`
- [x] Убрать все `window.xxxService = ...` присваивания
- [x] Добавить `utils/requestCache.ts` + завести в `entity.tree.ts`, `project.service.ts`, `tags.service.ts`, `calendar.service.ts`

### Фаза 2: Batch API ✅
- [x] Rust: Добавить команду `get_entities_batch` (макрос или вручную)
- [x] Rust: Добавить `upsert_connections_batch` (транзакционно)
- [x] Rust: Добавить `save_entity_with_relations` (транзакционно)
- [x] Фронтенд: Создать `api/batch.api.ts`
- [x] Фронтенд: Переписать `entity.tree.ts:loadEntities` → batch
- [x] Фронтенд: Переписать `connections.service.saveConnections` → batch
- [x] Фронтенд: Переписать `relationship-save.service.saveForeignRelationships` → batch
- [x] Тест: Проверить 80%+ сокращение invoke на сохранении сущности

### Фаза 3: Codegen ✅
- [x] Добавить `ts-rs` в `surreal_domain_macros`
- [x] Расширить макрос: эмитить `#[ts(export)]` на генерируемых структурах
- [x] Написать `scripts/codegen.js` для прямого парсинга `.rs` файлов (вместо тяжелых Rust-макросов)
- [x] Добавить команду `generate:api` в `package.json`
- [x] Добавить watch-папки в `tauri.conf.json` для автоматического рестарта Tauri при изменении бэкенда
- [x] Сгенерировать готовый `api.client.ts` с полной типизацией (no `any`)
- [x] Мигрировать первые домены (`chapter.api.ts`, `project.api.ts`)
- [x] Мигрировать оставшиеся домены (`entity`, `tag`, `connection`, `schemas`, и т.д.) - **СДЕЛАНО (TS ошибки полностью устранены!)**

### Фаза 4: Очистка
- [x] Разбить `apiService` → полностью удален, заменен на прямые импорты из сгенерированного `api.client.ts`!
- [ ] Мигрировать все сервисы в Pinia stores / composables
- [ ] Убрать все `window.xxxService` globals
- [ ] Добавить `@tanstack/vue-query` + обернуть все API вызовы
- [ ] Вынести HTML парсинг в Web Worker
- [ ] Заменить таймлайн deep-clone на Immer

---

## 📌 ЗАМЕТКИ И РЕШЕНИЯ

1. **`relationship-save.service.ts` + `connections.service.ts`** — **DEPRECATED**. Заменятся Rust батч-командами. Не вкладывать силы в их исправление.

2. **Текущие `.d.ts` файлы** (`chapters.d.ts`, `entities.d.ts`, `entity.types.ts`, `calendar.types.ts`) — **ВРЕМЕННЫЕ**. Полностью заменятся codegen выводом в `types/generated/`.

3. **Структура монорепо** — Уже соответствует `frontend_architecture_plan.md`. Изменений не требуется.

4. **Pinia миграция** — 5/6 сторов готово (shell, schema, console, floating, zoom). Остался `hotkeys`.

5. **UnoCSS** — Заблокирован багом Vite 8 `applyHtmlTransforms`. Отложить.

6. **Тестирование** — Добавить Vitest для composables после удаления `window.xxx` globals.

---

## 🎯 БЛИЖАЙШИЕ ДЕЙСТВИЯ (После сна)

1. **Начать Фазу 1** — 2-3 часа, высокий ROI, низкий риск
2. **Параллельно: Спроектировать Rust батч-команды** — Определить точные JSON формы для `get_entities_batch`, `upsert_connections_batch`, `save_entity_with_relations`
3. **Потом Фаза 2** — Основной performance unlock
4. **Фаза 3** — Долгосрочный множитель скорости разработки

---

*Конец Мега-Плана. Спи спокойно — codegen напишет сам себя завтра.*