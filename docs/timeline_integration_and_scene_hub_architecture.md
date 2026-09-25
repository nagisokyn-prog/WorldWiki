# 📐 МАСТЕР-ПЛАН И АРХИТЕКТУРА СЦЕНАРНОГО ХАБА, ТАЙМЛАЙНА И СИСТЕМЫ ТЕМ

> **Статус**: Перезаписанный утвержденный мастер-план и реестр исправления дефектов  
> **Область действия**: `PromiseCardMeta.vue`, `PromiseCard.vue`, `XboxWheel`, `TagsField.vue`, `settings.dom.ts`, `dark.theme.json`, `light.theme.json`, `PromisesPanel.css`, `useEditorCoreTiptap.ts`, `usePromisesPanel.ts`  
> **Инварианты**: Золотой эталон $M_{\text{abs}}$, `SCHEMAFULL` SurrealDB, `ARCH-001..ARCH-031`, `Cerberus Firewall`

---

## 🛑 1. РЕЕСТР ДЕФЕКТОВ И КОРНЕВЫЕ ПРИЧИНЫ

### 1.1. 🕳️ Чернота в выпадающих списках (Dropdown Black Hole)
- **Причина**: В [settings.dom.ts:L254-L260](file:///c:/Users/Kuzma/Desktop/WorldWiki/packages/components/src/ts/services/settings.dom.ts#L254-L260) переменная `--dropdown-bg` выставлялась только при `dropdowns.transparency` и содержала жесткий хардкод черного цвета `[15, 15, 20]`. В светлой теме и при дефолтных настройках она давала черный фон или `undefined`, из-за чего Chromium заливал дропдауны черным цветом OS.
- **Решение**:
  - В `settings.dom.ts` рассчитывать `--dropdown-bg` динамически от темы (`[255, 255, 255]` для светлой, `[22, 22, 26]` для темной).
  - Прописать `dropdownBg` в [dark.theme.json](file:///c:/Users/Kuzma/Desktop/WorldWiki/packages/resources/src/themes/dark.theme.json) и [light.theme.json](file:///c:/Users/Kuzma/Desktop/WorldWiki/packages/resources/src/themes/light.theme.json).

---

### 1.2. 🎡 Барабаны даты (`XboxWheel`): Компактная двухрядная компоновка
- **Проблема**: Предыдущие варианты либо раздували карточку на 500px, либо заменялись на сплющенные нечитаемые микро-инпуты.
- **Решение**:
  - Возвращаются фирменные интерактивные барабаны **`XboxWheel`**.
  - Компактная двухрядная компоновка:
    - **Ряд 1**: `[ Эпоха ]` `[ Год ]` `[ Месяц ]`
    - **Ряд 2**: `[ День ]` `[ Час ]` `[ Минута ]`
  - Стандартная высота слотов и читаемый шрифт (12–13px), идеально подходящий под ширину сайдбара.

---

### 1.3. 📍 Подсветка многоабзацного диапазона сцены (`scrollToParagraph`)
- **Причина дефекта**:
  - Диалоговые сцены в тексте состоят из нескольких отдельных DOM-абзацев (`<p>— Эй, Лёша...</p><p>— Успокойся...</p>`), тогда как в карточке сцены цитата хранится целиком.
  - Различия в тире (`—`, `–`, `-`), кавычках (`«»""''`) и пробелах приводили к несовпадению `includes()`, из-за чего подсвечивался только 1-й абзац (fallback).
- **Решение**:
  - Нормализация всех видов тире, кавычек и пробелов.
  - Поиск всех абзацев, чьи фрагменты текста входят в цитату сцены.
  - Одновременное наложение анимации `.promise-highlight-target` на **все абзацы диапазона сцены**.

---

### 1.4. 🔄 Автомиграция данных «на лету» (`autoMigrateLegacyScene`)
- **Причина дефекта**:
  - `usePromisesPanel.ts` искал данные в `props.allChapters` (где лежат только заголовки глав без полного тела), вместо прямой проверки `currentChapter.participants` и `currentChapter.timeline_events`.
- **Решение**:
  - Пробрасывать объект текущей открытой главы `currentChapter` в панель.
  - При открытии главы с устаревшими массивами участников/событий автоматически создавать корневую сцену `plot_promises` и сохранять её в БД.

---

### 1.5. 🧹 Чистка Сцены от ружейного мусора и правильные теги (`TagsField.vue`)
- **Решение**:
  - Для сцен (`kind === 'scene'`) скрыть кнопки `🌿 + Развить` и `🎯 Отстрелять`.
  - Удалить селект «Привязка к событию» и инпут «Сдвиг ➡️».
  - Использовать каноничный **`TagsField.vue`** из `@worldwiki/components` с нормальным поведением инпутов при наведении и фокусе.
  - Исправить расчет времени суток (`00:00` = `🌙 Ночь`).

---

## 📋 2. ПОШАГОВЫЙ ПЛАН ВНЕДРЕНИЯ

1. **Глобальный фикс тем**:
   - `packages/components/src/ts/services/settings.dom.ts`
   - `packages/resources/src/themes/dark.theme.json`
   - `packages/resources/src/themes/light.theme.json`
2. **Исправление мульти-подсветки сцены**:
   - `apps/spa/src/ts/features/chapters/EditorCoreTiptap/useEditorCoreTiptap.ts`
3. **Исправление автомиграции сцен главы**:
   - `apps/spa/src/ts/features/chapters/PromisesPanel/usePromisesPanel.ts`
   - `apps/spa/src/ts/features/chapters/ChaptersMain/components/ChapterRightSidebar.vue`
4. **Компоновка карточки сцены и двухрядных `XboxWheel`**:
   - `apps/spa/src/ts/features/chapters/PromisesPanel/components/PromiseCardMeta.vue`
   - `apps/spa/src/ts/features/chapters/PromisesPanel/components/usePromiseCardMeta.ts`
   - `apps/spa/src/ts/features/chapters/PromisesPanel/components/PromiseCard.vue`
   - `packages/resources/src/styles/features/chapters/PromisesPanel.css`
