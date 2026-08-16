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
Проверка поведения системы за пределами нормальной нагрузки (проверка утечек памяти, падений, отказоустойчивости).
- **Цель**: Выяснить, как приложение умирает при нехватке RAM (например, AI генерация тяжелых моделей), и корректно ли оно освобождает ресурсы.
- **Как**: Проверка на предел прочности (Breaking Point): забивание пула десятками тысяч одновременных транзакций, симуляция нехватки памяти (OOM) при парсинге гигантских объемов данных (ГБ+), удержание консистентности при жестком обрыве. `cargo test` + `k6`.

---

## 2. Глубокий Анализ и Структура по Директориям

### 2.1. `tauri-surreal-kit` (БД и ORM слой)
**Ответственность:** Базовые абстракции над SurrealDB, парсинг запросов, макросы и сериализация доменных моделей.

**Задачи и Оценки:**
| Тип тестирования | Задачи и Ответственность | Инструментарий | Оценочное к-во тестов |
|------------------|--------------------------|----------------|------------------------|
| **Модульные** | Проверка макросов генерации SurQL, валидация DTO, сериализация/десериализация (`serde`), парсинг ошибок БД в доменные ошибки. | `cargo test` | ~80-100 тестов |
| **Интеграционные** | Подключение к In-Memory SurrealDB, проверка цепочек CRUD операций (создание -> обновление -> удаление -> поиск), транзакции. | `cargo test` + `surrealdb` | ~30-40 тестов |
| **Нагрузочное** | Настоящий Enterprise-scale. Бенчмарки на bulk-insert десятков и сотен тысяч (10k - 100k+) записей за раз. Высококонкурентные пулы из тысяч параллельных JOIN-выборок по глубоким графам связей. | `criterion` (Rust) | 8-10 жестких бенчмарков |
| **Стресс-тесты** | Проверка на предел прочности (Breaking Point): забивание пула десятками тысяч одновременных транзакций, симуляция нехватки памяти (OOM), удержание консистентности при жестком обрыве. | `cargo test` + `k6` | ~10 тестов на выживание |

**Физическая Структура и Расположение:**
```text
tauri-surreal-kit/
└── backend/
    └── surreal_domain/
        ├── surreal_domain_core/src/lib.rs          ← логика 
        ├── surreal_domain_facade/src/lib.rs        ← логика 
        ├── surreal_domain_macros/src/lib.rs        ← макросы 
        │
        ├── tests/                                  ← [СОЗДАТЬ] интеграционные тесты
        │   ├── integration_crud.rs
        │   ├── integration_transactions.rs
        │   └── integration_graph_queries.rs
        │
        └── benches/                                ← [СОЗДАТЬ] нагрузочные бенчмарки
            ├── bulk_insert.rs
            ├── concurrent_reads.rs
            └── graph_traversal.rs
```

**Что тестирует каждый файл:**
| Тест-файл | Покрывает продакшен-файл |
|-----------|--------------------------|
| `integration_crud.rs` | `surreal_domain_facade/src/lib.rs` — CRUD операции |
| `integration_transactions.rs` | `surreal_domain_core/src/lib.rs` — транзакционная логика |
| `integration_graph_queries.rs` | `surreal_domain_facade/src/lib.rs` — граф-запросы |
| `bulk_insert.rs` (bench) | `surreal_domain_facade/src/lib.rs` — производительность вставки |
| `concurrent_reads.rs` (bench) | `surreal_domain_facade/src/lib.rs` — конкурентность |
| `graph_traversal.rs` (bench) | `surreal_domain_core/src/lib.rs` — производительность обхода |
| *Модульные*: `#[cfg(test)]` | `surreal_domain_macros/src/lib.rs` — генерация SurQL |

---

### 2.2. `src-tauri` (Основной Бекенд и AI)
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
