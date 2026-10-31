#!/usr/bin/env node

/**
 * ==============================================================================
 * 🕵️ AUDIT_TEST_SCHEMAS.MJS — СТАТИЧЕСКИЙ АНАЛИЗАТОР ТЕСТОВ И СХЕМЫ 3NF
 * ==============================================================================
 * Назначение: Быстрое выявление устаревших полей, нарушений 3NF и некорректных
 * конструкций SurrealQL в тестах и Rust-коде перед компиляцией и `cargo test`.
 *
 * Запуск:
 *   node scripts/audit_test_schemas.mjs
 *   node scripts/audit_test_schemas.mjs --all
 * ==============================================================================
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

// Цвета для красивого вывода в терминале
const colors = {
    reset: '\x1b[0m',
    bold: '\x1b[1m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    cyan: '\x1b[36m',
    dim: '\x1b[2m',
    magenta: '\x1b[35m'
};

/**
 * Реестр правил аудита 3NF инвариантов
 */
const AUDIT_RULES = [
    {
        id: 'S3NF-001',
        title: 'Удаленные поля projects (data / perfLevel)',
        desc: 'Поля data и perfLevel исключены из таблицы projects в пользу строгой 3NF и изоляции настроек.',
        check(content) {
            const matches = [];
            // Проверка CREATE/UPDATE projects с data или perfLevel до конца инструкции (до ';')
            const regex = /(?:CREATE\s+projects|UPDATE\s+projects|projects:[a-zA-Z0-9_]+)[^;]{0,300}?\b(data|perfLevel)\s*[:=]/gi;
            let m;
            while ((m = regex.exec(content)) !== null) {
                matches.push({ index: m.index, snippet: m[0].trim(), matchWord: m[1] });
            }
            return matches;
        },
        fix: 'Удалите поле data/perfLevel. Для настроек интерфейса используется локальное хранилище или отдельные DTO.'
    },
    {
        id: 'S3NF-002',
        title: 'Удаленные поля entity_schemas (icon / color)',
        desc: 'Поля icon и color удалены из entity_schemas.',
        check(content) {
            const matches = [];
            const regex = /CREATE\s+entity_schemas:[a-zA-Z0-9_]+[^;]{0,300}?\b(icon|color)\s*=/gi;
            let m;
            while ((m = regex.exec(content)) !== null) {
                matches.push({ index: m.index, snippet: m[0].trim(), matchWord: m[1] });
            }
            return matches;
        },
        fix: 'Удалите icon и color из запроса создания entity_schemas (используются type_key, type_name, fields_schema).'
    },
    {
        id: 'S3NF-003',
        title: 'Привязка calendars к project_id вместо planet_id',
        desc: 'В 3NF таблица calendars привязана к planet_id: record<planets>, прямого project_id нет.',
        check(content) {
            const matches = [];
            const regex = /CREATE\s+calendars:[a-zA-Z0-9_]+[^;]{0,300}?\bproject_id\s*=/gi;
            let m;
            while ((m = regex.exec(content)) !== null) {
                matches.push({ index: m.index, snippet: m[0].trim(), matchWord: 'project_id' });
            }
            return matches;
        },
        fix: 'Связывайте календарь через planet_id = planets:<id> (создайте планету с project_id).'
    },
    {
        id: 'S3NF-004',
        title: 'Создание chapters с прямым project_id',
        desc: 'В 3NF главы (chapters) принадлежат томам (volume_id: record<volumes>), а не напрямую проекту.',
        check(content) {
            const matches = [];
            const regex = /CREATE\s+chapters:[a-zA-Z0-9_]+[^;]{0,300}?\bproject_id\s*=/gi;
            let m;
            while ((m = regex.exec(content)) !== null) {
                matches.push({ index: m.index, snippet: m[0].trim(), matchWord: 'project_id' });
            }
            return matches;
        },
        fix: 'Замените project_id на volume_id = volumes:<id>.'
    },
    {
        id: 'S3NF-005',
        title: 'Создание entities с прямым project_id',
        desc: 'В 3NF сущности (entities) принадлежат схемам (schema_id: record<entity_schemas>), а не напрямую проекту.',
        check(content) {
            const matches = [];
            const regex = /CREATE\s+entities:[a-zA-Z0-9_]+[^;]{0,300}?\bproject_id\s*=/gi;
            let m;
            while ((m = regex.exec(content)) !== null) {
                matches.push({ index: m.index, snippet: m[0].trim(), matchWord: 'project_id' });
            }
            return matches;
        },
        fix: 'Замените project_id на schema_id = entity_schemas:<id>.'
    },
    {
        id: 'S3NF-006',
        title: 'Создание text_blocks с прямым project_id',
        desc: 'Блоки текста принадлежат главам (chapter_id: record<chapters>), у них нет project_id.',
        check(content) {
            const matches = [];
            const regex = /CREATE\s+text_blocks:[a-zA-Z0-9_]+[^;]{0,300}?\bproject_id\s*=/gi;
            let m;
            while ((m = regex.exec(content)) !== null) {
                matches.push({ index: m.index, snippet: m[0].trim(), matchWord: 'project_id' });
            }
            return matches;
        },
        fix: 'Удалите project_id из text_blocks (связь идет через chapter_id).'
    },
    {
        id: 'S3NF-007',
        title: 'Удаленное поле arc_type в story_arcs',
        desc: 'В таблице story_arcs нет поля arc_type (используются title, status).',
        check(content) {
            const matches = [];
            const regex = /(?:CREATE\s+story_arcs|story_arcs:[a-zA-Z0-9_]+)[^;]{0,250}?\barc_type\s*[:=]/gi;
            let m;
            while ((m = regex.exec(content)) !== null) {
                matches.push({ index: m.index, snippet: m[0].trim(), matchWord: 'arc_type' });
            }
            return matches;
        },
        fix: 'Удалите arc_type из story_arcs.'
    },
    {
        id: 'S3NF-008',
        title: 'Некорректные поля plot_promises (quote / m_abs / arc_type)',
        desc: 'В plot_promises цитаты живут в promise_milestones, а время — в timeline_event_id.',
        check(content) {
            const matches = [];
            const regex = /CREATE\s+plot_promises:[a-zA-Z0-9_]+[^;]{0,350}?\b(quote|m_abs|arc_type)\s*=/gi;
            let m;
            while ((m = regex.exec(content)) !== null) {
                matches.push({ index: m.index, snippet: m[0].trim(), matchWord: m[1] });
            }
            return matches;
        },
        fix: 'Для цитат используйте отношение promise_milestones, для времени — timeline_event_id.'
    },
    {
        id: 'S3NF-009',
        title: 'Использование устаревшей таблицы plans (заменена на todos)',
        desc: 'Таблица plans упразднена и заменена на нормализованную todos (3NF).',
        check(content) {
            const matches = [];
            const regex = /\b(?:CREATE\s+plans:[a-zA-Z0-9_]+|plans:[a-zA-Z0-9_]+|FROM\s+plans\b|TABLE\s+plans\b)/gi;
            let m;
            while ((m = regex.exec(content)) !== null) {
                matches.push({ index: m.index, snippet: m[0].trim(), matchWord: m[0] });
            }
            return matches;
        },
        fix: 'Замените plans на todos (с полями owner_id, text, is_done, sort_order).'
    },
    {
        id: 'S3NF-010',
        title: 'Двойной префикс в type::record(\'table\', \'table:id\')',
        desc: 'Вызов type::record("table", "table:id") создает table:⟨table:id⟩. Должен быть type::record("table:id") или type::record("table", id).',
        check(content) {
            const matches = [];
            const regex = /type::record\(\s*['"]([a-zA-Z0-9_]+)['"]\s*,\s*['"]\1:[^'"]+['"]\s*\)/gi;
            let m;
            while ((m = regex.exec(content)) !== null) {
                matches.push({ index: m.index, snippet: m[0].trim(), matchWord: m[0] });
            }
            return matches;
        },
        fix: 'Используйте type::record($id) с одним аргументом, если строка уже содержит "table:id".'
    },
    {
        id: 'S3NF-011',
        title: 'Прямой SELECT FROM entities WHERE project_id =',
        desc: 'Сущности не имеют прямого поля project_id, фильтрация идет через schema_id.project_id.',
        check(content) {
            const matches = [];
            const regex = /FROM\s+entities\b[^;]*?\bWHERE\s+project_id\s*=/gi;
            let m;
            while ((m = regex.exec(content)) !== null) {
                matches.push({ index: m.index, snippet: m[0].trim(), matchWord: 'project_id' });
            }
            return matches;
        },
        fix: 'Замените WHERE project_id = ... на WHERE schema_id.project_id = ...'
    },
    {
        id: 'S3NF-012',
        title: 'Прямой SELECT FROM chapters WHERE project_id =',
        desc: 'Главы не имеют прямого поля project_id, фильтрация идет через volume_id.project_id.',
        check(content) {
            const matches = [];
            const regex = /FROM\s+chapters\b[^;]*?\bWHERE\s+project_id\s*=/gi;
            let m;
            while ((m = regex.exec(content)) !== null) {
                matches.push({ index: m.index, snippet: m[0].trim(), matchWord: 'project_id' });
            }
            return matches;
        },
        fix: 'Замените WHERE project_id = ... на WHERE volume_id.project_id = ...'
    }
];

/**
 * Получить строку и столбец по индексу символа
 */
function getLineAndCol(content, index) {
    const lines = content.slice(0, index).split('\n');
    return {
        line: lines.length,
        col: lines[lines.length - 1].length + 1
    };
}

/**
 * Рекурсивный поиск .rs файлов
 */
function findRsFiles(dir) {
    const files = [];
    if (!fs.existsSync(dir)) return files;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            if (entry.name !== 'target' && entry.name !== '.git') {
                files.push(...findRsFiles(fullPath));
            }
        } else if (entry.isFile() && entry.name.endsWith('.rs')) {
            files.push(fullPath);
        }
    }
    return files;
}

/**
 * Главная функция аудита
 */
function runAudit() {
    const isAll = process.argv.includes('--all');
    console.log(`${colors.bold}${colors.cyan}==============================================================================${colors.reset}`);
    console.log(`${colors.bold}🕵️  CERBERUS S3NF AUDITOR — Проверка соответствия схеме SurrealDB 3NF${colors.reset}`);
    console.log(`${colors.cyan}==============================================================================${colors.reset}\n`);

    const targetDirs = [
        path.join(ROOT_DIR, 'src-tauri', 'src', 'tests')
    ];

    if (isAll) {
        targetDirs.push(
            path.join(ROOT_DIR, 'src-tauri', 'crates'),
            path.join(ROOT_DIR, 'src-tauri', 'src', 'logic')
        );
    }

    let allFiles = [];
    for (const dir of targetDirs) {
        allFiles.push(...findRsFiles(dir));
    }

    // Убираем дубликаты
    allFiles = [...new Set(allFiles)];

    console.log(`Сканирование файлов: ${colors.bold}${allFiles.length}${colors.reset} шт. (${isAll ? 'Режим: Полный монорепо' : 'Режим: Интеграционные тесты'})...\n`);

    let totalViolations = 0;
    const violationsByFile = new Map();

    for (const filePath of allFiles) {
        const relativePath = path.relative(ROOT_DIR, filePath);
        const content = fs.readFileSync(filePath, 'utf8');

        for (const rule of AUDIT_RULES) {
            const matches = rule.check(content, filePath);
            if (matches && matches.length > 0) {
                if (!violationsByFile.has(relativePath)) {
                    violationsByFile.set(relativePath, []);
                }
                for (const m of matches) {
                    const loc = getLineAndCol(content, m.index);
                    violationsByFile.get(relativePath).push({
                        rule,
                        loc,
                        snippet: m.snippet,
                        matchWord: m.matchWord
                    });
                    totalViolations++;
                }
            }
        }
    }

    if (totalViolations === 0) {
        console.log(`${colors.bold}${colors.green}✅ ВСЕ ЧИСТО! Ни одного нарушения инвариантов 3NF схемы не обнаружено.${colors.reset}\n`);
        return;
    }

    console.log(`${colors.bold}${colors.red}❌ Обнаружено нарушений схемы: ${totalViolations}${colors.reset}\n`);

    for (const [file, violations] of violationsByFile.entries()) {
        console.log(`${colors.bold}${colors.yellow}📁 ${file}${colors.reset}`);
        for (const v of violations) {
            console.log(`  ${colors.red}• [${v.rule.id}] ${v.rule.title}${colors.reset} (строка ${colors.cyan}${v.loc.line}:${v.loc.col}${colors.reset})`);
            console.log(`    ${colors.dim}Фрагмент:${colors.reset} ${v.snippet.replace(/\r?\n\s*/g, ' ').slice(0, 100)}...`);
            console.log(`    ${colors.green}💡 Совет:${colors.reset} ${v.rule.fix}\n`);
        }
    }

    console.log(`${colors.dim}Для полного аудита всего бэкенда запустите: node scripts/audit_test_schemas.mjs --all${colors.reset}\n`);
}

runAudit();

