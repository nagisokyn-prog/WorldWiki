import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function countLines(directory) {
  let stats = {
    totalFiles: 0,
    totalLines: 0,
    prodFiles: 0,
    prodLines: 0,
    testFiles: 0,
    testLines: 0,
    tomlFiles: 0,
    tomLines: 0,
  };

  const ignoreDirs = ['target', '.git', 'node_modules'];

  function walk(currentDir) {
    if (!fs.existsSync(currentDir)) return;
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);

      if (entry.isDirectory()) {
        if (!ignoreDirs.includes(entry.name)) {
          walk(fullPath);
        }
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name);
        if (ext === '.rs' || ext === '.toml') {
          stats.totalFiles++;
          try {
            const content = fs.readFileSync(fullPath, 'utf8');
            const lines = content.split('\n');
            const lineCount = lines.length;
            stats.totalLines += lineCount;

            const isTestFile =
              fullPath.includes(`${path.sep}tests${path.sep}`) ||
              fullPath.includes(`${path.sep}benches${path.sep}`) ||
              entry.name.endsWith('_test.rs') ||
              entry.name.endsWith('_spec.rs');

            if (ext === '.toml') {
              stats.tomlFiles++;
              stats.tomLines += lineCount;
            } else if (isTestFile) {
              stats.testFiles++;
              stats.testLines += lineCount;
            } else {
              // Анализируем разделение внутри .rs файла (prod vs inline #[cfg(test)])
              let inTestModule = false;
              let fileProdLines = 0;
              let fileTestLines = 0;

              for (const line of lines) {
                const trimmed = line.trim();
                if (
                  trimmed.startsWith('#[cfg(test)]') ||
                  trimmed.startsWith('mod tests') ||
                  trimmed.startsWith('#[test]')
                ) {
                  inTestModule = true;
                }

                if (inTestModule) {
                  fileTestLines++;
                } else {
                  fileProdLines++;
                }
              }

              stats.prodFiles++;
              stats.prodLines += fileProdLines;
              stats.testLines += fileTestLines;
            }
          } catch (err) {
            console.error(`Ошибка чтения ${fullPath}:`, err.message);
          }
        }
      }
    }
  }

  walk(directory);

  console.log(`\n📊 ================================================`);
  console.log(`📁 Всего файлов:              ${stats.totalFiles}`);
  console.log(`💻 Всего строк (Total SLOC):  ${stats.totalLines}`);
  console.log(`------------------------------------------------`);
  console.log(`🚀 Чистый код (Production):   ${stats.prodLines} строк (${stats.prodFiles} файлов)`);
  console.log(`🧪 Тесты и бенчмарки (Tests): ${stats.testLines} строк (вкл. ${stats.testFiles} тест-файлов)`);
  console.log(`⚙️ Манифесты (Cargo.toml):    ${stats.tomLines} строк (${stats.tomlFiles} файлов)`);
  console.log(`📈 Соотношение Test / Code:   ${((stats.testLines / (stats.prodLines || 1)) * 100).toFixed(1)}%`);
  console.log(`================================================\n`);
}

const defaultDir = fs.existsSync(path.join(__dirname, 'crates'))
  ? path.join(__dirname, 'crates')
  : __dirname;

const targetDir = process.argv[2] || defaultDir;
console.log(`🔍 Анализ директории: ${targetDir}`);
countLines(targetDir);
