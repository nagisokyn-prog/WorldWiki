import fs from 'node:fs';
import path from 'node:path';

// ============================================================================
// WorldWiki: Лист 2 (ГОСТ А3: 420x297 мм -> 2100x1485 px, масштаб 5 px/мм)
// Архитектура программного комплекса (3.4) и вычислительные ядра (4.2)
// Без word-vibe (в бэклоге). Чистый ч/б ГОСТ, 0 наложений.
// ============================================================================

const W = 2100;
const H = 1485;

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

const out = [];
out.push(`<?xml version="1.0" encoding="UTF-8"?>`);
out.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" font-family="'Segoe UI', 'DejaVu Sans', Arial, sans-serif">`);
out.push(`
  <defs>
    <marker id="arr" viewBox="0 0 12 10" refX="10" refY="5" markerWidth="8" markerHeight="8" orient="auto">
      <path d="M 0 1 L 11 5 L 0 9 z" fill="#000000"/>
    </marker>
    <marker id="arr-gray" viewBox="0 0 12 10" refX="10" refY="5" markerWidth="8" markerHeight="8" orient="auto">
      <path d="M 0 1 L 11 5 L 0 9 z" fill="#444444"/>
    </marker>
  </defs>
  <style>
    .bg { fill: #ffffff; }
    .frame-outer { fill: none; stroke: #000000; stroke-width: 1; }
    .frame-inner { fill: none; stroke: #000000; stroke-width: 2.2; }

    .zone-box { fill: #ffffff; stroke: #000000; stroke-width: 1.5; stroke-dasharray: 8 4; rx: 6; ry: 6; }
    .zone-hdr { fill: #222222; rx: 3; ry: 3; }
    .zone-hdr-txt { font-size: 12px; font-weight: 700; letter-spacing: 0.4px; fill: #ffffff; }

    .card { fill: #ffffff; stroke: #000000; stroke-width: 1.6; rx: 4; ry: 4; }
    .card-hub { fill: #f3f3f3; stroke: #000000; stroke-width: 2.2; rx: 4; ry: 4; }
    .card-dash { fill: #fafafa; stroke: #333333; stroke-width: 1.4; stroke-dasharray: 5 3; rx: 4; ry: 4; }
    .card-hdr { fill: #333333; }
    .card-hdr-txt { font-size: 12px; font-weight: 700; fill: #ffffff; }
    .card-badge { font-size: 9px; font-weight: 700; fill: #ffffff; text-anchor: end; opacity: 0.9; }

    .t-b { font-size: 13px; font-weight: 700; fill: #000000; }
    .t-m { font-size: 11.5px; fill: #111111; }
    .t-s { font-size: 10.5px; fill: #333333; }
    .t-mono { font-family: 'Consolas', 'DejaVu Sans Mono', monospace; font-size: 10.5px; fill: #000000; }
    .t-mono-b { font-family: 'Consolas', 'DejaVu Sans Mono', monospace; font-size: 11px; font-weight: 700; fill: #000000; }

    .edge { fill: none; stroke: #000000; stroke-width: 1.9; stroke-linejoin: round; }
    .edge-dash { fill: none; stroke: #444444; stroke-width: 1.4; stroke-dasharray: 5 3; stroke-linejoin: round; }
    .edge-lbl-bg { fill: #ffffff; stroke: none; rx: 2; }
    .edge-lbl { font-size: 10.5px; font-style: italic; fill: #111111; text-anchor: middle; }

    /* GOST 2.104 Stamp and Legend */
    .stamp-line { fill: none; stroke: #000000; stroke-width: 1.1; }
    .stamp-bold { fill: none; stroke: #000000; stroke-width: 1.9; }
    .stamp-txt { font-size: 9.2px; fill: #000000; }
    .stamp-txt-b { font-size: 11.5px; font-weight: 700; fill: #000000; text-anchor: middle; }
    .stamp-title { font-size: 15px; font-weight: 700; fill: #000000; text-anchor: middle; }
    .legend-box { fill: #ffffff; stroke: #000000; stroke-width: 1.25; }
    .legend-hdr { font-size: 12px; font-weight: 700; fill: #000000; }
    .legend-txt { font-size: 11px; fill: #111111; }
  </style>
`);

// Рамка А3 ГОСТ 2.301 (слева 20 мм = 100 px, сверху/справа/снизу 5 мм = 25 px)
out.push(`<rect class="bg" x="0" y="0" width="${W}" height="${H}"/>`);
out.push(`<rect class="frame-outer" x="1" y="1" width="${W - 2}" height="${H - 2}"/>`);
out.push(`<rect class="frame-inner" x="100" y="25" width="1975" height="1435"/>`);

// Заголовок листа
out.push(`<text x="122" y="54" font-size="16" font-weight="700" fill="#000000">АРХИТЕКТУРА ПРОГРАММНОГО КОМПЛЕКСА «WORLDWIKI» И ВЫЧИСЛИТЕЛЬНЫЕ ЯДРА (#![no_std])</text>`);

// ============================================================================
// ЗОНА А (СЛЕВА): FRONTEND (apps/spa, FSD + MVVM) и packages/* (y=72..695)
// ============================================================================
out.push(`<rect class="zone-box" x="122" y="72" width="910" height="610"/>`);
out.push(`<rect class="zone-hdr" x="122" y="72" width="910" height="26"/>`);
out.push(`<text class="zone-hdr-txt" x="136" y="89">1. КЛИЕНТСКОЕ ПРИЛОЖЕНИЕ (WEBVIEW2 / VUE 3 / TYPESCRIPT): FSD, MVVM И МОНОРЕПОЗИТОРИЙ</text>`);

// FSD Слои (сверху вниз/слева направо)
out.push(`<text class="t-b" x="142" y="122">Однонаправленная иерархия слоёв FSD (apps/spa/src/ts):</text>`);
const fsd = [
  { x: 142, y: 134, w: 145, t: 'app',         s: 'Router, DI, Root' },
  { x: 312, y: 134, w: 165, t: 'features',    s: 'UI-модули фич' },
  { x: 502, y: 134, w: 170, t: 'composables', s: 'ViewModel-хуки' },
  { x: 697, y: 134, w: 175, t: 'stores / services', s: 'Pinia, IPC-клиент' },
  { x: 897, y: 134, w: 115, t: 'types / utils', s: 'DTO, хелперы' },
];
fsd.forEach((f, idx) => {
  out.push(`<rect class="card" x="${f.x}" y="${f.y}" width="${f.w}" height="52"/>`);
  out.push(`<text class="t-mono-b" x="${f.x + f.w / 2}" y="${f.y + 22}" text-anchor="middle">${f.t}</text>`);
  out.push(`<text class="t-s" x="${f.x + f.w / 2}" y="${f.y + 40}" text-anchor="middle">${f.s}</text>`);
  if (idx < fsd.length - 1) {
    out.push(`<line class="edge" x1="${f.x + f.w}" y1="${f.y + 26}" x2="${fsd[idx + 1].x - 3}" y2="${f.y + 26}" marker-end="url(#arr)"/>`);
  }
});

// 4-компонентный паттерн MVVM + SemanticDocument AST
out.push(`<text class="t-b" x="142" y="218">4-файловый модуль MVVM (Cerberus SFC Firewall):</text>`);
out.push(`<rect class="card" x="142" y="230" width="215" height="62"/>`);
out.push(`<text class="t-mono-b" x="152" y="252">Feature.model.ts</text>`);
out.push(`<text class="t-s" x="152" y="270">Props, Emits, DTO, Enums</text>`);

out.push(`<rect class="card" x="392" y="230" width="225" height="62"/>`);
out.push(`<text class="t-mono-b" x="402" y="252">Feature.vue (View)</text>`);
out.push(`<text class="t-s" x="402" y="270">Декларативный шаблон</text>`);

out.push(`<rect class="card-hub" x="392" y="330" width="225" height="66"/>`);
out.push(`<text class="t-mono-b" x="402" y="352">useFeature.ts (VM)</text>`);
out.push(`<text class="t-s" x="402" y="370">ref, computed, валидация</text>`);
out.push(`<text class="t-s" x="402" y="385">Оптимистичный откат (UI)</text>`);

out.push(`<rect class="card-dash" x="142" y="330" width="215" height="66"/>`);
out.push(`<text class="t-mono-b" x="152" y="352">Feature.spec.ts</text>`);
out.push(`<text class="t-s" x="152" y="370">Vitest (83–95% coverage)</text>`);
out.push(`<text class="t-s" x="152" y="385">Success / Rollback / Edge</text>`);

// Стрелки MVVM
out.push(`<path class="edge-dash" d="M 357 254 L 389 254" marker-end="url(#arr-gray)"/>`);
out.push(`<path class="edge-dash" d="M 250 292 L 250 310 L 440 310 L 440 327" marker-end="url(#arr-gray)"/>`);
out.push(`<path class="edge" d="M 505 292 L 505 327" marker-end="url(#arr)"/>`);
out.push(`<path class="edge-dash" d="M 357 363 L 389 363" marker-end="url(#arr-gray)"/>`);

// ASTAdapter & SemanticDocument
out.push(`<rect class="card" x="655" y="230" width="357" height="166"/>`);
out.push(`<rect class="card-hdr" x="655" y="230" width="357" height="24"/>`);
out.push(`<text class="card-hdr-txt" x="665" y="246">Единый источник правды: SemanticDocument AST</text>`);
out.push(`<text class="t-mono-b" x="667" y="274">ASTAdapter (Tiptap v3 JSON &lt;-&gt; text_blocks)</text>`);
out.push(`<text class="t-s" x="667" y="294">• DocumentNode (контейнер главы)</text>`);
out.push(`<text class="t-s" x="667" y="312">• ParagraphNode (абзацы + статистика)</text>`);
out.push(`<text class="t-s" x="667" y="330">• EntityMentionNode — строго триггер ((Сущность))</text>`);
out.push(`<text class="t-s" x="667" y="348">• FootnoteNode, HeadingNode, ImageNode, TableNode</text>`);
out.push(`<text class="t-s" x="667" y="372">Обмен между редактором и БД без потерь структуры</text>`);

// Pinia Store & API Client
out.push(`<rect class="card" x="142" y="438" width="475" height="62"/>`);
out.push(`<text class="t-mono-b" x="154" y="460">Pinia Store + api.client.ts (IPC Client)</text>`);
out.push(`<text class="t-s" x="154" y="480">Единая точка вызова Tauri IPC, обработка IpcError (Toast / Alert)</text>`);
out.push(`<path class="edge" d="M 505 396 L 505 435" marker-end="url(#arr)"/>`);
out.push(`<path class="edge" d="M 833 396 L 833 469 L 620 469" marker-end="url(#arr)"/>`);

// packages/* (без word-vibe!)
out.push(`<text class="t-b" x="142" y="534">Изолированные пакеты монорепозитория (packages/*):</text>`);
out.push(`<rect class="card" x="142" y="546" width="265" height="114"/>`);
out.push(`<text class="t-mono-b" x="154" y="568">@worldwiki/components</text>`);
out.push(`<text class="t-s" x="154" y="586">UI-Kit и CSS дизайн-токены</text>`);
out.push(`<text class="t-mono-b" x="154" y="614">packages/resources</text>`);
out.push(`<text class="t-s" x="154" y="632">Шрифты, иконки, ресурсы</text>`);

out.push(`<rect class="card" x="432" y="546" width="580" height="114"/>`);
out.push(`<text class="t-mono-b" x="444" y="568">Клиентские WASM-пакеты (wasm-bindgen поверх #![no_std]):</text>`);
out.push(`<text class="t-mono" x="444" y="592">• @worldwiki/calendar-wasm   — локальная проекция дат и циферблатов</text>`);
out.push(`<text class="t-mono" x="444" y="612">• @worldwiki/ast-diff-wasm   — визуальное сравнение ревизий (Myers)</text>`);
out.push(`<text class="t-mono" x="444" y="632">• @worldwiki/manuscript-wasm — мгновенная подсветка ((Сущность)) O(N)</text>`);
out.push(`<path class="edge" d="M 300 500 L 300 543" marker-end="url(#arr)"/>`);
out.push(`<path class="edge" d="M 520 500 L 520 543" marker-end="url(#arr)"/>`);

// ============================================================================
// ЗОНА Б (СЛЕВА-ВНИЗУ): RUST HEXAGONAL CORE & tauri-surreal-kit (y=705..1245)
// ============================================================================
out.push(`<rect class="zone-box" x="122" y="715" width="910" height="530"/>`);
out.push(`<rect class="zone-hdr" x="122" y="715" width="910" height="26"/>`);
out.push(`<text class="zone-hdr-txt" x="136" y="732">2. НАТИВНОЕ ЯДРО БЭКЕНДА (RUST HEXAGONAL ARCHITECTURE: PORTS &amp; ADAPTERS)</text>`);

// IPC Bridge между Зоной А и Зоной Б
out.push(`<rect class="card-hub" x="142" y="756" width="520" height="58"/>`);
out.push(`<text class="t-mono-b" x="154" y="778">adapters/tauri (Единственный слой, знающий о Tauri IPC)</text>`);
out.push(`<text class="t-s" x="154" y="798">bridge_macro!, AppState, типизированная трансляция ошибок в IpcError</text>`);

out.push(`<rect class="card" x="692" y="756" width="320" height="58"/>`);
out.push(`<text class="t-mono-b" x="704" y="778">bootstrap (Composition Root)</text>`);
out.push(`<text class="t-s" x="704" y="798">Сборка графа зависимостей AppServices</text>`);

// Стрелка Tauri IPC сверху вниз из Pinia Store
out.push(`<path class="edge" d="M 380 682 L 380 753" marker-end="url(#arr)"/>`);
out.push(`<rect class="edge-lbl-bg" x="310" y="692" width="140" height="16"/>`);
out.push(`<text class="edge-lbl" x="380" y="704">Tauri IPC Commands / Events</text>`);
out.push(`<path class="edge-dash" d="M 692 785 L 665 785" marker-end="url(#arr-gray)"/>`);

// tauri-surreal-kit
out.push(`<rect class="card-dash" x="692" y="842" width="320" height="118"/>`);
out.push(`<text class="t-mono-b" x="704" y="864">tauri-surreal-kit (Платформенный каркас)</text>`);
out.push(`<text class="t-s" x="704" y="884">• surreal_domain_core (нормализация ID)</text>`);
out.push(`<text class="t-s" x="704" y="902">• surreal_domain_macros (IPC-мосты)</text>`);
out.push(`<text class="t-s" x="704" y="920">• Управление окнами, темами, бенчмарк</text>`);
out.push(`<text class="t-s" x="704" y="938">• 100% параметризованный SurrealQL</text>`);
out.push(`<path class="edge-dash" d="M 662 800 L 678 800 L 678 880 L 689 880" marker-end="url(#arr-gray)"/>`);

// Application & Ports
out.push(`<rect class="card" x="142" y="842" width="245" height="92"/>`);
out.push(`<text class="t-mono-b" x="154" y="864">application (Use Cases)</text>`);
out.push(`<text class="t-s" x="154" y="884">GetChapter, SaveEntity,</text>`);
out.push(`<text class="t-s" x="154" y="900">TimelineAudit, Analytics</text>`);
out.push(`<text class="t-s" x="154" y="918">ApplicationError</text>`);

out.push(`<rect class="card" x="417" y="842" width="245" height="92"/>`);
out.push(`<text class="t-mono-b" x="429" y="864">ports (Трейты-интерфейсы)</text>`);
out.push(`<text class="t-s" x="429" y="884">RepositoryPort, StoragePort,</text>`);
out.push(`<text class="t-s" x="429" y="900">EventPublisherPort</text>`);
out.push(`<text class="t-s" x="429" y="918">(Инверсия зависимостей)</text>`);

out.push(`<path class="edge" d="M 264 814 L 264 839" marker-end="url(#arr)"/>`);
out.push(`<path class="edge" d="M 387 888 L 414 888" marker-end="url(#arr)"/>`);

// Infrastructure (SurrealDB) & Domain
out.push(`<rect class="card-hub" x="142" y="968" width="520" height="84"/>`);
out.push(`<text class="t-mono-b" x="154" y="990">domain (Чистая предметная область — 0 внешних зависимостей)</text>`);
out.push(`<text class="t-s" x="154" y="1010">Сущности, Value Objects (M_abs, t_abs), DomainError, инварианты ((Сущность))</text>`);
out.push(`<text class="t-s" x="154" y="1028">Изолированное модульное тестирование бизнес-логики без поднятия Tauri / БД</text>`);

out.push(`<rect class="card" x="692" y="982" width="320" height="114"/>`);
out.push(`<text class="t-mono-b" x="704" y="1004">infrastructure (Адаптеры БД и ФС)</text>`);
out.push(`<text class="t-s" x="704" y="1024">• SurrealDB v3.2 SCHEMAFULL (SurrealKV)</text>`);
out.push(`<text class="t-s" x="704" y="1042">• 100% .bind(), каскады EVENT, fn::*</text>`);
out.push(`<text class="t-s" x="704" y="1060">• Архивы проектов .wwiki, локальная ФС</text>`);
out.push(`<text class="t-s" x="704" y="1078">• Реализует трейты из слоя ports</text>`);

out.push(`<path class="edge" d="M 540 934 L 540 965" marker-end="url(#arr)"/>`);
out.push(`<path class="edge-dash" d="M 692 1030 L 676 1030 L 676 910 L 665 910" marker-end="url(#arr-gray)"/>`);
out.push(`<path class="edge-dash" d="M 852 982 L 852 963" marker-end="url(#arr-gray)"/>`);

// Cerberus Firewall Banner inside Backend Zone
out.push(`<rect class="card-dash" x="142" y="1120" width="870" height="106"/>`);
out.push(`<text class="t-mono-b" x="156" y="1144">Автоматический архитектурный аудит: Cerberus Architectural Firewall + Kani Model Checker</text>`);
out.push(`<text class="t-s" x="156" y="1166">• Rust Core: правила ARCH-001..ARCH-012 (запрет tauri:: в domain/application), ERR-001..007, SDB-001..009</text>`);
out.push(`<text class="t-s" x="156" y="1186">• Frontend: cerberus-sfc check (строгость MVVM/FSD, запрет хардкода цветов и прямых IPC-вызовов в .vue)</text>`);
out.push(`<text class="t-s" x="156" y="1206">• Формальная верификация Kani (91 доказательство без паник и переполнений) + llvm-cov (98–100%)</text>`);

// ============================================================================
// ЗОНА В (СПРАВА, НАД ШТАМПОМ): #![no_std] ВЫЧИСЛИТЕЛЬНЫЕ ЯДРА (4.2) (x=1054..2054, y=72..1162)
// ============================================================================
out.push(`<rect class="zone-box" x="1054" y="72" width="1000" height="1090"/>`);
out.push(`<rect class="zone-hdr" x="1054" y="72" width="1000" height="26"/>`);
out.push(`<text class="zone-hdr-txt" x="1068" y="89">3. ИЗОЛИРОВАННЫЕ #![no_std] ВЫЧИСЛИТЕЛЬНЫЕ ЯДРА И МАТЕМАТИЧЕСКИЕ МОДЕЛИ (РАЗДЕЛ 4.2)</text>`);

// Связи от domain и WASM к вычислительным ядрам
out.push(`<path class="edge" d="M 1012 600 L 1040 600 L 1040 240 L 1072 240" marker-end="url(#arr)"/>`);
out.push(`<path class="edge" d="M 662 1010 L 678 1010 L 678 1106 L 1040 1106 L 1040 520 L 1072 520" marker-end="url(#arr)"/>`);

// Ядро 1: worldwiki-calendar-core
out.push(`<rect class="card-hub" x="1076" y="114" width="958" height="445"/>`);
out.push(`<rect class="card-hdr" x="1076" y="114" width="958" height="26"/>`);
out.push(`<text class="card-hdr-txt" x="1088" y="131">Ядро 3.1: worldwiki-calendar-core — Целочисленная модель времени, астрономии и темпорального аудита</text>`);
out.push(`<text class="hdr-badge" x="2022" y="131" fill="#ffffff" font-size="10" font-weight="700" text-anchor="end">70 Kani | 100% fn cov</text>`);

// Конвейер Ядра 1 (4 этапа слева направо)
const calSteps = [
  { x: 1094, y: 158, w: 215, h: 175, t: '1. Физический скаляр t_abs', lines: [
    't_abs ∈ Z (i64, тики)',
    'Евклидово деление:',
    'day = div_euclid(t_abs, T_day)',
    'tick = rem_euclid(t_abs, T_day)',
    'Корректно при t_abs < 0',
    'DialHierarchy (C = Π s_i):',
    'каскадное квантование',
    'без потери тиков (ceil/floor)',
  ]},
  { x: 1332, y: 158, w: 230, h: 175, t: '2. Гармоники O(k) и O(1)', lines: [
    'Аналитический подсчёт:',
    'F(Y) = Σ w_i · ⌊(a_i·Y + b_i)/c_i⌋',
    'Високосность: ΔF(Y) ∈ {0,1}',
    'Арифметика i128 (0 overflow)',
    'Обратный поиск года O(1):',
    'year_from_days_o1 (0..2 шага)',
    'Цепные дроби (глубина 10):',
    '1/4 → 7/29 → 8/33 → 97/400',
  ]},
  { x: 1585, y: 158, w: 215, h: 175, t: '3. Астрономия без libm', lines: [
    'Прямое/ретроградное вращ.',
    'Солнечный полдень (тики)',
    'Зенитное расст. [0..180000] мград',
    'Полярный день и ночь',
    'Инсоляция поверхности',
    'Фазы произвольных N лун',
    'Точность: 128-бит в б.п.',
    'Погрешность < 1 дн / 500k лет',
  ]},
  { x: 1823, y: 158, w: 194, h: 175, t: '4. Реформы и Аллен', lines: [
    'Эры (бинарный поиск)',
    'Цепочки календарей (≤ 8)',
    'Реформы: Gap, Transitional,',
    'EpochReset, DstPolicy',
    '13 отношений интервалов',
    'Аллена (Before..Equals):',
    '• Билокация персонажа',
    '• Действия после смерти',
  ]},
];
calSteps.forEach((s, i) => {
  out.push(`<rect class="card" x="${s.x}" y="${s.y}" width="${s.w}" height="${s.h}"/>`);
  out.push(`<text class="t-b" x="${s.x + 8}" y="${s.y + 19}" font-size="11.5">${esc(s.t)}</text>`);
  out.push(`<line x1="${s.x + 4}" y1="${s.y + 25}" x2="${s.x + s.w - 4}" y2="${s.y + 25}" stroke="#cccccc"/>`);
  s.lines.forEach((ln, li) => {
    out.push(`<text class="t-mono" x="${s.x + 8}" y="${s.y + 42 + li * 16}" font-size="9.8">${esc(ln)}</text>`);
  });
  if (i < calSteps.length - 1) {
    out.push(`<line class="edge" x1="${s.x + s.w}" y1="${s.y + 88}" x2="${calSteps[i + 1].x - 3}" y2="${s.y + 88}" marker-end="url(#arr)"/>`);
  }
});

// Матрица инвариантов Ядра 1 внизу карточки
out.push(`<rect class="card-dash" x="1094" y="352" width="923" height="190"/>`);
out.push(`<text class="t-b" x="1108" y="374">Математические гарантии и потоки синхронизации времени:</text>`);
out.push(`<text class="t-mono" x="1108" y="396">Вход: [M_abs | локальная дата планеты] ──▶ Конверсия в t_abs (i64) ──▶ [Кросс-календарная проекция без накопления ошибки]</text>`);
out.push(`<text class="t-s" x="1108" y="420">• Нулевое использование f64 в ядре: детерминизм на x86_64, ARM64 и WebAssembly (wasm32-unknown-unknown).</text>`);
out.push(`<text class="t-s" x="1108" y="440">• Биективность квантования циферблата доказана модель-чекером Kani для всех делителей T_day mod C = 0.</text>`);
out.push(`<text class="t-s" x="1108" y="460">• Интеграция с БД: timeline_events.m_abs (int) индексируется B-Tree и фильтруется в «Режиме читателя» (chapter_id &lt;= current).</text>`);
out.push(`<text class="t-s" x="1108" y="480">• Алгебра Аллена запускается поверх таблиц plot_promises (occurs_at) и entities (participates_in) для поиска темпоральных парадоксов.</text>`);
out.push(`<text class="t-s" x="1108" y="500">• Производный дрейф календаря считается строго в рациональных дробях p/q (промилле суток за 100 лет).</text>`);
out.push(`<text class="t-s" x="1108" y="520">• Рекурсивное разрешение синхронизированных календарей ограничено глубиной MAX_SYNC_CHAIN_DEPTH = 8 (защита от циклов).</text>`);

// Ядро 2: worldwiki-document-core (Myers Diff)
out.push(`<rect class="card" x="1076" y="582" width="958" height="250"/>`);
out.push(`<rect class="card-hdr" x="1076" y="582" width="958" height="26"/>`);
out.push(`<text class="card-hdr-txt" x="1088" y="599">Ядро 3.2: worldwiki-document-core — Структурный diff и патчинг ревизий (Алгоритм Майерса)</text>`);
out.push(`<text class="hdr-badge" x="2022" y="599" fill="#ffffff" font-size="10" font-weight="700" text-anchor="end">10 Kani | O((N+M)D)</text>`);

const docSteps = [
  { x: 1094, y: 624, w: 280, h: 112, t: '1. diff_documents (Блоки AST)', lines: [
    'Вход: SemanticDocument v1, v2',
    'Трассировка диагоналей Майерса',
    'Кратчайший путь EditOp:',
    'Keep / Insert / Delete / Modify',
  ]},
  { x: 1404, y: 624, w: 295, h: 112, t: '2. compute_inline_diff (Символы)', lines: [
    'Для изменённых узлов (Modify):',
    'гранулярные дельты InlineChange',
    'на уровне текстовых пробегов',
    'без перезаписи всего абзаца',
  ]},
  { x: 1729, y: 624, w: 288, h: 112, t: '3. apply_patch (Верификация)', lines: [
    'Детерминированное применение',
    'DocumentDiffResult с проверкой',
    'границ и сохранением атрибутов',
    'Выход: chapter_revisions',
  ]},
];
docSteps.forEach((s, i) => {
  out.push(`<rect class="card" x="${s.x}" y="${s.y}" width="${s.w}" height="${s.h}"/>`);
  out.push(`<text class="t-b" x="${s.x + 8}" y="${s.y + 19}" font-size="11.5">${esc(s.t)}</text>`);
  out.push(`<line x1="${s.x + 4}" y1="${s.y + 25}" x2="${s.x + s.w - 4}" y2="${s.y + 25}" stroke="#cccccc"/>`);
  s.lines.forEach((ln, li) => out.push(`<text class="t-mono" x="${s.x + 8}" y="${s.y + 44 + li * 17}" font-size="10">${esc(ln)}</text>`));
  if (i < docSteps.length - 1) out.push(`<line class="edge" x1="${s.x + s.w}" y1="${s.y + 56}" x2="${docSteps[i + 1].x - 3}" y2="${s.y + 56}" marker-end="url(#arr)"/>`);
});
out.push(`<rect class="card-dash" x="1094" y="750" width="923" height="66"/>`);
out.push(`<text class="t-s" x="1108" y="772">• В отличие от построчного Git-diff, структурный diff сохраняет целостность узлов EntityMentionNode ((Сущность)) и FootnoteNode.</text>`);
out.push(`<text class="t-s" x="1108" y="792">• Дельты хранятся в chapter_revisions; Kani формально проверяет отсутствие паник при пустых/граничных документах.</text>`);

// Ядро 3: worldwiki-manuscript-core + Обратная совместимость динамических схем
out.push(`<rect class="card" x="1076" y="854" width="958" height="290"/>`);
out.push(`<rect class="card-hdr" x="1076" y="854" width="958" height="26"/>`);
out.push(`<text class="card-hdr-txt" x="1088" y="871">Ядро 3.3: worldwiki-manuscript-core (FSM-лексер O(N)) и обратная совместимость динамических схем</text>`);
out.push(`<text class="hdr-badge" x="2022" y="871" fill="#ffffff" font-size="10" font-weight="700" text-anchor="end">6 Kani | O(N) + O(1)</text>`);

// Левая часть Ядра 3: FSM-лексер
out.push(`<rect class="card" x="1094" y="896" width="450" height="230"/>`);
out.push(`<text class="t-b" x="1106" y="918">Детерминированный FSM-сканер extract_entity_mentions</text>`);
out.push(`<text class="t-mono" x="1106" y="942">[Plain] ─"("─▶ [Open1] ─"("─▶ [Inside] ─")"─▶ [Close1] ─")"─▶ [Emit]</text>`);
out.push(`<text class="t-s" x="1106" y="966">• Один линейный проход O(N) без регулярных выражений и бэктрекинга</text>`);
out.push(`<text class="t-s" x="1106" y="986">• Строгий инвариант домена: триггер сущности только ((Сущность))</text>`);
out.push(`<text class="t-s" x="1106" y="1006">• resolve_cross_references: сопоставление с TargetMetadata за O(1)</text>`);
out.push(`<text class="t-s" x="1106" y="1026">• На выходе формирует графовые рёбра appears_in (entity → block)</text>`);
out.push(`<text class="t-s" x="1106" y="1046">• Полная безопасность UTF-8 границ (проверено Kani)</text>`);
out.push(`<text class="t-mono" x="1106" y="1078">((Имя)) ──▶ ExtractedEntityMention ──▶ ResolvedCrossReference</text>`);

// Правая часть Ядра 3: Обратная совместимость динамических схем
out.push(`<rect class="card" x="1564" y="896" width="453" height="230"/>`);
out.push(`<text class="t-b" x="1576" y="918">Эволюция схем entity_schemas без миграции таблицы entities</text>`);
out.push(`<text class="t-s" x="1576" y="942">1. Обновление декларации fields_schema в entity_schemas (UPSERT)</text>`);
out.push(`<text class="t-s" x="1576" y="962">2. Поле entities.attributes (object FLEXIBLE) сохраняет старые</text>`);
out.push(`<text class="t-s" x="1576" y="982">   значения без потерь и без пакетной перезаписи тысяч записей</text>`);
out.push(`<text class="t-s" x="1576" y="1002">3. Ленивая нормализация на уровне формы: UI подставляет default</text>`);
out.push(`<text class="t-s" x="1576" y="1022">   только для отсутствующих новых полей при открытии карточки</text>`);
out.push(`<text class="t-mono" x="1576" y="1054">save_entity_schema ─▶ entity_schemas (UPSERT fields_schema)</text>`);
out.push(`<text class="t-mono" x="1576" y="1074">entities.attributes (FLEXIBLE) &lt;─ ленивое слияние в useEntityForm</text>`);

// ============================================================================
// ЛЕГЕНДА (x=122..1144, y=1265..1440)
// ============================================================================
out.push(`<g>`);
out.push(`  <rect class="legend-box" x="122" y="1265" width="1010" height="175" rx="4" ry="4"/>`);
out.push(`  <text class="legend-hdr" x="142" y="1290">Условные обозначения (Архитектура программного комплекса и вычислительные модели)</text>`);

out.push(`  <rect class="card" x="142" y="1308" width="90" height="28"/><text class="t-s" x="244" y="1326">Модуль / крейт / слой архитектуры (FSD, Hexagonal, #![no_std])</text>`);
out.push(`  <rect class="card-hub" x="142" y="1348" width="90" height="28"/><text class="t-s" x="244" y="1366">Ключевой узел интеграции (ViewModel, IPC, Domain, Calendar Core)</text>`);
out.push(`  <rect class="card-dash" x="142" y="1388" width="90" height="28"/><text class="t-s" x="244" y="1406">Вспомогательный каркас, верификация, спецификации и тесты</text>`);

out.push(`  <line class="edge" x1="650" y1="1322" x2="725" y2="1322" marker-end="url(#arr)"/>`);
out.push(`  <text class="t-s" x="738" y="1326">Прямой поток вызовов / преобразования данных</text>`);
out.push(`  <line class="edge-dash" x1="650" y1="1362" x2="725" y2="1362" marker-end="url(#arr-gray)"/>`);
out.push(`  <text class="t-s" x="738" y="1366">Зависимость, инверсия портов (DI) или проверка тестами</text>`);
out.push(`</g>`);

// ============================================================================
// ОСНОВНАЯ НАДПИСЬ ГОСТ 2.104 (Форма 1: 185x55 мм -> 925x275 px) — Лист 2 из 2
// ============================================================================
const sx = 1150, sy = 1185;
out.push(`<g>`);
out.push(`  <rect class="stamp-bold" x="${sx}" y="${sy}" width="925" height="275"/>`);
const colWidths = [52, 42, 111, 70, 50];
let cx = sx;
for (const cw of colWidths) { out.push(`  <line class="stamp-line" x1="${cx}" y1="${sy}" x2="${cx}" y2="${sy + 275}"/>`); cx += cw; }
out.push(`  <line class="stamp-bold" x1="${sx + 325}" y1="${sy}" x2="${sx + 325}" y2="${sy + 275}"/>`);
for (let r = 1; r < 11; r++) {
  const ry = sy + r * 25;
  out.push(`  <line class="${(r === 4 || r === 5) ? 'stamp-bold' : 'stamp-line'}" x1="${sx}" y1="${ry}" x2="${sx + 325}" y2="${ry}"/>`);
}
cx = sx;
['Изм.', 'Лист', '№ докум.', 'Подп.', 'Дата'].forEach((h, i) => {
  out.push(`  <text class="stamp-txt" x="${cx + colWidths[i] / 2}" y="${sy + 117}" text-anchor="middle">${h}</text>`);
  cx += colWidths[i];
});
['Разраб.', 'Проверил', 'Т.контр.', '', 'Н.контр.', 'Утв.'].forEach((role, i) => {
  if (role) out.push(`  <text class="stamp-txt" x="${sx + 4}" y="${sy + 142 + i * 25}">${role}</text>`);
});
out.push(`  <line class="stamp-bold" x1="${sx + 325}" y1="${sy + 70}" x2="${sx + 925}" y2="${sy + 70}"/>`);
out.push(`  <text class="stamp-title" x="${sx + 625}" y="${sy + 42}">КП.09.03.04.002 АР</text>`);
out.push(`  <line class="stamp-bold" x1="${sx + 675}" y1="${sy + 70}" x2="${sx + 675}" y2="${sy + 275}"/>`);
out.push(`  <line class="stamp-bold" x1="${sx + 325}" y1="${sy + 200}" x2="${sx + 925}" y2="${sy + 200}"/>`);
out.push(`  <text class="stamp-title" x="${sx + 500}" y="${sy + 124}">WorldWiki</text>`);
out.push(`  <text class="stamp-txt-b" x="${sx + 500}" y="${sy + 152}">Архитектура программного комплекса</text>`);
out.push(`  <text class="stamp-txt" x="${sx + 500}" y="${sy + 174}" text-anchor="middle">и вычислительные ядра (#![no_std])</text>`);
out.push(`  <line class="stamp-line" x1="${sx + 675}" y1="${sy + 95}" x2="${sx + 925}" y2="${sy + 95}"/>`);
out.push(`  <line class="stamp-bold" x1="${sx + 675}" y1="${sy + 150}" x2="${sx + 925}" y2="${sy + 150}"/>`);
out.push(`  <line class="stamp-line" x1="${sx + 750}" y1="${sy + 70}" x2="${sx + 750}" y2="${sy + 150}"/>`);
out.push(`  <line class="stamp-line" x1="${sx + 835}" y1="${sy + 70}" x2="${sx + 835}" y2="${sy + 150}"/>`);
out.push(`  <line class="stamp-line" x1="${sx + 795}" y1="${sy + 150}" x2="${sx + 795}" y2="${sy + 200}"/>`);
out.push(`  <text class="stamp-txt" x="${sx + 712}" y="${sy + 87}" text-anchor="middle">Лит.</text>`);
out.push(`  <text class="stamp-txt" x="${sx + 792}" y="${sy + 87}" text-anchor="middle">Масса</text>`);
out.push(`  <text class="stamp-txt" x="${sx + 880}" y="${sy + 87}" text-anchor="middle">Масштаб</text>`);
out.push(`  <text class="stamp-txt-b" x="${sx + 712}" y="${sy + 128}">У</text>`);
out.push(`  <text class="stamp-txt" x="${sx + 735}" y="${sy + 178}" text-anchor="middle">Лист 2</text>`);
out.push(`  <text class="stamp-txt" x="${sx + 860}" y="${sy + 178}" text-anchor="middle">Листов 2</text>`);
out.push(`  <text class="stamp-txt" x="${sx + 500}" y="${sy + 242}" text-anchor="middle">Rust / Tauri v2 / Vue 3 / WASM</text>`);
out.push(`  <text class="stamp-txt-b" x="${sx + 800}" y="${sy + 235}">Кафедра ИТ / Группа</text>`);
out.push(`  <text class="stamp-txt" x="${sx + 800}" y="${sy + 256}" text-anchor="middle">(Курсовой проект)</text>`);
out.push(`</g>`);

out.push(`</svg>`);

const outPath = path.resolve('docs/coursework/diagrams/architecture_and_math_a3.svg');
fs.writeFileSync(outPath, out.join('\n'), 'utf8');
console.log('Generated:', outPath);
