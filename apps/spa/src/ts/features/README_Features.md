# apps/spa/src/ts/features — Генеральный Архитектурный Справочник и Карта Модулей WorldWiki

> **Назначение**: Главный архитектурный узел и навигационный атлас всех **10 функциональных подсистем (Features)** веб-приложения WorldWiki SPA. Описывает сквозные потоки данных, межмодульные связи, слои изоляции и служит центральным оглавлением для инженерной документации фронтенда.

---

## 🗺️ Генеральная Карта Подсистем (Master Sitemap & Feature Index)

```
apps/spa/src/ts/features/
├── README_Features.md                  # 🌟 Генеральный архитектурный справочник
│
├── 🧠 ai/                              # Интеллектуальный Ассистент WoWiLon AI
│   ├── README_AI.md                    # 📖 Llama.cpp, Ollama, OpenRouter, <think> reasoning, ветки диалогов, тулы
│   ├── WowilonPanel.vue                # Боковой сайдбар ассистента с ресайзом
│   ├── FloatingWindowAI/               # Открепляемое независимое окно (Tauri WebviewWindow)
│   ├── components/                     # Компоненты диалога, цитат, контролов, тулов и визуализаций
│   └── settings/                       # Настройки моделей, API-ключей, навыков, профилей и мониторинг VRAM/GPU
│
├── 📊 analytics/                       # Литературная Аналитика и Трекинг Нарратива
│   ├── README_Analytics.md             # 📖 Трекер Чеховских ружей и Матрица перекрёстных ссылок
│   ├── ChekhovGunTracker/              # Канбан-трекер сюжетных обещаний и предметов
│   └── CrossReferenceMatrix/           # Матрица присутствия сущностей по главам
│
├── 📖 chapters/                        # Рукопись и Редактор Глав
│   ├── README_Chapters.md              # 📖 Иерархическое дерево, 4 режима редактора (WYSIWYG/MD/Split/Word), сюжет
│   ├── ChaptersView.vue                # Корневой маршрутизируемый контейнер раздела
│   └── components/                     # workspace/, tree/, editor/, panels/, modals/, semantic/
│
├── 🛠️ devtools/                        # Инструменты Разработчика
│   ├── README_Devtools.md              # 📖 Интерактивная SurrealQL REPL-консоль
│   └── SurrealConsole/                 # Консоль запросов, пресеты и вывод результатов
│
├── 📑 documents/                       # Академические Документы и ГОСТ-Стандарты
│   ├── README_Documents.md             # 📖 ГОСТ 7.32-2017, инспектор структуры, NodeViews, экспорт
│   ├── AcademicInspector/              # Инспектор оглавления, рисунков, таблиц, формул и профилей
│   ├── DocumentExportModal/            # Модальное окно компиляции Semantic AST в DOCX/PDF/LaTeX
│   ├── DocumentLayoutBar/              # Панель пресетов верстки (ГОСТ, Книга, ВАК, Custom)
│   ├── DocumentProcessor/              # Экран пакетной обработки и валидации документов
│   ├── nodes/                          # Tiptap v3 NodeViews: FootnoteNode, FigureNode, CrossReference
│   └── extensions/                     # Расширения LineHeightExtension и TextIndentExtension
│
├── 👤 entities/                        # База Сущностей и Энциклопедия Лора Мира
│   ├── README_Entities.md              # 📖 Схемно-ориентированные поля, граф связей, плавающая карточка, путь персонажа
│   ├── EntityEditor/                   # Полноэкранный редактор карточки сущности
│   ├── EntityEditorWindow/             # Отдельное окно редактора сущности с историей ревизий
│   ├── CharacterJourney/               # Хронология пути персонажа и встреч
│   └── components/                     # modals/ (FloatingEntityEditor, TagsManagerModal, CreateEntityModal)
│
├── 📐 schemas/                         # Студия Схем и Конструктор Типов Сущностей
│   ├── README_Schemas.md               # 📖 Schema Studio, Drag & Drop палитра полей, валидаторы, шаблоны миров
│   ├── SchemaEditorMain.vue            # Главный экран конструктора схем
│   ├── composables/                    # useSchemaData, useSchemaDnD, useAvailableEntityTypes, useSchemaTemplates...
│   └── components/                     # canvas/, help/, sidebar/, toolbar/
│
├── 🚀 shell/                           # Оболочка Приложения и Лаунчер Проектов
│   ├── README_Shell.md                 # 📖 Splash диагностика, лаунчер вселенных, навигационный хаб EditorView
│   ├── EditorView.vue                  # Главный полноэкранный рабочий каркас приложения
│   └── components/                     # launcher/ (ProjectLauncher), splash/ (Splash), switcher/ (AppSwitcher)
│
├── ☁️ sync/                            # Облачная Синхронизация и Резервные Копии
│   ├── README_Sync.md                  # 📖 Облачная синхронизация, Яндекс.Диск OAuth PKCE, экспорт .wwiki
│   ├── CloudSyncModal.vue              # Модальное окно управления синхронизацией и экспортом
│   └── yandexPkce.ts                   # Генерация PKCE-пары для Яндекс OAuth
│
└── ⏳ timeline/                        # Континуум Времени, Календари и Хронология
    ├── README_Timeline.md              # 📖 Конструктор календарей, астрономия планет, TimeAtlas, инспекторы
    └── components/                     # calendars/, planets/, atlas/, inspectors/
```

---

## 🏛️ Генеральная Архитектурная Схема Взаимодействия (Master Architecture)

```mermaid
flowchart TD
    subgraph Shell_Layer ["Оболочка Приложения (features/shell)"]
        Launcher["ProjectLauncher (Лаунчер Вселенных)"]
        EditorShell["EditorView (Главный Навигационный Хаб)"]
    end

    subgraph Content_Core ["Ядро Контента и Рукописи"]
        Chapters["features/chapters<br/>(Дерево, Редактор, Сюжетные Обещания)"]
        WordEngine["@worldwiki/word-vibe<br/>(Полиграфический Word-режим A4)"]
        Documents["features/documents<br/>(ГОСТ 7.32, Инспектор, Экспорт)"]
        Analytics["features/analytics<br/>(Чеховские ружья, Матрица связей)"]
    end

    subgraph Lore_Core ["Энциклопедия Мира и Логика"]
        Entities["features/entities<br/>(Карточки персонажей, локаций, путь)"]
        Schemas["features/schemas<br/>(Конструктор типов Schema Studio)"]
        Timeline["features/timeline<br/>(Календари, Планеты, TimeAtlas, Хронология)"]
    end

    subgraph Intelligence_And_Ops ["Интеллект, Облако и DevTools"]
        AI["features/ai (WoWiLon AI)<br/>(Llama.cpp / Ollama / Cloud / Tools)"]
        Sync["features/sync<br/>(Яндекс.Диск PKCE / .wwiki / E2EE)"]
        Devtools["features/devtools<br/>(SurrealConsole REPL)"]
    end

    subgraph Storage_Layer ["Слой Хранилищ и Backend (Pinia & Tauri)"]
        Stores["Pinia Stores (Chapter, Entity, Schema, Calendar, Analytics, Project)"]
        TauriIPC["Tauri Rust Core (SurrealDB / Docx Engine)"]
    end

    Launcher --> EditorShell
    EditorShell --> Chapters
    EditorShell --> Documents
    EditorShell --> Analytics
    EditorShell --> Entities
    EditorShell --> Schemas
    EditorShell --> Timeline
    EditorShell <--> AI
    EditorShell <--> Sync
    EditorShell --> Devtools

    Chapters <-->|"Semantic AST"| WordEngine
    Chapters <-->|"NodeViews / Profiles"| Documents
    Chapters <-->|"Триггер '((' и связи"| Entities
    Chapters <-->|"Дата сцены"| Timeline
    Analytics <-->|"Упоминания и ружья"| Chapters

    Entities <-->|"Структура полей"| Schemas
    Entities <-->|"Даты жизни по M_abs"| Timeline

    AI <-->|"Контекст (Главы, Лор, Даты)"| Chapters
    AI <-->|"Контекст сущностей"| Entities
    AI -->|"Вызов инструментов"| Stores

    Chapters <--> Stores
    Documents <--> Stores
    Analytics <--> Stores
    Entities <--> Stores
    Schemas <--> Stores
    Timeline <--> Stores
    Sync <--> Stores
    Devtools <--> TauriIPC
    Stores <--> TauriIPC
```

---

## 🧭 Сводная Таблица Подсистем и Архитектурных Ролей

| Подсистема | Роль в приложении | Ключевые зависимости | Ссылка на документацию |
|---|---|---|---|
| **`ai`** | Интеллектуальный ассистент писателя (WoWiLon AI), локальный и облачный рантайм, reasoning `<think>`, тулы | `aiModels.api.ts`, Tauri IPC, Llama.cpp / Ollama | [README_AI.md](./ai/README_AI.md) |
| **`analytics`** | Трекер Чеховских ружей и матрица перекрёстных ссылок сущностей по главам | `analytics.store.ts`, `api.client.ts` | [README_Analytics.md](./analytics/README_Analytics.md) |
| **`chapters`** | Главное рабочее пространство писателя: тома, главы, 4 режима редактора, сюжетный инспектор | `chapter.store.ts`, `ASTAdapter.ts`, `@worldwiki/word-vibe` | [README_Chapters.md](./chapters/README_Chapters.md) |
| **`devtools`** | Встроенная интерактивная SurrealQL REPL-консоль с пресетами и историей | `api.client.ts`, `localStorage` | [README_Devtools.md](./devtools/README_Devtools.md) |
| **`documents`** | Академическая стандартизация (ГОСТ 7.32), титульные листы, инспектор структуры, компилятор экспорта | `ASTAdapter.ts`, Tiptap v3 NodeViews, Rust Docx Engine | [README_Documents.md](./documents/README_Documents.md) |
| **`entities`** | База знаний лора вселенной, карточки сущностей, путь персонажа, плавающий и оконный редакторы | `entity.store.ts`, `entity.tree.ts`, `schema.store.ts` | [README_Entities.md](./entities/README_Entities.md) |
| **`schemas`** | Студия мета-моделирования (Schema Studio): визуальное проектирование типов сущностей и правил связей | `schema.store.ts`, HTML5 DnD, `useSchemaTemplates` | [README_Schemas.md](./schemas/README_Schemas.md) |
| **`shell`** | Каркас приложения: сплэш-диагностика, лаунчер вселенных, навигационный хаб `EditorView`, горячие клавиши | `project.store.ts`, `project.service.ts`, `settings.service.ts` | [README_Shell.md](./shell/README_Shell.md) |
| **`sync`** | Облачная синхронизация (Яндекс.Диск OAuth PKCE, WorldWiki Cloud, WebDAV) и экспорт `.wwiki` | `sync.service.ts`, `yandexPkce.ts`, Tauri Rust Sync | [README_Sync.md](./sync/README_Sync.md) |
| **`timeline`** | Единый континуум времени ($M_{\text{abs}}$), авторские календари, планеты, луны, `TimeAtlas` и инспекторы | `calendar.store.ts`, `useCalendarEngine.ts`, `timeline.store.ts` | [README_Timeline.md](./timeline/README_Timeline.md) |

---

## 🧩 Ключевые Архитектурные Инварианты Системы

1. **Единый Semantic AST как мост данных**:
   - Все редакторы и модули рукописи обмениваются данными исключительно через типизированный промежуточный AST (`SemanticDocument`). Ни один модуль не зависит от сырых структур чужого WYSIWYG-движка.
2. **Абсолютная Минута ($M_{\text{abs}}$) как основа хронологии**:
   - Время в WorldWiki не привязано к земному календарю. Любая дата в любой культуре — это проекция глобального числа минут от сотворения мира ($M_{\text{abs}}$), что позволяет синхронизировать даты сцен, жизни персонажей и исторические эпохи.
3. **Чистые границы пакетов (Clean Package Boundaries)**:
   - Автономные движки (такие как `@worldwiki/word-vibe` для полиграфического Word-режима) вынесены в отдельные npm-пакеты и не имеют прямых связей с хранилищами SPA.

---

## 🧪 Полный прогон тестов всех фич приложения

```bash
# 1. Тесты ядра рукописи и редактора
pnpm test apps/spa/src/ts/features/chapters

# 2. Тесты аналитики и инструментов разработчика
pnpm test apps/spa/src/ts/features/analytics
pnpm test apps/spa/src/ts/features/devtools

# 3. Тесты сущностей лора и схем
pnpm test apps/spa/src/ts/features/entities
pnpm test apps/spa/src/ts/features/schemas

# 4. Тесты подсистемы времени и календарей
pnpm test apps/spa/src/ts/features/timeline

# 5. Тесты документов и экспорта
pnpm test apps/spa/src/ts/features/documents

# 6. Тесты оболочки и синхронизации
pnpm test apps/spa/src/ts/features/shell
pnpm test apps/spa/src/ts/features/sync

# 7. Тесты искусственного интеллекта WoWiLon AI
pnpm test apps/spa/src/ts/features/ai

# 8. Комплексный прогон всех тестов SPA
pnpm --filter @worldwiki/spa test
```
