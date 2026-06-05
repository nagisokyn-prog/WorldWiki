# Единая система вкладок: Главы + Сущности

Объединить текущие два независимых режима (`activeView === 'entity'` и `activeView === 'chapters'`)
в единую VS Code-подобную систему вкладок, где главы и сущности открываются рядом, можно переключаться
между ними, закрывать отдельно.

---

## Как сейчас

```
Activity Bar → "Главы"
  └─ activeView = 'chapters'
       └─ ChaptersView (отдельный мир, свои вкладки нет)

Activity Bar → "Персонажи"
  └─ activeView = 'entity'
       └─ editor-tabs-new (openEditors[])
            └─ EntityEditor
```

Проблема: при переходе на Главы — вкладки пропадают. Глава не может быть вкладкой рядом с персонажем.

---

## Целевое состояние

```
Activity Bar (любой пункт)
  └─ editor-tabs-new (единый для всего)
       ├─ [Персонаж: Иван] [×]
       ├─ [Глава 3: Буря] [×]   ← новый тип вкладки
       └─ [Организация: МЧС] [×]

Левая панель:
  - Если активна вкладка entity → список сущностей (как сейчас)
  - Если активна вкладка chapter → дерево глав (ChapterTree)
```

---

## Предлагаемые изменения

---

### 1. Типы (`app.ts`)

#### [MODIFY] [app.ts](file:///c:/Users/Administrator/Desktop/world-wiki/src/js/app/app.ts)

Расширить интерфейс `EditorTab`:

```diff
 interface EditorTab {
   id: string;
   title: string;
   entityType: string;
+  tabType: 'entity' | 'chapter';   // новое поле
   data: Record<string, unknown>;
   unsaved: boolean;
 }
```

Добавить ref для текущей главы в контексте вкладки:

```ts
// Уже есть в openEditors — главы хранятся там же,
// но с tabType: 'chapter' и нужными полями:
// { id: chapterId, title: 'Глава 3: Буря', tabType: 'chapter',
//   entityType: 'chapter', data: { arcId, volumeId, ... }, unsaved: false }
```

---

### 2. Открытие главы как вкладки (`app.ts`)

#### [MODIFY] [app.ts](file:///c:/Users/Administrator/Desktop/world-wiki/src/js/app/app.ts)

Добавить функцию `openChapterTab(chapter)` и экспортировать её:

```ts
const openChapterTab = (chapter: any) => {
  const id = String(chapter.id);
  const existing = openEditors.value.find(e => e.id === id);
  if (!existing) {
    openEditors.value.push({
      id,
      title: chapter.title || `Глава ${id}`,
      tabType: 'chapter',
      entityType: 'chapter',
      data: chapter,
      unsaved: false,
    });
  }
  activeEditorId.value = id;
  activeView.value = 'entity'; // единый режим
  addLog(`Editor -> Chapter [${chapter.title}]`, 'info');
};
```

Обновить `return { ..., openChapterTab }`.

---

### 3. Шаблон (`app.html`)

#### [MODIFY] [app.html](file:///c:/Users/Administrator/Desktop/world-wiki/src/app.html)

**3a. Вынести `editor-tabs-new` за пределы v-if `activeView === 'entity'`**

Сейчас табы спрятаны внутри entity-блока. Нужно поднять их выше:

```html
<!-- content-area-new -->
<div class="content-area-new">

  <!-- ЕДИНАЯ ПАНЕЛЬ ВКЛАДОК (всегда видна если есть открытые вкладки) -->
  <div class="editor-tabs-new" v-if="openEditors.length > 0">
    <div v-for="editor in openEditors" :key="editor.id"
         class="editor-tab-new interactive-el"
         :class="{ active: activeEditorId === editor.id }"
         @click="activeEditorId = editor.id">
      <!-- Иконка типа -->
      <span class="tab-type-icon">
        {{ editor.tabType === 'chapter' ? '📖' : '🗂️' }}
      </span>
      <span>{{ editor.title }}</span>
      <span v-if="editor.unsaved" class="tab-unsaved">●</span>
      <span class="tab-close interactive-el" @click.stop="closeEditor(editor.id)">×</span>
    </div>
  </div>

  <!-- КОНТЕНТ: зависит от типа активной вкладки -->
  <div v-if="activeEditor?.tabType === 'chapter'" style="flex:1; display:flex; overflow:hidden;">
    <!-- Показываем ChaptersMain в режиме управляемой главы -->
    <chapters-view-vue
      :project="projectName"
      :controlled-chapter-id="activeEditorId"
      @chapter-unsaved="markChapterUnsaved"
      @chapter-saved="markChapterSaved"
      style="flex:1;"
    />
  </div>

  <div v-else-if="activeView === 'entity' || !activeView" style="...">
    <!-- существующий entity editor (без внутреннего editor-tabs-new) -->
  </div>

</div>
```

**3b. Левая панель сайдбара** — показывать дерево глав когда активен chapter-tab:

```html
<div class="sidebar-new" v-if="activeSidebarItem || activeEditor?.tabType === 'chapter'">
  <!-- Если это chapters — показываем ChapterTree -->
  <template v-if="activeEditor?.tabType === 'chapter'">
    <!-- Мини-дерево (только для навигации, без главной логики) -->
    <chapter-tree-sidebar :project="projectName" @select="openChapterTab" />
  </template>
  <!-- Иначе — обычный список сущностей -->
  <template v-else>
    <!-- существующий sidebar контент -->
  </template>
</div>
```

---

### 4. `ChaptersView.vue` / `ChaptersMain.vue` — режим управляемой главы

#### [MODIFY] [ChaptersView.vue](file:///c:/Users/Administrator/Desktop/world-wiki/src/js/components/Vue/ChaptersView.vue)

Добавить prop `controlledChapterId`:

```ts
const props = defineProps({
  project: { type: String, required: true },
  controlledChapterId: { type: String, default: null },
});
```

Передать вниз в `ChaptersMain`.

#### [MODIFY] [ChaptersMain.vue](file:///c:/Users/Administrator/Desktop/world-wiki/src/js/components/Vue/Chapters/ChaptersMain.vue)

Если `controlledChapterId` задан — открывать именно эту главу при монтировании/изменении:

```ts
watch(() => props.controlledChapterId, async (id) => {
  if (id) await openChapter(id);
}, { immediate: true });
```

Эмитить события несохранённых изменений наверх:
```ts
emit('chapter-unsaved')
emit('chapter-saved')
```

---

### 5. Закрытие вкладки главы (`app.ts`)

Обновить `closeEditor` чтобы корректно работал для chapter:

```ts
const closeEditor = (id: string) => {
  const idx = openEditors.value.findIndex(e => e.id === id);
  if (idx > -1) {
    const tab = openEditors.value[idx];
    if (tab.unsaved && !confirm('Есть несохраненные изменения. Закрыть?')) return;
    openEditors.value.splice(idx, 1);
    if (activeEditorId.value === id) {
      activeEditorId.value = openEditors.value.length ? openEditors.value[openEditors.value.length - 1].id : null;
    }
  }
};
```

---

### 6. Связь: выбор главы в дереве → открытие вкладки

#### [MODIFY] [ChaptersMain.vue](file:///c:/Users/Administrator/Desktop/world-wiki/src/js/components/Vue/Chapters/ChaptersMain.vue)

Вместо внутреннего `openChapter` при клике в дереве — эмитировать событие наверх:

```ts
// Новое событие
emit('open-chapter-as-tab', chapter);
```

В `app.html`:
```html
<chapters-view-vue @open-chapter-as-tab="openChapterTab" ... />
```

---

## Порядок выполнения

- `[ ]` **Шаг 1** — Расширить `EditorTab` типом `tabType`
- `[ ]` **Шаг 2** — Добавить `openChapterTab` в `app.ts`
- `[ ]` **Шаг 3** — Вынести табы из entity-блока в `app.html`, добавить chapter-контент
- `[ ]` **Шаг 4** — `ChaptersView` + `ChaptersMain` принимают `controlledChapterId`
- `[ ]` **Шаг 5** — `ChaptersMain` эмитирует `open-chapter-as-tab` вместо внутреннего открытия
- `[ ]` **Шаг 6** — Обновить `closeEditor` для chapter-вкладок
- `[ ]` **Шаг 7** — Добавить иконки типа в табы (`📖` для глав)
- `[ ]` **Шаг 8** — Тест: открытие главы → появляется вкладка, переключение на сущность → вкладка главы остаётся

---

## Открытые вопросы

> [!IMPORTANT]
> **Дерево глав в сайдбаре**: когда активна глава-вкладка, слева показывать дерево глав или
> оставить список сущностей (тот что сейчас)? Или вообще скрывать сайдбар?

> [!NOTE]
> **Сохранение**: сейчас ChaptersMain автосохраняет через 2 секунды. При переключении
> вкладок нужно решить — сохранять при переключении или только по таймеру/явно.

> [!NOTE]
> **Стрелочка `unsaved`**: точка `●` в табе сущности — нужна ли она для глав тоже?
> Сейчас ChaptersMain показывает unsaved через EditorCore хедер.

---

## Оценка трудозатрат

| Шаг | Сложность | ~Время |
|-----|-----------|--------|
| 1-2 (типы + openChapterTab) | Низкая | 15 мин |
| 3 (app.html реструктура) | Средняя | 30 мин |
| 4-5 (props + emit) | Средняя | 30 мин |
| 6-8 (polish + тест) | Низкая | 20 мин |
| **Итого** | | **~1.5 ч** |
