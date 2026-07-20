# План миграции состояния на Pinia

## Текущая архитектура (ПОСЛЕ МИГРАЦИИ)

Весь state живёт в Pinia stores. `useAppShell.ts` убран — теперь `EditorView.vue` использует stores напрямую.

## Статус миграции (ВЫПОЛНЕНО ✅)

### ✅ Этап 1: Shell store — `stores/shell.ts`
**Мигрировано из useAppShell + useEntityOps + useChapterOps + useSaveManager + useQuickOpen + usePersistence + useEntityLists + useResizers + useWorldWikiShell**

**State (ref):**
- `activeView`, `currentSidebarTab`, `showSettings`, `sidebarSearch`, `activePanelTab`
- `consoleLogs`, `activeField`, `panelHeight`, `sidebarWidth`, `splitLeftWidth`
- `activeTreeNode`, `sidebarVisible`, `settings`
- `isCreatingEntity`, `isCreatingChapter`
- `entityLists`, `chapters`, `sidebarItems`, `projectName`

**Методы (все мигрированы):**
- Навигация: `selectSidebarTab`, `openEntity`, `openSchemaEditor`, `openChapterTab`, `closeEditor`, `closeAllTabs`, `markUnsaved`, `markSaved`, `saveAll`, `addNewEntity`, `toggleSettings`, `resetSettings`, `addLog`, `handleUpdateData`
- EntityOps: `deleteEntity`, `renameEntity`
- ChapterOps: `renameChapter`, `createChapterIn`, `deleteChapter`, `deleteVolume`, `deleteArc`
- Persistence: `saveState`, `restoreState`
- QuickOpen: `quickOpenDataSource`, `handleQuickOpenSelect`, `openQuickOpen`
- UI: `applyZoom`, `selectTreeNode`, `handleScrollChange`, `handleSectionChange`, `openTagsManager`, `openFloatingEditor`, `onChapterRenamed`, `toggleEntityHistory`, `openSandbox`
- EditorGroups: `splitRight`, `closeGroup`, `moveTab`, `reorderTab`, `activateTabInGroup`, `focusGroup`
- Resizers: `startResize`, `startSidebarResize`, `startSplitResize`, `startGroupResize`

**Watchers & Lifecycle:** перенесены в store

---

### ✅ Этап 2: Editor store — `stores/editor.ts` (via useEditorGroups из @worldwiki/components)
- Не требует отдельного store — использует `useEditorGroups()` из пакета компонентов

### ✅ Этап 3: Entities + Chapters lists — в `shell.ts`
- `entityLists`, `chapters`, `loadEntityList`, `loadChapters` — в `shell.ts`

### ✅ Этап 4: Chapters CRUD — в `shell.ts`
- `createChapterIn`, `deleteChapter`, `renameChapter`, `deleteVolume`, `deleteArc` — в `shell.ts`

### ✅ Этап 5: SaveManager — в `shell.ts`
- `saveAll` (с очередью автосохранения) — в `shell.ts`

### ✅ Этап 6: Schema store — `stores/schema.ts`
- `loadSchema`, `getEntityDisplayName`, кеш схем — отдельный store

### ✅ Этап 7: Console store — `stores/console.ts`
- `toasts`, `consoleLogs`, `addLog`, `addToast`, `getToastIcon` — отдельный store

### ✅ Этап 8: Floating windows — `stores/floating.ts`
- `floatingEditors`, `openFloatingEditor` — отдельный store

### ✅ Этап 9: Zoom store — `stores/zoom.ts`
- `zoomLevel`, `applyZoom` — отдельный store

### ✅ Settings store — `stores/settings.ts`
- `settings`, `resetSettings` — отдельный store

---

## Итоговая архитектура

```
app.ts
  ├── createPinia()
  ├── router
  └── AppSwitcher.vue
        └── EditorView.vue (в features/shell)
              ├── useShellStore()     — навигация, UI state, бизнес-логика
              ├── useConsoleStore()   — логи/тосты
              ├── useZoomStore()      — зум
              ├── useSchemaStore()    — кеш схем
              ├── useFloatingStore()  — плавающие окна
              └── useSettingsStore()  — настройки
```

---

## Что ОСТАЛОСЬ (не относится к EditorView migration)

### 1. Остальные composables в `apps/spa/src/ts/composables/`:
- `useEntityLoader.ts` — загрузка сущностей (используется в EntityEditor)
- `useFloatingEditors.ts` — плавающие редакторы (используется в других местах)
- `useHotkeys.ts` — глобальные хоткеи
- `useTiptapEditor.ts` — Tiptap редактор
- `useChapterTreeAdapter.ts` — адаптер дерева глав

**Действие:** Оставить как есть или мигрировать по мере необходимости в других features.

### 2. useAppShell.ts — УДАЛЁН
- Был composition root (700+ строк)
- Теперь `EditorView.vue.ts` импортирует stores напрямую

### 3. Auto-imports (`apps/spa/src/auto-imports.d.ts`) — требует регенерации
- Содержит ссылки на удалённые composables
- `pnpm dev` или `npx unplugin-auto-import` обновит автоматически

---

## Как запускать/проверять

```bash
# Сборка
cd apps/spa && npx vite build --mode development

# TypeScript check
npx tsc --noEmit -p apps/spa/tsconfig.json
# Ожидаемые ошибки (pre-existing, не связаны с миграцией):
# - form.service.ts: FormService не экспортируется из @worldwiki/components
# - dynamic.service.ts: addDynamicItem не существует в FormService
```

---

## Архитектурные решения

| Проблема | Решение |
|----------|---------|
| `useAppShell` был 700+ строк | Разбит на 6 stores + типы в `shell.ts` |
| Dependency injection через контекст | Stores инъектируются напрямую в `setup()` |
| Циклические зависимости | Stores не импортируют друг друга (кроме `shell` → `schema`/`console`/`zoom`/`floating`) |
| Типы для внешнего использования | Экспортированы из `stores/shell.ts` и реэкспортированы в `stores/index.ts` |
| Resize/hover логика | Оставлена в `shell.ts` как функции (stateless) |

---

## Команды для продолжения (если нужно)

```bash
# Регенерация auto-imports после удаления composables
cd apps/spa && npx unplugin-auto-import

# Или просто перезапуск dev server
pnpm dev