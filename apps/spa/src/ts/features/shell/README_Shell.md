# apps/spa/src/ts/features/shell — Архитектура Оболочки и Лаунчера Проектов

> **Назначение**: Корневой каркас рабочего пространства приложения WorldWiki. Управляет начальной загрузкой (`Splash`), стартовым экраном создания и управления вселенными/проектами (`ProjectLauncher`), главным окном редактора (`EditorView`) с координацией навигационных модулей (Рукопись, Сущности, Календари, Граф связей, WoWiLon AI), горячими клавишами глобального уровня и переключением проектов (`AppSwitcher`).

---

## 📁 Структура папок и файлов

```
apps/spa/src/ts/features/shell/
├── README_Shell.md                     # Данная всеобъемлющая документация архитектуры оболочки
├── EditorView.vue                      # Главный полноэкранный рабочий каркас (Header, Navigation, Workspace, AI Sidebar)
├── EditorView.vue.ts                   # Логика оркестрации EditorView: вкладки, горячие клавиши, модалки
├── useEditorViewListeners.ts           # Слушатели IPC и глобальных событий
├── useEditorViewListeners.spec.ts      # Тесты слушателей EditorView
│
└── components/                         # Декомпозированные компоненты оболочки
    ├── launcher/                       # Лаунчер проектов
    │   └── ProjectLauncher/            # Компонент лаунчера, хуки, константы и тесты
    ├── splash/                         # Экран загрузки
    │   └── Splash/                     # Сплэш-скрин загрузки приложения и логика инициализации
    └── switcher/                       # Переключатель миров
        └── AppSwitcher/                # Компактный выпадающий селектор быстрого переключения проектов
```

---

## 🏛️ Архитектурная модель оболочки (Shell Architecture)

```mermaid
flowchart TD
    subgraph Boot_Phase ["1. Фаза Загрузки (Boot Phase)"]
        Splash["Splash.vue (Инициализация)"]
        InitCheck["Проверка БД, миграции, кэш, Tauri IPC"]
    end

    subgraph Launch_Phase ["2. Фаза Лаунчера (Project Launcher)"]
        Launcher["ProjectLauncher.vue"]
        CreateModal["Мастер создания проекта (Шаблоны)"]
        RecentProjects["Карточки недавних миров"]
        ImportExport["Импорт / Экспорт архивов (.world / .zip)"]
    end

    subgraph Workspace_Phase ["3. Фаза Рабочего Пространства (EditorView)"]
        EditorShell["EditorView.vue (Главный каркас)"]
        TopNav["Header & AppSwitcher (Переключение модулей и миров)"]
        
        subgraph Active_Modules ["Активные Рабочие Модули"]
            ChapModule["Рукопись (features/chapters)"]
            EntityModule["Сущности и Лор (features/entities)"]
            TimelineModule["Календари и Таймлайн (features/timeline)"]
            GraphModule["Граф связей (features/graph)"]
            SchemaModule["Студия схем (features/schemas)"]
        end
        
        AISidebar["Боковая панель WoWiLon AI (features/ai)"]
    end

    subgraph Core_Services ["Службы Ядра (Services & Stores)"]
        ProjectService["project.service.ts"]
        ProjectStore["project.store.ts"]
        SettingsService["settings.service.ts"]
        SyncService["sync.service.ts (Облако)"]
    end

    Splash --> InitCheck
    InitCheck --> Launcher
    Launcher --> CreateModal
    Launcher --> RecentProjects
    Launcher --> ImportExport

    Launcher -->|"Выбор проекта (projectId)"| EditorShell
    EditorShell --> TopNav
    EditorShell --> Active_Modules
    EditorShell <--> AISidebar

    Launcher <--> ProjectStore
    EditorShell <--> ProjectService
    EditorShell <--> SettingsService
    EditorShell <--> SyncService
```

---

## 🔄 Жизненный цикл старта приложения и открытия проекта (Sequence Diagram)

```mermaid
sequenceDiagram
    autonumber
    actor User as Пользователь
    participant Splash as Splash.vue
    participant Launcher as ProjectLauncher.vue
    participant Hook as useProjectLauncher.ts
    participant Shell as EditorView.vue
    participant PStore as project.store.ts
    participant Tauri as Tauri Backend (Rust)
    participant DB as SQLite / SurrealDB

    User->>Splash: Запуск WorldWiki
    Splash->>Tauri: invoke("init_app_environment")
    Tauri->>DB: Проверка и применение миграций схем
    DB-->>Tauri: Миграции успешны
    Splash-->>Launcher: Переход в лаунчер проектов
    
    Launcher->>Hook: loadRecentProjects()
    Hook->>PStore: fetchProjectList()
    PStore->>Tauri: invoke("get_projects")
    Tauri-->>PStore: ProjectSummary[]
    PStore-->>Launcher: Рендер карточек миров
    
    User->>Launcher: Клик по проекту «Элизиум» (ID: 'proj_312')
    Launcher->>PStore: selectProject('proj_312')
    PStore->>Tauri: invoke("open_project", { id: 'proj_312' })
    Tauri-->>PStore: ProjectData (Главы, Сущности, Календари)
    Launcher-->>Shell: Монтирование EditorView.vue
    Shell->>Shell: Восстановление последней активной вкладки ('chapters')
```

---

## 🧮 Шаблоны генерации новых миров (`ProjectTemplate`)

При создании проекта лаунчер формирует базовую структуру на основе выбранного шаблона:

$$\text{ProjectInitPayload} = \{ \text{id}, \text{name}, \text{description}, \text{templateId}, \text{initialSchemas}, \text{defaultCalendar} \}$$

| Шаблон | Идентификатор | Предустановленные схемы и структуры |
|---|---|---|
| **Чистый лист** | `'blank'` | Минимальная структура, 1 дефолтная глава, стандартный календарь (12 месяцев) |
| **Фэнтези-вселенная** | `'fantasy'` | Схемы: *Персонаж (магия, раса)*, *Локация*, *Артефакт*, *Фракция*. Календарь с 3 лунами и эпохами |
| **Sci-Fi / Космоопера** | `'scifi'` | Схемы: *Звездная система*, *Корабль*, *Корпорация*, *Технология*. Метрическое звездное время |
| **Детективный роман** | `'detective'` | Схемы: *Подозреваемый*, *Улика*, *Место преступления*. Таймлайн с поминутной сеткой алиби |
| **Академическая работа** | `'academic'` | Пресет ГОСТ 7.32-2017: Титульный лист, Введение, Главы, Заключение, Список источников |

---

## 🧩 Ключевые возможности оболочки

### 1. Splash Screen & Diagnostic Boot
* Проверяет целостность локальных баз данных, директорий кэша и доступность аппаратного ускорения WebView.
* При обнаружении поврежденных файлов предлагает режим автоматического восстановления из последнего локального бэкапа.

### 2. Управление проектами (`useProjectLauncher`)
* Создание, дублирование, архивирование и экспорт вселенной в единый сжатый файл `.world` (ZIP-контейнер с манифестом `manifest.json`, базой SQLite и каталогом медиа-ресурсов).
* Импорт существующих проектов без риска перезаписи существующих ID.

### 3. EditorView Navigation Hub
* Динамическое переключение между крупными функциональными экранами приложения с сохранением состояния каждого экрана (KeepAlive).
* Глобальный хоткей-менеджер: `Ctrl+P` (Командная палитра), `Ctrl+B` (Скрыть/показать дерево), `Ctrl+J` (Открыть WoWiLon AI).

---

## ⚠️ Важные нюансы реализации (Gotchas & Best Practices)

1. **Изоляция контекста проекта при переключении**:
   * При смене проекта в `AppSwitcher` вызывается полная очистка всех реактивных хранилищ Pinia (`chapter.store`, `entity.store`, `timeline.store`, `schema.store`) перед загрузкой данных нового мира, предотвращая утечку данных между проектами.
2. **Асинхронный экспорт больших проектов**:
   * Экспорт архива `.world` выполняется в отдельном фоновом потоке Rust через Tauri Command с эмиттом прогресса `export_progress`, не блокируя интерфейс лаунчера.

---

## 🧪 Верификация и тестирование

Запуск тестового набора оболочки:
```bash
# Тесты логики лаунчера и создания проектов
pnpm test apps/spa/src/ts/features/shell

# Тесты инициализации и переключения режимов EditorView
pnpm test apps/spa/src/ts/features/shell/__tests__
```
