import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

const TARGET_DIRS = [
  'src-tauri',
  'apps',
  'tauri-surreal-kit',
  'crates',
  'packages'
];

const IGNORED_DIR_NAMES = new Set([
  'node_modules',
  'target',
  'dist',
  'build',
  '.git',
  '.turbo',
  '.vscode',
  '.idea',
  'coverage',
  '__tests__',
  'tests',
  'test',
  'harness',
  'harnesses',
  'fixtures',
  'mocks',
  'mock',
  'temp',
  'tmp'
]);

const IGNORED_FILE_PATTERNS = [
  /\.spec\.[jt]sx?$/,
  /\.test\.[jt]sx?$/,
  /_test\.rs$/,
  /^test_.*\.rs$/,
  /^mock_.*\.rs$/,
  /^mock.*\.ts$/,
  /\.d\.ts$/,
  /vitest\.config\.[jt]s$/,
  /jest\.config\.[jt]s$/,
  /playwright\.config\.[jt]s$/
];

// Исключены .json, .js, .mjs, .cjs, .toml - только целевой код приложения
const CODE_EXTENSIONS = new Set([
  '.rs',
  '.ts',
  '.vue',
  '.css',
  '.surql'
]);

function isTestOrHarness(filePath) {
  const normPath = filePath.replace(/\\/g, '/');
  const segments = normPath.split('/');

  for (const seg of segments) {
    if (IGNORED_DIR_NAMES.has(seg.toLowerCase())) {
      return true;
    }
  }

  const fileName = path.basename(filePath);
  for (const pattern of IGNORED_FILE_PATTERNS) {
    if (pattern.test(fileName)) {
      return true;
    }
  }

  return false;
}

/**
 * Вырезает inline-тесты из Rust-файлов (#[cfg(test)] mod tests { ... } и #[test] fn ...)
 */
function stripInlineRustTests(content) {
  const lines = content.split(/\r?\n/);
  const prodLines = [];
  let inTest = false;
  let testTriggered = false;
  let braceDepth = 0;
  let inlineTestLinesCount = 0;

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();

    if (!inTest) {
      if (
        trimmed.startsWith('#[cfg(test)]') ||
        trimmed.startsWith('#[cfg(all(test') ||
        trimmed.startsWith('#[test]') ||
        trimmed.startsWith('#[tokio::test')
      ) {
        testTriggered = true;
      }

      if (testTriggered) {
        inlineTestLinesCount++;
        // Проверяем наличие открывающей фигурной скобки
        for (let j = 0; j < trimmed.length; j++) {
          if (trimmed[j] === '{') {
            braceDepth++;
            inTest = true;
            testTriggered = false;
          }
        }
        if (trimmed.endsWith(';')) {
          // Например #[cfg(test)] mod tests;
          testTriggered = false;
        }
        continue;
      }

      prodLines.push(rawLine);
    } else {
      inlineTestLinesCount++;
      let inString = false;
      let escape = false;

      for (let j = 0; j < rawLine.length; j++) {
        const ch = rawLine[j];
        if (inString) {
          if (escape) {
            escape = false;
          } else if (ch === '\\') {
            escape = true;
          } else if (ch === '"') {
            inString = false;
          }
        } else {
          if (ch === '"') {
            inString = true;
          } else if (ch === '/' && rawLine[j + 1] === '/') {
            break; // конец значащей строки
          } else if (ch === '{') {
            braceDepth++;
          } else if (ch === '}') {
            braceDepth--;
            if (braceDepth <= 0) {
              inTest = false;
              braceDepth = 0;
              break;
            }
          }
        }
      }
    }
  }

  return {
    cleanedContent: prodLines.join('\n'),
    inlineTestLinesCount
  };
}

function analyzeFileContent(content, ext) {
  let cleaned = content;
  let inlineTestLines = 0;

  if (ext === '.rs') {
    const res = stripInlineRustTests(content);
    cleaned = res.cleanedContent;
    inlineTestLines = res.inlineTestLinesCount;
  }

  const lines = cleaned.split(/\r?\n/);
  const totalLines = lines.length;
  let blankLines = 0;
  let commentLines = 0;
  let inBlockComment = false;

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (line.length === 0) {
      blankLines++;
      continue;
    }

    if (inBlockComment) {
      commentLines++;
      if (line.includes('*/') || line.includes('-->')) {
        inBlockComment = false;
      }
      continue;
    }

    if (line.startsWith('/*') || line.startsWith('<!--')) {
      commentLines++;
      if (!line.includes('*/') && !line.includes('-->')) {
        inBlockComment = true;
      }
      continue;
    }

    if (
      line.startsWith('//') ||
      line.startsWith('--')
    ) {
      commentLines++;
      continue;
    }
  }

  const codeLines = totalLines - blankLines - commentLines;
  return { totalLines, blankLines, commentLines, codeLines, inlineTestLines };
}

async function collectFiles(dirPath) {
  const results = [];
  try {
    const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);

      if (entry.isDirectory()) {
        if (!IGNORED_DIR_NAMES.has(entry.name.toLowerCase())) {
          const subFiles = await collectFiles(fullPath);
          results.push(...subFiles);
        }
      } else if (entry.isFile()) {
        if (!isTestOrHarness(fullPath)) {
          const ext = path.extname(entry.name).toLowerCase();
          if (CODE_EXTENSIONS.has(ext)) {
            results.push({ fullPath, ext });
          }
        }
      }
    }
  } catch (err) {
    // skip
  }
  return results;
}

function formatNumber(num) {
  return new Intl.NumberFormat('ru-RU').format(num);
}

function pad(str, len, align = 'left') {
  const s = String(str);
  if (s.length >= len) return s;
  const spaces = ' '.repeat(len - s.length);
  return align === 'right' ? spaces + s : s + spaces;
}

async function main() {
  console.log('🔍 Сбор статистики по чистому коду WorldWiki...');
  console.log('Исключены: тесты (unit, integration, inline #[cfg(test)]), фикстуры, моки, харнесы, build-артефакты, json/js/toml.\n');

  const fileStatsByExt = {};
  const fileStatsByDir = {};

  let grandTotalFiles = 0;
  let grandTotalLines = 0;
  let grandBlankLines = 0;
  let grandCommentLines = 0;
  let grandCodeLines = 0;
  let grandInlineTestLines = 0;

  for (const targetDir of TARGET_DIRS) {
    const absPath = path.join(ROOT_DIR, targetDir);
    if (!fs.existsSync(absPath)) continue;

    fileStatsByDir[targetDir] = {
      files: 0,
      totalLines: 0,
      blankLines: 0,
      commentLines: 0,
      codeLines: 0,
      inlineTestLines: 0
    };

    const files = await collectFiles(absPath);

    for (const file of files) {
      try {
        const content = await fs.promises.readFile(file.fullPath, 'utf-8');
        const analysis = analyzeFileContent(content, file.ext);

        grandTotalFiles++;
        grandTotalLines += analysis.totalLines;
        grandBlankLines += analysis.blankLines;
        grandCommentLines += analysis.commentLines;
        grandCodeLines += analysis.codeLines;
        grandInlineTestLines += analysis.inlineTestLines;

        // By Ext
        if (!fileStatsByExt[file.ext]) {
          fileStatsByExt[file.ext] = {
            files: 0,
            totalLines: 0,
            blankLines: 0,
            commentLines: 0,
            codeLines: 0,
            inlineTestLines: 0
          };
        }
        fileStatsByExt[file.ext].files++;
        fileStatsByExt[file.ext].totalLines += analysis.totalLines;
        fileStatsByExt[file.ext].blankLines += analysis.blankLines;
        fileStatsByExt[file.ext].commentLines += analysis.commentLines;
        fileStatsByExt[file.ext].codeLines += analysis.codeLines;
        fileStatsByExt[file.ext].inlineTestLines += analysis.inlineTestLines;

        // By Dir
        fileStatsByDir[targetDir].files++;
        fileStatsByDir[targetDir].totalLines += analysis.totalLines;
        fileStatsByDir[targetDir].blankLines += analysis.blankLines;
        fileStatsByDir[targetDir].commentLines += analysis.commentLines;
        fileStatsByDir[targetDir].codeLines += analysis.codeLines;
        fileStatsByDir[targetDir].inlineTestLines += analysis.inlineTestLines;
      } catch (err) {
        // Ignore read errors
      }
    }
  }

  // 1. Summary
  console.log('================================================================================');
  console.log('                   📊 СВОДНАЯ СТАТИСТИКА ПРОИЗВОДСТВЕННОГО КОДА                ');
  console.log('================================================================================');
  console.log(`Всего файлов кода (.rs, .ts, .vue, .css, .surql): ${formatNumber(grandTotalFiles)}`);
  console.log(`Всего строк чистого кода (Net Code LOC):           ${formatNumber(grandCodeLines)} (${((grandCodeLines / grandTotalLines) * 100).toFixed(1)}%)`);
  console.log(`Всего строк (с пробелами и комментариями):         ${formatNumber(grandTotalLines)}`);
  console.log(`Комментарии:                                       ${formatNumber(grandCommentLines)} (${((grandCommentLines / grandTotalLines) * 100).toFixed(1)}%)`);
  console.log(`Пустые строки:                                     ${formatNumber(grandBlankLines)} (${((grandBlankLines / grandTotalLines) * 100).toFixed(1)}%)`);
  console.log(`Исключено inline-тестов (#[cfg(test)] / #[test]):  ${formatNumber(grandInlineTestLines)} строк`);
  console.log('--------------------------------------------------------------------------------\n');

  // 2. By Directory
  console.log('📂 РАСПРЕДЕЛЕНИЕ ПО МОДУЛЯМ / ДИРЕКТОРИЯМ:');
  console.log('--------------------------------------------------------------------------------');
  console.log(
    `${pad('Директория', 22)} | ${pad('Файлов', 8, 'right')} | ${pad('Чистый код', 14, 'right')} | ${pad('Всего строк', 14, 'right')} | ${pad('% Кода', 8, 'right')}`
  );
  console.log('--------------------------------------------------------------------------------');

  const sortedDirs = Object.entries(fileStatsByDir).sort((a, b) => b[1].codeLines - a[1].codeLines);
  for (const [dirName, s] of sortedDirs) {
    const percent = grandCodeLines > 0 ? ((s.codeLines / grandCodeLines) * 100).toFixed(1) + '%' : '0%';
    console.log(
      `${pad(dirName, 22)} | ${pad(formatNumber(s.files), 8, 'right')} | ${pad(formatNumber(s.codeLines), 14, 'right')} | ${pad(formatNumber(s.totalLines), 14, 'right')} | ${pad(percent, 8, 'right')}`
    );
  }
  console.log('--------------------------------------------------------------------------------\n');

  // 3. By Extension
  console.log('🏷️  РАСПРЕДЕЛЕНИЕ ПО ТИПАМ ФАЙЛОВ / ЯЗЫКАМ:');
  console.log('--------------------------------------------------------------------------------');
  console.log(
    `${pad('Расширение', 12)} | ${pad('Файлов', 8, 'right')} | ${pad('Чистый код', 14, 'right')} | ${pad('Всего строк', 14, 'right')} | ${pad('% Кода', 8, 'right')}`
  );
  console.log('--------------------------------------------------------------------------------');

  const sortedExts = Object.entries(fileStatsByExt).sort((a, b) => b[1].codeLines - a[1].codeLines);
  for (const [ext, s] of sortedExts) {
    const percent = grandCodeLines > 0 ? ((s.codeLines / grandCodeLines) * 100).toFixed(1) + '%' : '0%';
    console.log(
      `${pad(ext, 12)} | ${pad(formatNumber(s.files), 8, 'right')} | ${pad(formatNumber(s.codeLines), 14, 'right')} | ${pad(formatNumber(s.totalLines), 14, 'right')} | ${pad(percent, 8, 'right')}`
    );
  }
  console.log('================================================================================');
}

main().catch(console.error);
