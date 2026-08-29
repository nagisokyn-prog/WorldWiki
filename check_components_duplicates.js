const fs = require('fs');
const path = require('path');

console.log('╔══════════════════════════════════════════════════════════════════════════╗');
console.log('║               AUDIT: @worldwiki/components vs apps/spa                   ║');
console.log('╚══════════════════════════════════════════════════════════════════════════╝\n');

const pkgComponentsDir = path.resolve('packages/components/src/components/Vue');
const spaDir = path.resolve('apps/spa/src');

function getVueFiles(dir) {
  let results = [];
  if (!fs.existsSync(dir)) return results;
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      results = results.concat(getVueFiles(fullPath));
    } else if (file.endsWith('.vue')) {
      results.push(fullPath);
    }
  }
  return results;
}

function getAllCodeFiles(dir) {
  let results = [];
  if (!fs.existsSync(dir)) return results;
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      results = results.concat(getAllCodeFiles(fullPath));
    } else if (file.endsWith('.vue') || file.endsWith('.ts') || file.endsWith('.js')) {
      results.push(fullPath);
    }
  }
  return results;
}

// 1. Собираем компоненты из packages/components
const pkgVueFiles = getVueFiles(pkgComponentsDir);
const pkgMap = new Map();

for (const f of pkgVueFiles) {
  const base = path.basename(f);
  const rel = path.relative(process.cwd(), f);
  pkgMap.set(base, { fullPath: f, relPath: rel });
}

console.log(`📦 Всего компонентов в @worldwiki/components: ${pkgMap.size}`);

// 2. Ищем физические дубликаты в apps/spa
const spaVueFiles = getVueFiles(spaDir);
const physicalDuplicates = [];

for (const f of spaVueFiles) {
  const base = path.basename(f);
  if (pkgMap.has(base)) {
    const rel = path.relative(process.cwd(), f);
    physicalDuplicates.push({
      name: base,
      spaPath: rel,
      pkgPath: pkgMap.get(base).relPath
    });
  }
}

console.log('──────────────────────────────────────────────────────────────────────────');
console.log(`  1. ФИЗИЧЕСКИЕ ДУБЛИКАТЫ ВНУТРИ apps/spa: ${physicalDuplicates.length} шт.`);
console.log('──────────────────────────────────────────────────────────────────────────');

if (physicalDuplicates.length === 0) {
  console.log('  🎉 Отлично! Внутри apps/spa нет файлов, дублирующих имена из @worldwiki/components.');
} else {
  for (const item of physicalDuplicates) {
    console.log(`  ⚠️ [DUPLICATE] ${item.name}`);
    console.log(`     • В packages: ${item.pkgPath}`);
    console.log(`     • В apps/spa: ${item.spaPath}\n`);
  }
}

// 3. Анализируем использование компонентов из пакета внутри apps/spa
const spaCodeFiles = getAllCodeFiles(spaDir);
const usageMap = new Map();

for (const base of pkgMap.keys()) {
  const compName = base.replace('.vue', '');
  usageMap.set(compName, {
    base,
    pkgPath: pkgMap.get(base).relPath,
    importedIn: [],
    importTypes: new Set()
  });
}

for (const file of spaCodeFiles) {
  const content = fs.readFileSync(file, 'utf8');
  const relFile = path.relative(process.cwd(), file);

  for (const [compName, data] of usageMap.entries()) {
    // Ищем импорт из @worldwiki/components
    const pkgImportRegex = new RegExp(`import\\s+[^;]*?\\b${compName}\\b[^;]*?from\\s+['"]@worldwiki/components['"]`, 'g');
    // Ищем импорт напрямую по файловому пути
    const fileImportRegex = new RegExp(`from\\s+['"][^'"]*?/${compName}(\\.vue)?['"]`, 'g');
    // Ищем использование тега в шаблоне <ComponentName
    const templateTagRegex = new RegExp(`<${compName}[\\s/>]`, 'g');

    let used = false;
    if (pkgImportRegex.test(content)) {
      data.importTypes.add('@worldwiki/components');
      used = true;
    }
    if (fileImportRegex.test(content)) {
      data.importTypes.add('relative/direct');
      used = true;
    }
    if (templateTagRegex.test(content)) {
      data.importTypes.add('template-tag');
      used = true;
    }

    if (used) {
      data.importedIn.push(relFile);
    }
  }
}

console.log('──────────────────────────────────────────────────────────────────────────');
console.log('  2. СТАТУС ИСПОЛЬЗОВАНИЯ КОМПОНЕНТОВ ПАКЕТА В apps/spa');
console.log('──────────────────────────────────────────────────────────────────────────');

let unusedCount = 0;
for (const [compName, data] of usageMap.entries()) {
  const count = data.importedIn.length;
  if (count === 0) {
    unusedCount++;
    console.log(`  ⚪ [НЕ ИСПОЛЬЗУЕТСЯ]: ${compName} (${data.pkgPath})`);
  } else {
    const types = Array.from(data.importTypes).join(', ');
    console.log(`  ✅ [АКТИВЕН]: ${compName} — используется в ${count} файлах (${types})`);
  }
}

console.log('──────────────────────────────────────────────────────────────────────────');
console.log(`  ИТОГО: Из ${usageMap.size} компонентов пакета активно используются ${usageMap.size - unusedCount}, не используются: ${unusedCount}`);
console.log('──────────────────────────────────────────────────────────────────────────\n');
