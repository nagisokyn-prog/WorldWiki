use std::collections::HashMap;
use worldwiki_domain::ai::{ResearchPolicy, WebEvidence, WebPageEntity};

pub struct SourceRanker;

impl SourceRanker {
    /// Фильтрация и ранжирование страниц с учетом Domain Diversity
    pub fn rank_pages(
        mut pages: Vec<WebPageEntity>,
        policy: &ResearchPolicy,
    ) -> Vec<WebPageEntity> {
        let mut domain_counts: HashMap<String, usize> = HashMap::new();
        let mut ranked = Vec::new();

        // Сортируем: сначала страницы с приоритетных доменов
        pages.sort_by(|a, b| {
            let a_pref = policy.preferred_domains.contains(&a.domain);
            let b_pref = policy.preferred_domains.contains(&b.domain);
            b_pref.cmp(&a_pref)
        });

        for page in pages {
            let count = domain_counts.entry(page.domain.clone()).or_insert(0);
            if *count < policy.max_pages_per_domain {
                *count += 1;
                ranked.push(page);
            }
        }

        ranked
    }

    /// Дедупликация чанков доказательств на основе SimHash
    pub fn deduplicate_evidences(evidences: Vec<WebEvidence>) -> Vec<WebEvidence> {
        let mut unique: Vec<WebEvidence> = Vec::new();

        for ev in evidences {
            let Some(ref h1) = ev.simhash else {
                unique.push(ev);
                continue;
            };

            let is_duplicate = unique.iter().any(|u| {
                if let Some(ref h2) = u.simhash {
                    hamming_distance_hex(h1, h2) <= 3
                } else {
                    false
                }
            });

            if !is_duplicate {
                unique.push(ev);
            }
        }

        unique
    }
}

fn hamming_distance_hex(s1: &str, s2: &str) -> u32 {
    let v1 = u64::from_str_radix(s1, 16).unwrap_or(0);
    let v2 = u64::from_str_radix(s2, 16).unwrap_or(0);
    (v1 ^ v2).count_ones()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_hamming_distance() {
        assert_eq!(hamming_distance_hex("ffff", "ffff"), 0);
        assert_eq!(hamming_distance_hex("0001", "0000"), 1);
    }
}
