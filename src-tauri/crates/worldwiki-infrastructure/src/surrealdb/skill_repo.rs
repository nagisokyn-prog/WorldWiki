use async_trait::async_trait;
use serde_json::Value;
use std::sync::Arc;
use surrealdb::engine::local::Db;
use surrealdb::Surreal;
use worldwiki_domain::ai::SkillMatch;
use worldwiki_domain::errors::DomainError;
use worldwiki_ports::ai::SkillRepositoryPort;
use super::chat_mapping::{clean_id_str, clean_record_id};

pub struct SurrealSkillRepository {
    db: Arc<Surreal<Db>>,
}

impl SurrealSkillRepository {
    pub fn new(db: Arc<Surreal<Db>>) -> Self {
        Self { db }
    }
}

#[async_trait]
impl SkillRepositoryPort for SurrealSkillRepository {
    async fn resolve_active_skills(
        &self,
        project_id: Option<&str>,
        query: &str,
        limit: usize,
    ) -> Result<Vec<SkillMatch>, DomainError> {
        let trimmed_query = query.trim();
        if trimmed_query.is_empty() {
            return Ok(vec![]);
        }

        // 1. Детерминированный явный вызов !"Название Навыка"
        if let Some((_, after_bang)) = trimmed_query.split_once("!\"")
            && let Some((manual_name, _)) = after_bang.split_once('"') {
                let mut res = self
                    .db
                    .query("SELECT id, name, description, prompt_text, file_path FROM ai_skills WHERE string::lowercase(name) = string::lowercase($name) LIMIT 1")
                    .bind(("name", manual_name.to_string()))
                    .await
                    .map_err(|e| DomainError::ConstraintViolation(e.to_string()))?;

                let manual_skills: Vec<Value> = res.take(0).unwrap_or_default();
                if let Some(skill_val) = manual_skills.into_iter().next() {
                    let id = clean_record_id(skill_val.get("id").unwrap_or(&Value::Null))
                        .unwrap_or_else(|| skill_val.get("id").and_then(|v| v.as_str()).unwrap_or_default().to_string());
                    let name = skill_val.get("name").and_then(|v| v.as_str()).unwrap_or_default().to_string();
                    let description = skill_val.get("description").and_then(|v| v.as_str()).unwrap_or_default().to_string();
                    let prompt_text = skill_val.get("prompt_text").and_then(|v| v.as_str()).unwrap_or_default().to_string();
                    let file_path = skill_val.get("file_path").and_then(|v| v.as_str()).map(|s| s.to_string());

                    return Ok(vec![SkillMatch {
                        id,
                        name,
                        description,
                        prompt_text,
                        file_path,
                        matched_via: "manual".to_string(),
                        score: 1.0,
                    }]);
                }
            }

        // 2. Вызов функции fn::resolve_auto_skills или прямого запроса по BM25 и триггерам
        let proj_clean = project_id.map(|p| clean_id_str(p, "projects:").to_string());
        
        let q_sql = r#"
            SELECT id, name, description, prompt_text, file_path, priority, triggers FROM ai_skills
            WHERE (project_id = type::record('projects', $p_clean) OR project_id = NONE OR project_id = null)
              AND is_auto_trigger != false
              AND is_unlocked != false
        "#;

        let mut res = self
            .db
            .query(q_sql)
            .bind(("p_clean", proj_clean))
            .await
            .map_err(|e| DomainError::ConstraintViolation(e.to_string()))?;

        let raw_skills: Vec<Value> = res.take(0).unwrap_or_default();
        let lower_query = trimmed_query.to_lowercase();

        let mut matches: Vec<SkillMatch> = Vec::new();

        for s in raw_skills {
            let id = clean_record_id(s.get("id").unwrap_or(&Value::Null))
                .unwrap_or_else(|| s.get("id").and_then(|v| v.as_str()).unwrap_or_default().to_string());
            let name = s.get("name").and_then(|v| v.as_str()).unwrap_or_default().to_string();
            let description = s.get("description").and_then(|v| v.as_str()).unwrap_or_default().to_string();
            let prompt_text = s.get("prompt_text").and_then(|v| v.as_str()).unwrap_or_default().to_string();
            let file_path = s.get("file_path").and_then(|v| v.as_str()).map(|v| v.to_string());
            let priority = s.get("priority").and_then(|v| v.as_i64()).unwrap_or(10) as f32;

            let triggers = s.get("triggers").and_then(|v| v.as_array());
            let mut best_trigger_score: f32 = 0.0;
            let mut matched_via = String::new();

            if let Some(arr) = triggers {
                for trig in arr {
                    if let Some(t_str) = trig.as_str() {
                        let t_lower = t_str.to_lowercase();
                        if !t_lower.is_empty() && lower_query.contains(&t_lower) {
                            let score = 20.0 + (t_lower.len() as f32) + priority;
                            if score > best_trigger_score {
                                best_trigger_score = score;
                                matched_via = "exact_trigger".to_string();
                            }
                        }
                    }
                }
            }

            // BM25/лексический fallback если триггер не сработал
            if best_trigger_score == 0.0 {
                let name_lower = name.to_lowercase();
                let desc_lower = description.to_lowercase();
                if (!name_lower.is_empty() && lower_query.contains(&name_lower))
                    || (!desc_lower.is_empty() && lower_query.contains(&desc_lower))
                {
                    best_trigger_score = 10.0 + priority;
                    matched_via = "bm25".to_string();
                }
            }

            if best_trigger_score > 0.0 {
                matches.push(SkillMatch {
                    id,
                    name,
                    description,
                    prompt_text,
                    file_path,
                    matched_via,
                    score: best_trigger_score,
                });
            }
        }

        // Сортировка по убыванию скора
        matches.sort_by(|a, b| b.score.partial_cmp(&a.score).unwrap_or(std::cmp::Ordering::Equal));
        matches.truncate(limit);

        Ok(matches)
    }

    async fn get_skill_content(&self, skill_id: &str) -> Result<Option<String>, DomainError> {
        let clean = clean_id_str(skill_id, "ai_skills:");
        let mut res = self
            .db
            .query("SELECT prompt_text FROM ai_skills WHERE id = type::record('ai_skills', $clean) OR id = $id LIMIT 1")
            .bind(("clean", clean.to_string()))
            .bind(("id", format!("ai_skills:{clean}")))
            .await
            .map_err(|e| DomainError::ConstraintViolation(e.to_string()))?;

        let rows: Vec<Value> = res.take(0).unwrap_or_default();
        if let Some(row) = rows.into_iter().next() {
            let prompt = row.get("prompt_text").and_then(|v| v.as_str()).map(|s| s.to_string());
            return Ok(prompt);
        }

        Ok(None)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use surrealdb::engine::local::Mem;

    async fn setup_test_db() -> Arc<Surreal<Db>> {
        let db = Surreal::new::<Mem>(()).await.unwrap();
        db.use_ns("test").use_db("test").await.unwrap();
        Arc::new(db)
    }

    #[tokio::test]
    async fn test_skill_repo_resolve_triggers_and_manual() {
        let db = setup_test_db().await;
        let repo = SurrealSkillRepository::new(db.clone());

        // Вставляем тестовые скиллы
        db.query(r#"
            BEGIN TRANSACTION;
            CREATE ai_skills:s1 SET
                name = 'Конструктор типов сущностей',
                description = 'Схемы и диаграммы',
                prompt_text = 'Инструкция по типам сущностей',
                triggers = ['создай тип', 'тип сущности', 'новая схема'],
                is_auto_trigger = true,
                priority = 15,
                is_unlocked = true;

            CREATE ai_skills:s2 SET
                name = 'Заполнение сущностей',
                description = 'Анкеты и свойства',
                prompt_text = 'Инструкция по заполнению',
                triggers = ['заполни анкету', 'сделай главным героем'],
                is_auto_trigger = true,
                priority = 10,
                is_unlocked = true;
            COMMIT TRANSACTION;
        "#).await.unwrap();

        // 1. Тест авто-триггера
        let matches = repo.resolve_active_skills(Some("projects:p1"), "Пожалуйста, создай тип для оружия", 2).await.unwrap();
        assert!(!matches.is_empty());
        assert_eq!(matches[0].id, "ai_skills:s1");
        assert_eq!(matches[0].matched_via, "exact_trigger");

        // 2. Тест явного вызова !"Заполнение сущностей"
        let manual_matches = repo.resolve_active_skills(Some("projects:p1"), "Обнови карточку !\"Заполнение сущностей\"", 2).await.unwrap();
        assert_eq!(manual_matches.len(), 1);
        assert_eq!(manual_matches[0].name, "Заполнение сущностей");
        assert_eq!(manual_matches[0].matched_via, "manual");

        // 3. Тест get_skill_content
        let content = repo.get_skill_content("ai_skills:s1").await.unwrap();
        assert_eq!(content, Some("Инструкция по типам сущностей".to_string()));
    }
}

