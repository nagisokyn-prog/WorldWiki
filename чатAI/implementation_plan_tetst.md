# Глобальная Стратегия Тестирования: WorldWiki

Данный план описывает архитектуру и процессы тестирования бизнес-логики (backend, state management, utilities) с целью достижения **85% покрытия кода (Code Coverage)**. Мы строго фокусируемся на проверке данных и логики, полностью игнорируя визуальное тестирование UI-интерфейсов (кнопок, верстки и стилей).

---

## 1. Виды Тестирования и их Применение

### 1.1 Модульные тесты (Unit Testing)
Изолированная проверка отдельных функций, структур данных, алгоритмов и методов.
- **Где**: `tauri-surreal-kit` (ORMs, макросы), `src-tauri` (AI промпты, файловые операции, математика дат), `apps/spa/src/logic`, `packages`.
- **Как (Rust)**: Встроенный `#[cfg(test)]` и модули `mod tests`.
- **Как (TS)**: `vitest` для чистых функций и стейт-менеджмента без монтирования Vue компонентов.

### 1.2 Интеграционные тесты (Integration Testing)
Проверка взаимодействия между несколькими модулями (Rust <-> SurrealDB, транзакции, графы).
- **Где**: `src-tauri` (коммуникация с БД, Tauri IPC Commands), `tauri-surreal-kit` (выполнение реальных SurQL запросов).
- **Как (Rust)**: Интеграционные тесты в папке `src/tests/` на уровне крейта, использующие in-memory БД (`common::create_test_db`).

### 1.3 Контрактные тесты (Contract Testing)
Проверка того, что схемы данных и форматы API, ожидаемые фронтендом, совпадают с тем, что отдает бекенд.
- **Где**: Граница между `src-tauri` (Rust struct -> JSON / ts-rs) и `apps/spa` (TS Types -> Zod/JSON).

### 1.4 Нагрузочное тестирование (Load Testing)
Проверка производительности логики под ожидаемой высокой нагрузкой.
- **Где**: `src-tauri` и `tauri-surreal-kit`.
- **Что проверено**:
  - Bulk-insert 10,000 сущностей транзакционными батчами (~460 записей/сек на embedded KV).
  - Bulk-insert 3,000 семантических текстовых блоков главы.
  - Построение графов иерархии из 530+ узлов через ребра `contains`.

### 1.5 Стресс-тестирование (Stress Testing)
Поведение системы в экстремальных условиях.
- **Что проверено**:
  - Высококонкурентный пул (50 параллельных `tokio`-воркеров на одновременное чтение/запись графа связей `entity_rel`) — 0 дедлоков, 0 сбоев транзакций.
  - Каскадное DDL-удаление проекта с 1,500+ записями под нагрузкой.

---

## 2. Реальное состояние тестов (АУДИТ — 96 тестов)

### 2.1. `src-tauri` (Rust Backend — Tauri + SurrealDB)

| Файл | Что покрывает | Тип | Статус / К-во |
|------|---------------|-----|---------------|
| `src/tests/common.rs` | Инфраструктура: in-memory SurrealDB + схема `surreal_schema.surql` + сидинг | Инфраструктура | ✅ **ГОТОВО** |
| `src/tests/timeline_integration.rs` | Таймлайн в SurrealDB: `in_memory_db_ready`, скоупы, каскады, roundtrip `save_global_timeline` | Integration | ✅ **6 тестов** |
| `src/tests/hierarchy_integration.rs` | Иерархия сюжета: `create_volume`, `create_arc`, `assign_chapter`, `get_chapter_hierarchy`, `reorder_node` | Integration | ✅ **7 тестов** |
| `src/tests/entity_integration.rs` | Сущности, схемы и связи: `save_entity` (CREATE/UPSERT), `get_entities`, `entity_rel`, снапшоты в `schema_history` | Integration | ✅ **6 тестов** |
| `src/tests/text_blocks_integration.rs` | Текстовые блоки и семантика: нарезка HTML по `<p data-semantic-tag>`, маппинг тегов `desc`/`dialog`, ACID | Integration | ✅ **3 теста** |
| `src/tests/project_integration.rs` | Жизненный цикл проекта: создание, сохранение `data`, каскадное DDL-удаление через `delete_project_data` | Integration | ✅ **3 теста** |
| `src/tests/ai_integration.rs` | AI-агент и инструменты (`WorldWikiTools`): `build_system_prompt`, `history_to_input_messages`, `search_entities`, `get_entity`, `get_chapters_list`, `get_chapter`, `create_entity`, `create_relation`, `rag_search` | Integration | ✅ **7 тестов** |
| `src/tests/stress_integration.rs` | Нагрузка и стресс: Bulk 10k entities, Bulk 3k text blocks, 50 конкурентных воркеров, Deep graph 530 nodes, Massive DDL cascade | Load & Stress | ✅ **5 тестов** |
| `src/logic/calendar_math.rs` | Математика дат, високосные года, абсолютные минуты, високосные секунды, эры (BC) | Unit | ✅ **12 тестов** |
| `src/logic/entities.rs` | Хелперы нормализации ID: `safe_id`, `flatten_thing` | Unit | ✅ **6 тестов** |
| `src/logic/batch.rs` | Хелперы пакетных операций: `safe_id`, `flatten_thing` | Unit | ✅ **5 тестов** |
| `src/logic/models.rs` | Экспорт TypeScript типов через `ts-rs` (`export_bindings`) | Contract | ✅ **1 тест** |
| Прочие юнит-тесты модулей | Парсеры, сериализация и внутренние хелперы | Unit | ✅ **35 тестов** |

---

## 3. Сводная таблица покрытия Rust Backend

| Направление | Статус | Пройдено тестов |
|-------------|--------|-----------------|
| **🔴 P0: База данных & Иерархия** | ✅ Полностью завершено | 13 тестов |
| **🔴 P0: Сущности & Граф связей** | ✅ Полностью завершено | 17 тестов |
| **🟡 P1: Текстовые блоки & Проекты** | ✅ Полностью завершено | 6 тестов |
| **🟢 P2: AI-агент & Инструменты** | ✅ Полностью завершено | 7 тестов |
| **🔥 Load & Stress: Нагрузка и стресс** | ✅ Полностью завершено | 5 тестов |
| **📐 Юнит-логика & Математика дат** | ✅ Полностью завершено | 48 тестов |
| **ИТОГО В RUST BACKEND** | 🚀 **100% УСПЕХ** | **96 тестов** |

---

*Обновлено: 2026-08-16 — AI-логика, Load Testing и Stress Testing полностью реализованы и подтверждены на реальной БД.*
