# 📊 АРХИТЕКТУРНЫЙ АУДИТ БЕЙЗЛАЙНА (cerberus-baseline.json)

> **Дата генерации**: 2026-10-05 19:40:25 UTC  
> **Всего зафиксировано нарушений**: `115`  

---

## 1. 📈 Сводка по правилам

| Правило | Описание / Категория | Количество | Доля от общего долга |
| :--- | :--- | :---: | :---: |
| **`SURQL-017`** | SurrealDB / Rust Engine Invariant | `47` | **40.9%** |
| **`SEC-011`** | SurrealDB / Rust Engine Invariant | `30` | **26.1%** |
| **`SURQL-012`** | SurrealDB / Rust Engine Invariant | `17` | **14.8%** |
| **`SURQL-011`** | SurrealDB / Rust Engine Invariant | `6` | **5.2%** |
| **`SURQL-002`** | SurrealDB / Rust Engine Invariant | `4` | **3.5%** |
| **`SURQL-015`** | SurrealDB / Rust Engine Invariant | `4` | **3.5%** |
| **`SURQL-025`** | SurrealDB / Rust Engine Invariant | `3` | **2.6%** |
| **`SURQL-018`** | SurrealDB / Rust Engine Invariant | `2` | **1.7%** |
| **`SURQL-019`** | SurrealDB / Rust Engine Invariant | `2` | **1.7%** |

---

## 2. 📁 Распределение по подсистемам и модулям

| Модуль / Подсистема | Количество нарушений | Процент |
| :--- | :---: | :---: |
| `logic/schema/ai` (AI Space) | `38` | **33.0%** |
| `logic/schema/no_ai` (Core Base) | `37` | **32.2%** |
| `worldwiki-infrastructure` (Rust DB Adapters) | `34` | **29.6%** |
| `tauri-surreal-kit` | `5` | **4.3%** |
| `src-tauri` (Desktop Shell) | `1` | **0.9%** |

---

## 3. 📄 Топ-20 файлов с наибольшей концентрацией нарушений

| Файл | Нарушений | Доминирующие правила |
| :--- | :---: | :--- |
| `./apps/spa/src/logic/schema/no_ai/01_tables.surql` | `33` | `SURQL-011, SURQL-012, SURQL-017` |
| `./apps/spa/src/logic/schema/ai/01_workspace_tables.surql` | `21` | `SURQL-011, SURQL-012, SURQL-017` |
| `./apps/spa/src/logic/schema/ai/02_web_research_tables.surql` | `12` | `SURQL-012, SURQL-017` |
| `./src-tauri/crates/worldwiki-infrastructure/src/ai/retrieval/router/hybrid_search.rs` | `5` | `SEC-011` |
| `./src-tauri/crates/worldwiki-infrastructure/src/surrealdb/chat_repo.rs` | `5` | `SURQL-002, SURQL-015, SURQL-018` |
| `./src-tauri/crates/worldwiki-infrastructure/src/ai/retrieval/indexer.rs` | `4` | `SEC-011` |
| `./src-tauri/crates/worldwiki-infrastructure/src/surrealdb/repos/rag_repo/fallback_search.rs` | `4` | `SEC-011` |
| `./apps/spa/src/logic/schema/ai/03_embeddings_hnsw.surql` | `4` | `SURQL-011, SURQL-017` |
| `./apps/spa/src/logic/schema/no_ai/04_functions.surql` | `4` | `SURQL-019, SURQL-025` |
| `./src-tauri/crates/worldwiki-infrastructure/src/surrealdb/repos/entity_repo.rs` | `3` | `SEC-011` |
| `./src-tauri/crates/worldwiki-infrastructure/src/surrealdb/chat_branching.rs` | `3` | `SURQL-015` |
| `./src-tauri/crates/worldwiki-infrastructure/src/ai/retrieval/router/exact_search.rs` | `2` | `SEC-011` |
| `./tauri-surreal-kit/backend/surreal_domain/surreal_domain_core/src/read_ops.rs` | `2` | `SEC-011` |
| `./tauri-surreal-kit/backend/surreal_domain/surreal_domain_core/src/write_ops.rs` | `2` | `SEC-011` |
| `./src-tauri/crates/worldwiki-infrastructure/src/storage/backup/cloud.rs` | `1` | `SEC-011` |
| `./src-tauri/crates/worldwiki-infrastructure/src/surrealdb/repos/chapter_repo.rs` | `1` | `SEC-011` |
| `./src-tauri/crates/worldwiki-infrastructure/src/surrealdb/repos/rag_repo/exact_chapter.rs` | `1` | `SEC-011` |
| `./src-tauri/crates/worldwiki-infrastructure/src/surrealdb/repos/story_arc_repo.rs` | `1` | `SEC-011` |
| `./src-tauri/crates/worldwiki-infrastructure/src/surrealdb/repos/timeline_repo.rs` | `1` | `SEC-011` |
| `./src-tauri/crates/worldwiki-infrastructure/src/surrealdb/repos/volume_repo.rs` | `1` | `SEC-011` |

---

## 4. 🛠️ Рекомендации по приоритизации рефакторинга

1. **Кластер Rust Inline Запросов (`SURQL-015` / `SURQL-008`)**:
   - Проверить методы в `src-tauri/crates/worldwiki-infrastructure/src/surrealdb/` на массовые мутации `UPDATE`/`DELETE` без условий `WHERE`.
2. **Кластер DDL Schemas (`logic/schema/`)**:
   - Проверить явную типизацию полей и наличие индексов для внешних ключей.
