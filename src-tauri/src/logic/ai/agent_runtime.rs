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
pub async fn run_local_agent_loop(
    app: AppHandle,
    project_id: String,
    chat_id: String,
    assistant_msg_id: String,
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

    // 1. Auto-RAG: Retrieve semantic context from SurrealDB entities
    let mut augmented_context = String::new();
    if let Some(ref emb_path) = embed_model_path {
        let resolved_emb = resolve_model_path(emb_path);
        if resolved_emb.exists() {
            emit_chunk("🔍 Поиск контекста в базе знаний WorldWiki...".to_string(), false, "tool_log");
            
            let emb_path_clone = resolved_emb.to_string_lossy().to_string();
            let prompt_clone = prompt.clone();
            
            let emb_vec_res = tauri::async_runtime::spawn_blocking(move || {
                let params = ModelParams {
                    n_ctx: 2048,
                    n_batch: 512,
                    n_gpu_layers: -1,
                    ..Default::default()
                };
                let mut emb_llm = LocalLlm::load_embedding_model(&emb_path_clone, params)?;
                emb_llm.get_embeddings(&prompt_clone)
            }).await;

            if let Ok(Ok(query_vec)) = emb_vec_res {
                if !query_vec.is_empty() {
                    let proj_clean = project_id
                        .strip_prefix("projects:")
                        .unwrap_or(&project_id)
                        .trim_matches('`')
                        .to_string();
                    let proj_record = RecordId::new("projects", proj_clean.as_str());

                    let mut q = db.query(
                        "SELECT id, name, description, attributes, vector::similarity::cosine(embeddings.local, $query_vec) AS score FROM entities WHERE project_id = $proj AND embeddings.local != NONE ORDER BY score DESC LIMIT 5"
                    );
                    q = q.bind(("query_vec", query_vec));
                    q = q.bind(("proj", proj_record));

                    if let Ok(mut resp) = q.await {
                        if let Ok(entities) = resp.take::<Vec<Value>>(0) {
                            if !entities.is_empty() {
                                augmented_context.push_str("\n\n### Релевантные сущности и факты из базы знаний WorldWiki:\n<context>\n");
                                for ent in entities {
                                    let name = ent.get("name").and_then(|v| v.as_str()).unwrap_or("Сущность");
                                    let desc = ent.get("description").and_then(|v| v.as_str()).unwrap_or("");
                                    let attrs = ent.get("attributes").cloned().unwrap_or(json!({}));
                                    augmented_context.push_str(&format!("#### {}\nОписание: {}\nСвойства: {}\n\n", name, desc, attrs));
                                }
                                augmented_context.push_str("</context>\n");
                            }
                        }
                    }
                }
            }
        }
    }

    let final_prompt = if !augmented_context.is_empty() {
        format!("{}\n\n{}", augmented_context, prompt)
    } else {
        prompt
    };

    // 2. Generation on dedicated blocking worker thread
    let (tx, rx) = mpsc::channel::<TokenEvent>();
    let m_path = model_path.clone();
    let tri_path = triattention_path.clone();
    let ckpt_path = checkpoint_path.clone();

    let gen_handle = tauri::async_runtime::spawn_blocking(move || {
        let params = ModelParams {
            n_ctx,
            n_batch: 512,
            n_gpu_layers,
            enable_tcq,
            ..Default::default()
        };

        let mut llm = LocalLlm::load_model(&m_path, params)?;

        if let Some(ref tri) = tri_path {
            if std::path::Path::new(tri).exists() {
                let _ = llm.enable_triattention(tri, 2048);
            }
        }

        if let Some(ref ckpt) = ckpt_path {
            if std::path::Path::new(&format!("{ckpt}.session")).exists() {
                let _ = llm.load_checkpoint(ckpt);
            }
        }

        llm.generate_stream(&final_prompt, tx)?;

        if let Some(ref ckpt) = ckpt_path {
            let _ = llm.save_checkpoint(ckpt);
        }

        Ok::<(), String>(())
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
pub async fn run_local_agent_loop(
    _app: AppHandle,
    _project_id: String,
    _chat_id: String,
    _assistant_msg_id: String,
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
