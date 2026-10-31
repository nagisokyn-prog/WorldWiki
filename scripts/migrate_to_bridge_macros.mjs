#!/usr/bin/env node
/**
 * Скрипт автоматической миграции #[tauri::command] кандидатов на bridge_command!
 *
 * Использование:
 *   node scripts/migrate_to_bridge_macros.mjs --dry-run
 *   node scripts/migrate_to_bridge_macros.mjs --write
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const TAURI_SRC = path.join(ROOT_DIR, 'src-tauri/crates/worldwiki-tauri/src/commands');

const isWriteMode = process.argv.includes('--write');

function getRsFilesRecursively(dir) {
    let files = [];
    if (!fs.existsSync(dir)) return files;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            files = files.concat(getRsFilesRecursively(fullPath));
        } else if (entry.isFile() && entry.name.endsWith('.rs')) {
            files.push(fullPath);
        }
    }
    return files;
}

function extractFunctionBody(code, startIndex) {
    const openBrace = code.indexOf('{', startIndex);
    if (openBrace === -1) return null;

    let depth = 1;
    let inString = false;
    let inChar = false;
    let escape = false;

    for (let i = openBrace + 1; i < code.length; i++) {
        const char = code[i];

        if (escape) {
            escape = false;
            continue;
        }

        if (char === '\\') {
            escape = true;
            continue;
        }

        if (char === '"' && !inChar) {
            inString = !inString;
            continue;
        }

        if (char === "'" && !inString) {
            inChar = !inChar;
            continue;
        }

        if (inString || inChar) continue;

        if (char === '{') {
            depth++;
        } else if (char === '}') {
            depth--;
            if (depth === 0) {
                return {
                    openBrace,
                    endIndex: i + 1,
                    body: code.slice(openBrace + 1, i).trim()
                };
            }
        }
    }

    return null;
}

function cleanParamStr(paramsStr) {
    const params = [];
    let current = '';
    let depth = 0;

    for (let i = 0; i < paramsStr.length; i++) {
        const char = paramsStr[i];
        if (char === '<' || char === '(' || char === '[' || char === '{') depth++;
        else if (char === '>' || char === ')' || char === ']' || char === '}') depth--;

        if (char === ',' && depth === 0) {
            const p = current.trim();
            if (p && !/^state\s*:/.test(p)) {
                params.push(p);
            }
            current = '';
        } else {
            current += char;
        }
    }

    const last = current.trim();
    if (last && !/^state\s*:/.test(last)) {
        params.push(last);
    }

    return params;
}

function processFile(filePath) {
    let content = fs.readFileSync(filePath, 'utf-8');
    const relPath = path.relative(ROOT_DIR, filePath).replace(/\\/g, '/');

    const cmdRegex = /#\[tauri::command(?:\(.*?\))?\]\s*(?:pub\s+)?(async\s+)?fn\s+([a-zA-Z0-9_]+)\s*\(([\s\S]*?)\)\s*(?:->\s*([^{]+))?\s*\{/g;
    let match;

    const replacements = [];

    while ((match = cmdRegex.exec(content)) !== null) {
        const isAsync = Boolean(match[1]);
        const fnName = match[2];
        const paramsRaw = match[3];
        const returnTypeRaw = match[4] ? match[4].trim() : '()';
        const startPos = match.index;

        const bodyData = extractFunctionBody(content, startPos);
        if (!bodyData) continue;

        const rawBody = bodyData.body;
        const normalizedBody = rawBody
            .replace(/\/\/.*/g, '')
            .replace(/\/\*[\s\S]*?\*\//g, '')
            .replace(/\s+/g, ' ')
            .trim();

        if (/\b(AppHandle|Window)\b/.test(paramsRaw)) continue;

        const serviceMatch = normalizedBody.match(/^state\s*\.\s*services\s*\.\s*([a-zA-Z0-9_]+)\s*\.\s*([a-zA-Z0-9_]+)\s*\((.*?)\)(?:\s*\.await)?\s*\.map_err\s*\(\s*(?:IpcError::from|\$crate::error::IpcError::from|crate::error::IpcError::from)\s*\)\s*;?$/);

        if (!serviceMatch) continue;

        const serviceGroup = serviceMatch[1];
        const serviceMethod = serviceMatch[2];
        const serviceArgs = serviceMatch[3].trim();

        const nonStateParams = cleanParamStr(paramsRaw);

        const syncPrefix = isAsync ? '' : 'sync ';
        let macroCall = '';

        if (nonStateParams.length === 0) {
            macroCall = `bridge_command!(\n    ${syncPrefix}${fnName}() -> ${returnTypeRaw}\n        => ${serviceGroup}.${serviceMethod}(${serviceArgs})\n);`;
        } else if (nonStateParams.length === 1) {
            macroCall = `bridge_command!(\n    ${syncPrefix}${fnName}(${nonStateParams[0]}) -> ${returnTypeRaw}\n        => ${serviceGroup}.${serviceMethod}(${serviceArgs})\n);`;
        } else {
            const formattedParams = nonStateParams.map(p => `        ${p},`).join('\n');
            macroCall = `bridge_command!(\n    ${syncPrefix}${fnName}(\n${formattedParams}\n    ) -> ${returnTypeRaw}\n        => ${serviceGroup}.${serviceMethod}(${serviceArgs})\n);`;
        }

        replacements.push({
            fnName,
            startPos,
            endPos: bodyData.endIndex,
            macroCall
        });
    }

    if (replacements.length === 0) return 0;

    console.log(`\n📄 ${relPath}: ${replacements.length} команд для миграции`);

    replacements.sort((a, b) => b.startPos - a.startPos);

    for (const r of replacements) {
        console.log(`   ⚡ [${r.fnName}] -> bridge_command!`);
        content = content.slice(0, r.startPos) + r.macroCall + content.slice(r.endPos);
    }

    // Добавляем импорт use crate::bridge_command; если его нет
    if (!content.includes('use crate::bridge_command;')) {
        const crateUseMatch = content.match(/use crate::[^\n]+;/);
        if (crateUseMatch) {
            const insertIdx = crateUseMatch.index + crateUseMatch[0].length;
            content = content.slice(0, insertIdx) + '\nuse crate::bridge_command;' + content.slice(insertIdx);
        } else {
            content = 'use crate::bridge_command;\n' + content;
        }
    }

    // Подчищаем неиспользуемые импорты State и AppState, если в файле не осталось других функций с ними
    const remainingFnMatches = content.match(/fn\s+[a-zA-Z0-9_]+\s*\([^)]*state:\s*State/g);
    if (!remainingFnMatches) {
        content = content.replace(/use tauri::State;\r?\n/, '');
        content = content.replace(/use crate::state::AppState;\r?\n/, '');
    }

    if (isWriteMode) {
        fs.writeFileSync(filePath, content, 'utf-8');
        console.log(`   💾 Записано в файл.`);
    }

    return replacements.length;
}

console.log('='.repeat(80));
console.log(`🚀 МИГРАЦИЯ #[tauri::command] НА bridge_command! [Режим: ${isWriteMode ? 'WRITE (применение)' : 'DRY RUN (просмотр)'}]`);
console.log('='.repeat(80));

const files = getRsFilesRecursively(TAURI_SRC);
let totalMigrated = 0;

for (const f of files) {
    totalMigrated += processFile(f);
}

console.log('\n' + '='.repeat(80));
console.log(`🏁 Всего команд ${isWriteMode ? 'мигрировано' : 'готово к миграции'}: ${totalMigrated}`);
if (!isWriteMode) {
    console.log(`👉 Чтобы применить изменения, выполните: node scripts/migrate_to_bridge_macros.mjs --write`);
    console.log(`   или через pnpm: pnpm migrate:macro-commands`);
}
console.log('='.repeat(80));
