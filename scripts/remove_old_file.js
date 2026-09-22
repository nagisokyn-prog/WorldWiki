import fs from 'node:fs';
import path from 'node:path';

const files = [
  'src-tauri/crates/worldwiki-infrastructure/src/ai/claw_adapter.rs',
  'src-tauri/crates/worldwiki-infrastructure/src/surrealdb/stemmer.rs',
  'src-tauri/crates/worldwiki-application/src/ai/chat_services/session_service.rs',
  'src-tauri/crates/worldwiki-infrastructure/src/ai/retrieval/query_analyzer.rs',
  'src-tauri/crates/worldwiki-infrastructure/src/surrealdb/repos/rag_repo.rs',
  'src-tauri/crates/worldwiki-infrastructure/src/documents/docx.rs',
  'src-tauri/crates/worldwiki-application/src/ai/schema_adapter/normalizer.rs',
  'src-tauri/crates/worldwiki-application/src/ai/schema_adapter/validator.rs',
  'src-tauri/crates/worldwiki-application/src/ai/tools/entity_tools.rs',
  'src-tauri/crates/worldwiki-application/src/ai/prompt.rs',
  'src-tauri/crates/worldwiki-domain/src/calendar/math.rs',
  'src-tauri/src/logic/batch/writer.rs',
];

for (const f of files) {
  const p = path.resolve(f);
  if (fs.existsSync(p)) {
    fs.unlinkSync(p);
    console.log(`Deleted obsolete file: ${f}`);
  }
}
