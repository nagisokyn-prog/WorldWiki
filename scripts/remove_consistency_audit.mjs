#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

/**
 * 1. Список удаляемых путей (папки и файлы)
 */
const PATHS_TO_DELETE = [
  'apps/spa/src/ts/features/analytics/ConsistencyChecker',
  'packages/resources/src/styles/features/analytics/ConsistencyChecker.css',
  'src-tauri/crates/worldwiki-application/src/analytics/consistency_audit',
  'src-tauri/crates/worldwiki-domain/src/analytics/consistency.rs',
];

function deletePath(relPath) {
  const fullPath = path.join(ROOT_DIR, relPath);
  if (fs.existsSync(fullPath)) {
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      fs.rmSync(fullPath, { recursive: true, force: true });
      console.log(`  🗑️  Удалена директория: ${relPath}`);
    } else {
      fs.rmSync(fullPath, { force: true });
      console.log(`  🗑️  Удален файл: ${relPath}`);
    }
    return true;
  } else {
    console.log(`  ⚪ Уже отсутствует: ${relPath}`);
    return false;
  }
}

function updateFile(relPath, transformFn) {
  const fullPath = path.join(ROOT_DIR, relPath);
  if (!fs.existsSync(fullPath)) {
    console.warn(`  ⚠️ Файл не найден: ${relPath}`);
    return;
  }
  const original = fs.readFileSync(fullPath, 'utf-8');
  const modified = transformFn(original);
  if (original !== modified) {
    fs.writeFileSync(fullPath, modified, 'utf-8');
    console.log(`  ✏️  Обновлен: ${relPath}`);
  } else {
    console.log(`  ⚪ Без изменений: ${relPath}`);
  }
}

function run() {
  console.log('\n======================================================================');
  console.log(' 🔥 УДАЛЕНИЕ ПОДСИСТЕМЫ "АУДИТ СЮЖЕТА" (CONSISTENCY AUDIT -> BACKLOG)');
  console.log('======================================================================\n');

  // --- ШАГ 1: Удаление физических файлов и папок ---
  console.log('📦 1. Удаление изолированных папок и модулей:');
  PATHS_TO_DELETE.forEach(deletePath);

  // --- ШАГ 2: Чистка EditorView.vue ---
  console.log('\n🎨 2. Отвязка таба в EditorView.vue:');
  updateFile('apps/spa/src/ts/features/shell/EditorView.vue', (content) => {
    // 1. Убираем таб кнопки
    content = content.replace(
      /\s*<div\s+class="panel-tab-new interactive-el"\s+:class="\{\s*active:\s*activePanelTab\s*===\s*'consistency'\s*\}"\s+@click\.stop="setActivePanelTab\('consistency'\)"\s*>\s*🛡️ Аудит Сюжета\s*<\/div>/g,
      ''
    );
    // 2. Убираем блок рендеринга <consistency-checker-vue ... />
    content = content.replace(
      /\s*<div\s+v-else-if="activePanelTab === 'consistency'"[^>]*>[\s\S]*?<consistency-checker-vue[\s\S]*?\/>\s*<\/div>/g,
      ''
    );
    return content;
  });

  // --- ШАГ 3: Чистка EditorView.vue.ts ---
  console.log('\n🧩 3. Отвязка импорта в EditorView.vue.ts:');
  updateFile('apps/spa/src/ts/features/shell/EditorView.vue.ts', (content) => {
    content = content.replace(/import ConsistencyCheckerVue from '@\/features\/analytics\/ConsistencyChecker\/ConsistencyChecker\.vue';\r?\n?/g, '');
    content = content.replace(/\s*ConsistencyCheckerVue,/g, '');
    return content;
  });

  // --- ШАГ 4: Чистка analytics.store.ts ---
  console.log('\n📦 4. Чистка Pinia store analytics.store.ts:');
  updateFile('apps/spa/src/ts/stores/analytics.store.ts', (content) => {
    // Убираем импорт auditManuscriptConsistency
    content = content.replace(/,\s*auditManuscriptConsistency\s*/g, ' ');
    content = content.replace(/auditManuscriptConsistency,\s*/g, '');

    // Убираем тип ConsistencyAuditReport
    content = content.replace(/export interface ConsistencyAuditReport\s*\{[\s\S]*?\}\r?\n?/g, '');

    // Убираем поля violations и auditReport
    content = content.replace(/\s*const auditReport = ref<ConsistencyAuditReport \| null>\(null\);/g, '');
    content = content.replace(/\s*const violations = ref<ConsistencyViolation\[\]>\(\[\]\);/g, '');

    // Убираем функцию loadConsistency
    content = content.replace(/\s*async function loadConsistency\([\s\S]*?\}\r?\n?\s*return true;\r?\n?\s*\}/g, '');
    // Или более общий шаблон функции loadConsistency
    content = content.replace(/\s*async function loadConsistency\([\s\S]*?\}\r?\n?\s*\}/g, '');

    // Убираем из возврата store
    content = content.replace(/\s*loadConsistency,/g, '');
    content = content.replace(/\s*auditReport,/g, '');
    content = content.replace(/\s*violations,/g, '');

    return content;
  });

  // --- ШАГ 5: Чистка api.client.ts ---
  console.log('\n🌐 5. Чистка api.client.ts:');
  updateFile('apps/spa/src/ts/services/api.client.ts', (content) => {
    content = content.replace(/\/\*\* Запуск аудита непротиворечивости лора и таймлайна \*\/[\s\S]*?return await invoke\('audit_manuscript_consistency', \{ projectId \}\);\r?\n?\s*\}/g, '');
    content = content.replace(/export async function auditManuscriptConsistency\([\s\S]*?\}\r?\n?/g, '');
    return content;
  });

  // --- ШАГ 6: Чистка Rust Domain Layer ---
  console.log('\n🦀 6. Чистка worldwiki-domain/src/analytics/mod.rs & lib.rs:');
  updateFile('src-tauri/crates/worldwiki-domain/src/analytics/mod.rs', (content) => {
    content = content.replace(/pub mod consistency;\r?\n?/g, '');
    content = content.replace(/pub use consistency::\*;\r?\n?/g, '');
    return content;
  });

  updateFile('src-tauri/crates/worldwiki-domain/src/lib.rs', (content) => {
    content = content.replace(/\s*use crate::analytics::\{ContradictionAnomaly, ContradictionRule, ContradictionSeverity\};/g, '');
    content = content.replace(/\s*let anomaly = ContradictionAnomaly\s*\{[\s\S]*?\};\s*assert_eq!\(anomaly\.severity, ContradictionSeverity::Critical\);/g, '');
    return content;
  });

  // --- ШАГ 7: Чистка Rust Application Layer ---
  console.log('\n⚙️ 7. Чистка worldwiki-application/src/analytics/mod.rs:');
  updateFile('src-tauri/crates/worldwiki-application/src/analytics/mod.rs', (content) => {
    content = content.replace(/pub mod consistency_audit;\r?\n?/g, '');
    content = content.replace(/pub use consistency_audit::ConsistencyAuditWorkflow;\r?\n?/g, '');
    return content;
  });

  // --- ШАГ 8: Чистка Rust Tauri State ---
  console.log('\n🏛️ 8. Чистка worldwiki-tauri/src/state.rs:');
  updateFile('src-tauri/crates/worldwiki-tauri/src/state.rs', (content) => {
    content = content.replace(/ConsistencyAuditWorkflow,\s*/g, '');
    content = content.replace(/,\s*ConsistencyAuditWorkflow/g, '');
    content = content.replace(/\s*pub consistency_workflow: Arc<ConsistencyAuditWorkflow>,/g, '');
    return content;
  });

  // --- ШАГ 9: Чистка Rust Tauri Commands (analytics.rs & lib.rs) ---
  console.log('\n🔌 9. Чистка worldwiki-tauri/src/commands/analytics.rs & lib.rs:');
  updateFile('src-tauri/crates/worldwiki-tauri/src/commands/analytics.rs', (content) => {
    content = content.replace(/ConsistencyAuditReportDto,\s*/g, '');
    content = content.replace(/,\s*ConsistencyAuditReportDto/g, '');
    content = content.replace(/bridge_command!\(\s*audit_manuscript_consistency[\s\S]*?\);\r?\n?/g, '');
    return content;
  });

  updateFile('src-tauri/src/lib.rs', (content) => {
    content = content.replace(/\s*worldwiki_tauri::commands::audit_manuscript_consistency,/g, '');
    return content;
  });

  // --- ШАГ 10: Чистка Bootstrap Composition Root (services.rs) ---
  console.log('\n🏗️ 10. Чистка src-tauri/src/bootstrap/services.rs:');
  updateFile('src-tauri/src/bootstrap/services.rs', (content) => {
    content = content.replace(/ConsistencyAuditWorkflow,\s*/g, '');
    content = content.replace(/,\s*ConsistencyAuditWorkflow/g, '');
    content = content.replace(/,\s*SurrealTimelineRepository/g, '');
    content = content.replace(/,\s*TimelineEventRepository/g, '');
    content = content.replace(/\s*timeline:\s*Arc<dyn\s+TimelineEventRepository>,/g, '');
    content = content.replace(/\s*timeline:\s*Arc::new\(SurrealTimelineRepository::new\(Arc::clone\(db\)\)\),/g, '');
    content = content.replace(/\s*consistency_workflow: Arc<ConsistencyAuditWorkflow>,/g, '');
    content = content.replace(/\s*let consistency_workflow = Arc::new\(ConsistencyAuditWorkflow::new\([\s\S]*?\)\);/g, '');
    content = content.replace(/\s*consistency_workflow,/g, '');
    content = content.replace(/\s*consistency_workflow: core\.consistency_workflow,/g, '');
    content = content.replace(/\s*consistency_workflow: core\./g, '');
    content = content.replace(/\s*consistency_workflow: core,/g, '');
    return content;
  });

  // --- ШАГ 11: Чистка интеграционных тестов в Rust ---
  console.log('\n🧪 11. Отключение устаревших тестов аудита в manuscript_tracking_integration.rs:');
  updateFile('src-tauri/src/tests/manuscript_tracking_integration.rs', (content) => {
    // Удаляем test_manuscript_consistency_audit_rules
    content = content.replace(
      /\/\/\/\s*ТЕСТ 5:[\s\S]*?async fn test_manuscript_consistency_audit_rules\(\)[\s\S]*?\r?\n\}\r?\n/g,
      ''
    );
    // Удаляем test_consistency_audit_clean_and_edge_cases
    content = content.replace(
      /\/\/\/\s*ТЕСТ 13:[\s\S]*?async fn test_consistency_audit_clean_and_edge_cases\(\)[\s\S]*?\r?\n\}\r?\n/g,
      ''
    );
    return content;
  });

  console.log('\n======================================================================');
  console.log('✅ ВЫРЕЗАНИЕ ЗАВЕРШЕНО УСПЕШНО!');
  console.log('• "Аудит сюжета" полностью исключен из билда и рантайма.');
  console.log('• Изменения в character.json (динамическая линия статуса) СОХРАНЕНЫ.');
  console.log('======================================================================\n');
}

run();
