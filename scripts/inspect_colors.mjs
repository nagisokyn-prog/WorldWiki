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

const HEX_RE = /#(?:[0-9a-fA-F]{3,4}){1,2}\b/g;
const RGB_HSL_RE = /\b(?:rgb|rgba|hsl|hsla)\s*\([^)]*\)/g;

function inspect() {
  const files = getAllCssFiles(STYLES_DIR);
  const hexMap = new Map();
  const rgbMap = new Map();

  for (const filePath of files) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');

    lines.forEach((line) => {
      const trimmed = line.trim();
      if (trimmed.startsWith('/*') || trimmed.startsWith('//')) return;

      const hexMatches = trimmed.match(HEX_RE);
      if (hexMatches) {
        hexMatches.forEach((h) => {
          hexMap.set(h.toLowerCase(), (hexMap.get(h.toLowerCase()) || 0) + 1);
        });
      }

      const rgbMatches = trimmed.match(RGB_HSL_RE);
      if (rgbMatches) {
        rgbMatches.forEach((r) => {
          rgbMap.set(r, (rgbMap.get(r) || 0) + 1);
        });
      }
    });
  }

  const sortedHex = [...hexMap.entries()].sort((a, b) => b[1] - a[1]);
  const sortedRgb = [...rgbMap.entries()].sort((a, b) => b[1] - a[1]);

  console.log('🎨 ТОП HEX ЦВЕТОВ:');
  sortedHex.slice(0, 15).forEach(([hex, count]) => {
    console.log(`  ${hex}: ${count} раз`);
  });

  console.log('\n🎨 ТОП RGB/RGBA/HSL:');
  sortedRgb.slice(0, 15).forEach(([rgb, count]) => {
    console.log(`  ${rgb}: ${count} раз`);
  });

  fs.writeFileSync(
    path.resolve('.cerberus/colors_analysis.json'),
    JSON.stringify({ hex: sortedHex, rgb: sortedRgb }, null, 2),
    'utf-8'
  );
  console.log('\n📄 Полный отчет сохранен в .cerberus/colors_analysis.json');
}

inspect();
