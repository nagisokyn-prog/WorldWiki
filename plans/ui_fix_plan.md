# Глобальный рефакторинг системы настроек и стилей

## Описание проблем

1. **CSS переменная `--layout-columns` устанавливается, но нигде не используется** — в CSS нет `.ProseMirror { column-count: ... }`. Настройки «говорят в пустоту».
2. **Дублирование `:root {}` в трёх файлах** — `glass-theme.css`, `new-ui-theme.css` и `app.css` содержат одни и те же переменные, что вызывает конфликты и путаницу.
3. **Настройки хранятся в двух местах одновременно** — `packages/components/src/ts/services/settings.service.ts` и `apps/spa/src/ts/services/settings.service.ts` (два разных экземпляра!). SPA использует локальный, страница настроек — из `@worldwiki/components`. При сохранении в настройках оно идёт в одну копию, а главный редактор может читать из другой.
4. **`Settings.vue` не слушает изменения настроек правильно** — `settingsService.saveSettings()` из `@worldwiki/components` вызывает `applySettings()` только в своём экземпляре, но редактор (`EditorView.vue.ts`) подписан на другой экземпляр.

## Ответы на открытые вопросы (уточнено с пользователем)

- **Страница настроек**: открывается в **отдельном окне Tauri** (`settings.html`). Оба окна используют `localStorage` как мост. Архитектура синхронизации через `window.storage` событие — рабочая, но нужно убедиться что оба окна слушают.
- **Встраивание настроек**: пока НЕ нужно. Позже будет плавающее окно, но не сейчас.
- **Пользовательский фон**: Будет реализована поддержка видео (mp4/webm) и изображений для установки в качестве фона, с возможностью настройки лимита FPS для видео для экономии ресурсов.
- **CSS колонки**: «колонки» = количество колонок *в сетке (grid) для интерфейса* (например, в формах, карточках настроек и панелях). При значении 1 элементы выстраиваются в один столбец на всю ширину, при 2 — в две колонки и т.д. Это НЕ колонки текста в самом редакторе.

---

## Предлагаемые изменения

### ✅ Проблема 0: Критический баг — два разных экземпляра `settingsService` (ВЫПОЛНЕНО)

#### `apps/spa/src/ts/stores/settings.ts`
Убран локальный враппер над локальным сервисом. Используется **один** `settingsService` из `@worldwiki/components` как единственный источник правды.

---

### ✅ Часть 1: Консолидация CSS (удаление дублей) (ВЫПОЛНЕНО)

**Проблема**: `:root {}` был объявлен в `glass-theme.css`, `new-ui-theme.css` и `app.css`, что вызывало перекрытие CSS-переменных, устанавливаемых через JS.

#### `packages/resources/src/styles/glass-theme.css`
Оставлен как **единственный** источник CSS переменных `:root {}`.

#### `packages/resources/src/styles/new-ui-theme.css`
Блок `:root {}` удалён целиком (300+ строк дублей). Оставлены только компонентные стили.

---

### Часть 2: Подключение CSS переменных к реальным стилям

**Проблема**: `--layout-columns`, `--sidebar-pos`, `--tab-pos` устанавливаются, но нигде не используются CSS-правилами.

#### [MODIFY] `packages/resources/src/styles/new-ui-theme.css`
Добавить применение переменных к реальным элементам сетки и интерфейса:
```css
/* Позиция сайдбара */
.app-main-new {
  flex-direction: var(--sidebar-pos, row);
}

/* Колонки компоновки элементов (Grid для интерфейса) */
.settings-grid,
.form-grid,
.cards-container {
  display: grid;
  grid-template-columns: repeat(var(--layout-columns, 1), 1fr);
  gap: var(--gap-elements, 16px);
}

/* Позиция табов */
.editor-tabs-container {
  flex-direction: var(--tab-pos, row);
}
```

---

### Часть 2.1: Интеграция библиотек анимаций

Пользователь указал, что установлены `@formkit/auto-animate` и `@vueuse/motion`. Нужно задействовать их в UI для плавности.

#### [MODIFY] `apps/spa/src/ts/main.ts` (или точка входа Vue)
Убедиться, что плагины AutoAnimate и VueUse Motion зарегистрированы в Vue глобально (если требуются плагины) или создать глобальную директиву `v-auto-animate`.

#### [MODIFY] `packages/components/src/components/Vue/Settings.vue` и списки
Добавить директивы анимации к сеткам и спискам, которые меняются:
- Использовать `v-auto-animate` на контейнерах (например, `.settings-grid`, `.radio-group`), чтобы при изменении количества колонок или добавлении элементов они плавно перестраивались.
- Использовать директивы `v-motion` (из `@vueuse/motion`) для плавного появления модальных окон (slide/fade).

### Часть 3: Новые фичи настроек

#### Фича 1: «Уровень красоты» (Master Quality Slider)

**Идея**: Один главный ползунок от 0 до 100% «Качество визуала» — при изменении автоматически масштабирует несколько параметров.

**Что регулирует**:
- `glass.blur` (0 → 24px)
- `animations.enabled` (выкл при < 20%)
- `animations.speed` (медленнее при меньших значениях)
- `glass.islandAlpha` (прозрачность)

#### [MODIFY] `packages/components/src/ts/types/settings.d.ts`
Добавить поле `qualityLevel: number` (0–100) в `PerfSettings`.

#### [MODIFY] `packages/components/src/ts/services/settings.service.ts`
Добавить метод `applyQualityLevel(level: number)` который масштабирует blur, animations.speed и т.д.

#### [MODIFY] `packages/components/src/components/Vue/Settings.vue`
Добавить секцию «Производительность» с:
- Главным ползунком «Качество визуала» (0–100%)
- Он при изменении вызывает `applyQualityLevel()` и прямо обновляет связанные ползунки

---

#### Фича 2: Пользовательский фон (Фото и Видео)

#### [MODIFY] `packages/components/src/ts/types/settings.d.ts`
Добавить интерфейс:
```ts
export interface BackgroundSettings {
  type: 'none' | 'color' | 'image' | 'video';
  imagePath?: string;       // путь к файлу изображения
  videoPath?: string;       // путь к видеофайлу
  opacity: number;          // прозрачность фона (0-1)
  blur: number;             // размытие фона (0-20px)
  fit: 'cover' | 'contain' | 'fill' | 'tile';
  fpsLimit?: number;        // лимит FPS для видео (например, 30 или 60)
}
```

#### [NEW] `packages/resources/src/styles/modules/background.css`
CSS для рендера фона (`#ww-background` элемент).

#### [MODIFY] `packages/components/src/ts/services/settings.service.ts`
Добавить `applyBackground()` — создаёт/обновляет DOM-элемент `#ww-background` с `position: fixed`, `z-index: -1`. Для видео создавать `<video autoplay loop muted>` с учетом FPS-лимита.

#### [MODIFY] `packages/components/src/components/Vue/Settings.vue`
Добавить раздел «Фон»:
- Селектор типа (нет / изображение / видео)
- Кнопка выбора файла (через Tauri `open()` диалог)
- Ползунки прозрачности и размытия
- Настройка FPS для видео
- Превью

---

#### Фича 3: Интервал автосохранения и снапшотов

#### [MODIFY] `packages/components/src/ts/types/settings.d.ts`
Добавить в `EditorSettings`:
```ts
autoSaveInterval: number;    // интервал автосохранения (секунды, 0 = выкл)
snapshotInterval: number;    // интервал снапшотов (минуты, 0 = выкл)
maxSnapshots: number;        // максимум снапшотов на главу
```

#### [MODIFY] `packages/components/src/components/Vue/Settings.vue`
В раздел «Редактор» добавить:
- Выбор интервала автосохранения (выкл / 30с / 1м / 2м / 5м)
- Выбор интервала снапшотов (выкл / 5м / 10м / 15м / 30м)
- Поле максимума снапшотов

#### [MODIFY] `apps/spa/src/ts/features/chapters/EditorCoreTiptap/useTiptapEditor.ts`
Читать `settings.editor.autoSaveInterval` и управлять таймером автосохранения.

#### [MODIFY] `apps/spa/src/ts/stores/shell.ts`
Читать `settings.editor.snapshotInterval` и создавать снапшоты главы по таймеру (записывая их в БД через команду бэкенда).

---

## Порядок выполнения

1. ✅ Разобраться с дублированием `settingsService` (критический баг)
2. ✅ Консолидировать `:root {}` CSS в один файл
3. Подключить CSS переменные к реальным стилям (grid columns, flex-direction)
4. Внедрить `@formkit/auto-animate` и `@vueuse/motion` для плавных перестроений UI
5. Добавить поддержку пользовательского фона (фото/видео с настройками FPS)
6. Добавить «Уровень красоты» (Master Quality slider)
7. Добавить настройки автосохранения и снапшотов

## Архитектура системы стилей и настроек (Как это должно работать)

**Главный источник правды (State)**: 
- `packages/components/src/ts/services/settings.service.ts` — единственный Singleton, который читает/пишет `settings.json` через Tauri API и хранит состояние в памяти.
- `apps/spa/src/ts/stores/settings.ts` (Pinia) — просто реактивная обёртка над Singleton, чтобы Vue-компоненты SPA могли отслеживать изменения без боли.

**Применение стилей (Injection)**:
- `settingsService.applySettings()` — при каждом изменении берёт JSON и инжектит переменные `--layout-columns`, `--sidebar-pos` и др. прямо в `document.documentElement.style`.
- Все окна (Главное, Настройки, Плавающие) при загрузке запрашивают конфиг из бэкенда и инжектят CSS переменные в свой `document`. 
- При изменении настроек в одном окне срабатывает событие `window.storage`, которое заставляет остальные окна перерисоваться и обновить CSS.

**Контроль UI-макетов**:
- Файлы `glass-theme.css` и `new-ui-theme.css` — только **потребляют** эти `var(...)`. Никаких хардкодов. 
- Контейнеры типа `<div class="form-grid" v-auto-animate>` используют CSS `grid-template-columns: repeat(var(--layout-columns), 1fr)` — при изменении переменной браузер пересчитывает Grid, а AutoAnimate плавно перемещает DOM-элементы на новые места.

## Верификация

После выполнения:
- Открыть настройки → раздел «Компоновка» → изменить «Колонки» на 2 → элементы настроек (и другие сетки) должны плавно (через AutoAnimate) перестроиться в 2 колонки.
- Открыть настройки → раздел «Компоновка» → изменить позицию сайдбара → сайдбар должен переехать вправо.
- Установить картинку/видео на фон → она должна отображаться под всем интерфейсом, у видео должен применяться лимит FPS.
- Установить ползунок «Качество визуала» на 0% → анимации, v-motion и blur должны отключиться.
- Проверить, что настройки применяются одинаково в обоих окнах (Настройки и Редактор).
