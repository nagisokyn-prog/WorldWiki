use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ContradictionSeverity {
    Critical, // 🔴 Блокирует логику повествования (мертвый персонаж)
    Warning,  // 🟡 Предупреждение (разрушенная локация, билокация, анахронизм)
    Notice,   // ℹ️ Забытые ружья / сюжетные долги
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ContradictionRule {
    DeceasedEntityActive,
    ActionBeforeBirth,
    RevealBeforeEvent,
    DestroyedLocationUsed,
    EntityBilocation,
    ForgottenPlotPromise,
    ForgottenItem,
    ChainOfCustodyViolation,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ContradictionAnomaly {
    pub rule: ContradictionRule,
    pub severity: ContradictionSeverity,
    pub title: String,
    pub description: String,
    pub entity_ids: Vec<String>,
    pub chapter_ids: Vec<String>,
    pub event_ids: Vec<String>,
    pub promise_ids: Vec<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct AuditSummaryStatsDto {
    pub total: usize,
    pub critical_count: usize,
    pub warning_count: usize,
    pub notice_count: usize,
    pub healthy_percent: u32,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ConsistencyAuditReportDto {
    pub summary: AuditSummaryStatsDto,
    pub anomalies: Vec<ContradictionAnomaly>,
}

impl ConsistencyAuditReportDto {
    pub fn from_anomalies(anomalies: Vec<ContradictionAnomaly>) -> Self {
        let mut critical_count = 0;
        let mut warning_count = 0;
        let mut notice_count = 0;

        for a in &anomalies {
            match a.severity {
                ContradictionSeverity::Critical => critical_count += 1,
                ContradictionSeverity::Warning => warning_count += 1,
                ContradictionSeverity::Notice => notice_count += 1,
            }
        }

        let total = anomalies.len();
        let penalty = (critical_count * 15 + warning_count * 5 + notice_count) as i32;
        let healthy_percent = if total == 0 {
            100
        } else {
            (100 - penalty).clamp(0, 100) as u32
        };

        Self {
            summary: AuditSummaryStatsDto {
                total,
                critical_count,
                warning_count,
                notice_count,
                healthy_percent,
            },
            anomalies,
        }
    }
}
