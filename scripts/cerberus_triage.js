#!/usr/bin/env node

/**
 * 🛡️ Cerberus Baseline Triage & Strategic Debt Analyzer
 * 
 * Использование:
 *   node scripts/cerberus_triage.js                 # Полный интерактивный отчет
 *   node scripts/cerberus_triage.js --rule ARCH-032 # Детальный разбор по правилу
 *   node scripts/cerberus_triage.js --file <PATH>   # Нарушения в конкретном файле
 *   node scripts/cerberus_triage.js --cluster 1     # Нарушения первого стратегического кластера
 *   node scripts/cerberus_triage.js --markdown      # Экспорт дорожной карты в Markdown
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const projectRoot = path.resolve(__dirname, '..');
const baselinePath = path.join(projectRoot, 'cerberus-baseline.json');

if (!fs.existsSync(baselinePath)) {
    console.error(`❌ Baseline file not found at: ${baselinePath}`);
    process.exit(1);
}

const rawData = JSON.parse(fs.readFileSync(baselinePath, 'utf8'));

// Парсинг аргументов
const args = process.argv.slice(2);
const filterRule = getArgValue('--rule');
const filterFile = getArgValue('--file');
const filterCluster = getArgValue('--cluster');
const isMarkdown = args.includes('--markdown');

function getArgValue(flag) {
    const idx = args.indexOf(flag);
    return idx !== -1 && args[idx + 1] ? args[idx + 1] : null;
}

// 1. Агрегация данных
const stats = {
    total: rawData.length,
    byRule: {},
    byCrate: {},
    byFile: {},
    bySeverityCategory: {
        'Safety & Unsafe (AI-008, ROB-001)': 0,
        'Architecture & Layers (ARCH-001..005, ARCH-020)': 0,
        'God Modules & Pressure (ARCH-030..032)': 0,
        'Error Handling & Reliability (ERR-001..005)': 0,
        'Concurrency & Deadlocks (CONC-002..008)': 0,
        'Hygiene & Slop (AI-009, AI-013, SLOP-001)': 0,
        'Other': 0
    }
};

rawData.forEach(item => {
    const rule = item.rule || 'UNKNOWN';
    stats.byRule[rule] = (stats.byRule[rule] || 0) + 1;

    let file = (item.file || '').replace(/\\/g, '/');
    stats.byFile[file] = stats.byFile[file] || { total: 0, rules: {}, items: [] };
    stats.byFile[file].total++;
    stats.byFile[file].rules[rule] = (stats.byFile[file].rules[rule] || 0) + 1;
    stats.byFile[file].items.push(item);

    let crate = 'other';
    if (file.includes('crates/worldwiki-domain')) crate = 'worldwiki-domain (Core Domain)';
    else if (file.includes('crates/worldwiki-application')) crate = 'worldwiki-application (Use Cases)';
    else if (file.includes('crates/worldwiki-ports')) crate = 'worldwiki-ports (Contracts)';
    else if (file.includes('crates/worldwiki-infrastructure')) crate = 'worldwiki-infrastructure (Adapters)';
    else if (file.includes('crates/worldwiki-tauri')) crate = 'worldwiki-tauri (IPC Bridge)';
    else if (file.includes('src-tauri/src/logic')) crate = 'src-tauri/src/logic (Legacy Core)';
    else if (file.includes('src-tauri/src')) crate = 'src-tauri (Root Application)';
    else if (file.includes('build.rs')) crate = 'Build Scripts (llama-sys / build.rs)';
    else if (file.includes('tauri-surreal-kit')) crate = 'tauri-surreal-kit';

    stats.byCrate[crate] = (stats.byCrate[crate] || 0) + 1;

    // Категоризация
    if (rule.startsWith('AI-008') || rule === 'ROB-001') stats.bySeverityCategory['Safety & Unsafe (AI-008, ROB-001)']++;
    else if (rule.startsWith('ARCH-00') || rule === 'ARCH-020') stats.bySeverityCategory['Architecture & Layers (ARCH-001..005, ARCH-020)']++;
    else if (['ARCH-030', 'ARCH-031', 'ARCH-032'].includes(rule)) stats.bySeverityCategory['God Modules & Pressure (ARCH-030..032)']++;
    else if (rule.startsWith('ERR-')) stats.bySeverityCategory['Error Handling & Reliability (ERR-001..005)']++;
    else if (rule.startsWith('CONC-')) stats.bySeverityCategory['Concurrency & Deadlocks (CONC-002..008)']++;
    else if (['AI-009', 'AI-013', 'SLOP-001'].includes(rule)) stats.bySeverityCategory['Hygiene & Slop (AI-009, AI-013, SLOP-001)']++;
    else stats.bySeverityCategory['Other']++;
});

// Если указан фильтр по правилу
if (filterRule) {
    const matches = rawData.filter(i => i.rule === filterRule);
    console.log(`\n🔍 Фильтрация по правилу [${filterRule}]: найдено ${matches.length} нарушений\n`);
    matches.forEach((m, idx) => {
        console.log(`${idx + 1}. ${m.file}:${m.line} (${m.symbol || 'symbol'})`);
        console.log(`   Сообщение: ${m.message}`);
        console.log(`   Fingerprint: ${m.fingerprint}\n`);
    });
    process.exit(0);
}

// Если указан фильтр по файлу
if (filterFile) {
    const matches = rawData.filter(i => (i.file || '').includes(filterFile));
    console.log(`\n📁 Фильтрация по файлу [${filterFile}]: найдено ${matches.length} нарушений\n`);
    matches.forEach((m, idx) => {
        console.log(`${idx + 1}. [${m.rule}] строка ${m.line} -> ${m.message}`);
    });
    process.exit(0);
}

// Стратегические кластеры
const strategicClusters = [
    {
        id: 1,
        title: 'Cluster 1: Unsafe & Safety Proofs (AI-008)',
        impact: 'CRITICAL',
        effort: 'LOW (1-2 часа)',
        rules: ['AI-008'],
        count: stats.byRule['AI-008'] || 0,
        description: 'Добавление документированных // SAFETY: <обоснование> перед блоками unsafe в llama-sys, local_llm.rs и hardware.rs.',
        topFiles: Object.entries(stats.byFile)
            .filter(([f, d]) => d.rules['AI-008'])
            .map(([f, d]) => `${f} (${d.rules['AI-008']} шт.)`)
    },
    {
        id: 2,
        title: 'Cluster 2: Compiler Hygiene & Allow Cleanup (AI-013, AI-009)',
        impact: 'HIGH',
        effort: 'LOW (1-2 часа)',
        rules: ['AI-013', 'AI-009'],
        count: (stats.byRule['AI-013'] || 0) + (stats.byRule['AI-009'] || 0),
        description: 'Устранение несанкционированных #[allow(dead_code, unused)] и приведение TODO к формату TODO(issue-id, YYYY-MM-DD).',
        topFiles: Object.entries(stats.byFile)
            .filter(([f, d]) => d.rules['AI-013'] || d.rules['AI-009'])
            .map(([f, d]) => `${f}`)
    },
    {
        id: 3,
        title: 'Cluster 3: Defensive Coding & Panic Vectors (ROB-001, ERR-001)',
        impact: 'CRITICAL',
        effort: 'MEDIUM (2-3 часа)',
        rules: ['ROB-001', 'ERR-001'],
        count: (stats.byRule['ROB-001'] || 0) + (stats.byRule['ERR-001'] || 0),
        description: 'Замена .unwrap()/.expect() и прямого индексирования vec[i] на .get(i), if let Some, match и обработку let _ = res.',
        topFiles: Object.entries(stats.byFile)
            .filter(([f, d]) => d.rules['ROB-001'] || d.rules['ERR-001'])
            .sort((a, b) => b[1].total - a[1].total)
            .slice(0, 5)
            .map(([f, d]) => `${f} (${d.total} viols)`)
    },
    {
        id: 4,
        title: 'Cluster 4: Typed Error Handling (ERR-003, ERR-005)',
        impact: 'HIGH',
        effort: 'MEDIUM (3-4 часа)',
        rules: ['ERR-003', 'ERR-005'],
        count: (stats.byRule['ERR-003'] || 0) + (stats.byRule['ERR-005'] || 0),
        description: 'Замена Result<T, String> в Use Cases и Domain на типизированные доменные Enum-ошибки.',
        topFiles: Object.entries(stats.byFile)
            .filter(([f, d]) => d.rules['ERR-003'] || d.rules['ERR-005'])
            .map(([f, d]) => `${f}`)
    },
    {
        id: 5,
        title: 'Cluster 5: God Module Decomposition (ARCH-030, ARCH-031, ARCH-032)',
        impact: 'ARCHITECTURAL',
        effort: 'HIGH (4-6 часов)',
        rules: ['ARCH-030', 'ARCH-031', 'ARCH-032'],
        count: (stats.byRule['ARCH-030'] || 0) + (stats.byRule['ARCH-031'] || 0) + (stats.byRule['ARCH-032'] || 0),
        description: 'Разбиение перегруженных файлов (>35 функций, >600 строк, высокое давление) на подмодули.',
        topFiles: Object.entries(stats.byFile)
            .filter(([f, d]) => d.rules['ARCH-030'] || d.rules['ARCH-031'] || d.rules['ARCH-032'])
            .sort((a, b) => b[1].total - a[1].total)
            .slice(0, 8)
            .map(([f, d]) => `${f} (Функций/SLOC: ${d.total})`)
    },
    {
        id: 6,
        title: 'Cluster 6: Hexagonal Layer Purity (ARCH-001..ARCH-005, ARCH-020)',
        impact: 'ARCHITECTURAL',
        effort: 'HIGH (3-5 часов)',
        rules: ['ARCH-001', 'ARCH-002', 'ARCH-003', 'ARCH-005', 'ARCH-020'],
        count: (stats.byRule['ARCH-001'] || 0) + (stats.byRule['ARCH-002'] || 0) + (stats.byRule['ARCH-003'] || 0) + (stats.byRule['ARCH-005'] || 0) + (stats.byRule['ARCH-020'] || 0),
        description: 'Устранение прямых зависимостей домена от внешних SDK, вынос адаптеров в infrastructure и команд в tauri.',
        topFiles: Object.entries(stats.byFile)
            .filter(([f, d]) => d.rules['ARCH-001'] || d.rules['ARCH-002'] || d.rules['ARCH-005'] || d.rules['ARCH-020'])
            .map(([f, d]) => `${f}`)
    }
];

if (isMarkdown) {
    console.log(`# 🛡️ Cerberus Baseline Triage & Remediation Roadmap\n`);
    console.log(`> **Всего нарушений в Baseline**: **${stats.total}**\n`);
    
    console.log(`## 📊 1. Распределение по архитектурным категориям\n`);
    console.log(`| Категория нарушений | Количество | Доля (%) | Приоритет |`);
    console.log(`|---|:---:|:---:|:---:|`);
    Object.entries(stats.bySeverityCategory).forEach(([cat, count]) => {
        const pct = ((count / stats.total) * 100).toFixed(1);
        console.log(`| **${cat}** | **${count}** | ${pct}% | ${count > 50 ? '🔥 Critical' : '⚡ Normal'} |`);
    });

    console.log(`\n## 🏛️ 2. Распределение по слоям и крейтам\n`);
    console.log(`| Слой / Крейт | Количество нарушений | Доля (%) |`);
    console.log(`|---|:---:|:---:|`);
    Object.entries(stats.byCrate).sort((a,b) => b[1] - a[1]).forEach(([crate, count]) => {
        const pct = ((count / stats.total) * 100).toFixed(1);
        console.log(`| \`${crate}\` | **${count}** | ${pct}% |`);
    });

    console.log(`\n## 🗺️ 3. Пошаговая дорожная карта устранения техдолга (6 кластеров)\n`);
    strategicClusters.forEach(c => {
        console.log(`### 📍 ${c.title}`);
        console.log(`* **Количество нарушений**: \`${c.count}\``);
        console.log(`* **Трудоёмкость**: \`${c.effort}\` | **Влияние**: \`${c.impact}\``);
        console.log(`* **Суть задачи**: ${c.description}`);
        if (c.topFiles.length > 0) {
            console.log(`* **Ключевые очаги**:`);
            c.topFiles.slice(0, 5).forEach(f => console.log(`  - \`${f}\``));
        }
        console.log('');
    });
    process.exit(0);
}

// Обычный терминальный красивый вывод
console.log(`\n================================================================================`);
console.log(`🛡️  CERBERUS BASELINE TRIAGE & STRATEGIC REMEDIATION MATRIX`);
console.log(`================================================================================\n`);
console.log(`📈 Всего нарушений зафиксировано в baseline: ${stats.total}\n`);

console.log(`--------------------------------------------------------------------------------`);
console.log(`1. СТАТИСТИКА ПО ПРАВИЛАМ CERBERUS`);
console.log(`--------------------------------------------------------------------------------`);
Object.entries(stats.byRule).sort((a, b) => b[1] - a[1]).forEach(([rule, count]) => {
    const pct = ((count / stats.total) * 100).toFixed(1);
    const bar = '█'.repeat(Math.round(count / 10));
    console.log(`  ${rule.padEnd(12)} : ${count.toString().padStart(4)} (${pct.padStart(5)}%)  ${bar}`);
});

console.log(`\n--------------------------------------------------------------------------------`);
console.log(`2. ТОП-15 ЭПИЦЕНТРОВ ТЕХДОЛГА (БОЖЕСТВЕННЫЕ ФАЙЛЫ)`);
console.log(`--------------------------------------------------------------------------------`);
Object.entries(stats.byFile).sort((a, b) => b[1].total - a[1].total).slice(0, 15).forEach(([file, data], idx) => {
    const rulesSummary = Object.entries(data.rules).map(([r, c]) => `${r}:${c}`).join(', ');
    console.log(`  ${(idx + 1).toString().padStart(2)}. [${data.total.toString().padStart(3)} viols] ${file}`);
    console.log(`      Правила: ${rulesSummary}`);
});

console.log(`\n================================================================================`);
console.log(`3. СТРАТЕГИЧЕСКИЙ ПЛАН АТАКИ (6 КЛАСТЕРОВ РЕФАКТОРИНГА)`);
console.log(`================================================================================`);
strategicClusters.forEach(c => {
    console.log(`\n🔹 [${c.impact}] ${c.title}`);
    console.log(`   • Нарушений: ${c.count} шт. | Трудоёмкость: ${c.effort}`);
    console.log(`   • Стратегия: ${c.description}`);
    if (c.topFiles.length > 0) {
        console.log(`   • Файлы: ${c.topFiles.slice(0, 3).join(', ')}`);
    }
});
console.log(`\n================================================================================\n`);
