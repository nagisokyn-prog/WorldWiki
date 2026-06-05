# ТЕХНИЧЕСКОЕ ЗАДАНИЕ: Внедрение UI-архитектуры из `src/new_ui/index.html` в проект World Wiki

## 1. ОБЩАЯ АРХИТЕКТУРА

### 1.1. Структура приложения
- **Единое Vue 3 приложение** через `createApp().mount('#app')`
- **CDN-зависимости**: Vue 3 (global build), GSAP 3.x, Lodash 4.x, Toast UI Editor
- **Шрифты**: Inter, Roboto, SF Pro Display, Segoe UI, Fira Code (Google Fonts)

### 1.2. Layout-иерархия (DOM)
```
.app-container
  ├── .command-palette-overlay (Ctrl+P)
  ├── .command-palette
  └── .app-main
      ├── .activity-bar (иконки разделов + бейджи)
      ├── .sidebar (поиск + список сущностей)
      ├── .editor-area
      │   ├── .editor-tabs (вкладки)
      │   └── .editor-content
      │       ├── Welcome screen
      │       ├── Settings layout
      │       └── Active editor (chapter/character)
      └── .panel (консоль/статистика/граф)
```

---

## 2. CSS-СИСТЕМА (Dynamic CSS Engine)

### 2.1. CSS-переменные (24 категории)
Все стили управляются через CSS custom properties в `:root`:

| Категория | Переменные | Описание |
|-----------|-----------|----------|
| **Цвета** | `--bg-base`, `--bg-secondary`, `--bg-panel`, `--bg-input`, `--text-main`, `--text-muted`, `--text-heading`, `--accent`, `--accent-hover`, `--accent-glow`, `--border-color`, `--border-active`, `--shadow-color` | Полная цветовая схема |
| **Стекло** | `--glass-island-alpha`, `--glass-card-alpha`, `--glass-blur`, `--glass-border-alpha`, `--glass-highlight`, `--glass-bg`, `--glass-card`, `--glass-shine` | Glassmorphism параметры |
| **Скругления** | `--radius-island`, `--radius-card`, `--radius-btn`, `--radius-input`, `--radius-dropdown` | Border radius |
| **Тени** | `--shadow-island-y`, `--shadow-island-blur`, `--shadow-card-hover`, `--shadow-btn`, `--shadow-dropdown`, `--shadow-inset`, `--shadow-glow`, `--shadow-float` | Тени и объем |
| **Анимации** | `--anim-speed`, `--anim-ease`, `--anim-entrance`, `--anim-breathe`, `--scale-push`, `--scale-pull` | Скорость и easing |
| **Шрифты** | `--font-family`, `--font-mono`, `--font-size-base`, `--font-weight-base`, `--font-weight-bold`, `--line-height-base`, `--letter-spacing-base` | Типографика |
| **Отступы** | `--density-mult`, `--pad-card`, `--gap-elements`, `--sidebar-width`, `--panel-height`, `--activity-bar-width`, `--toolbar-height` | Плотность и размеры |
| **Компоновка** | `--layout-columns`, `--sidebar-pos`, `--tab-pos` | Сетка и позиционирование |

### 2.2. Ключевые CSS-классы компонентов

#### Glass Card Engine
```css
.glass-card-container { position: relative; z-index: 1; border-radius: var(--radius-card); }
.glass-card-bg { position: absolute; inset: 0; background: var(--glass-card); border: 1px solid var(--border-color); }
.glass-card-content { position: relative; padding: var(--pad-card); z-index: 2; }
.glass-card-container.is-pushed .glass-card-bg { transform: scale(var(--scale-push)); box-shadow: var(--shadow-inset); }
```

#### Interactive Elements (Push/Pull)
```css
.interactive-el { transition: all var(--anim-speed) var(--anim-ease); transform-origin: center center; }
.interactive-el:hover { transform: scale(var(--scale-pull)); }
.interactive-el:active { transform: scale(var(--scale-push)); }
```

#### Xbox Wheel Dropdown
```css
.wheel-wrapper { position: absolute; height: 0; opacity: 0; overflow: hidden; transition: all 0.4s cubic-bezier(0.2, 0.8, 0.2, 1); }
.wheel-wrapper.expanded { height: 240px; opacity: 1; pointer-events: auto; }
.wheel-item { position: absolute; height: 44px; transition: all 0.3s cubic-bezier(0.2, 0.8, 0.2, 1); }
.wheel-item.active { font-weight: bold; text-shadow: 0 0 15px rgba(139, 92, 246, 0.8); }
```

#### Settings Grid
```css
.settings-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: var(--gap-elements); }
.settings-group { background: rgba(0, 0, 0, 0.2); border-radius: var(--radius-card); padding: 24px; border: 1px solid var(--border-color); }
```

---

## 3. VUE 3 ПРИЛОЖЕНИЕ

### 3.1. Состояние (Reactive State)
```javascript
// Навигация
currentMainTab: 'welcome' | 'chapters' | 'characters'
showSettings: boolean
activeSettingsCategory: string
sidebarSearch: string
panelCollapsed: boolean
activePanelTab: string
graphZoom: number

// Редакторы
openEditors: Array<{id, type, icon, title/name, unsaved, data}>
activeEditorId: string | null
currentEntityTab: 'basic' | 'relationships' | 'trauma'
editorMode: 'markdown' | 'wysiwyg'

// Данные
chapters: Array<Chapter>
characters: Array<Character>
consoleLogs: Array<{time, message, type}>

// Push-состояния для anti-jitter
pushStates: {basic, relLeft, relRight, trauma, settings}

// Settings Engine (24 категории)
settings: {
  colors: {bgBase, bgSecondary, bgPanel, bgInput, textMain, textMuted, textHeading, accent, accentHover, borderColor, shadowColor},
  glass: {islandAlpha, cardAlpha, blur, borderAlpha},
  radii: {island, card, btn, input, dropdown},
  shadows: {islandY, islandBlur, useInset},
  animations: {enabled, speed, ease, entrance, pulse, scalePush, scalePull},
  fonts: {family, size, lineHeight, letterSpacing},
  spacing: {density, sidebarWidth, panelHeight},
  layout: {columns, sidebarPos, focusMode},
  inputs: {style, focusAnim},
  buttons: {hoverScale, clickPress},
  tabs: {pos},
  dropdowns: {use3DWheel},
  cards: {compactList, showIcons},
  editor: {showWordCount},
  notifications: {duration}
}
```

### 3.2. Computed Properties
- `activeEditor` — текущий открытый редактор
- `sidebarTitle` — заголовок сайдбара по текущему табу
- `filteredEntities` — фильтрация сущностей по поиску
- `unsavedChapters/Characters` — счётчики несохранённых
- `chapterStats` — статистика главы (слова, символы, диалоги, описания, действия, тон)
- `availableRelTargets` — доступные цели для отношений
- `statsItems` — элементы статистики в панели
- `graphNodes/graphEdges` — узлы и рёбра графа связей
- `commands/filteredCommands` — команды для палитры (Ctrl+P)

### 3.3. Methods
| Метод | Описание |
|-------|----------|
| `switchMainTab(tab)` | Переключение основного раздела |
| `toggleSettings()` | Открыть/закрыть настройки |
| `openEntity(entity)` | Открыть сущность в редакторе |
| `setActiveEditor(id)` | Установить активный редактор |
| `closeEditor(id)` | Закрыть редактор с подтверждением |
| `markEditorUnsaved()` | Пометить редактор как несохранённый |
| `saveAll()` | Сохранить все изменения |
| `editorAction(act)` | Выполнить действие в Toast UI |
| `switchEditorMode()` | Переключить Markdown/WYSIWYG |
| `addTimelineEvent()` | Добавить событие в таймлайн |
| `addParticipant()` | Добавить участника сцены |
| `removeDiagnosis(idx)` | Удалить диагноз |
| `toggleCommandPalette()` | Открыть/закрыть палитру команд |
| `showToast(title, msg, icon)` | Показать toast-уведомление |
| `addLog(msg, type)` | Добавить запись в консоль |
| `resetSettings()` | Сбросить настройки |
| `onGraphWheel(e)` | Зум графа колесом мыши |

### 3.4. Watchers
```javascript
watch(settings, (newVal) => {
  // Обновление ВСЕХ CSS-переменных в document.documentElement.style
  // 50+ свойств обновляются реактивно
}, { deep: true })
```

---

## 4. КОМПОНЕНТЫ

### 4.1. VanillaXboxWheel (кастомный компонент)
- **Props**: `modelValue`, `options`
- **Emits**: `update:modelValue`, `hover-start`, `hover-end`
- **Класс**: `VanillaXboxWheel` — 3D вращающийся селектор
- **Поведение**: wheel-скролл, стрелки вверх/вниз, Enter/Escape для закрытия
- **Визуал**: 3D перспектива с scale/opacity/z-index для каждого элемента

### 4.2. Структура шаблона
- Все шаблоны inline в `template: \`...\``
- Используются Vue директивы: `v-if`, `v-else-if`, `v-show`, `v-for`, `:class`, `:style`, `v-model`, `@click`, `@input`, `@mouseenter`, `@mouseleave`

---

## 5. ФУНКЦИОНАЛЬНЫЕ МОДУЛИ

### 5.1. Command Palette (Ctrl+P)
- Полнотекстовый поиск по командам, главам, персонажам
- Навигация стрелками ↑↓
- Выполнение по Enter
- Горячие команды: Ctrl+S (сохранить), Ctrl+, (настройки), Ctrl+F (поиск в сайдбаре)

### 5.2. Chapter Editor
- **Toast UI Editor** с тёмной темой
- Toolbar: Bold, Italic, Strike, Heading, Quote, Code, Link, Image, Lists, Table
- Мета-данные: дата, локация, счётчик слов, время чтения
- **Таймлайн событий** (боковая панель)
- **Участники сцены** (боковая панель)
- **Быстрый анализ текста** (диалоги, описания, действия, тон)

### 5.3. Character Editor
- **3 вкладки**: Основной профиль, Сеть отношений, Психология и травмы
- **Split-view для отношений**: две панели (от лица персонажа ↔ зеркало)
- **Trauma Tags**: чипы с диагнозами + мультиселект из базы МКБ-11
- **20 расстройств** в базе для выбора

### 5.4. Settings Engine (24 категории)
1. Цветовая схема (color pickers)
2. Прозрачность и стекло (range sliders)
3. Скругления (range sliders)
4. Тени и объем (range + toggle)
5. Анимации (toggle + range + radio buttons)
6. Шрифты (radio group + range)
7. Отступы и плотность (range)
8. Компоновка (radio + toggle)
9. Инпуты и формы (radio + toggle)
10. Кнопки (toggle)
11. Вкладки (radio)
12. Выпадающие списки (toggle 3D wheel)
13. Карточки и списки (toggle)
14. Редактор текста (radio + toggle)
15. Уведомления (range)

### 5.5. Bottom Panel
- **3 вкладки**: Терминал, Аналитика, Нейросеть связей
- Консоль с цветовой кодировкой (success/info/warn/error)
- Статистика в glass-card
- SVG граф связей с zoom

---

## 6. ИНТЕГРАЦИЯ С TAUZI/RUST

### 6.1. Требуемые API-вызовы
```javascript
// Загрузка проекта
const config = await window.__TAURI__.core.invoke('get_project_config', { name });

// Сохранение проекта
await window.__TAURI__.core.invoke('save_project_config', { name, config });

// Получение списка проектов
const projects = await window.__TAURI__.core.invoke('get_projects');

// Создание проекта
await window.__TAURI__.core.invoke('create_project', { name, config });

// Удаление проекта
await window.__TAURI__.core.invoke('delete_project', { name });
```

### 6.2. Структура данных проекта
```typescript
interface ProjectConfig {
  name: string;
  type: 'novel' | 'script' | 'series' | 'game' | 'comics' | 'theater' | 'animation' | 'other';
  genres: string[];
  calendar: CalendarConfig;
  created: string; // ISO date
  updated: string; // ISO date
  stats: {
    characters: number;
    organizations: number;
    states: number;
    chapters: number;
  };
}

interface CalendarConfig {
  название: string;
  дней_в_неделе: number;
  первый_месяц_года: number;
  названия_дней_недели: string[];
  месяцы: Array<{ название: string; дней: number }>;
  эпохи: Array<{ название: string; год_начала: number; год_конца: number }>;
  сезоны: Array<{ название: string; месяцы: number[]; время_восхода: string; время_заката: string; описание: string }>;
  фазы_луны: Array<{ название: string; луна_номер: number; период_в_днях: number }>;
  праздники: Array<{ название: string; дата_начала: { месяц: number; день: number }; дата_конца: { месяц: number; день: number } }>;
  точка_отсчета: { год: number; месяц: number; день: number; день_недели: number };
  настройки_времени: { часов_в_сутках: number; минут_в_часе: number; секунд_в_минуте: number; широта: number; учитывать_сезонную_длительность_дня: boolean };
  правило_високосного_года: 'григорианское' | 'пользовательское' | 'отсутствует';
  пользовательское_високосное_правило: { месяц: number; день_смещения: number };
}
```

---

## 7. ПЛАН ВНЕДРЕНИЯ

### Этап 1: Базовая инфраструктура
1. Создать единый HTML-файл с полной CSS-системой из `new_ui/index.html`
2. Подключить Vue 3, GSAP, Lodash, Toast UI Editor через CDN
3. Создать базовый layout (activity-bar, sidebar, editor-area, panel)

### Этап 2: Vue приложение
1. Перенести `createApp()` из `new_ui/index.html`
2. Реализовать Settings Engine с реактивным обновлением CSS-переменных
3. Реализовать VanillaXboxWheel компонент

### Этап 3: Интеграция с Tauri
1. Заменить mock-данные на реальные API-вызовы
2. Реализовать загрузку/сохранение проектов
3. Интегрировать CalendarBuilder в Settings Engine

### Этап 4: Редакторы
1. Chapter Editor с Toast UI Editor
2. Character Editor с 3 вкладками
3. Command Palette

### Этап 5: Bottom Panel
1. Консоль с логированием
2. Аналитика
3. Граф связей

---

