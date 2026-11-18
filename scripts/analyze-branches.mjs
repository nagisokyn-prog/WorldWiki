#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const cwd = process.cwd();
const coveragePath = path.resolve(cwd, 'coverage/coverage-final.json');

const args = process.argv.slice(2);
const getArg = (prefix) => {
  const found = args.find((a) => a.startsWith(prefix));
  return found ? found.slice(prefix.length) : null;
};

const topLimit = args.includes('--all') ? Infinity : Number(getArg('--top=') ?? 20);
const fileFilter = getArg('--file=');
const targetGoal = Number(getArg('--target=') ?? 85);
const maxLinesPerFile = Number(getArg('--lines=') ?? 12);
const outArg = getArg('--out=');

if (!fs.existsSync(coveragePath)) {
  console.error(`Coverage file not found: ${coveragePath}`);
  console.error('Run "npm run test:coverage" first to generate coverage/coverage-final.json.');
  process.exit(1);
}

const raw = JSON.parse(fs.readFileSync(coveragePath, 'utf8'));
const sourceCache = new Map();

function getSourceLine(absPath, lineNum) {
  if (!lineNum || lineNum < 1) return '';
  if (!sourceCache.has(absPath)) {
    try {
      sourceCache.set(absPath, fs.readFileSync(absPath, 'utf8').split(/\r?\n/));
    } catch {
      sourceCache.set(absPath, []);
    }
  }
  const lines = sourceCache.get(absPath);
  const text = (lines[lineNum - 1] ?? '').trim();
  return text.length > 100 ? `${text.slice(0, 97)}...` : text;
}

const fileReports = [];
let globalCovered = 0;
let globalTotal = 0;

for (const [absPath, entry] of Object.entries(raw)) {
  const rel = path.relative(cwd, absPath).replace(/\\/g, '/');
  const branchMap = entry.branchMap || {};
  const bCounts = entry.b || {};

  let bTotal = 0;
  let bCov = 0;
  const uncovered = [];

  for (const [bId, counts] of Object.entries(bCounts)) {
    const meta = branchMap[bId] || {};
    const type = meta.type || 'branch';
    const locations = meta.locations || [];

    counts.forEach((hitCount, armIdx) => {
      bTotal += 1;
      if (hitCount > 0) {
        bCov += 1;
      } else {
        const armLoc = locations[armIdx];
        const loc = armLoc && armLoc.start && armLoc.start.line > 0 ? armLoc : meta.loc;
        const line = loc?.start?.line ?? 0;
        const col = loc?.start?.column ?? 0;
        uncovered.push({
          line,
          col,
          type,
          armIdx,
          totalArms: counts.length,
          code: getSourceLine(absPath, line),
        });
      }
    });
  }

  globalCovered += bCov;
  globalTotal += bTotal;

  if (uncovered.length > 0) {
    uncovered.sort((a, b) => a.line - b.line || a.armIdx - b.armIdx);
    fileReports.push({
      file: rel,
      bCov,
      bTotal,
      uncoveredCount: bTotal - bCov,
      pct: bTotal === 0 ? 100 : (bCov / bTotal) * 100,
      uncovered,
    });
  }
}

const globalPct = globalTotal === 0 ? 100 : (globalCovered / globalTotal) * 100;
const targetBranches = Math.ceil((targetGoal / 100) * globalTotal);
const needed = Math.max(0, targetBranches - globalCovered);

const filtered = fileReports
  .filter((r) => !fileFilter || r.file.toLowerCase().includes(fileFilter.toLowerCase()))
  .sort((a, b) => b.uncoveredCount - a.uncoveredCount);

const linesOut = [];
linesOut.push(`Global Branches: ${globalCovered}/${globalTotal} (${globalPct.toFixed(2)}%)`);
linesOut.push(`Target ${targetGoal}%: ${targetBranches}/${globalTotal} (need +${needed} branches)`);
linesOut.push(`Files with uncovered branches: ${filtered.length}`);
linesOut.push('');

let cumulative = 0;
for (const r of filtered.slice(0, topLimit)) {
  cumulative += r.uncoveredCount;
  linesOut.push(
    `[${r.uncoveredCount} uncovered | ${r.pct.toFixed(1)}% (${r.bCov}/${r.bTotal}) | cumul +${cumulative}] ${r.file}`
  );
  const shown = r.uncovered.slice(0, maxLinesPerFile);
  for (const u of shown) {
    linesOut.push(`  L${u.line}:${u.col} (${u.type} arm ${u.armIdx + 1}/${u.totalArms}) -> ${u.code}`);
  }
  if (r.uncovered.length > shown.length) {
    linesOut.push(`  ... +${r.uncovered.length - shown.length} more (pass --lines=999 --file=${path.basename(r.file)} to view all)`);
  }
  linesOut.push('');
}

const outputText = linesOut.join('\n');
if (outArg) {
  const outPath = path.resolve(cwd, outArg);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, outputText, 'utf8');
  console.log(`Saved branch report to ${outArg}`);
} else {
  console.log(outputText);
}
