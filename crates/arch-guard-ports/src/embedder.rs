pub trait VectorEmbedderPort: Send + Sync {
    fn embed_texts(&self, texts: &[String]) -> Result<Vec<Vec<f32>>, String>;
    fn dimension(&self) -> usize;
}
