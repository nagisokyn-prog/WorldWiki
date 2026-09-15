pub trait ClustererPort: Send + Sync {
    /// Clusters normalized vectors using DBSCAN or equivalent.
    /// Returns a vector of cluster IDs for each item, where None represents noise.
    fn cluster(
        &self,
        embeddings: &[Vec<f32>],
        eps: f32,
        min_points: usize,
    ) -> Result<Vec<Option<usize>>, String>;
}
