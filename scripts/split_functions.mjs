import fs from 'node:fs';
import path from 'node:path';

const sourceFile = 'c:/Users/Kuzma/Desktop/WorldWiki/apps/spa/src/logic/schema/no_ai/04_functions.surql';
const targetDir = 'c:/Users/Kuzma/Desktop/WorldWiki/apps/spa/src/logic/schema/no_ai/functions';

if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir, { recursive: true });
}

const content = fs.readFileSync(sourceFile, 'utf8');

// The 43 functions mapped to 7 domain modules
const modules = [
  {
    fileName: '01_analytics.surql',
    header: '-- 01_ANALYTICS.SURQL — АНАЛИТИЧЕСКИЕ И ГРАФОВЫЕ ФУНКЦИИ\n',
    sections: [1, 2, 3, 4, 5]
  },
  {
    fileName: '02_hierarchy.surql',
    header: '-- 02_HIERARCHY.SURQL — ИЕРАРХИЯ ГЛАВ И ТОМОВ РУКОПИСИ\n',
    sections: [6, 7, 8, 17, 18, 20]
  },
  {
    fileName: '03_relations.surql',
    header: '-- 03_RELATIONS.SURQL — СВЯЗИ И ОТНОШЕНИЯ СУЩНОСТЕЙ\n',
    sections: [9, 10, 11, 12, 19, 39]
  },
  {
    fileName: '04_projects_and_entities.surql',
    header: '-- 04_PROJECTS_AND_ENTITIES.SURQL — ПРОЕКТЫ И СУЩНОСТИ ЛОРА\n',
    sections: [13, 14, 15, 16, 34, 35, 36, 37, 38]
  },
  {
    fileName: '05_revisions_and_blocks.surql',
    header: '-- 05_REVISIONS_AND_BLOCKS.SURQL — РЕВИЗИИ И ТЕКСТОВЫЕ БЛОКИ\n',
    sections: [21, 22, 23, 24, 25, 26, 31]
  },
  {
    fileName: '06_schemas.surql',
    header: '-- 06_SCHEMAS.SURQL — МЕТА-СХЕМЫ СУЩНОСТЕЙ И СВЯЗЕЙ\n',
    sections: [27, 28, 29, 30, 32, 33]
  },
  {
    fileName: '07_narrative_and_journey.surql',
    header: '-- 07_NARRATIVE_AND_JOURNEY.SURQL — СЮЖЕТНЫЕ ОБЕЩАНИЯ И ИНВЕНТАРЬ\n',
    sections: [40, 41, 42, 43]
  }
];

// Split content by section headers `-- <N>. `
const sectionRegex = /^--\s*(\d+)\.\s*(.*)$/gm;
const sectionMap = new Map();

const matches = [];
let match;
while ((match = sectionRegex.exec(content)) !== null) {
  matches.push({
    num: parseInt(match[1], 10),
    title: match[2].trim(),
    index: match.index
  });
}

for (let i = 0; i < matches.length; i++) {
  const current = matches[i];
  const nextIndex = i + 1 < matches.length ? matches[i + 1].index : content.length;
  const sectionContent = content.substring(current.index, nextIndex).trim();
  sectionMap.set(current.num, sectionContent);
}

console.log(`Parsed ${sectionMap.size} sections from 04_functions.surql`);

for (const mod of modules) {
  const parts = [mod.header];
  for (const secNum of mod.sections) {
    const secText = sectionMap.get(secNum);
    if (secText) {
      parts.push(secText);
    } else {
      console.warn(`Warning: Section ${secNum} not found for ${mod.fileName}`);
    }
  }
  const filePath = path.join(targetDir, mod.fileName);
  fs.writeFileSync(filePath, parts.join('\n\n') + '\n', 'utf8');
  console.log(`Wrote ${mod.fileName} with ${mod.sections.length} sections (${parts.join('\n\n').length} bytes)`);
}
