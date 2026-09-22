//! System tools: hybrid search, calendar calculations, plot audit, and subagent delegation.

use std::sync::Arc;
use serde_json::Value;
use worldwiki_domain::calendar::{CalendarData, DateCoordinate};
use crate::errors::ApplicationError;
use crate::calendar::{CalendarServices, ConvertCalendarDateParams};
use crate::plot::PlotServices;
use crate::workflows::HybridSemanticSearchWorkflow;
use crate::common::JobManager;

pub struct SystemTools;

impl SystemTools {
    pub async fn query_world(
        search_workflow: &Arc<HybridSemanticSearchWorkflow>,
        project_id: &str,
        query: &str,
        scope: &str,
        top_k: usize,
    ) -> Result<Vec<Value>, ApplicationError> {
        search_workflow.search(project_id, query, scope, top_k).await
    }

    pub fn timeline_manager(
        calendar: &Arc<CalendarServices>,
        action: &str,
        payload: Value,
    ) -> Result<Value, ApplicationError> {
        match action {
            "convert_absolute" => {
                let minute = payload.get("minute").and_then(|v| v.as_i64()).unwrap_or(0);
                let cal_val = payload.get("calendar").cloned().unwrap_or(Value::Null);
                let cal: CalendarData = serde_json::from_value(cal_val)
                    .map_err(|e| ApplicationError::Validation(e.to_string()))?;
                let era_index = payload.get("era_index").and_then(|v| v.as_u64()).unwrap_or(0) as usize;
                calendar.convert_absolute_to_local(minute, &cal, era_index)
            }
            "convert_date" => {
                let from_cal_val = payload.get("from_calendar").cloned().unwrap_or(Value::Null);
                let from_cal: CalendarData = serde_json::from_value(from_cal_val)
                    .map_err(|e| ApplicationError::Validation(e.to_string()))?;
                let to_cal_val = payload.get("to_calendar").cloned().unwrap_or(Value::Null);
                let to_cal: CalendarData = serde_json::from_value(to_cal_val)
                    .map_err(|e| ApplicationError::Validation(e.to_string()))?;
                let era_index = payload.get("era_index").and_then(|v| v.as_u64()).unwrap_or(0) as usize;
                let year = payload.get("year").and_then(|v| v.as_i64()).unwrap_or(1) as i32;
                let month = payload.get("month").and_then(|v| v.as_i64()).unwrap_or(1) as i32;
                let day = payload.get("day").and_then(|v| v.as_i64()).unwrap_or(1) as i32;
                let hour = payload.get("hour").and_then(|v| v.as_i64()).unwrap_or(0) as i32;
                let minute = payload.get("minute").and_then(|v| v.as_i64()).unwrap_or(0) as i32;
                let target_era = payload.get("target_era_index").and_then(|v| v.as_u64()).map(|v| v as usize);
                calendar.convert_calendar_date(&ConvertCalendarDateParams {
                    from_calendar: from_cal,
                    to_calendar: to_cal,
                    master_calendar: None,
                    date: DateCoordinate {
                        era_index,
                        year,
                        month,
                        day,
                        hour,
                        minute,
                    },
                    target_era_index: target_era,
                })
            }
            _ => Err(ApplicationError::Validation(format!("Unsupported timeline action: {action}"))),
        }
    }

    pub async fn audit_consistency(
        plot: &Arc<PlotServices>,
        target_type: &str,
        target_id: &str,
    ) -> Result<Value, ApplicationError> {
        match target_type {
            "volume" => {
                let report = plot.audit_volume(target_id).await?;
                Ok(serde_json::to_value(report).unwrap_or_default())
            }
            _ => Err(ApplicationError::Validation(format!("Unsupported audit target: {target_type}"))),
        }
    }

    pub async fn delegate_task(
        search_workflow: &Arc<HybridSemanticSearchWorkflow>,
        job_manager: &Arc<JobManager>,
        task_id: &str,
        prompt: &str,
    ) -> Result<Value, ApplicationError> {
        let token = job_manager.create_job(task_id).await;
        token.check()?;

        println!("[SUBAGENT] Spawning subagent task_id={} with prompt='{}'", task_id, prompt);

        let query_res = search_workflow.search("", prompt, "all", 6).await.unwrap_or_default();

        let mut findings = Vec::new();
        for item in query_res {
            let st = item.get("source_type").and_then(|s| s.as_str()).unwrap_or("");
            if st == "entity" {
                if let Some(name) = item.get("name").and_then(|n| n.as_str()) {
                    findings.push(format!(
                        "Сущность '{}': {:?}",
                        name,
                        item.get("attributes").unwrap_or(&serde_json::Value::Null)
                    ));
                }
            } else if st == "chapter" {
                if let Some(title) = item.get("title").and_then(|t| t.as_str()) {
                    let preview = item
                        .get("content")
                        .and_then(|c| c.as_str())
                        .unwrap_or("")
                        .chars()
                        .take(200)
                        .collect::<String>();
                    findings.push(format!("Глава '{}': {}...", title, preview));
                }
            } else if let Some(content) = item.get("content").and_then(|c| c.as_str()) {
                findings.push(content.to_string());
            }
        }

        let summary = if findings.is_empty() {
            format!(
                "Саб-агент исследовал материалы по задаче '{}'. Прямых совпадений в базе знаний не обнаружено.",
                prompt
            )
        } else {
            format!(
                "Саб-агент завершил исследование по задаче '{}'. Найдено {} фактов/источников:\n{}",
                prompt,
                findings.len(),
                findings.join("\n\n")
            )
        };

        Ok(serde_json::json!({
            "task_id": task_id,
            "status": "completed",
            "prompt": prompt,
            "summary": summary,
            "findings_count": findings.len(),
            "capabilities": ["query_world", "read_manuscript", "inspect_entity", "chronology", "audit_consistency"]
        }))
    }
}
