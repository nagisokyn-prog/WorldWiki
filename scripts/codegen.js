import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const WORKSPACE_ROOT = path.resolve(__dirname, '..');
const MAIN_RS_PATH = path.join(WORKSPACE_ROOT, 'src-tauri/src/main.rs');
const LOGIC_DIRS = [
    path.join(WORKSPACE_ROOT, 'src-tauri/crates/worldwiki-tauri/src/commands'),
    path.join(WORKSPACE_ROOT, 'src-tauri/src/logic'),
    path.join(WORKSPACE_ROOT, 'tauri-surreal-kit/backend/tauri_shell/src/logic')
];
const OUTPUT_PATH = path.join(WORKSPACE_ROOT, 'apps/spa/src/ts/services/api.client.ts');

function getRsFilesRecursively(dir) {
    let results = [];
    if (!fs.existsSync(dir)) return results;
    const list = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of list) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            results = results.concat(getRsFilesRecursively(fullPath));
        } else if (entry.isFile() && entry.name.endsWith('.rs')) {
            results.push(fullPath);
        }
    }
    return results;
}

// --- Типы ---
function rustTypeToTs(rustType) {
    let t = rustType.trim();
    
    // Удаляем & и &mut
    t = t.replace(/^&mut\s*/, '').replace(/^&\s*/, '');
    
    if (t === 'String' || t === '&str' || t === 'char') return 'string';
    if (t === 'i32' || t === 'u32' || t === 'i64' || t === 'u64' || t === 'f32' || t === 'f64' || t === 'usize' || t === 'u8') return 'number';
    if (t === 'bool') return 'boolean';
    if (t === 'serde_json::Value' || t === 'Value') return 'unknown';
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

    // Map/Dict (HashMap<K, V>, BTreeMap<K, V>)
    const mapMatch = t.match(/^(?:HashMap|BTreeMap|Map)<(.*),\s*(.*)>$/);
    if (mapMatch) {
        return `Record<${rustTypeToTs(mapMatch[1])}, ${rustTypeToTs(mapMatch[2])}>`;
    }
    if (t.startsWith('HashMap') || t.startsWith('BTreeMap') || t.startsWith('Map<')) return 'Record<string, unknown>';
    if (t === 'ChapterHierarchy' || t === 'HierarchyDto') return 'ChapterHierarchy';
    if (t === 'Project' || t === 'ProjectData') return 'ProjectSummary';
    
    // Остальное (предполагаем, что это доменные структуры, сгенерированные ts-rs)
    // Убираем возможные пути модулей
    t = t.split('::').pop();
    
    // Проверяем, существует ли этот тип в generated/
    // Если нет, то возвращаем unknown, чтобы не ломать TS и не плодить any
    const typeFilePath = path.join(WORKSPACE_ROOT, 'apps/spa/src/ts/types/generated', `${t}.ts`);
    if (!fs.existsSync(typeFilePath)) {
        return 'unknown';
    }
    
    return t;
}

function parseReturnType(rustRet) {
    if (!rustRet) return 'void';
    let t = rustRet.trim().replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
    
    // Обычно возвращается Result<T, E>
    const resMatch = t.match(/^Result<(.*),\s*.*>$/);
    if (resMatch) {
        t = resMatch[1].trim();
    }
    
    return rustTypeToTs(t);
}

function camelCase(str) {
    const s = str.replace(/_([a-z])/g, (_, g) => g.toUpperCase());
    return s.charAt(0).toLowerCase() + s.slice(1);
}

function toSnakeCase(str) {
    return str.replace(/([A-Z])/g, (g, c, i) => (i > 0 ? '_' : '') + c.toLowerCase());
}

// --- Парсинг .rs файлов ---
function scanLogicFiles() {
    const commands = new Map();
    
    for (const dir of LOGIC_DIRS) {
        if (!fs.existsSync(dir)) continue;
        
        const files = getRsFilesRecursively(dir);
        for (const filePath of files) {
            const content = fs.readFileSync(filePath, 'utf-8');
            
            // Ищем функции #[tauri::command]
            const regex = /#\[tauri::command\]\s*(?:#\[.*?\]\s*)*pub\s+(?:async\s+)?fn\s+([a-zA-Z0-9_]+)(?:<.*?>)?\s*\((.*?)\)(?:\s*->\s*(.*?))?\s*\{/gs;
            
            let match;
            while ((match = regex.exec(content)) !== null) {
                const name = match[1];
                let argsStr = match[2];
                const retStr = match[3];
                
                // Удаляем комментарии из аргументов
                argsStr = argsStr.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
                
                const args = [];
                // Более умный сплит по запятым с учетом вложенности <>
                const argParts = [];
                let current = '';
                let angleDepth = 0;
                for (let i = 0; i < argsStr.length; i++) {
                    const c = argsStr[i];
                    if (c === '<') angleDepth++;
                    if (c === '>') angleDepth--;
                    if (c === ',' && angleDepth === 0) {
                        if (current.trim()) argParts.push(current.trim());
                        current = '';
                    } else {
                        current += c;
                    }
                }
                if (current.trim()) argParts.push(current.trim());
                
                for (let part of argParts) {
                    if (part.startsWith('mut ')) part = part.substring(4);
                    const colonIdx = part.indexOf(':');
                    if (colonIdx === -1) continue;
                    
                    const argName = part.substring(0, colonIdx).trim();
                    const argType = part.substring(colonIdx + 1).trim();
                    
                    // Игнорируем Tauri стейты и Window/AppHandle
                    if (argType.includes('State') || argType.includes('AppHandle') || argType.includes('Window') || argType.includes('WebviewWindow')) {
                        continue;
                    }
                    
                    // Защита от пустых имен аргументов (может вызывать "(Missing)" в TS)
                    if (!argName) continue;
                    
                    args.push({
                        name: camelCase(argName),
                        originalName: argName,
                        type: rustTypeToTs(argType)
                    });
                }
                
const COMMAND_RETURN_TYPE_OVERRIDES = {
    'get_chapter_hierarchy': 'ChapterHierarchy',
    'get_entities_batch': 'Record<string, Entity[]>',
    'get_projects': 'ProjectSummary[]',
    'get_schema_history': 'Record<string, unknown>[]',
    'get_chapter_revisions': 'Record<string, unknown>[]',
    'get_entity_revisions': 'Record<string, unknown>[]',
    'get_custom_themes': 'Record<string, unknown>[]',
    'load_theme': 'Record<string, unknown>',
    'load_settings': 'Record<string, unknown>',
    'get_performance_styles': 'Record<string, unknown>'
};

                commands.set(name, {
                    name,
                    args,
                    ret: COMMAND_RETURN_TYPE_OVERRIDES[name] || parseReturnType(retStr)
                });
            }
        }
    }
    return commands;
}

const ENTRY_RS_PATH = fs.existsSync(path.join(WORKSPACE_ROOT, 'src-tauri/src/lib.rs'))
    ? path.join(WORKSPACE_ROOT, 'src-tauri/src/lib.rs')
    : path.join(WORKSPACE_ROOT, 'src-tauri/src/main.rs');

// --- Парсинг lib.rs / main.rs ---
function extractEntityCommandsBlock() {
    const content = fs.readFileSync(ENTRY_RS_PATH, 'utf-8');
    const startIdx = content.indexOf('surreal_domain::entity_commands![');
    if (startIdx === -1) throw new Error('entity_commands! not found in lib.rs or main.rs');
    
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
    const normalItems = remaining.split(',').map(i => i.trim().split('::').pop()).filter(i => i);
    normalCommands.push(...normalItems);
    
    return { normalCommands, entities, searchable, relations };
}

// --- Генерация TS ---
function generate() {
    const commandMap = scanLogicFiles();
    const block = extractEntityCommandsBlock();
    const { normalCommands, entities, searchable, relations } = parseCommandsBlock(block);
    
    const usedTypes = new Set();
    const addedFunctions = new Set();
    const outputLines = [
        `/**`,
        ` * @file api.client.ts`,
        ` * @description Автоматически сгенерированный клиент для Tauri invoke.`,
        ` * НЕ РЕДАКТИРОВАТЬ ВРУЧНУЮ! Запустите \`node scripts/codegen.js\` для обновления.`,
        ` */`,
        `import { invoke } from '@tauri-apps/api/core';`,
        `export interface SearchResult<T> { entity: T; score: number; kind: string; }`,
        `export interface AutoExtendResult { chapter_id?: string | null; arc_id?: string | null; volume_id?: string | null; updated_count?: number; }`,
        `export interface ChapterHierarchy { volumes: (Volume & { sort_order?: number; [key: string]: unknown })[]; arcs: (Arc & { volume_id?: string | null; sort_order?: number; [key: string]: unknown })[]; chapters: (Chapter & { arc_id?: string | null; volume_id?: string | null; sort_order?: number; [key: string]: unknown })[]; }`,
        `export interface ProjectSummary { id?: string; name: string; created_at?: string; genres?: string[]; perfLevel?: string; data?: Record<string, unknown>; stats?: Record<string, unknown>; icon?: string; [key: string]: unknown; }`,
        `// TODO: импорты типов из \`../types/generated/... \` будут добавлены ниже.`,
        ``
    ];
    
    function addFunction(rustName, args, retType) {
        const tsName = camelCase(rustName);
        if (addedFunctions.has(tsName)) return;
        addedFunctions.add(tsName);
        
        // Защита от пустых аргументов и плохих типов
        const validArgs = args.filter(a => a.name && a.name.length > 0 && a.name !== 'undefined');
        const argStr = validArgs.map(a => `${a.name}: ${a.type}`).join(', ');
        
        const invokeArgs = validArgs.length > 0 
            ? `, { ${validArgs.map(a => a.name).join(', ')} }`
            : '';
            
        outputLines.push(`export async function ${tsName}(${argStr}): Promise<${retType}> {`);
        outputLines.push(`    return await invoke('${rustName}'${invokeArgs});`);
        outputLines.push(`}`);
        outputLines.push(``);
        
        // Собираем типы для импортов
        const extractedTypes = [retType, ...validArgs.map(a => a.type)].flatMap(t => {
            const matches = t.match(/[A-Z][a-zA-Z0-9_]*/g);
            return matches || [];
        });
        for (const t of extractedTypes) {
            if (t !== 'String' && t !== 'Record' && t !== 'SearchResult' && t !== 'Unknown' && t !== 'ChapterHierarchy' && t !== 'ProjectSummary' && t !== 'AutoExtendResult' && t !== 'Promise') {
                const typeFilePath = path.join(WORKSPACE_ROOT, 'apps/spa/src/ts/types/generated', `${t}.ts`);
                if (fs.existsSync(typeFilePath)) {
                    usedTypes.add(t);
                }
            }
        }
    }
    
    usedTypes.add('Volume');
    usedTypes.add('Arc');
    usedTypes.add('Chapter');
    usedTypes.add('Entity');
    
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
        const nameLower = toSnakeCase(ent);
        
        addFunction(`get_${nameLower}s`, [{ name: 'project', originalName: 'project', type: 'string' }], `${structName}[]`);
        addFunction(`get_${nameLower}`, [{ name: 'id', originalName: 'id', type: 'string' }], `${structName} | null`);
        addFunction(`save_${nameLower}`, [{ name: 'project', originalName: 'project', type: 'string' }, { name: 'data', originalName: 'data', type: structName }], `${structName}`);
        addFunction(`delete_${nameLower}`, [{ name: 'id', originalName: 'id', type: 'string' }], `void`);
        
        if (searchable.includes(ent)) {
            addFunction(`search_${nameLower}s`, [
                { name: 'project', originalName: 'project', type: 'string' },
                { name: 'query', originalName: 'query', type: 'string' }
            ], `SearchResult<${structName}>[]`);
        }
    }
    
    outputLines.push(`// --- Relations CRUD ---`);
    for (const rel of relations) {
        const structName = rel;
        const nameLower = toSnakeCase(rel);
        const singular = nameLower.endsWith('s') ? nameLower.slice(0, -1) : nameLower;
        const plural = singular + 's';
        
        addFunction(`get_${plural}`, [
            { name: 'fromId', originalName: 'from_id', type: 'string' },
            { name: 'toId', originalName: 'to_id', type: 'string' }
        ], `${structName}[]`);
        addFunction(`create_${singular}`, [
            { name: 'fromId', originalName: 'from_id', type: 'string' },
            { name: 'toId', originalName: 'to_id', type: 'string' },
            { name: 'data', originalName: 'data', type: structName }
        ], `${structName}`);
        addFunction(`delete_${singular}`, [{ name: 'id', originalName: 'id', type: 'string' }], `void`);
    }
    
    // Добавляем импорты типов в начало
    const imports = Array.from(usedTypes).filter(t => t !== 'Any' && t !== 'Void' && t !== 'Unknown').map(t => {
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
