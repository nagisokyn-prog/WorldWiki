use worldwiki_domain::ai::{ClaimStatus, ResearchClaim, ResearchMode, ResearchPolicy};

pub struct StoppingCriteriaEvaluator;

impl StoppingCriteriaEvaluator {
    /// Проверка, пора ли завершить исследование
    pub fn should_stop(
        mode: &ResearchMode,
        round: usize,
        claims: &[ResearchClaim],
        unique_domains_count: usize,
        duplicate_hits_ratio: f32,
        policy: &ResearchPolicy,
    ) -> bool {
        let max_rounds = match mode {
            ResearchMode::Direct => 1,
            ResearchMode::Research => 2,
            ResearchMode::DeepResearch => 4,
        };

        // 1. Лимит раундов
        if round >= max_rounds {
            return true;
        }

        // 2. Если все гипотезы подтверждены достаточным числом независимых доменов
        if !claims.is_empty() {
            let all_supported = claims
                .iter()
                .all(|c| c.status == ClaimStatus::Supported && c.evidence_ids.len() >= policy.min_domain_diversity);

            if all_supported && unique_domains_count >= policy.min_domain_diversity {
                return true;
            }
        }

        // 3. Если поисковик возвращает преимущественно дублирующий контент (исчерпание нового материала)
        duplicate_hits_ratio >= 0.8 && round >= 1
    }
}
