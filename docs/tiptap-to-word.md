# ТЗ: Изоляция Word-редактора (RK + Tiptap v2) от основного приложения (Tiptap v3)

> Статус: черновик ТЗ · Дата: 2026-09-02
> Связанные документы: docs/implementation_plan_word.md, TECHNICAL_SPECIFICATION.md

## 1. Проблема (что сломано сейчас)

### 1.1. Симптомы
1. Кнопки Word-ленты применяют форматирование «в никуда» — `toggleBold()` возвращает `false`, визуально ничего не происходит.
2. Выделение текста визуально пропадает при клике по ленте (focus theft).
3. В консоли: `[tiptap warn]: Duplicate extension names found: ['underline']`.
4. `rkPaginationBridge: original destroyed, editor reference swapped` — живой редактор подменяется после монтирования, а компоненты удерживают ссылки на старый.

### 1.2. Первопричина — утечка внутренних объектов через границу режимов

Приложение имеет **два редакторных рантайма**:

| Рантайм | Ядро | Где живёт | Назначение |
|---|---|---|---|
| Обычный (WYSIWYG/Markdown/Split) | `@tiptap/core@3.27.4` (v3) | `useTiptapEditor.ts`, `EditorCoreTiptap.vue` | главы, сущности, AI, семантика |
| Word-режим | `@raazkhnl/rk-editor-core@4.6.0` на `@tiptap/core@2.27.2` (v2) + `tiptap-pagination-plus@2.1.0` | `EditorCoreTiptap/WordMode/*` | постраничная вёрстка, ГОСТ, DOCX/PDF |

Сегодня рантаймы **смешаны и обмениваются живыми объектами**:

```
useRkWordEditor.ts
  wordEditor.value   = editor            ← внутренний RK-объект утекает наружу
  tiptapEditor.value = editor.instance   ← сырой ProseMirror Editor утекает
       │
       ├─→ WordRibbonBar  :editor="tiptapEditor"   (читает .state.selection)
       ├─→ WordRuler      :editor="tiptapEditor"   (читает ed.state.selection, ed.on(...))
       └─→ ribbonCommands: () => wordEditor.value?.commands.bold()
```

Дополнительные факторы:
- `attachPaginationPlus` уничтожает оригинальный tiptap-инстанс, пересобирает его с PaginationPlus и подменяет слоты `editor/instance` + сервисы (`commands/exporter/importer/printer/_styleManager`) внутри обёртки. Компоненты со старыми ссылками продолжают командовать мёртвым редактором.
- Vite-плагин `pagination-plus-tiptap-v2` алиасит импорты pagination-plus на v2-копии ядра — хрупкий хак, завязанный на пути в node_modules.
- rk-editor-core объявляет `@tiptap/core@^2.27.0`, но эта копия сосуществует с корневой v3 → дубли extension-имён (`underline`), конфликты ProseMirror-классов.

### 1.3. Почему «просто мигрировать на одну версию» — не выход
- **Всё на v3**: rk-editor-core@4.6.0 собран под v2; v3-версии не существует.
- **Всё на v2**: откат большого пласта приложения (AiGhostText, расширения документов, useTiptapEditor) с потерей v3-фич.

Правильное решение — не смешивать рантаймы вообще: источник истины — Semantic AST в БД, редакторы — лишь «холсты» над ним.

## 2. Целевая архитектура

### 2.1. Ключевой принцип
> Word-редактор полностью инкапсулирован в изолированный workspace-пакет. Наружу проходят только данные (JSON/DTO/события). Ни один объект `Editor / EditorState / Transaction / Node / Schema / Plugin / PluginKey` не покидает пакет.

### 2.2. DFD — текущее состояние (AS-IS)

```
┌────────────────────────── apps/spa (единый контекст) ──────────────────────────┐
│                                                                                │
│  SurrealDB ──chapter.content (HTML)──→ EditorCoreTiptap.vue                    │
│                                            │                                   │
│                    ┌───────────────────────┼──────────────────────────┐        │
│                    ▼                       ▼                          │        │
│            useTiptapEditor (v3)      useRkWordEditor (v2!)             │        │
│                    │                       │                          │        │
│                    │              WordEditor (rk) ←────────┐            │        │
│                    │              tiptap instance ←────────┤ УТЕЧКА     │        │
│                    │                       │              │ живых      │        │
│                    │      rkPaginationBridge:             │ объектов   │        │
│                    │      destroy(original) → create(V2)   │           │        │
│                    │                       │              │            │        │
│                    │        ┌──────────────┼──────────────┤            │        │
│                    │        ▼              ▼              ▼            │        │
│                    │   WordRibbonBar   WordRuler    export/print       │        │
│                    │   (держит editor) (держит editor)(мёртвые ссылки) │        │
│                    │                                                   │        │
│                    └────────────── дубли extension-имён ───────────────┘        │
└────────────────────────────────────────────────────────────────────────────────┘
```

### 2.3. DFD — целевое состояние (TO-BE)

```
                    ┌───────────────────────────┐
                    │        SurrealDB          │
                    └─────────────┬─────────────┘
                                  │ chapter (HTML/AST)
                                  ▼
┌──────────── apps/spa (Tiptap v3 контекст) ─────────────┐
│                                                        │
│  EditorCoreTiptap.vue                                  │
│    ├── обычные режимы: useTiptapEditor (v3)            │
│    └── Word-режим:                                     │
│         │                                              │
│         │  ТОЛЬКО ДАННЫЕ (DTO + события)               │
│         ▼                                              │
│  ╔════════════════════════════════════════════════╗    │
│  ║  packages/word-vibe  (изолированный пакет)     ║    │
│  ║  ──────────────────────────────────────────────║    │
│  ║  WordVibeAdapter                               ║    │
│  ║    mount(el, options)                          ║    │
│  ║    loadDocument(doc: WordDocumentDTO)          ║    │
│  ║    getDocument(): WordDocumentDTO              ║    │
│  ║    execCommand(name, ...args): boolean         ║    │
│  ║    getSelection(): WordSelectionDTO | null     ║    │
│  ║    setLayout(layout: WordLayoutDTO)            ║    │
│  ║    on(event, cb) / destroy()                   ║    │
│  ║    │                                           ║    │
│  ║    ▼  внутренний контекст (всё v2)             ║    │
│  ║  WordEditor (rk) ── rkPaginationBridge ──►     ║    │
│  ║  PaginationPlus ── WordRibbonBar ── WordRuler  ║    │
│  ╚════════════════════════════════════════════════╝    │
│                                                        │
└────────────────────────────────────────────────────────┘

Потоки данных (Semantic AST — единственный формат обмена):
  БД → SemanticDocument → [app] → adapter.loadDocument(SemanticDocument)
  [adapter] внутренне: AST → Tiptap v2 JSON → RK рендер
  Пользователь правит → [adapter] 'change' → SemanticDocument → [app] → БД
  Кнопка ленты → adapter.execCommand('toggleBold') → [adapter] внутри v2
```

### 2.4. Структура пакетов

```
packages/
  word-vibe/                 ← НОВЫЙ workspace-пакет
    package.json             ← свои deps: rk-editor-core, tiptap-pagination-plus,
                               @tiptap/core@2.27.2, @tiptap/pm@2.27.2
                               (НАСТОЯЩИЕ v2-копии, без алиасов -v2)
    src/
      index.ts               ← публичный экспорт: createWordVibeAdapter + только типы DTO
      adapter/
        WordVibeAdapter.ts   ← реализация интерфейса
        events.ts            ← типизированные события
      editor/
        createRkEditor.ts    ← логика initEditor из useRkWordEditor — перенос
        paginationBridge.ts  ← текущий rkPaginationBridge — перенос
        geometry.ts          ← geometryHelper, MARGIN_PRESETS_MM
      ribbon/
        commands.ts          ← RibbonCommands (приватные, вызываются адаптером)
        WordRibbonBar.vue    ← перенос
        useWordRibbonBar.ts  ← перенос
      ruler/
        WordRuler.vue        ← перенос
        useWordRuler.ts      ← перенос
      types/
        dto.ts               ← WordDocumentDTO (Semantic AST), WordSelectionDTO,
                               WordLayoutDTO, WordStatsDTO, UnsupportedBlockDTO
apps/spa/
  package.json               ← МИНУС: rk-editor-core, tiptap-pagination-plus;
                               ПЛЮС: @worldwiki/word-vibe (workspace:*)
  vite.config.ts             ← МИНУС: плагин pagination-plus-tiptap-v2 (не нужен)
```

Имя пакета: `@worldwiki/word-vibe`, приватный, не публикуется в npm.

---

## 3. Контракты (публичный API пакета)

### 3.1. Типы DTO (`types/dto.ts`)

**Принцип: публичный контракт НЕ привязан к Tiptap.** За основу берётся
`SemanticDocument` (`services/document/ast/types.ts`) — формат Semantic AST,
который уже является источником истины и не знает ни о v2, ни о v3.
Конвертация в Tiptap v2 JSON происходит **внутри** word-vibe и наружу не выходит.

```ts
// Публичный контракт — Semantic AST (структурно = SemanticDocument из ast/types.ts)
// Даже если rk-editor-core через год будет заменён другим движком,
// этот контракт не изменится.
export type WordDocumentDTO = SemanticDocumentDTO;   // blocks, metadata, profileId
export type WordBlockDTO  = BlockNodeDTO;            // paragraph | heading | figure | table | ...
export type WordInlineDTO = InlineNodeDTO;           // text | math_inline | cross_reference | ...

/** Нода, которую Word-движок не смог отрендерить. Сохраняется БЕЗ потерь. */
export interface UnsupportedBlockDTO {
  type: 'unsupported';
  id: string;
  originalType: string;                 // исходный тип из AST
  originalAttrs: Record<string, unknown>;
  originalContent: WordBlockDTO[] | WordInlineDTO[];
  reason?: string;                      // почему не поддержано (для dev-логов)
}

export interface WordSelectionDTO {
  empty: boolean;
  /** Семантическая идентификация — основной контракт для приложения */
  blockId?: string;            // id блока Semantic AST под курсором
  paragraphIndex?: number;     // индекс абзаца для локализации/прокрутки
  quote?: string;              // текстовый фрагмент
  /** Техническое поле (opaque): координаты внутренней модели позиций.
   *  Используется ТОЛЬКО линейками внутри пакета. Приложению не интерпретировать. */
  positionStart?: number;
  positionEnd?: number;
  isInsideTable: boolean;
}

export interface WordLayoutDTO {
  pageSize: 'A4' | 'A5' | 'A3' | 'Letter' | 'B5';
  orientation: 'portrait' | 'landscape';
  marginsMm: { top: number; bottom: number; left: number; right: number };
}

export interface WordHeaderFooterDTO {
  headerLeft?: string; headerRight?: string;
  footerLeft?: string; footerRight?: string;
}

export interface WordStatsDTO {
  pageCount: number;
  wordCount: number;
  characterCount: number;
}

export interface WordVibeOptions {
  /** Хост-элемент для .rk-editor-mount */
  host: HTMLElement;
  editable: boolean;
  initialContent: WordDocumentDTO;
  initialLayout: WordLayoutDTO;
  initialHeaderFooter?: WordHeaderFooterDTO;
  chapterTitle?: string;
  /** Колбэк загрузки картинок (File → data URL) — передаётся из приложения */
  imageUploadHandler: (file: File) => Promise<string>;
}

export type WordVibeEventMap = {
  /* lifecycle */
  'mounted': void;
  'ready': void;          // редактор (в т.ч. после внутренних пересозданий) готов к работе
  'destroyed': void;
  /* данные */
  'change': WordDocumentDTO;
  'selection-change': WordSelectionDTO;
  'stats-change': WordStatsDTO;
  /* диалоги */
  'open-image-dialog': void;
  'open-table-picker': void;
  'open-link-dialog': void;
  'open-equation-dialog': void;
  'open-paragraph-dialog': void;
  'open-font-dialog': void;
  'open-page-setup': void;
  'open-header-footer-dialog': { tab?: 'header' | 'footer' };
  'open-entity': { type: string; id: string };
  'save-request': void;
};
```

### 3.2. Интерфейс адаптера (`adapter/WordVibeAdapter.ts`)

```ts
export interface WordVibeAdapter {
  /* ---- lifecycle (явный контракт) ---- */
  mount(options: WordVibeOptions): void;
  /** true, когда редактор готов принимать команды/документ.
   *  Внутри пакета редактор может пересоздаваться (pagination bridge) —
   *  для приложения это всегда один и тот же адаптер. */
  isReady(): boolean;
  unmount(): void;

  /* ---- документ ---- */
  loadDocument(doc: WordDocumentDTO): void;   // полная замена контента
  getDocument(): WordDocumentDTO;

  /* ---- фокус ---- */
  focus(): void;
  blur(): void;

  /* ---- команды ленты (единственная точка входа) ---- */
  execCommand(name: string, ...args: unknown[]): boolean;
  getCommandNames(): readonly string[];

  /* ---- выделение ---- */
  getSelection(): WordSelectionDTO | null;

  /* ---- геометрия страницы ---- */
  setLayout(layout: WordLayoutDTO): void;
  getLayout(): WordLayoutDTO;
  setHeaderFooter(text: WordHeaderFooterDTO): void;

  /* ---- статистика ---- */
  getStats(): WordStatsDTO;

  /* ---- события ---- */
  on<K extends keyof WordVibeEventMap>(event: K, cb: (payload: WordVibeEventMap[K]) => void): () => void;
}
```

**Правила реализации:**
1. Ни один метод не возвращает и не принимает ProseMirror/RK-объекты и их JSON-схемы — только Semantic AST DTO.
2. **Lifecycle-изоляция**: внутренние пересоздания редактора (destroy + create с PaginationPlus) полностью скрыты. Приложение всегда держит один экземпляр адаптера; после внутренней подмены адаптер пере-публикует `ready` и продолжает отвечать на `execCommand`. Проблема «stale editor ref» становится внутренним делом пакета.
3. `execCommand('toggleBold')` → приватные `RibbonCommands` → rk commands. Лента не получает `commands` как проп.
4. Диалоги — события наружу; результат возвращается через `execCommand('insertImageWithCaption', src, caption)` и т.п.
5. `UnsupportedBlockDTO` при рендере показывается как визуальный placeholder («Блок не поддерживается в Word-режиме»), при `getDocument()` возвращается в исходном виде.

---

## 4. Преобразование данных (Semantic AST — центральная шина)

### 4.1. Текущая цепочка в Word-режиме (проблемная)
Сейчас: `chapter.content (HTML)` → `normalizeWordContent()` (DOM-чистка) → `wordEditor.setDocument(html)`.
Semantic AST в Word-режиме **не участвует** — это разрыв архитектуры.

### 4.2. Целевая архитектура данных

```
                     ┌────────────────────┐
                     │     SurrealDB      │
                     │  SemanticDocument  │  ← единственный формат хранения
                     └─────────┬──────────┘
                               │
              ┌────────────────┼────────────────┐
              ▼                                 ▼
        Tiptap v3 (обычный UI)          WordVibeAdapter
              │                                 │  внутренняя конвертация:
              ▼                                 ▼  AST → Tiptap v2 JSON → RK
         editor view                    editor view (RK)

  Обратный поток (сохранение):
  RK → Tiptap v2 JSON → [внутри word-vibe] → WordDocumentDTO (Semantic AST) → БД
```

**Semantic AST — единственный формат обмена и хранения.** Tiptap JSON (любой версии)
существует только внутри редакторов.

### 4.3. Legacy compatibility path (миграционный, НЕ часть target)

```
chapter.content (HTML в старых главах)
    → [конвертер HTML→AST]  (DOMParser-конвертер, БЕЗ v3-редактора)
    → SemanticDocument      (далее — обычный целевой путь)
```
- Используется только для чтения старых глав, чей контент ещё хранится HTML'ом.
- При первом открытии+сохранении глава конвертируется в SemanticDocument в БД.
- Конвертер живёт в apps/spa (не в word-vibe) — word-vibe вообще не знает про HTML.
- Цель миграции: исчезнуть. Появление новых HTML-глав должно быть невозможно.

### 4.4. Таблица маппинга нод (AST → внутренний v2 JSON)

| WordDocumentDTO (AST) | rk-editor-core (внутр.) | Статус | Примечание |
|---|---|---|---|
| ParagraphNode | `paragraph` | есть | styleOverride → attrs (`firstLineIndent`, textAlign, lineHeight) |
| HeadingNode | `heading` + level | есть | `numberingMode: none` → без нумерации |
| FigureNode | `image` + GostFigureCaption | есть | подпись «Рисунок N — …» |
| TableNode | `table` + GostTableCaption | есть | подпись «Таблица N — …» |
| EquationNode | `insertMathBlock` | есть | |
| MathInlineNode | математика rk | проверить | inline-формулы |
| QuoteNode | `blockquote` | есть | |
| ListNode | `bulletList/orderedList` | есть | |
| PageBreakNode | `pageBreak` | есть | |
| FootnoteReferenceNode | `footnote` | есть | сверить атрибуты id/number |
| SceneBreakNode | ⚠ нет | кастомная v2-нода или `horizontalRule`+маркер | требует решения |
| CrossReferenceNode | ⚠ нет | **кастомная v2-нода в пакете** | событие `open-entity` |
| EntityReference | ⚠ нет | **кастомная v2-нода в пакете** | событие `open-entity` |
| *любая неизвестная* | → **UnsupportedBlockDTO** | правило | см. 4.5 |

### 4.5. Правило для неизвестных нод (zero data loss)

**Запрещено** конвертировать неизвестную ноду в `paragraph` — это семантическая
потеря: round-trip формально успешен, но документ испорчен.

Единственное допустимое поведение:
```
Неизвестная AST-нода
    → UnsupportedBlockDTO { originalType, originalAttrs, originalContent }
    → [рендер] визуальный placeholder «Блок не поддерживается в Word-режиме»
    → [getDocument()] возвращается В ИСХОДНОМ виде
```
- Invariant (обязателен для тестов): `getDocument()` после `loadDocument(X)` без
  пользовательских правок вернёт `X` структурно идентично — включая unsupported-ноды.
- Placeholder виден пользователю → он знает, что блок нужно отредактировать в обычном режиме.
- `console.warn` в dev-режиме с `originalType`.

---

## 5. Устранение focus theft (фаза 1)

Проблема: клик по `<button>` ленты уводит DOM-focus, ProseMirror применяет команду «вслепую», подсветка выделения исчезает.

Решение (стандарт для ribbon-UI):
1. На все интерактивные элементы ленты: `@mousedown.prevent` (не мешает `@click`).
2. В `execCommand` адаптера: перед командой восстанавливать фокус редактора (rk `commands.focus()` без scroll), если выделение непустое.
3. Драг-маркеры WordRuler уже используют `mousedown.stop` — не трогать.

Acceptance: выделенный текст + клик «Ж» → текст жирный, выделение остаётся видимым.

---

## 6. План миграции

Порядок фаз: сначала железная граница пакета, потом контракт адаптера, потом
Semantic AST как формат обмена, потом перевод UI на адаптер, в конце — чистка.
Так исключается ситуация, когда красивый DTO оказывается замаскированным
Tiptap JSON, и всё приходится переделывать.

### Фаза 0 — быстрые победы (0.5 дня)
- [ ] Кнопкам ленты добавить `@mousedown.prevent` (в текущем WordRibbonBar.vue, до рефакторинга).
- [ ] В `useRkWordEditor.initEditor` после `attachPaginationPlus` синхронизировать `wordEditor.value` с живым экземпляром (контракт подмены моста зафиксировать тестом).

### Фаза 1 — изоляция пакета (1–2 дня)
- [ ] Создать `packages/word-vibe` с собственным `package.json` (v2-депсы), tsconfig, eslint.
- [ ] Перенести `WordMode/*` (editor, bridge, geometry, Gost-extensions) в пакет без изменения логики.
- [ ] Убрать vite-плагин `pagination-plus-tiptap-v2` — внутри пакета pnpm сам резолвит v2.
- [ ] `apps/spa` зависит от `@worldwiki/word-vibe`; прямые депсы rk/pagination-plus удалить.
- [ ] Lint-гарантия: в `apps/spa` нет импортов `@raazkhnl/rk-editor-core` / `tiptap-pagination-plus` (no-restricted-imports).

### Фаза 2 — публичная граница адаптера (2–3 дня)
- [ ] Ввести `WordVibeAdapter` + lifecycle (`mount/unmount/isReady/focus/blur`, события `mounted/ready/destroyed`); внутренние пересоздания редактора полностью скрыты.
- [ ] `RibbonCommands` становятся приватными; лента и линейки получают команды/selection только через адаптер.
- [ ] События диалогов через `on(...)`; приложение подключает существующие модалки.
- [ ] WordRuler: проп `editor` → события `selection-change` + `getSelection()`.

### Фаза 3 — Semantic AST как формат обмена (2–3 дня)
- [ ] Определить `WordDocumentDTO = SemanticDocumentDTO` (секция 3.1); конвертация AST ↔ Tiptap v2 JSON — внутренняя, на базе ASTAdapter.
- [ ] `UnsupportedBlockDTO` + invariant round-trip (секция 4.5) + placeholder-рендер.
- [ ] Кастомные v2-ноды пакета: `EntityReference`, `CrossReference` + события `open-entity`.
- [ ] Решить судьбу `SceneBreakNode` (маппинг или кастомная нода).

### Фаза 4 — перевод UI и данных (2 дня)
- [ ] `RkWordEditor.vue` полностью переписан на адаптер; утечки `wordEditor`/`tiptapEditor` устранены.
- [ ] Legacy HTML→AST конвертер в apps/spa (секция 4.3); главы при сохранении конвертируются в SemanticDocument.
- [ ] Приложение хранит и передаёт только SemanticDocument (проверить все вызовы chapter.store).

### Фаза 5 — чистка и жёсткие гарантии границы (1 день)
- [ ] ESLint: запрет `@tiptap/core-v2` / rk / pagination-plus в apps/spa; запрет `@tiptap/core` (v3) и любых ProseMirror-типов внутри публичного API word-vibe.
- [ ] Убрать диагностическое логирование ленты (`RIBBON_DEBUG`).
- [ ] Юнит-тесты: DTO round-trip (AST→loadDocument→getDocument идемпотентен, включая unsupported-ноды), маппинг нод (таблица 4.4), API адаптера, lifecycle (ready после внутренних пересозданий).

### Фаза 6 — регресс
- [ ] Сценарий: открыть главу → bold/italic/underline/heading/списки → таблица+подпись → рисунок+подпись ГОСТ → разрыв страницы → альбомная секция → колонтитулы → поля ГОСТ → экспорт DOCX → сохранение → переоткрытие.
- [ ] Отсутствие `Duplicate extension names`.
- [ ] В бандле apps/spa нет второй копии tiptap v2 (`pnpm why @tiptap/core`).

---

## 7. Риски

| Риск | Митигация |
|---|---|
| Маппинг AST↔RK неполон (сцены, entity-ссылки) | Таблица 4.4 — чек-лист; неизвестные ноды → `UnsupportedBlockDTO` (zero data loss, секция 4.5), placeholder виден пользователю |
| Round-trip «тихо портит» документ | Обязательный invariant-тест: `loadDocument(X)` → `getDocument()` ≡ `X` без правок, включая unsupported-ноды |
| rkPaginationBridge ломается на обновлениях rk | Закрепить версию rk в пакете; контракт-тест на структуру обёртки; lifecycle-событие `ready` после пересозданий |
| Двойной бандл tiptap (v2+v3) в одном чанке | word-vibe собирать отдельной entry (lib-mode), контроль `pnpm why @tiptap/core` |
| `WordDocumentDTO` расползается до Tiptap JSON (contract drift) | ESLint в word-vibe: публичные типы не ссылаются на `@tiptap/*`; code review границы |
| Focus theft после переноса | `@mousedown.prevent` + acceptance из секции 5 |
| Старые HTML-главы не конвертируются без потерь | Legacy-конвертер с отчётом о непонятных фрагментах; round-trip тесты на выборке реальных глав из БД |

## 8. Критерии готовности
1. В `apps/spa` нет импортов rk-editor-core / tiptap-pagination-plus / `@tiptap/core-v2` (lint enforcement).
2. Публичный API word-vibe типобезопасно не содержит ни ProseMirror-объектов, ни Tiptap JSON — только `WordDocumentDTO` (Semantic AST) и примитивы.
3. Все кнопки ленты применяют форматирование к выделению; выделение визуально сохраняется.
4. `Duplicate extension names` отсутствует.
5. Invariant round-trip: `loadDocument(X)` → `getDocument()` ≡ `X` (включая unsupported-ноды) — тест зелёный на выборке реальных глав.
6. Lifecycle: после внутренних пересозданий редактора адаптер публикует `ready` и продолжает корректно отвечать на `execCommand` без пересоздания со стороны приложения.



