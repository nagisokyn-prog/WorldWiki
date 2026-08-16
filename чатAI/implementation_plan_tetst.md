# Глобальная Стратегия Тестирования: WorldWiki

Данный план описывает архитектуру и процессы тестирования бизнес-логики (backend, state management, utilities) с целью достижения **85% покрытия кода (Code Coverage)**. Мы строго фокусируемся на проверке данных и логики, полностью игнорируя визуальное тестирование UI-интерфейсов (кнопок, верстки и стилей).

---

## 1. Виды Тестирования и их Применение

### 1.1 Модульные тесты (Unit Testing)
Изолированная проверка отдельных функций, структур данных, алгоритмов и методов.
- **Где**: `tauri-surreal-kit` (ORMs, макросы), `src-tauri` (AI промпты, файловые операции), `apps/spa/src/logic`, `packages`.
- **Как (Rust)**: Встроенный `#[cfg(test)]` и модули `mod tests`.
- **Как (TS)**: `vitest` для чистых функций и стейт-менеджмента без монтирования Vue компонентов.
- **Покрытие**: 100% покрытие чистых функций, парсеров, валидаторов и алгоритмов (например, парсеры Markdown, генерация UUID, расчеты).

### 1.2 Интеграционные тесты (Integration Testing)
Проверка взаимодействия между несколькими модулями (например, Rust <-> SurrealDB или Pinia Store <-> Tauri Commands).
- **Где**: `src-tauri` (коммуникация с БД, Tauri IPC Commands), `tauri-surreal-kit` (выполнение реальных SurQL запросов).
- **Как (Rust)**: Интеграционные тесты в папке `tests/` на уровне крейта, использующие in-memory БД (или тестовый экземпляр SurrealDB).
- **Как (TS)**: `vitest` + `jsdom` (без UI) для проверки реактивности сторов, вызывающих моковые Tauri-эндпоинты.

### 1.3 Контрактные тесты (Contract Testing)
Проверка того, что схемы данных и форматы API, ожидаемые фронтендом, совпадают с тем, что отдает бекенд.
- **Где**: Граница между `src-tauri` (Rust struct -> JSON) и `apps/spa` (TS Types -> Zod/JSON).
- **Как**: Использование единых JSON-схем, генерация моков. В Rust тесты сериализуют структуры в JSON, а в TS `vitest` парсит этот JSON через схемы валидации, гарантируя, что контракты не сломались.

### 1.4 Дымовые тесты (Smoke Testing)
Быстрая проверка базовой работоспособности критического пути приложения после сборки.
- **Цель**: Проверить, запускается ли движок, поднимается ли БД, инициализируется ли AI.
- **Где**: CI/CD pipeline.
- **Как**: Скрипт (Node.js/Bash), который пингует основные Tauri команды (например, `init_db`, `health_check`) и ожидает успешного старта системы за N секунд. Без запуска интерфейса.

### 1.5 Регрессионные тесты (Regression Testing)
Автоматизированные прогоны всей базы модульных и интеграционных тестов при каждом пулл-реквесте или коммите для гарантии, что новые изменения не сломали старую логику.
- **Как**: Реализуется через GitHub Actions (`ci.yml`). Любой найденный баг сначала покрывается регрессионным тестом, а потом фиксится.

### 1.6 Нагрузочное тестирование (Load Testing)
Проверка производительности логики под ожидаемой высокой нагрузкой (например, пакетная обработка тысяч чаптеров или множественные запросы к SurrealDB).
- **Где**: `tauri-surreal-kit` (производительность БД) и `src-tauri` (скорость Tauri-команд).
- **Как (Enterprise)**: Бенчмарки на bulk-insert десятков и сотен тысяч (10k - 100k+) записей за раз. Высококонкурентные пулы из тысяч параллельных JOIN-выборок по глубоким графам связей. Высококонкурентный спам Tauri-команд. Использование `criterion` для Rust и `k6`.

### 1.7 Стресс-тестирование (Stress Testing)
Поведение системы за пределами нормальной нагрузки (утечки памяти, падения).

---

## 2. Реальное состояние тестов (АУДИТ)

### 2.1. `apps/spa` (Frontend — Vue 3 + Pinia + Vitest)

**✅ ЧТО УЖЕ ЕСТЬ (работает, проходит):**
```text
apps/spa/src/ts/stores/__tests__/
└── timeline.store.spec.ts          ✅ 36 тестов — ПРОХОДЯТ
```

| Тест-файл | Покрывает | Тип | Статус |
|-----------|-----------|-----|--------|
| `stores/__tests__/timeline.store.spec.ts` | `stores/timeline.store.ts` | Unit (моки) | ✅ **ГОТОВО** |

**📋 ЧТО НУЖНО СОЗДАТЬ (план):**
```text
apps/spa/src/ts/
├── stores/__tests__/
│   ├── shell.spec.ts                 📋 НЕТ (shell.ts — 50kb главной логики)
│   ├── chapter.store.spec.ts         📋 НЕТ
│   ├── calendar.store.spec.ts        📋 НЕТ
│   └── timeline.store.spec.ts        ✅ ЕСТЬ
├── services/__tests__/
│   ├── api.client.spec.ts            📋 НЕТ (контракты Tauri invoke)
│   ├── chapter.service.spec.ts       📋 НЕТ
│   ├── editor.service.spec.ts        📋 НЕТ
│   └── project.service.spec.ts       📋 НЕТ
├── utils/__tests__/
│   ├── ui-helpers.spec.ts            📋 НЕТ
│   └── requestCache.spec.ts          📋 НЕТ
└── features/
    ├── ai/__tests__/useWowilonPanel.spec.ts                 📋 НЕТ
    ├── chapters/ChapterTree/__tests__/useChapterTree.spec.ts 📋 НЕТ (19kb)
    └── chapters/EditorCoreTiptap/__tests__/
        ├── useTiptapEditor.spec.ts        📋 НЕТ
        └── AiGhostTextExtension.spec.ts   📋 НЕТ
```

> **Примечание:** Все текущие тесты — **Unit с моками** (`vi.mock calendarApi`). Реальной БД не трогают.

---

### 2.2. `src-tauri` (Rust Backend — Tauri + SurrealDB)

**❌ ТЕСТОВ НЕТ вообще.** Ни `#[cfg(test)]` в модулях, ни папки `tests/`.

**📋 ЧТО НУЖНО СОЗДАТЬ (приоритет HIGH — туда лезет таймлайн):**
```text
src-tauri/src/
├── logic/
│   ├── chapters.rs                  📋 ДОБАВИТЬ #[cfg(test)] mod tests
│   │   └── test_get_global_timeline
│   │   └── test_save_global_timeline
│   ├── projects.rs                  📋 ДОБАВИТЬ тесты
│   ├── entities.rs                  📋 ДОБАВИТЬ тесты
│   ├── connections.rs               📋 ДОБАВИТЬ тесты
│   ├── calendar_math.rs             📋 ДОБАВИТЬ тесты
│   └── ai/                          📋 ДОБАВИТЬ тесты
├── tests/                           📋 СОЗДАТЬ ПАПКУ (интеграционные)
│   ├── common/mod.rs                📋 Хелперы: in-memory DB + schema + seed
│   ├── timeline_integration.rs      📋 Реальные SurQL тесты таймлайна
│   └── project_lifecycle.rs         📋 CRUD проектов
```
---

### 2.3. `tauri-surreal-kit` (Rust Library — ORM / Macros)

**❌ ТЕСТОВ НЕТ.**

**📋 ПЛАН:**
- Unit-тесты макросов (`surreal_domain_macros`)
- Интеграционные тесты `SurrealRepository` trait в `tests/` с in-memory DB

---

### 2.4. `packages` (Shared TS Utils)

**❌ ТЕСТОВ НЕТ.**

**📋 ПЛАН:**
```text
packages/resources/__tests__/resources.spec.ts   📋 НЕТ
packages/components/__tests__/                  📋 НЕТ
```

---

## 3. Приоритеты (Что делать СЕЙЧАС)

| # | Задача | Где | Тип | Зачем |
|---|--------|-----|-----|-------|
| 1 | **Rust интеграционные тесты для `get_global_timeline` / `save_global_timeline`** | `src-tauri/src/logic/chapters.rs` + `tests/` | Integration | Решает твою проблему: реальные данные в БД до/после теста |
| 2 | Тесты для `shell.ts` (главный стор, 50kb) | `apps/spa/src/ts/stores/__tests__/shell.spec.ts` | Unit | Критическая логика приложения |
| 3 | Контрактные тесты `api.client.ts` | `apps/spa/src/ts/services/__tests__/api.client.spec.ts` | Contract | Гарантия совместимости фронт<->бэк |
| 4 | Rust unit-тесты в `projects.rs`, `entities.rs` | `src-tauri/src/logic/` | Unit | Базовые CRUD операции |
| 5 | Остальные сторы/сервисы/фичи | `apps/spa/` | Unit | По мере разработки |

---

## 4. Этапы (Roadmap)

1. **✅ Стек одобрен** — Vitest + happy-dom настроен, моки Tauri готовы (`test/mocks/tauri.ts`)
2. **📋 Настроить Rust тесты** — добавить `tests/` в `src-tauri`, настроить in-memory SurrealDB + схему
3. **📋 Создать хелперы сидинга** — `create_test_db()`, `seed_project()`, `seed_chapter()`, `seed_timeline()`
4. **📋 Написать интеграционные тесты таймлайна** — `get_global_timeline`, `save_global_timeline` с реальными данными
5. **📋 Покрыть `shell.ts`** — самый важный стор на фронте
6. **📋 Контрактные тесты API** — синхронизация типов Rust <-> TS
7. **📋 Настроить CI** — `cargo test` + `pnpm vitest run` в GitHub Actions
8. **📋 Бенчмарки/стресс** — `criterion` для Rust, нагрузка 10k+ записей

---

## 5. Ответ на твой вопрос: "Стоит ли париться сейчас?"

**ДА, но только за Rust-тесты (пункт 1-4 выше).**

**Почему:**
- Твоя проблема — "в БД не загружаются тестовые данные" — решается **только** Rust-тестами с in-memory DB
- Фронт-тесты (Vitest) с моками **не лезут в БД** — они тестируют логику стора, не данные
- `timeline.store.spec.ts` ✅ уже готов, он тестирует: инициализацию, загрузку, ошибки, геттеры, парсинг участников
- Дописывать остальные фронт-тесты можно **после** того как бэк будет иметь тесты с реальными данными

**Следующий шаг:** Создать `src-tauri/src/tests/common/mod.rs` + добавить `#[cfg(test)]` в `chapters.rs` с тестами таймлайна. Это даст тебе:
- Реальную БД в памяти на каждый тест
- Авто-очистку после теста
- Проверку что `get_global_timeline` возвращает именно то, что лежит в БД

---

*Обновлено: 2025-08-16 — аудит реального состояния репозитория*
**Ответственность:** Работа с файловой системой, формирование промптов для AI, файловый кеш, маппинг Tauri Commands, оркестрация бизнес-логики.

**Задачи и Оценки:**
| Тип тестирования | Задачи и Ответственность | Инструментарий | Оценочное к-во тестов |
|------------------|--------------------------|----------------|------------------------|
| **Модульные** | Логика парсинга Markdown в AST, генерация system-prompts для AI (шаблонизация), утилиты работы с путями, стейт-менеджеры Rust (Mutex/RwLock). | `cargo test` | ~120-150 тестов |
| **Интеграционные** | Тестирование обработчиков (handlers) Tauri: вызов команды из логики -> обращение к БД -> возврат DTO. Проверка FileSystem -> AI -> DB flow. | `cargo test` | ~40-60 тестов |
| **Контрактные** | Автоматическая сверка Rust-структур (DTO) с TS-интерфейсами (через `ts-rs` или схему). Защита от поломки IPC Tauri. | `cargo test` | ~15-20 схем |
| **Регрессионные** | Покрытие всех известных багов в AI-оркестрации и парсинге. | `cargo test` | Растет со временем |
| **Нагрузочное** | Высококонкурентный спам Tauri-команд (десятки тысяч одновременных вызовов). Проверка блокировок Mutex/RwLock, deadlocks, throughput при максимальной утилизации CPU. | `k6` или кастомный Rust runner | 5-8 сценариев |
| **Стресс-тесты** | Проверка поведения бэкенда при исчерпании памяти (ГБ+ графы в оперативке), защита от OOM при потоковой передаче гигантских файлов, агрессивная AI генерация до предела ресурсов. | `cargo test` | ~5-10 тестов |

**Физическая Структура и Расположение:**
```text
src-tauri/
└── src/
    ├── logic/                                      ← логика 
    │   ├── ai/*.rs, batch.rs, calendar_math.rs, chapters.rs, entities.rs, export.rs, models.rs...
    │
    └── tests/                                      ← [СОЗДАТЬ]
        ├── unit/
        │   ├── calendar_math.rs
        │   ├── batch_logic.rs
        │   └── export_formatting.rs
        ├── integration/
        │   ├── commands_chapters.rs
        │   ├── commands_entities.rs
        │   ├── commands_ai.rs
        │   └── commands_export.rs
        ├── contracts/
        │   └── ipc_schema.rs
        ├── smoke/
        │   └── smoke_init.rs
        └── stress/
            ├── stress_concurrent_commands.rs
            └── stress_oom_protection.rs
```

**Что тестирует каждый файл:**
| Тест-файл | Покрывает продакшен-файл |
|-----------|--------------------------|
| `unit/calendar_math.rs` | `src/logic/calendar_math.rs` — вся математика дат |
| `unit/batch_logic.rs` | `src/logic/batch.rs` — алгоритм батчинга |
| `unit/export_formatting.rs` | `src/logic/export.rs` — форматирование вывода |
| `integration/commands_chapters.rs` | `src/logic/chapters.rs` + `main.rs` (Tauri cmds) |
| `integration/commands_entities.rs` | `src/logic/entities.rs` + `src/logic/connections.rs` |
| `integration/commands_ai.rs` | `src/logic/ai/agent/`, `ai/chat/`, `ai/providers/` |
| `integration/commands_export.rs` | `src/logic/export.rs` + `src/logic/volumes.rs` |
| `contracts/ipc_schema.rs` | `src/main.rs` — все `#[tauri::command]` публичные функции |
| `smoke/smoke_init.rs` | `src/main.rs` — инициализация приложения |
| `stress/stress_concurrent_commands.rs` | `src/logic/*.rs` — thread-safety |
| `stress/stress_oom_protection.rs` | `src/logic/ai/` + `src/logic/batch.rs` |

---

### 2.3. `apps/spa` (Фронтенд Логика)
**Ответственность:** Стейт-менеджмент (Pinia), бизнес-правила на стороне клиента, композитные функции (`composables`), парсеры Tiptap, логика роутинга и подготовки данных для интерфейса.

**Задачи и Оценки:**
| Тип тестирования | Задачи и Ответственность | Инструментарий | Оценочное к-во тестов |
|------------------|--------------------------|----------------|------------------------|
| **Модульные** | Чистые функции в `src/logic/`, парсеры, форматирование дат, валидация полей форм (без DOM), функции синхронизации графа глав (`useChapterTree`). | `vitest` | ~100-150 тестов |
| **Интеграционные** | Тестирование связок `Pinia Store` + Mock Tauri API. Проверка того, что при вызове экшена стор корректно обновляет реактивное состояние (`ref`/`reactive`). | `vitest` + `jsdom` (headless) | ~30-50 тестов |
| **Контрактные** | Валидация моковых JSON-ответов от Tauri через Zod-схемы на стороне фронтенда. | `vitest` | ~20-30 тестов |
| **Дымовые** | Базовая загрузка ядра фронтенда: монтирование главного стора и проверка инициализации плагинов (i18n, Pinia) без отрисовки UI. | `vitest` | ~5 тестов |
| **Стресс-тесты** | Имитация огромных графов (10 000+ глав) в памяти Pinia. Проверка того, что Vue-реактивность не зависает при таких объемах. | `vitest` | 2-3 сценария |

**Физическая Структура и Расположение:**
```text
apps/spa/src/ts/
├── stores/
│   ├── shell.ts, chapter.store.ts, calendar.store.ts...
│   └── __tests__/                                  ← [СОЗДАТЬ]
│       ├── shell.spec.ts
│       └── chapter.store.spec.ts
│
├── services/
│   ├── api.client.ts, chapter.service.ts...
│   └── __tests__/                                  ← [СОЗДАТЬ]
│       ├── api.client.spec.ts
│       └── chapter.service.spec.ts
│
├── utils/
│   ├── ui-helpers.ts, requestCache.ts...
│   └── __tests__/                                  ← [СОЗДАТЬ]
│       └── ui-helpers.spec.ts
│
└── features/
    ├── ai/__tests__/useWowilonPanel.spec.ts
    ├── chapters/ChapterTree/__tests__/useChapterTree.spec.ts
    └── chapters/EditorCoreTiptap/__tests__/useTiptapEditor.spec.ts
    └── chapters/EditorCoreTiptap/__tests__/AiGhostTextExtension.spec.ts
```

**Что тестирует каждый файл:**
| Тест-файл | Покрывает продакшен-файл | Тип |
|-----------|--------------------------|-----|
| `stores/__tests__/shell.spec.ts` | `stores/shell.ts` — весь главный стор (50kb логики) | Unit + Integration |
| `stores/__tests__/chapter.store.spec.ts` | `stores/chapter.store.ts` | Unit |
| `stores/__tests__/calendar.store.spec.ts` | `stores/calendar.store.ts` | Unit |
| `stores/__tests__/timeline.store.spec.ts` | `stores/timeline.store.ts` | Unit |
| `services/__tests__/api.client.spec.ts` | `services/api.client.ts` — все Tauri invoke вызовы | Contract |
| `services/__tests__/chapter.service.spec.ts` | `services/chapter.service.ts` | Integration |
| `services/__tests__/editor.service.spec.ts` | `services/editor.service.ts` | Unit |
| `services/__tests__/project.service.spec.ts` | `services/project.service.ts` | Unit |
| `utils/__tests__/ui-helpers.spec.ts` | `utils/ui-helpers.ts` — 15kb чистых функций | Unit |
| `utils/__tests__/requestCache.spec.ts` | `utils/requestCache.ts` | Unit |
| `features/ai/__tests__/useWowilonPanel.spec.ts` | `features/ai/useWowilonPanel.ts` | Unit |
| `features/chapters/ChapterTree/__tests__/useChapterTree.spec.ts` | `features/chapters/ChapterTree/useChapterTree.ts` — 19kb | Unit + Stress |
| `features/chapters/EditorCoreTiptap/__tests__/useTiptapEditor.spec.ts` | `features/chapters/EditorCoreTiptap/useTiptapEditor.ts` | Unit |
| `features/chapters/EditorCoreTiptap/__tests__/AiGhostTextExtension.spec.ts` | `EditorCoreTiptap/AiGhostTextExtension.ts` | Unit |

---

### 2.4. `packages` (Общие TS утилиты)
**Ответственность:** Разделяемая логика, чистые алгоритмы, общие типы и константы.

**Задачи и Оценки:**
| Тип тестирования | Задачи и Ответственность | Инструментарий | Оценочное к-во тестов |
|------------------|--------------------------|----------------|------------------------|
| **Модульные** | Изолированная проверка каждого метода (математика, общие парсеры строк, генераторы). Требуемое покрытие здесь должно стремиться к 100%. | `vitest` | ~40-60 тестов |
| **Регрессионные** | Фиксация багов на уровне общих библиотек. | `vitest` | Растет со временем |

**Физическая Структура и Расположение:**
```text
packages/
└── resources/
    └── __tests__/                                  ← [СОЗДАТЬ]
        └── resources.spec.ts                       
```

**Что тестирует каждый файл:**
| Тест-файл | Покрывает продакшен-файл | Тип |
|-----------|--------------------------|-----|
| `resources/__tests__/resources.spec.ts` | `resources/index.ts` (и внутренние) | Unit |

---

## 3. Этапы (Roadmap)
1. **Одобрение стека и подходов.**
2. **Настройка фреймворков покрытия** (`llvm-cov`, `vitest config`) во всех папках. Настройка CI (`ci.yml`).
3. **Разворачивание структуры папок** `tests/` и `benches/` по плану выше. Создание файлов.
4. **Написание моков Tauri `invoke`** для фронтенда и In-Memory БД для бекенда.
5. **Постепенное покрытие бизнес-логики:** сначала `packages` и `tauri-surreal-kit`, затем `src-tauri` и `apps/spa`.
6. **Интеграция бенчмарков и Stress-тестов** (Enterprise scale 10k+).
