import fs from 'node:fs';
import path from 'node:path';

const STYLES_DIR = path.resolve('packages/resources/src/styles');

// Карта сопоставления радиусов на дизайн-токены
const RADIUS_MAP = {
  '2px': 'var(--radius-xs)',
  '3px': 'var(--radius-xs)',
  '4px': 'var(--radius-xs)',
  '5px': 'var(--radius-xs)',
  '6px': 'var(--radius-xs)',
  '8px': 'var(--radius-sm)',
  '10px': 'var(--radius-md)',
  '12px': 'var(--radius-md)',
  '14px': 'var(--radius-lg)',
  '16px': 'var(--radius-lg)',
  '20px': 'var(--radius-card)',
  '24px': 'var(--radius-card)',
  '28px': 'var(--radius-island)',
  '50%': 'var(--radius-round)',
  '9999px': 'var(--radius-round)',
  '999px': 'var(--radius-round)',
};

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

function getRadiusToken(pxStr) {
  if (pxStr === '50%' || pxStr === '9999px' || pxStr === '999px') return 'var(--radius-round)';
  const num = parseInt(pxStr, 10);
  if (isNaN(num)) return null;
  if (num <= 1) return 'var(--radius-xs)';
  if (num <= 6) return 'var(--radius-xs)';
  if (num <= 8) return 'var(--radius-sm)';
  if (num <= 12) return 'var(--radius-md)';
  if (num <= 16) return 'var(--radius-lg)';
  if (num <= 24) return 'var(--radius-card)';
  if (num <= 28) return 'var(--radius-island)';
  return 'var(--radius-round)';
}

function processBorderRadius(line) {
  // Игнорируем комментарии
  const trimmed = line.trim();
  if (trimmed.startsWith('/*') || trimmed.startsWith('//') || trimmed.startsWith('*')) {
    return { line, changed: false };
  }

  // Замена border-radius: Xpx;
  const singleRegex = /border-radius\s*:\s*(\d+px|50%|9999px)\s*(;|\s*!important;?)/g;
  let changed = false;

  let newLine = line.replace(singleRegex, (match, val, ending) => {
    const token = getRadiusToken(val);
    if (token) {
      changed = true;
      return `border-radius: ${token}${ending.startsWith(' ') ? ending : ' ' + ending}`;
    }
    return match;
  });

  // Замена border-radius: var(--radius-*, Xpx) где есть хардкод фоллбэка Xpx
  const fallbackRegex = /border-radius\s*:\s*var\((--radius-[a-z]+),\s*\d+px\)/g;
  newLine = newLine.replace(fallbackRegex, (match, varName) => {
    changed = true;
    return `border-radius: var(${varName})`;
  });

  return { line: newLine, changed };
}

function run() {
  console.log('🚀 Запуск автоматического кодемода для исправления CSS токенов...');
  const files = getAllCssFiles(STYLES_DIR);
  let totalFixedFiles = 0;
  let totalRadiusReplacements = 0;

  for (const filePath of files) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    let fileChanged = false;
    let fileFixCount = 0;

    const newLines = lines.map((line) => {
      const res = processBorderRadius(line);
      if (res.changed) {
        fileChanged = true;
        fileFixCount++;
        totalRadiusReplacements++;
      }
      return res.line;
    });

    if (fileChanged) {
      fs.writeFileSync(filePath, newLines.join('\n'), 'utf-8');
      totalFixedFiles++;
      const relPath = path.relative(process.cwd(), filePath);
      console.log(`  ✨ [${fileFixCount} замен] ${relPath}`);
    }
  }

  console.log('\n=============================================');
  console.log(`✅ Обработано файлов: ${files.length}`);
  console.log(`🎯 Исправлено файлов: ${totalFixedFiles}`);
  console.log(`🪄 Всего заменено хардкод-радиусов на токены: ${totalRadiusReplacements}`);
  console.log('=============================================\n');
}

run();
