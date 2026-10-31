#!/usr/bin/env node
/**
 * Скрипт поиска всех #[tauri::command] внутри src-tauri,
 * подходящих для замены макросами (forward_ipc! или bridge_command!).
 *
 * Запуск: node scripts/find_macroable_commands.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const TAURI_SRC = path.join(ROOT_DIR, 'src-tauri');

function getRsFilesRecursively(dir) {
    let files = [];
    if (!fs.existsSync(dir)) return files;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            if (entry.name !== 'target') {
                files = files.concat(getRsFilesRecursively(fullPath));
            }
        } else if (entry.isFile() && entry.name.endsWith('.rs')) {
            files.push(fullPath);
        }
    }
    return files;
}

/**
 * Извлекает тело функции с учетом баланса фигурных скобок
 */
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
                    body: code.slice(openBrace + 1, i).trim(),
                    endIndex: i + 1
                };
            }
        }
    }

    return null;
}

/**
 * Анализирует тело команды и определяет пригодность к замене макросом
 */
function analyzeCommand(fnName, argsStr, retType, body, filePath, lineNum) {
    const cleanBody = body
        .replace(/\/\/.*/g, '')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .trim();

    const normalizedBody = cleanBody.replace(/\s+/g, ' ');

    // Проверяем аргументы на наличие UI / Window / AppHandle
    const hasAppHandle = /\b(AppHandle|app:\s*tauri::AppHandle|app:\s*AppHandle)\b/.test(argsStr);
    const hasWindow = /\b(Window|WebviewWindow)\b/.test(argsStr);
    const hasState = /\b(State|state:\s*tauri::State|state:\s*State)\b/.test(argsStr);

    // Паттерн 1: Hexagonal Service delegation (bridge_command)
    // state.services.<group>.<method>(...).await.map_err(...)
    // или state.services.<group>.<method>(...).map_err(...)
    const serviceMatch = normalizedBody.match(/^state\s*\.\s*services\s*\.\s*([a-zA-Z0-9_]+)\s*\.\s*([a-zA-Z0-9_]+)\s*\((.*?)\)(?:\s*\.await)?\s*\.map_err\s*\(\s*(?:IpcError::from|\$crate::error::IpcError::from|crate::error::IpcError::from)\s*\)\s*;?$/);

    if (serviceMatch && !hasAppHandle && !hasWindow) {
        return {
            status: 'CANDIDATE_BRIDGE_MACRO',
            serviceGroup: serviceMatch[1],
            serviceMethod: serviceMatch[2],
            args: serviceMatch[3].trim(),
            reason: `Прямое делегирование в state.services.${serviceMatch[1]}.${serviceMatch[2]}`
        };
    }

    // Паттерн 2: Legacy *_inner(&state.db, ...) delegation (forward_ipc)
    const legacyMatch = normalizedBody.match(/^([a-zA-Z0-9_]+_inner)\s*\(\s*&state\.db(?:,\s*(.*?))?\s*\)(?:\s*\.await)?\s*;?$/);

    if (legacyMatch && !hasAppHandle && !hasWindow) {
        return {
            status: 'CANDIDATE_FORWARD_IPC',
            innerFn: legacyMatch[1],
            args: legacyMatch[2] ? legacyMatch[2].trim() : '',
            reason: `Прямое делегирование в ${legacyMatch[1]}`
        };
    }

    // Причины, почему НЕ подходит для простого макроса:
    const disqualifications = [];

    if (hasAppHandle) disqualifications.push('Принимает AppHandle (Tauri lifecycle/path/fs)');
    if (hasWindow) disqualifications.push('Принимает Window (UI context/events)');
    if (normalizedBody.includes('app.emit(') || normalizedBody.includes('emit(')) disqualifications.push('Эмитит события (app.emit / window.emit)');
    if (normalizedBody.includes('query(') || normalizedBody.includes('Surql')) disqualifications.push('Содержит сырые SQL/SurrealDB запросы внутри IPC');
    if (normalizedBody.includes('fs::') || normalizedBody.includes('download_dir(')) disqualifications.push('Прямая работа с файловой системой / путями');
    if (normalizedBody.includes('eprintln!') || normalizedBody.includes('println!') || normalizedBody.includes('tracing::')) disqualifications.push('Кастомное логирование / трейсинг');
    if (cleanBody.split(';').filter(s => s.trim().length > 0).length > 2) disqualifications.push('Многошаговая логика (> 1 инструкции в теле)');
    if (normalizedBody.includes('match ') || normalizedBody.includes('if ') || normalizedBody.includes('for ')) disqualifications.push('Ветвления и управляющие конструкции (if/match/for)');

    return {
        status: 'NOT_SUITABLE',
        reason: disqualifications.length > 0 ? disqualifications.join('; ') : 'Кастомная бизнес-логика в теле'
    };
}

function scanCommands() {
    const files = getRsFilesRecursively(TAURI_SRC);
    const results = {
        bridgeCandidates: [],
        forwardIpcCandidates: [],
        notSuitable: [],
        alreadyMacros: []
    };

    for (const filePath of files) {
        const content = fs.readFileSync(filePath, 'utf-8');
        const relPath = path.relative(ROOT_DIR, filePath).replace(/\\/g, '/');

        // 1. Поиск уже используемых forward_ipc!
        const forwardIpcRegex = /forward_ipc!\s*\(\s*([a-zA-Z0-9_]+)\s*\(/g;
        let matchMacro;
        while ((matchMacro = forwardIpcRegex.exec(content)) !== null) {
            const line = content.slice(0, matchMacro.index).split('\n').length;
            results.alreadyMacros.push({
                file: relPath,
                line,
                name: matchMacro[1],
                type: 'forward_ipc!'
            });
        }

        // 2. Поиск уже используемых bridge_command!
        const bridgeCmdRegex = /bridge_command!\s*\(\s*([a-zA-Z0-9_]+)\s*,/g;
        while ((matchMacro = bridgeCmdRegex.exec(content)) !== null) {
            const line = content.slice(0, matchMacro.index).split('\n').length;
            results.alreadyMacros.push({
                file: relPath,
                line,
                name: matchMacro[1],
                type: 'bridge_command!'
            });
        }

        // 3. Поиск явных #[tauri::command]
        const cmdRegex = /#\[tauri::command(?:|\(.*?\))\]\s*(?:pub\s+)?(?:async\s+)?fn\s+([a-zA-Z0-9_]+)\s*\(([\s\S]*?)\)\s*(?:->\s*([^{]+))?\s*\{/g;
        let cmdMatch;

        while ((cmdMatch = cmdRegex.exec(content)) !== null) {
            const fnName = cmdMatch[1];
            const argsStr = cmdMatch[2].trim();
            const retType = cmdMatch[3] ? cmdMatch[3].trim() : '()';
            const fnStartPos = cmdMatch.index;
            const line = content.slice(0, fnStartPos).split('\n').length;

            const extracted = extractFunctionBody(content, fnStartPos);
            if (!extracted) continue;

            const analysis = analyzeCommand(fnName, argsStr, retType, extracted.body, relPath, line);

            const record = {
                name: fnName,
                file: relPath,
                line,
                args: argsStr.replace(/\s+/g, ' '),
                retType: retType.replace(/\s+/g, ' '),
                analysis
            };

            if (analysis.status === 'CANDIDATE_BRIDGE_MACRO') {
                results.bridgeCandidates.push(record);
            } else if (analysis.status === 'CANDIDATE_FORWARD_IPC') {
                results.forwardIpcCandidates.push(record);
            } else {
                results.notSuitable.push(record);
            }
        }
    }

    return results;
}

// Запуск анализа
console.log('='.repeat(80));
console.log('🔍 СКАНЕР #[tauri::command] ВНУТРИ SRC-TAURI');
console.log('='.repeat(80));

const res = scanCommands();

console.log(`\n📦 УЖЕ ЗАМЕНЕНЫ НА МАКРОСЫ (${res.alreadyMacros.length}):`);
for (const m of res.alreadyMacros) {
    console.log(`  ✓ [${m.type}] ${m.name} (${m.file}:${m.line})`);
}

console.log(`\n🎯 КАНДИДАТЫ НА bridge_command! (Hexagonal Services, ${res.bridgeCandidates.length}):`);
for (const c of res.bridgeCandidates) {
    console.log(`  ⭐ ${c.name} (${c.file}:${c.line})`);
    console.log(`     -> ${c.analysis.reason}`);
}

console.log(`\n🎯 КАНДИДАТЫ НА forward_ipc! (Legacy DB Inner, ${res.forwardIpcCandidates.length}):`);
for (const c of res.forwardIpcCandidates) {
    console.log(`  ⭐ ${c.name} (${c.file}:${c.line})`);
    console.log(`     -> ${c.analysis.reason}`);
}

console.log(`\n⚠️ НЕ ПОДХОДЯТ ДЛЯ ПРОСТОГО МАКРОСА (${res.notSuitable.length}):`);
for (const n of res.notSuitable) {
    console.log(`  ✕ ${n.name} (${n.file}:${n.line})`);
    console.log(`     Причина: ${n.analysis.reason}`);
}

console.log('\n' + '='.repeat(80));
console.log('📊 ИТОГОВАЯ СВОДКА:');
console.log(`- Уже на макросах:            ${res.alreadyMacros.length}`);
console.log(`- Кандидатов на bridge_command: ${res.bridgeCandidates.length}`);
console.log(`- Кандидатов на forward_ipc:   ${res.forwardIpcCandidates.length}`);
console.log(`- Не подходят (кастом/UI/I/O):  ${res.notSuitable.length}`);
console.log('='.repeat(80));

