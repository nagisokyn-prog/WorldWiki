# План архитектуры фронтенда WorldWiki (ES2025 + Vue 3.5+, монорепо из 3 приложений) 

> Статус: черновик архитектуры. Цель — разнести фронтенд на 3 приложения по аналогии с Blazor
> (WASM App / Razor Class Library / Shared Resources) поверх **pnpm workspaces + Turborepo**,
> на нативном **ES2025** и актуальном **Vue 3.5+**.

---

## 0. Принцип разбиения (аналогия с Blazor)

| Blazor | Наше решение | Назначение |
|--------|--------------|------------|
| Blazor WASM / Server App | **`apps/spa`** | Бизнес-приложение WorldWiki: точки входа, domain-сервисы, фичи-компоненты |
| Razor Class Library (RCL) | **`packages/components`** | Переиспользуемая библиотека Vue-компонентов и generic-composables (бывший `tauri-surreal-kit/frontend`) |
| Shared Resources (`.resx`, wwwroot) | **`packages/resources`** | Локализация (i18n), темы CSS, шрифты, ассеты, общие типы |

Каркас `tauri-surreal-kit` — **generic-инфраструктура**; его фронтенд-часть переезжает в
`packages/components`. Rust-бэкенд `tauri_shell` не трогаем — он лишь рантайм (окна/зум/настройки).

### Почему pnpm workspaces + Turborepo
- **pnpm**: строгие связи (пакет видит только прописанное в `dependencies`), быстрый content-addressable cache.
- **Turborepo**: инкрементальный/параллельный билд и кеш задач (`build`, `test`, `lint`) поверх pnpm.
  Добавляем сразу, чтобы не переписывать CI позже. Настраивается `turbo.json`, не ломает структуру пакетов.
- Репозиторий пока **один** (git). `tauri-surreal-kit` живёт внутри монорепо как папка;
  когда захочешь вынести — забираешь `packages/components` + `packages/resources` в отдельный репо
  (submodule / npm-пакет), структура уже готова.

---

## 1. Целевая структура (monorepo)

```
WorldWiki/
├─ pnpm-workspace.yaml
├─ turbo.json
├─ tsconfig.base.json            # target ES2025, strict, verbatimModuleSyntax
├─ package.json                  # root, scripts через turbo
├─ apps/
│  └─ spa/                       # === SPA (WorldWiki) ===
│     ├─ package.json            # name: @worldwiki/spa
│     ├─ vite.config.ts          # multi-entry (splash, launcher, app, settings, ui_editor)
│     ├─ vitest.config.ts
│     ├─ tsconfig.json
│     └─ src/
│        ├─ entries/             # *.html точки входа (app.html, settings.html, ...)
│        ├─ app/                 # тонкие точки входа (app.ts, chapters.ts, project_launcher.ts, ui_editor.ts, settings.ts)
│        ├── stores/             # Pinia stores (shell, editor, entities, chapters, save, schema, console, floating, zoom)
│        ├── composables/        # доменные: useWorldWikiShell, useEntityLoader, useChapterOps, usePersistence,
│        │                       #            useHotkeys, useResizers, useFloatingEditors, useQuickOpen
│        ├─ services/            # domain: chapter, calendar, timeline, export, relationship-save, entity, project, tags
│        ├─ features/            # фичи-папки (Component-Behind):
│        │  ├─ chapters/         # ChaptersMain/, ChapterTree/, EditorCoreTiptap/
│        │  ├─ entities/         # EntityEditor/, RelationshipBlock/
│        │  ├─ schema/           # SchemaEditorMain/, SchemaCanvas/, SchemaSection/, SchemaFieldEditor/
│        │  └─ calendars/        # CalendarsPanel/ + под-компоненты (Eras, Moons, Seasons, ...)
│        └─ types/               # domain-типы (chapters, entities, settings)
├─ packages/
│  ├─ components/                # === Components (RCL) ===
│  │  ├─ package.json            # name: @worldwiki/components
│  │  ├─ vite.library.config.ts  # build as Vue library (ESM)
│  │  ├─ tsconfig.json
│  │  └─ src/
│  │     ├─ components/Vue/       # ExplorerTree, FloatingWindow, CommandPalette, EditorGroupPane,
│  │     │                       # EditorTabBar, QuickOpen, Settings, TagsField, ThemeSwitcher,
│  │     │                       # TreeNodes, WorkspaceLayout, XboxWheel, HistorySidebar
│  │     ├─ composables/         # useShellApp, useEditorGroups, useTreeSelection
│  │     ├─ services/            # generic: api, dynamic, editor, entity, footnote, form, settings
│  │     └─ index.ts             # публичный API библиотеки
│  └─ resources/                # === Resources ===
│     ├─ package.json            # name: @worldwiki/resources
│     ├─ tsconfig.json
│     └─ src/
│        ├─ i18n/                # i18n.ts + locales/(ru, en)
│        ├─ styles/              # glass-theme, new-ui-theme, glass-animations, fonts.css, modules/
│        ├─ assets/              # images, svg, webfonts
│        ├─ types/               # общие *.d.ts (tauri, settings)
│        └─ index.ts
├─ tauri-surreal-kit/            # НЕ фронтенд (только Rust + конфиги)
│  ├─ backend/tauri_shell/       # окна, зум, настройки (без изменений)
│  └─ backend/surreal_domain/    # доменный слой БД (без изменений)
└─ src-tauri/                    # Tauri rust host приложения
```

---

## 2. Стек (ES2025 + последний писк Vue)

- **TypeScript `target: ES2025`**, `module: ESNext`, `moduleResolution: bundler`, `verbatimModuleSyntax: true`, `strict: true`.
- **Vue 3.5+**: `<script setup>`, `defineModel`, `useTemplateRef`, `useId`, `propsDestructure`.
- **Vite 8** — для `apps/spa` multi-entry; для `packages/components` и `packages/resources` — library build (ESM, `vue` как external).
- **Vitest 3+** + `@vue/test-utils` — юнит-тесты composables (без DOM где возможно).
- **vue-tsc** — type-check на CI через turbo.
- Нативные ES2025-фичи: `Promise.withResolvers`, Iterator helpers, top-level `await` в точках входа, `using` (через TS).

### `turbo.json` (пример)
```json
{
  "tasks": {
    "build":    { "dependsOn": ["^build"], "outputs": ["dist/**"] },
    "typecheck":{ "dependsOn": ["^build"] },
    "lint":     {},
    "test":     { "dependsOn": ["^build"] },
    "dev":      { "cache": false, "persistent": true }
  }
}
```

### `pnpm-workspace.yaml`
```yaml
packages:
  - "apps/*"
  - "packages/*"
```

---

## 3. Паттерн Component-Behind (расширение существующего)

Каждый «жирный» компонент → папка-фича (аналог `.razor` / `.razor.cs` / `.razor.css`):

```
features/entities/EntityEditor/
├─ EntityEditor.vue        # только <template> + биндинги (аналог .razor)
├─ useEntityEditor.ts      # вся логика (аналог .razor.cs)
├─ EntityEditor.model.ts   # типы/интерфейсы/константы компонента
└─ EntityEditor.style.css  # изолированные стили (аналог .razor.css)
```

Применяем к: `EntityEditor`, `EditorCoreTiptap`, `ChapterTree`, `ChaptersMain`, `SchemaEditorMain`.
`RedactSandbox.vue` — **удаляем**, канон = `SchemaEditorMain.vue`.

### Пример (тонкий .vue)
```vue
<template>
  <div class="entity-editor">
    <input v-model="state.title" />
    <button @click="saveEntity">Сохранить</button>
  </div>
</template>

<script setup lang="ts">
import { useEntityEditor } from './useEntityEditor';
import './EntityEditor.style.css';
const props = defineProps<{ entityId: string }>();
const { state, saveEntity } = useEntityEditor(props);
</script>
```

### Почему это улучшает архитектуру
1. Исчезают файлы по 1500 строк; `.vue` = верстка, `.ts` = алгоритм.
2. Нет Git-конфликтов: стили/разметка/логика правятся параллельно.
3. Логика в `use*.ts` легко покрывается Vitest (отвязана от DOM).

---

## 4. Текущее состояние (инвентаризация, из старого плана)

| Файл | Строк | Проблема |
|------|-------|----------|
| `src/ts/app/app.ts` | 111 | ✅ Всё в `setup()` вынесено в `useAppShell.ts` (716 строк). `app.ts` — только init + createApp + регистрация компонентов |
| `src/ts/services/api.service.ts` | 534 | ✅ Разбит по доменам (`api/*.api.ts`) |
| `src/ts/components/Vue/EntityEditor.vue` | 1046 | ✅ Распилен на `EntityEditor/` папку |

### Дублирование (критично)
- ✅ `app.ts` `saveAll` — логика вынесена в `useSaveManager`
- ✅ `getValueByPath/setValueByPath` — вынесены в `utils/path.ts`
- ✅ `RedactSandbox.vue` — удалён
- ✅ `useTreeSelection` — используется kit-версия
- ✅ `ChapterTree.vue` — использует `ExplorerTree` из `@worldwiki/components`
- `FloatingEntityEditor.vue` vs `FloatingWindow.vue` — остаётся
- `TagsManagerModal.vue` частично дублирует `TagsField.vue` — остаётся

---

## 5. Граница ответственности (важно)

`packages/components` — **generic-каркас**, НЕ содержит бизнес-логику world-wiki
(никаких `apiService.saveEntity`, загрузки глав/сущностей). В ките остаются универсальные механизмы:
группы вкладок, zoom, каркас шорткатов, toast/log-инфра, хуки-точки (`onSave`, `restoreExtra`, `serializeExtra`).

Вся world-wiki-специфика живёт в `apps/spa` и лишь **вызывает** composables кита, не меняя их.

```
SPA (apps/spa)  ──импортирует──▶  @worldwiki/components  (generic UI/infra)
       │                          @worldwiki/resources   (i18n, css, fonts, types)
       └──передаёт хуки──▶        useShellApp({ onSave, restoreExtra })
```

### Правило «куда класть логику»
- **Состояние/поведение экрана** → store в `apps/spa/src/ts/stores/` или composable в `composables/`/`features/*/use*.ts`.
- **Работа с БД/API/связями** → `apps/spa/src/ts/services/`.
- **Чистые утилиты (path, формат)** → `apps/spa/src/ts/utils/` (напр. `path.ts`).
- **Визуальный кусок UI** → отдельный `.vue` в `features/*/`.
- **Инфраструктура (вкладки, zoom, шорткаты, toast/log)** → `packages/components` (generic). SPA не пишет внутрь кита, а передаёт хуки-точки.
- **Локали/темы/шрифты/типы** → `packages/resources`.

---

## 6. Шаги миграции (чеклист) — СТАТУС НА 19.07.2026

> Легенда: ✅ сделано | 🟡 частично | ❌ не сделано

- [x] **1. Корень монорепо**: `pnpm-workspace.yaml`, `turbo.json`, `tsconfig.base.json` (ESNext+`verbatimModuleSyntax`), `eslint.config.js` (flat, ecmaVersion latest). `target: ESNext` (покрывает ES2025). Root `package.json` + turbo scripts.
- [x] **2. `packages/resources`**: создан `@worldwiki/resources`, перенесены `css/*`, `webfonts/`, `assets/`, `index.ts` экспортирует стили.
- [x] **3. `packages/components`**: `@worldwiki/components` — все 13+ Vue-компонентов, composables (`useShellApp`, `useEditorGroups`, `useTreeSelection`), generic-сервисы. Добавлены типы: `TreeNodeData`, `TreeSectionData` в `types.ts`.
- [x] **4. `apps/spa`**: `@worldwiki/spa` — перенесён `src/ts` → `apps/spa/src/ts`; `vite.config.ts` multi-entry; aliases.
- [x] **5. Декомпозиция монолитов**:
  - [x] `app/app.ts` → ВЕСЬ `setup()` вынесен в `useAppShell.ts` (716 строк). `app.ts` сокращён до 111 строк.
  - [x] `EntityEditor.vue` → папка `features/entities/EntityEditor/`
  - [x] `EditorCoreTiptap.vue` → папка `features/chapters/EditorCoreTiptap/`
  - [x] `ChapterTree.vue` → использует `ExplorerTree` из `@worldwiki/components`
  - [x] `ChaptersMain.vue` → `useEditorGroups` из кита
  - [x] `SchemaEditorMain.vue` → канон; `RedactSandbox.vue` удалён
- [x] **6. Удаление дублей/анти-паттернов**:
  - [x] `useTreeSelection` — используется kit-версия
  - [x] `refactored_app.ts` — удалён
  - [x] `dom-utils.ts` — удалён
  - [x] `connections.service` — переписан на реактивный `formData`
  - [x] `api.service.ts` — разбит на доменные модули
  - [x] `getValueByPath/setValueByPath` — вынесены в `utils/path.ts`
- [x] **7. Foundation (dev-стек + библиотеки)**:
  - [x] `vitest.config.ts` — vue() + happy-dom + aliases
  - [x] `apps/spa/vite.config.ts` — UnoCSS, AutoImport (vue-router, pinia), aliases
  - [x] `unocss.config.ts` — создан (плагин пока отключён из-за Vite 8 applyHtmlTransforms)
  - [x] `test/setup.ts` — мок Tauri API
  - [x] Library build для `packages/components` и `packages/resources` (ESM)
  - [x] `ARCHITECTURE.md` — создан
  - [x] `TS-исправления: useHotkeys.ts` — handleKeydown вынесен наружу
  - [x] `vite-env.d.ts` — типы для `__TAURI__` и `uno.css`
- [x] **8. Pinia внедрён**:
  - [x] `createPinia()` + `app.use(pinia)` в app.ts
  - [x] `stores/settings.ts` — store (обёртка над settingsService)
  - [x] `stores/index.ts` — barrel export
  - [x] `plans/PINIA_EXPORT.md` — полный план миграции состояний
- [x] **9. Миграция состояний в Pinia stores**:
  - [x] `stores/shell.ts` — миграция useAppShell, useEntityOps, useChapterOps, useSaveManager, useEntityLists
  - [x] `stores/schema.ts` — миграция useSchemaCache
  - [x] `stores/console.ts` — миграция useConsole
  - [x] `stores/floating.ts` — миграция useFloatingWindows
  - [x] `stores/zoom.ts` — миграция useZoom
- [ ] **10. UnoCSS**: подключить плагин (Vite 8 bug должен быть починен)
- [ ] **11. @tanstack/vue-query**: внедрить для серверного кеша (API)

---

## 7. План миграции на Pinia (подробно в `plans/PINIA_EXPORT.md`)

### Этапы (ВЫПОЛНЕНЫ ✅)
1. **Shell store** — useAppShell, useEntityOps, useChapterOps, useSaveManager, useEntityLists
2. **Schema store** — useSchemaCache
3. **Console store** — useConsole
4. **Floating store** — useFloatingWindows
5. **Zoom store** — useZoom

После миграции вся бизнес-логика и списки лежат в `shell.ts`, а EditorTabs управляется через `useEditorGroups`.

---

## 8. Модель окон Tauri (разбор «для Vue нужен только 1 html»)

**Миф:** «для Vue нужен только 1 html». В классическом веб-SPA — да, Vue монтируется в один `index.html`, навигация через `vue-router`. Но **WorldWiki — Tauri-приложение**, а в Tauri каждое **окно ОС = отдельный webview = отдельный HTML-файл**. Это не «лишнее», а архитектура multi-window.

### Реальные точки входа (из `src/*.html`)
| Файл | Роль | Отдельное окно? |
|------|------|----------------|
| `splash.html` | заставка: бенчмарк Rust, прогресс, редирект | ✅ окно загрузки |
| `project_launcher.html` | выбор/создание проекта | ✅ окно лаунчера |
| `app.html` | **главное окно** редактора | ✅ главное окно |
| `settings.html` | настройки UI | ✅ отдельное окно |
| `ui_editor.html` | плавающее окно редактора сущности | ✅ дочернее окно |

### Почему это НЕ нарушение архитектуры Vue
- Vue — просто рендерер в `#app`. В каждом окне создаётся **независимый Vue-app instance** (`createApp(...).mount('#app')`).
- Между окнами Tauri общается через `window.__TAURI__.core.invoke` (Rust) и `WebviewWindow`, а не через `vue-router`.
- `vue-router` тут **не нужен** — навигация «splash → launcher → app» это переходы между окнами ОС, не роуты внутри страницы.

---