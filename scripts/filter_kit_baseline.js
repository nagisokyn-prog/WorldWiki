import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ROOT_DIR = path.resolve(__dirname, '..');
const BASELINE_FILE = path.join(ROOT_DIR, 'cerberus-baseline.json');
const OUTPUT_JSON = path.join(ROOT_DIR, 'cerberus-baseline-kit.json');
const OUTPUT_MD = path.join(ROOT_DIR, 'KIT_CERBERUS_ISSUES.md');

function run() {
  if (!fs.existsSync(BASELINE_FILE)) {
    console.error(`Baseline file not found: ${BASELINE_FILE}`);
    process.exit(1);
  }

  const rawData = fs.readFileSync(BASELINE_FILE, 'utf-8');
  let entries = [];
  try {
    entries = JSON.parse(rawData);
  } catch (err) {
    console.error(`Failed to parse ${BASELINE_FILE}:`, err.message);
    process.exit(1);
  }

  // Filter entries related to tauri-surreal-kit
  const kitEntries = entries.filter((item) => {
    const filePath = item.file || '';
    return filePath.includes('tauri-surreal-kit');
  });

  // Write JSON
  fs.writeFileSync(OUTPUT_JSON, JSON.stringify(kitEntries, null, 2), 'utf-8');
  console.log(`[JSON] Saved ${kitEntries.length} kit issues to: ${path.relative(ROOT_DIR, OUTPUT_JSON)}`);

  // Group by Rule
  const byRule = {};
  const byFile = {};

  kitEntries.forEach((entry) => {
    // By rule
    if (!byRule[entry.rule]) {
      byRule[entry.rule] = [];
    }
    byRule[entry.rule].push(entry);

    // By file
    const relFile = entry.file.replace(/^\.\//, '');
    if (!byFile[relFile]) {
      byFile[relFile] = [];
    }
    byFile[relFile].push(entry);
  });

  // Build Markdown Report
  let md = `# 🛡️ Cerberus Issues Report: Tauri-Surreal-Kit\n\n`;
  md += `> **Дата генерации:** ${new Date().toISOString()}\n`;
  md += `> **Всего нарушений в ките:** \`${kitEntries.length}\` из \`${entries.length}\` общих по репозиторию.\n\n`;

  md += `## 📊 Сводка по правилам\n\n`;
  md += `| Правило | Количество | Описание |\n`;
  md += `| :--- | :---: | :--- |\n`;

  const sortedRules = Object.keys(byRule).sort((a, b) => byRule[b].length - byRule[a].length);
  for (const rule of sortedRules) {
    const count = byRule[rule].length;
    const sampleMsg = byRule[rule][0]?.message?.split('(')[0]?.trim() || '';
    md += `| **\`${rule}\`** | **${count}** | ${sampleMsg} |\n`;
  }
  md += `\n---\n\n`;

  md += `## 📁 Сводка по файлам\n\n`;
  md += `| Файл | Ошибок | Затронутые правила |\n`;
  md += `| :--- | :---: | :--- |\n`;

  const sortedFiles = Object.keys(byFile).sort((a, b) => byFile[b].length - byFile[a].length);
  for (const f of sortedFiles) {
    const count = byFile[f].length;
    const rules = [...new Set(byFile[f].map((e) => e.rule))].join(', ');
    md += `| [\`${f}\`](file:///${path.join(ROOT_DIR, f).replace(/\\/g, '/')}) | **${count}** | \`${rules}\` |\n`;
  }
  md += `\n---\n\n`;

  md += `## 🔍 Детальный реестр нарушений\n\n`;
  for (const f of sortedFiles) {
    const list = byFile[f];
    md += `### 📄 [\`${f}\`](file:///${path.join(ROOT_DIR, f).replace(/\\/g, '/')}) (${list.length})\n\n`;
    md += `| Строка | Правило | Символ | Сообщение |\n`;
    md += `| :---: | :---: | :---: | :--- |\n`;
    for (const item of list) {
      md += `| **L${item.line}** | \`${item.rule}\` | \`${item.symbol || '-'}\` | ${item.message} |\n`;
    }
    md += `\n`;
  }

  fs.writeFileSync(OUTPUT_MD, md, 'utf-8');
  console.log(`[MD] Generated markdown report: ${path.relative(ROOT_DIR, OUTPUT_MD)}`);
}

run();
