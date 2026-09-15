use arch_guard_ports::ClustererPort;
use std::collections::VecDeque;

pub struct DbscanClustererAdapter;

impl DbscanClustererAdapter {
    pub fn new() -> Self {
        Self
    }

    fn euclidean_distance(a: &[f32], b: &[f32]) -> f32 {
        a.iter()
            .zip(b.iter())
            .map(|(x, y)| {
                let diff = x - y;
                diff * diff
            })
            .sum::<f32>()
            .sqrt()
    }
}

impl Default for DbscanClustererAdapter {
    fn default() -> Self {
        Self::new()
    }
}

impl ClustererPort for DbscanClustererAdapter {
    fn cluster(
        &self,
        embeddings: &[Vec<f32>],
        eps: f32,
        min_points: usize,
    ) -> Result<Vec<Option<usize>>, String> {
        let n = embeddings.len();
        if n == 0 {
            return Ok(Vec::new());
        }

        // Memory limit guard: O(n^2) check
        if n > 2000 {
            eprintln!(
                "[PERF-WARN] Large baseline ({} violations): DBSCAN memory limit threshold. Consider grouping by rules.",
                n
            );
        }

        let mut visited = vec![false; n];
        let mut labels: Vec<Option<usize>> = vec![None; n];
        let mut cluster_id = 0;

        for i in 0..n {
            if visited[i] {
                continue;
            }
            visited[i] = true;

            let mut neighbors = Vec::new();
            for j in 0..n {
                if Self::euclidean_distance(&embeddings[i], &embeddings[j]) <= eps {
                    neighbors.push(j);
                }
            }

            if neighbors.len() < min_points {
                // Mark as noise (None)
                labels[i] = None;
            } else {
                // Expand cluster
                labels[i] = Some(cluster_id);
                let mut queue = VecDeque::from(neighbors);

                while let Some(neighbor_idx) = queue.pop_front() {
                    if !visited[neighbor_idx] {
                        visited[neighbor_idx] = true;
                        let mut sub_neighbors = Vec::new();
                        for k in 0..n {
                            if Self::euclidean_distance(&embeddings[neighbor_idx], &embeddings[k]) <= eps {
                                sub_neighbors.push(k);
                            }
                        }
                        if sub_neighbors.len() >= min_points {
                            queue.extend(sub_neighbors);
                        }
                    }

                    if labels[neighbor_idx].is_none() {
                        labels[neighbor_idx] = Some(cluster_id);
                    }
                }

                cluster_id += 1;
            }
        }

        Ok(labels)
    }
}
