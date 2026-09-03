import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dirsToScan = [
  'apps/spa/src',
  'packages/components/src',
  'packages/resources/src',
  'packages/word-vibe/src'
];

let cssFiles = [];
let vueFilesWithStyleTags = [];
let vueFilesWithInlineStyles = [];

let totalInlineStyles = 0;
let totalCssLines = 0;
let totalVueStyleLines = 0;

function scanDir(dir) {
  if (!fs.existsSync(dir)) return;
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      if (['node_modules', 'dist', 'target', '.git', 'dist-tauri'].includes(file)) continue;
      scanDir(fullPath);
    } else {
      if (file.endsWith('.css')) {
        const content = fs.readFileSync(fullPath, 'utf8');
        const lines = content.split('\n').length;
        cssFiles.push({ path: fullPath, lines });
        totalCssLines += lines;
      } else if (file.endsWith('.vue')) {
        const content = fs.readFileSync(fullPath, 'utf8');
        
        // Поиск встроенных (inline) <style> тегов с CSS кодом внутри
        const styleRegex = /<style[^>]*>([\s\S]*?)<\/style>/g;
        let match;
        let hasInlineStyleTag = false;
        let linesInStyle = 0;
        while ((match = styleRegex.exec(content)) !== null) {
          const innerCss = match[1].trim();
          if (innerCss.length > 0) {
            hasInlineStyleTag = true;
            linesInStyle += innerCss.split('\n').length;
          }
        }
        if (hasInlineStyleTag) {
          vueFilesWithStyleTags.push({ path: fullPath, lines: linesInStyle });
          totalVueStyleLines += linesInStyle;
        }
        
        // Поиск inline стилей style="..."
        const inlineStyleRegex = /style=\"[^\"]*\"/g;
        const inlineMatches = content.match(inlineStyleRegex);
        if (inlineMatches && inlineMatches.length > 0) {
          vueFilesWithInlineStyles.push({ path: fullPath, count: inlineMatches.length });
          totalInlineStyles += inlineMatches.length;
        }
      }
    }
  }
}

// Запускаем сканирование
dirsToScan.forEach(scanDir);

// Сортировка по убыванию
cssFiles.sort((a, b) => b.lines - a.lines);
vueFilesWithStyleTags.sort((a, b) => b.lines - a.lines);
vueFilesWithInlineStyles.sort((a, b) => b.count - a.count);

// Формируем отчет
let report = '=== CSS Анализ Проекта ===\n\n';

report += `Всего .css файлов: ${cssFiles.length} (${totalCssLines} строк)\n`;
report += `Всего .vue файлов со <style> тегами: ${vueFilesWithStyleTags.length} (${totalVueStyleLines} строк CSS внутри)\n`;
report += `Всего .vue файлов с inline стилями (style="..."): ${vueFilesWithInlineStyles.length} (${totalInlineStyles} вхождений)\n\n`;

report += '--- Топ 10 самых больших .css файлов ---\n';
cssFiles.slice(0, 10).forEach(f => report += `${f.lines} строк - ${f.path}\n`);

report += '\n--- Топ 15 .vue файлов с самым большим объемом CSS в <style> ---\n';
vueFilesWithStyleTags.slice(0, 15).forEach(f => report += `${f.lines} строк - ${f.path}\n`);

report += '\n--- Топ 15 .vue файлов с наибольшим количеством inline-стилей ---\n';
vueFilesWithInlineStyles.slice(0, 15).forEach(f => report += `${f.count} вхождений style="..." - ${f.path}\n`);

report += '\n\nДетальный список всех .css файлов:\n';
cssFiles.forEach(f => report += `${f.lines} строк - ${f.path}\n`);

// Сохраняем в файл
const outputPath = path.join(__dirname, 'css_analysis.txt');
fs.writeFileSync(outputPath, report, 'utf8');

console.log('Анализ завершен. Результаты сохранены в файл: ' + outputPath);
