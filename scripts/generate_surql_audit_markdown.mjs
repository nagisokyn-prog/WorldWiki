import fs from 'node:fs';
import path from 'node:path';

function generateMarkdownReport() {
  const baselinePath = path.resolve('cerberus-baseline.json');
  if (!fs.existsSync(baselinePath)) {
    console.error('❌ cerberus-baseline.json не найден');
    return;
  }

  const items = JSON.parse(fs.readFileSync(baselinePath, 'utf-8'));
  const byRule = {};
  const byFile = {};
  const byModule = {};

  for (const item of items) {
    byRule[item.rule] = (byRule[item.rule] || 0) + 1;
    byFile[item.file] = (byFile[item.file] || 0) + 1;

    let moduleKey = 'Root / Other';
    if (item.file.includes('logic/schema/no_ai')) moduleKey = '`logic/schema/no_ai` (Core Base)';
    else if (item.file.includes('logic/schema/ai')) moduleKey = '`logic/schema/ai` (AI Space)';
    else if (item.file.includes('worldwiki-infrastructure')) moduleKey = '`worldwiki-infrastructure` (Rust DB Adapters)';
    else if (item.file.includes('worldwiki-application')) moduleKey = '`worldwiki-application` (Rust Use Cases)';
    else if (item.file.includes('worldwiki-domain')) moduleKey = '`worldwiki-domain` (Rust Pure Domain)';
    else if (item.file.includes('tauri-surreal-kit')) moduleKey = '`tauri-surreal-kit`';
    else if (item.file.includes('src-tauri')) moduleKey = '`src-tauri` (Desktop Shell)';

    byModule[moduleKey] = (byModule[moduleKey] || 0) + 1;
  }

  const sortedRules = Object.entries(byRule).sort((a, b) => b[1] - a[1]);
  const sortedModules = Object.entries(byModule).sort((a, b) => b[1] - a[1]);
  const sortedFiles = Object.entries(byFile).sort((a, b) => b[1] - a[1]);

  let md = `# 📊 АРХИТЕКТУРНЫЙ АУДИТ БЕЙЗЛАЙНА (cerberus-baseline.json)\n\n`;
  md += `> **Дата генерации**: ${new Date().toISOString().replace('T', ' ').slice(0, 19)} UTC  \n`;
  md += `> **Всего зафиксировано нарушений**: \`${items.length}\`  \n\n`;
  md += `---\n\n`;

  md += `## 1. 📈 Сводка по правилам\n\n`;
  md += `| Правило | Описание / Категория | Количество | Доля от общего долга |\n`;
  md += `| :--- | :--- | :---: | :---: |\n`;
  for (const [rule, count] of sortedRules) {
    const pct = ((count / items.length) * 100).toFixed(1);
    md += `| **\`${rule}\`** | SurrealDB / Rust Engine Invariant | \`${count}\` | **${pct}%** |\n`;
  }
  md += `\n---\n\n`;

  md += `## 2. 📁 Распределение по подсистемам и модулям\n\n`;
  md += `| Модуль / Подсистема | Количество нарушений | Процент |\n`;
  md += `| :--- | :---: | :---: |\n`;
  for (const [mod, count] of sortedModules) {
    const pct = ((count / items.length) * 100).toFixed(1);
    md += `| ${mod} | \`${count}\` | **${pct}%** |\n`;
  }
  md += `\n---\n\n`;

  md += `## 3. 📄 Топ-20 файлов с наибольшей концентрацией нарушений\n\n`;
  md += `| Файл | Нарушений | Доминирующие правила |\n`;
  md += `| :--- | :---: | :--- |\n`;
  for (const [file, count] of sortedFiles.slice(0, 20)) {
    const fileItems = items.filter(i => i.file === file);
    const fileRules = [...new Set(fileItems.map(i => i.rule))].join(', ');
    md += `| \`${file}\` | \`${count}\` | \`${fileRules}\` |\n`;
  }
  md += `\n---\n\n`;

  md += `## 4. 🛠️ Рекомендации по приоритизации рефакторинга\n\n`;
  md += `1. **Кластер Rust Inline Запросов (\`SURQL-015\` / \`SURQL-008\`)**:\n`;
  md += `   - Проверить методы в \`src-tauri/crates/worldwiki-infrastructure/src/surrealdb/\` на массовые мутации \`UPDATE\`/\`DELETE\` без условий \`WHERE\`.\n`;
  md += `2. **Кластер DDL Schemas (\`logic/schema/\`)**:\n`;
  md += `   - Проверить явную типизацию полей и наличие индексов для внешних ключей.\n`;

  const reportDir = path.resolve('reports');
  if (!fs.existsSync(reportDir)) {
    fs.mkdirSync(reportDir, { recursive: true });
  }

  const outPath = path.resolve('reports/SURQL_BASELINE_AUDIT.md');
  fs.writeFileSync(outPath, md, 'utf-8');
  console.log('✅ Отчет успешно сформирован в reports/SURQL_BASELINE_AUDIT.md');
}

generateMarkdownReport();
