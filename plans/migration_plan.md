# План поэтапной миграции фронтенда WorldWiki

Основано на документе `frontend_architecture_plan.md`. План разбит от самых простых и изолированных задач (Quick Wins) к наиболее сложным архитектурным изменениям, чтобы минимизировать риски поломки приложения на начальных этапах.

## Этап 1: Быстрые победы и оптимизация производительности (Легко)
*Эти изменения можно сделать прямо сейчас в текущей структуре, они дадут моментальный буст производительности и подготовят почву для рефакторинга.*

- [x] **Очистка HTML-файлов:** Убрать `<script src=".../vue.global.prod.js">` из `settings.html` (перевести на ESM-импорт). Удалить `gsap.min.js` и `lodash.min.js` из `project_launcher.html`.
- [x] **Удаление мусора:** Удалить неиспользуемый `index.html` (так как есть `splash.html`) и `src/ts/app/refactored_app.ts`.
- [x] **Оптимизация реактивности Vue:** Заменить глубокий `ref` на `shallowRef` или обернуть в `markRaw` большие структуры данных (дерево глав, список сущностей, документ Tiptap).
- [x] **CSS-оптимизации:** Настроить отключение `backdrop-filter: blur()` при `perfLevel: low` для окон лаунчера и настроек.
- [x] **Оптимизация шаблонов:** Вынести вычисление дат (напр. `new Date(rev.created_at).toLocaleString()`) из шаблонов `v-for` в computed-свойства или форматтеры. Обернуть статичные блоки (например, сетку хоткеев) в `v-once`.

## Этап 2: Инфраструктура монорепозитория и тулинг (Легко-Средне)
*Настройка базового каркаса Turborepo и pnpm workspaces без изменения бизнес-логики.*

- [x] **Инициализация Workspaces:** Создать `pnpm-workspace.yaml` и папку `packages/`, `apps/`.
- [x] **Настройка Turborepo:** Создать `turbo.json` с тасками `build`, `typecheck`, `lint`, `test`, `dev`.
- [x] **Обновление TypeScript:** Настроить корневой `tsconfig.base.json` (target: ES2025, `verbatimModuleSyntax: true`, strict).
- [x] **Обновление линтеров и Vite:** Переход на ESLint 9 (flat config `eslint.config.js`). Добавление плагинов в Vite: `vite-plugin-checker`, `vite-plugin-vue-devtools`.

## Этап 3: Выделение базовых пакетов (Средне)
*Изоляция независимых модулей из текущего кода.*

- [x] **Ресурсы (`@worldwiki/resources`):**
  - Перенести `src/assets` (CSS, шрифты, иконки).
  - Перенести `src/ts/locales` (i18n).
  - Настроить `packages/resources/package.json` и экспорт.
- [x] **UI Компоненты (`@worldwiki/components`):**
  - Перенести общие компоненты (в идеале переписать на Vue или оставить как есть, если это старый код, но вынести в отдельный пакет).
  - Настроить `packages/components/package.json` и экспорт. Настроить сборку библиотеки (ESM, `vite-plugin-dts`, Vue как external dependency). Экспортировать `ExplorerTree`, `FloatingWindow`, `WorkspaceLayout`, `useShellApp` и т.д.

## Этап 4: Перенос и рефакторинг SPA-приложения (Сложно)
*Перенос основного приложения в `apps/spa` и начало распила монолитов.*

- [ ] **Миграция `apps/spa`:** Перенести оставшийся исходный код в `apps/spa`. Настроить `vite.config.ts` на multi-entry (`splash`, `launcher`, `app`, `settings`, `ui_editor`). Настроить alias'ы на новые пакеты `@worldwiki/components` и `@worldwiki/resources`.
- [ ] **Внедрение Component-Behind (распил Vue-монолитов):**
  - Разделить `EntityEditor.vue` (~1000 строк) на `<template>` и `useEntityEditor.ts`. Выделить подкомпоненты (рендерер полей, связи, история).
  - Разделить `EditorCoreTiptap.vue` (~1000 строк) на логику `useTiptapEditor.ts`, тулбар и меню.
- [ ] **Избавление от Vanilla-JS анти-паттернов:**
  - Переписать эффекты из `glass-init.ts` в Vue-директивы (`v-ripple`, `v-glass-breathe`).
  - Удалить ручные манипуляции DOM (`dom-utils.ts`).

## Этап 5: Глубокие архитектурные изменения (Самое сложное)
*Замена логики сохранения, разделение огромного `app.ts` и внедрение плавающих окон.*

- [ ] **Отказ от DOM-парсинга связей (Критично):** Переписать `connections.service.ts` (`collectRelationshipsFromDOM`). Связи должны храниться в реактивном стейте, а сохранение — отправлять JSON без чтения HTML.
- [ ] **Декомпозиция `app.ts` (~1500 строк):** Разбить на доменные composables (`useWorldWikiShell`, `useEntityLoader`, `useChapterOps`, `usePersistence`). Делегировать сохранение связей в `relationship-save.service.ts` и убрать дублирование кода.
- [ ] **Внедрение полноценных Floating Entity Windows:**
  - Заменить внутренние `div`-оверлеи (типа `FloatingEntityEditor.vue`) на нативные плавающие окна Tauri (`ui_editor.html`).
  - Настроить создание уникальных окон при клике на гиперссылку (`entity://`).
  - Реализовать синхронизацию стейта между главным и дочерними окнами через события Tauri (`emit`/`listen`) и Pinia.
  - Устранить баги с label окон и гонкой данных (race-condition) при загрузке.
- [ ] **Удаление дубликатов:** Полностью удалить `RedactSandbox.vue` в пользу `SchemaEditorMain.vue`. Заменить старый `ChapterTree.vue` на `ExplorerTree` из пакета components.
