import fs from 'node:fs';
import path from 'node:path';

const BASELINE_FILE = path.resolve('cerberus-baseline.json');

if (!fs.existsSync(BASELINE_FILE)) {
  console.error(`❌ Baseline file not found: ${BASELINE_FILE}`);
  process.exit(1);
}

const baseline = JSON.parse(fs.readFileSync(BASELINE_FILE, 'utf-8'));
const entries = Array.isArray(baseline) ? baseline : (baseline.entries || baseline.violations || []);

const getRuleId = (e) => typeof e.rule === 'string' ? e.rule : (e.rule_id || e.rule?.id || 'UNKNOWN');

const errViolations = entries.filter(e => getRuleId(e) === 'ERR-003');

console.log(`================================================================`);
console.log(`🔍 ERR-003 ANALYSIS: Untyped Result<T, String> (${errViolations.length} total)`);
console.log(`================================================================\n`);

const moduleGroups = {
  batch: [],
  chapters: [],
  connections: [],
  entities: [],
  projects: [],
  volumes: [],
  system: [],
  lib_and_bootstrap: [],
  other: []
};

for (const v of errViolations) {
  const filePath = (v.file || v.file_path || '').toLowerCase();
  const item = {
    file: v.file || v.file_path || '',
    line: v.line || v.line_number || 1,
    symbol: v.symbol || v.identifier || v.context || '',
    message: v.message || ''
  };

  if (filePath.includes('batch')) {
    moduleGroups.batch.push(item);
  } else if (filePath.includes('chapter')) {
    moduleGroups.chapters.push(item);
  } else if (filePath.includes('connection')) {
    moduleGroups.connections.push(item);
  } else if (filePath.includes('entit')) {
    moduleGroups.entities.push(item);
  } else if (filePath.includes('project')) {
    moduleGroups.projects.push(item);
  } else if (filePath.includes('volume')) {
    moduleGroups.volumes.push(item);
  } else if (filePath.includes('system')) {
    moduleGroups.system.push(item);
  } else if (filePath.includes('lib.rs') || filePath.includes('bootstrap')) {
    moduleGroups.lib_and_bootstrap.push(item);
  } else {
    moduleGroups.other.push(item);
  }
}

console.log(`📋 Violation distribution by domain module:`);
for (const [mod, list] of Object.entries(moduleGroups)) {
  if (list.length > 0) {
    console.log(`   - ${mod.padEnd(20, ' ')} : ${String(list.length).padStart(3, ' ')} signatures returning raw String errors`);
  }
}

console.log(`\n----------------------------------------------------------------`);
console.log(`💡 Recommended Domain Error Enums (thiserror)`);
console.log(`----------------------------------------------------------------\n`);

const proposedEnums = {
  BatchError: `#[derive(Debug, thiserror::Error)]
pub enum BatchError {
    #[error("Database error: {0}")]
    Database(#[from] surrealdb::Error),
    #[error("Entity not found in batch: {0}")]
    EntityNotFound(String),
    #[error("Invalid batch payload: {0}")]
    InvalidPayload(String),
    #[error("Serialization failed: {0}")]
    Serialization(#[from] serde_json::Error),
}`,
  EntityError: `#[derive(Debug, thiserror::Error)]
pub enum EntityError {
    #[error("Database error: {0}")]
    Database(#[from] surrealdb::Error),
    #[error("Entity '{0}' does not exist")]
    NotFound(String),
    #[error("Duplicate entity name: {0}")]
    DuplicateName(String),
    #[error("Invalid entity schema: {0}")]
    InvalidSchema(String),
}`,
  ChapterError: `#[derive(Debug, thiserror::Error)]
pub enum ChapterError {
    #[error("Database error: {0}")]
    Database(#[from] surrealdb::Error),
    #[error("Chapter not found: {0}")]
    NotFound(String),
    #[error("AST Parsing failed: {0}")]
    AstParse(String),
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
}`,
  VolumeError: `#[derive(Debug, thiserror::Error)]
pub enum VolumeError {
    #[error("Database error: {0}")]
    Database(#[from] surrealdb::Error),
    #[error("Volume not found: {0}")]
    NotFound(String),
    #[error("Volume hierarchy cycle detected: {0}")]
    HierarchyCycle(String),
}`,
  ProjectError: `#[derive(Debug, thiserror::Error)]
pub enum ProjectError {
    #[error("Database error: {0}")]
    Database(#[from] surrealdb::Error),
    #[error("Project '{0}' not found")]
    NotFound(String),
    #[error("Project path invalid or inaccessible: {0}")]
    InvalidPath(String),
}`
};

for (const [name, code] of Object.entries(proposedEnums)) {
  console.log(`🦀 ${name}:`);
  console.log(code);
  console.log(``);
}
