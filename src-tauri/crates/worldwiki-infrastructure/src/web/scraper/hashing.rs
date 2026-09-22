//! Content fingerprinting, SimHash 64-bit locality sensitive hashing, and evidence chunking.

use std::collections::hash_map::DefaultHasher;
use std::hash::{Hash, Hasher};
use worldwiki_domain::ai::{WebEvidence, WebPageEntity};

pub struct ScraperHashing;

impl ScraperHashing {
    /// Computes deterministic content hash.
    pub fn compute_content_hash(content: &str) -> String {
        let mut hasher = DefaultHasher::new();
        content.hash(&mut hasher);
        format!("{:016x}", hasher.finish())
    }

    /// Computes 64-bit SimHash for near-duplicate text detection and clustering.
    pub fn compute_simhash(text: &str) -> String {
        let mut v = [0i32; 64];
        for word in text.split_whitespace() {
            let clean: String = word.chars().filter(|c| c.is_alphanumeric()).collect();
            if clean.is_empty() {
                continue;
            }
            let mut hasher = DefaultHasher::new();
            clean.to_lowercase().hash(&mut hasher);
            let h = hasher.finish();
            for (i, val) in v.iter_mut().enumerate() {
                let bit = (h >> i) & 1;
                if bit == 1 {
                    *val += 1;
                } else {
                    *val -= 1;
                }
            }
        }
        let mut fingerprint = 0u64;
        for (i, val) in v.iter().enumerate() {
            if *val > 0 {
                fingerprint |= 1 << i;
            }
        }
        format!("{:016x}", fingerprint)
    }

    /// Extracts atomic evidence chunks with SimHash signatures from a fetched web page.
    pub fn extract_evidence_chunks(
        page: &WebPageEntity,
        page_id: &str,
        project_id: &str,
    ) -> Vec<WebEvidence> {
        let mut chunks = Vec::new();
        let mut offset = 0;
        let mut index = 0;

        for paragraph in page.content.split("\n\n") {
            let trimmed = paragraph.trim();
            if trimmed.len() < 40 {
                offset += paragraph.len() + 2;
                continue;
            }

            let simhash = Some(Self::compute_simhash(trimmed));
            chunks.push(WebEvidence {
                id: None,
                page_id: page_id.to_string(),
                project_id: project_id.to_string(),
                chunk_index: index,
                text: trimmed.to_string(),
                start_offset: offset,
                end_offset: offset + trimmed.len(),
                simhash,
                metadata: None,
                created_at: None,
            });

            index += 1;
            offset += paragraph.len() + 2;
        }

        chunks
    }
}
