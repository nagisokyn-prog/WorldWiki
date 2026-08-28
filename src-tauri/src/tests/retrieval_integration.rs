//! Интеграционные тесты RAG-индексатора (`retrieval/indexer.rs`).
//!
//! Тестируют `reindex_project_lore_inner` поверх реальной in-memory SurrealDB:
//! - пустой проект → Ok(0);
//! - чанковка глав и запись в `entity_chunks` с проставленным `chapter_id`;
//! - идемпотентность повторного реиндекса (старые чанки чистятся).

use crate::logic::ai::retrieval::indexer::reindex_project_lore_inner;
use serde_json::json;
use surrealdb::engine::local::Db;
use surrealdb::Surreal;

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

// ---------------------------------------------------------------------------
// RetrievalRouter::retrieve() — keyword/BM25 путь (enable_semantic = false)
// ---------------------------------------------------------------------------

use crate::logic::ai::retrieval::router::RetrievalRouter;

/// Сидинг сущности: возвращает нормализованный id "entities:{key}".
async fn seed_entity(
    db: &Surreal<Db>,
    project_key: &str,
    key: &str,
    name: &str,
    description: &str,
) -> String {
    let proj_raw = project_key.strip_prefix("projects:").unwrap_or(project_key).trim_matches('`');
    let ent_raw = key.strip_prefix("entities:").unwrap_or(key).trim_matches('`');
    let sql = "CREATE type::record('entities', $eid) SET \
               project_id = type::record('projects', $pid), entity_type = 'character', \
               name = $name, description = $desc";
    let mut resp = db
        .query(sql)
        .bind(("eid", ent_raw))
        .bind(("pid", proj_raw))
        .bind(("name", name))
        .bind(("desc", description))
        .await
        .expect("create entity should run");
    if let Some(err) = resp.take_errors().into_iter().next() {
        panic!("seed_entity error: {err:?}");
    }
    format!("entities:{}", ent_raw)
}

/// Сидинг чанка лора для RAG-индекса.
async fn seed_chunk(
    db: &Surreal<Db>,
    project_key: &str,
    key: &str,
    entity_key: Option<&str>,
    title: &str,
    content: &str,
) {
    let proj_raw = project_key.strip_prefix("projects:").unwrap_or(project_key).trim_matches('`');
    let chunk_raw = key.strip_prefix("entity_chunks:").unwrap_or(key).trim_matches('`');
    // entity_id в продовой схеме — record<entities> (см. schema.surql:194).
    let sql = "CREATE type::record('entity_chunks', $cid) SET \
               project_id = type::record('projects', $pid), \
               entity_id = type::record('entities', $ent), \
               title = $title, content = $content, chunk_index = 0";
    db.query(sql)
        .bind(("cid", chunk_raw))
        .bind(("pid", proj_raw))
        .bind(("ent", entity_key.unwrap_or("").trim_start_matches("entities:").trim_matches('`')))
        .bind(("title", title))
        .bind(("content", content))
        .await
        .expect("create chunk should run");
}

#[tokio::test]
async fn retrieve_skips_greetings_even_with_data() {
    let db = create_test_db().await;
    seed_project(&db, "skip_p", "Skip").await;
    seed_entity(&db, "skip_p", "e_arthur", "Артур", "Король").await;

    let router = RetrievalRouter::default();
    let out = router.retrieve(&db, "skip_p", "привет", false).await;
    assert!(out.is_none(), "приветствие не должно запускать retrieval");
}

#[tokio::test]
async fn retrieve_returns_none_when_nothing_matches() {
    let db = create_test_db().await;
    seed_project(&db, "nomatch_p", "NoMatch").await;
    seed_entity(&db, "nomatch_p", "e_arthur", "Артур", "Король бриттов").await;

    let router = RetrievalRouter::default();
    let out = router
        .retrieve(&db, "nomatch_p", "квантовая термодинамика плазмы", false)
        .await;
    assert!(out.is_none(), "без совпадений должен быть None, получено: {:?}", out);
}

#[tokio::test]
async fn retrieve_finds_entity_by_name_bm25() {
    let db = create_test_db().await;
    seed_project(&db, "bm25_p", "BM25").await;
    seed_entity(
        &db,
        "bm25_p",
        "e_artur",
        "Артур Пендрагон",
        "Король бриттов, владелец меча Экскалибур",
    )
    .await;
    seed_entity(&db, "bm25_p", "e_other", "Моргана", "Ведьма, сестра Артура по мифам").await;

    let router = RetrievalRouter::default();
    let out = router
        .retrieve(&db, "bm25_p", "Артур Пендрагон", false)
        .await
        .expect("BM25 по имени должен дать кандидата");

    assert!(out.contains("<world_context>"), "обёртка XML: {out}");
    assert!(out.contains("Артур Пендрагон"), "имя сущности в контексте: {out}");
    assert!(out.contains("<Entity"), "source_type Entity: {out}");
}

#[tokio::test]
async fn retrieve_finds_lore_chunk_content() {
    let db = create_test_db().await;
    seed_project(&db, "chunk_p", "Chunks").await;
    let ent = seed_entity(&db, "chunk_p", "e_sword", "Экскалибур", "Легендарный меч").await;
    seed_chunk(
        &db,
        "chunk_p",
        "c_sword_1",
        Some(ent.trim_start_matches("entities:")),
        "Экскалибур — история",
        "Меч был выкован эльфами в кратере вулкана и способен резать камень.",
    )
    .await;

    let router = RetrievalRouter::default();
    let out = router
        .retrieve(&db, "chunk_p", "выкован эльфами", false)
        .await
        .expect("чанк с совпадением должен найтись");

    assert!(out.contains("Lore_Chunk") || out.contains("Lore Chunk"), "тип чанка: {out}");
    assert!(
        out.contains("выкован эльфами"),
        "текст чанка в сниппете: {out}"
    );
}

#[tokio::test]
async fn retrieve_empty_snippet_candidates_are_filtered() {
    let db = create_test_db().await;
    seed_project(&db, "empty_snip_p", "EmptySnippet").await;
    // Сущность без описания: кандидат попадёт в выборку, но пустой snippet
    // не должен породить пустой тег в XML.
    seed_entity(&db, "empty_snip_p", "e_blank", "Загадочная руина", "").await;

    let router = RetrievalRouter::default();
    let out = router
        .retrieve(&db, "empty_snip_p", "что за загадочная руина?", false)
        .await;

    if let Some(ctx) = out {
        assert!(!ctx.contains(">\n\n  <"), "пустых сниппетов быть не должно: {ctx}");
    }
    // None тоже допустим, если все кандидаты отфильтрованы и связей нет.
}


#[tokio::test]
async fn retrieve_expands_relations_of_found_entities() {
    let db = create_test_db().await;
    seed_project(&db, "rel_p", "Relations").await;
    seed_entity(&db, "rel_p", "e_arthur", "Артур", "Король бриттов").await;
    seed_entity(&db, "rel_p", "morgana", "Моргана", "Ведьма").await;

    // Реляция: entity_rel.in/out — record<entities>
    let rel_sql = "RELATE entities:e_arthur->entity_rel->entities:morgana \
                   SET project_id = projects:rel_p, rel_type = 'sibling', \
                   description = 'Единокровная сестра', strength = 1";
    let resp = db.query(rel_sql).await;
    let mut resp = match resp {
        Ok(r) => r,
        Err(e) => panic!("relate query err: {e}"),
    };
    if let Some(err) = resp.take_errors().into_iter().next() {
        panic!("seed relation error: {err:?}");
    }

    let router = RetrievalRouter::default();
    let out = router
        .retrieve(&db, "rel_p", "Артур", false)
        .await
        .expect("сущность должна найтись");

    assert!(out.contains("<Relationships>"), "блок связей должен быть: {out}");
    assert!(out.contains("sibling"), "тип связи: {out}");
    assert!(
        out.contains("Единокровная сестра"),
        "описание связи: {out}"
    );
}

#[tokio::test]
async fn retrieve_includes_chapter_candidates() {
    let db = create_test_db().await;
    seed_project(&db, "chap_p", "Chapters").await;
    seed_chapter(
        &db,
        "chap_p",
        "ch_excal",
        "Глава о Экскалибуре",
        "Длинный текст про меч Экскалибур и его происхождение.",
    )
    .await;

    let router = RetrievalRouter::default();
    let out = router
        .retrieve(&db, "chap_p", "Экскалибур", false)
        .await
        .expect("глава должна найтись по токену");

    assert!(out.contains("<Chapter"), "кандидат-глава в контексте: {out}");
    assert!(out.contains("Глава о Экскалибуре"), "заголовок главы: {out}");
}
