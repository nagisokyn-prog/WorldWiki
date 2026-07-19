# WorldWiki Frontend Architecture

## Структура монорепозитория

```
WorldWiki/
├─ pnpm-workspace.yaml    # workspaces: apps/*, packages/*
├─ turbo.json            # build/typecheck/lint/test pipeline
├─ package.json          # корневые dependencies + scripts через turbo
├─ tsconfig.base.json    # target: ES2025, module: ESNext, verbatimModuleSyntax
├─ eslint.config.js      # ESLint 9 flat config
├─ vitest.config.ts      # happy-dom + vue() + aliases
│
├─ apps/
│  └─ spa/              # === WorldWiki SPA приложение ===
│     ├─ package.json
│     ├─ tsconfig.json  # extends tsconfig.base.json
│     ├─ vite.config.ts # multi-entry, plugins: checker/devtools/auto-import/unocss
│     └─ src/
│        ├─ app.ts        # точка входа - init + createApp
│        ├─ composables/  # useAppShell, useHotkeys, useResizers, useQuickOpen...
│        ├─ services/   # api.service + api/*.api.ts
│        ├─ features/   # Component-Behind фичи
│        └─ types/      # domain-типы
│
├─ packages/
│  ├─ components/      # === Generic UI Kit ===
│  │  ├─ package.json   # library build ESM
│  │  ├─ vite.config.ts # vite-plugin-dts
│  │  └─ src/
│  │     ├─ components/Vue/  # ExplorerTree, FloatingWindow, EditorGroupPane...
│  │     ├─ composables/     # useEditorGroups, useShellApp, useTreeSelection
│  │     └─ services/        # generic API services
│  │
│  └─ resources/       # === Shared Resources ===
│     ├─ package.json
│     ├─ vite.config.ts
│     └─ src/
│        ├─ styles/     # glass-theme, new-ui-theme, fonts.css
│        ├─ i18n/       # vue-i18n конфиг + locales
│        └─ index.ts    # экспорт стилей и типов
│
├─ src-tauri/          # Tauri Rust backend
└─ tauri-surreal-kit/  # generic infrastructure (не трогаем)
```

## Правило "куда класть логику"

| Что | Где |
|-----|-----|
| Состояние/поведение экрана | `apps/spa/src/composables/` или `features/*/use*.ts` |
| Работа с БД/API/связями | `apps/spa/src/services/` |
| Чистые утилиты (path, формат) | `apps/spa/src/utils/` |
| Визуальный кусок UI | `features/*/` (Component-Behind) |
| Инфраструктура (вкладки, зум, toast/log) | `packages/components` |
| Локали/темы/шрифты/общие типы | `packages/resources` |

## Component-Behind паттерн

Каждый "тяжелый" компонент → папка-фича:

```
features/entities/EntityEditor/
├─ EntityEditor.vue        # только <template> + биндинги
├─ useEntityEditor.ts      # вся логика
├─ EntityEditor.model.ts   # типы/интерфейсы
└─ EntityEditor.style.css  # scoped-стили
```

Применяется к: EntityEditor, EditorCoreTiptap, ChapterTree

## Команды разработки

```bash
# Type-check
pnpm run typecheck

# Dev server
pnpm run dev

# Tests
pnpm run test

# Build
pnpm run build

# Lint
pnpm run lint

# Install dependencies (сначала обновить lockfile)
pnpm install
```

## Multi-window модель Tauri

WorldWiki использует несколько HTML-файлов (multi-entry):

| HTML | Роль | ОКно? |
|------|------|-------|
| `splash.html` | заставка | ✅ |
| `project_launcher.html` | выбор/создание проекта | ✅ |
| `app.html` | главное окно редактора | ✅ |
| `settings.html` | настройки | ✅ |
| `ui_editor.html` | плавающее окно сущности | ✅ |

Vue-router НЕ используется — навигация между окнами через `window.location.href`.

## Стек

- **Vue 3.5+** + `<script setup>`, `defineModel`, `useTemplateRef`
- **Vite 8** + `vite-plugin-checker`, `vite-plugin-vue-devtools`, `unocss`
- **unplugin-auto-import** + **unplugin-vue-components**
- **Pinia** — централизованный store (будет внедрен)
- **@tanstack/vue-query** — серверное состояние/кэш API
- **Vitest 4** + `happy-dom` + `@vue/test-utils`
- **ESLint 9** flat config + Prettier