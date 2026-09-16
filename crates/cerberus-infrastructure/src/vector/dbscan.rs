use cerberus_ports::ClustererPort;
use rayon::prelude::*;
use std::collections::VecDeque;

pub struct DbscanClustererAdapter;

impl DbscanClustererAdapter {
    pub fn new() -> Self {
        Self
    }

    #[inline(always)]
    pub fn is_within_eps_squared(a: &[f32], b: &[f32], eps_sq: f32) -> bool {
        let mut sum = 0.0f32;
        for (x, y) in a.iter().zip(b.iter()) {
            let diff = x - y;
            sum += diff * diff;
            if sum > eps_sq {
                return false;
            }
        }
        true
    }

    pub fn euclidean_distance(a: &[f32], b: &[f32]) -> f32 {
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

        let eps_sq = eps * eps;

        // Step 1: Parallel multi-threaded neighbor index computation with early-exit squared distance
        let all_neighbors: Vec<Vec<usize>> = (0..n)
            .into_par_iter()
            .map(|i| {
                let mut neighbors = Vec::new();
                let target = &embeddings[i];
                for (j, other) in embeddings.iter().enumerate() {
                    if Self::is_within_eps_squared(target, other, eps_sq) {
                        neighbors.push(j);
                    }
                }
                neighbors
            })
            .collect();

        // Step 2: Fast sequential cluster expansion using precomputed neighbor graph
        let mut visited = vec![false; n];
        let mut labels: Vec<Option<usize>> = vec![None; n];
        let mut cluster_id = 0;

        for i in 0..n {
            if visited[i] {
                continue;
            }
            visited[i] = true;

            let neighbors = &all_neighbors[i];

            if neighbors.len() < min_points {
                // Mark as noise (None)
                labels[i] = None;
            } else {
                // Expand cluster
                labels[i] = Some(cluster_id);
                let mut queue = VecDeque::from(neighbors.clone());

                while let Some(neighbor_idx) = queue.pop_front() {
                    if !visited[neighbor_idx] {
                        visited[neighbor_idx] = true;
                        let sub_neighbors = &all_neighbors[neighbor_idx];
                        if sub_neighbors.len() >= min_points {
                            queue.extend(sub_neighbors.iter().copied());
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
        assert_eq!(labels[3], None); // Noise
    }

    #[test]
    #[allow(clippy::default_constructed_unit_structs)]
    fn test_dbscan_default_and_empty() {
        let clusterer = DbscanClustererAdapter::default();
        let empty: Vec<Vec<f32>> = Vec::new();
        assert!(clusterer.cluster(&empty, 0.5, 2).unwrap().is_empty());


        let dist = DbscanClustererAdapter::euclidean_distance(&[0.0, 0.0], &[3.0, 4.0]);
        assert!((dist - 5.0).abs() < 1e-5);
    }

    #[test]
    fn test_dbscan_large_input_warning() {
        let clusterer = DbscanClustererAdapter::new();
        let large: Vec<Vec<f32>> = (0..2005).map(|_| vec![0.1; 2]).collect();
        let labels = clusterer.cluster(&large, 0.5, 2).unwrap();
        assert_eq!(labels.len(), 2005);
    }

    #[test]
    fn test_dbscan_density_connected_clusters_and_border_points() {
        let clusterer = DbscanClustererAdapter::new();

        // Core point 0 has neighbors {0, 1, 2} (len 3 >= min_points 3)
        // Core point 1 has neighbors {0, 1, 2} (len 3 >= min_points 3)
        // Border point 2 is close to 0 and 1, but far from anything else (len 3 >= 3)
        // Border point 3 is close ONLY to 0 (distance 0.15), its neighbors are {0, 3} (len 2 < min_points 3) -> border point of Cluster 0!
        // Cluster 1: points 4, 5, 6 (close to (5.0, 5.0))
        // Noise: point 7 (100.0, 100.0)
        let points = vec![
            vec![0.0, 0.0],     // 0: Core
            vec![0.05, 0.0],    // 1: Core
            vec![0.0, 0.05],    // 2: Core/Border
            vec![0.15, 0.0],    // 3: Border point of cluster 0 (neighbors: 0, 1, 3 -> wait, dist(3, 1)=0.1, dist(3,0)=0.15, dist(3,2)=sqrt(0.15^2+0.05^2)=0.158)
            vec![5.0, 5.0],     // 4: Core of cluster 1
            vec![5.02, 5.0],    // 5: Core of cluster 1
            vec![5.0, 5.02],    // 6: Core of cluster 1
            vec![100.0, 100.0], // 7: Noise
        ];

        let labels = clusterer.cluster(&points, 0.12, 3).unwrap();
        assert_eq!(labels[0], Some(0));
        assert_eq!(labels[1], Some(0));
        assert_eq!(labels[2], Some(0));
        assert_eq!(labels[3], Some(0));

        // Cluster 1
        assert_eq!(labels[4], Some(1));
        assert_eq!(labels[5], Some(1));
        assert_eq!(labels[6], Some(1));

        // Noise
        assert_eq!(labels[7], None);
    }
}


