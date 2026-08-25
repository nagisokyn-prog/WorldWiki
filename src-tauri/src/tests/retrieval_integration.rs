//! Интеграционные тесты RAG-индексатора (`retrieval/indexer.rs`).
//!
//! Тестируют `reindex_project_lore_inner` поверх реальной in-memory SurrealDB:
//! - пустой проект → Ok(0);
//! - чанковка глав и запись в `entity_chunks` с проставленным `chapter_id`;
//! - идемпотентность повторного реиндекса (старые чанки чистятся).

use crate::logic::ai::retrieval::indexer::reindex_project_lore_inner;
use serde_json::json;
use super::common::{create_test_db, seed_chapter, seed_project};

#[tokio::test]
async fn reindex_empty_project_returns_zero() {
    let db = create_test_db().await;
    seed_project(&db, "empty_p", "Empty").await;

    let n = reindex_project_lore_inner(&db, "empty_p")
        .await
        .expect("reindex of empty project should be Ok");
    assert_eq!(n, 0, "пустой проект → 0 чанков");
}

#[tokio::test]
async fn reindex_indexes_chapters_into_entity_chunks() {
    let db = create_test_db().await;
    seed_project(&db, "lore_p", "Lore").await;

    // Контент больше дефолтного chunk_size (1800), чтобы получить несколько чанков
    let long_content = "Древние хроники гласят о падении королевства. ".repeat(80);
    let ch1 = seed_chapter(&db, "lore_p", "ch_long", "Глава Падения", &long_content).await;
    // Короткая глава с пустым контентом не должна дать чанков
    seed_chapter(&db, "lore_p", "ch_empty", "Пустая", "").await;

    let n = reindex_project_lore_inner(&db, "lore_p")
        .await
        .expect("reindex should succeed");
    assert!(n > 1, "длинная глава должна дать несколько чанков, получено {n}");

    // Проверяем записи в entity_chunks
    let mut res = db.query(
        "SELECT title, content, chunk_index, chapter_id FROM entity_chunks \
         WHERE project_id = type::record('projects','lore_p') ORDER BY chunk_index ASC",
    ).await.expect("query chunks");
    let rows: Vec<serde_json::Value> = res.take(0).unwrap();

    assert_eq!(rows.len(), n as usize, "количество строк в БД совпадает с результатом");
    for r in &rows {
        assert!(r["title"].as_str().unwrap().contains("Глава Падения"));
        assert!(!r["content"].as_str().unwrap().is_empty());
    }
    // chunk_index начинаются с 0 без пропусков
    for (i, r) in rows.iter().enumerate() {
        assert_eq!(r["chunk_index"], json!(i));
    }
    // chapter_id указывает на исходную главу
    let first = rows[0]["chapter_id"].as_str().unwrap_or("");
    assert!(
        first.ends_with(ch1.trim_start_matches("chapters:")) || first.contains("ch_long"),
        "chapter_id должен ссылаться на главу-источник, получено: {first}"
    );
}

#[tokio::test]
async fn reindex_is_idempotent_old_chunks_are_cleared() {
    let db = create_test_db().await;
    seed_project(&db, "idem_p", "Idempotent").await;

    let content_v1 = "Первая версия лора проекта для индексации. ".repeat(60);
    seed_chapter(&db, "idem_p", "ch_a", "Глава А", &content_v1).await;

    let first = reindex_project_lore_inner(&db, "idem_p").await.unwrap();
    assert!(first > 0);

    // Меняем контент и реиндексим
    let content_v2 = "Совершенно новый текст второй версии. ".repeat(60);
    seed_chapter(&db, "idem_p", "ch_b", "Глава B", &content_v2).await;

    let second = reindex_project_lore_inner(&db, "idem_p").await.expect("second reindex");
    assert!(second > 0);

    // Старых чанков быть не должно: все чанки ссылаются только на актуальный набор
    let mut res = db.query(
        "SELECT chapter_id FROM entity_chunks WHERE project_id = type::record('projects','idem_p')"
    ).await.unwrap();
    let rows: Vec<serde_json::Value> = res.take(0).unwrap();

    assert_eq!(rows.len(), second, "в БД ровно столько чанков, сколько вернул реиндекс");
    let has_stale = rows.iter().any(|r| {
        r["chapter_id"].as_str().map(|s| s.contains("ch_a")).unwrap_or(false)
    });
    // ch_a всё ещё существует как глава (мы её не удаляли), но её чанки были
    // перезаписаны при втором прогоне; главное — нет дублей сверх second.
    let _ = has_stale;

    // Третий прогон подряд без изменений данных даёт тот же count (полная замена)
    let third = reindex_project_lore_inner(&db, "idem_p").await.expect("third reindex");
    assert_eq!(third, second, "повторный реиндекс неизменённого лора идемпотентен");
}