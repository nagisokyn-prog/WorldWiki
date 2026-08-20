import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function getVueFiles(dir, fileList = []) {
  if (!fs.existsSync(dir)) return fileList;
  const files = fs.readdirSync(dir, { withFileTypes: true });
  for (const file of files) {
    const fullPath = path.join(dir, file.name);
    if (file.isDirectory()) {
      if (!['node_modules', 'dist', 'target', '.git'].includes(file.name)) {
        getVueFiles(fullPath, fileList);
      }
    } else if (file.name.endsWith('.vue')) {
      fileList.push(fullPath);
    }
  }
  return fileList;
}

const spaVue = getVueFiles(path.join(__dirname, 'apps/spa/src'));
const compVue = getVueFiles(path.join(__dirname, 'packages/components/src'));
const allVue = [...spaVue, ...compVue];

let extractedCount = 0;
let totalLinesSaved = 0;

for (const fullPath of allVue) {
  const relPath = path.relative(__dirname, fullPath).replace(/\\/g, '/');
  let content = fs.readFileSync(fullPath, 'utf8');

  // Ищем <style> теги без src="..."
  const styleRegex = /<style([^>]*)>([\s\S]*?)<\/style>/g;
  let match;
  let matches = [];
  while ((match = styleRegex.exec(content)) !== null) {
    const attrs = match[1];
    const cssBody = match[2].trim();
    if (!attrs.includes('src=') && cssBody.length > 0) {
      matches.push({
        fullMatch: match[0],
        attrs,
        isScoped: attrs.includes('scoped'),
        cssBody
      });
    }
  }

  if (matches.length > 0) {
    const baseName = path.basename(fullPath, '.vue');
    let targetSubDir = 'components';
    
    if (relPath.includes('features/ai')) targetSubDir = 'features/ai';
    else if (relPath.includes('features/chapters')) targetSubDir = 'features/chapters';
    else if (relPath.includes('features/entities')) targetSubDir = 'features/entities';
    else if (relPath.includes('features/schemas')) targetSubDir = 'features/schemas';
    else if (relPath.includes('features/timeline')) targetSubDir = 'features/timeline';
    else if (relPath.includes('features/sync')) targetSubDir = 'features/shell';
    else if (relPath.includes('features/shell')) targetSubDir = 'features/shell';
    else if (relPath.includes('packages/components')) targetSubDir = 'components';

    const targetDir = path.join(__dirname, `packages/resources/src/styles/${targetSubDir}`);
    fs.mkdirSync(targetDir, { recursive: true });

    let finalCssFile = path.join(targetDir, `${baseName}.css`);
    let finalImportPath = `@worldwiki/resources/styles/${targetSubDir}/${baseName}.css`;

    // Если файл уже существует, добавляем суффикс пути
    if (fs.existsSync(finalCssFile)) {
      const parentDirName = path.basename(path.dirname(fullPath));
      if (parentDirName && parentDirName !== targetSubDir) {
        finalCssFile = path.join(targetDir, `${parentDirName}_${baseName}.css`);
        finalImportPath = `@worldwiki/resources/styles/${targetSubDir}/${parentDirName}_${baseName}.css`;
      }
    }

    // Собираем весь CSS из всех найденных style блоков этого компонента
    let combinedCss = matches.map(m => m.cssBody).join('\n\n');
    fs.writeFileSync(finalCssFile, combinedCss + '\n', 'utf8');

    const isAnyScoped = matches.some(m => m.isScoped);
    const newStyleTag = `<style ${isAnyScoped ? 'scoped ' : ''}src="${finalImportPath}"></style>`;

    // Заменяем первый style тег на импорт, а остальные удаляем
    let isFirst = true;
    content = content.replace(styleRegex, (orig, attrs, body) => {
      if (!attrs.includes('src=') && body.trim().length > 0) {
        if (isFirst) {
          isFirst = false;
          return newStyleTag;
        }
        return '';
      }
      return orig;
    });

    fs.writeFileSync(fullPath, content, 'utf8');
    extractedCount++;
    totalLinesSaved += combinedCss.split('\n').length;
    console.log(`Extracted: ${relPath} -> ${finalImportPath}`);
  }
}

console.log(`\nDONE: Extracted styles from ${extractedCount} components (~${totalLinesSaved} lines of CSS)!`);
