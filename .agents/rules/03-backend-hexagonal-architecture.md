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

## 2. Архитектурные Инварианты (ARCH Rules)
 
Все архитектурные границы слоёв (`ARCH-001..ARCH-012`, `CQRS-001`, `MOD-001`, `EVT-001`) принудительно проверяются компилятором Rust и **Cerberus Architectural Firewall** (`cargo cerberus check`).

Для просмотра карточки конкретного правила с примерами хорошего/плохого кода и рецептами ремедиации:
```bash
cargo cerberus rule explain ARCH-001
cargo cerberus rule explain ARCH-002
cargo cerberus rule explain ARCH-005
```

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
