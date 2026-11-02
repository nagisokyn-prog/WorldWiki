# 🗺️ План вырезания подсистемы «Аудит сюжета» (Consistency Audit) в бэклог

> Данный отчет сгенерирован скриптом `scripts/audit_cleanup_map.mjs`.
> Показывает полный реестр файлов, модулей и строк кода от БД до фронтенда, подлежащих удалению/чистке.

## ❌ 1. Файлы и папки для полного удаления

- **`apps/spa/src/ts/features/analytics/ConsistencyChecker`** — ✅ Существует на диске
- **`packages/resources/src/styles/features/analytics/ConsistencyChecker.css`** — ✅ Существует на диске
- **`src-tauri/crates/worldwiki-application/src/analytics/consistency_audit`** — ✅ Существует на диске
- **`src-tauri/crates/worldwiki-domain/src/analytics/consistency.rs`** — ✅ Существует на диске

## ✂️ 2. Файлы для точечной модификации (вырезание ссылок и вызовов)

### 📄 `apps/spa/src/ts/features/shell/EditorView.vue`
- **Описание задачи**: Таб боковой панели "Инспектор Противоречий" (activePanelTab === "consistency") и импорт ConsistencyChecker.vue
- **Строки для удаления/чистки**:
  - Строка 275: `:class="{ active: activePanelTab === 'consistency' }"`
  - Строка 276: `@click.stop="setActivePanelTab('consistency')"`
  - Строка 331: `<div v-else-if="activePanelTab === 'consistency'" class="flex-1 flex flex-col min-h-0 h-full overflow-hidden">`
  - Строка 332: `<consistency-checker-vue`
### 📄 `apps/spa/src/ts/stores/analytics.store.ts`
- **Описание задачи**: Поля auditReport, violations и метод loadConsistency()
- **Строки для удаления/чистки**:
  - Строка 5: `auditManuscriptConsistency,`
  - Строка 69: `export interface ConsistencyAuditReport {`
  - Строка 151: `const auditReport = ref<ConsistencyAuditReport | null>(null);`
  - Строка 152: `const violations = ref<ConsistencyViolation[]>([]);`
  - Строка 182: `async function loadConsistency(project: string): Promise<ConsistencyAuditReport | null> {`
  - Строка 185: `const raw = await auditManuscriptConsistency(project);`
  - Строка 186: `const data = raw as unknown as (ConsistencyAuditReport | ConsistencyViolation[]);`
  - Строка 187: `if (data && 'anomalies' in data && Array.isArray((data as ConsistencyAuditReport).anomalies)) {`
  - Строка 188: `const report = data as ConsistencyAuditReport;`
  - Строка 189: `auditReport.value = report;`
  - *(и еще 13 строк)*
### 📄 `apps/spa/src/ts/services/api.client.ts`
- **Описание задачи**: Методы auditManuscriptConsistency и auditVolumeConsistency
- **Строки для удаления/чистки**:
  - Строка 548: `return await invoke('audit_volume_consistency', { volumeId });`
  - Строка 595: `export async function auditManuscriptConsistency(projectId: string): Promise<unknown> {`
  - Строка 596: `return await invoke('audit_manuscript_consistency', { projectId });`
### 📄 `src-tauri/crates/worldwiki-tauri/src/commands/analytics.rs`
- **Описание задачи**: IPC команда audit_manuscript_consistency
- **Строки для удаления/чистки**:
  - Строка 3: `CharacterJourneyDto, ConsistencyAuditReportDto, CrossRefMatrixDto,`
  - Строка 16: `audit_manuscript_consistency(project_id: String) -> Result<ConsistencyAuditReportDto, IpcError>`
### 📄 `src-tauri/src/lib.rs`
- **Описание задачи**: Регистрация команды worldwiki_tauri::commands::audit_manuscript_consistency в generate_handler
- **Строки для удаления/чистки**:
  - Строка 178: `worldwiki_tauri::commands::audit_manuscript_consistency,`
### 📄 `src-tauri/crates/worldwiki-application/src/analytics/mod.rs`
- **Описание задачи**: Экспорт модуля consistency_audit
- **Строки для удаления/чистки**:
  - Строка 2: `pub mod consistency_audit;`
  - Строка 9: `pub use consistency_audit::ConsistencyAuditWorkflow;`
### 📄 `src-tauri/crates/worldwiki-application/src/bootstrap.rs`
- **Описание задачи**: Поле consistency_workflow в AppServices / ServicesBuilder
- **Строки для удаления/чистки**:
  - *(Вхождений не найдено — модуль уже отвязан)*
### 📄 `src-tauri/crates/worldwiki-domain/src/analytics/mod.rs`
- **Описание задачи**: Экспорт модуля consistency и его DTO типов
- **Строки для удаления/чистки**:
  - Строка 1: `pub mod consistency;`
  - Строка 7: `pub use consistency::*;`
### 📄 `src-tauri/src/tests/manuscript_tracking_integration.rs`
- **Описание задачи**: Интеграционные тесты аудита: test_manuscript_consistency_audit_rules и test_consistency_audit_clean_and_edge_cases
- **Строки для удаления/чистки**:
  - Строка 700: `async fn test_manuscript_consistency_audit_rules() {`
  - Строка 1141: `async fn test_consistency_audit_clean_and_edge_cases() {`

## 🔎 3. Дополнительные файлы и документация

- `apps/spa/src/ts/features/analytics/ChekhovGunTracker/ChekhovGunTracker.spec.ts` (1 совпадений: auditManuscriptConsistency)
- `apps/spa/src/ts/features/analytics/CrossReferenceMatrix/CrossReferenceMatrix.spec.ts` (1 совпадений: auditManuscriptConsistency)
- `apps/spa/src/ts/features/shell/EditorView.vue.ts` (2 совпадений: ConsistencyChecker)
- `apps/spa/src/ts/services/api/api.chapters.ts` (2 совпадений: auditVolumeConsistency, audit_volume_consistency)
- `apps/spa/src/ts/services/api/plot_calendar.ts` (2 совпадений: auditVolumeConsistency, audit_volume_consistency)
- `src-tauri/crates/worldwiki-domain/src/lib.rs` (5 совпадений: ContradictionAnomaly, ContradictionRule, ContradictionSeverity)
- `src-tauri/crates/worldwiki-tauri/src/commands/plot.rs` (1 совпадений: audit_volume_consistency)
- `src-tauri/crates/worldwiki-tauri/src/state.rs` (2 совпадений: ConsistencyAuditWorkflow)
- `src-tauri/src/bootstrap/services.rs` (5 совпадений: ConsistencyAuditWorkflow, consistency_workflow)

## 🚀 Рекомендуемый порядок действий для удаления

1. **Frontend**:
   - Удалить директорию `apps/spa/src/ts/features/analytics/ConsistencyChecker/`.
   - Удалить CSS: `packages/resources/src/styles/features/analytics/ConsistencyChecker.css`.
   - В `EditorView.vue` убрать таб `activePanelTab === 'consistency'` и компонент `<consistency-checker-vue>`.
   - В `analytics.store.ts` убрать `violations`, `auditReport` и `loadConsistency()`.
   - В `api.client.ts` убрать `auditManuscriptConsistency` и `auditVolumeConsistency`.

2. **Backend**:
   - В `src-tauri/crates/worldwiki-tauri/src/commands/analytics.rs` удалить команду `audit_manuscript_consistency`.
   - В `src-tauri/src/lib.rs` удалить регистрацию команды из `generate_handler!`.
   - Удалить директорию `src-tauri/crates/worldwiki-application/src/analytics/consistency_audit/`.
   - В `worldwiki-application/src/analytics/mod.rs` убрать `pub mod consistency_audit;`.
   - В `worldwiki-application/src/bootstrap.rs` убрать `consistency_workflow` из `AppServices`.
   - Удалить файл `src-tauri/crates/worldwiki-domain/src/analytics/consistency.rs`.
   - В `worldwiki-domain/src/analytics/mod.rs` убрать `pub mod consistency;`.
   - В `manuscript_tracking_integration.rs` удалить/закомментировать устаревшие тесты аудита противоречий.

3. **Схема персонажа**:
   - Изменения в `apps/spa/public/struct/editor/character.json` **оставляются на 100%**: гибкая динамическая хронология статуса (`characterStatusTimeline`) с опциональной привязкой к главам и календарю.
