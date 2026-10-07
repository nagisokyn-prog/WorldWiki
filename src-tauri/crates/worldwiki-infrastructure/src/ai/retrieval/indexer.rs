use crate::ai::chunker::DocumentChunker;
use crate::ai::retrieval::embedder::EmbedderService;
use serde_json::json;
use std::sync::Arc;
use surrealdb::engine::local::Db;
use surrealdb::types::RecordId;
use surrealdb::Surreal;

#[derive(Clone, Debug)]
pub struct PendingChunk {
    pub chapter_id: Option<String>,
    pub entity_id: Option<String>,
    pub title: String,
    pub content: String,
    pub chunk_index: usize,
}

#[derive(Clone, Debug)]
pub struct ProcessedChunk {
    pub chapter_id: Option<String>,
    pub entity_id: Option<String>,
    pub title: String,
    pub content: String,
    pub chunk_index: usize,
    pub embedding: Option<Vec<f32>>,
}

use worldwiki_domain::errors::DomainError;

/// Core high-performance indexing logic (callable from tests and commands)
pub async fn reindex_project_lore_inner(
    db: &Surreal<Db>,
    project_id: &str,
) -> Result<usize, DomainError> {
    let start = std::time::Instant::now();
    let p_raw = project_id.to_string();
    let p_clean = project_id
        .strip_prefix("projects:")
        .unwrap_or(project_id)
        .trim_matches('`')
        .trim_matches('⟨')
        .trim_matches('⟩')
        .trim()
        .to_string();

    let proj_rec = RecordId::new(
        "projects",
        if p_clean.is_empty() {
            "default"
        } else {
            &p_clean
        },
    );
    // 1. Clear existing chunks for this project
    let del_query = "DELETE entity_chunks WHERE (project_id = type::record('projects', $p_clean) OR project_id = $p_raw)";
    if let Err(e) = db.query(del_query).bind(("p_raw", p_raw.clone())).bind(("p_clean", p_clean.clone())).await {
        eprintln!("[INDEXER] Warning while clearing old chunks: {e}");
    }

    let chunker = DocumentChunker::default();
    let embedder = Arc::new(EmbedderService::default());

    let mut pending_chunks: Vec<PendingChunk> = Vec::new();

    // 2. Collect and chunk all chapters
    let chap_query = "SELECT id, title, content FROM chapters WHERE (project_id = type::record('projects', $p_clean) OR project_id = $p_raw)";
    if let Ok(mut resp) = db.query(chap_query).bind(("p_raw", p_raw.clone())).bind(("p_clean", p_clean.clone())).await {
        if let Ok(chapters) = resp.take::<Vec<serde_json::Value>>(0) {
            for chap in chapters {
                let chap_id_str = chap
                    .get("id")
                    .and_then(|v| v.as_str())
                    .unwrap_or("")
                    .to_string();
                let title = chap
                    .get("title")
                    .and_then(|v| v.as_str())
                    .unwrap_or("Без названия")
                    .to_string();
                let content = chap
                    .get("content")
                    .and_then(|v| v.as_str())
                    .unwrap_or("")
                    .to_string();

                if content.trim().is_empty() {
                    continue;
                }

                let chunks = chunker.split_text(&content);
                for (idx, chunk_text) in chunks.into_iter().enumerate() {
                    let chunk_title = format!("{title} (Часть {})", idx + 1);
                    pending_chunks.push(PendingChunk {
                        chapter_id: Some(chap_id_str.clone()),
                        entity_id: None,
                        title: chunk_title,
                        content: chunk_text,
                        chunk_index: idx,
                    });
                }
            }
        }
    }

    // 3. Collect and chunk all entities
    let ent_query = "SELECT id, name, entity_type, attributes FROM entities WHERE (project_id = type::record('projects', $p_clean) OR project_id = $p_raw)";
    if let Ok(mut resp) = db.query(ent_query).bind(("p_raw", p_raw.clone())).bind(("p_clean", p_clean.clone())).await {
        if let Ok(entities) = resp.take::<Vec<serde_json::Value>>(0) {
            for ent in entities {
                let ent_id_str = ent
                    .get("id")
                    .and_then(|v| v.as_str())
                    .unwrap_or("")
                    .to_string();
                let name = ent
                    .get("name")
                    .and_then(|v| v.as_str())
                    .unwrap_or("Сущность")
                    .to_string();
                let type_key = ent
                    .get("entity_type")
                    .and_then(|v| v.as_str())
                    .unwrap_or("general")
                    .to_string();
                let fields_str = ent
                    .get("attributes")
                    .map(|f| f.to_string())
                    .unwrap_or_default();

                let entity_full_text =
                    format!("Сущность: {name} (Тип: {type_key}). Данные: {fields_str}");
                let chunks = chunker.split_text(&entity_full_text);

                for (idx, chunk_text) in chunks.into_iter().enumerate() {
                    let chunk_title = format!("Карточка: {name}");
                    pending_chunks.push(PendingChunk {
                        chapter_id: None,
                        entity_id: Some(ent_id_str.clone()),
                        title: chunk_title,
                        content: chunk_text,
                        chunk_index: idx,
                    });
                }
            }
        }
    }

    if pending_chunks.is_empty() {
        println!("[INDEXER] Проект '{project_id}' пуст, проиндексировано 0 чанков.");
        return Ok(0);
    }

    let total_count = pending_chunks.len();
    println!("[INDEXER] Нарезано {total_count} чанков. Подготовка к векторизации...");

    let mut processed_chunks: Vec<ProcessedChunk> = Vec::with_capacity(total_count);

    let is_embedder_alive = embedder.embed_passage("test").await.is_ok();
    if is_embedder_alive {
        println!("[INDEXER] Сервер эмбеддингов доступен. Запуск векторизации...");
        for chunk in pending_chunks {
            let embedding = embedder.embed_passage(&chunk.content).await.ok();
            processed_chunks.push(ProcessedChunk {
                chapter_id: chunk.chapter_id,
                entity_id: chunk.entity_id,
                title: chunk.title,
                content: chunk.content,
                chunk_index: chunk.chunk_index,
                embedding,
            });
        }
    } else {
        println!(
            "[INDEXER] Внешний сервер оффлайн. Вставка чанков с полнотекстовым поиском BM25..."
        );
        for chunk in pending_chunks {
            processed_chunks.push(ProcessedChunk {
                chapter_id: chunk.chapter_id,
                entity_id: chunk.entity_id,
                title: chunk.title,
                content: chunk.content,
                chunk_index: chunk.chunk_index,
                embedding: None,
            });
        }
    }

    // Bulk Insertion into SurrealDB (Batches of 100)
    let batch_size = 100;
    let mut saved_chunks = 0usize;

    for chunk_group in processed_chunks.chunks(batch_size) {
        let mut records = Vec::with_capacity(chunk_group.len());

        for c in chunk_group {
            let chap_clean = c.chapter_id.as_ref().and_then(|id| {
                let clean = id.strip_prefix("chapters:").unwrap_or(id).trim_matches('`').trim();
                if clean.is_empty() { None } else { Some(format!("chapters:{clean}")) }
            });
            let ent_clean = c.entity_id.as_ref().and_then(|id| {
                let clean = id.strip_prefix("entities:").unwrap_or(id).trim_matches('`').trim();
                if clean.is_empty() { None } else { Some(format!("entities:{clean}")) }
            });

            let (emb_nomic, emb_nemo) = match c.embedding.as_ref() {
                Some(v) if v.len() == 768 => (Some(v.clone()), None),
                Some(v) if v.len() == 2048 => (None, Some(v.clone())),
                _ => (None, None),
            };

            let mut row = serde_json::Map::new();
            row.insert("project_id".to_string(), json!(proj_rec.to_string()));
            if let Some(ch) = chap_clean {
                row.insert("chapter_id".to_string(), json!(ch));
            }
            if let Some(en) = ent_clean {
                row.insert("entity_id".to_string(), json!(en));
            }
            row.insert("title".to_string(), json!(c.title));
            row.insert("content".to_string(), json!(c.content));
            row.insert("chunk_index".to_string(), json!(c.chunk_index as i64));
            if let Some(nomic) = emb_nomic {
                row.insert("embedding_nomic".to_string(), json!(nomic));
            }
            if let Some(nemo) = emb_nemo {
                row.insert("embedding_nemotron".to_string(), json!(nemo));
            }
            records.push(serde_json::Value::Object(row));
        }

        let q = db
            .query("INSERT INTO entity_chunks $records;")
            .bind(("records", records));

        match q.await {
            Ok(mut res) => {
                let errs = res.take_errors();
                if errs.is_empty() {
                    saved_chunks += chunk_group.len();
                } else {
                    eprintln!("[INDEXER] Batch insert errors: {:?}", errs);
                }
            }
            Err(e) => {
                eprintln!("[INDEXER] Failed to execute batch query: {e}");
            }
        }
    }

    let elapsed = start.elapsed();
    println!("[INDEXER] Успешно проиндексирован лор проекта '{project_id}': создано {saved_chunks} чанков за {:?}", elapsed);
    Ok(saved_chunks)
}
