import fs from 'node:fs';
import path from 'node:path';

const STYLES_DIR = path.resolve('packages/resources/src/styles');

const RGBA_MAP = [
  // Статусные цвета
  { pattern: /rgba\(\s*239\s*,\s*68\s*,\s*68\s*,\s*(?:0\.15|0\.2|0\.1)\s*\)/g, token: 'var(--error-bg)' },
  { pattern: /rgba\(\s*239\s*,\s*68\s*,\s*68\s*,\s*0\.3\s*\)/g, token: 'var(--error-border)' },
  { pattern: /rgba\(\s*250\s*,\s*82\s*,\s*82\s*,\s*0\.1\s*\)/g, token: 'var(--error-bg)' },

  { pattern: /rgba\(\s*16\s*,\s*185\s*,\s*129\s*,\s*(?:0\.15|0\.2|0\.1)\s*\)/g, token: 'var(--success-bg)' },
  { pattern: /rgba\(\s*16\s*,\s*185\s*,\s*129\s*,\s*0\.3\s*\)/g, token: 'var(--success-border)' },

  { pattern: /rgba\(\s*245\s*,\s*158\s*,\s*11\s*,\s*(?:0\.15|0\.2|0\.1)\s*\)/g, token: 'var(--warning-bg)' },
  { pattern: /rgba\(\s*245\s*,\s*158\s*,\s*11\s*,\s*0\.3\s*\)/g, token: 'var(--warning-border)' },

  { pattern: /rgba\(\s*59\s*,\s*130\s*,\s*246\s*,\s*(?:0\.15|0\.2|0\.1)\s*\)/g, token: 'var(--info-bg)' },
  { pattern: /rgba\(\s*59\s*,\s*130\s*,\s*246\s*,\s*0\.3\s*\)/g, token: 'var(--info-border)' },

  // Акценты
  { pattern: /rgba\(\s*139\s*,\s*92\s*,\s*246\s*,\s*0\.15\s*\)/g, token: 'var(--bg-selected)' },
  { pattern: /rgba\(\s*139\s*,\s*92\s*,\s*246\s*,\s*0\.1\s*\)/g, token: 'var(--bg-selected)' },
  { pattern: /rgba\(\s*139\s*,\s*92\s*,\s*246\s*,\s*(?:0\.2|0\.3)\s*\)/g, token: 'var(--accent-glow)' },
  { pattern: /rgba\(\s*139\s*,\s*92\s*,\s*246\s*,\s*0\.5\s*\)/g, token: 'var(--border-active)' },
  { pattern: /rgba\(\s*196\s*,\s*181\s*,\s*253\s*,\s*0\.15\s*\)/g, token: 'var(--bg-selected)' },

  // Базовые фоны и границы
  { pattern: /rgba\(\s*255\s*,\s*255\s*,\s*255\s*,\s*0\.05\s*\)/g, token: 'var(--bg-hover)' },
  { pattern: /rgba\(\s*255\s*,\s*255\s*,\s*255\s*,\s*0\.1\s*\)/g, token: 'var(--border-color)' },
  { pattern: /rgba\(\s*255\s*,\s*255\s*,\s*255\s*,\s*0\.2\s*\)/g, token: 'var(--border-hover)' },
  { pattern: /rgba\(\s*22\s*,\s*22\s*,\s*26\s*,\s*0\.6\s*\)/g, token: 'var(--bg-card)' },
  { pattern: /rgba\(\s*15\s*,\s*15\s*,\s*18\s*,\s*0\.7\s*\)/g, token: 'var(--bg-panel)' },
  { pattern: /rgba\(\s*0\s*,\s*0\s*,\s*0\s*,\s*0\.25\s*\)/g, token: 'var(--bg-sunken)' },
  { pattern: /rgba\(\s*0\s*,\s*0\s*,\s*0\s*,\s*0\.5\s*\)/g, token: 'var(--shadow-color)' },
  { pattern: /rgba\(\s*0\s*,\s*0\s*,\s*0\s*,\s*0\.65\s*\)/g, token: 'var(--modal-backdrop)' },
];

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

function run() {
  console.log('🚀 Запуск автоматической миграции hardcoded цветов/rgba на токены...');
  const files = getAllCssFiles(STYLES_DIR);
  let totalFixedFiles = 0;
  let totalReplacements = 0;

  for (const filePath of files) {
    // Пропускаем сам файл токенов
    const relPath = path.relative(process.cwd(), filePath).replace(/\\/g, '/');
    if (relPath.includes('styles/tokens/')) {
      continue;
    }

    const content = fs.readFileSync(filePath, 'utf-8');
    let newContent = content;
    let fileReplacements = 0;

    for (const rule of RGBA_MAP) {
      newContent = newContent.replace(rule.pattern, (match) => {
        fileReplacements++;
        totalReplacements++;
        return rule.token;
      });
    }

    if (fileReplacements > 0) {
      fs.writeFileSync(filePath, newContent, 'utf-8');
      totalFixedFiles++;
      console.log(`  ✨ [${fileReplacements} замен] ${relPath}`);
    }
  }

  console.log('\n=============================================');
  console.log(`🎯 Исправлено файлов с цветами: ${totalFixedFiles}`);
  console.log(`🪄 Всего заменено RGBA на токены: ${totalReplacements}`);
  console.log('=============================================\n');
}

run();
