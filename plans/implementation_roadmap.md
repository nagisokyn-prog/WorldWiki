# Implementation Roadmap — Фронтенд архитектура WorldWiki (остаток работ)

> Цель: безопасно декомпозировать монолиты, настроить dev-стек и library build, не ломая рантайм.
> Floating Entity Windows — **отложены** (не входят в этот план).

---

## 0. Подготовка (обязательно перед каждым большим шагом)

- Работаем в отдельной ветке `feat/frontend-arch-remainder`.
- После каждого пункта: фиксируем изменения git-коммитом с понятным сообщением.
- Критерий приёмки каждого пункта: `pnpm run typecheck` (vue-tsc) проходит, `pnpm run dev` стартует, `pnpm run test` не падает.

---

## 1. Безопасная чистка `app.ts` (без изменения поведения)

### 1.1 Создать `utils/path.ts`

**Файл:** `apps/spa/src/ts/utils/path.ts`
**Содержимое:**
```ts
export function getValueByPath(obj: any, path: string): any {
  return path.split('.').reduce((cur: any, k: string) => (cur != null ? cur[k] : undefined), obj);
}
export function setValueByPath(obj: any, path: string, value: any): void {
  const parts = path.split('.');
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    if (!cur[parts[i]] || typeof cur[parts[i]] !== 'object') cur[parts[i]] = {};
    cur = cur[parts[i]];
  }
  cur[parts[parts.length - 1]] = value;
}
```

### 1.2 Заменить локальные хелперы в `apps/spa/src/ts/app/app.ts`

- Удалить внутренние `getValueByPath` и `setValueByPath`.
- Импортировать из `@/utils/path`.
- **Проверка:** `saveAll()` и `addNewEntity()` работают как раньше, unit-тест на `setValueByPath` с вложенным объектом.

---

## 2. Вынос composables из `app.ts` (низкий риск)

### 2.1 `useHotkeys`

**Файл:** `apps/spa/src/ts/composables/useHotkeys.ts`
- Взять из `app.ts` блок `window.addEventListener('keydown', ...)` (строки ~420–530).
- Вернуть объект с методами `register()` / `unregister()`.
- В `app.ts` импортировать и вызвать `onMounted(() => useHotkeys(projectName, { saveAll, toggleSettings, ... }));`.

### 2.2 `useResizers`

**Файл:** `apps/spa/src/ts/composables/useResizers.ts`
- Взять `startResize`, `startSidebarResize`, `startSplitResize`, `startGroupResize`.
- Вернуть объект с методами и `splitLeftWidth` (ref).

### 2.3 `useQuickOpen`

**Файл:** `apps/spa/src/ts/composables/useQuickOpen.ts`
- Взять `quickOpenDataSource`, `handleQuickOpenSelect`, `quickOpenRef`.
- Вернуть `{ dataSource, onSelect, open, close }`.

**После каждого выноса:**
- `vue-tsc --noEmit` зелёный.
- В `app.ts` остаётся только объявление `const eg = useEditorGroups();` и compat-aliases.
- Поведение хоткеев/ресайзеров не меняется (ручное QA: проверить Ctrl+S, Ctrl+P, ресайз сайдбара/сплита).

---

## 3. Library build + dev-стек (инфраструктура)

### 3.1 `packages/components` — library build

- Добавить в `packages/components/package.json` зависимости: `vue` (external), `@vitejs/plugin-vue`.
- Создать `packages/components/vite.library.config.ts` (ESM, entry `src/index.ts`, плагин Vue).
- Добавить `vite-plugin-dts` для генерации `.d.ts`.
- В корне `package.json` добавить скрипт `build:components`.

### 3.2 `packages/resources` — library build

- Аналогично `packages/components`: `vite.library.config.ts`, `vite-plugin-dts`, entry `src/index.ts`.
- External: `vue` (если есть vue-компоненты в ресурсах — проверить).

### 3.3 Vitest (корень)

- В `vitest.config.ts` добавить:
  - `plugins: [vue()]`
  - `environment: 'happy-dom'`
  - alias как в `vite.config.ts` (`@/`, `@services/`)
- Добавить пример теста: `test/simple.test.ts` → рендер `<div>` + ассерт.

### 3.4 Vite plugins (SPA + kit)

- `vite-plugin-vue-devtools` → добавить в `plugins` обоих `vite.config.ts`.
- `vite-plugin-checker` → раскомментировать/добавить в `apps/spa/vite.config.ts`.
- `unplugin-vue-components` + `unplugin-auto-import` → настроить для автоимпорта из `@worldwiki/components`.

### 3.5 Dev-dependencies (корень `package.json`)

Добавить:
- `unplugin-vue-components`, `unplugin-auto-import`
- `vite-plugin-dts`, `vite-plugin-checker`, `vite-plugin-vue-devtools`
- `knip`, `@tanstack/vue-query`, `pinia`, `@vitest/coverage-v8`

**Проверка:**
- `pnpm run build` проходит.
- `pnpm run test` запускается (даже с 1 тестом).
- `pnpm run dev` стартует, Vue DevTools доступны.

---

## 4. Component-Behind для `EntityEditor.vue`

### 4.1 Структура

```
apps/spa/src/ts/features/entities/EntityEditor/
├─ EntityEditor.vue        # template-only
├─ useEntityEditor.ts      # логика (уже есть в components/Vue/SchemaEditor/)
└─ EntityEditor.style.css  # стили (вынести из <style> в компоненте)
```

### 4.2 Действия

- Перенести `useEntityEditor.ts` из `components/Vue/SchemaEditor/` → `features/entities/EntityEditor/`.
- Обновить импорты.
- Разбить `<style>` в `EntityEditor.vue` → `EntityEditor.style.css`.
- Убедиться, что `EntityEditor.vue` остаётся регистрируемым компонентом (export default).

### 4.3 Проверка

- Вкладка сущности открывается, редактирование/сохранение работает.
- `vue-tsc` без ошибок.

---

## 5. Component-Behind для `EditorCoreTiptap.vue`

### 5.1 Структура

```
apps/spa/src/ts/features/chapters/EditorCoreTiptap/
├─ EditorCoreTiptap.vue      # template-only
├─ useTiptapEditor.ts        # логика (уже есть)
├─ EditorToolbar.vue         # вынести тулбар из монолита
└─ EditorBubbleMenu.vue      # вынести bubble-menu
```

### 5.2 Действия

- Перенести `useTiptapEditor.ts` в новую папку.
- Вынести тулбар и bubble-menu в отдельные `.vue`.
- Обновить импорты в `app.ts` / `ChaptersMain.vue`.

### 5.3 Проверка

- Глава открывается, тулбар работает, форматирование применяется.
- `vue-tsc` зелёный.

---

## 6. Декомпозиция `ChapterTree.vue` (или замена на `ExplorerTree`)

### Вариант А: замена на `ExplorerTree` из кита

- Импортировать `ExplorerTree` из `@worldwiki/components`.
- Адаптировать `node.title/iconEmoji` под контракт `label/iconEmoji` (исправить баг из раздела 7 плана).
- Удалить старый `ChapterTree.vue`.

### Вариант Б: распил текущего `ChapterTree.vue`

- Вынести логику загрузки иерархии в `useChapterTree.ts`.
- Стили → `ChapterTree.style.css`.
- Оставить компонент тонким.

**Проверка:** дерево глав отображается, клик по главе открывает вкладку, drag-drop работает.

---

## 7. Финальный вынос CRUD глав и `saveAll` (самое опасное)

### 7.1 `useChapterOps.ts`

- Вынести из `app.ts`: `createChapterIn`, `deleteChapter`, `renameChapter`, `deleteVolume`, `deleteArc`.
- Оставить в `app.ts` только вызовы: `useChapterOps().createChapterIn(...)`.
- `deleteVolume`/`deleteArc` должны жить здесь, с доступом к `eg` (Editor Groups).

### 7.2 `saveAll` в `relationship-save.service.ts`

- Перенести всю логику `saveAll` (подготовка данных, `prepareEntityForSave`, `saveForeignRelationships`, orphan cleanup) в `relationship-save.service.ts` как `saveEntityWithRelationships(...)`.
- В `app.ts` вызывать сервис.

### 7.3 Тест на сценарий удаления

- Создать `test/save-chapter.test.ts`:
  1. Создать том → арку → главу.
  2. Удалить арку → проверить, что главы удалены, вкладки закрыты.
  3. Удалить том → проверить каскад.

**Проверка:**
- Удаление тома/арки/главы работает, вкладки закрываются, toast-уведомления появляются.
- `relationship-save.service` тестируется отдельно.

---

## 8. Документация `ARCHITECTURE.md`

Создать файл с описанием:
- Структура монорепо.
- Правило «куда класть логику» (apps/spa vs packages/components vs packages/resources).
- Паттерн Component-Behind.
- Стек и команды (`pnpm run dev`, `pnpm run build`, `pnpm run test`, `pnpm run typecheck`).
- Multi-window модель Tauri (почему несколько HTML — это нормально).

---

## Итоговый чеклист

- [ ] 1. `utils/path.ts` + чистка `app.ts`
- [ ] 2.1 `useHotkeys.ts`
- [ ] 2.2 `useResizers.ts`
- [ ] 2.3 `useQuickOpen.ts`
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

Примечание: пока не настроен Turbo pipeline — можно запускать команды в package.json напрямую.