import fs from 'node:fs';
import path from 'node:path';

const ROOT_DIR = process.cwd();
const SRC_TAURI_DIR = path.join(ROOT_DIR, 'src-tauri');
const SPA_TYPES_DIR = path.join(ROOT_DIR, 'apps/spa/src/ts/types/generated');
const SPA_STORES_DIR = path.join(ROOT_DIR, 'apps/spa/src/ts/stores');

console.log('🔍 Запуск аудита Entity as DTO и несоответствий сигнатур IPC-команд...\n');

// 1. Рекурсивный сбор всех .rs файлов
function getFiles(dir, ext = '.rs') {
  let results = [];
  if (!fs.existsSync(dir)) return results;
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      if (file !== 'target' && file !== 'node_modules' && file !== '.git') {
        results = results.concat(getFiles(fullPath, ext));
      }
    } else if (file.endsWith(ext)) {
      results.push(fullPath);
    }
  }
  return results;
}

const rsFiles = getFiles(SRC_TAURI_DIR, '.rs');

// 2. Парсинг всех Rust-структур
const structDefinitions = new Map();

for (const filePath of rsFiles) {
  const content = fs.readFileSync(filePath, 'utf-8');
  
  // Регэксп для поиска struct Foo { ... }
  const structRegex = /(?:#\[derive\([^)]*\)\]\s*)*(?:pub\s+)?struct\s+([A-Za-z0-9_]+)\s*\{([^}]+)\}/gs;
  let match;
  while ((match = structRegex.exec(content)) !== null) {
    const structName = match[1];
    const body = match[2];
    
    const fields = [];
    // Разбор полей: #[attr] pub name: Type,
    const fieldLines = body.split('\n');
    let currentAttrs = [];
    
    for (let line of fieldLines) {
      line = line.trim();
      if (!line || line.startsWith('//')) continue;
      
      if (line.startsWith('#[')) {
        currentAttrs.push(line);
        continue;
      }
      
      const fieldMatch = /(?:pub\s+)?([A-Za-z0-9_]+)\s*:\s*([^,;]+)/.exec(line);
      if (fieldMatch) {
        const fieldName = fieldMatch[1];
        const fieldType = fieldMatch[2].trim();
        const hasSerdeDefault = currentAttrs.some(a => a.includes('serde(default'));
        const skipDeserializing = currentAttrs.some(a => a.includes('skip_deserializing'));
        const isOption = fieldType.startsWith('Option<');
        
        fields.push({
          name: fieldName,
          type: fieldType,
          isOption,
          hasSerdeDefault,
          skipDeserializing,
          attrs: [...currentAttrs]
        });
        currentAttrs = [];
      } else {
        currentAttrs = [];
      }
    }
    
    structDefinitions.set(structName, {
      file: path.relative(ROOT_DIR, filePath).replace(/\\/g, '/'),
      fields
    });
  }

  // Также разбор surreal_entity! макросов
  const surrealEntityRegex = /surreal_entity!\s*\{([^}]+struct\s+([A-Za-z0-9_]+)\s*\{([^}]+)\})/gs;
  while ((match = surrealEntityRegex.exec(content)) !== null) {
    const structName = match[2];
    const body = match[3];
    const fields = [];
    const lines = body.split('\n');
    for (let l of lines) {
      l = l.trim();
      const fm = /(?:pub\s+)?([A-Za-z0-9_]+)\s*:\s*([^,;]+)/.exec(l);
      if (fm) {
        fields.push({
          name: fm[1],
          type: fm[2].trim(),
          isOption: fm[2].trim().startsWith('Option<'),
          hasSerdeDefault: false,
          attrs: []
        });
      }
    }
    if (!structDefinitions.has(structName)) {
      structDefinitions.set(structName, {
        file: path.relative(ROOT_DIR, filePath).replace(/\\/g, '/'),
        fields
      });
    }
  }
}

// 3. Поиск всех Tauri команд
const tauriCommands = [];

for (const filePath of rsFiles) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const cmdRegex = /#\[tauri::command\]\s*(?:pub\s+)?async\s+fn\s+([a-z0-9_]+)\s*\(([^)]*)\)/gs;
  let match;
  while ((match = cmdRegex.exec(content)) !== null) {
    const fnName = match[1];
    const rawParams = match[2].trim();
    
    const params = [];
    if (rawParams) {
      // Разделение параметров с учетом generic скобок
      const paramList = splitParams(rawParams);
      for (const p of paramList) {
        const parts = p.split(':');
        if (parts.length >= 2) {
          const pName = parts[0].trim();
          const pType = parts.slice(1).join(':').trim();
          
          // Пропускаем инжекты Tauri
          if (!pType.startsWith('State<') && !pType.startsWith('AppHandle') && !pType.startsWith('Window')) {
            params.push({ name: pName, type: pType });
          }
        }
      }
    }
    
    tauriCommands.push({
      fnName,
      file: path.relative(ROOT_DIR, filePath).replace(/\\/g, '/'),
      params
    });
  }
}

function splitParams(raw) {
  const result = [];
  let depth = 0;
  let current = '';
  for (let i = 0; i < raw.length; i++) {
    const c = raw[i];
    if (c === '<' || c === '(' || c === '[' || c === '{') depth++;
    else if (c === '>' || c === ')' || c === ']' || c === '}') depth--;
    
    if (c === ',' && depth === 0) {
      result.push(current.trim());
      current = '';
    } else {
      current += c;
    }
  }
  if (current.trim()) result.push(current.trim());
  return result;
}

// 4. Поиск TypeScript сгенерированных типов
const tsGeneratedTypes = new Map();
if (fs.existsSync(SPA_TYPES_DIR)) {
  const tsFiles = fs.readdirSync(SPA_TYPES_DIR).filter(f => f.endsWith('.ts'));
  for (const f of tsFiles) {
    const name = f.replace('.ts', '');
    const content = fs.readFileSync(path.join(SPA_TYPES_DIR, f), 'utf-8');
    const fields = new Set();
    const optionalFields = new Set();
    
    const fieldRegex = /([a-zA-Z0-9_]+)(\?)?:\s*[^;,]+/g;
    let m;
    while ((m = fieldRegex.exec(content)) !== null) {
      const fName = m[1];
      const isOpt = m[2] === '?';
      fields.add(fName);
      if (isOpt) optionalFields.add(fName);
    }
    tsGeneratedTypes.set(name, { fields, optionalFields, file: f });
  }
}

// 5. Анализ антипаттернов
const criticalAuditFailures = [];
const entityAsDtoViolations = [];
const safeCommands = [];

for (const cmd of tauriCommands) {
  const isMutation = cmd.fnName.startsWith('save_') || 
                     cmd.fnName.startsWith('create_') || 
                     cmd.fnName.startsWith('update_') || 
                     cmd.fnName.startsWith('upsert_') ||
                     cmd.fnName.startsWith('assign_') ||
                     cmd.fnName.startsWith('add_');
  
  if (!isMutation) continue;
  
  for (const param of cmd.params) {
    const cleanType = param.type.replace('&', '').trim();
    const structDef = structDefinitions.get(cleanType);
    
    if (structDef) {
      // Проверяем наличие системных полей аудита
      const dangerousFields = [];
      for (const field of structDef.fields) {
        const isSystemAuditField = ['created_at', 'updated_at', 'id'].includes(field.name);
        if (isSystemAuditField) {
          // Если поле НЕ Option и НЕ имеет serde(default)
          if (!field.isOption && !field.hasSerdeDefault) {
            dangerousFields.push(field);
          }
        }
      }
      
      // Сверяем с TS
      const tsDef = tsGeneratedTypes.get(cleanType);
      let missingInTs = [];
      if (tsDef) {
        for (const df of dangerousFields) {
          if (!tsDef.fields.has(df.name) || tsDef.optionalFields.has(df.name)) {
            missingInTs.push(df.name);
          }
        }
      }
      
      if (dangerousFields.length > 0) {
        criticalAuditFailures.push({
          command: cmd.fnName,
          file: cmd.file,
          paramName: param.name,
          paramType: cleanType,
          structFile: structDef.file,
          dangerousFields: dangerousFields.map(f => `${f.name}: ${f.type}`),
          missingInTs
        });
      } else {
        // Проверяем, есть ли незащищенные поля аудита, которые десериализуются из JSON
        const unshieldedAuditFields = structDef.fields.filter(f => 
          ['created_at', 'updated_at'].includes(f.name) && !f.skipDeserializing
        );
        if (unshieldedAuditFields.length > 0) {
          entityAsDtoViolations.push({
            command: cmd.fnName,
            file: cmd.file,
            paramName: param.name,
            paramType: cleanType,
            structFile: structDef.file,
            fields: unshieldedAuditFields.map(f => f.name)
          });
        }
      }
    }
  }
}

// 6. Вывод отчёта
console.log('========================================================================');
console.log(`🚨 КРИТИЧЕСКИЕ ОШИБКИ ДЕСЕРИАЛИЗАЦИИ (POTENTIAL CRASHES): ${criticalAuditFailures.length}`);
console.log('========================================================================');
if (criticalAuditFailures.length === 0) {
  console.log('✅ Нет критических расхождений, ломающих десериализацию на лету!');
} else {
  for (const f of criticalAuditFailures) {
    console.log(`\n❌ Команда: \x1b[31m${f.command}\x1b[0m (в файле ${f.file})`);
    console.log(`   Аргумент: "${f.paramName}: ${f.paramType}" (структура объявлена в ${f.structFile})`);
    console.log(`   Опасные поля без Option и без serde(default):`);
    for (const d of f.dangerousFields) {
      console.log(`     - \x1b[33m${d}\x1b[0m`);
    }
    if (f.missingInTs.length > 0) {
      console.log(`   ⚠️ Эти поля отсутствуют или опциональны во фронтенд TypeScript: \x1b[31m${f.missingInTs.join(', ')}\x1b[0m`);
      console.log(`   💥 ПРИЧИНА СБОЯ: Если фронтенд вызовет эту команду без этих полей, Tauri выбросит:`);
      console.log(`      "invalid args \`${f.paramName}\`: missing field \`${f.missingInTs[0]}\`"`);
    }
  }
}

console.log('\n========================================================================');
console.log(`⚠️ АРХИТЕКТУРНЫЕ АНТИПАТТЕРНЫ (ENTITY AS DTO В МУТИРУЮЩИХ КОМАНДАХ): ${entityAsDtoViolations.length}`);
console.log('========================================================================');
for (const v of entityAsDtoViolations) {
  console.log(`🔶 Команда: \x1b[33m${v.command}\x1b[0m`);
  console.log(`   Файл: ${v.file}`);
  console.log(`   Аргумент: "${v.paramName}: ${v.paramType}"`);
  console.log(`   Проблема: Доменная модель с системными полями базы данных принимается напрямую на запись.`);
  console.log('   ---');
}

console.log('\n========================================================================');
console.log('📊 ИТОГ АУДИТА:');
console.log(`- Всего просканировано Rust файлов: ${rsFiles.length}`);
console.log(`- Всего Tauri команд: ${tauriCommands.length}`);
console.log(`- Критических бомб замедленного действия (Missing field crash): ${criticalAuditFailures.length}`);
console.log(`- Случаев антипаттерна Entity as DTO: ${entityAsDtoViolations.length}`);
console.log('========================================================================\n');
