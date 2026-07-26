import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const WORKSPACE_ROOT = path.resolve(__dirname, '..');
const MAIN_RS_PATH = path.join(WORKSPACE_ROOT, 'src-tauri/src/main.rs');
const LOGIC_DIRS = [
    path.join(WORKSPACE_ROOT, 'src-tauri/src/logic'),
    path.join(WORKSPACE_ROOT, 'tauri-surreal-kit/backend/tauri_shell/src/logic')
];
const OUTPUT_PATH = path.join(WORKSPACE_ROOT, 'apps/spa/src/ts/services/api.client.ts');

// --- Типы ---
function rustTypeToTs(rustType) {
    let t = rustType.trim();
    
    // Удаляем & и &mut
    t = t.replace(/^&mut\s*/, '').replace(/^&\s*/, '');
    
    if (t === 'String' || t === '&str' || t === 'char') return 'string';
    if (t === 'i32' || t === 'u32' || t === 'i64' || t === 'u64' || t === 'f32' || t === 'f64' || t === 'usize') return 'number';
    if (t === 'bool') return 'boolean';
    if (t === 'serde_json::Value') return 'any';
    if (t === '()') return 'void';
    
    // Vec<T>
    const vecMatch = t.match(/^Vec<(.*)>$/);
    if (vecMatch) return `${rustTypeToTs(vecMatch[1])}[]`;
    
    // Option<T>
    const optMatch = t.match(/^Option<(.*)>$/);
    if (optMatch) return `${rustTypeToTs(optMatch[1])} | null`;
    
    // SearchResult<T>
    const searchMatch = t.match(/^surreal_domain::SearchResult<(.*)>$/);
    if (searchMatch) return `SearchResult<${rustTypeToTs(searchMatch[1])}>`;

    // Map/Dict (простая эвристика)
    if (t.startsWith('HashMap') || t.startsWith('BTreeMap')) return 'Record<string, any>';
    
    // Остальное (предполагаем, что это доменные структуры, сгенерированные ts-rs)
    // Убираем возможные пути модулей
    t = t.split('::').pop();
    return t;
}

function parseReturnType(rustRet) {
    if (!rustRet) return 'void';
    let t = rustRet.trim();
    
    // Обычно возвращается Result<T, E>
    const resMatch = t.match(/^Result<(.*),\s*.*>$/);
    if (resMatch) {
        t = resMatch[1].trim();
    }
    
    return rustTypeToTs(t);
}

function camelCase(str) {
    return str.replace(/_([a-z])/g, (g) => g[1].toUpperCase());
}

// --- Парсинг .rs файлов ---
function scanLogicFiles() {
    const commands = new Map();
    
    for (const dir of LOGIC_DIRS) {
        if (!fs.existsSync(dir)) continue;
        
        const files = fs.readdirSync(dir).filter(f => f.endsWith('.rs'));
        for (const file of files) {
            const content = fs.readFileSync(path.join(dir, file), 'utf-8');
            
            // Ищем функции #[tauri::command]
            const regex = /#\[tauri::command\]\s*(?:#\[.*?\]\s*)*pub\s+(?:async\s+)?fn\s+([a-zA-Z0-9_]+)\s*\((.*?)\)(?:\s*->\s*(.*?))?\s*\{/gs;
            
            let match;
            while ((match = regex.exec(content)) !== null) {
                const name = match[1];
                const argsStr = match[2];
                const retStr = match[3];
                
                const args = [];
                // Очень простой парсинг аргументов
                const argParts = argsStr.split(',').map(a => a.trim()).filter(a => a);
                for (let part of argParts) {
                    if (part.startsWith('mut ')) part = part.substring(4);
                    const colonIdx = part.indexOf(':');
                    if (colonIdx === -1) continue;
                    
                    const argName = part.substring(0, colonIdx).trim();
                    const argType = part.substring(colonIdx + 1).trim();
                    
                    // Игнорируем Tauri стейты
                    if (argType.includes('tauri::State') || argType.includes('tauri::AppHandle') || argType.includes('tauri::Window')) {
                        continue;
                    }
                    
                    args.push({
                        name: camelCase(argName),
                        originalName: argName,
                        type: rustTypeToTs(argType)
                    });
                }
                
                commands.set(name, {
                    name,
                    args,
                    ret: parseReturnType(retStr)
                });
            }
        }
    }
    return commands;
}

// --- Парсинг main.rs ---
function extractEntityCommandsBlock() {
    const content = fs.readFileSync(MAIN_RS_PATH, 'utf-8');
    const startIdx = content.indexOf('surreal_domain::entity_commands![');
    if (startIdx === -1) throw new Error('entity_commands! not found in main.rs');
    
    const blockStart = content.indexOf('[', startIdx) + 1;
    let openCount = 1;
    let blockEnd = -1;
    
    for (let i = blockStart; i < content.length; i++) {
        if (content[i] === '[') openCount++;
        if (content[i] === ']') openCount--;
        if (openCount === 0) {
            blockEnd = i;
            break;
        }
    }
    
    return content.substring(blockStart, blockEnd);
}

function parseCommandsBlock(block) {
    const normalCommands = [];
    const entities = [];
    const searchable = [];
    const relations = [];
    
    // Убираем комментарии
    const cleanBlock = block.replace(/\/\/.*$/gm, '').replace(/\n/g, ' ');
    
    // Парсим @directives: [...]
    const dirRegex = /@([a-z]+)\s*:\s*\[(.*?)\]/g;
    let match;
    let remaining = cleanBlock;
    
    while ((match = dirRegex.exec(cleanBlock)) !== null) {
        const type = match[1];
        const items = match[2].split(',').map(i => i.trim()).filter(i => i);
        if (type === 'entities') entities.push(...items);
        if (type === 'searchable') searchable.push(...items);
        if (type === 'relations') relations.push(...items);
        
        remaining = remaining.replace(match[0], '');
    }
    
    // Остатки - это normal commands
    const normalItems = remaining.split(',').map(i => i.trim()).filter(i => i);
    normalCommands.push(...normalItems);
    
    return { normalCommands, entities, searchable, relations };
}

// --- Генерация TS ---
function generate() {
    const commandMap = scanLogicFiles();
    const block = extractEntityCommandsBlock();
    const { normalCommands, entities, searchable, relations } = parseCommandsBlock(block);
    
    const usedTypes = new Set();
    const outputLines = [
        `/**`,
        ` * @file api.client.ts`,
        ` * @description Автоматически сгенерированный клиент для Tauri invoke.`,
        ` * НЕ РЕДАКТИРОВАТЬ ВРУЧНУЮ! Запустите \`node scripts/codegen.js\` для обновления.`,
        ` */`,
        `import { invoke } from '@tauri-apps/api/core';`,
        `import type { SearchResult } from './Entity/entity.types';`,
        `// TODO: импорты типов из \`../types/generated/... \` будут добавлены ниже.`,
        ``
    ];
    
    function addFunction(rustName, args, retType) {
        const tsName = camelCase(rustName);
        const argStr = args.map(a => `${a.name}: ${a.type}`).join(', ');
        const invokeArgs = args.length > 0 
            ? `, { ${args.map(a => a.name === a.originalName ? a.name : `'${a.originalName}': ${a.name}`).join(', ')} }`
            : '';
            
        outputLines.push(`export async function ${tsName}(${argStr}): Promise<${retType}> {`);
        outputLines.push(`    return await invoke('${rustName}'${invokeArgs});`);
        outputLines.push(`}`);
        outputLines.push(``);
        
        // Собираем типы для импортов
        const types = [retType, ...args.map(a => a.type)].flatMap(t => t.replace(/\[\]/g, '').split('|')).map(t => t.trim());
        for (const t of types) {
            if (/^[A-Z]/.test(t) && t !== 'String' && t !== 'Record<string, any>' && !t.startsWith('SearchResult')) {
                usedTypes.add(t.split('<')[0]); // Убираем генерики для импорта
            }
        }
    }
    
    outputLines.push(`// --- Normal Commands ---`);
    for (const cmd of normalCommands) {
        if (!commandMap.has(cmd)) {
            console.warn(`[WARNING] Command ${cmd} not found in logic files! Skipping.`);
            continue;
        }
        const meta = commandMap.get(cmd);
        addFunction(meta.name, meta.args, meta.ret);
    }
    
    outputLines.push(`// --- Entities CRUD ---`);
    for (const ent of [...entities, ...searchable]) {
        const structName = ent;
        const nameLower = ent.toLowerCase();
        
        addFunction(`get_${nameLower}s`, [{ name: 'projectId', originalName: 'project_id', type: 'string' }], `${structName}[]`);
        addFunction(`get_${nameLower}`, [{ name: 'id', originalName: 'id', type: 'string' }], `${structName} | null`);
        addFunction(`save_${nameLower}`, [{ name: 'data', originalName: 'data', type: structName }], `${structName}`);
        addFunction(`delete_${nameLower}`, [{ name: 'id', originalName: 'id', type: 'string' }], `void`);
        
        if (searchable.includes(ent)) {
            addFunction(`search_${nameLower}s`, [
                { name: 'projectId', originalName: 'project_id', type: 'string' },
                { name: 'query', originalName: 'query', type: 'string' }
            ], `SearchResult<${structName}>[]`);
        }
    }
    
    outputLines.push(`// --- Relations CRUD ---`);
    for (const rel of relations) {
        const structName = rel;
        const nameLower = rel.toLowerCase();
        const singular = nameLower.endsWith('s') ? nameLower.slice(0, -1) : nameLower;
        const plural = singular + 's';
        
        addFunction(`get_${plural}`, [
            { name: 'projectId', originalName: 'project_id', type: 'string' },
            { name: 'sourceId', originalName: 'source_id', type: 'string' }
        ], `${structName}[]`);
        addFunction(`create_${singular}`, [{ name: 'data', originalName: 'data', type: structName }], `${structName}`);
        addFunction(`delete_${singular}`, [{ name: 'id', originalName: 'id', type: 'string' }], `void`);
    }
    
    // Добавляем импорты типов в начало
    const imports = Array.from(usedTypes).filter(t => t !== 'Any' && t !== 'Void').map(t => {
        return `import type { ${t} } from '../types/generated/${t}';`;
    });
    
    // Заменяем placeholder
    const resultContent = outputLines.join('\n').replace(
        `// TODO: импорты типов из \`../types/generated/... \` будут добавлены ниже.`,
        imports.join('\n')
    );
    
    fs.writeFileSync(OUTPUT_PATH, resultContent, 'utf-8');
    console.log(`✅ Generated API client at ${OUTPUT_PATH}`);
}

generate();
