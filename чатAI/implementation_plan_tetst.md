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

**Следующий шаг:** Создать `src-tauri/src/tests/common.rs` + добавить `#[cfg(test)]` в `chapters.rs` с тестами таймлайна. Это даст тебе:
- Реальную БД в памяти на каждый тест
- Авто-очистку после теста
- Проверку что `get_global_timeline` возвращает именно то, что лежит в БД

---

*Обновлено: 2025-08-16 — аудит реального состояния репозитория*
