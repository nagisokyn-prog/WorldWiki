import fs from 'node:fs';
import path from 'node:path';

// 1. Загрузка конфигурации Cerberus и списка ignore
function loadCerberusConfig() {
  const configPath = path.resolve('cerberus.json');
  if (fs.existsSync(configPath)) {
    try {
      const content = fs.readFileSync(configPath, 'utf-8');
      return JSON.parse(content);
    } catch (e) {
      console.warn('⚠️ Не удалось прочитать cerberus.json, используются стандартные игноры:', e.message);
    }
  }
  return {
    ignore: [
      '.logic_legacy/**',
      'tests/fixtures/**',
      'target/**',
      'node_modules/**',
      'dist/**',
      'coverage/**',
      '**/libs/**',
      '**/*.min.js',
      '**/*.prod.js',
      'vendor/**',
      'crates/**',
      'src/dist-check/**',
      '__tests__/**',
      '**/tests/**',
      '**/test/',
      '**/*test.ts',
      '**/font-awesome.min.css',
      '**/*assets/**',
    ],
  };
}

// Преобразование glob-паттерна в RegExp
function globToRegex(glob) {
  let normalized = glob.replace(/\\/g, '/');
  let regexStr = normalized
    .replace(/\./g, '\\.')
    .replace(/\*\*\//g, '(.+/)?')
    .replace(/\*\*/g, '.*')
    .replace(/\*/g, '[^/]*');
  return new RegExp(`(^|/)${regexStr}($|/)`);
}

function createIgnoreMatcher(patterns) {
  const regexes = patterns.map(globToRegex);
  return function isIgnored(filePath) {
    const normalized = filePath.replace(/\\/g, '/');
    return regexes.some((re) => re.test(normalized));
  };
}

// 2. Расчет CSS Specificity (W3C Selectors Level 4: [A - IDs, B - Classes/Attrs/Pseudo-classes, C - Types/Pseudo-elements])
export function calculateSpecificity(selector) {
  let clean = selector
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/::?(before|after|first-letter|first-line|placeholder|backdrop)/gi, '__PSEUDO_ELEM__')
    .trim();

  let idCount = (clean.match(/#[a-zA-Z0-9_-]+/g) || []).length;
  let classCount = (clean.match(/\.[a-zA-Z0-9_-]+/g) || []).length;
  let attrCount = (clean.match(/\[[^\]]+\]/g) || []).length;
  let pseudoClassCount = (clean.match(/:[a-zA-Z0-9_-]+(\([^)]*\))?/g) || []).filter(
    (pc) => !pc.startsWith(':is') && !pc.startsWith(':where') && !pc.startsWith(':not')
  ).length;

  let pseudoElemCount = (clean.match(/__PSEUDO_ELEM__/g) || []).length;
  let typeCount = (clean.match(/(^|[\s>+~])([a-zA-Z0-9_-]+)/g) || []).filter(
    (t) => !t.includes('.') && !t.includes('#') && !t.includes('[')
  ).length;

  const a = idCount;
  const b = classCount + attrCount + pseudoClassCount;
  const c = typeCount + pseudoElemCount;

  return {
    tuple: [a, b, c],
    score: a * 100 + b * 10 + c,
    formatted: `${a},${b},${c}`,
  };
}

// 3. Быстрый сбор файлов с учетом игноров
function collectFiles(rootDir, extensions, isIgnored, fileList = []) {
  if (!fs.existsSync(rootDir)) return fileList;
  const entries = fs.readdirSync(rootDir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(rootDir, entry.name);
    const relPath = path.relative(process.cwd(), fullPath).replace(/\\/g, '/');

    if (isIgnored(relPath)) continue;

    if (entry.isDirectory()) {
      collectFiles(fullPath, extensions, isIgnored, fileList);
    } else if (entry.isFile() && extensions.some((ext) => entry.name.endsWith(ext))) {
      fileList.push(fullPath);
    }
  }
  return fileList;
}

// 4. Парсинг CSS и извлечение деклараций с !important
export function parseCssDeclarations(cssContent, filePath) {
  const lines = cssContent.split('\n');
  const results = [];

  // Контекст парсера
  const selectorStack = [];
  let currentBlockType = 'ruleset'; // ruleset, keyframes, at-rule
  let buffer = '';
  let inComment = false;

  for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    const rawLine = lines[lineIdx];
    let line = rawLine;

    // Очистка однострочных комментариев и отслеживание многострочных
    if (inComment) {
      const endCommentIdx = line.indexOf('*/');
      if (endCommentIdx !== -1) {
        line = line.substring(endCommentIdx + 2);
        inComment = false;
      } else {
        continue;
      }
    }

    while (line.includes('/*')) {
      const startIdx = line.indexOf('/*');
      const endIdx = line.indexOf('*/', startIdx + 2);
      if (endIdx !== -1) {
        line = line.substring(0, startIdx) + ' ' + line.substring(endIdx + 2);
      } else {
        line = line.substring(0, startIdx);
        inComment = true;
        break;
      }
    }

    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('//')) continue;

    // Проверка открытия/закрытия блоков
    for (let charIdx = 0; charIdx < line.length; charIdx++) {
      const char = line[charIdx];

      if (char === '{') {
        const selectorPart = buffer.trim();
        if (selectorPart.startsWith('@keyframes')) {
          selectorStack.push({ type: 'keyframes', name: selectorPart });
        } else if (selectorPart.startsWith('@')) {
          selectorStack.push({ type: 'at-rule', name: selectorPart });
        } else {
          selectorStack.push({ type: 'rule', name: selectorPart || 'anonymous' });
        }
        buffer = '';
      } else if (char === '}') {
        if (buffer.trim() && buffer.includes('!important')) {
          checkAndPushDeclaration(buffer.trim(), lineIdx + 1, selectorStack, filePath, results);
        }
        buffer = '';
        selectorStack.pop();
      } else if (char === ';') {
        if (buffer.includes('!important')) {
          checkAndPushDeclaration(buffer.trim(), lineIdx + 1, selectorStack, filePath, results);
        }
        buffer = '';
      } else {
        buffer += char;
      }
    }
  }

  return results;
}

function checkAndPushDeclaration(declStr, lineNumber, stack, filePath, results) {
  const colonIdx = declStr.indexOf(':');
  if (colonIdx === -1) return;

  const property = declStr.substring(0, colonIdx).trim();
  const valuePart = declStr.substring(colonIdx + 1).trim();

  if (!valuePart.includes('!important')) return;

  const cleanValue = valuePart.replace(/!important/g, '').trim();

  // Сборка полного селектора с учетом вложенности
  const fullSelector = stack
    .filter((s) => s.type === 'rule')
    .map((s) => s.name)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim() || '*';

  const isKeyframe = stack.some((s) => s.type === 'keyframes');
  if (isKeyframe) return; // В keyframes !important невалиден и игнорируется браузером

  const specificity = calculateSpecificity(fullSelector);

  results.push({
    file: path.relative(process.cwd(), filePath).replace(/\\/g, '/'),
    line: lineNumber,
    selector: fullSelector,
    property,
    value: cleanValue,
    specificity,
  });
}

// 5. Кросс-ссылочный анализ: Поиск связей с JS inline-styles и третьими библиотеками
const THIRD_PARTY_PATTERNS = [
  { pattern: /\.ProseMirror/i, name: 'Tiptap / ProseMirror Editor' },
  { pattern: /\.monaco-editor/i, name: 'Monaco Editor' },
  { pattern: /\.cm-editor/i, name: 'CodeMirror' },
  { pattern: /\.p-[a-z0-9_-]+/i, name: 'PrimeVue Component' },
  { pattern: /\.v-[a-z0-9_-]+/i, name: 'Vuetify / External Library' },
  { pattern: /\.tiptap/i, name: 'Tiptap Editor' },
  { pattern: /\.lucide/i, name: 'Lucide Icons' },
];

const UTILITY_PATTERNS = [
  /^\.(u|is|has)-[a-zA-Z0-9_-]+$/,
  /^\.hidden$/,
  /^\.visually-hidden$/,
  /^\.is-disabled$/,
  /^\.is-active$/,
  /^\[v-cloak\]$/,
  /body\.no-glass-blur/,
];

export function analyzeContext(item, sourceCodeIndex, allDeclarations) {
  const { file, selector, property, specificity } = item;
  const fileName = path.basename(file, path.extname(file));

  // 1. Проверка на сторонние библиотеки
  for (const tp of THIRD_PARTY_PATTERNS) {
    if (tp.pattern.test(selector)) {
      return {
        category: 'THIRD_PARTY_OVERRIDE',
        reason: `Перебивает дефолтные стили библиотеки: ${tp.name}`,
        suggestedFix: `Изолировать в *.override.css, использовать :deep(${selector}) или перенести в @layer third-party`,
        confidence: 'HIGH',
      };
    }
  }

  // 2. Проверка на JS inline-styles
  // Ищем парные TS/Vue файлы (например, если файл TimelinePanel.css -> смотрим TimelinePanel.vue / useTimelinePanel.ts)
  const relatedFiles = Object.keys(sourceCodeIndex).filter((srcFile) => {
    const base = path.basename(srcFile);
    return base.includes(fileName);
  });

  const propertyCamelCase = property.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
  let inlineJsMatch = null;

  for (const relFile of relatedFiles) {
    const code = sourceCodeIndex[relFile];
    const hasStyleProp =
      code.includes(`.style.${propertyCamelCase}`) ||
      code.includes(`.style.${property}`) ||
      code.includes(`:style`) ||
      code.includes(`'${property}':`) ||
      code.includes(`"${property}":`);

    if (hasStyleProp) {
      inlineJsMatch = relFile;
      break;
    }
  }

  if (inlineJsMatch) {
    return {
      category: 'JS_INLINE_OVERRIDE',
      reason: `Конфликт с динамическим style в JS/Vue (${inlineJsMatch})`,
      suggestedFix: `Убрать inline style из JS/Vue, использовать data-атрибуты (например :data-state или :data-${property}) для стилизации через чистые CSS токены`,
      confidence: 'HIGH',
    };
  }

  // 3. Проверка на Utility / Состояние
  const isUtility = UTILITY_PATTERNS.some((p) => p.test(selector));
  if (isUtility && (property === 'display' || property === 'pointer-events' || property === 'opacity' || property === 'visibility')) {
    return {
      category: 'UTILITY_CLASS',
      reason: `Утилитарный класс для управления состоянием DOM (${selector})`,
      suggestedFix: `Вынести в @layer utilities { ${selector} { ${property}: ${item.value}; } } без !important`,
      confidence: 'HIGH',
    };
  }

  // 4. Проверка на конфликт каскада (Self-Cascade Conflict)
  const collidingRules = allDeclarations.filter(
    (d) => d.file === file && d.property === property && d.line !== item.line
  );

  if (collidingRules.length > 0) {
    const parentSelector = selector.includes(' ') ? selector.split(' ')[0] : null;
    const suggestedSelector = parentSelector ? `${parentSelector} ${selector}` : `:is(${selector})`;
    return {
      category: 'SELF_CASCADE_CONFLICT',
      reason: `Конфликт правил внутри одного модуля. Перебивает: ${collidingRules.map((c) => `${c.selector} (L${c.line})`).join(', ')}`,
      suggestedFix: `Убрать !important, поднять специфичность селектора: \`${suggestedSelector}\` или упорядочить правила`,
      confidence: 'MEDIUM',
    };
  }

  // Дефолтный случай
  return {
    category: 'LOCAL_CASCADE_OVERRIDE',
    reason: `Принудительное переопределение специфичности (${specificity.formatted})`,
    suggestedFix: `Убрать !important и реорганизовать селектор с большей специфичностью`,
    confidence: 'LOW',
  };
}

// 6. Главный запуск анализатора
export function runAnalyzer() {
  const startTime = Date.now();
  console.log('🚀 Запуск детерминированного анализатора !important...\n');

  const cerberusConfig = loadCerberusConfig();
  const isIgnored = createIgnoreMatcher(cerberusConfig.ignore || []);

  const searchDirs = [
    path.resolve('packages/resources/src/styles'),
    path.resolve('packages/components/src'),
    path.resolve('apps/spa/src'),
  ];

  // 1. Сбор всех CSS файлов
  const cssFiles = [];
  for (const dir of searchDirs) {
    collectFiles(dir, ['.css'], isIgnored, cssFiles);
  }

  // 2. Сбор и индексация TS/Vue файлов в памяти для мгновенного cross-check
  const sourceFiles = [];
  for (const dir of searchDirs) {
    collectFiles(dir, ['.ts', '.vue', '.js'], isIgnored, sourceFiles);
  }

  const sourceCodeIndex = {};
  for (const file of sourceFiles) {
    const rel = path.relative(process.cwd(), file).replace(/\\/g, '/');
    sourceCodeIndex[rel] = fs.readFileSync(file, 'utf-8');
  }

  // 3. Парсинг всех деклараций CSS
  const allDeclarations = [];
  for (const file of cssFiles) {
    const content = fs.readFileSync(file, 'utf-8');
    const decls = parseCssDeclarations(content, file);
    allDeclarations.push(...decls);
  }

  // 4. Полноценный анализ контекста каждой декларации
  const categorizedResults = allDeclarations.map((item) => {
    const analysis = analyzeContext(item, sourceCodeIndex, allDeclarations);
    return {
      ...item,
      ...analysis,
    };
  });

  // 5. Статистика по категориям
  const stats = {
    total: categorizedResults.length,
    byCategory: {
      THIRD_PARTY_OVERRIDE: 0,
      JS_INLINE_OVERRIDE: 0,
      UTILITY_CLASS: 0,
      SELF_CASCADE_CONFLICT: 0,
      LOCAL_CASCADE_OVERRIDE: 0,
    },
    byConfidence: {
      HIGH: 0,
      MEDIUM: 0,
      LOW: 0,
    },
    filesCount: new Set(categorizedResults.map((r) => r.file)).size,
  };

  for (const item of categorizedResults) {
    stats.byCategory[item.category] = (stats.byCategory[item.category] || 0) + 1;
    stats.byConfidence[item.confidence] = (stats.byConfidence[item.confidence] || 0) + 1;
  }

  const duration = Date.now() - startTime;

  // 6. Вывод в консоль
  console.log(`⏱️  Анализ завершен за ${duration} мс!`);
  console.log(`📊 Всего найдено !important: ${stats.total} в ${stats.filesCount} файлах.\n`);
  console.log('📌 Распределение по категориям:');
  console.log(`   🔹 Third-party Overrides (Tiptap, Monaco, UI libs): ${stats.byCategory.THIRD_PARTY_OVERRIDE}`);
  console.log(`   🔹 JS Inline-Style Conflicts (style.transform и др.): ${stats.byCategory.JS_INLINE_OVERRIDE}`);
  console.log(`   🔹 Utility / State Classes (.hidden, .is-active):     ${stats.byCategory.UTILITY_CLASS}`);
  console.log(`   🔹 Self-Cascade Conflicts (война локальных селекторов): ${stats.byCategory.SELF_CASCADE_CONFLICT}`);
  console.log(`   🔹 Local Cascade Overrides (требуют ревизии):           ${stats.byCategory.LOCAL_CASCADE_OVERRIDE}\n`);

  console.log('🎯 Уровень уверенности (Confidence):');
  console.log(`   🟢 High:   ${stats.byConfidence.HIGH}`);
  console.log(`   🟡 Medium: ${stats.byConfidence.MEDIUM}`);
  console.log(`   ⚪ Low:    ${stats.byConfidence.LOW}\n`);

  // 7. Сохранение отчетов
  const cerberusDir = path.resolve('.cerberus');
  if (!fs.existsSync(cerberusDir)) {
    fs.mkdirSync(cerberusDir, { recursive: true });
  }

  // JSON отчет
  fs.writeFileSync(
    path.join(cerberusDir, 'important_analysis.json'),
    JSON.stringify({ stats, items: categorizedResults }, null, 2),
    'utf-8'
  );

  // Markdown отчет
  let mdContent = `# 🛡️ Cerberus CSS !important Context Analysis Report\n\n`;
  mdContent += `> Дата генерации: ${new Date().toISOString()} | Время анализа: **${duration} ms**\n\n`;
  mdContent += `### 📊 Сводка\n\n`;
  mdContent += `| Метрика | Значение |\n|---|---|\n`;
  mdContent += `| **Всего \`!important\`** | **${stats.total}** |\n`;
  mdContent += `| **Затронуто файлов** | **${stats.filesCount}** |\n`;
  mdContent += `| **Third-party Overrides** | ${stats.byCategory.THIRD_PARTY_OVERRIDE} |\n`;
  mdContent += `| **JS Inline-Style Conflicts** | ${stats.byCategory.JS_INLINE_OVERRIDE} |\n`;
  mdContent += `| **Utility Classes** | ${stats.byCategory.UTILITY_CLASS} |\n`;
  mdContent += `| **Self-Cascade Conflicts** | ${stats.byCategory.SELF_CASCADE_CONFLICT} |\n`;
  mdContent += `| **Local Overrides** | ${stats.byCategory.LOCAL_CASCADE_OVERRIDE} |\n\n`;

  mdContent += `### 📋 Детальный реестр нарушений\n\n`;

  categorizedResults.forEach((item, idx) => {
    mdContent += `#### ${idx + 1}. \`${item.file}:${item.line}\`\n`;
    mdContent += `- **Селектор**: \`${item.selector}\`\n`;
    mdContent += `- **Свойство**: \`${item.property}: ${item.value} !important\`\n`;
    mdContent += `- **Специфичность**: \`${item.specificity.formatted}\` (score: ${item.specificity.score})\n`;
    mdContent += `- **Категория**: \`${item.category}\` (Confidence: **${item.confidence}**)\n`;
    mdContent += `- **Причина**: ${item.reason}\n`;
    mdContent += `- **Рекомендация**: ${item.suggestedFix}\n\n`;
  });

  fs.writeFileSync(path.join(cerberusDir, 'important_analysis.md'), mdContent, 'utf-8');

  console.log(`📄 JSON отчет сохранен: .cerberus/important_analysis.json`);
  console.log(`📄 Markdown отчет сохранен: .cerberus/important_analysis.md\n`);

  return { stats, items: categorizedResults };
}

if (process.argv[1] && process.argv[1].endsWith('analyze_important_context.mjs')) {
  runAnalyzer();
}
