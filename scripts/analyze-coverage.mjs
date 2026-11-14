#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const cwd = process.cwd();
const coveragePath = path.resolve(cwd, 'coverage/coverage-final.json');
const defaultOutMd = path.resolve(cwd, 'coverage/coverage-roadmap.md');

const args = process.argv.slice(2);
const thresholdArg = args.find((a) => a.startsWith('--threshold='));
const targetArg = args.find((a) => a.startsWith('--target='));
const outArg = args.find((a) => a.startsWith('--out='));
const minThreshold = thresholdArg ? Number(thresholdArg.split('=')[1]) : 65;
const targetGoal = targetArg ? Number(targetArg.split('=')[1]) : 85;
const outMdPath = outArg ? path.resolve(cwd, outArg.split('=')[1]) : defaultOutMd;

if (!fs.existsSync(coveragePath)) {
  console.error(`Coverage file not found: ${coveragePath}`);
  console.error('Run "npm run test:coverage" first to generate coverage/coverage-final.json.');
  process.exit(1);
}

const raw = JSON.parse(fs.readFileSync(coveragePath, 'utf8'));

function pct(covered, total) {
  if (total === 0) return 100;
  return (covered / total) * 100;
}

function summarizeFile(filePath, entry) {
  const sVals = Object.values(entry.s || {});
  const sTotal = sVals.length;
  const sCov = sVals.filter((n) => n > 0).length;

  const fVals = Object.values(entry.f || {});
  const fTotal = fVals.length;
  const fCov = fVals.filter((n) => n > 0).length;

  let bTotal = 0;
  let bCov = 0;
  for (const counts of Object.values(entry.b || {})) {
    for (const c of counts) {
      bTotal += 1;
      if (c > 0) bCov += 1;
    }
  }

  const lineHits = new Map();
  if (entry.l) {
    for (const [line, count] of Object.entries(entry.l)) {
      lineHits.set(Number(line), count);
    }
  } else {
    for (const [id, loc] of Object.entries(entry.statementMap || {})) {
      const line = loc?.start?.line;
      if (line == null) continue;
      const hits = entry.s?.[id] ?? 0;
      const prev = lineHits.get(line) ?? 0;
      if (hits > prev || !lineHits.has(line)) {
        lineHits.set(line, Math.max(prev, hits));
      }
    }
  }
  const lTotal = lineHits.size;
  let lCov = 0;
  for (const hits of lineHits.values()) {
    if (hits > 0) lCov += 1;
  }

  const rel = path.relative(cwd, filePath).replace(/\\/g, '/');
  const stmtsPct = pct(sCov, sTotal);
  const branchPct = pct(bCov, bTotal);
  const funcsPct = pct(fCov, fTotal);
  const linesPct = pct(lCov, lTotal);
  const minPct = Math.min(stmtsPct, branchPct, funcsPct, linesPct);
  const uncoveredWeight = (sTotal - sCov) + (bTotal - bCov) + (fTotal - fCov);

  return {
    file: rel,
    sCov, sTotal, stmtsPct,
    bCov, bTotal, branchPct,
    fCov, fTotal, funcsPct,
    lCov, lTotal, linesPct,
    minPct,
    uncoveredWeight,
  };
}

const files = Object.entries(raw).map(([fp, entry]) => summarizeFile(fp, entry));

const totals = files.reduce(
  (acc, f) => {
    acc.sCov += f.sCov; acc.sTotal += f.sTotal;
    acc.bCov += f.bCov; acc.bTotal += f.bTotal;
    acc.fCov += f.fCov; acc.fTotal += f.fTotal;
    acc.lCov += f.lCov; acc.lTotal += f.lTotal;
    return acc;
  },
  { sCov: 0, sTotal: 0, bCov: 0, bTotal: 0, fCov: 0, fTotal: 0, lCov: 0, lTotal: 0 }
);

const gStmts = pct(totals.sCov, totals.sTotal);
const gBranch = pct(totals.bCov, totals.bTotal);
const gFuncs = pct(totals.fCov, totals.fTotal);
const gLines = pct(totals.lCov, totals.lTotal);

const need = (cov, total) => Math.max(0, Math.ceil((targetGoal / 100) * total) - cov);

const below = files
  .filter((f) => f.linesPct < minThreshold || f.branchPct < minThreshold || f.funcsPct < minThreshold || f.stmtsPct < minThreshold)
  .sort((a, b) => b.uncoveredWeight - a.uncoveredWeight);

const byModule = new Map();
for (const f of below) {
  const parts = f.file.split('/');
  const group = parts[0] === 'apps' ? parts.slice(0, 5).join('/') : parts.slice(0, 4).join('/');
  const cur = byModule.get(group) || { count: 0, weight: 0 };
  cur.count += 1;
  cur.weight += f.uncoveredWeight;
  byModule.set(group, cur);
}
const topGroups = [...byModule.entries()].sort((a, b) => b[1].weight - a[1].weight);

const md = [];
md.push(`# Coverage Roadmap (Target: ${targetGoal}%, Filter: < ${minThreshold}%)`);
md.push('');
md.push(`Generated from \`coverage/coverage-final.json\` (${new Date().toISOString()}).`);
md.push('');
md.push(`## Global Coverage vs ${targetGoal}% Target`);
md.push('');
md.push('| Metric | Current | Covered / Total | Needed for ' + targetGoal + '% |');
md.push('| --- | ---: | ---: | ---: |');
md.push(`| Statements | ${gStmts.toFixed(2)}% | ${totals.sCov} / ${totals.sTotal} | +${need(totals.sCov, totals.sTotal)} |`);
md.push(`| Branches | ${gBranch.toFixed(2)}% | ${totals.bCov} / ${totals.bTotal} | +${need(totals.bCov, totals.bTotal)} |`);
md.push(`| Functions | ${gFuncs.toFixed(2)}% | ${totals.fCov} / ${totals.fTotal} | +${need(totals.fCov, totals.fTotal)} |`);
md.push(`| Lines | ${gLines.toFixed(2)}% | ${totals.lCov} / ${totals.lTotal} | +${need(totals.lCov, totals.lTotal)} |`);
md.push('');
md.push(`## Top Modules by Uncovered Weight (< ${minThreshold}%)`);
md.push('');
md.push('| Priority | Module | Files < ' + minThreshold + '% | Uncovered Weight (S+B+F) |');
md.push('| ---: | --- | ---: | ---: |');
topGroups.slice(0, 20).forEach(([group, info], idx) => {
  md.push(`| ${idx + 1} | \`${group}\` | ${info.count} | ${info.weight} |`);
});
md.push('');
md.push(`## Files Below ${minThreshold}% (Sorted by ROI, ${below.length} files)`);
md.push('');
md.push('| # | ROI | Stmts | Branch | Funcs | Lines | Uncov (S/B/F) | File |');
md.push('| ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |');
below.forEach((f, idx) => {
  const uncov = `${f.sTotal - f.sCov}/${f.bTotal - f.bCov}/${f.fTotal - f.fCov}`;
  md.push(
    `| ${idx + 1} | ${f.uncoveredWeight} | ${f.stmtsPct.toFixed(1)}% | ${f.branchPct.toFixed(1)}% | ${f.funcsPct.toFixed(1)}% | ${f.linesPct.toFixed(1)}% | ${uncov} | \`${f.file}\` |`
  );
});
md.push('');

fs.mkdirSync(path.dirname(outMdPath), { recursive: true });
fs.writeFileSync(outMdPath, md.join('\n'), 'utf8');

console.log(`Global: Stmts ${gStmts.toFixed(2)}% | Branch ${gBranch.toFixed(2)}% | Funcs ${gFuncs.toFixed(2)}% | Lines ${gLines.toFixed(2)}%`);
console.log(`Files < ${minThreshold}%: ${below.length}`);
console.log(`Roadmap written to: ${path.relative(cwd, outMdPath).replace(/\\/g, '/')}`);
