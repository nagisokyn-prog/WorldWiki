/**
 * tauri-surreal-kit Setup Script
 * Run this script to rename the boilerplate placeholders to your own project details.
 * 
 * Usage: node setup.js
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const ask = (query) => new Promise(resolve => rl.question(query, resolve));

async function main() {
  console.log('\n🚀 Welcome to tauri-surreal-kit setup!\n');

  const projectName = await ask('1. Enter your Project Name (e.g., MyAwesomeApp): ');
  const bundleId = await ask('2. Enter your Bundle Identifier (e.g., com.myawesomeapp.dev): ');
  const crateName = projectName.toLowerCase().replace(/[^a-z0-9_]/g, '_');

  rl.close();

  if (!projectName || !bundleId) {
    console.error('❌ Project Name and Bundle ID are required. Aborting.');
    process.exit(1);
  }

  console.log(`\n⚙️  Configuring project: ${projectName} (${bundleId}) ...\n`);

  const replacements = [
    {
      file: 'frontend/package.json',
      replaces: [
        { from: /"name":\s*"tauri-surreal-kit"/g, to: `"name": "${crateName}-frontend"` }
      ]
    },
    {
      file: 'backend/tauri_shell/Cargo.toml',
      replaces: [
        { from: /name\s*=\s*"tauri_shell"/g, to: `name = "${crateName}"` }
      ]
    },
    {
      file: 'backend/tauri_shell/tauri.conf.json',
      replaces: [
        { from: /"productName":\s*"TauriSurrealKit"/g, to: `"productName": "${projectName}"` },
        { from: /"identifier":\s*"com\.worldwiki\.app"/g, to: `"identifier": "${bundleId}"` }
      ]
    }
  ];

  for (const rep of replacements) {
    const filePath = path.join(__dirname, rep.file);
    if (!fs.existsSync(filePath)) {
      console.warn(`⚠️  Warning: File not found: ${rep.file}`);
      continue;
    }

    let content = fs.readFileSync(filePath, 'utf8');
    let changed = false;

    for (const r of rep.replaces) {
      if (content.match(r.from)) {
        content = content.replace(r.from, r.to);
        changed = true;
      }
    }

    if (changed) {
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`✅ Updated: ${rep.file}`);
    }
  }

  console.log('\n🎉 Setup complete! You can now delete setup.js if you wish.\n');
  console.log('Next steps:');
  console.log('1. cd frontend && npm install');
  console.log('2. npm run tauri dev\n');
}

main().catch(console.error);
