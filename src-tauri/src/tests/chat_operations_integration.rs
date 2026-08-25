//! Интеграционные тесты операций чата (`logic/ai/chat/operations.rs`).
//!
//! Покрывают `_impl`-ядра поверх реальной in-memory SurrealDB:
//! - `fork_chat_impl`: копия ветки от корня / негатив «сообщение не найдено»;
//! - `update_chat_parent_impl`: переприкрепление чата в дереве;
//! - `delete_chat_message_impl`, `switch_message_variant_impl`, `delete_ai_chat_impl`.

use crate::logic::ai::chat::operations::{
    delete_ai_chat_impl, delete_chat_message_impl, edit_message_db_core, fork_chat_impl,
    regenerate_variant_db_core, send_message_db_core, switch_message_variant_impl,
    update_chat_parent_impl,
};
use serde_json::Value;
use super::common::create_test_db;

type Db = surrealdb::Surreal<surrealdb::engine::local::Db>;

/// Хелпер: проект + чат с сообщениями (корень и потомок).
async fn seed_chat(db: &Db) {
    db.query("CREATE projects:p_chop SET name = 'ChatOps', data = {}")
        .await
        .unwrap();
    db.query(
        "CREATE chats:c_main SET project_id = type::record('projects','p_chop'), \
         title = 'Основной чат', session_context = []",
    )
    .await
    .unwrap();

    db.query(
        "CREATE chat_messages:m_root SET chat_id = chats:c_main, \
         project_id = type::record('projects','p_chop'), role = 'user', \
         content = 'Вопрос из корня', version = 1, parent_id = NONE, is_active = true, \
         created_at = time::now() - 2m",
    )
    .await
    .unwrap();
    db.query(
        "CREATE chat_messages:m_child SET chat_id = chats:c_main, \
         project_id = type::record('projects','p_chop'), role = 'assistant', \
         content = 'Ответ ассистента', version = 1, parent_id = chat_messages:m_root, \
         is_active = true, created_at = time::now() - 1m",
    )
    .await
    .unwrap();
}

async fn count_msgs(db: &Db, chat_ref: &str) -> usize {
    let mut res = db
        .query(format!(
            "SELECT count() FROM chat_messages WHERE chat_id = {chat_ref} GROUP ALL"
        ))
        .await
        .unwrap();
    let v: Option<Value> = res.take(0).unwrap();
    v.and_then(|x| x.get("count").and_then(|c| c.as_u64()))
        .unwrap_or(0) as usize
}

// ---------- fork_chat_impl ----------

#[tokio::test]
async fn fork_from_root_copies_whole_branch_to_new_chat() {
    let db = create_test_db().await;
    seed_chat(&db).await;

    let new_chat = fork_chat_impl(&db, "p_chop", "chat_messages:m_child", "Ветка от потомка")
        .await
        .expect("fork should succeed");

    assert_eq!(new_chat["title"], "Ветка от потомка");
    let new_id = new_chat["id"].as_str().unwrap().to_string();
    assert!(new_id.starts_with("chats:"), "id нового чата нормализован");

    // Копируются сообщения с created_at <= целевого: от потомка это вся ветка
    let new_key = new_id.trim_start_matches("chats:");
    assert_eq!(
        count_msgs(&db, &format!("chats:`{new_key}`")).await,
        2,
        "форк от ПОСЛЕДНЕГО сообщения копирует всю ветку"
    );

    // Связь parent сохранена между КОПИЯМИ, а не ссылается в старый чат
    let mut res = db
        .query(format!(
            "SELECT parent_id FROM chat_messages WHERE chat_id = chats:`{new_key}` AND role = 'assistant'"
        ))
        .await
        .unwrap();
    let rows: Vec<Value> = res.take(0).unwrap();
    let parent = rows[0]["parent_id"].as_str().unwrap_or("");
    assert!(
        !parent.is_empty() && !parent.contains("m_child") && parent.starts_with("chat_messages:"),
        "потомок должен ссылаться на копию корня в новом чате, получено: {parent}"
    );
}

#[tokio::test]
async fn fork_from_earliest_message_copies_only_up_to_target() {
    let db = create_test_db().await;
    seed_chat(&db).await;

    // Форк от САМОГО РАННЕГО сообщения: копируется только оно (created_at <= target)
    let new_chat = fork_chat_impl(&db, "p_chop", "chat_messages:m_root", "Точка ветвления в начале")
        .await
        .expect("fork from root");
    let new_key = new_chat["id"].as_str().unwrap().trim_start_matches("chats:").to_string();

    assert_eq!(
        count_msgs(&db, &format!("chats:`{new_key}`")).await,
        1,
        "форк от корня копирует только сообщения до корня (его самого)"
    );
}
#[tokio::test]
async fn fork_nonexistent_message_returns_err() {
    let db = create_test_db().await;
    seed_chat(&db).await;

    let res = fork_chat_impl(&db, "p_chop", "chat_messages:nope", "Никогда").await;
    assert!(res.is_err());
    assert_eq!(res.unwrap_err(), "Message not found");
}

#[tokio::test]
async fn fork_accepts_bare_and_prefixed_message_ids() {
    let db = create_test_db().await;
    seed_chat(&db).await;

    // Без префикса таблицы — тоже работает (нормализация внутри)
    let res = fork_chat_impl(&db, "projects:p_chop", "m_root", "Форк по голому id").await;
    assert!(res.is_ok());
}

// ---------- update_chat_parent_impl ----------

#[tokio::test]
async fn update_parent_reparents_chat_in_tree() {
    let db = create_test_db().await;
    seed_chat(&db).await;

    db.query(
        "CREATE chats:c_parent SET project_id = type::record('projects','p_chop'), \
         title = 'Родительский', session_context = []",
    )
    .await
    .unwrap();

    update_chat_parent_impl(&db, "chats:c_main", Some("chats:c_parent"))
        .await
        .expect("reparent");

    let mut res = db
        .query("SELECT in FROM contains WHERE out = type::record('chats:c_main')")
        .await
        .unwrap();
    let edges: Vec<Value> = res.take(0).unwrap();
    assert_eq!(edges.len(), 1);
    assert_eq!(edges[0]["in"], "chats:c_parent");

    // Открепление на корень удаляет ребро
    update_chat_parent_impl(&db, "chats:c_main", None)
        .await
        .expect("detach");
    let mut res2 = db
        .query("SELECT in FROM contains WHERE out = type::record('chats:c_main')")
        .await
        .unwrap();
    let edges2: Vec<Value> = res2.take(0).unwrap();
    assert!(edges2.is_empty(), "после открепления рёбер быть не должно");

    // Документируем: цикл parent→child сейчас НЕ валидируется (RELATE пройдёт)
    update_chat_parent_impl(&db, "chats:c_main", Some("chats:c_main"))
        .await
        .expect("цикл не проверяется — известное ограничение");
}

// ---------- delete_chat_message_impl ----------

#[tokio::test]
async fn delete_message_removes_row_and_is_idempotent_on_missing() {
    let db = create_test_db().await;
    seed_chat(&db).await;

    delete_chat_message_impl(&db, "chat_messages:m_child")
        .await
        .expect("delete message");
    assert_eq!(count_msgs(&db, "chats:c_main").await, 1);

    delete_chat_message_impl(&db, "chat_messages:m_child")
        .await
        .expect("repeat delete is Ok");
}
// ---------- switch_message_variant_impl ----------

#[tokio::test]
async fn switch_variant_activates_target_and_deactivates_siblings() {
    let db = create_test_db().await;
    seed_chat(&db).await;

    // Второй вариант корневого сообщения (sibling: parent_id = NONE)
    db.query(
        "CREATE chat_messages:m_variant SET chat_id = chats:c_main, \
         project_id = type::record('projects','p_chop'), role = 'user', \
         content = 'Альтернативная формулировка', version = 1, parent_id = NONE, \
         is_active = false, created_at = time::now() - 30s",
    )
    .await
    .unwrap();

    switch_message_variant_impl(&db, "chat_messages:m_variant")
        .await
        .expect("switch");

    // Активным должен остаться ровно один sibling из двух
    let mut res = db
        .query("SELECT VALUE is_active FROM chat_messages WHERE chat_id = chats:c_main AND parent_id = NONE")
        .await
        .unwrap();
    let flags: Vec<bool> = res.take(0).unwrap();
    assert_eq!(
        flags.iter().filter(|&&a| a).count(),
        1,
        "активен ровно один sibling: {flags:?}"
    );

    // Целевое сообщение активно
    let mut r2 = db
        .query("SELECT VALUE is_active FROM chat_messages:m_variant")
        .await
        .unwrap();
    let v_flag: Option<bool> = r2.take(0).unwrap();
    assert_eq!(v_flag, Some(true));
}

// ---------- delete_ai_chat_impl ----------

#[tokio::test]
async fn delete_chat_cascades_messages_and_edges() {
    let db = create_test_db().await;
    seed_chat(&db).await;

    db.query("RELATE projects:p_chop->contains->chats:c_main SET sort_order = 0")
        .await
        .unwrap();

    delete_ai_chat_impl(&db, "chats:c_main").await.expect("delete chat");

    assert_eq!(count_msgs(&db, "chats:c_main").await, 0, "сообщения удалены каскадом");

    let mut e = db
        .query("SELECT * FROM contains WHERE out = type::record('chats:c_main') OR in = type::record('chats:c_main')")
        .await
        .unwrap();
    let edges: Vec<Value> = e.take(0).unwrap();
    assert!(edges.is_empty(), "рёбра чата удалены");

    let mut c = db.query("SELECT * FROM chats:c_main").await.unwrap();
    let chats: Vec<Value> = c.take(0).unwrap();
    assert!(chats.is_empty(), "сам чат удалён");
}

// ---------- send_message_db_core ----------

#[tokio::test]
async fn send_core_autocreates_chat_titled_from_text() {
    let db = create_test_db().await;
    seed_chat(&db).await;

    let res = send_message_db_core(&db, "nonexistent-chat", "p_chop", "Расскажи про падение цитадели ветров")
        .await
        .expect("send core");

    // Чат автосоздан с заголовком из первых 40 символов текста
    assert!(res.chat_id.starts_with("chats:"), "новый chat_id нормализован");
    let new_key = res.chat_id.trim_start_matches("chats:");
    let mut r = db.query(format!("SELECT title FROM chats:`{new_key}`")).await.unwrap();
    let rows: Vec<Value> = r.take(0).unwrap();
    assert_eq!(rows[0]["title"], "Расскажи про падение цитадели ветров");

    // Пара сообщений создана: user → assistant-заглушка
    let user_key = res.user_msg_id.trim_start_matches("chat_messages:");
    let asst_key = res.assistant_msg_id.trim_start_matches("chat_messages:");

    let mut u = db.query(format!("SELECT role, content, parent_id FROM chat_messages:`{user_key}`")).await.unwrap();
    let u_rows: Vec<Value> = u.take(0).unwrap();
    assert_eq!(u_rows[0]["role"], "user");
    assert!(u_rows[0]["parent_id"].is_null(), "первое сообщение в новом чате — без родителя");

    let mut a = db.query(format!("SELECT role, content, parent_id FROM chat_messages:`{asst_key}`")).await.unwrap();
    let a_rows: Vec<Value> = a.take(0).unwrap();
    assert_eq!(a_rows[0]["role"], "assistant");
    assert_eq!(a_rows[0]["content"], "", "заглушка ассистента пуста до генерации");
    assert!(
        a_rows[0]["parent_id"].as_str().unwrap_or("").contains(user_key),
        "assistant должен ссылаться на user-сообщение"
    );
}

#[tokio::test]
async fn send_core_existing_chat_chains_after_last_message() {
    let db = create_test_db().await;
    seed_chat(&db).await;

    let before = count_msgs(&db, "chats:c_main").await;

    let res = send_message_db_core(&db, "chats:c_main", "projects:p_chop", "Продолжаем диалог")
        .await
        .expect("send core to existing chat");
    assert_eq!(res.chat_id, "chats:c_main", "существующий чат не пересоздаётся");

    assert_eq!(count_msgs(&db, "chats:c_main").await, before + 2);

    // Новый user-пост прицеплен к последнему на момент отправки (m_child)
    let user_key = res.user_msg_id.trim_start_matches("chat_messages:");
    let mut r = db.query(format!("SELECT parent_id FROM chat_messages:`{user_key}`")).await.unwrap();
    let rows: Vec<Value> = r.take(0).unwrap();
    assert!(
        rows[0]["parent_id"].as_str().unwrap_or("").contains("m_child"),
        "цепочка продолжается от последнего сообщения"
    );
}

// ---------- edit_message_db_core ----------

#[tokio::test]
async fn edit_core_deactivates_siblings_and_creates_new_branch() {
    let db = create_test_db().await;
    seed_chat(&db).await;

    let res = edit_message_db_core(&db, "chat_messages:m_root", "Исправленный вопрос", "chats:c_main", "p_chop")
        .await
        .expect("edit core");

    // Старое корневое сообщение деактивировано (sibling с parent_id = NONE)
    let mut old = db.query("SELECT VALUE is_active FROM chat_messages:m_root").await.unwrap();
    let old_active: Option<bool> = old.take(0).unwrap();
    assert_eq!(old_active, Some(false), "старая версия должна уйти в inactive");

    // Новая пара создана, user содержит новый текст и висит на том же parent (NONE)
    let user_key = res.user_msg_id.trim_start_matches("chat_messages:");
    let mut u = db.query(format!("SELECT is_active, content, parent_id FROM chat_messages:`{user_key}`")).await.unwrap();
    let u_rows: Vec<Value> = u.take(0).unwrap();
    assert_eq!(u_rows[0]["is_active"], true);
    assert_eq!(u_rows[0]["content"], "Исправленный вопрос");
    assert!(u_rows[0]["parent_id"].is_null());
}

// ---------- regenerate_variant_db_core ----------

#[tokio::test]
async fn regenerate_core_deactivates_old_variants_and_makes_new_one() {
    let db = create_test_db().await;
    seed_chat(&db).await;

    // Старый ответ ассистента на m_child... но регенерим от USER-сообщения.
    // Возьмём цепочку: регенерим варианты ответа для корневого user-сообщения,
    // для чего сначала добавим ему assistant-ребёнка.
    db.query(
        "CREATE chat_messages:m_ans1 SET chat_id = chats:c_main, \
         project_id = type::record('projects','p_chop'), role = 'assistant', \
         content = 'Старый ответ', version = 1, parent_id = chat_messages:m_root, \
         is_active = true, created_at = time::now() - 90s",
    )
    .await
    .unwrap();

    let (new_uuid, user_text) = regenerate_variant_db_core(&db, "chat_messages:m_root", "chats:c_main", "p_chop")
        .await
        .expect("regenerate core");

    assert_eq!(user_text, "Вопрос из корня", "текст берётся из родительского user-сообщения");

    // Старый вариант деактивирован
    let mut old = db.query("SELECT VALUE is_active FROM chat_messages:m_ans1").await.unwrap();
    let old_active: Option<bool> = old.take(0).unwrap();
    assert_eq!(old_active, Some(false));

    // Новая заглушка активна и висит на том же родителе
    let mut nw = db.query(format!("SELECT is_active, content, parent_id FROM chat_messages:`{new_uuid}`")).await.unwrap();
    let n_rows: Vec<Value> = nw.take(0).unwrap();
    assert_eq!(n_rows[0]["is_active"], true);
    assert_eq!(n_rows[0]["content"], "");
    assert!(n_rows[0]["parent_id"].as_str().unwrap_or("").contains("m_root"));
}

#[tokio::test]
async fn regenerate_core_missing_or_empty_user_msg_errs() {
    let db = create_test_db().await;
    seed_chat(&db).await;

    let res = regenerate_variant_db_core(&db, "chat_messages:nope", "chats:c_main", "p_chop").await;
    assert!(res.is_err());
    assert!(res.unwrap_err().contains("not found or empty"));
}