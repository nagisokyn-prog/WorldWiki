import fs from 'node:fs';
import path from 'node:path';

const BASELINE_PATH = path.resolve('cerberus-baseline-front.json');
const OUTPUT_DIR = path.resolve('.cerberus/debt-breakdown');

function main() {
  if (!fs.existsSync(BASELINE_PATH)) {
    console.error(`❌ Файл бейслайна не найден: ${BASELINE_PATH}`);
    process.exit(1);
  }

  const rawData = fs.readFileSync(BASELINE_PATH, 'utf-8');
  const violations = JSON.parse(rawData);

  console.log(`🔍 Прочитано ${violations.length} нарушений из ${BASELINE_PATH}`);

  // Очистка / создание целевой директории
  if (fs.existsSync(OUTPUT_DIR)) {
    fs.rmSync(OUTPUT_DIR, { recursive: true, force: true });
  }
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  // Группировка по файлам
  const fileMap = new Map();

  for (const item of violations) {
    const rawFilePath = item.file;
    // Нормализуем путь (убираем leading ./ и приводим слэши)
    const normalizedPath = rawFilePath.replace(/^\.[\\/]/, '');
    
    if (!fileMap.has(normalizedPath)) {
      fileMap.set(normalizedPath, []);
    }
    fileMap.get(normalizedPath).push(item);
  }

  const summary = [];

  for (const [filePath, fileViolations] of fileMap.entries()) {
    // Сортируем нарушения внутри файла по строкам
    fileViolations.sort((a, b) => (a.line || 0) - (b.line || 0));

    // Формируем путь для сохранения json-файла
    // Например: .cerberus/debt-breakdown/packages/resources/src/styles/app.css.json
    const targetJsonPath = path.join(OUTPUT_DIR, `${filePath}.json`);
    const targetDir = path.dirname(targetJsonPath);

    fs.mkdirSync(targetDir, { recursive: true });

    // Считаем распределение по правилам
    const rulesCount = {};
    for (const v of fileViolations) {
      rulesCount[v.rule] = (rulesCount[v.rule] || 0) + 1;
    }

    const payload = {
      targetFile: filePath,
      totalViolations: fileViolations.length,
      rulesDistribution: rulesCount,
      violations: fileViolations,
    };

    fs.writeFileSync(targetJsonPath, JSON.stringify(payload, null, 2), 'utf-8');

    summary.push({
      file: filePath,
      count: fileViolations.length,
      rules: rulesCount,
      jsonPath: path.relative(process.cwd(), targetJsonPath),
    });
  }

  // Сортируем сводку: от самых нагруженных файлов к наименее нагруженным
  summary.sort((a, b) => b.count - a.count);

  // Сохраняем общий индексный файл _index.json
  const indexPayload = {
    generatedAt: new Date().toISOString(),
    totalViolations: violations.length,
    totalFiles: fileMap.size,
    files: summary,
  };

  fs.writeFileSync(
    path.join(OUTPUT_DIR, '_index.json'),
    JSON.stringify(indexPayload, null, 2),
    'utf-8'
  );

  console.log(`\n✅ Успешно сформировано ${fileMap.size} файлов с задачами в папке:`);
  console.log(`📁 ${path.relative(process.cwd(), OUTPUT_DIR)}`);
  console.log(`\n📄 Сводный индексный файл: ${path.relative(process.cwd(), path.join(OUTPUT_DIR, '_index.json'))}`);
  console.log(`\nТоп файлов по количеству проблем:`);
  summary.slice(0, 10).forEach((item, idx) => {
    const rulesStr = Object.entries(item.rules).map(([r, c]) => `${r}: ${c}`).join(', ');
    console.log(`  ${idx + 1}. [${item.count}] ${item.file} (${rulesStr})`);
  });
}

main();
