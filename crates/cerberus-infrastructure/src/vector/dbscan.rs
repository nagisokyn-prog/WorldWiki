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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_dbscan_clustering_and_noise() {
        let clusterer = DbscanClustererAdapter::new();

        // 3 points close to each other (Cluster 0)
        let p1 = vec![0.0, 0.0];
        let p2 = vec![0.05, 0.05];
        let p3 = vec![0.02, 0.03];

        // 1 isolated point (Noise)
        let p4 = vec![10.0, 10.0];

        let points = vec![p1, p2, p3, p4];
        let labels = clusterer.cluster(&points, 0.2, 3).unwrap();

        assert_eq!(labels[0], Some(0));
        assert_eq!(labels[1], Some(0));
        assert_eq!(labels[2], Some(0));
        assert_eq!(labels[3], None, "Isolated point must be labeled as noise");
    }

    #[test]
    #[allow(clippy::default_constructed_unit_structs)]
    fn test_dbscan_default_and_empty() {
        let clusterer = DbscanClustererAdapter::default();
        let empty: Vec<Vec<f32>> = vec![];
        let res = clusterer.cluster(&empty, 0.5, 2).unwrap();
        assert!(res.is_empty());
    }

    #[test]
    fn test_dbscan_queue_expansion_density_connected() {
        let clusterer = DbscanClustererAdapter::new();
        // Create points in a line where each sub-neighborhood has >= 2 points
        let points = vec![
            vec![0.0, 0.0],
            vec![0.1, 0.0],
            vec![0.2, 0.0],
            vec![0.3, 0.0],
            vec![0.4, 0.0],
        ];
        let labels = clusterer.cluster(&points, 0.15, 2).unwrap();
        assert_eq!(labels.len(), 5);
        for l in labels {
            assert_eq!(l, Some(0));
        }
    }

    #[test]
    fn test_dbscan_large_input_warning() {
        let clusterer = DbscanClustererAdapter::new();
        let large_points: Vec<Vec<f32>> = (0..2005).map(|_| vec![1.0, 2.0]).collect();
        let labels = clusterer.cluster(&large_points, 0.1, 2).unwrap();
        assert_eq!(labels.len(), 2005);
    }
}
