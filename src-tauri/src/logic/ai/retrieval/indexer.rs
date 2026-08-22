//! Project Lore Indexer: splits chapters & entities into cohesive chunks,
//! extracts embeddings, and saves into `entity_chunks` with HNSW & BM25 indexes.

use serde_json::Value;
use surrealdb::engine::local::Db;
use surrealdb::types::RecordId;
use surrealdb::Surreal;
use tauri::{AppHandle, Manager};

use super::embedder::EmbedderService;
use crate::logic::ai::chunker::DocumentChunker;
use crate::AppState;

/// Reindex all lore (chapters, entities) for a project into `entity_chunks`
#[tauri::command]
pub async fn reindex_project_lore(app: AppHandle, project_id: String) -> Result<usize, String> {
    let state = app.state::<AppState>();
    let db: Surreal<Db> = state.db.clone();

    let proj_part = project_id
        .strip_prefix("projects:")
        .unwrap_or(&project_id)
        .trim_matches('`')
        .to_string();

    let proj_rec = RecordId::new("projects", proj_part.as_str());

    // 1. Clear existing chunks for this project
    let del_query = "DELETE entity_chunks WHERE project_id = $proj";
    if let Err(e) = db.query(del_query).bind(("proj", proj_rec.clone())).await {
        eprintln!("[INDEXER] Warning while clearing old chunks: {e}");
    }

    let chunker = DocumentChunker::default();
    let embedder = EmbedderService::default();

    let mut total_chunks = 0usize;

    // 2. Fetch and chunk all chapters
    let chap_query = "SELECT id, title, content FROM chapters WHERE project_id = $proj";
    if let Ok(mut resp) = db.query(chap_query).bind(("proj", proj_rec.clone())).await {
        if let Ok(chapters) = resp.take::<Vec<Value>>(0) {
            for chap in chapters {
                let chap_id_str = chap.get("id").and_then(|v| v.as_str()).unwrap_or("").to_string();
                let title = chap.get("title").and_then(|v| v.as_str()).unwrap_or("Без названия").to_string();
                let content = chap.get("content").and_then(|v| v.as_str()).unwrap_or("").to_string();

                if content.trim().is_empty() {
                    continue;
                }

                let chunks = chunker.split_text(&content);
                for (idx, chunk_text) in chunks.into_iter().enumerate() {
                    let chunk_embedding = embedder.embed_passage(&chunk_text).await.ok();
                    let chunk_title = format!("{title} (Часть {})", idx + 1);

                    let insert_sql = "CREATE entity_chunks CONTENT {
                        project_id: $proj,
                        chapter_id: $chap_id,
                        title: $title,
                        content: $content,
                        chunk_index: $idx,
                        embedding_nemotron: $emb,
                        created_at: time::now()
                    }";

                    let mut q = db.query(insert_sql)
                        .bind(("proj", proj_rec.clone()))
                        .bind(("chap_id", chap_id_str.clone()))
                        .bind(("title", chunk_title))
                        .bind(("content", chunk_text))
                        .bind(("idx", idx as i64));

                    if let Some(emb) = chunk_embedding {
                        q = q.bind(("emb", emb));
                    } else {
                        q = q.bind(("emb", Value::Null));
                    }

                    if let Err(e) = q.await {
                        eprintln!("[INDEXER] Failed to insert chapter chunk: {e}");
                    } else {
                        total_chunks += 1;
                    }
                }
            }
        }
    }

    // 3. Fetch and chunk all entities
    let ent_query = "SELECT id, name, type_key, custom_fields FROM entities WHERE project_id = $proj";
    if let Ok(mut resp) = db.query(ent_query).bind(("proj", proj_rec.clone())).await {
        if let Ok(entities) = resp.take::<Vec<Value>>(0) {
            for ent in entities {
                let ent_id_str = ent.get("id").and_then(|v| v.as_str()).unwrap_or("").to_string();
                let name = ent.get("name").and_then(|v| v.as_str()).unwrap_or("Сущность").to_string();
                let type_key = ent.get("type_key").and_then(|v| v.as_str()).unwrap_or("general").to_string();

                let fields_str = ent.get("custom_fields")
                    .map(|f| f.to_string())
                    .unwrap_or_default();

                let entity_full_text = format!("Сущность: {name} (Тип: {type_key}). Данные: {fields_str}");
                let chunks = chunker.split_text(&entity_full_text);

                for (idx, chunk_text) in chunks.into_iter().enumerate() {
                    let chunk_embedding = embedder.embed_passage(&chunk_text).await.ok();
                    let chunk_title = format!("Карточка: {name}");

                    let insert_sql = "CREATE entity_chunks CONTENT {
                        project_id: $proj,
                        entity_id: $ent_id,
                        title: $title,
                        content: $content,
                        chunk_index: $idx,
                        embedding_nemotron: $emb,
                        created_at: time::now()
                    }";

                    let mut q = db.query(insert_sql)
                        .bind(("proj", proj_rec.clone()))
                        .bind(("ent_id", ent_id_str.clone()))
                        .bind(("title", chunk_title))
                        .bind(("content", chunk_text))
                        .bind(("idx", idx as i64));

                    if let Some(emb) = chunk_embedding {
                        q = q.bind(("emb", emb));
                    } else {
                        q = q.bind(("emb", Value::Null));
                    }

                    if let Err(e) = q.await {
                        eprintln!("[INDEXER] Failed to insert entity chunk: {e}");
                    } else {
                        total_chunks += 1;
                    }
                }
            }
        }
    }

    println!("[INDEXER] Успешно проиндексирован лор проекта '{project_id}': создано {total_chunks} чанков.");
    Ok(total_chunks)
}
