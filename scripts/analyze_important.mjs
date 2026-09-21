import fs from 'node:fs';
import path from 'node:path';

const STYLES_DIR = path.resolve('packages/resources/src/styles');

function getAllCssFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      getAllCssFiles(fullPath, fileList);
    } else if (file.endsWith('.css')) {
      fileList.push(fullPath);
    }
  }
  return fileList;
}

function analyze() {
  const files = getAllCssFiles(STYLES_DIR);
  const results = [];
  let totalImportant = 0;

  for (const filePath of files) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    const occurrences = [];

    lines.forEach((line, idx) => {
      const trimmed = line.trim();
      if (trimmed.includes('!important') && !trimmed.startsWith('/*') && !trimmed.startsWith('//')) {
        occurrences.push({
          line: idx + 1,
          content: trimmed,
        });
      }
    });

    if (occurrences.length > 0) {
      totalImportant += occurrences.length;
      results.push({
        file: path.relative(process.cwd(), filePath),
        count: occurrences.length,
        occurrences,
      });
    }
  }

  results.sort((a, b) => b.count - a.count);

  console.log(`📊 Всего найдено !important: ${totalImportant} в ${results.length} файлах.\n`);
  results.forEach((r, idx) => {
    console.log(`${idx + 1}. [${r.count} шт] ${r.file}`);
  });

  fs.writeFileSync(
    path.resolve('.cerberus/important_analysis.json'),
    JSON.stringify({ total: totalImportant, files: results }, null, 2),
    'utf-8'
  );
  console.log('\n📄 Подробный отчет сохранен в .cerberus/important_analysis.json');
}

analyze();
