# Анализ покрытия ветвей — что добавить и куда

Глобальная цель: **85% branch coverage**. Ниже — конкретные тесты для каждого файла с gap'ом.

---

## 1. [`useChapterTree.spec.ts`](file:///c:/Users/Kuzma/Desktop/WorldWiki/apps/spa/src/ts/features/chapters/ChapterTree/__tests__/useChapterTree.spec.ts) — Branch: **38%**

**Файл источник:** [`useChapterTree.ts`](file:///c:/Users/Kuzma/Desktop/WorldWiki/apps/spa/src/ts/features/chapters/ChapterTree/useChapterTree.ts)

| Ветвь | Строка | Что нужно |
|---|---|---|
| `compareIds` — оба типа не string (объекты) | L21–22 | Передать `id1 = { id: { String: 'abc' } }`, `id2 = { id: 'abc' }` |
| `compareIds` — `id1.id` отсутствует, используется `JSON.stringify` | L21 | Передать `id1 = { foo: 'bar' }` без `.id` |
| `vol.title` = undefined → `'Без названия'` | L56 | Том без `title` в `hierarchy.volumes` |
| `arc.title` = undefined → `'Без названия'` | L69, L97 | Арка без `title` |
| `ch.title` = undefined → `'Без названия'` | L81, L108, L120 | Глава без `title` |
| `ent.title` fallback label | L142 | Вызвать `getEntityName` с entity без name |
| `handleSelect` — `node.data` = undefined | L211 | Узел без `.data` |
| `handleOpen` — нет data / isEntity=true | L222–226 | `handleOpen({ data: { isEntity: true, original: {}, type: 'character' } })` |
| `entityRenamedHandler` — `type` не совпадает | L177 | Событие с несуществующим type |
| `entityRenamedHandler` — entity найден, titleField через `Object.keys` | L180 | Событие с реальным `id` и `type` |
| `handleCreate` — `sectionId !== 'manuscript'` + `name` передан | L290–292 | `handleCreate({ sectionId: 'character', name: 'Arthur' })` |
| `handleCreate` — `sectionId !== 'manuscript'` + `name` не передан | L290 | `handleCreate({ sectionId: 'character' })` → emit не вызывается |
| `handleCreateInline` — `sectionId !== 'manuscript'` | L317–319 | `handleCreateInline({ sectionId: 'character' })` |
| `handleCreateInline` — parentId есть, arc не найден, vol тоже не найден | L308–310 | parentId = 'unknown_parent' |
| `handleRename` — `__new_arc__` путь | L329–331 | Переименование узла с id `__new_arc__123` |
| `handleRename` — тип `volume`, vol не найден в hierarchy | L333 | volume с id который не в hierarchy |
| `handleRename` — тип `arc`, arc не найден | L338 | arc с id которого нет |
| `handleRename` — тип `chapter` | L342–346 | Переименование chapter ноды |
| `handleRename` — тип `entity` + entities[type] пуст | L352–357 | entity rename, entities[type] = [] |
| `handleCancelRename` — id начинается с `__new_arc__` | L369 | `handleCancelRename({ id: '__new_arc__999' })` |
| `handleDelete` — `type === 'arc'` | L387 | handleDelete(['arc_root']) |
| `handleDelete` — `type === 'chapter'` | L389 | handleDelete(['ch_root']) |
| `handleDelete` — `node.data.isEntity` | L391 | findNodeById → entity node |
| `findNodeById` — grandchild level | L406–408 | Искать id внутри children.children |

---

## 2. [`shell.spec.ts`](file:///c:/Users/Kuzma/Desktop/WorldWiki/apps/spa/src/ts/stores/__tests__/shell.spec.ts) — Branch: **58.89%**

**Файл источник:** [`shell.ts`](file:///c:/Users/Kuzma/Desktop/WorldWiki/apps/spa/src/ts/stores/shell.ts)

| Ветвь | Строка | Что нужно |
|---|---|---|
| `restoreState` — нет сохранённого состояния (early return) | L178 | localStorage пуст, вызвать `restoreState()` → false |
| `restoreState` — старый формат `openTabs` (без `editorGroups`) | L188–218 | localStorage с `openTabs: [...]` без `editorGroups` |
| `restoreState` — tabType='chapter' | L200–201 | Tab с `tabType: 'chapter'` в сохранённом состоянии |
| `restoreState` — tabType='schema-editor' | L202–203 | Tab с `tabType: 'schema-editor'` |
| `restoreState` — catch при загрузке вкладки | L205 | `entityApi.getEntity` бросает ошибку |
| `restoreState` — activeEditorId в state (ветка без rawGroups) | L213–214 | state с `activeEditorId: 'x'` и `openTabs` |
| `loadEntityList` — catch path | L236–239 | `entityApi.getEntityList` бросает ошибку |
| `loadChapters` (shell) — catch path | L247–250 | `api.getChapters` бросает ошибку |
| `selectSidebarTab` — type='static' с url | L255–258 | item с `type: 'static', url: '/x'` |
| `openEntity` — entity без entityType | L273 | `openEntity({ id: '1' })` без entityType |
| `openEntity` — entity без id | L274–276 | `openEntity({ entityType: 'character', id: undefined })` |
| `openEntity` — catch в fetch entity | L290–293 | `entityApi.getEntity` → reject |
| `openChapterTab` — вкладка уже открыта (activate existing) | L310–311 | Открыть ту же главу дважды |
| `openSchemaEditor` — вкладка уже открыта | L326–328 | Открыть схему дважды |
| `handleUpdateData` — tab не найден | L366 | tabId несуществующего таба |
| `handleUpdateData` — merge вложенных объектов | L370–371 | Data с вложенными объектами |
| `handleUpdateData` — merge массивов + длиннее source | L374–382 | target массив длиннее чем source |
| `handleUpdateData` — fromLiveSync=true → таймер не запускается | L407 | Передать `fromLiveSync=true` |
| `deleteEntity` — silent=true (пропустить модальное окно) | L664 | Вызвать `deleteEntity(tabId, type, true)` |
| `deleteEntity` — отмена в модалке | L685 | Кликнуть cancel-btn |
| `deleteEntity` — catch при deleteEntity | L692–694 | `api.deleteEntity` → reject |
| `startResize` — mousemove и mouseup | L428–438 | Сымитировать MouseEvent drag |
| `startSidebarResize` — row-reverse layout | L450 | settings.layout.sidebarPos = 'row-reverse' |
| `startSplitResize` — нет .split-layout-wrapper в target | L467 | e.target без ancestor |
| `startGroupResize` — нет container | L491 | e.currentTarget без ancestor |
| `startGroupResize` — left или right undefined | L498 | groupIdx = 99 |
| `saveAll` — tab.unsaved=false → skip | L557 | Все вкладки saved |
| `saveAll` — chapter unsaved → dispatchEvent | L558–560 | Chapter tab с unsaved=true |
| `saveAll` — schema-editor unsaved → dispatchEvent | L562–568 | Schema-editor tab с unsaved=true |
| `saveAll` — savedEntity.id отсутствует | L631–632 | Ответ без id |
| `saveAll` — title изменился → update | L635–637 | Новый title отличается |
| `deleteVolume` — с арками и главами | L700+ | Вызвать deleteVolume с данными |
| `renameEntity` — catch | L700+ | entityApi.saveEntity → reject |

---

## 3. [`calendar.store.spec.ts`](file:///c:/Users/Kuzma/Desktop/WorldWiki/apps/spa/src/ts/stores/__tests__/calendar.store.spec.ts) — Branch: **70.21%**

**Файл источник:** [`calendar.store.ts`](file:///c:/Users/Kuzma/Desktop/WorldWiki/apps/spa/src/ts/stores/calendar.store.ts)

| Ветвь | Строка | Что нужно |
|---|---|---|
| `getCalendars` — cached path | L13–14 | Вызвать дважды → второй раз из кеша |
| `getCalendars` — list есть, нет master, `isCreatingMaster` уже true | L21 | Параллельный вызов пока идёт создание |
| `getCalendars` — list не пуст, нет master, `list.length === 1` → переименовать | L29–32 | Список из одного календаря без master |
| `getCalendars` — пустой список, `isCreatingMaster` уже true | L40–41 | Параллельный вызов при создании master |
| `loadCalendar` — catch path | L73–75 | `getCalendars` → reject |
| `loadCalendar` — нет is_default, берётся list[0] | L67 | Календари без `is_default=true` |
| `saveCalendar` — без `_id` (нет calId) | L82, L96 | Calendar без `_id` и `id` → payload без id |
| `saveCalendar` — catch path | L101–104 | `api.saveCalendar` → reject → false |
| `deleteCalendar` — catch path | L112–115 | `api.deleteCalendar` → reject → false |

---

## 4. [`tags.store.spec.ts`](file:///c:/Users/Kuzma/Desktop/WorldWiki/apps/spa/src/ts/stores/__tests__/tags.store.spec.ts) — Branch: **69.23%**

**Файл источник:** [`tags.store.ts`](file:///c:/Users/Kuzma/Desktop/WorldWiki/apps/spa/src/ts/stores/tags.store.ts)

| Ветвь | Строка | Что нужно |
|---|---|---|
| `init` — cached path (getCached возвращает данные) | L23–25 | Инициализировать дважды с разным проектом, или очистить isInitialized вручную |
| `init` — catch path | L30–33 | `api.getTags` → reject |
| `createNewTag` — isCreatingTag уже true | L41 | Вызвать дважды одновременно |
| `createNewTag` — project = null | L41 | `store.project = null` → ранний выход |
| `deleteTag` — project = null | L57 | `store.project = null` → ранний выход |
| `deleteTag` — tag найден, но `tag.id` отсутствует | L59 | Tag без id — `api.deleteTag` НЕ вызывается |
| `saveTag` — project = null | L67 | `store.project = null` → ранний выход |
| `saveTag` — existingTag не найден → push new | L80–82 | Передать oldName которого нет в списке |

---

## 5. [`chapter.store.spec.ts`](file:///c:/Users/Kuzma/Desktop/WorldWiki/apps/spa/src/ts/stores/__tests__/chapter.store.spec.ts) — Branch: **66.01%**

**Файл источник:** [`chapter.store.ts`](file:///c:/Users/Kuzma/Desktop/WorldWiki/apps/spa/src/ts/stores/chapter.store.ts)

| Ветвь | Строка | Что нужно |
|---|---|---|
| `currentVolume` — через `chapter.volume_id` (без arc) | L35–40 | Chapter с `volume_id` напрямую, без arc_id |
| `currentVolume` — volume не найдено | L40 | volume_id которого нет в hierarchy |
| `saveChapter` — `currentChapter` null → false | L62 | `store.currentChapter = null` → saveChapter → false |
| `saveChapter` — `isSaving` true → false | L62 | Установить `store.isSaving = true` перед вызовом |
| `saveChapter` — participant уже есть → не добавлять | L68 | currentChapter.participants уже содержит parsed participant |
| `saveChapter` — `emitFn` не передан (undefined) | L78 | Вызвать без emitFn аргумента |
| `saveChapter` — listIdx === -1 (chapter не в списке) | L81 | chapters = [] → title не обновляется |
| `openChapter` — unsavedChanges есть → сначала save | L100–103 | hasUnsavedChanges = true → проверить что save вызван |
| `createNewChapter` — arcId + volumeId оба переданы | L133–138 | `createNewChapter('proj', 'arc_1', 'vol_1')` |
| `createNewChapter` — только volumeId без arcId | L136 | `createNewChapter('proj', undefined, 'vol_1')` |
| `createNewChapter` — num > 1 (не первая глава) → нет timeline | L153 | Hierarchy с двумя главами → новая будет 3-я |
| `createNewChapter` — num === 1, loadCalendar → null (нет точки) | L156 | loadCalendar вернёт null |
| `createNewChapter` — catch при loadCalendar | L168 | loadCalendar → reject |
| `onRenameChapter` — currentChapterId не совпадает | L191 | rename другой главы, не активной |
| `deleteChapter` — currentChapterId не совпадает | L198 | delete главы которая не активна |

---

## 6. [`hotkeys.spec.ts`](file:///c:/Users/Kuzma/Desktop/WorldWiki/apps/spa/src/ts/stores/__tests__/hotkeys.spec.ts) — Branch: **72.63%**

**Файл источник:** [`hotkeys.ts`](file:///c:/Users/Kuzma/Desktop/WorldWiki/apps/spa/src/ts/stores/hotkeys.ts)

| Ветвь | Строка | Что нужно |
|---|---|---|
| `BROWSER_OVERRIDES` — код не в Set → не вызывать preventDefault | L19 | Ctrl+KeyQ → preventDefault не вызывается |
| `Ctrl+F` — input элемент не найден | L56–57 | Вызвать без `.sidebar-search input` в DOM |
| `Ctrl+W` — activeEditorId = null → closeEditor не вызывается | L61 | shell.activeEditorId = null |
| `Ctrl+P` — quickOpenRef без `.open` метода | L67–69 | `shell.quickOpenRef = {}` без open |
| `Ctrl+N` — currentSidebarTab = null | L72–73 | shell.currentSidebarTab = null → addNewEntity не вызван |
| `F11` — без TAURI, уже fullscreen → exitFullscreen | L37–41 | Замокировать `document.fullscreenElement` |
| `F11` — без TAURI, не fullscreen → requestFullscreen | L33–35 | `document.fullscreenElement = null` |
| `F11` — TAURI, invoke выбрасывает ошибку | L29 | `invoke` → reject |
| `Ctrl+Alt+B` — localStorage.setItem меняет значение | L155–157 | Проверить что localStorage изменился |
| `Ctrl+Shift+P` — commandPaletteRef без open | L113–115 | `shell.commandPaletteRef = {}` |
| `Ctrl+Shift+T` — tagsManagerRef без open | L127–129 | `shell.tagsManagerRef = {}` |
| `Ctrl+Shift+S` — вызывает saveAll | L120–121 | Ctrl+Shift+S |
| `Ctrl+R` — storedValue не 'false' → newState = false | L165–168 | localStorage пуст → первый раз |
| `Escape` — showSettings = false → не менять | L174–178 | showSettings уже false → Escape ничего не делает |
| `Alt+Digit10` — нет match → не dispatch | L143 | Нажать Alt+Digit0 → не должно dispatch |

---

## 7. [`useTiptapFormatting.spec.ts`](file:///c:/Users/Kuzma/Desktop/WorldWiki/apps/spa/src/ts/features/chapters/EditorCoreTiptap/hooks/__tests__/useTiptapFormatting.spec.ts) — Branch: **60%**

**Файл источник:** [`useTiptapFormatting.ts`](file:///c:/Users/Kuzma/Desktop/WorldWiki/apps/spa/src/ts/features/chapters/EditorCoreTiptap/hooks/useTiptapFormatting.ts)

| Ветвь | Строка | Что нужно |
|---|---|---|
| `insertImage` — prompt возвращает null | L16 | `globalThis.prompt = vi.fn().mockReturnValue(null)` |
| `insertImage` — editor.value = null | L16 | `editor = ref(null)` → insertImage ничего не делает |
| `insertLink` — text = null | L22–26 | Первый prompt → null |
| `insertLink` — url = null | L23 | Первый prompt OK, второй → null |
| `insertTable` — editor.value = null | L30 | `editor = ref(null)` |
| `clearFormatting` — editor.value = null | L35 | `editor = ref(null)` |
| `insertFootnote` — prompt = null | L41 | `globalThis.prompt = vi.fn().mockReturnValue(null)` |
| `insertFootnote` — editor.value = null | L41 | `editor = ref(null)` |
| `deleteFootnote` — appConfirm = false | L51 | `appConfirm.mockResolvedValueOnce(false)` |
| `cycleGlobalTag` — editor.value = null | L59 | `editor = ref(null)` |
| `cycleGlobalTag` — targetPos === -1 (paragraph не найден) | L76 | `descendants` вызывает callback только с headings |
| `cycleGlobalTag` — tag = 'dialog' → nextTag = 'thought' | L78 | `semanticTag: 'dialog'` |
| `cycleGlobalTag` — tag = 'thought' → nextTag = 'desc' | L78 | `semanticTag: 'thought'` |

---

## 8. [`useTiptapSplitView.spec.ts`](file:///c:/Users/Kuzma/Desktop/WorldWiki/apps/spa/src/ts/features/chapters/EditorCoreTiptap/hooks/__tests__/useTiptapSplitView.spec.ts) — Branch: **73.58%**

**Файл источник:** [`useTiptapSplitView.ts`](file:///c:/Users/Kuzma/Desktop/WorldWiki/apps/spa/src/ts/features/chapters/EditorCoreTiptap/hooks/useTiptapSplitView.ts)

| Ветвь | Строка | Что нужно |
|---|---|---|
| `showStructure` — localStorage 'false' → false | L4 | `localStorage.setItem('split-view-show-structure', 'false')` перед init |
| `leftPanelWidth` — из localStorage | L11–13 | `localStorage.setItem('split-view-left-width', '55')` → проверить 55 |
| `rightPanelWidth` — из localStorage | L12–14 | `localStorage.setItem('split-view-right-width', '30')` |
| `startResizeLeft` — container = null | L19 | `e.currentTarget` без parentElement |
| `startResizeRight` — container = null | L46 | `e.currentTarget` без parentElement |
| `documentStructure` — editor.value = null | L72 | `editor = ref(null)` → вернуть [] |
| `documentStructure` — doc.content = undefined | L117 | `getJSON()` без content |
| `traverse` — node = null / undefined | L79 | Узел с `null` content item |
| `traverse` — node — Array | L81 | Передать массив в traverse |
| `traverse` — heading без level attr | L97 | `{ type: 'heading', attrs: {} }` |
| `traverse` — paragraph без semanticTag | L99 | `{ type: 'paragraph', attrs: {} }` |
| `leftPanelWidth` — клампинг min (20%) | L29 | Огромный отрицательный delta |
| `leftPanelWidth` — клампинг max (60%) | L29 | Огромный положительный delta |

---

## 9. [`useChapterTree.spec.ts`](file:///c:/Users/Kuzma/Desktop/WorldWiki/apps/spa/src/ts/features/chapters/ChapterTree/__tests__/useChapterTree.spec.ts) — уже есть, нужно дополнить

Смотри секцию 1 выше.

---

## 10. [`calendar.store.spec.ts`](file:///c:/Users/Kuzma/Desktop/WorldWiki/apps/spa/src/ts/stores/__tests__/calendar.store.spec.ts) — уже есть, нужно дополнить

Смотри секцию 3 выше.

---

## Дополнительные файлы (branch < 75%)

### [`useEditorGroups`](file:///c:/Users/Kuzma/Desktop/WorldWiki/packages/components/src/ts/composables/useEditorGroups.ts) — Branch: **70.7%**

| Ветвь | Строка | Что нужно |
|---|---|---|
| `closeTab` — tab unsaved, confirm = false | L135–138 | `confirm` → false → вернуть false |
| `closeTab` — tab в группе 1 из 1, становится пустой | L150–152 | Закрыть последний tab в единственной группе |
| `moveTab` — targetGroup не найден | L224–226 | targetGroupId несуществующий |
| `moveTab` — srcGroup.activeTabId === tabId | L234–236 | Перемещаем активную вкладку |
| `moveTab` — srcGroup после move пустая, только 1 группа | L238–240 | 1 группа, moveTab — не удаляет группу |
| `restoreState` — serialized пуст/undefined | L284 | Передать `[]` → early return |
| `restoreState` — tab не найден в loadedTabs → filter(Boolean) | L291 | tab.id которого нет в loadedTabs |
| `restoreState` — validActiveTabId не в validTabs | L295–296 | activeTabId не в tabs |
| `closeAll` — hasUnsaved, confirm = false | L262–263 | Есть unsaved, `confirm()` → false |
| `splitRight` — sourceIdx < 0 (не найден) | L194 | sourceGroupId которого нет |
| `reorderTab` — fromIdx === toIdx | L246 | Одинаковые индексы |
| `switchTabInGroup` — меньше 2 вкладок | L254 | Группа с 1 вкладкой |
| `switchTabInGroup` — dir = -1 | L256 | Переключить назад |

### [`useChapterTree compareIds`](file:///c:/Users/Kuzma/Desktop/WorldWiki/apps/spa/src/ts/features/chapters/ChapterTree/useChapterTree.ts#L19-L28) — уже в секции 1

### `tags.store` — уже в секции 4

---

## Порядок реализации (по приоритету)

1. **`shell.spec.ts`** — наибольший импакт, много непокрытых ветвей
2. **`chapter.store.spec.ts`** — ещё 12+ ветвей
3. **`useChapterTree.spec.ts`** — сложно, но есть ~20 ветвей
4. **`useTiptapFormatting.spec.ts`** — простые null-guard тесты
5. **`useTiptapSplitView.spec.ts`** — localStorage и null-guard
6. **`calendar.store.spec.ts`** — cache и error paths
7. **`tags.store.spec.ts`** — guard clauses
8. **`hotkeys.spec.ts`** — BROWSER_OVERRIDES + null refs
9. **`useEditorGroups`** (packages/components) — closeTab/moveTab edges
