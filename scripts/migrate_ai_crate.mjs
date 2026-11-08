import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const srcAiDir = path.join(rootDir, 'src-tauri', 'crates', 'worldwiki-infrastructure', 'src', 'ai');
const targetCrateDir = path.join(rootDir, 'src-tauri', 'crates', 'worldwiki-ai');
const targetSrcDir = path.join(targetCrateDir, 'src');

console.log('🚀 Начинаем миграцию AI в отдельный крейт worldwiki-ai (v0.60.0)...');

if (!fs.existsSync(srcAiDir)) {
  console.error(`❌ Исходная папка не найдена: ${srcAiDir}`);
  process.exit(1);
}

// 1. Создаем структуру целевой папки
fs.mkdirSync(targetSrcDir, { recursive: true });

// 2. Рекурсивное копирование с авто-заменой путей crate::ai:: -> crate::
function copyAndTransformDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyAndTransformDir(srcPath, destPath);
    } else if (entry.isFile() && entry.name.endsWith('.rs')) {
      let content = fs.readFileSync(srcPath, 'utf8');

      // Преобразуем внутренние пути
      content = content.replaceAll('crate::ai::', 'crate::');

      // Убираем флаги фич внутри самого AI-крейта, так как весь крейт и есть AI
      content = content.replaceAll('#[cfg(feature = "ai-cloud")]\n', '');
      content = content.replaceAll('#[cfg(feature = "ai-local")]\n', '');

      fs.writeFileSync(destPath, content, 'utf8');
      console.log(`  ✓ Скопирован: ${path.relative(targetCrateDir, destPath)}`);
    }
  }
}

copyAndTransformDir(srcAiDir, targetSrcDir);

// 3. mod.rs -> lib.rs
const targetModRs = path.join(targetSrcDir, 'mod.rs');
const targetLibRs = path.join(targetSrcDir, 'lib.rs');

if (fs.existsSync(targetModRs)) {
  let modContent = fs.readFileSync(targetModRs, 'utf8');
  modContent = modContent.replaceAll('#[cfg(feature = "ai-local")]\n', '');
  fs.writeFileSync(targetLibRs, modContent, 'utf8');
  fs.unlinkSync(targetModRs);
  console.log('  ✓ mod.rs переименован в lib.rs');
}

// 4. Оставляем mock_ai в infrastructure для легковесных юнит-тестов ядра
const infraSrcDir = path.join(rootDir, 'src-tauri', 'crates', 'worldwiki-infrastructure', 'src');
const infraMockAiPath = path.join(infraSrcDir, 'mock_ai.rs');
const srcMockAi = path.join(srcAiDir, 'mock_ai.rs');
if (fs.existsSync(srcMockAi)) {
  fs.copyFileSync(srcMockAi, infraMockAiPath);
  console.log('  ✓ mock_ai.rs скопирован в worldwiki-infrastructure/src/mock_ai.rs');
}

// 5. Удаляем старую папку src/ai из worldwiki-infrastructure
fs.rmSync(srcAiDir, { recursive: true, force: true });
console.log('  ✓ Старая папка worldwiki-infrastructure/src/ai удалена');

console.log('\n✅ Файлы успешно перенесены в crates/worldwiki-ai/src!');
console.log('💡 Запусти: node scripts/migrate_ai_crate.mjs');
