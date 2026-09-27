import fs from 'node:fs';
import path from 'node:path';

const searchDirs = [
  path.resolve('src-tauri/src'),
];

const outputFile = path.resolve('audit_surreal_queries_report.md');

function isTestFile(filePath) {
  const norm = filePath.replace(/\\/g, '/').toLowerCase();
  return (
    norm.includes('/tests/') ||
    norm.includes('/test/') ||
    norm.endsWith('_test.rs') ||
    norm.endsWith('_tests.rs') ||
    norm.endsWith('tests.rs')
  );
}

function getAllRustFiles(dir, fileList = []) {
  if (!fs.existsSync(dir)) return fileList;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== 'target' && entry.name !== '.git' && entry.name !== 'node_modules' && entry.name !== 'tests') {
        getAllRustFiles(fullPath, fileList);
      }
    } else if (entry.isFile() && entry.name.endsWith('.rs')) {
      if (!isTestFile(fullPath)) {
        fileList.push(fullPath);
      }
    }
  }
  return fileList;
}

const SQL_KEYWORDS = [
  'SELECT', 'RELATE', 'DELETE', 'UPDATE', 'UPSERT', 'CREATE', 'INSERT',
  'LET $', 'FOR $', 'DEFINE EVENT', 'DEFINE FUNCTION', 'DEFINE TABLE'
];

function analyzeRustFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const findings = [];

  let inRawString = false;
  let rawStringStart = 0;
  let rawStringBuffer = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (!inRawString && (line.includes('r#"') || (line.includes('.query(') && line.includes('"')))) {
      inRawString = true;
      rawStringStart = i + 1;
      rawStringBuffer = [line];
      if (line.includes('"#') && line.indexOf('"#') > line.indexOf('r#"')) {
        inRawString = false;
        processRawBlock(rawStringBuffer.join('\n'), rawStringStart, filePath, findings);
        rawStringBuffer = [];
      }
    } else if (inRawString) {
      rawStringBuffer.push(line);
      if (line.includes('"#') || line.includes('");')) {
        inRawString = false;
        processRawBlock(rawStringBuffer.join('\n'), rawStringStart, filePath, findings);
        rawStringBuffer = [];
      }
    }
  }

  return findings;
}

function processRawBlock(block, startLine, filePath, findings) {
  const upper = block.toUpperCase();
  const hasSql = SQL_KEYWORDS.some(kw => upper.includes(kw));
  if (!hasSql) return;

  // Ignore calls to fn::* as they are already cleanly migrated
  if (block.includes('fn::') && !upper.includes('DEFINE FUNCTION')) {
    return;
  }

  const isMultiStatement = (block.match(/;/g) || []).length > 1;
  const hasCascadeDelete = upper.includes('DELETE') && (upper.includes('WHERE') || upper.includes('CASCADE'));
  const hasGraphRelate = upper.includes('RELATE') || upper.includes('->') || upper.includes('<-');
  const hasLetFor = upper.includes('LET $') || upper.includes('FOR $');

  let category = '📦 Простые SQL-запросы';
  let recommendation = 'Оставить в Rust-репозитории или перевести на SurrealRepository';

  if (hasCascadeDelete && (hasLetFor || isMultiStatement || block.toLowerCase().includes('chat') || block.toLowerCase().includes('chapter') || block.toLowerCase().includes('project'))) {
    category = '🔥 Каскадные удаления (Кандидаты в DDL EVENT — SDB-008)';
    recommendation = 'Вынести в logic/schema/*/0*.events.surql как DEFINE EVENT ON ... WHEN $event = "DELETE"';
  } else if (hasGraphRelate || hasLetFor || isMultiStatement) {
    category = '⚡ Комплексная графовая/бизнес-логика (Кандидаты в Stored Functions fn::* — SDB-007)';
    recommendation = 'Вынести в logic/schema/no_ai/04_functions.surql как DEFINE FUNCTION OVERWRITE fn::...';
  } else if (upper.includes('DELETE') || upper.includes('UPDATE') || upper.includes('SELECT') || upper.includes('UPSERT')) {
    category = '📦 Инлайн CRUD-запросы';
    recommendation = 'Проверить соответствие SCHEMAFULL и параметризации (.bind)';
  }

  findings.push({
    file: path.relative(process.cwd(), filePath).replace(/\\/g, '/'),
    line: startLine,
    category,
    recommendation,
    snippet: block.trim()
  });
}

function run() {
  console.log('🔍 Запуск аудита Rust-кодовой базы (PROD ONLY, без тестов)...\n');
  const allFiles = searchDirs.flatMap(d => getAllRustFiles(d));
  console.log(`Найдено production Rust файлов: ${allFiles.length}`);

  const allFindings = [];
  for (const f of allFiles) {
    const findings = analyzeRustFile(f);
    allFindings.push(...findings);
  }

  // Group by category
  const categories = {};
  for (const item of allFindings) {
    categories[item.category] = categories[item.category] || [];
    categories[item.category].push(item);
  }

  // Generate Markdown report
  let md = `# 📊 Production Аудит Inline SurrealQL (Без Тестов)\n\n`;
  md += `> **Всего найдено немигрированных SQL-блоков в Rust:** ${allFindings.length}\n\n`;
  md += `## 📋 Сводка по категориям\n\n`;

  for (const [cat, items] of Object.entries(categories)) {
    md += `- **${cat}**: ${items.length} мест\n`;
  }
  md += `\n---\n\n`;

  for (const [cat, items] of Object.entries(categories)) {
    md += `## ${cat} (${items.length})\n\n`;
    for (const item of items) {
      md += `### 📍 [\`${item.file}:${item.line}\`](./${item.file}#L${item.line})\n\n`;
      md += `**💡 Рекомендация:** ${item.recommendation}\n\n`;
      md += `\`\`\`sql\n${item.snippet}\n\`\`\`\n\n`;
    }
  }

  fs.writeFileSync(outputFile, md, 'utf-8');
  console.log(`\n✅ Отчёт успешно сохранён: ./audit_surreal_queries_report.md`);
  console.log(`📊 Всего немигрированных SQL-блоков: ${allFindings.length}`);
}

run();
