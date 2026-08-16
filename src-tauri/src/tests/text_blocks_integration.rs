//! Интеграционные тесты текстовых блоков главы и семантической разметки.
//!
//! Тестируют:
//! - Нарезку HTML главы на `text_blocks` с сохранением порядка (`order_index`)
//! - Маппинг семантических тегов (`desc` -> `description`, `dialog` -> `dialogue`)
//! - Атомарную ACID-замену блоков при повторном сохранении

use crate::logic::chapters::save_text_blocks_inner;
use serde_json::Value;
use super::common::{create_test_db, seed_chapter, seed_project};

#[tokio::test]
async fn save_text_blocks_parses_html_and_creates_records() {
    let db = create_test_db().await;
    seed_project(&db, "p1", "Project 1").await;
    seed_chapter(&db, "p1", "ch1", "Глава 1", "").await;

    let html = r#"
        <p data-semantic-tag="desc">В тёмном лесу шумели вековые сосны.</p>
        <p data-semantic-tag="dialog">— Кто здесь? — спросил путник.</p>
        <p data-semantic-tag="custom_action">Он выхватил меч из ножен.</p>
    "#;

    save_text_blocks_inner(&db, "p1", "ch1", html)
        .await
        .expect("save_text_blocks should succeed");

    let mut res = db
        .query("SELECT * FROM text_blocks WHERE chapter_id = type::record('chapters:ch1') ORDER BY order_index ASC")
        .await
        .unwrap();

    let blocks: Vec<Value> = res.take(0).unwrap();
    assert_eq!(blocks.len(), 3, "должно создаться 3 блока");

    // Блок 0: desc -> description
    assert_eq!(blocks[0]["block_type"], "description");
    assert_eq!(blocks[0]["content"], "В тёмном лесу шумели вековые сосны.");
    assert_eq!(blocks[0]["order_index"], 0);

    // Блок 1: dialog -> dialogue
    assert_eq!(blocks[1]["block_type"], "dialogue");
    assert_eq!(blocks[1]["content"], "— Кто здесь? — спросил путник.");
    assert_eq!(blocks[1]["order_index"], 1);

    // Блок 2: custom_action -> custom_action
    assert_eq!(blocks[2]["block_type"], "custom_action");
    assert_eq!(blocks[2]["content"], "Он выхватил меч из ножен.");
    assert_eq!(blocks[2]["order_index"], 2);
}

#[tokio::test]
async fn save_text_blocks_replaces_old_blocks_atomically() {
    let db = create_test_db().await;
    seed_project(&db, "p1", "Project 1").await;
    seed_chapter(&db, "p1", "ch1", "Глава 1", "").await;

    // 1. Первое сохранение — 3 блока
    let html1 = r#"
        <p data-semantic-tag="desc">Первый абзац</p>
        <p data-semantic-tag="desc">Второй абзац</p>
        <p data-semantic-tag="desc">Третий абзац</p>
    "#;
    save_text_blocks_inner(&db, "p1", "ch1", html1).await.unwrap();

    // 2. Второе сохранение — 1 блок (старые должны быть удалены транзакцией)
    let html2 = r#"
        <p data-semantic-tag="desc">Единственный новый абзац</p>
    "#;
    save_text_blocks_inner(&db, "p1", "ch1", html2).await.unwrap();

    let mut res = db
        .query("SELECT * FROM text_blocks WHERE chapter_id = type::record('chapters:ch1') ORDER BY order_index ASC")
        .await
        .unwrap();

    let blocks: Vec<Value> = res.take(0).unwrap();
    assert_eq!(blocks.len(), 1, "старые 3 блока должны быть полностью заменены 1 новым");
    assert_eq!(blocks[0]["content"], "Единственный новый абзац");
    assert_eq!(blocks[0]["order_index"], 0);
}

#[tokio::test]
async fn save_text_blocks_empty_html_clears_blocks() {
    let db = create_test_db().await;
    seed_project(&db, "p1", "Project 1").await;
    seed_chapter(&db, "p1", "ch1", "Глава 1", "").await;

    // Сохраняем блок
    let html = "<p data-semantic-tag=\"desc\">Текст для очистки</p>";
    save_text_blocks_inner(&db, "p1", "ch1", html).await.unwrap();

    // Сохраняем пустой HTML
    save_text_blocks_inner(&db, "p1", "ch1", "").await.unwrap();

    let mut res = db
        .query("SELECT * FROM text_blocks WHERE chapter_id = type::record('chapters:ch1')")
        .await
        .unwrap();

    let blocks: Vec<Value> = res.take(0).unwrap();
    assert!(blocks.is_empty(), "все блоки главы должны быть очищены");
}
