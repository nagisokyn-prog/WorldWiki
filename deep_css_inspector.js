import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const analysisRaw = fs.readFileSync(path.join(__dirname, 'css_analysis.txt'), 'utf8');

// Собираем все пути файлов из css_analysis.txt
const lines = analysisRaw.split('\n');
const cssFiles = [];
const vueStyleFiles = [];
const vueInlineFiles = [];

let section = '';
for (const line of lines) {
  const trimmed = line.trim();
  if (trimmed.startsWith('--- Топ') || trimmed.startsWith('Детальный список')) {
    section = trimmed;
    continue;
  }
  if (!trimmed || trimmed.startsWith('===')) continue;

  const matchCss = trimmed.match(/^\d+ строк - (.+\.css)$/);
  if (matchCss) {
    if (!cssFiles.includes(matchCss[1])) cssFiles.push(matchCss[1]);
  }

  const matchVueStyle = trimmed.match(/^\d+ строк - (.+\.vue)$/);
  if (matchVueStyle) {
    if (!vueStyleFiles.includes(matchVueStyle[1])) vueStyleFiles.push(matchVueStyle[1]);
  }

  const matchVueInline = trimmed.match(/^\d+ вхождений style="\.\.\." - (.+\.vue)$/);
  if (matchVueInline) {
    if (!vueInlineFiles.includes(matchVueInline[1])) vueInlineFiles.push(matchVueInline[1]);
  }
}

// Также найдем вообще ВСЕ .vue файлы в проекте со style тегами или инлайнами
const allVueFiles = [];
function findVue(dir) {
  if (!fs.existsSync(dir)) return;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const ent of entries) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (!['node_modules', 'dist', 'target', '.git'].includes(ent.name)) {
        findVue(full);
      }
    } else if (ent.name.endsWith('.vue')) {
      allVueFiles.push(full);
    }
  }
}
findVue('apps/spa/src');
findVue('packages/components/src');
findVue('packages/resources/src');

const detailedReport = {
  cssFilesAnalysis: [],
  vueStylesAnalysis: [],
  vueInlineAnalysis: []
};

// 1. Анализ всех .css файлов
for (const relPath of cssFiles) {
  const fullPath = path.join(__dirname, relPath);
  if (fs.existsSync(fullPath)) {
    const content = fs.readFileSync(fullPath, 'utf8');
    const lineCount = content.split('\n').length;
    const selectors = (content.match(/([.#a-zA-Z0-9_\-\s:>,\*\[\]\(\)="']+)\s*\{/g) || [])
      .map(s => s.replace('{', '').trim())
      .slice(0, 8); // первые 8 селекторов для понимания контекста
    const hasVariables = /--[a-zA-Z0-9_-]+:/.test(content);
    const hasKeyframes = /@keyframes/.test(content);
    const hasMedia = /@media/.test(content);
    
    detailedReport.cssFilesAnalysis.push({
      file: relPath,
      lines: lineCount,
      hasVariables,
      hasKeyframes,
      hasMedia,
      sampleSelectors: selectors
    });
  }
}

// 2. Анализ всех .vue файлов
for (const fullPath of allVueFiles) {
  const relPath = path.relative(__dirname, fullPath);
  const content = fs.readFileSync(fullPath, 'utf8');
  
  // Style tags
  const styleMatch = content.match(/<style([^>]*)>([\s\S]*?)<\/style>/g);
  if (styleMatch) {
    let totalLines = 0;
    const scopes = [];
    for (const sm of styleMatch) {
      const isScoped = sm.includes('scoped');
      const srcMatch = sm.match(/src=["']([^"']+)["']/);
      const innerLines = sm.split('\n').length;
      totalLines += innerLines;
      scopes.push({ scoped: isScoped, src: srcMatch ? srcMatch[1] : null, lines: innerLines });
    }
    detailedReport.vueStylesAnalysis.push({
      file: relPath,
      totalLines,
      styles: scopes
    });
  }

  // Inline styles
  const inlines = [];
  const inlineRegex = /style="([^"]*)"/g;
  let m;
  while ((m = inlineRegex.exec(content)) !== null) {
    inlines.push(m[1].trim());
  }
  if (inlines.length > 0) {
    detailedReport.vueInlineAnalysis.push({
      file: relPath,
      count: inlines.length,
      sampleStyles: inlines.slice(0, 5)
    });
  }
}

// Сортировка
detailedReport.vueStylesAnalysis.sort((a, b) => b.totalLines - a.totalLines);
detailedReport.vueInlineAnalysis.sort((a, b) => b.count - a.count);

fs.writeFileSync(path.join(__dirname, 'deep_css_inventory.json'), JSON.stringify(detailedReport, null, 2), 'utf8');
console.log('Deep inventory written to deep_css_inventory.json');
