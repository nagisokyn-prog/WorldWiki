//! Agent Runtime for Local LLM inference with Auto-RAG support.
//! Encapsulates streaming generation, automatic vector retrieval from SurrealDB,
//! and session context checkpointing.

#[cfg(feature = "ai-local")]
use crate::logic::ai::local_llm::{resolve_model_path, LocalLlm, ModelParams, TokenEvent};
use crate::AppState;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::sync::mpsc;
use surreal_domain::SurrealDb as _;
use surrealdb::engine::local::Db;
use surrealdb::types::RecordId;
use surrealdb::Surreal;
use tauri::{AppHandle, Emitter, Manager};

#[derive(Clone, Serialize, Deserialize)]
pub struct StreamChunk {
    pub chat_id: String,
    pub message_id: String,
    pub text: String,
    pub is_done: bool,
    pub chunk_type: String,
}

#[derive(Clone, Serialize, Deserialize)]
pub struct AgentToolEvent {
    pub chat_id: String,
    pub message_id: String,
    pub tool_name: String,
    pub tool_args: Value,
}

#[cfg(feature = "ai-local")]
#[allow(clippy::too_many_arguments)]
pub async fn run_local_agent_loop<R: tauri::Runtime>(
    app: AppHandle<R>,
    project_id: String,
    chat_id: String,
    assistant_msg_id: String,
    user_query: String,
    prompt: String,
    model_path: String,
    embed_model_path: Option<String>,
    triattention_path: Option<String>,
    checkpoint_path: Option<String>,
    n_ctx: u32,
    n_gpu_layers: i32,
    enable_tcq: bool,
) -> Result<String, String> {
    let state = app.state::<AppState>();
    let db: Surreal<Db> = state.surreal_db().clone();

    let emit_chunk = |text: String, is_done: bool, chunk_type: &str| {
        let _ = app.emit(
            "chat_stream_chunk",
            StreamChunk {
                chat_id: chat_id.clone(),
                message_id: assistant_msg_id.clone(),
                text,
                is_done,
                chunk_type: chunk_type.to_string(),
            },
        );
    };

    // 1. Auto-RAG Pipeline: Query Analyzer -> Exact Lookup + Semantic Dense Search
    let mut augmented_context = String::new();
    let mut found_chunks: Vec<Value> = Vec::new();
    let mut found_entities: Vec<Value> = Vec::new();

    let proj_clean = project_id
        .strip_prefix("projects:")
        .unwrap_or(&project_id)
        .trim_matches(|c: char| c == '`' || c == '⟨' || c == '⟩' || c.is_whitespace())
        .to_string();
    let proj_record = RecordId::new("projects", proj_clean.as_str());

    println!("[RAG Trace 1/8] Raw User Query: \"{}\" (project: {:?})", user_query.trim(), proj_record);

    // --- Query Analyzer (Deterministic Intent & Reference Extraction) ---
    let intent = crate::logic::ai::retrieval::analyze_user_query(&user_query);

    if intent.is_chitchat {
        println!("[RAG Trace 2/8] Query Analyzer intent: chitchat_greeting (skip RAG)");
    } else if let Some(ch_num) = intent.chapter_num {
        println!("[RAG Trace 2/8] Query Analyzer intent: retrieve_chapter(number={})", ch_num);
        let num_str = ch_num.to_string();
        let exact_q = "SELECT title, content, chunk_index FROM entity_chunks WHERE project_id = $proj AND (title CONTAINS $num_str OR title CONTAINS 'Глава' OR title CONTAINS 'Chapter' OR title CONTAINS 'глава') ORDER BY chunk_index ASC LIMIT 8";
        match db.query(exact_q).bind(("proj", proj_record.clone())).bind(("num_str", num_str)).await {
            Ok(mut resp) => {
                let ch_results = resp.take::<Vec<Value>>(0).unwrap_or_default();
                println!("[RAG Trace 3/8] Exact Lookup: found {} chunks for Chapter {}", ch_results.len(), ch_num);
                found_chunks.extend(ch_results);
            }
            Err(e) => {
                println!("[RAG Trace 3/8 Err] Exact lookup query failed: {e}");
            }
        }
    } else {
        println!("[RAG Trace 2/8] Query Analyzer intent: general_semantic_search");
    }

    // --- Semantic Vector Search (only if not chitchat and exact match did not already find specific chunks) ---
    if !intent.is_chitchat && found_chunks.is_empty() {
        if let Some(ref emb_path) = embed_model_path {
            let resolved_emb = resolve_model_path(emb_path);
            if resolved_emb.exists() {
                emit_chunk("🔍 Поиск контекста в базе знаний WorldWiki...".to_string(), false, "tool_log");

                let emb_path_clone = resolved_emb.to_string_lossy().to_string();
                let query_text = if emb_path_clone.to_lowercase().contains("nomic") {
                    format!("search_query: {}", user_query.trim())
                } else if emb_path_clone.to_lowercase().contains("nemotron") {
                    format!("query: {}", user_query.trim())
                } else {
                    user_query.trim().to_string()
                };

                println!("[RAG Trace 4/8] Dense Vector Query Input: \"{}\"", query_text);

                let emb_vec_res = tauri::async_runtime::spawn_blocking(move || {
                    use crate::logic::ai::local_llm::{get_loaded_embed_slot, LoadedModelSlot};
                    let mut slot_guard = get_loaded_embed_slot().lock().map_err(|e| e.to_string())?;

                    let need_load = match *slot_guard {
                        Some(ref slot) => slot.model_path != emb_path_clone,
                        None => true,
                    };

                    if need_load {
                        println!("[RAG] Загрузка эмбеддера {emb_path_clone} в память GPU...");
                        let params = ModelParams {
                            n_ctx: 2048,
                            n_batch: 2048,
                            n_gpu_layers: -1,
                            ..Default::default()
                        };
                        let emb_llm = LocalLlm::load_embedding_model(&emb_path_clone, params)?;
                        *slot_guard = Some(LoadedModelSlot {
                            model_path: emb_path_clone.clone(),
                            llm: emb_llm,
                        });
                        println!("[RAG] Эмбеддер {emb_path_clone} успешно зафиксирован в GPU!");
                    }

                    if let Some(ref mut slot) = *slot_guard {
                        slot.llm.get_embeddings(&query_text)
                    } else {
                        Err("Embedder slot empty".to_string())
                    }
                }).await;

                if let Ok(Ok(query_vec)) = emb_vec_res {
                    if !query_vec.is_empty() {
                        println!("[RAG Trace 5/8] Generated query vector of dimension {}", query_vec.len());
                        let mut q = db.query(
                            "SELECT title, content, vector::similarity::cosine(embedding_nomic, $query_vec) AS score FROM entity_chunks WHERE project_id = $proj AND embedding_nomic != NONE ORDER BY score DESC LIMIT 4;\
                             SELECT id, name, description, attributes, vector::similarity::cosine(embeddings.local, $query_vec) AS score FROM entities WHERE project_id = $proj AND embeddings.local != NONE ORDER BY score DESC LIMIT 3;"
                        );
                        q = q.bind(("query_vec", query_vec));
                        q = q.bind(("proj", proj_record.clone()));

                        match q.await {
                            Ok(mut resp) => {
                                let sem_chunks = resp.take::<Vec<Value>>(0).unwrap_or_default();
                                let sem_entities = resp.take::<Vec<Value>>(1).unwrap_or_default();
                                println!("[RAG Trace 6/8] Vector Search candidates: {} chunks, {} entities", sem_chunks.len(), sem_entities.len());

                                // Deduplicate chunks
                                for sc in sem_chunks {
                                    let sc_content = sc.get("content").and_then(|v| v.as_str()).unwrap_or("");
                                    if !found_chunks.iter().any(|c| c.get("content").and_then(|v| v.as_str()).unwrap_or("") == sc_content) {
                                        found_chunks.push(sc);
                                    }
                                }
                                found_entities.extend(sem_entities);
                            }
                            Err(e) => {
                                println!("[RAG Trace 6/8 Err] Vector search query failed: {e}");
                            }
                        }
                    }
                }
            }
        }
    }

    // --- Context Budgeting: Pack items up to 12,000 characters (~3500 tokens) ---
    let max_context_chars = 12_000usize;
    let mut current_chars = 0usize;

    if !found_chunks.is_empty() || !found_entities.is_empty() {
        augmented_context.push_str("\n\n### Материалы из базы знаний WorldWiki (отвечай прямо на их основе):\n<context>\n");
        for c in &found_chunks {
            let title = c.get("title").and_then(|v| v.as_str()).unwrap_or("Фрагмент");
            let content = c.get("content").and_then(|v| v.as_str()).unwrap_or("");
            if current_chars + content.len() > max_context_chars && current_chars > 0 {
                break;
            }
            augmented_context.push_str(&format!("#### {}\n{}\n\n", title, content));
            current_chars += content.len();
        }
        for ent in &found_entities {
            let name = ent.get("name").and_then(|v| v.as_str()).unwrap_or("Сущность");
            let desc = ent.get("description").and_then(|v| v.as_str()).unwrap_or("");
            let attrs = ent.get("attributes").cloned().unwrap_or(json!({}));
            if current_chars + desc.len() > max_context_chars && current_chars > 0 {
                break;
            }
            augmented_context.push_str(&format!("#### {}\nОписание: {}\nСвойства: {}\n\n", name, desc, attrs));
            current_chars += desc.len();
        }
        augmented_context.push_str("</context>\n");
        println!("[RAG Trace 7/8] Injected budget-capped context: {} characters", augmented_context.len());
    } else {
        println!("[RAG Trace 7/8] No context matched.");
    }

    // Place augmented context right into the user's turn (rfind) for recency and focus
    let final_prompt = if !augmented_context.is_empty() {
        if let Some(pos) = prompt.rfind("<|im_end|>") {
            let (before, after) = prompt.split_at(pos);
            format!("{}\n\n{}{}", before, augmented_context, after)
        } else {
            format!("{}\n\n{}", augmented_context, prompt)
        }
    } else {
        prompt
    };
    let prompt_len = final_prompt.len();
    println!("[RAG Trace 8/8] Delivered prompt to LLM ({} characters)", prompt_len);

    // 2. Generation on dedicated blocking worker thread
    let (tx, rx) = mpsc::channel::<TokenEvent>();
    let m_path = model_path.clone();
    let tri_path = triattention_path.clone();
    let ckpt_path = checkpoint_path.clone();

    let gen_handle = tauri::async_runtime::spawn_blocking(move || {
        use crate::logic::ai::local_llm::{get_loaded_model_slot, LoadedModelSlot};
        use crate::logic::ai::manager::set_model_lifecycle_state;
        use crate::logic::ai::types::ModelLifecycleState;

        let mut slot_guard = get_loaded_model_slot().lock().map_err(|e| e.to_string())?;

        // Check if matching model is already cached in GPU
        let need_load = match *slot_guard {
            Some(ref slot) => slot.model_path != m_path || slot.llm.n_ctx != n_ctx,
            None => true,
        };

        if need_load {
            println!("[AGENT] Загрузка модели {m_path} в память GPU...");
            set_model_lifecycle_state(&m_path, ModelLifecycleState::Loading);
            let params = ModelParams {
                n_ctx,
                n_batch: 512,
                n_gpu_layers,
                enable_tcq,
                ..Default::default()
            };
            let llm = LocalLlm::load_model(&m_path, params)?;
            *slot_guard = Some(LoadedModelSlot {
                model_path: m_path.clone(),
                llm,
            });
            println!("[AGENT] Модель {m_path} успешно зафиксирована в GPU!");
        }

        set_model_lifecycle_state(&m_path, ModelLifecycleState::Busy);

        let res = if let Some(ref mut slot) = *slot_guard {
            slot.llm.reset_context()?;

            if let Some(ref tri) = tri_path {
                if std::path::Path::new(tri).exists() {
                    let _ = slot.llm.enable_triattention(tri, 2048);
                }
            }

            if let Some(ref ckpt) = ckpt_path {
                if std::path::Path::new(&format!("{ckpt}.session")).exists() {
                    let _ = slot.llm.load_checkpoint(ckpt);
                }
            }

            let gen_res = slot.llm.generate_stream(&final_prompt, tx);

            if let Some(ref ckpt) = ckpt_path {
                let _ = slot.llm.save_checkpoint(ckpt);
            }

            gen_res
        } else {
            Err("Model slot empty".to_string())
        };

        set_model_lifecycle_state(&m_path, ModelLifecycleState::Ready);
        res
    });

    let mut full_response = String::new();
    while let Ok(event) = rx.recv() {
        if event.is_done {
            break;
        }
        if !event.token.is_empty() {
            full_response.push_str(&event.token);
            emit_chunk(event.token, false, "text");
        }
    }

    match gen_handle.await {
        Ok(Ok(())) => {
            let prompt_tokens = (prompt_len / 4).max(1);
            let completion_tokens = (full_response.len() / 4).max(1);
            let usage_json = serde_json::json!({
                "input_tokens": prompt_tokens,
                "output_tokens": completion_tokens,
                "total_tokens": prompt_tokens + completion_tokens
            });
            emit_chunk(usage_json.to_string(), false, "usage");
            emit_chunk(String::new(), true, "text");
            Ok(full_response)
        }
        Ok(Err(e)) => {
            emit_chunk(format!("Ошибка локальной генерации: {e}"), true, "text");
            Err(e)
        }
        Err(e) => {
            emit_chunk(format!("Ошибка фонового потока: {e}"), true, "text");
            Err(e.to_string())
        }
    }
}

#[cfg(not(feature = "ai-local"))]
#[allow(clippy::too_many_arguments)]
pub async fn run_local_agent_loop(
    _app: AppHandle,
    _project_id: String,
    _chat_id: String,
    _assistant_msg_id: String,
    _user_query: String,
    _prompt: String,
    _model_path: String,
    _embed_model_path: Option<String>,
    _triattention_path: Option<String>,
    _checkpoint_path: Option<String>,
    _n_ctx: u32,
    _n_gpu_layers: i32,
    _enable_tcq: bool,
) -> Result<String, String> {
    Err("Локальный LLM не скомпилирован. Пересоберите с feature 'ai-local'".to_string())
}
