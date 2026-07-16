# Execution Plan — Фронтенд архитектура WorldWiki (остаток работ)

> Цель: безопасно декомпозировать монолиты, настроить dev-стек и library build, не ломая рантайм.
> Floating Entity Windows — **отложены** (не входят в этот план).

---

## Текущее состояние

- ✅ Монорепо настроено (`pnpm-workspace.yaml`, `turbo.json`, `tsconfig.base.json`).
- ✅ `packages/components` (`@worldwiki/components`) и `packages/resources` (`@worldwiki/resources`) созданы и работают в dev.
- ✅ Дубли удалены: `useTreeSelection.ts`, `refactored_app.ts`, `dom-utils.ts`, `RedactSandbox.vue`.
- ✅ `api.service.ts` разбит на доменные модули (`apps/spa/src/ts/services/api/*.api.ts`).
- ✅ `apps/spa/index.html` удалён;multi-entry точки (`splash`, `project_launcher`, `app`, `settings`, `ui_editor`) зарегистрированы в `vite.config.ts`.
- ✅ Частичная декомпозиция `app.ts`: созданы `useEditorGroups`, `useFloatingEditors`, `useEntityLoader`, `useChapterOps`, `usePersistence`, `useTiptapEditor`, `useEntityEditor`.
- ✅ `useHotkeys.ts` создан, но есть TS-ошибки типизации.
- ✅ `utils/path.ts` создан, локальные дубли в `app.ts` удалены.
- ❌ `app.ts` всё ещё Large Monolith: не вынесены `useResizers`, `useQuickOpen`; каскадные CRUD/`saveAll` остаются в `app.ts`.
- ❌ `EntityEditor.vue` и `EditorCoreTiptap.vue` монолитны (Component-Behind не применён полностью).
- ❌ Library build для `packages/components` и `packages/resources` не настроен.
- ❌ Dev-стек: Vitest не настроен (нет `happy-dom` + `vue()`), `vite-plugin-checker` и `vite-plugin-vue-devtools` не подключены, нет auto-import, Pinia, vue-query, Knip.
- ❌ `ChapterTree.vue` не заменён на `ExplorerTree` из кита.
- ❌ `ARCHITECTURE.md` не создан.

---

## Шаг 1: Исправить TS-ошибки в `useHotkeys.ts` и `app.ts` (сейчас)

### Проблема
В `useHotkeys.ts` после добавления обязательных полей `currentSidebarTab`, `zoomLevel`, `showSettings` в тип контекста, TS всё ещё ругается на возможный `undefined` (из-за использования `?.` и `value` в некоторых местах). В `app.ts` после удаления старого блока `keydown` остались артефакты, из-за чего появились ошибки:
- `Line 1448: Ожидалось ","`
- `Line 1553: Ожидалось объявление или оператор`
- и др.

### Действия
1. В `useHotkeys.ts` заменить все `ctx.xxx?.value` на `ctx.xxx.value` (так как контекст теперь гарантирует наличие этих полей).
2. В `app.ts` убедиться, что после `useHotkeys(...).register();` нет никаких остатков старого кода (включая `window.addEventListener('keydown', ...)` и все вложенные блоки `if`).
3. Проверить, что все открывающие/закрывающие скобки `{}` на месте.

### Проверка
- `pnpm exec vue-tsc --noEmit -p apps/spa/tsconfig.json` — 0 ошибок.

---

## Шаг 2: Вынести `useResizers` и `useQuickOpen` из `app.ts`

### `useResizers.ts`
- Взять из `app.ts`: `startResize`, `startSidebarResize`, `startSplitResize`, `startGroupResize`, `splitLeftWidth`.
- Вернуть объект с методами.

### `useQuickOpen.ts`
- Взять из `app.ts`: `quickOpenDataSource`, `handleQuickOpenSelect`, `quickOpenRef`.
- Вернуть `{ dataSource, onSelect, open, close }`.

### Интеграция в `app.ts`
- Импортировать composable и вызвать в `onMounted` (или в `setup`), передав нужные зависимости.

### Проверка
- Type-check проходит.
- Ручное QA: ресайз сайдбара/сплита/групп работает, Quick Open открывается/закрывается.

---

## Шаг 3: Library build для `packages/components` и `packages/resources`

### Действия
1. Добавить в `packages/components/package.json` зависимости: `vue` (external), `@vitejs/plugin-vue`.
2. Создать `packages/components/vite.library.config.ts` (ESM, entry `src/index.ts`, плагин Vue, external `vue`).
3. Добавить `vite-plugin-dts` для генерации `.d.ts`.
4. Повторить аналогичные шаги для `packages/resources`.
5. В корне `package.json` добавить скрипты `build:components` и `build:resources`.

### Проверка
- `pnpm run build` проходит.
- В `dist` появляются `.d.ts` файлы.

---

## Шаг 4: Настроить dev-стек

### Vitest (корень)
- В `vitest.config.ts` добавить:
  - `plugins: [vue()]`
  - `environment: 'happy-dom'`
  - alias как в `vite.config.ts`.

### Vite plugins (SPA + kit)
- `vite-plugin-vue-devtools` → добавить в `plugins` обоих `vite.config.ts`.
- `vite-plugin-checker` → раскомментировать/добавить в `apps/spa/vite.config.ts`.
- `unplugin-vue-components` + `unplugin-auto-import` → настроить для автоимпорта из `@worldwiki/components`.

### Dev-dependencies (корень `package.json`)
Добавить:
- `unplugin-vue-components`, `unplugin-auto-import`
- `vite-plugin-dts`, `vite-plugin-checker`, `vite-plugin-vue-devtools`
- `knip`, `@tanstack/vue-query`, `pinia`, `@vitest/coverage-v8`

### Проверка
- `pnpm run dev` стартует, Vue DevTools доступны.
- `pnpm run test` запускается (даже с 1 тестом).
- `pnpm run typecheck` проходит.

---

## Шаг 5: Component-Behind для `EntityEditor.vue`

### Структура
```
apps/spa/src/ts/features/entities/EntityEditor/
├─ EntityEditor.vue        # template-only
├─ useEntityEditor.ts      # логика (уже есть)
└─ EntityEditor.style.css  # стили (вынести из <style>)
```

### Действия
1. Перенести `useEntityEditor.ts` из `components/Vue/SchemaEditor/` → `features/entities/EntityEditor/`.
2. Обновить импорты.
3. Разбить `<style>` в `EntityEditor.vue` → `EntityEditor.style.css`.
4. Убедиться, что компонент остаётся регистрируемым.

### Проверка
- Вкладка сущности открывается, редактирование/сохранение работает.
- `vue-tsc` без ошибок.

---

## Шаг 6: Component-Behind для `EditorCoreTiptap.vue`

### Структура
```
apps/spa/src/ts/features/chapters/EditorCoreTiptap/
├─ EditorCoreTiptap.vue      # template-only
├─ useTiptapEditor.ts        # логика (уже есть)
├─ EditorToolbar.vue         # вынести тулбар
└─ EditorBubbleMenu.vue      # вынести bubble-menu
```

### Действия
1. Перенести `useTiptapEditor.ts` в новую папку.
2. Вынести тулбар и bubble-menu в отдельные `.vue`.
3. Обновить импорты.

### Проверка
- Глава открывается, тулбар работает.
- `vue-tsc` зелёный.

---

## Шаг 7: Декомпозиция `ChapterTree.vue`

### Вариант А: замена на `ExplorerTree` из кита
- Импортировать `ExplorerTree` из `@worldwiki/components`.
- Адаптировать контракт `node.title/iconEmoji` (убрать баг с `label/emoji`).
- Удалить старый `ChapterTree.vue`.

### Вариант Б: распил текущего `ChapterTree.vue`
- Вынести логику в `useChapterTree.ts`.
- Стили → `ChapterTree.style.css`.

### Проверка
- Дерево глав отображается, клик по главе открывает вкладку.

---

## Шаг 8: Вынос CRUD глав и `saveAll` в сервисы (самое опасное)

### `useChapterOps.ts`
- Вынести из `app.ts`: `createChapterIn`, `deleteChapter`, `renameChapter`, `deleteVolume`, `deleteArc`.
- Оставить в `app.ts` только вызовы.

### `saveAll` в `relationship-save.service.ts`
- Перенести логику `saveAll` в сервис как `saveEntityWithRelationships(...)`.

### Тест на сценарий удаления
- Создать `test/save-chapter.test.ts`: создать том → арку → главу; удалить арку → проверить каскад.

### Проверка
- Удаление работает, вкладки закрываются.
- `vue-tsc` без ошибок.

---

## Шаг 9: Создать `ARCHITECTURE.md`

- Структура монорепо.
- Правило «куда класть логику».
- Паттерн Component-Behind.
- Стек и команды.
- Multi-window модель Tauri.

---

## Команды для проверки

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
```

---

## Итоговый чеклист

- [ ] 1. Исправить TS-ошибки в `useHotkeys.ts` и `app.ts`
- [ ] 2.1 `useResizers.ts`
- [ ] 2.2 `useQuickOpen.ts`
- [ ] 3.1 Library build `packages/components`
- [ ] 3.2 Library build `packages/resources`
- [ ] 3.3 Vitest (happy-dom + vue())
- [ ] 3.4 Vite plugins (checker, devtools, auto-import)
- [ ] 3.5 Dev-dependencies (knip, vue-query, pinia)
- [ ] 4. Component-Behind `EntityEditor`
- [ ] 5. Component-Behind `EditorCoreTiptap`
- [ ] 6. `ChapterTree` → `ExplorerTree` или распил
- [ ] 7.1 `useChapterOps.ts`
- [ ] 7.2 `saveAll` в сервис
- [ ] 7.3 Тест на удаление
- [ ] 8. `ARCHITECTURE.md`