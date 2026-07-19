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
│        ├─ composables/         # доменные: useWorldWikiShell, useEntityLoader, useChapterOps, usePersistence,
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
- **Vite 6/7** — для `apps/spa` multi-entry; для `packages/components` и `packages/resources` — library build (ESM, `vue` как external).
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
| `src/ts/app/app.ts` | 1590 | Всё в одном `setup()`: state, persistence, CRUD глав, каскадное удаление, save+синхронизация связей, resize, хоткеи, quick-open, floating editors, toasts |
| `src/ts/components/Vue/RedactSandbox.vue` | 1162 | ДУБЛИРУЕТ `SchemaEditorMain.vue` — удалить |
| `src/ts/components/Vue/EntityEditor.vue` | 1046 | Рендер полей по схеме инлайн, инлайн-стили, история версий внутри |
| `src/ts/components/Vue/Chapters/EditorCoreTiptap.vue` | 992 | Тулбар + команды + режимы в одном файле |
| `src/ts/services/api.service.ts` | 534 | Крупный; разбить по доменам |
| `src/ts/components/Vue/SchemaEditor/SchemaEditorMain.vue` | 510 | Канонический редактор схем |

### Дублирование (критично)
- `app.ts` `saveAll` (~824–987) повторяет логику связей из `services/relationship-save.service.ts`.
- `getValueByPath/setValueByPath` в `app.ts` дублируют `getDeepProp/setDeepProp` из `relationship-save.service.ts`.
- `RedactSandbox.vue` ≈ `SchemaEditorMain.vue`.
- `src/ts/composables/useTreeSelection.ts` == `tauri-surreal-kit/frontend/src/js/composables/useTreeSelection.ts` (использовать версию кита).
- `ChapterTree.vue` (своё, 1000+ строк) vs `ExplorerTree.vue` (из кита).
- `FloatingEntityEditor.vue` vs `FloatingWindow.vue` (из кита).
- `TagsManagerModal.vue` частично дублирует `TagsField.vue` (из кита).

### Vanilla-JS анти-паттерны (удалить/переписать)
- `src/ts/glass-init.ts` — IIFE, мутация DOM, `window.*` → переписать эффекты в Vue-директивы (`v-ripple`, `v-glass-breathe`).
- `src/ts/utils/dom-utils.ts` — ручной DOM → удалить, управлять через шаблоны.
- `src/ts/services/connections.service.ts` `collectRelationshipsFromDOM()` — парсит HTML вместо реактивного стейта → связи в `ref/reactive`, сохранение = отправка JSON.

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
- **Состояние/поведение экрана** → composable в `apps/spa/src/composables/` или `features/*/use*.ts`.
- **Работа с БД/API/связями** → `apps/spa/src/services/`.
- **Чистые утилиты (path, формат)** → `apps/spa/src/utils/` (напр. `path.ts`).
- **Визуальный кусок UI** → отдельный `.vue` в `features/*/`.
- **Инфраструктура (вкладки, zoom, шорткаты, toast/log)** → `packages/components` (generic). SPA не пишет внутрь кита, а передаёт хуки-точки.
- **Локали/темы/шрифты/типы** → `packages/resources`.

---

## 6. Шаги миграции (чеклист) — СТАТУС НА 16.07.2026

> Легенда: ✅ сделано | 🟡 частично | ❌ не сделано

- [x] **1. Корень монорепо**: `pnpm-workspace.yaml`, `turbo.json`, `tsconfig.base.json` (ESNext+`verbatimModuleSyntax`), `eslint.config.js` (flat, ecmaVersion latest). `target: ESNext` (покрывает ES2025). Root `package.json` + turbo scripts.
- [x] **2. `packages/resources`**: создан `@worldwiki/resources`, перенесены `css/*` (glass-theme, new-ui-theme, glass-animations, fonts.css, modules/), `webfonts/`, `assets/`, `index.ts` экспортирует стили; типы `*.d.ts` перенесены в `apps/spa/src/ts/types`.
- [x] **3. `packages/components`**: `@worldwiki/components` — перенесён кит, все 13 Vue-компонентов, composables (`useShellApp`, `useEditorGroups`, `useTreeSelection`), generic-сервисы, `index.ts` как публичный API. Library build пока не настроен (импорт через `src/index.ts` напрямую), но для dev работает.
- [x] **4. `apps/spa`**: `@worldwiki/spa` — перенесён `src/ts` → `apps/spa/src/ts`; `vite.config.ts` multi-entry (splash/launcher/app/settings/ui_editor); alias `@worldwiki/components` + `@worldwiki/resources` + `@/` и т.д.; `tsconfig` extends base (ESNext).
- [x] **5. Декомпозиция монолитов — ЗАВЕРШЕНА (16.07.2026)**:
  - [x] `app/app.ts` → ВЕСЬ `setup()` вынесен в `useAppShell.ts` (648 строк). `app.ts` сокращён до 106 строк: только init + createApp + регистрация компонентов. `vue-tsc --noEmit` → 0 ошибок. ✅
  - [x] `EntityEditor.vue` → папка `features/entities/EntityEditor/` (`EntityEditor.vue` + `useEntityEditor.ts` + `EntityEditor.model.ts` + `EntityEditor.style.css`).
  - [x] `EditorCoreTiptap.vue` → папка `features/chapters/EditorCoreTiptap/` (`EditorCoreTiptap.vue` + `useTiptapEditor.ts` + `EditorToolbar.vue` + `EditorCoreTiptap.style.css`).
  - [x] `ChapterTree.vue` →kit-версия `useTreeSelection` из `@worldwiki/components` подключена; локальный дуб удалён. Компонент оставлен как кастомный (не заменяется на `ExplorerTree`). ✅
  - [x] `ChaptersMain.vue` → вкладки делегированы в `useEditorGroups` из кита (через `eg`). ✅
  - [x] `SchemaEditorMain.vue` → канон; `RedactSandbox.vue` **удалён** ✅.
- [x] **6. Удаление дублей/анти-паттернов**:
  - [x] Удалить `apps/spa/src/ts/composables/useTreeSelection.ts` → ✅ удалён (теперь используется kit-версия в `ChapterTree.vue` и `entity.tree.ts`).
  - [x] Удалить `apps/spa/src/ts/app/refactored_app.ts` → ✅ удалён.
  - [x] Удалить `apps/spa/src/ts/utils/dom-utils.ts` → ✅ удалён.
  - [x] `FloatingEntityEditor.vue` → более не используется как отдельный монолит; в `app.ts` задействован `<FloatingWindow>` из кита. ✅
  - [x] `connections.service.collectRelationshipsFromDOM()` → ✅ переписан: теперь читает реактивный `formData`, а не DOM. `saveAll` отправляет JSON.
  - [x] `api.service.ts` → ✅ разбит на доменные модули (`apps/spa/src/ts/services/api/*.api.ts`), barrel-файл сохранён для обратной совместимости.
  - [x] `apps/spa/src/ts/services/dynamic.service.ts`: ✅ убрана повторяющаяся глобальная декларация `Window.dynamicService` (уже есть в kit).
- [x] **7. Единые path/relationship-хелперы**: `relationship-save.service.ts` существует и используется в `saveAll` (`prepareEntityForSave`, `saveForeignRelationships`) через `useSaveManager`. Локальные `getValueByPath/setValueByPath` в `app.ts` УДАЛЕНЫ (заменены на `@/utils/path`). `utils/path.ts` создан. ✅
- [ ] **8. Документация**: `ARCHITECTURE.md` — ❌ НЕ создан. `frontend_architecture_plan.md` — ✅ обновлён (этот файл).

---

## 6.1 Что ещё НАДО доделать (актуальный остаток)

### Архитектура / монорепо
1. ❌ Настроить library build для `packages/components` и `packages/resources` (`vite-plugin-dts`, ESM, `vue` external) — сейчас импорт напрямую из `src/index.ts`.
2. ✅ `vitest.config.ts` (корень) — добавлен `vue()`, `environment: 'happy-dom'` (16.07.2026).
3. ✅ `apps/spa/vite.config.ts` — `checker` (vueTsc) и `vite-plugin-vue-devtools` включены в `plugins` (16.07.2026).
4. 🟡 Добавлены: `knip`, `happy-dom`. Осталось: `unplugin-vue-components`, `unplugin-auto-import`, `vite-plugin-dts`, `pinia`, `@tanstack/vue-query`.

### Декомпозиция монолитов (раздел 5)
5. ✅ `app.ts` (1576 → 106 строк, 16.07.2026): ВЕСЬ `setup()` вынесен в `useAppShell.ts` (648 строк). `app.ts` — только init + createApp + регистрация компонентов. `vue-tsc --noEmit` → 0 ошибок.
6. ❌ `EntityEditor.vue` → папка `features/entities/EntityEditor/` (`useEntityEditor.ts` уже есть — подключить, `+ .model.ts`, `.style.css`).
7. ❌ `EditorCoreTiptap.vue` → папка `features/chapters/EditorCoreTiptap/` (`useTiptapEditor.ts` + `EditorToolbar.vue` + `EditorBubbleMenu.vue`).
8. ❌ `ChapterTree.vue` → заменить на `ExplorerTree` из `@worldwiki/components` ИЛИ распилить + убрать локальный `useTreeSelection`.

### Удаление дублей/анти-паттернов (раздел 6)
9. ✅ Удалить `apps/spa/src/ts/composables/useTreeSelection.ts` (теперь используется kit-версия).
10. ✅ Удалить `apps/spa/src/ts/app/refactored_app.ts`.
11. ✅ Удалить `apps/spa/src/ts/utils/dom-utils.ts`.
12. ✅ `FloatingEntityEditor.vue` заменён на `<FloatingWindow>` из кита (или удалён, т.к. есть native `ui_editor.html`).
13. ✅ `api.service.ts` разбит на доменные модули (`apps/spa/src/ts/services/api/*.api.ts`).
14. ✅ Локальные `getValueByPath/setValueByPath` удалены из `app.ts`, создан `utils/path.ts` (16.07.2026).

### Окна Tauri / Floating (раздел 10)
15. ✅ `apps/spa/index.html` удалён; в SPA остались только валидные multi-entry точки (`splash`, `project_launcher`, `app`, `settings`, `ui_editor`).
16. ❌ Реализовать клик по `entity://` ссылке → `WebviewWindow` с уникальным label + drag-header (база `ui_editor.html` есть).
17. ❌ Добавить `tauri-plugin-window-state` в `src-tauri`.

### Производительность (раздел 12) — quick-wins
18. ✅ GSAP/lodash script-теги отсутствуют; `v-glass.ts`/`ui-helpers.ts` не используют GSAP в рантайме.
19. ✅ `new Date()` вынесен из шаблонов; дата-формат не пересчитывается в `v-for`.
20. ✅ `backdrop-filter` отключается при `perfLevel: low` через `ui_perf.css` + `settings.service.applySettings()`.
21. ⚡ Web Workers (экспорт/парсинг), виртуализация дерева, Tauri Channel — не начаты.

---

## 7. Заметка по багу (из старого плана, актуально при миграции)

При выносе загрузки схем в `useEntityTree` маппинг выдавал `label/iconEmoji`, а шаблон `ChapterTree.vue`
ждал `title/emoji` → `.charAt(0)` у `undefined` ломал рендер дерева сущностей. При переписи на `ExplorerTree`
из кита — унифицировать контракт секций, чтобы не повторить ошибку.

---

## 8. Анализ текущих конфигов + предложение стека «под полный жир»

### Что сейчас в конфигах (нашли)
- **Корень `vite.config.ts`** — multi-entry (5 html), `target` не задан явно, плагин Vue есть, alias `@/`,`@services/` и т.д. ✅ но `target: ES2020` в `tsconfig.json` — отстаёт.
- **Корень `vitest.config.ts`** — `globals: true`, НО нет `environment` (упадёт на DOM-тестах), нет `vue()` плагина, нет `jsdom`/`happy-dom`. Тесты фактически только node-уровня.
- **Корень `.eslintrc.json`** — legacy-формат, `ecmaVersion: 2020`, `no-explicit-any: warn`. Устаревший формат (ESLint 9 хочет flat config).
- **`tauri-surreal-kit/vite.config.ts`** — `root: frontend/src`, alias только `@`, НЕТ d.ts-генерации при library-сборке.
- **`tauri-surreal-kit/.eslintrc.json`** — `no-explicit-any: off` (слишком слабо для каркаса), `vue-eslint-parser` есть ✅.
- **`tauri-surreal-kit/vitest.config.ts`** — `jsdom` + `vue()` ✅ (эталон для нас).
- **Нет** в проекте: Pinia, vue-router, auto-import, UnoCSS, Knip, Playwright, dts-плагина, type-check в dev.

### Рекомендованный стек (поверх ES2025 + Vite+ + pnpm + Turborepo + TS7)

#### Сборка / DX
| Инструмент | Зачем | Заметка к конфигам |
|-----------|-------|--------------------|
| **`@vitejs/plugin-vue` v6+** | уже есть | ок |
| **`vite-plugin-vue-devtools`** | DevTools 7 в браузере | добавить в `plugins` обоих vite |
| **`vite-plugin-checker`** | type-check на лету в dev (vue-tsc) | убирает необходимость ручного `typecheck` при разработке |
| **`unplugin-vue-components` + `unplugin-auto-import`** | авто-импорт Vue API и компонентов из `@worldwiki/components` | режет boilerplate, убирает кучу `import` |
| **`vite-plugin-dts`** | генерация `.d.ts` для `packages/components` и `packages/resources` (library build) | критично, т.к. в ките сейчас d.ts не генерятся |
| **`tsdown`** (или `tsup`) | быстрая library-сборка пакетов вместо vite lib mode | опц. альтернатива, проще ESM+dts |

#### Качество кода
| Инструмент | Зачем |
|-----------|-------|
| **ESLint 9 (flat config `eslint.config.js`)** + **typescript-eslint** + **eslint-plugin-vue** | заменяет legacy `.eslintrc.json`; `ecmaVersion: 2025`, `no-explicit-any: error` в каркасе |
| **Oxlint** (уже в scripts) | молниеносный линт перед коммитом; держим как доп. слой |
| **Prettier 3** + `prettier-plugin-vue` + `prettier-plugin-organize-imports` | формат; уже есть |
| **Knip** | находит неиспользуемые файлы/экспорты — золото при чистке дублей (`RedactSandbox`, `dom-utils`) |
| **`@vitest/coverage-v8`** | покрытие (уже в deps) |

#### Состояние / архитектура (для «большого приложения»)
| Инструмент | Зачем |
|-----------|-------|
| **Pinia** | централизованный стор вместо разбросанных `ref` по composables; официальный для Vue 3 |
| **@tanstack/vue-query (vue-query)** | серверное состояние/кэш API (главы, сущности) — убирает ручной loading/sync из composables |
| **vue-router** | SPA-роутинг между вьюхами (launcher → app → settings) — НУЖЕН ТОЛЬКО при single-window варианте (см. раздел 9) |
| **@vueuse/core** + **@vueuse/motion** | утилитарные компосаблы (уже частично есть) |

#### Стили
| Инструмент | Зачем |
|-----------|-------|
| **UnoCSS** (attributify + icons) | атомарный CSS поверх существующих glass-тем; ускоряет вёрстку. *Опц.* — можно оставить CSS-модули, но Uno ускоряет |
| CSS-модули / scoped | оставляем для фич-папок (Component-Behind) |

#### Тесты / e2e
| Инструмент | Зачем |
|-----------|-------|
| **Vitest 4** + `@vue/test-utils` + **happy-dom** (быстрее jsdom) | юнит компосаблов |
| **MSW** (mock service worker) | мок Tauri/IPC и SurrealDB в тестах без реального рантайма |
| **Playwright** | e2e по точкам входа (splash→launcher→app) |

#### i18n / ресурсы
- **vue-i18n v11** (уже есть) → переезжает в `packages/resources`.

### Что меняем в конфигах (конкретно)
1. `tsconfig.base.json`: `target: ES2025`, `lib: [ES2025, DOM, DOM.Iterable]`, `verbatimModuleSyntax`, `noUncheckedIndexedAccess`.
2. Оба `vite.config.ts`: добавить `vite-plugin-vue-devtools`, `vite-plugin-checker`, auto-import, для пакетов — `vite-plugin-dts`.
3. Корень `vitest.config.ts`: добавить `vue()`, `environment: 'happy-dom'`, alias как в vite.
4. Заменить `.eslintrc.json` (оба) на `eslint.config.js` (flat, ecmaVersion 2025, `any: error` в каркасе).
5. `turbo.json`: задачи `lint` (eslint+oxlint), `typecheck` (vue-tsc), `test` (vitest run), `build` (vite/tsdown).

---

## 9. Модель окон Tauri (разбор «для Vue нужен только 1 html»)

**Миф:** «для Vue нужен только 1 html». В классическом веб-SPA — да, Vue монтируется в один `index.html`, навигация через `vue-router`. Но **WorldWiki — Tauri-приложение**, а в Tauri каждое **окно ОС = отдельный webview = отдельный HTML-файл**. Это не «лишнее», а архитектура multi-window.

### Реальные точки входа (из `src/*.html`)
| Файл | Роль | Отдельное окно? |
|------|------|----------------|
| `index.html` | **только редирект** на `splash.html` | ❌ мусор — удалить |
| `splash.html` | заставка: бенчмарк Rust, прогресс, редирект на `project_launcher.html` | ✅ окно загрузки |
| `project_launcher.html` | выбор/создание проекта | ✅ окно лаунчера |
| `app.html` | **главное окно** редактора (главы, сущности, схемы, вкладки) | ✅ главное окно |
| `settings.html` | настройки UI | ✅ отдельное окно |
| `ui_editor.html` | плавающее окно редактора сущности (drag-header `-webkit-app-region: drag`) | ✅ дочернее окно |

В `vite.config.ts` уже 5 точек входа (`splash, project_launcher, app, settings, ui_editor`); `index.html` туда не включён — его и удаляем.

### Почему это НЕ нарушение архитектуры Vue
- Vue — просто рендерер в `#app`. В каждом окне создаётся **независимый Vue-app instance** (`createApp(...).mount('#app')`).
- Между окнами Tauri общается через `window.__TAURI__.core.invoke` (Rust) и `WebviewWindow`, а не через `vue-router`.
- `vue-router` тут **не нужен** — навигация «splash → launcher → app» это переходы между окнами ОС, не роуты внутри страницы.

### Варианты (зафиксировано)
- **Вариант А — оставить multi-window (рекомендуем, минимум риска).** Просто выкинуть `index.html`. Каждое окно = свой HTML в `apps/spa/src/entries/`. Идиоматично для Tauri 2.
- **Вариант Б — single-window SPA + vue-router (больше переделок).** Одно окно `app`, splash/launcher/settings — оверлеи/роуты. Плюс: один бандл, общий Pinia-стейт. Минус: переписывать навигацию (сейчас `window.location.href`), теряется изоляция окон.
- **Вариант В (компромисс, «под жир»).** `splash` — отдельное окно; `project_launcher` и `settings` — оверлеи внутри `app`; `ui_editor` — отдельное окно (плавающее редактирование). `vue-router` добавлять ТОЛЬКО при варианте Б.

**Итог:** не сводим к 1 html насильно (сломает Tauri multi-window). Удаляем `index.html`. `vue-router` уместен только при single-window рефакторе.

---

## 10. Floating Entity Windows (VS Code-style, по клику на ссылке)

### Сценарий
В Tiptap-редакторе юзер кликает по гиперссылке `[name](url=entity://<id>)` → **мгновенно открывается нативное плавающее Tauri-окно** с этой сущностью. Можно открыть **несколько** таких окон (по каждой ссылке своё), и каждое можно **перетащить на 2-й/3-й монитор** (как «Open in new window» в VS Code, только триггер — клик по ссылке).

База уже есть: `ui_editor.html` — именно такое окно (drag-header через `-webkit-app-region: drag`, строки 38/41, грузит `EntityEditor`). В `app.html` есть `FloatingEntityEditor.vue` (внутренний float-div) — оставить как in-app peek.

### Почему раньше ломалось (и фиксы)
1. **Грузился splash вместо сущности** — окно создавалось через `WebviewWindow` **без явного `url`**, хватало дефолтный (splash/index). → Фикс: всегда `url: '/ui_editor.html?entity=<id>&project=<p>'`.
2. **Второе окно не открывалось / заменяло первое** — `label` окна **не уникален**. Tauri не создаст второе окно с тем же label. → Фикс: `label: 'entity-float-' + id + '-' + Date.now()`.
3. **Окно «не грузалось»** — создание до готовности Tauri (`window.__TAURI__` undefined) или html не в `vite.config.ts` input. → Фикс: создавать только после Tauri-ready + entry зарегистрирован.
4. **Нельзя вынести за пределы** — использовался **внутренний div**, а не native webview. Div привязан к главному окну. → Фикс: для выноса на другой экран — **только нативное Tauri-окно**.

### Архитектура
```
EditorCoreTiptap.vue (главное окно app.html)
  └─ @click на entity://link
       → useEntityPeek().openInFloatingWindow(entityId)
            ↓
       WebviewWindow('entity-float-<id>-<ts>', {
         url: `/ui_editor.html?entity=<id>&project=<p>`,
         dragDropEnabled: true,
         // стартовая позиция рядом с курсором или на выбранный монитор (Monitor API)
       })
            ↓ (ui_editor.html монтирует свой Vue-instance)
       грузит EntityEditor, drag-header тащит на любой экран

Синхронизация правок (главное окно <-> плавающее):
  @tauri-apps/api/event: emit('entity:updated', { id, data })
  оба окна слушают → Pinia/store обновляется
```

### Технологии
| Задача | Инструмент |
|--------|-----------|
| Создать окно по клику | `WebviewWindow` (явный `url`, уникальный `label`) |
| Перетаскивание за пределы | `-webkit-app-region: drag` на header `ui_editor.html` (уже есть) |
| Вынос на 2-й/3-й экран | нативно (OS-webview) + `Monitor` API (`@tauri-apps/api/screen`) для стартовой позиции |
| Запомнить позицию окна | **`tauri-plugin-window-state`** |
| Привязка к краю/центру монитора | **`tauri-plugin-positioner`** (опц.) |
| Несколько окон одной сущности | уникальный `label` на каждое |
| Синхронизация контента | `@tauri-apps/api/event` (`emit`/`listen`) + Pinia в каждом окне |
| Без race-condition | создавать окно только после Tauri-ready check |

### VS Code-опции (добавить позже)
- **Copy to new window** (оставить и в главном, и в плавающем) — по клику на ссылке.
- **Move to new window** (убрать из главного) — по правому клику / модификатору.
Для старта хватит «Copy» (открыть плавающее, в главном оставить как есть).

### Что зафиксировать в `src-tauri`
- Плагины в `Cargo.toml` / `tauri.conf.json`: `tauri-plugin-window-state`, `tauri-plugin-positioner` (опц.).
- Каждое окно = entry в `vite.config.ts` (rollupOptions.input) + создавать только после Tauri-ready.

---

## 11. Итог

- `apps/spa` — «плагин» с бизнес-логикой (сущности, календари, графы), встраиваемый в оболочку кита; точки входа = `splash / project_launcher / app / settings / ui_editor` (удалить `index.html`).
- `packages/components` — готовая оболочка (вкладки, зум, шорткаты, floating-окна, дерево).
- `packages/resources` — единые локали/темы/типы для всех пакетов.
- `tauri-surreal-kit` (Rust) — рантайм, неизменен.
- **Floating Entity Windows**: клик по `entity://` ссылке → нативное Tauri-окно `ui_editor.html` с уникальным label, drag-header, синхронизация через event-bus + Pinia, `tauri-plugin-window-state` для мультимониторности.
- **Стек «под жир»**: ESLint 9 flat + Oxlint + Knip, auto-import + dts + checker, Pinia + vue-query, happy-dom + MSW + Playwright, опц. UnoCSS.

---

## 12. Производительность: полный чеклист бустов (с привязкой к коду)

> Архитектурная перестройка (разделы 0–11) сама по себе буст НЕ даёт — она про масштабируемость.

## 13. Bug Fix: обновление дерева/списков после переименования (F2 / Ctrl+S)

### Проблема
После переименования главы/сущности в редакторе и сохранения (`Ctrl+S`) дерево глав и списки сущностей в сайдбаре не обновлялись до перезагрузки (`F5`).

### Коренные причины
1. В `useSaveManager.ts` вызов `chapterTreeRef.load()` и `loadEntityList()` был только внутри ветки `if (newTitle && newTitle !== editor.title)`, поэтому при обычном сохранении без изменения заголовка UI не перезагружался.
2. В `useChapterOps.ts` `renameChapter` не вызывал обновление дерева и не эмитил событие `ww:hierarchy-changed`.
3. В `ChaptersMain.vue` после `saveChapter` отсутствовал dispatch события `ww:hierarchy-changed`.
4. В `useEntityLists.ts` реактивность была сломана: `entityLists.value[entityType] = list` мутировал вложенное свойство `shallowRef` без создания нового reference, поэтому Vue не детектил изменение.

### Исправления
- `apps/spa/src/ts/composables/useSaveManager.ts`: переместить вызовы `chapterTreeRef.value.load()` и `loadEntityList()` вне зависимости от смены заголовка.
- `apps/spa/src/ts/composables/useChapterOps.ts`: после сохранения главы вызывать `chapterTreeRef.value.load()` и `document.dispatchEvent(new CustomEvent('ww:hierarchy-changed'))`.
- `apps/spa/src/ts/components/Vue/Chapters/ChaptersMain.vue`: после сохранения главы dispatчить `ww:hierarchy-changed`.
- `apps/spa/src/ts/composables/useEntityLists.ts`: обновлять список через новый reference: `entityLists.value = { ...entityLists.value, [entityType]: list }`.

### Итог
Дерево глав и списки сущностей теперь refreshed immediately после переименования/сохранения. Без F5.
> Реальный буст дают только целевые оптимизации ниже. Приоритет: 🔥 quick-win (делать до/вне монорепо), ⚡ среднее.

### 12.1 Бандл / загрузка (🔥)
- **Убрать `vue.global.prod.js` как отдельный `<script>`.** В `src/settings.html` (строка 82) грузится `ts/libs/vue.global.prod.js` — полная не-tree-shakeable сборка Vue (~150KB+). Грузить через ESM (`vue/dist/vue.esm-browser.js`, как в `vite.config.ts` alias), чтобы Vite делал tree-shaking. Повторяется в каждом окне — балласт.
- **Выбросить `gsap.min.js` + `lodash.min.js` из `src/project_launcher.html` (строки 213-216).** Грузятся синхронно, блокируют parse. Lodash не нужен (ES2025 всё умеет нативно), GSAP — заменить на CSS-анимации / `@vueuse/motion`.
- **Lazy-load тяжёлых фич** через `defineAsyncComponent`: `SchemaEditorMain` (~510 строк + drag-drop), `Calendars/*` (12 под-компонентов), `RedactSandbox` (удаляем). Главное окно `app.html` стартует без них.
- **`vite-plugin-compression`** (brotli) для прода — уменьшает размер бандла.

### 12.2 Реактивность Vue (🔥 критично для больших данных)
- **`shallowRef` / `shallowReactive` / `markRaw`** для больших структур: дерево глав (`ChapterTree` 1000+ строк), список сущностей, документ Tiptap. НЕ класть в глубокий `ref` — Vue рекурсивно проксирует тысячи узлов. Документ Tiptap вообще нельзя делать реактивным (`markRaw` или `shallowRef`).
- **`v-memo` для тяжёлых списков.** В `project_launcher.html` `v-for="project in sortedProjects"`, в дереве сущностей — `v-memo="[project.name]"` чтобы не пересчитывать строку при ререндере родителя.
- **`v-once` для статичного.** Хоткеи-грид в `project_launcher.html` (строки 114-127) — статичный, обернуть в `v-once`.
- **Вынос вычислений дат из шаблона.** В `src/ui_editor.html` (строка 170) `new Date(rev.created_at).toLocaleString()` внутри `v-for` — пересчё