import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';

function resolvePandoc() {
  const candidates = [
    'C:\\Program Files\\Pandoc\\pandoc.exe',
    path.join(process.env.LOCALAPPDATA || '', 'Pandoc', 'pandoc.exe'),
  ];
  for (const p of candidates) {
    if (p && fs.existsSync(p)) return p;
  }
  return 'pandoc';
}

const pandocBin = resolvePandoc();
const rootDir = process.cwd();
const courseworkDir = path.resolve(rootDir, 'docs/coursework');
const outDir = path.join(courseworkDir, 'export');
const refDoc = path.resolve(rootDir, 'scratch/gost_reference.docx');

fs.mkdirSync(outDir, { recursive: true });

function buildGostReferenceDoc(targetPath) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ww-gost-ref-'));
  const rawRefZip = path.join(tmpDir, 'raw_ref.zip');
  const unpackDir = path.join(tmpDir, 'unpacked');

  try {
    const refBytes = execFileSync(pandocBin, ['--print-default-data-file', 'reference.docx']);
    fs.writeFileSync(rawRefZip, refBytes);

    fs.mkdirSync(unpackDir, { recursive: true });
    execFileSync('powershell', [
      '-NoProfile',
      '-Command',
      `Add-Type -AssemblyName System.IO.Compression.FileSystem; [System.IO.Compression.ZipFile]::ExtractToDirectory('${rawRefZip}', '${unpackDir}')`,
    ]);

    // 1. Поля страницы A4 по ГОСТ 7.32-2017: лево 30мм (1701), право 15мм (850), верх/низ 20мм (1134)
    const docXmlPath = path.join(unpackDir, 'word', 'document.xml');
    let docXml = fs.readFileSync(docXmlPath, 'utf8');
    docXml = docXml.replace(
      /<w:pgSz[^/]*\/>/,
      '<w:pgSz w:w="11906" w:h="16838"/>'
    );
    docXml = docXml.replace(
      /<w:pgMar[^/]*\/>/,
      '<w:pgMar w:top="1134" w:right="850" w:bottom="1134" w:left="1701" w:header="567" w:footer="567" w:gutter="0"/>'
    );
    fs.writeFileSync(docXmlPath, docXml, 'utf8');

    // 2. Тема документа: заменяем все латинские/системные шрифты на Times New Roman
    const themeXmlPath = path.join(unpackDir, 'word', 'theme', 'theme1.xml');
    if (fs.existsSync(themeXmlPath)) {
      let themeXml = fs.readFileSync(themeXmlPath, 'utf8');
      themeXml = themeXml.replace(/typeface="Calibri[^"]*"/g, 'typeface="Times New Roman"');
      themeXml = themeXml.replace(/typeface="Cambria[^"]*"/g, 'typeface="Times New Roman"');
      themeXml = themeXml.replace(/typeface="Aptos[^"]*"/g, 'typeface="Times New Roman"');
      themeXml = themeXml.replace(/typeface="Consolas"/g, 'typeface="Courier New"');
      fs.writeFileSync(themeXmlPath, themeXml, 'utf8');
    }

    // 3. Стили ГОСТ: Times New Roman 14pt, чёрный цвет, 1.5 интервал, красная строка 1.25 см, таблицы 10pt, код Courier New 10pt
    const stylesXmlPath = path.join(unpackDir, 'word', 'styles.xml');
    let stylesXml = fs.readFileSync(stylesXmlPath, 'utf8');

    // Заменяем все шрифты в теме/стилях на Times New Roman
    stylesXml = stylesXml.replace(/w:asciiTheme="[^"]*"/g, 'w:ascii="Times New Roman"');
    stylesXml = stylesXml.replace(/w:hAnsiTheme="[^"]*"/g, 'w:hAnsi="Times New Roman"');
    stylesXml = stylesXml.replace(/w:eastAsiaTheme="[^"]*"/g, 'w:eastAsia="Times New Roman"');
    stylesXml = stylesXml.replace(/w:cstheme="[^"]*"/g, 'w:cs="Times New Roman"');
    stylesXml = stylesXml.replace(/w:ascii="Calibri"|w:ascii="Cambria"|w:ascii="Aptos"/g, 'w:ascii="Times New Roman"');
    stylesXml = stylesXml.replace(/w:hAnsi="Calibri"|w:hAnsi="Cambria"|w:hAnsi="Aptos"/g, 'w:hAnsi="Times New Roman"');
    stylesXml = stylesXml.replace(/w:cs="Calibri"|w:cs="Cambria"|w:cs="Aptos"/g, 'w:cs="Times New Roman"');

    // Все синие/цветные заголовки pandoc красим в чёрный 000000
    stylesXml = stylesXml.replace(/w:color w:val="[0-9A-Fa-f]{6}"/g, 'w:color w:val="000000"');
    stylesXml = stylesXml.replace(/w:themeColor="[^"]*"/g, 'w:val="000000"');

    // Жёстко задаём docDefaults (14 pt Times New Roman для любого текста, включая латиницу),
    // чтобы Normal/Compact не содержали sz и таблицы (sz=20 = 10 pt) перебивали размер по правилам OOXML.
    const docDefaultsXml = `<w:docDefaults>
    <w:rPrDefault>
      <w:rPr>
        <w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:eastAsia="Times New Roman" w:cs="Times New Roman"/>
        <w:color w:val="000000"/>
        <w:sz w:val="28"/>
        <w:szCs w:val="28"/>
      </w:rPr>
    </w:rPrDefault>
    <w:pPrDefault>
      <w:pPr>
        <w:spacing w:before="0" w:after="0" w:line="360" w:lineRule="auto"/>
      </w:pPr>
    </w:pPrDefault>
  </w:docDefaults>`;
    stylesXml = stylesXml.replace(/<w:docDefaults>[\s\S]*?<\/w:docDefaults>/, docDefaultsXml);

    // Добавляем явные ГОСТ-переопределения стилей перед закрывающим </w:styles>
    const gostOverrides = `
  <w:style w:type="paragraph" w:default="1" w:styleId="Normal">
    <w:name w:val="Normal"/>
    <w:qFormat/>
    <w:pPr>
      <w:spacing w:before="0" w:after="0" w:line="360" w:lineRule="auto"/>
      <w:ind w:firstLine="709"/>
      <w:jc w:val="both"/>
    </w:pPr>
    <w:rPr>
      <w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:eastAsia="Times New Roman" w:cs="Times New Roman"/>
      <w:color w:val="000000"/>
    </w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="BodyText">
    <w:name w:val="Body Text"/>
    <w:basedOn w:val="Normal"/>
    <w:pPr>
      <w:spacing w:before="0" w:after="0" w:line="360" w:lineRule="auto"/>
      <w:ind w:firstLine="709"/>
      <w:jc w:val="both"/>
    </w:pPr>
    <w:rPr>
      <w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:eastAsia="Times New Roman" w:cs="Times New Roman"/>
      <w:color w:val="000000"/>
    </w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="FirstParagraph">
    <w:name w:val="First Paragraph"/>
    <w:basedOn w:val="BodyText"/>
    <w:pPr>
      <w:spacing w:before="0" w:after="0" w:line="360" w:lineRule="auto"/>
      <w:ind w:firstLine="709"/>
      <w:jc w:val="both"/>
    </w:pPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Compact">
    <w:name w:val="Compact"/>
    <w:basedOn w:val="Normal"/>
    <w:pPr>
      <w:ind w:firstLine="0" w:left="0"/>
      <w:jc w:val="left"/>
    </w:pPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading1">
    <w:name w:val="heading 1"/>
    <w:basedOn w:val="Normal"/>
    <w:next w:val="Normal"/>
    <w:qFormat/>
    <w:pPr>
      <w:keepNext/>
      <w:keepLines/>
      <w:pageBreakBefore/>
      <w:spacing w:before="0" w:after="240" w:line="360" w:lineRule="auto"/>
      <w:ind w:firstLine="0"/>
      <w:jc w:val="center"/>
    </w:pPr>
    <w:rPr>
      <w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/>
      <w:b/>
      <w:color w:val="000000"/>
      <w:sz w:val="32"/>
      <w:szCs w:val="32"/>
    </w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading2">
    <w:name w:val="heading 2"/>
    <w:basedOn w:val="Normal"/>
    <w:next w:val="Normal"/>
    <w:qFormat/>
    <w:pPr>
      <w:keepNext/>
      <w:keepLines/>
      <w:spacing w:before="240" w:after="160" w:line="360" w:lineRule="auto"/>
      <w:ind w:firstLine="709"/>
      <w:jc w:val="left"/>
    </w:pPr>
    <w:rPr>
      <w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/>
      <w:b/>
      <w:color w:val="000000"/>
      <w:sz w:val="28"/>
      <w:szCs w:val="28"/>
    </w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading3">
    <w:name w:val="heading 3"/>
    <w:basedOn w:val="Normal"/>
    <w:next w:val="Normal"/>
    <w:qFormat/>
    <w:pPr>
      <w:keepNext/>
      <w:keepLines/>
      <w:spacing w:before="200" w:after="120" w:line="360" w:lineRule="auto"/>
      <w:ind w:firstLine="709"/>
      <w:jc w:val="left"/>
    </w:pPr>
    <w:rPr>
      <w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/>
      <w:b/>
      <w:color w:val="000000"/>
      <w:sz w:val="28"/>
      <w:szCs w:val="28"/>
    </w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading4">
    <w:name w:val="heading 4"/>
    <w:basedOn w:val="Normal"/>
    <w:next w:val="Normal"/>
    <w:qFormat/>
    <w:pPr>
      <w:keepNext/>
      <w:keepLines/>
      <w:spacing w:before="160" w:after="100" w:line="360" w:lineRule="auto"/>
      <w:ind w:firstLine="709"/>
      <w:jc w:val="left"/>
    </w:pPr>
    <w:rPr>
      <w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/>
      <w:b/>
      <w:color w:val="000000"/>
      <w:sz w:val="28"/>
      <w:szCs w:val="28"/>
    </w:rPr>
  </w:style>
  <w:style w:type="table" w:styleId="Table">
    <w:name w:val="Table"/>
    <w:tblPr>
      <w:tblBorders>
        <w:top w:val="single" w:sz="4" w:space="0" w:color="000000"/>
        <w:left w:val="single" w:sz="4" w:space="0" w:color="000000"/>
        <w:bottom w:val="single" w:sz="4" w:space="0" w:color="000000"/>
        <w:right w:val="single" w:sz="4" w:space="0" w:color="000000"/>
        <w:insideH w:val="single" w:sz="4" w:space="0" w:color="000000"/>
        <w:insideV w:val="single" w:sz="4" w:space="0" w:color="000000"/>
      </w:tblBorders>
      <w:tblCellMar>
        <w:top w:w="60" w:type="dxa"/>
        <w:left w:w="100" w:type="dxa"/>
        <w:bottom w:w="60" w:type="dxa"/>
        <w:right w:w="100" w:type="dxa"/>
      </w:tblCellMar>
    </w:tblPr>
    <w:pPr>
      <w:spacing w:before="0" w:after="0" w:line="240" w:lineRule="auto"/>
      <w:ind w:firstLine="0"/>
      <w:jc w:val="left"/>
    </w:pPr>
    <w:rPr>
      <w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:eastAsia="Times New Roman" w:cs="Times New Roman"/>
      <w:color w:val="000000"/>
      <w:sz w:val="20"/>
      <w:szCs w:val="20"/>
    </w:rPr>
  </w:style>
  <w:style w:type="character" w:styleId="VerbatimChar">
    <w:name w:val="Verbatim Char"/>
    <w:rPr>
      <w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:eastAsia="Times New Roman" w:cs="Times New Roman"/>
      <w:color w:val="000000"/>
    </w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="SourceCode">
    <w:name w:val="Source Code"/>
    <w:basedOn w:val="Normal"/>
    <w:pPr>
      <w:spacing w:before="0" w:after="0" w:line="240" w:lineRule="auto"/>
      <w:ind w:firstLine="0" w:left="0"/>
      <w:jc w:val="left"/>
    </w:pPr>
    <w:rPr>
      <w:rFonts w:ascii="Courier New" w:hAnsi="Courier New" w:eastAsia="Courier New" w:cs="Courier New"/>
      <w:color w:val="000000"/>
      <w:sz w:val="20"/>
      <w:szCs w:val="20"/>
    </w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:customStyle="1" w:styleId="TableCaption">
    <w:name w:val="TableCaption"/>
    <w:basedOn w:val="Normal"/>
    <w:next w:val="Normal"/>
    <w:qFormat/>
    <w:pPr>
      <w:keepNext/>
      <w:spacing w:before="160" w:after="80" w:line="240" w:lineRule="auto"/>
      <w:ind w:firstLine="0" w:left="0"/>
      <w:jc w:val="left"/>
    </w:pPr>
    <w:rPr>
      <w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/>
      <w:color w:val="000000"/>
      <w:sz w:val="28"/>
      <w:szCs w:val="28"/>
    </w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:customStyle="1" w:styleId="ImageCaption">
    <w:name w:val="ImageCaption"/>
    <w:basedOn w:val="Normal"/>
    <w:next w:val="Normal"/>
    <w:qFormat/>
    <w:pPr>
      <w:spacing w:before="80" w:after="160" w:line="240" w:lineRule="auto"/>
      <w:ind w:firstLine="0" w:left="0"/>
      <w:jc w:val="center"/>
    </w:pPr>
    <w:rPr>
      <w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/>
      <w:color w:val="000000"/>
      <w:sz w:val="28"/>
      <w:szCs w:val="28"/>
    </w:rPr>
  </w:style>
`;

    // Удаляем дублирующиеся определения стилей с теми же styleId, чтобы Word не конфликтовал
    const overrideIds = [
      'Normal',
      'BodyText',
      'FirstParagraph',
      'Compact',
      'Heading1',
      'Heading2',
      'Heading3',
      'Heading4',
      'Table',
      'VerbatimChar',
      'SourceCode',
      'TableCaption',
      'ImageCaption',
    ];
    for (const sid of overrideIds) {
      const re = new RegExp(`<w:style[^>]*w:styleId="${sid}"[\\s\\S]*?<\\/w:style>`, 'g');
      stylesXml = stylesXml.replace(re, '');
    }
    stylesXml = stylesXml.replace('</w:styles>', `${gostOverrides}\n</w:styles>`);
    fs.writeFileSync(stylesXmlPath, stylesXml, 'utf8');

    const outZip = path.join(tmpDir, 'out_ref.zip');
    execFileSync('powershell', [
      '-NoProfile',
      '-Command',
      `Add-Type -AssemblyName System.IO.Compression.FileSystem; [System.IO.Compression.ZipFile]::CreateFromDirectory('${unpackDir}', '${outZip}')`,
    ]);
    fs.copyFileSync(outZip, targetPath);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

buildGostReferenceDoc(refDoc);
console.log(`Сформирован ГОСТ-шаблон: ${refDoc}`);

const sections = [
  '02_Исследовательская_часть',
  '03_Проектно_конструкторская_часть',
  '04_Проектно_технологическая_часть',
];

function formatGostCaptions(md) {
  let inFence = false;
  return md
    .split(/\r?\n/)
    .map((line) => {
      if (/^\s*```/.test(line)) {
        inFence = !inFence;
        return line;
      }
      if (inFence) return line;
      if (/^\s*---\s*$/.test(line)) return '';

      const tblMatch = line.match(/^\s*((?:Таблица|Листинг)\s+[\dА-ЯЁ]+(?:\.\d+)*\s*[—–-]\s*.+?)\.?\s*$/);
      if (tblMatch) {
        return `\n::: {custom-style="TableCaption"}\n${tblMatch[1]}\n:::\n`;
      }

      const imgMatch = line.match(/^\s*_?(Рисунок\s+[\dА-ЯЁ]+(?:\.\d+)*\s*[—–-]\s*.+?)_?\.?\s*$/);
      if (imgMatch) {
        const clean = imgMatch[1].replace(/_$/, '');
        return `\n::: {custom-style="ImageCaption"}\n${clean}\n:::\n`;
      }

      return line;
    })
    .join('\n')
    .trimEnd();
}

function exportMarkdownFilesToDocx(label, files, resourceDirs, outFile) {
  console.log(`Экспорт ${label} (${files.length} файл(ов)) -> ${outFile}`);

  const mergedMd = files
    .map((f) => formatGostCaptions(fs.readFileSync(f, 'utf8')))
    .join('\n\n');

  const tmpMd = path.join(os.tmpdir(), `ww_${label.replace(/[^\wА-Яа-яЁё-]+/g, '_')}.md`);
  fs.writeFileSync(tmpMd, mergedMd, 'utf8');

  try {
    execFileSync(
      pandocBin,
      [
        tmpMd,
        '-f',
        'markdown+lists_without_preceding_blankline+tex_math_dollars',
        '-t',
        'docx',
        '--no-highlight',
        `--reference-doc=${refDoc}`,
        `--resource-path=${resourceDirs.join(';')}`,
        '-o',
        outFile,
      ],
      { cwd: courseworkDir, stdio: 'inherit' }
    );
  } finally {
    fs.rmSync(tmpMd, { force: true });
  }
}

for (const sec of sections) {
  const secDir = path.join(courseworkDir, sec);
  const files = fs
    .readdirSync(secDir, { withFileTypes: true })
    .filter((d) => d.isFile() && d.name.toLowerCase().endsWith('.md'))
    .map((d) => path.join(secDir, d.name))
    .sort((a, b) => a.localeCompare(b, 'ru', { numeric: true }));

  if (files.length === 0) {
    console.warn(`[WARN] Нет .md файлов в ${sec}`);
    continue;
  }

  exportMarkdownFilesToDocx(
    sec,
    files,
    [courseworkDir, secDir, path.join(courseworkDir, 'diagrams')],
    path.join(outDir, `${sec}.docx`)
  );
}

const appendixFiles = fs
  .readdirSync(courseworkDir, { withFileTypes: true })
  .filter((d) => d.isFile() && d.name.startsWith('Приложение_') && d.name.toLowerCase().endsWith('.md'))
  .map((d) => d.name)
  .sort((a, b) => a.localeCompare(b, 'ru', { numeric: true }));

for (const appName of appendixFiles) {
  const baseName = appName.replace(/\.md$/i, '');
  exportMarkdownFilesToDocx(
    baseName,
    [path.join(courseworkDir, appName)],
    [courseworkDir, path.join(courseworkDir, 'diagrams')],
    path.join(outDir, `${baseName}.docx`)
  );
}

console.log(`\nГотово! ГОСТ-документы сохранены в: ${outDir}`);
