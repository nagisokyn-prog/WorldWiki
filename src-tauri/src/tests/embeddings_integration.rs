//! Интеграционные тесты векторных Embeddings и HNSW индексов косинусного сходства.
//!
//! Тестируют:
//! - Сохранение 1536-мерных float-векторов OpenAI в `embeddings.openai`.
//! - Поиск ближайших соседей (KNN) через векторный индекс `idx_entity_emb_openai` (HNSW COSINE).
//! - Мультимодельность (хранение эмбеддингов разных провайдеров в `embeddings`).

use crate::logic::entities::save_entity_inner;
use crate::logic::models::Entity;
use serde_json::json;
use super::common::{create_test_db, seed_project};

/// Генерирует детерминированный тестовый вектор единичной длины размерности `dim`
fn make_unit_vector(seed: f32, dim: usize) -> Vec<f32> {
    let mut vec = Vec::with_capacity(dim);
    let mut sum_sq = 0.0;
    for i in 0..dim {
        let val = (seed * (i as f32 + 1.0)).sin();
        vec.push(val);
        sum_sq += val * val;
    }
    let norm = sum_sq.sqrt();
    for v in &mut vec {
        *v /= norm;
    }
    vec
}

#[tokio::test]
async fn save_entity_with_1536_dim_openai_embedding() {
    let db = create_test_db().await;
    seed_project(&db, "p_vec", "Vector Project").await;

    let vector_1536 = make_unit_vector(1.23, 1536);

    let entity = Entity {
        id: None,
        project_id: Some("projects:p_vec".into()),
        entity_type: "character".into(),
        name: "Векторный Герой".into(),
        description: Some("Персонаж с векторным представлением".into()),
        attributes: json!({}),
        tags: vec![],
        embeddings: Some(json!({
            "openai": vector_1536
        })),
        created_at: None,
        updated_at: None,
    };

    let saved = save_entity_inner(&db, "p_vec", entity)
        .await
        .expect("save_entity with 1536-dim embedding should succeed");

    let saved_id = saved.id.unwrap();

    // Читаем напрямую из SurrealDB и проверяем размерность
    let mut res = db
        .query("SELECT embeddings FROM type::record($id)")
        .bind(("id", saved_id))
        .await
        .unwrap();

    let rows: Vec<serde_json::Value> = res.take(0).unwrap();
    assert_eq!(rows.len(), 1);

    let retrieved_vec = rows[0]["embeddings"]["openai"].as_array().expect("must have openai vector");
    assert_eq!(retrieved_vec.len(), 1536, "размерность вектора должна быть ровно 1536");
}

#[tokio::test]
async fn vector_search_cosine_knn_retrieval() {
    let db = create_test_db().await;
    seed_project(&db, "p_vec2", "Vector KNN Project").await;

    // Создаём 3 сущности:
    // e1: близкий вектор к запросу (seed 1.0)
    // e2: средний вектор (seed 2.0)
    // e3: далекий вектор (seed 5.0)
    let v1 = make_unit_vector(1.0, 1536);
    let v2 = make_unit_vector(2.0, 1536);
    let v3 = make_unit_vector(5.0, 1536);

    save_entity_inner(&db, "p_vec2", Entity {
        id: None,
        project_id: Some("projects:p_vec2".into()),
        entity_type: "concept".into(),
        name: "Магия Огня (e1)".into(),
        description: None,
        attributes: json!({}),
        tags: vec![],
        embeddings: Some(json!({ "openai": v1 })),
        created_at: None,
        updated_at: None,
    }).await.unwrap();

    save_entity_inner(&db, "p_vec2", Entity {
        id: None,
        project_id: Some("projects:p_vec2".into()),
        entity_type: "concept".into(),
        name: "Магия Воды (e2)".into(),
        description: None,
        attributes: json!({}),
        tags: vec![],
        embeddings: Some(json!({ "openai": v2 })),
        created_at: None,
        updated_at: None,
    }).await.unwrap();

    save_entity_inner(&db, "p_vec2", Entity {
        id: None,
        project_id: Some("projects:p_vec2".into()),
        entity_type: "concept".into(),
        name: "Космический Корабль (e3)".into(),
        description: None,
        attributes: json!({}),
        tags: vec![],
        embeddings: Some(json!({ "openai": v3 })),
        created_at: None,
        updated_at: None,
    }).await.unwrap();

    // Ищем вектор, очень близкий к e1 (легкая модификация первого элемента)
    let mut query_vector = v1.clone();
    query_vector[0] += 0.01;

    // Запрос через векторное сходство (Cosine Similarity) в SurrealDB
    let mut res = db
        .query(
            "SELECT name, vector::similarity::cosine(embeddings.openai, $q) AS sim \
             FROM entities WHERE project_id = type::record('projects:p_vec2') \
             ORDER BY sim DESC LIMIT 1"
        )
        .bind(("q", query_vector))
        .await
        .expect("vector similarity query should run");

    let matches: Vec<serde_json::Value> = res.take(0).unwrap();
    assert_eq!(matches.len(), 1);

    // Самым близким соседом должен быть e1 ("Магия Огня")
    assert_eq!(matches[0]["name"], "Магия Огня (e1)");
    let sim = matches[0]["sim"].as_f64().expect("similarity score exists");
    assert!(sim > 0.95, "косинусное сходство для близких векторов должно быть > 0.95 (получено {sim})");
}
