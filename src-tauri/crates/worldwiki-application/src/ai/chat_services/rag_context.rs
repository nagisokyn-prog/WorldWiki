//! Context preparation, auto-RAG lore gathering, and dynamic skill injection.

use std::sync::Arc;
use worldwiki_domain::ai::AiProfile;
use worldwiki_ports::ai::{RAGContextPort, SkillRepositoryPort};
use worldwiki_ports::events::EventPublisherPort;
use crate::ai::prompt::build_system_prompt_direct;

pub struct AssemblePromptParams<'a> {
    pub skill_repo: &'a Option<Arc<dyn SkillRepositoryPort>>,
    pub event_publisher: &'a Arc<dyn EventPublisherPort>,
    pub profile: &'a AiProfile,
    pub project_id: &'a str,
    pub chat_id: &'a str,
    pub mode: &'a str,
    pub last_user_query: &'a str,
    pub retrieved_context: Option<&'a str>,
}

pub struct ChatContextBuilder;

impl ChatContextBuilder {
    pub async fn retrieve_context(
        rag_port: &Option<Arc<dyn RAGContextPort>>,
        project_id: &str,
        last_user_query: &str,
    ) -> Option<String> {
        let rag = rag_port.as_ref()?;

        let direct_ctx = if !last_user_query.is_empty() {
            match rag.retrieve_context(project_id, last_user_query, "all", 5).await {
                Ok(items) => {
                    let text = items
                        .into_iter()
                        .filter_map(|v| {
                            v.get("content")
                                .or_else(|| v.get("match"))
                                .and_then(|c| c.as_str())
                                .map(|s| s.to_string())
                        })
                        .collect::<Vec<_>>()
                        .join("\n\n");
                    if text.trim().is_empty() {
                        None
                    } else {
                        Some(text)
                    }
                }
                Err(_) => None,
            }
        } else {
            None
        };

        if direct_ctx.is_some() {
            direct_ctx
        } else {
            // Fallback: minimal lore summary so AI always remembers entities and chapters
            match rag.retrieve_context(project_id, "", "all", 15).await {
                Ok(items) if !items.is_empty() => {
                    let summary_lines = items
                        .into_iter()
                        .filter_map(|v| {
                            let st = v.get("source_type").and_then(|s| s.as_str()).unwrap_or("");
                            if st == "entity" {
                                let name = v.get("name").and_then(|n| n.as_str()).unwrap_or("");
                                let tk = v.get("type_key").and_then(|t| t.as_str()).unwrap_or("сущность");
                                if !name.is_empty() {
                                    Some(format!("• {name} ({tk})"))
                                } else {
                                    None
                                }
                            } else if st == "chapter" {
                                let title = v.get("title").and_then(|t| t.as_str()).unwrap_or("");
                                if !title.is_empty() {
                                    Some(format!("• Глава: {title}"))
                                } else {
                                    None
                                }
                            } else {
                                None
                            }
                        })
                        .collect::<Vec<_>>();
                    if !summary_lines.is_empty() {
                        Some(format!("[Справочник проекта]:\n{}", summary_lines.join("\n")))
                    } else {
                        None
                    }
                }
                _ => None,
            }
        }
    }

    pub async fn assemble_skills_and_prompt(params: AssemblePromptParams<'_>) -> String {
        let detected_skills = if let Some(ref sr) = params.skill_repo {
            if !params.last_user_query.is_empty() {
                sr.resolve_active_skills(Some(params.project_id), params.last_user_query, 2)
                    .await
                    .unwrap_or_default()
            } else {
                vec![]
            }
        } else {
            vec![]
        };

        let mut active_skill_instructions = String::new();
        for skill in &detected_skills {
            let content = if !skill.prompt_text.is_empty() {
                skill.prompt_text.clone()
            } else {
                skill.description.clone()
            };
            active_skill_instructions.push_str(&format!(
                "\n\n<active_skill id=\"{}\" name=\"{}\">\n{}\n</active_skill>",
                skill.id, skill.name, content
            ));

            let _ = params.event_publisher.publish_raw(
                "ai:skill_activated",
                serde_json::json!({
                    "chat_id": params.chat_id,
                    "skill_id": skill.id,
                    "skill_name": skill.name,
                    "matched_via": skill.matched_via,
                    "score": skill.score
                }),
            ).await;
        }

        let mut system_prompt = build_system_prompt_direct(
            params.mode,
            params.profile
                .settings
                .get("custom_instructions")
                .and_then(|v| v.as_str())
                .unwrap_or(""),
            params.project_id,
            params.retrieved_context,
        );

        if !active_skill_instructions.is_empty() {
            system_prompt.push_str(&active_skill_instructions);
        }

        system_prompt
    }
}
