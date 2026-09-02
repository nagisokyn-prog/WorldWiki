# Word-режим редактора: полная реализация (Document Engine v2.0)

## Цель

Реализовать полноценный Word-режим согласно спецификации `www.md`. Включает: правильную пагинацию с листами, полный Макет, колонтитулы, **таблицы с ГОСТ-автоподписью и Конструктором**, **рисунки с диалогом загрузки и ГОСТ-автоподписью**, **секционную смену ориентации отдельных страниц**.

---

## Изученная документация

### `tiptap-pagination-plus` v2.1.0
- Листы с зазорами: `pageGap`, `pageBreakBackground`
- Колонтитулы: `updateHeaderContent(left, right)`, `updateFooterContent(left, right)`, поддержка `{page}` и `{total}`
- Поля: `updateMargins({top, bottom, left, right})`
- `onHeaderClick/onFooterClick` — callback при клике → открываем диалог

### `@raazkhnl/rk-editor-core` v4.6.0
- `WordEditor.setPageLayout({pageSize, orientation, margins})` — поля и ориентация
- `WordEditor.getPageCount()` — официальный счётчик страниц
- `CommandManager.spacing(top, bottom)` — интервал до/после абзаца
- `CommandManager.sectionBreak()` — разрыв раздела (есть, не используется)
- `CommandManager.insertTextBox()` — текстовый блок (есть, не используется)
- `CommandManager.insertTableOfContents()` — оглавление (есть, не используется)
- `CommandManager.insertCaption(type)` — подпись к объекту (есть! используется частично)
- `Caption` extension — добавляет нумерованные подписи «Figure 1: ...» / «Table 2: ...»
- `Section` extension + `insertSectionBreak` command
- `TableStyles` extension — стили таблиц

### Ответы на ОВ из прошлой версии (по фидбэку)
- **Колонтитулы**: диалог через ленту + `onHeaderClick` открывает тот же диалог ✅
- **Интервал до/после абзаца**: применяется к **выделенному абзацу**, как в Word ✅
- **Поля**: нужны пресеты (ГОСТ / Нормальные / Узкие / Широкие) + произвольный диалог ✅

---

## Что прописано в www.md и отсутствует в коде

Спецификация требует создать три файла в `WordMode/extensions/`:
1. [`GostTableCaption.ts`](file:///c:\Users\Kuzma\Desktop\WorldWiki\apps\spa\src\ts\features\chapters\EditorCoreTiptap\WordMode\extensions\GostTableCaption.ts) — **НЕ СУЩЕСТВУЕТ**. Подписи таблиц ГОСТ «Таблица 1 — ...»
2. [`GostFigureCaption.ts`](file:///c:\Users\Kuzma\Desktop\WorldWiki\apps\spa\src\ts\features\chapters\EditorCoreTiptap\WordMode\extensions\GostFigureCaption.ts) — **НЕ СУЩЕСТВУЕТ**. Подписи рисунков ГОСТ «Рисунок 1 — ...»
3. [`SectionOrientation.ts`](file:///c:\Users\Kuzma\Desktop\WorldWiki\apps\spa\src\ts\features\chapters\EditorCoreTiptap\WordMode\extensions\SectionOrientation.ts) — **НЕ СУЩЕСТВУЕТ**. Секционная смена ориентации отдельных страниц

---

## Proposed Changes

---

### БЛОК 1 — Починка пагинации (КРИТИЧЕСКИЙ)

#### [MODIFY] [`rkPaginationBridge.ts`](file:///c:\Users\Kuzma\Desktop\WorldWiki\apps\spa\src\ts\features\chapters\EditorCoreTiptap\WordMode\rkPaginationBridge.ts)

**Проблема:** `{total}` не заменяется → `attachPaginationPlus` либо возвращает `null`, либо ссылка на `PaginationPlus`-редактор теряется.

1. Добавить диагностические логи на каждом шаге: дошли ли до `new V2Editor`, до `original.destroy()`, вернули ли `next`
2. Подмена редактора: проверить `(wordEditor as any).editor = next` вместо `wrapper.editor = next` (поле `editor` приватное в v4.6.0)
3. `pageGap: 24 → 40` — чёткое разделение как в Word
4. `pageBreakBackground: '#ffffff' → '#c0c0c0'` — серый зазор как в Word
5. Убрать `pageGapBorderSize` — при правильном цвете граница не нужна
6. `readPageCount` — перенести на `wordEditor.getPageCount()` (официальный API)

#### [MODIFY] [`useRkWordEditor.ts`](file:///c:\Users\Kuzma\Desktop\WorldWiki\apps\spa\src\ts\features\chapters\EditorCoreTiptap\WordMode\useRkWordEditor.ts)

1. `schedulePageCountSync` → использовать `wordEditor.value?.getPageCount()` вместо `readPageCount(tiptapEditor.value)`
2. Убрать дублирующий `setTimeout(schedulePageCountSync, 400)`
3. Добавить реактивные refs: `currentMarginsMm`, `headerLeft`, `headerRight`, `footerLeft`, `footerRight`
4. Добавить в `ribbonCommands`:
   - `setGostMargins` → `wordEditor.value.setPageLayout({margins: ГОСТ_MM})`
   - `setMarginPreset('normal'|'narrow'|'wide'|'gost')` → соответствующие значения
   - `setCustomMargins(top, bottom, left, right)` → произвольные значения в мм
   - `updateHeaderText(left, right)` → `updatePaginationText(..., {headerLeft, headerRight})`
   - `updateFooterText(left, right)` → `updatePaginationText(..., {footerLeft, footerRight})`
   - `setParagraphSpacing(beforePt, afterPt)` → `wordEditor.value.commands.spacing()`
   - `insertSectionBreak` → `wordEditor.value.commands.sectionBreak()`
   - `insertTextBox` → `wordEditor.value.commands.insertTextBox()`
   - `insertTableOfContents` → `wordEditor.value.commands.insertTableOfContents({minLevel:1, maxLevel:3, title:'Содержание', showPageNumbers:true})`
5. Экспортировать из composable: `currentMarginsMm`, `headerLeft`, `headerRight`, `footerLeft`, `footerRight`

---

### БЛОК 2 — Вкладка МАКЕТ: полная реализация

#### [MODIFY] [`WordRibbonBar.vue`](file:///c:\Users\Kuzma\Desktop\WorldWiki\apps\spa\src\ts\features\chapters\EditorCoreTiptap\WordRibbonBar\WordRibbonBar.vue)

**Группа "Параметры страницы":**

```
[Поля ▾]  [Ориентация ▾]  [Размер ▾]  [Разрывы ▾]
[лаунчер ↗ → PageSetupModal]
```

**Поля (кастомный dropdown):**
```
✓ ГОСТ 7.32  (Л:30 П:15 В:20 Н:20 мм)
  Нормальные (все по 20 мм)
  Узкие      (все по 12 мм)
  Широкие    (Л:50 П:50 В:20 Н:20 мм)
  ─────────────────────────────────
  Произвольные поля...  → PageSetupModal
```

**Ориентация (dropdown):**
```
✓ Книжная
  Альбомная
```
*Примечание: глобальная ориентация — для всего документа. Секционная ориентация отдельной страницы — через "Разрывы".*

**Размер (dropdown):** A4 / A5 / A3 / Letter / B5

**Разрывы (dropdown):**
```
Разрывы страниц:
  Страница
Разрывы разделов:
  Следующая страница (Portrait)
  Следующая страница (Landscape) ← ключевая фича из www.md §3.2
  Текущая страница
```

**Новая группа "Абзац"** (как на скрине Word):
```
Отступ:           Интервал:
[Слева:  0 см↕]  [До:    0 пт↕]
[Справа: 0 см↕]  [После: 0 пт↕]
```
→ применяется к выделенному абзацу через `commands.spacing()` / ruler sync

#### [NEW] `PageSetupModal.vue` — `EditorCoreTiptap/PageSetupModal/`

3 вкладки:
- **Поля**: числовые поля В/Н/Л/П (см), переплёт, несколько страниц (Обычный / Зеркальные / Буклет)
- **Бумага**: Размер dropdown + Ширина × Высота (автозаполнение)
- **Макет**: расстояние колонтитулов от края, чётные/нечётные, первая страница

Кнопки: **ОК** | **Отмена** | **По умолчанию**

---

### БЛОК 3 — Вкладка ВСТАВКА: колонтитулы и номера страниц

#### [MODIFY] [`WordRibbonBar.vue`](file:///c:\Users\Kuzma\Desktop\WorldWiki\apps\spa\src\ts\features\chapters\EditorCoreTiptap\WordRibbonBar\WordRibbonBar.vue)

**Новая группа "Колонтитулы":**
```
[Верхний ▾]  [Нижний ▾]  [Номер страницы ▾]
```

**Верхний (dropdown):**
```
Пусто
Название главы (слева)
Название главы (по центру)
────────────────────────
Изменить верхний колонтитул... → HeaderFooterDialog
Удалить
```

**Нижний (dropdown):**
```
Пусто
Стр. {page} из {total} (справа)
Стр. {page} из {total} (центр)
{page} (справа)
────────────────────────
Изменить нижний колонтитул... → HeaderFooterDialog
Удалить
```

**Номер страницы (dropdown):**
```
Вверху страницы → Слева / Центр / Справа
Внизу страницы  → Слева / Центр / Справа
────────────────────────
Убрать номера страниц
```

#### [NEW] `HeaderFooterDialog.vue` — `EditorCoreTiptap/HeaderFooterDialog/`

```
┌─────────────────────────────────────────────────────┐
│  Колонтитулы                                   [X]  │
├─────────────────────────────────────────────────────┤
│  [Верхний] [Нижний]                                 │
├─────────────────────────────────────────────────────┤
│  Слева:     [_____________________________]         │
│  По центру: [_____________________________]         │
│  Справа:    [_____________________________]         │
│                                                     │
│  Подсказки: {page} — номер, {total} — всего стр.   │
│                                                     │
│  ☐ Особый для первой страницы                      │
│  ☐ Разные для чётных/нечётных                      │
├─────────────────────────────────────────────────────┤
│                          [Отмена]  [ОК]             │
└─────────────────────────────────────────────────────┘
```

Формирует HTML через:
```
headerLeft = "<table style='width:100%'><tr>
  <td align='left'>{left}</td>
  <td align='center'>{center}</td>
  <td align='right'>{right}</td>
</tr></table>"
```
→ передаёт в `updatePaginationText`

`onHeaderClick` / `onFooterClick` из `rkPaginationBridge` → открывает этот же диалог.

---

### БЛОК 4 — Таблицы: grid-picker + Конструктор + ГОСТ-автоподпись

#### [NEW] `GostTableCaption.ts` — `WordMode/extensions/GostTableCaption.ts`

**Задача:** автоматически добавлять ГОСТ-подпись **над** таблицей при её вставке.
Формат: `Таблица {N} — {название}`

**Архитектура:**
- Обёртка над стандартным `Caption` extension из `rk-editor-core`
- Перехватывает команду `insertTable` через ProseMirror plugin
- После вставки таблицы автоматически вставляет узел `caption` типа `table` **перед** таблицей
- Нумерация: сканирует документ, считает все `caption[data-type="table"]` → берёт следующий номер
- Текст по умолчанию: `Таблица {N} — (название таблицы)`
- Пользователь кликает на подпись и редактирует название

**Примечание по нумерации согласно www.md §1.2.3:**
> Numbering Engine — рассчитывает все номера как чистую функцию.
Нумерация считается динамически при каждом рендере — не хранится в базе.

#### [NEW] Попап-пикер таблицы (TablePickerPopup)

Файл: `RkWordEditor.vue` или отдельный `TablePickerPopup.vue`

Вместо `prompt()` — hover-grid как в Word:
```
[ 1×1  1×2  1×3 ... 1×10 ]
[ 2×1  2×2  2×3 ... 2×10 ]
[  ...                   ]
[ 8×1  8×2  8×3 ... 8×10 ]
     Таблица 3×4           ← подпись при наведении
```
При клике → `commands.insertTable({rows, cols, withHeaderRow: true})` → затем `GostTableCaption` автоматически добавляет подпись.

#### [NEW] Вкладка "Конструктор таблицы" (Table Designer Tab)

Появляется в `WordRibbonBar` как **дополнительная вкладка** при нахождении каретки внутри таблицы (как в Word — контекстная вкладка).

Группы:

**"Параметры":**
- ☐ Строка заголовка
- ☐ Итоговая строка
- ☐ Чередующиеся строки
- ☐ Первый столбец
- ☐ Последний столбец

**"Стили таблиц":**
Набор визуальных пресетов (через `TableStyles` extension):
- Нет стиля (plain)
- Таблица сетка (Table Grid) ← ГОСТ-стиль
- Светлая заливка
- Тёмная заголовочная строка
- И др.

**"Строки и столбцы":**
```
[Вставить выше] [Вставить ниже]
[Вставить слева] [Вставить справа]
[Удалить строку] [Удалить столбец] [Удалить таблицу]
```

**"Объединение":**
```
[Объединить] [Разбить]
```

**"Размер ячейки":**
```
Высота строки: [__ см]  Ширина столбца: [__ см]
```

**Реализация:** в `WordRibbonBar.vue` добавить реактивную переменную `isInsideTable: boolean`, которая обновляется через `onSelectionChange`. При `isInsideTable === true` показывать дополнительную вкладку "Конструктор".

---

### БЛОК 5 — Рисунки: диалог загрузки + ГОСТ-автоподпись

#### [NEW] `GostFigureCaption.ts` — `WordMode/extensions/GostFigureCaption.ts`

**Задача:** автоматически добавлять ГОСТ-подпись **под** рисунком при его вставке.
Формат: `Рисунок {N} — {название}`

**Архитектура:**
- Обёртка над `Caption` extension (`type: 'figure'`)
- Перехватывает `insertImage` команду
- Вставляет `caption` узел **после** изображения
- Нумерация: сканирует документ, считает `caption[data-type="figure"]` → следующий номер
- Текст по умолчанию: `Рисунок {N} — (описание рисунка)`

#### [NEW] `ImageInsertDialog.vue` — `EditorCoreTiptap/ImageInsertDialog/`

Диалог вместо `prompt()`:

```
┌─────────────────────────────────────────────┐
│  Вставить рисунок                      [X]  │
├─────────────────────────────────────────────┤
│  [Загрузить с компьютера...]                │
│                                             │
│   ── или ──                                 │
│                                             │
│  URL: [https://___________________________] │
│                                             │
│  Подпись (необязательно):                   │
│  [_________________________________________]│
│                                             │
│  Выравнивание: ○ По ширине  ○ Слева  ○ Справа │
├─────────────────────────────────────────────┤
│                     [Отмена]  [Вставить]    │
└─────────────────────────────────────────────┘
```

- Загрузка файла: `<input type="file" accept="image/*">`, конвертация в base64 или через `imageUploadHandler` из `WordEditorOptions`
- При вставке: `commands.insertImage(src)` → затем `GostFigureCaption` автоматически добавляет подпись
- Если пользователь ввёл подпись вручную — используется она вместо дефолта

#### [MODIFY] [`useRkWordEditor.ts`](file:///c:\Users\Kuzma\Desktop\WorldWiki\apps\spa\src\ts\features\chapters\EditorCoreTiptap\WordMode\useRkWordEditor.ts)

- Добавить `imageUploadHandler` при инициализации `WordEditor`:
  ```
  imageUploadHandler: (file: File) => Promise<string>
  ```
  Конвертирует `File` → base64 data URL (для offline/Tauri) или загружает на сервер

---

### БЛОК 6 — Секционная ориентация (SectionOrientation.ts)

> **www.md §3.2.2, §1.2.4:** Ключевая фича — документ поддерживает секционную смену ориентации для широких таблиц и схем. Лист с широкой таблицей = альбомный, следующий разрыв возвращает книжную.

#### [NEW] `SectionOrientation.ts` — `WordMode/extensions/SectionOrientation.ts`

**Архитектура:**
- Обёртка над встроенным `Section` extension из `rk-editor-core`
- Добавляет атрибут `data-orientation="landscape"` / `"portrait"` к узлу раздела
- При смене ориентации раздела: вызывает `updatePaginationLayout` с новой геометрией для этого раздела

**Команды:**
- `insertSectionLandscape()` — вставить разрыв раздела + переключить в Landscape
- `insertSectionPortrait()` — вставить разрыв раздела + вернуть Portrait
- `setSectionOrientation(orientation)` — изменить ориентацию текущего раздела

**Экспорт в DOCX (www.md §3.2.2):**
- При `insertSectionLandscape`: в экспортируемом DOCX генерируется `<w:sectPr><w:pgSz w:orient="landscape" .../></w:sectPr>`
- `WordEditor.exportDocx()` уже поддерживает это через `ExportEngine` — нужно передавать корректные `sectPr`

#### [MODIFY] [`WordRibbonBar.vue`](file:///c:\Users\Kuzma\Desktop\WorldWiki\apps\spa\src\ts\features\chapters\EditorCoreTiptap\WordRibbonBar\WordRibbonBar.vue) — вкладка Макет

Расширить dropdown **"Разрывы"**:
```
Разрывы страниц:
  Страница                    → insertPageBreak
─────────────────────────
Разрывы разделов:
  Следующая страница          → insertSectionBreak (Portrait)
  Следующая страница (Альб.) → insertSectionLandscape  ← КЛЮЧЕВАЯ ФИЧА
  Текущая страница            → insertSectionBreak (текущий)
  Вернуть книжную             → insertSectionPortrait
```

**Визуальный индикатор** в статусной строке:
- Показывать текущую ориентацию активного раздела: `📄 Книжная` / `📋 Альбомная`
- Линейка (`WordRuler`) реактивно меняет ширину: 794px (Portrait) ↔ 1123px (Landscape) (из www.md §3.2.1)

---

### БЛОК 7 — CSS: визуальный вид страниц как в Word

#### [MODIFY] [`RkWordEditor.css`](file:///c:\Users\Kuzma\Desktop\WorldWiki\packages\resources\src\styles\features\chapters\RkWordEditor.css)

```css
/* Зазор — серый как в Word */
.rk-editor-mount .rm-pagination-gap { background: #c0c0c0; }

/* Лист с тенью */
.rk-editor-mount .rm-page-break .page {
  box-shadow: 0 1px 4px rgba(0,0,0,0.25), 0 0 0 1px rgba(0,0,0,0.08);
}

/* Колонтитулы */
.rk-editor-mount .rm-page-header { border-bottom: 0.75pt solid #aaa; }
.rk-editor-mount .rm-page-footer { border-top: 0.75pt solid #aaa; }
```

#### [MODIFY] [`EditorCoreTiptap.css`](file:///c:\Users\Kuzma\Desktop\WorldWiki\packages\resources\src\styles\features\chapters\EditorCoreTiptap.css)

**Удалить строки 386–416** — старые стили `hr.page-break` и `[data-page-break]` с надписью "Конец страницы". Это CSS из старого механизма page-break, он мешает `tiptap-pagination-plus`.

---

### БЛОК 8 — Типы и RibbonCommands

#### [MODIFY] [`WordRibbonBar.vue`](file:///c:\Users\Kuzma\Desktop\WorldWiki\apps\spa\src\ts\features\chapters\EditorCoreTiptap\WordRibbonBar\WordRibbonBar.vue) — интерфейс `RibbonCommands`

Добавить:
```typescript
// Макет — поля
setGostMargins?: () => void;
setMarginPreset?: (preset: 'gost'|'normal'|'narrow'|'wide') => void;
setCustomMargins?: (top: number, bottom: number, left: number, right: number) => void;

// Макет — абзац
setParagraphSpacing?: (beforePt: number, afterPt: number) => void;
setLeftIndentCm?: (cm: number) => void;
setRightIndentCm?: (cm: number) => void;

// Разрывы разделов
insertSectionPortrait?: () => void;
insertSectionLandscape?: () => void;  // ← ключевая фича

// Колонтитулы
updateHeaderText?: (left: string, right: string) => void;
updateFooterText?: (left: string, right: string) => void;

// Вставка (новые)
insertTextBox?: () => void;
insertTableOfContents?: () => void;
```

#### [MODIFY] [`RkWordEditor.model.ts`](file:///c:\Users\Kuzma\Desktop\WorldWiki\apps\spa\src\ts\features\chapters\EditorCoreTiptap\WordMode\RkWordEditor.model.ts)

Добавить emits для диалогов:
```typescript
'open-image-dialog': [];
'open-table-picker': [];
'open-link-dialog': [];
'open-equation-dialog': [];
'open-page-setup': [];
'open-header-footer-dialog': [tab?: 'header' | 'footer'];
```

---

## Полный список файлов

| Действие | Файл | Блок |
|---|---|---|
| MODIFY | [`rkPaginationBridge.ts`](file:///c:\Users\Kuzma\Desktop\WorldWiki\apps\spa\src\ts\features\chapters\EditorCoreTiptap\WordMode\rkPaginationBridge.ts) | 1 |
| MODIFY | [`useRkWordEditor.ts`](file:///c:\Users\Kuzma\Desktop\WorldWiki\apps\spa\src\ts\features\chapters\EditorCoreTiptap\WordMode\useRkWordEditor.ts) | 1, 5 |
| MODIFY | [`WordRibbonBar.vue`](file:///c:\Users\Kuzma\Desktop\WorldWiki\apps\spa\src\ts\features\chapters\EditorCoreTiptap\WordRibbonBar\WordRibbonBar.vue) | 2, 3, 4, 6, 8 |
| MODIFY | [`RkWordEditor.vue`](file:///c:\Users\Kuzma\Desktop\WorldWiki\apps\spa\src\ts\features\chapters\EditorCoreTiptap\WordMode\RkWordEditor.vue) | 3, 4, 5 |
| MODIFY | [`RkWordEditor.model.ts`](file:///c:\Users\Kuzma\Desktop\WorldWiki\apps\spa\src\ts\features\chapters\EditorCoreTiptap\WordMode\RkWordEditor.model.ts) | 8 |
| MODIFY | [`RkWordEditor.css`](file:///c:\Users\Kuzma\Desktop\WorldWiki\packages\resources\src\styles\features\chapters\RkWordEditor.css) | 7 |
| MODIFY | [`EditorCoreTiptap.css`](file:///c:\Users\Kuzma\Desktop\WorldWiki\packages\resources\src\styles\features\chapters\EditorCoreTiptap.css) | 7 |
| **NEW** | `WordMode/extensions/GostTableCaption.ts` | 4 |
| **NEW** | `WordMode/extensions/GostFigureCaption.ts` | 5 |
| **NEW** | `WordMode/extensions/SectionOrientation.ts` | 6 |
| **NEW** | `EditorCoreTiptap/PageSetupModal/PageSetupModal.vue` | 2 |
| **NEW** | `EditorCoreTiptap/HeaderFooterDialog/HeaderFooterDialog.vue` | 3 |
| **NEW** | `EditorCoreTiptap/ImageInsertDialog/ImageInsertDialog.vue` | 5 |
| **NEW** | `EditorCoreTiptap/TablePickerPopup/TablePickerPopup.vue` | 4 |

---

## Порядок реализации (приоритеты)

| # | Задача | Сложность |
|---|--------|-----------|
| **1.1** | Диагностика + починка `attachPaginationPlus` / `{total}` | Средняя |
| **1.2** | CSS: серый зазор + тень страницы | Лёгкая |
| **1.3** | Убрать старые CSS page-break строки 386–416 | Лёгкая |
| **2.1** | `setGostMargins` и пресеты полей в Макете | Лёгкая |
| **2.2** | Числовые поля Отступ/Интервал в группе "Абзац" Макета | Средняя |
| **3.1** | Группа "Колонтитулы" во Вставке + dropdown пресетов | Средняя |
| **3.2** | `HeaderFooterDialog.vue` | Средняя |
| **4.1** | `TablePickerPopup.vue` (hover-grid) | Средняя |
| **4.2** | `GostTableCaption.ts` (автоподпись таблиц ГОСТ) | Высокая |
| **4.3** | Вкладка "Конструктор таблицы" (контекстная) | Высокая |
| **5.1** | `ImageInsertDialog.vue` (загрузка файла + URL) | Средняя |
| **5.2** | `GostFigureCaption.ts` (автоподпись рисунков ГОСТ) | Высокая |
| **6.1** | `SectionOrientation.ts` + dropdown "Разрывы (Альбомная)" | Высокая |
| **6.2** | Реактивная ширина линейки 794px ↔ 1123px при смене раздела | Средняя |
| **7.1** | `PageSetupModal.vue` (3 вкладки) | Высокая |
| **7.2** | Диалог ссылки + диалог уравнения | Средняя |
| **7.3** | Кнопки Оглавление + Текстовый блок в ленте | Лёгкая |

---

## Verification Plan

### Автоматические тесты
- `rkWordEditor.spec.ts`: `setGostMargins`, `toggleOrientation`, `insertSectionLandscape`
- `wordFormatting.spec.ts`: генерация HTML колонтитулов, автоподпись таблицы, автоподпись рисунка

### Ручная проверка (Definition of Done из www.md §7)
1. Страницы разделены **серым** зазором (не белым), лист с тенью
2. `{total}` заменяется реальным числом в колонтитуле
3. Вставка таблицы через grid-picker → автоматически появляется подпись «Таблица 1 — ...» над таблицей
4. При клике на таблицу → появляется вкладка **Конструктор** в ленте
5. Вставка рисунка через диалог (не prompt) → автоматически подпись «Рисунок 1 — ...» под рисунком
6. Макет → Разрывы → **Следующая страница (Альбомная)** → один лист становится горизонтальным, линейка расширяется до 1123px
7. Макет → Поля → ГОСТ → поля реально меняются на листе
8. Экспорт в DOCX → открывается в Word с правильными полями, колонтитулами и альбомными секциями
