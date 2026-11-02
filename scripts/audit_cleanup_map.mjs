#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

/**
 * Ключевые маркеры и сущности подсистемы "Аудит сюжета / Consistency Audit"
 */
const TARGET_PATTERNS = [
  'ConsistencyChecker',
  'ConsistencyAuditWorkflow',
  'audit_manuscript_consistency',
  'auditManuscriptConsistency',
  'audit_volume_consistency',
  'auditVolumeConsistency',
  'consistency_workflow',
  'ContradictionAnomaly',
  'ContradictionRule',
  'ContradictionSeverity',
  'ConsistencyAuditReport',
  'ConsistencyViolation',
  'test_manuscript_consistency_audit_rules',
  'test_consistency_audit_clean_and_edge_cases',
];

/**
 * Файлы и папки, которые подлежат полному удалению
 */
const FULL_DELETE_TARGETS = [
  'apps/spa/src/ts/features/analytics/ConsistencyChecker',
  'packages/resources/src/styles/features/analytics/ConsistencyChecker.css',
  'src-tauri/crates/worldwiki-application/src/analytics/consistency_audit',
  'src-tauri/crates/worldwiki-domain/src/analytics/consistency.rs',
];

/**
 * Файлы, в которых нужно вырезать интеграцию (точечные правки)
 */
const PARTIAL_EDIT_TARGETS = [
  {
    file: 'apps/spa/src/ts/features/shell/EditorView.vue',
    desc: 'Таб боковой панели "Инспектор Противоречий" (activePanelTab === "consistency") и импорт ConsistencyChecker.vue',
    search: ['consistency', 'ConsistencyChecker'],
  },
  {
    file: 'apps/spa/src/ts/stores/analytics.store.ts',
    desc: 'Поля auditReport, violations и метод loadConsistency()',
    search: ['auditManuscriptConsistency', 'loadConsistency', 'violations', 'auditReport', 'ConsistencyAuditReport'],
  },
  {
    file: 'apps/spa/src/ts/services/api.client.ts',
    desc: 'Методы auditManuscriptConsistency и auditVolumeConsistency',
    search: ['auditManuscriptConsistency', 'audit_manuscript_consistency', 'audit_volume_consistency'],
  },
  {
    file: 'src-tauri/crates/worldwiki-tauri/src/commands/analytics.rs',
    desc: 'IPC команда audit_manuscript_consistency',
    search: ['audit_manuscript_consistency', 'ConsistencyAuditReportDto'],
  },
  {
    file: 'src-tauri/src/lib.rs',
    desc: 'Регистрация команды worldwiki_tauri::commands::audit_manuscript_consistency в generate_handler',
    search: ['audit_manuscript_consistency'],
  },
  {
    file: 'src-tauri/crates/worldwiki-application/src/analytics/mod.rs',
    desc: 'Экспорт модуля consistency_audit',
    search: ['consistency_audit', 'ConsistencyAuditWorkflow'],
  },
  {
    file: 'src-tauri/crates/worldwiki-application/src/bootstrap.rs',
    desc: 'Поле consistency_workflow в AppServices / ServicesBuilder',
    search: ['consistency_workflow', 'ConsistencyAuditWorkflow'],
  },
  {
    file: 'src-tauri/crates/worldwiki-domain/src/analytics/mod.rs',
    desc: 'Экспорт модуля consistency и его DTO типов',
    search: ['consistency', 'ContradictionAnomaly', 'ContradictionRule', 'ConsistencyAuditReportDto'],
  },
  {
    file: 'src-tauri/src/tests/manuscript_tracking_integration.rs',
    desc: 'Интеграционные тесты аудита: test_manuscript_consistency_audit_rules и test_consistency_audit_clean_and_edge_cases',
    search: ['test_manuscript_consistency_audit_rules', 'test_consistency_audit_clean_and_edge_cases'],
  },
];

function fileExists(relPath) {
  const fullPath = path.join(ROOT_DIR, relPath);
  return fs.existsSync(fullPath);
}

function findMatchesInFile(relPath, patterns) {
  const fullPath = path.join(ROOT_DIR, relPath);
  if (!fs.existsSync(fullPath)) return [];
  const stat = fs.statSync(fullPath);
  if (stat.isDirectory()) return [];

  const content = fs.readFileSync(fullPath, 'utf-8');
  const lines = content.split('\n');
  const matches = [];

  lines.forEach((line, idx) => {
    for (const pat of patterns) {
      if (line.includes(pat)) {
        matches.push({
          lineNum: idx + 1,
          pattern: pat,
          text: line.trim(),
        });
        break;
      }
    }
  });

  return matches;
}

function scanDirectoryRecursively(dirRel, patternList, foundMap) {
  const fullDir = path.join(ROOT_DIR, dirRel);
  if (!fs.existsSync(fullDir)) return;

  const entries = fs.readdirSync(fullDir, { withFileTypes: true });
  for (const entry of entries) {
    const relSub = path.join(dirRel, entry.name).replace(/\\/g, '/');
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === 'target' || entry.name === '.git' || entry.name === 'dist') {
        continue;
      }
      scanDirectoryRecursively(relSub, patternList, foundMap);
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name);
      if (['.ts', '.vue', '.rs', '.surql', '.json', '.css', '.md'].includes(ext)) {
        const matches = findMatchesInFile(relSub, patternList);
        if (matches.length > 0) {
          foundMap.set(relSub, matches);
        }
      }
    }
  }
}

function main() {
  console.log('\n======================================================================');
  console.log(' 🗺️  КАРТА ЗАВИСИМОСТЕЙ И ПЛАН ВЫРЕЗАНИЯ "АУДИТА СЮЖЕТА" (BACKLOG PLAN)');
  console.log('======================================================================\n');

  console.log('🔍 Сканирование репозитория на наличие следов Consistency Audit...\n');

  const scannedMap = new Map();
  scanDirectoryRecursively('apps/spa/src', TARGET_PATTERNS, scannedMap);
  scanDirectoryRecursively('packages/resources/src', TARGET_PATTERNS, scannedMap);
  scanDirectoryRecursively('src-tauri', TARGET_PATTERNS, scannedMap);
  scanDirectoryRecursively('apps/spa/src/logic/schema', TARGET_PATTERNS, scannedMap);

  let outputMd = '# 🗺️ План вырезания подсистемы «Аудит сюжета» (Consistency Audit) в бэклог\n\n';
  outputMd += '> Данный отчет сгенерирован скриптом `scripts/audit_cleanup_map.mjs`.\n';
  outputMd += '> Показывает полный реестр файлов, модулей и строк кода от БД до фронтенда, подлежащих удалению/чистке.\n\n';

  // 1. Полное удаление директорий и файлов
  console.log('❌ 1. ФАЙЛЫ И МОДУЛИ ПОД ПОЛНОЕ УДАЛЕНИЕ:');
  outputMd += '## ❌ 1. Файлы и папки для полного удаления\n\n';

  FULL_DELETE_TARGETS.forEach((target) => {
    const exists = fileExists(target);
    const status = exists ? '✅ Существует на диске' : '⚠️ Уже удален / не найден';
    console.log(`  • [DEL] ${target} (${status})`);
    outputMd += `- **\`${target}\`** — ${status}\n`;
  });

  // 2. Модули для точечной модификации
  console.log('\n✂️  2. ФАЙЛЫ ДЛЯ ТОЧЕЧНОЙ МОДИФИКАЦИИ (ВЫРЕЗАНИЕ ИМПОРТОВ И ССЫЛОК):');
  outputMd += '\n## ✂️ 2. Файлы для точечной модификации (вырезание ссылок и вызовов)\n\n';

  PARTIAL_EDIT_TARGETS.forEach((target) => {
    const matches = findMatchesInFile(target.file, target.search);
    console.log(`\n  📄 ${target.file}`);
    console.log(`     Назначение: ${target.desc}`);
    console.log(`     Найдено вхождений: ${matches.length}`);
    outputMd += `### 📄 \`${target.file}\`\n`;
    outputMd += `- **Описание задачи**: ${target.desc}\n`;
    outputMd += `- **Строки для удаления/чистки**:\n`;

    if (matches.length > 0) {
      matches.slice(0, 10).forEach((m) => {
        console.log(`       [L${m.lineNum}]: ${m.text.substring(0, 80)}`);
        outputMd += `  - Строка ${m.lineNum}: \`${m.text.replace(/`/g, "'")}\`\n`;
      });
      if (matches.length > 10) {
        console.log(`       ... и еще ${matches.length - 10} вхождений`);
        outputMd += `  - *(и еще ${matches.length - 10} строк)*\n`;
      }
    } else {
      console.log('       (Вхождений не найдено — возможно, уже чисто)');
      outputMd += `  - *(Вхождений не найдено — модуль уже отвязан)*\n`;
    }
  });

  // 3. Остальные найденные файлы
  console.log('\n🔎 3. ПРОЧИЕ ФАЙЛЫ СО ССЫЛКАМИ НА АУДИТ:');
  outputMd += '\n## 🔎 3. Дополнительные файлы и документация\n\n';

  let additionalCount = 0;
  for (const [filePath, matches] of scannedMap.entries()) {
    const isTargeted = FULL_DELETE_TARGETS.some((t) => filePath.startsWith(t)) ||
      PARTIAL_EDIT_TARGETS.some((t) => t.file === filePath);

    if (!isTargeted) {
      additionalCount++;
      console.log(`  • ${filePath} (${matches.length} совпадений)`);
      outputMd += `- \`${filePath}\` (${matches.length} совпадений: ${matches.map((m) => m.pattern).filter((v, i, a) => a.indexOf(v) === i).join(', ')})\n`;
    }
  }

  if (additionalCount === 0) {
    console.log('  (Дополнительных неучтенных файлов не обнаружено)');
    outputMd += '*Дополнительных файлов не обнаружено.*\n';
  }

  // 4. Инструкция по шагам
  outputMd += `\n## 🚀 Рекомендуемый порядок действий для удаления

1. **Frontend**:
   - Удалить директорию \`apps/spa/src/ts/features/analytics/ConsistencyChecker/\`.
   - Удалить CSS: \`packages/resources/src/styles/features/analytics/ConsistencyChecker.css\`.
   - В \`EditorView.vue\` убрать таб \`activePanelTab === 'consistency'\` и компонент \`<consistency-checker-vue>\`.
   - В \`analytics.store.ts\` убрать \`violations\`, \`auditReport\` и \`loadConsistency()\`.
   - В \`api.client.ts\` убрать \`auditManuscriptConsistency\` и \`auditVolumeConsistency\`.

2. **Backend**:
   - В \`src-tauri/crates/worldwiki-tauri/src/commands/analytics.rs\` удалить команду \`audit_manuscript_consistency\`.
   - В \`src-tauri/src/lib.rs\` удалить регистрацию команды из \`generate_handler!\`.
   - Удалить директорию \`src-tauri/crates/worldwiki-application/src/analytics/consistency_audit/\`.
   - В \`worldwiki-application/src/analytics/mod.rs\` убрать \`pub mod consistency_audit;\`.
   - В \`worldwiki-application/src/bootstrap.rs\` убрать \`consistency_workflow\` из \`AppServices\`.
   - Удалить файл \`src-tauri/crates/worldwiki-domain/src/analytics/consistency.rs\`.
   - В \`worldwiki-domain/src/analytics/mod.rs\` убрать \`pub mod consistency;\`.
   - В \`manuscript_tracking_integration.rs\` удалить/закомментировать устаревшие тесты аудита противоречий.

3. **Схема персонажа**:
   - Изменения в \`apps/spa/public/struct/editor/character.json\` **оставляются на 100%**: гибкая динамическая хронология статуса (\`characterStatusTimeline\`) с опциональной привязкой к главам и календарю.
`;

  const reportPath = path.join(ROOT_DIR, 'docs', 'CONSISTENCY_AUDIT_CLEANUP_PLAN.md');
  fs.writeFileSync(reportPath, outputMd, 'utf-8');

  console.log('\n======================================================================');
  console.log(`✅ Готово! Детальный отчет сформирован: docs/CONSISTENCY_AUDIT_CLEANUP_PLAN.md`);
  console.log('Скрипт можно повторно запускать в любое время командой: node scripts/audit_cleanup_map.mjs');
  console.log('======================================================================\n');
}

main();

