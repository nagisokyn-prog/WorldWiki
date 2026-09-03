# 🦀 ПРАВИЛО 03: АРХИТЕКТУРА БЭКЕНДА (RUST HEXAGONAL & MODULAR MONOLITH)

> **ОБЛАСТЬ ДЕЙСТВИЯ**: `src-tauri/` (все Rust-крейты).
> **СТАТУС**: КРИТИЧЕСКИЙ (Инварианты ARCH-001 .. ARCH-012).

---

## 1. Каркас Модульного Монолита (Cargo Workspace Crates)

Бэкенд физически изолирован через крейты Cargo Workspace:

```
src-tauri/crates/
├── worldwiki-domain/          # 🧠 [Чистый Домен]: Сущности, Value Objects, DomainError
├── worldwiki-ports/           # 🔌 [Интерфейсы]: Трейты репозиториев, AI, FS, Events
├── worldwiki-application/     # ⚙️ [Use Cases & CQRS]: Сценарии, JobManager, транзакции
├── worldwiki-infrastructure/  # 🧱 [Адаптеры БД/AI/FS]: SurrealDB, llama.cpp, OpenXML DOCX
└── worldwiki-tauri/           # 🚪 [Driving Adapter]: IPC commands, bridge_macro!, State
```

---

## 2. Кодекс Архитектурных Инвариантов (ARCH Rules)

| Код | Инвариант | Уровень контроля |
|---|---|---|
| **ARCH-001** | `worldwiki-domain` не содержит внешних SDK (`tauri`, `surrealdb`, `reqwest`, `tokio`). | **Компилятор Rust (Cargo)** |
| **ARCH-002** | `worldwiki-application` зависит только от `domain` и `ports` (никакого `tauri`). | **Компилятор Rust (Cargo)** |
| **ARCH-003** | `worldwiki-ports` содержит только трейты и абстракции портов. | **Компилятор Rust (Cargo)** |
| **ARCH-004** | `worldwiki-infrastructure` реализует трейты портов, не определяя бизнес-правил. | **Компилятор Rust (Cargo)** |
| **ARCH-005** | `worldwiki-tauri` — **ЕДИНСТВЕННЫЙ** крейт, которому разрешено зависеть от `tauri`. | **Компилятор Rust (Cargo)** |
| **ARCH-006** | Доменные события диспатчатся только через `EventPublisherPort` / `TransactionalOutbox`. | **Linter & Code Review** |
| **ARCH-007** | Никакие типы `tauri::*` (`State`, `AppHandle`, `Window`) не проникают в `application` или `domain`. | **Компилятор Rust (Cargo)** |
| **ARCH-008** | Конкретные типы БД (`Surreal<Db>`) не появляются в публичных сигнатурах Use Cases. | **Компилятор Rust (Cargo)** |
| **ARCH-009** | Границы модулей Bounded Contexts изолированы: межмодульное общение только через публичные DTO. | **Rust Visibility (`pub(crate)`)** |
| **ARCH-010** | Все тяжелые асинхронные задачи (AI, Export, Embeddings) обязаны принимать `CancellationToken`. | **Code Review & Tests** |
| **ARCH-011** | Мутирующие Use Cases обязаны быть идемпотентными по `operation_id`. | **Integration Tests** |
| **ARCH-012** | AI-инструменты имеют доступ к системе **СТРОГО** через Application Use Cases. | **Code Review** |

---

## 3. CQRS-Lite и Транзакции

1. **Commands vs Queries**:
   * Commands мутируют состояние, открывают UnitOfWork / транзакцию и генерируют доменные события.
   * Queries возвращают оптимизированные Read DTO без сайд-эффектов.
2. **Application-Owned Transactions**:
   * Транзакцией владеет Use Case, а не отдельный вызов `repository.save()`.
3. **Transactional Outbox**:
   * События для UI сохраняются в транзакции и отправляются во фронтенд только после успешного коммита.

---

## 4. Иерархия Ошибок

Запрещено «мусорное ведро» `DomainError::Internal(String)`. Ошибки строго типизированы:
$$\text{InfrastructureError} \xrightarrow{\text{map\_err}} \text{ApplicationError} \xleftarrow{\text{From}} \text{DomainError} \xrightarrow{\text{Into}} \text{IpcError}$$
