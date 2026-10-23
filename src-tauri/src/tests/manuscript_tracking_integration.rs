//! Интеграционные тесты манускрипта, сюжетных арок, хронологического окна и графа связей.
//!
//! Полное покрытие функционала:
//! 1. Иерархия манускрипта и трекинг арок/сцен (флэшбеки и двойная ось):
//! ```text
//!    ├── [Арка: Грех и падение]
//!    │   ├── сцена 1 [читатель: гл.1] [хронология: день 3]
//!    │   └── сцена 4 [читатель: гл.2] [хронология: день 1] ← флэшбек!
//!    ├── [Арка: Искупление]
//!    │   ├── сцена 7 [читатель: гл.5] [хронология: день 10]
//!    │   └── сцена 12 [читатель: гл.8] [хронология: день 15]
//!    └── [Без арки]
//!        └── сцена 2 [читатель: гл.1] [хронология: день 2]
//! ```
//! 2. Хронологическое окно (Timeline Inspector & Reveals / `fn::get_timeline_inspector_data`).
//! 3. Временной срез графа связей («Паутина» / `fn::get_graph_time_slice` / `fn::get_entity_connections`).
//! 4. Путь персонажа и матрица участий (`fn::get_character_journey` / `fn::get_cross_reference_matrix`).
//! 5. Детектор противоречий (`ConsistencyAuditWorkflow` / смерть, анахронизм, билокация).
//! 6. Авто-синхронизация упоминаний (`fn::sync_chapter_mentions` & изоляция источников).
//! 7. Гранулярные сцены и жизненный цикл обещаний (`kind='scene'`, `block_id`, `status: planted -> resolved`).
//! 8. Статистика и метрики рукописи (`ManuscriptAnalyticsService`).
//! 9. Каскадная целостность событий DDL (`03_events.surql`).
//! 10. Негативные пути валидации и ограничения схемы (ASSERT, валидация полей).
//! 11. Граничные случаи и пустые данные (Empty Project & Missing References).
//! 12. Межпроектная изоляция и безопасность синка упоминаний.
//! 13. Граничные случаи аудита противоречий (Consistency Audit Clean & Edge Cases).

use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::collections::HashMap;
use std::sync::Arc;
use surrealdb::engine::local::Db;
use surrealdb::Surreal;

use super::common::{create_test_db, create_test_services, seed_project};
use worldwiki_domain::plot::{ArcStatus, ArcType, StoryArc};

/// Структура сцены для проверки двухосевого порядка и детекции флэшбеков
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ManuscriptSceneItem {
    pub id: String,
    pub quote: String,
    pub chapter_id: String,
    pub chapter_title: String,
    pub chapter_order: i32,
    pub m_abs: i64,
    pub arc_id: Option<String>,
    pub arc_title: Option<String>,
    pub is_flashback: bool,
}

/// Создаёт главу с явным sort_order
async fn create_test_chapter(
    db: &Surreal<Db>,
    project_key: &str,
    chapter_id: &str,
    title: &str,
    sort_order: i32,
) -> String {
    let proj_raw = project_key.strip_prefix("projects:").unwrap_or(project_key);
    let chap_raw = chapter_id.strip_prefix("chapters:").unwrap_or(chapter_id);

    let sql = "UPSERT type::record('chapters', $cid) SET project_id = type::record('projects', $pid), title = $title, content = '', sort_order = $order, word_count = 1500";
    let mut res = db
        .query(sql)
        .bind(("cid", chap_raw))
        .bind(("pid", proj_raw))
        .bind(("title", title))
        .bind(("order", sort_order))
        .await
        .expect("create chapter should run");

    let errs = res.take_errors();
    assert!(errs.is_empty(), "chapter insert errors: {:?}", errs);
    format!("chapters:{}", chap_raw)
}

/// Создаёт сущность лора
async fn create_test_entity(
    db: &Surreal<Db>,
    project_key: &str,
    entity_id: &str,
    name: &str,
    entity_type: &str,
) -> String {
    create_test_entity_with_attrs(db, project_key, entity_id, name, entity_type, serde_json::json!({})).await
}

/// Создаёт сущность лора с атрибутами
async fn create_test_entity_with_attrs(
    db: &Surreal<Db>,
    project_key: &str,
    entity_id: &str,
    name: &str,
    entity_type: &str,
    attrs: serde_json::Value,
) -> String {
    let proj_raw = project_key.strip_prefix("projects:").unwrap_or(project_key);
    let ent_raw = entity_id.strip_prefix("entities:").unwrap_or(entity_id);

    let sql = r#"
        LET $p_rec = type::record('projects', $pid);
        LET $schema_res = (SELECT VALUE id FROM entity_schemas WHERE project_id = $p_rec AND type_key = $etype LIMIT 1);
        LET $schema_id = IF array::len($schema_res) > 0 {
            $schema_res[0]
        } ELSE {
            (CREATE entity_schemas SET
                project_id = $p_rec,
                type_key = $etype,
                type_name = $etype,
                icon = 'box',
                color = 'var(--text-accent)'
            )[0].id
        };
        UPSERT type::record('entities', $eid) SET 
            project_id = $p_rec, 
            schema_id = $schema_id, 
            name = $name, 
            attributes = $attrs;
    "#;
    let mut res = db
        .query(sql)
        .bind(("eid", ent_raw))
        .bind(("pid", proj_raw))
        .bind(("name", name))
        .bind(("etype", entity_type))
        .bind(("attrs", attrs))
        .await
        .expect("create entity should run");

    let errs = res.take_errors();
    assert!(errs.is_empty(), "entity insert errors: {:?}", errs);
    format!("entities:{}", ent_raw)
}

/// Создаёт событие таймлайна с абсолютной минутой (Золотой эталон M_abs)
async fn create_timeline_event(
    db: &Surreal<Db>,
    project_key: &str,
    event_id: &str,
    title: &str,
    day: i64,
) -> String {
    let proj_raw = project_key.strip_prefix("projects:").unwrap_or(project_key);
    let ev_raw = event_id
        .strip_prefix("timeline_events:")
        .unwrap_or(event_id);
    let m_abs = day * 1440; // 1 день = 1440 минут

    let cal_sql = "UPSERT type::record('calendars', 'default') SET project_id = type::record('projects', $pid), name = 'Standard Solar', is_default = true";
    let _ = db.query(cal_sql).bind(("pid", proj_raw)).await;

    let sql = "UPSERT type::record('timeline_events', $eid) SET project_id = type::record('projects', $pid), calendar_id = type::record('calendars', 'default'), title = $title, m_abs = $m_abs";
    let mut res = db
        .query(sql)
        .bind(("eid", ev_raw))
        .bind(("pid", proj_raw))
        .bind(("title", title))
        .bind(("m_abs", m_abs))
        .await
        .expect("create timeline event should run");

    let errs = res.take_errors();
    assert!(errs.is_empty(), "timeline event insert errors: {:?}", errs);
    format!("timeline_events:{}", ev_raw)
}

/// Создаёт сюжетное обещание / сцену в манускрипте
#[allow(clippy::too_many_arguments)]
async fn create_scene_promise(
    db: &Surreal<Db>,
    project_key: &str,
    promise_id: &str,
    chapter_id: &str,
    quote: &str,
    timeline_event_id: Option<&str>,
    arc_id: Option<&str>,
    participant_ids: Option<Vec<&str>>,
    paragraph_index: i32,
) -> String {
    let proj_raw = project_key.strip_prefix("projects:").unwrap_or(project_key);
    let prom_raw = promise_id
        .strip_prefix("plot_promises:")
        .unwrap_or(promise_id);
    let chap_raw = chapter_id.strip_prefix("chapters:").unwrap_or(chapter_id);

    let sql = r#"
        LET $p_rec = type::record('projects', $pid);
        LET $c_rec = type::record('chapters', $cid);
        LET $prom_rec = type::record('plot_promises', $id);
        LET $tb_rec = type::record('text_blocks', $id);

        UPSERT $prom_rec SET
            project_id = $p_rec,
            kind = 'scene',
            title = $quote,
            status = 'planted',
            timeline_event_id = IF $tid != NONE { type::record('timeline_events', $tid) } ELSE { NONE },
            m_abs = IF $tid != NONE { (SELECT VALUE m_abs FROM ONLY type::record('timeline_events', $tid)) } ELSE { NONE };

        UPSERT $tb_rec SET
            project_id = $p_rec,
            chapter_id = $c_rec,
            order_index = $p_idx,
            content = $quote;

        RELATE $prom_rec -> promise_milestones -> $tb_rec SET
            project_id = $p_rec,
            stage = 'plant',
            quote = $quote;

        IF $aid != NONE {
            RELATE $prom_rec -> advances_arc -> (type::record('story_arcs', $aid)) SET
                project_id = $p_rec,
                phase = 'setup';
        };

        IF $tid != NONE {
            RELATE $prom_rec -> occurs_at -> (type::record('timeline_events', $tid)) SET
                project_id = $p_rec,
                time_nature = 'present';
        };
    "#;

    let tid_opt = timeline_event_id.map(|t| t.strip_prefix("timeline_events:").unwrap_or(t));
    let aid_opt = arc_id.map(|a| a.strip_prefix("story_arcs:").unwrap_or(a));

    let mut res = db
        .query(sql)
        .bind(("id", prom_raw))
        .bind(("pid", proj_raw))
        .bind(("cid", chap_raw))
        .bind(("quote", quote))
        .bind(("p_idx", paragraph_index))
        .bind(("tid", tid_opt))
        .bind(("aid", aid_opt))
        .await
        .expect("create scene promise should run");

    let errs = res.take_errors();
    assert!(errs.is_empty(), "scene promise insert errors: {:?}", errs);

    if let Some(parts) = participant_ids {
        for part in parts {
            let ent_raw = part.strip_prefix("entities:").unwrap_or(part);
            let part_sql = r#"
                LET $p_rec = type::record('projects', $pid);
                LET $e_rec = type::record('entities', $eid);
                LET $prom_rec = type::record('plot_promises', $id);
                RELATE $e_rec -> participant_of -> $prom_rec SET project_id = $p_rec, role = 'main';
            "#;
            let _ = db.query(part_sql)
                .bind(("pid", proj_raw))
                .bind(("eid", ent_raw))
                .bind(("id", prom_raw))
                .await;
        }
    }

    format!("plot_promises:{}", prom_raw)
}

/// Алгоритм детекции флэшбеков и двойной сортировки
fn process_scenes_and_detect_flashbacks(
    mut scenes: Vec<ManuscriptSceneItem>,
    view_mode: &str,
) -> Vec<ManuscriptSceneItem> {
    if view_mode == "CHRONOLOGY" {
        scenes.sort_by_key(|s| s.m_abs);
    } else {
        // NARRATIVE: По порядку глав для читателя, затем по положению в главе
        scenes.sort_by_key(|s| s.chapter_order);
    }

    let mut last_seen_mabs: Option<i64> = None;
    scenes
        .into_iter()
        .map(|mut s| {
            if let Some(prev) = last_seen_mabs
                && s.m_abs < prev {
                    s.is_flashback = true;
                }
            last_seen_mabs = Some(s.m_abs);
            s
        })
        .collect()
}

/// ТЕСТ 1: Иерархия манускрипта, сторилайны и детекция флэшбеков
#[tokio::test]
async fn test_manuscript_story_arcs_and_flashback_tracking() {
    let db = create_test_db().await;
    let proj_key = "proj_manuscript";
    seed_project(&db, proj_key, "Хроники Мира: Манускрипт").await;

    // 1. Создаем главы манускрипта в порядке чтения
    let ch1 = create_test_chapter(&db, proj_key, "ch1", "Глава 1: Пробуждение", 1).await;
    let ch2 = create_test_chapter(&db, proj_key, "ch2", "Глава 2: Тайны прошлого", 2).await;
    let ch5 = create_test_chapter(&db, proj_key, "ch5", "Глава 5: Испытание огнем", 5).await;
    let ch8 = create_test_chapter(&db, proj_key, "ch8", "Глава 8: Рассвет надежды", 8).await;

    // 2. Создаем сюжетные арки через доменный репозиторий / сервисы
    let services = create_test_services(Arc::new(db.clone()));

    let mut arc_sin = StoryArc::new(
        format!("projects:{proj_key}"),
        "Грех и падение",
        ArcType::Theme,
    );
    arc_sin.id = "story_arcs:sin_and_fall".to_string();
    arc_sin.status = ArcStatus::InProgress;
    arc_sin.color = Some("#ff4444".to_string());
    services
        .story_arcs
        .repo
        .save(&arc_sin)
        .await
        .expect("save arc_sin");

    let mut arc_redemption = StoryArc::new(
        format!("projects:{proj_key}"),
        "Искупление",
        ArcType::Character,
    );
    arc_redemption.id = "story_arcs:redemption".to_string();
    arc_redemption.status = ArcStatus::Planned;
    arc_redemption.color = Some("#44ff44".to_string());
    services
        .story_arcs
        .repo
        .save(&arc_redemption)
        .await
        .expect("save arc_redemption");

    // 3. Создаем события таймлайна (абсолютные дни)
    let ev_day1 =
        create_timeline_event(&db, proj_key, "ev_day1", "День 1: Предательство в тени", 1).await;
    let ev_day2 =
        create_timeline_event(&db, proj_key, "ev_day2", "День 2: Встреча у фонтана", 2).await;
    let ev_day3 =
        create_timeline_event(&db, proj_key, "ev_day3", "День 3: Падение крепости", 3).await;
    let ev_day10 =
        create_timeline_event(&db, proj_key, "ev_day10", "День 10: Покаяние в пустыне", 10).await;
    let ev_day15 =
        create_timeline_event(&db, proj_key, "ev_day15", "День 15: Финальная битва", 15).await;

    // 4. Засеиваем сцены в точности по структуре:
    // [Арка: Грех и падение]
    // ├── сцена 1 [читатель: гл.1] [хронология: день 3]
    let _sc1 = create_scene_promise(
        &db,
        proj_key,
        "scene_1",
        &ch1,
        "Сцена 1: Падение стен крепости",
        Some(&ev_day3),
        Some(&arc_sin.id),
        None,
        1,
    )
    .await;

    // └── сцена 4 [читатель: гл.2] [хронология: день 1] ← флэшбек!
    let _sc4 = create_scene_promise(
        &db,
        proj_key,
        "scene_4",
        &ch2,
        "Сцена 4: Предательство, с которого все началось",
        Some(&ev_day1),
        Some(&arc_sin.id),
        None,
        1,
    )
    .await;

    // [Арка: Искупление]
    // ├── сцена 7 [читатель: гл.5] [хронология: день 10]
    let _sc7 = create_scene_promise(
        &db,
        proj_key,
        "scene_7",
        &ch5,
        "Сцена 7: Клятва на руинах",
        Some(&ev_day10),
        Some(&arc_redemption.id),
        None,
        1,
    )
    .await;

    // └── сцена 12 [читатель: гл.8] [хронология: день 15]
    let _sc12 = create_scene_promise(
        &db,
        proj_key,
        "scene_12",
        &ch8,
        "Сцена 12: Восхождение нового короля",
        Some(&ev_day15),
        Some(&arc_redemption.id),
        None,
        1,
    )
    .await;

    // [Без арки]
    // └── сцена 2 [читатель: гл.1] [хронология: день 2]
    let _sc2 = create_scene_promise(
        &db,
        proj_key,
        "scene_2",
        &ch1,
        "Сцена 2: Случайный разговор в таверне",
        Some(&ev_day2),
        None,
        None,
        2,
    )
    .await;

    // 5. Выборка через SurrealQL с резолвингом реляций нарративного хаба
    let mut res = db
        .query(
            r#"
        SELECT 
            type::string(id) AS id,
            title AS quote,
            type::string(array::first(->promise_milestones.out.chapter_id)) AS chapter_id,
            array::first(->promise_milestones.out.chapter_id.title) AS chapter_title,
            array::first(->promise_milestones.out.chapter_id.sort_order) AS chapter_order,
            m_abs,
            type::string(array::first(->advances_arc.out.id)) AS arc_id,
            array::first(->advances_arc.out.title) AS arc_title
        FROM plot_promises
        WHERE project_id = type::record('projects', $pid)
    "#,
        )
        .bind(("pid", proj_key))
        .await
        .expect("fetch scenes query");

    let raw_scenes: Vec<Value> = res.take(0).expect("take raw scenes");
    assert_eq!(raw_scenes.len(), 5, "Всего должно быть 5 сцен");

    let scenes: Vec<ManuscriptSceneItem> = raw_scenes
        .into_iter()
        .map(|v| ManuscriptSceneItem {
            id: v["id"].as_str().unwrap_or_default().to_string(),
            quote: v["quote"].as_str().unwrap_or_default().to_string(),
            chapter_id: v["chapter_id"].as_str().unwrap_or_default().to_string(),
            chapter_title: v["chapter_title"].as_str().unwrap_or_default().to_string(),
            chapter_order: v["chapter_order"].as_i64().unwrap_or(0) as i32,
            m_abs: v["m_abs"].as_i64().unwrap_or(0),
            arc_id: v["arc_id"].as_str().map(|s| s.to_string()),
            arc_title: v["arc_title"].as_str().map(|s| s.to_string()),
            is_flashback: false,
        })
        .collect();

    // 6. Проверяем режим повествования (NARRATIVE / Порядок для читателя) и ДЕТЕКЦИЮ ФЛЭШБЕКА
    let narrative_scenes = process_scenes_and_detect_flashbacks(scenes.clone(), "NARRATIVE");

    let s_sc4 = narrative_scenes
        .iter()
        .find(|s| s.quote.contains("Сцена 4"))
        .expect("scene 4");
    assert!(
        s_sc4.is_flashback,
        "Сцена 4 обязана быть распознана как ФЛЭШБЕК (день 1 после дня 3)"
    );
    assert_eq!(
        s_sc4.chapter_order, 2,
        "Сцена 4 находится во 2 главе для читателя"
    );
    assert_eq!(
        s_sc4.m_abs, 1440,
        "Сцена 4 относится к 1 дню хронологии (1440 мин)"
    );

    let s_sc12 = narrative_scenes
        .iter()
        .find(|s| s.quote.contains("Сцена 12"))
        .expect("scene 12");
    assert!(
        !s_sc12.is_flashback,
        "Сцена 12 идет вперед по времени (день 15), это не флэшбек"
    );

    // 7. Проверяем группировку по сюжетным аркам
    let mut arc_groups: HashMap<String, Vec<&ManuscriptSceneItem>> = HashMap::new();
    for s in &narrative_scenes {
        let key = s
            .arc_title
            .clone()
            .unwrap_or_else(|| "Без арки".to_string());
        arc_groups.entry(key).or_default().push(s);
    }

    assert_eq!(
        arc_groups["Грех и падение"].len(),
        2,
        "Арка 'Грех и падение' содержит ровно 2 сцены"
    );
    assert_eq!(
        arc_groups["Искупление"].len(),
        2,
        "Арка 'Искупление' содержит ровно 2 сцены"
    );
    assert_eq!(
        arc_groups["Без арки"].len(),
        1,
        "Группа 'Без арки' содержит ровно 1 сцену"
    );

    // 8. Проверяем хронологический порядок (CHRONOLOGY)
    let chrono_scenes = process_scenes_and_detect_flashbacks(scenes, "CHRONOLOGY");
    assert_eq!(
        chrono_scenes[0].quote, "Сцена 4: Предательство, с которого все началось",
        "Первой в хронологии идет сцена 4 (день 1)"
    );
    assert_eq!(
        chrono_scenes[1].quote, "Сцена 2: Случайный разговор в таверне",
        "Второй в хронологии идет сцена 2 (день 2)"
    );
    assert_eq!(
        chrono_scenes[2].quote, "Сцена 1: Падение стен крепости",
        "Третьей в хронологии идет сцена 1 (день 3)"
    );
    assert_eq!(
        chrono_scenes[3].quote, "Сцена 7: Клятва на руинах",
        "Четвертой идет сцена 7 (день 10)"
    );
    assert_eq!(
        chrono_scenes[4].quote, "Сцена 12: Восхождение нового короля",
        "Пятой идет сцена 12 (день 15)"
    );

    // 9. Проверяем связь арок с главами через нарративные узлы
    let arc_chaps = services
        .story_arcs
        .list_chapters_for_arc(&arc_sin.id)
        .await
        .expect("get arc chapters");
    assert_eq!(arc_chaps.len(), 2, "Арка связана с 2 главами через нарративный хаб");
}

/// ТЕСТ 2: Хронологическое окно и раскрытие событий (fn::get_timeline_inspector_data)
#[tokio::test]
async fn test_timeline_inspector_dual_axis_and_reveals() {
    let db = create_test_db().await;
    let proj_key = "proj_inspector";
    seed_project(&db, proj_key, "Хронологический проект").await;

    let _ch1 = create_test_chapter(&db, proj_key, "ch1", "Глава 1: Пролог", 1).await;
    let _ch3 = create_test_chapter(&db, proj_key, "ch3", "Глава 3: Воспоминание", 3).await;

    let _hero = create_test_entity(&db, proj_key, "hero", "Главный Герой", "character").await;

    // Создаем событие
    let _ev_past =
        create_timeline_event(&db, proj_key, "ev_past", "Тайная дуэль в прошлом", 1).await;

    // Привязываем раскрытие события в главе 3 через ребро revealed_in (флэшбек)
    let rev_sql = "RELATE (type::record('timeline_events', $ev)) -> revealed_in -> (type::record('chapters', $ch)) SET project_id = type::record('projects', $p), kind = 'flashback', pov_id = type::record('entities', $hero)";
    let mut rev_res = db
        .query(rev_sql)
        .bind(("ev", "ev_past"))
        .bind(("ch", "ch3"))
        .bind(("p", proj_key))
        .bind(("hero", "hero"))
        .await
        .expect("relate revealed_in");
    assert!(rev_res.take_errors().is_empty());

    // Привязываем участие героя в событии через participates_in
    let part_sql = "RELATE (type::record('entities', $hero)) -> participates_in -> (type::record('timeline_events', $ev)) SET project_id = type::record('projects', $p), role = 'duelist'";
    let mut part_res = db
        .query(part_sql)
        .bind(("hero", "hero"))
        .bind(("ev", "ev_past"))
        .bind(("p", proj_key))
        .await
        .expect("relate participates_in");
    assert!(part_res.take_errors().is_empty());

    // Вызываем хранимую функцию fn::get_timeline_inspector_data
    let mut func_res = db
        .query("RETURN fn::get_timeline_inspector_data(type::record('projects', $p));")
        .bind(("p", proj_key))
        .await
        .expect("call fn::get_timeline_inspector_data");

    let inspector_data: Option<Value> = func_res.take(0).expect("take inspector data");
    let data = inspector_data.expect("data must not be null");

    let events = data["events"].as_array().expect("events array");
    let chapters = data["chapters"].as_array().expect("chapters array");

    assert_eq!(chapters.len(), 2, "Должно вернуться 2 главы");
    assert_eq!(events.len(), 1, "Должно вернуться 1 событие таймлайна");

    let ev = &events[0];
    assert_eq!(ev["title"], "Тайная дуэль в прошлом");
    assert_eq!(ev["m_abs"], 1440);

    let reveals = ev["reveals"].as_array().expect("reveals array");
    assert_eq!(reveals.len(), 1, "Событие должно иметь 1 раскрытие в главе");
    assert_eq!(reveals[0]["kind"], "flashback");
    assert_eq!(reveals[0]["chapter_order"], 3);

    let participants = ev["participants"].as_array().expect("participants array");
    assert_eq!(participants.len(), 1, "Событие должно иметь 1 участника");
    assert_eq!(participants[0]["name"], "Главный Герой");
}

/// ТЕСТ 3: Временной срез графа связей («Паутина» / fn::get_graph_time_slice)
#[tokio::test]
async fn test_graph_time_slice_and_inferred_chronology() {
    let db = create_test_db().await;
    let proj_key = "proj_graph";
    seed_project(&db, proj_key, "Графовый проект").await;

    let _ch1 = create_test_chapter(&db, proj_key, "ch1", "Глава 1: Знакомство", 1).await;
    let _ch4 = create_test_chapter(&db, proj_key, "ch4", "Глава 4: Вражда", 4).await;

    let _hero = create_test_entity(&db, proj_key, "hero_a", "Алекс", "character").await;
    let _mentor = create_test_entity(&db, proj_key, "mentor_b", "Борис", "character").await;

    // Создаем связь "mentor" с привязкой к начальной главе ch1
    let rel_sql = r#"
        RELATE (type::record('entities', $from)) -> entity_rel -> (type::record('entities', $to)) CONTENT {
            project_id: type::record('projects', $p),
            rel_type: 'mentor',
            description: 'Обучает древней магии',
            strength: 80,
            start_chapter: type::record('chapters', $ch_start),
            end_chapter: type::record('chapters', $ch_end),
            attributes: { start_m_abs: 1440, end_m_abs: 5760 },
            created_at: time::now()
        }
    "#;

    let mut rel_res = db
        .query(rel_sql)
        .bind(("from", "hero_a"))
        .bind(("to", "mentor_b"))
        .bind(("p", proj_key))
        .bind(("ch_start", "ch1"))
        .bind(("ch_end", "ch4"))
        .await
        .expect("create entity_rel");
    assert!(rel_res.take_errors().is_empty());

    // Вызываем хранимую функцию fn::get_graph_time_slice
    let mut func_res = db
        .query("RETURN fn::get_graph_time_slice(type::record('projects', $p));")
        .bind(("p", proj_key))
        .await
        .expect("call fn::get_graph_time_slice");

    let slice_data: Option<Value> = func_res.take(0).expect("take slice data");
    let slice = slice_data.expect("slice must not be null");

    let nodes = slice["nodes"].as_array().expect("nodes array");
    let edges = slice["edges"].as_array().expect("edges array");

    assert_eq!(nodes.len(), 2, "Должно быть 2 узла персонажей");
    assert_eq!(edges.len(), 1, "Должно быть 1 ребро связи");

    let edge = &edges[0];
    assert_eq!(edge["rel_type"], "mentor");
    assert_eq!(edge["strength"], 80);
    assert_eq!(edge["start_order"], 1);
    assert_eq!(edge["inferred_start_m_abs"], 1440);
}

/// ТЕСТ 4: Путь персонажа и матрица участий (fn::get_character_journey & fn::get_cross_reference_matrix)
#[tokio::test]
async fn test_character_journey_and_cross_reference_matrix() {
    let db = create_test_db().await;
    let proj_key = "proj_matrix";
    seed_project(&db, proj_key, "Матричный проект").await;

    let _ch1 = create_test_chapter(&db, proj_key, "ch1", "Глава 1: Начало", 1).await;
    let _ch2 = create_test_chapter(&db, proj_key, "ch2", "Глава 2: Развитие", 2).await;

    let _hero = create_test_entity(&db, proj_key, "hero", "Герой", "character").await;

    // Ребро появления appears_in
    let app_sql = "RELATE (type::record('entities', $hero)) -> appears_in -> (type::record('chapters', $ch)) SET project_id = type::record('projects', $p), role = 'main', source = 'manual'";
    let mut app_res = db
        .query(app_sql)
        .bind(("hero", "hero"))
        .bind(("ch", "ch1"))
        .bind(("p", proj_key))
        .await
        .expect("create appears_in");
    assert!(app_res.take_errors().is_empty());

    // Вызываем матрицу участий fn::get_cross_reference_matrix
    let mut mat_res = db
        .query("RETURN fn::get_cross_reference_matrix(type::record('projects', $p));")
        .bind(("p", proj_key))
        .await
        .expect("call fn::get_cross_reference_matrix");

    let mat_data: Option<Value> = mat_res.take(0).expect("take matrix data");
    let matrix = mat_data.expect("matrix must not be null");

    let chapters = matrix["chapters"].as_array().expect("chapters array");
    let entities = matrix["entities"].as_array().expect("entities array");

    assert_eq!(chapters.len(), 2, "2 главы в матрице");
    assert_eq!(entities.len(), 1, "1 сущность в матрице до добавления сцены");
    // Создаем нарративный блок/сцену в главе 2 с участником "hero"
    let _scene = create_scene_promise(
        &db,
        proj_key,
        "scene_matrix",
        "ch2",
        "Встреча у реки",
        None,
        None,
        Some(vec!["hero"]),
        1,
    )
    .await;

    // Повторно вызываем матрицу участий fn::get_cross_reference_matrix
    let mut mat_res2 = db
        .query("RETURN fn::get_cross_reference_matrix(type::record('projects', $p));")
        .bind(("p", proj_key))
        .await
        .expect("call fn::get_cross_reference_matrix 2");

    let mat_data2: Option<Value> = mat_res2.take(0).expect("take matrix data 2");
    let matrix2 = mat_data2.expect("matrix2 must not be null");
    let entities2 = matrix2["entities"].as_array().expect("entities array 2");
    let ent2 = &entities2[0];
    let appearances2 = ent2["appearances"].as_array().expect("appearances array 2");
    assert_eq!(appearances2.len(), 2, "Герой должен появляться в 2 главах: через упоминание в гл.1 и через нарративный блок/сцену в гл.2");

    // Вызываем путь персонажа fn::get_character_journey
    let mut journey_res = db
        .query("RETURN fn::get_character_journey(type::record('projects', $p), type::record('entities', $hero));")
        .bind(("p", proj_key))
        .bind(("hero", "hero"))
        .await
        .expect("call fn::get_character_journey");

    let journey_data: Option<Value> = journey_res.take(0).expect("take journey data");
    let journey = journey_data.expect("journey must not be null");

    assert_eq!(journey["appearances"].as_array().unwrap().len(), 2, "Должно быть 2 появления: в гл.1 и в сцене гл.2");
    assert_eq!(journey["events"].as_array().unwrap().len(), 0);
    assert_eq!(journey["promises"].as_array().unwrap().len(), 1, "Сцена должна отразиться в promises пути персонажа");
}

/// ТЕСТ 5: Детектор противоречий (Consistency Checker / ConsistencyAuditWorkflow)
#[tokio::test]
async fn test_manuscript_consistency_audit_rules() {
    let db = create_test_db().await;
    let proj_key = "proj_consistency";
    seed_project(&db, proj_key, "Проект для аудита целостности").await;

    let services = create_test_services(Arc::new(db.clone()));

    // 1. Создаем персонажей: один живой, один погибший в m_abs=1000, один нерожденный (m_abs=5000)
    let _ch1 = create_test_chapter(&db, proj_key, "ch1", "Глава 1", 1).await;
    let _ch2 = create_test_chapter(&db, proj_key, "ch2", "Глава 2", 2).await;

    let _hero_alive = create_test_entity(&db, proj_key, "hero_alive", "Живой Герой", "character").await;

    let _dead = create_test_entity_with_attrs(
        &db,
        proj_key,
        "dead_hero",
        "Погибший Герой",
        "character",
        json!({ "статус_категория": "Мёртв", "is_deceased": true, "death_m_abs": 1000 }),
    ).await;

    let _unborn = create_test_entity_with_attrs(
        &db,
        proj_key,
        "unborn_hero",
        "Нерожденный Герой",
        "character",
        json!({ "дата_рождения": { "m_abs": 5000 }, "birth_m_abs": 5000 }),
    ).await;

    // 2. Создаем событие в m_abs=2880, где участвует погибший герой (Критическая ошибка 🔴)
    let _ev_late = create_timeline_event(&db, proj_key, "ev_late", "Битва после смерти", 2).await; // m_abs = 2880
    let _ = db.query("RELATE (type::record('entities', 'dead_hero')) -> participates_in -> (type::record('timeline_events', $ev)) SET project_id = type::record('projects', $p), role = 'fighter'")
        .bind(("ev", "ev_late"))
        .bind(("p", proj_key))
        .await
        .expect("relate dead hero to late event");

    // Создаем событие в m_abs=1440, где участвует еще не родившийся персонаж (Критическая ошибка 🔴 ActionBeforeBirth)
    let _ = db.query("RELATE (type::record('entities', 'unborn_hero')) -> participates_in -> (type::record('timeline_events', $ev)) SET project_id = type::record('projects', $p), role = 'actor'")
        .bind(("ev", "ev_late"))
        .bind(("p", proj_key))
        .await
        .expect("relate unborn hero to early event");

    // 3. Создаем два события в одно и то же время m_abs=1440, где одновременно участвует Живой Герой (Билокация 🟡)
    let _ev_biloc1 = create_timeline_event(&db, proj_key, "ev_b1", "Событие в Замке", 1).await;
    let _ev_biloc2 = create_timeline_event(&db, proj_key, "ev_b2", "Событие в Лесу", 1).await;

    let _ = db.query("RELATE (type::record('entities', $hero)) -> participates_in -> (type::record('timeline_events', 'ev_b1')) SET project_id = type::record('projects', $p), role = 'guest'")
        .bind(("hero", "hero_alive"))
        .bind(("p", proj_key))
        .await
        .expect("relate biloc 1");

    let _ = db.query("RELATE (type::record('entities', $hero)) -> participates_in -> (type::record('timeline_events', 'ev_b2')) SET project_id = type::record('projects', $p), role = 'traveler'")
        .bind(("hero", "hero_alive"))
        .bind(("p", proj_key))
        .await
        .expect("relate biloc 2");

    // 4. Запускаем ConsistencyAuditWorkflow
    let report = services.consistency_workflow.execute(proj_key).await.expect("execute consistency audit");

    // Проверяем обнаружение нарушения "Погибший персонаж активен"
    let deceased_anomalies: Vec<_> = report.anomalies.iter()
        .filter(|a| matches!(a.rule, worldwiki_domain::analytics::ContradictionRule::DeceasedEntityActive))
        .collect();
    assert!(!deceased_anomalies.is_empty(), "Должна быть обнаружена ошибка активности погибшего персонажа");
    assert_eq!(deceased_anomalies[0].severity, worldwiki_domain::analytics::ContradictionSeverity::Critical);

    // Проверяем обнаружение нарушения "Действие персонажа до рождения" (ActionBeforeBirth)
    let before_birth_anomalies: Vec<_> = report.anomalies.iter()
        .filter(|a| matches!(a.rule, worldwiki_domain::analytics::ContradictionRule::ActionBeforeBirth))
        .collect();
    assert!(!before_birth_anomalies.is_empty(), "Должна быть обнаружена ошибка действия персонажа до рождения");
    assert_eq!(before_birth_anomalies[0].severity, worldwiki_domain::analytics::ContradictionSeverity::Critical);

    // Проверяем обнаружение нарушения "Билокация"
    let biloc_anomalies: Vec<_> = report.anomalies.iter()
        .filter(|a| matches!(a.rule, worldwiki_domain::analytics::ContradictionRule::EntityBilocation))
        .collect();
    assert!(!biloc_anomalies.is_empty(), "Должна быть обнаружена билокация персонажа");
}

/// ТЕСТ 6: Авто-синхронизация упоминаний ((Сущность)) и изоляция источников
#[tokio::test]
async fn test_chapter_mentions_sync_and_source_isolation() {
    let db = create_test_db().await;
    let proj_key = "proj_mentions";
    seed_project(&db, proj_key, "Проект для упоминаний").await;

    // 1. Создаем сущности лора
    let _arthur = create_test_entity(&db, proj_key, "arthur", "Артур Пендрагон", "character").await;
    let _merlin = create_test_entity(&db, proj_key, "merlin", "Мерлин", "character").await;
    let _excalibur = create_test_entity(&db, proj_key, "excalibur", "Экскалибур", "artifact").await;

    // 2. Создаем главу и вручную привязываем Мерлина как source='manual'
    let _ch1 = create_test_chapter(&db, proj_key, "ch1", "Глава 1: Меч в камне", 1).await;
    let _ = db.query("RELATE (type::record('entities', $m)) -> appears_in -> (type::record('chapters', $ch)) SET project_id = type::record('projects', $p), source = 'manual'")
        .bind(("m", "merlin"))
        .bind(("ch", "ch1"))
        .bind(("p", proj_key))
        .await
        .expect("relate manual merlin");

    // 3. Вызываем fn::sync_chapter_mentions с упоминанием Артура и Экскалибура
    let names = vec!["Артур Пендрагон".to_string(), "Экскалибур".to_string()];
    let mut sync_res = db.query("RETURN fn::sync_chapter_mentions(type::record('chapters', $ch), $names);")
        .bind(("ch", "ch1"))
        .bind(("names", names))
        .await
        .expect("call sync mentions");
    assert!(sync_res.take_errors().is_empty());

    // 4. Проверяем выборку всех appears_in для главы 1
    let mut app_res = db.query("SELECT in, source FROM appears_in WHERE out = type::record('chapters', $ch) ORDER BY source ASC;")
        .bind(("ch", "ch1"))
        .await
        .expect("select appears_in");
    let appearances: Vec<Value> = app_res.take(0).expect("take appearances");

    assert_eq!(appearances.len(), 3, "В главе должно быть 3 появления: 2 mention + 1 manual");

    let sources: Vec<String> = appearances.iter().map(|a| a["source"].as_str().unwrap_or_default().to_string()).collect();
    assert_eq!(sources.iter().filter(|&s| s == "mention").count(), 2, "2 автоматических упоминания");
    assert_eq!(sources.iter().filter(|&s| s == "manual").count(), 1, "1 ручная привязка сохранена");

    // 5. Повторный синк только с Артуром — Экскалибур удаляется, а Мерлин (manual) остается!
    let updated_names = vec!["Артур Пендрагон".to_string()];
    let _ = db.query("RETURN fn::sync_chapter_mentions(type::record('chapters', $ch), $names);")
        .bind(("ch", "ch1"))
        .bind(("names", updated_names))
        .await
        .expect("re-sync mentions");

    let mut final_res = db.query("SELECT in, source FROM appears_in WHERE out = type::record('chapters', $ch);")
        .bind(("ch", "ch1"))
        .await
        .expect("select appears_in after update");
    let final_apps: Vec<Value> = final_res.take(0).expect("take final appearances");

    assert_eq!(final_apps.len(), 2, "Остались только Артур (mention) и Мерлин (manual)");

    // 6. Проверяем парсинг текста с ((Лёша))[id=entities%3Aarthur] через TextBlock::extract_entity_mentions
    let chapter_text = "В зал вошел ((Лёша))[id=entities%3Aarthur] и его друг ((Колдун))[entities:merlin].";
    let extracted = worldwiki_domain::manuscript::TextBlock::extract_entity_mentions(chapter_text);
    assert!(extracted.contains(&"entities:arthur".to_string()), "Должен быть извлечен Record ID entities:arthur");
    assert!(extracted.contains(&"entities:merlin".to_string()), "Должен быть извлечен Record ID entities:merlin");

    // Синкаем извлеченные имена/ID
    let _ = db.query("RETURN fn::sync_chapter_mentions(type::record('chapters', $ch), $names);")
        .bind(("ch", "ch1"))
        .bind(("names", extracted))
        .await
        .expect("sync mentions with extracted IDs");

    let mut record_res = db.query("SELECT in FROM appears_in WHERE out = type::record('chapters', $ch) AND source = 'mention';")
        .bind(("ch", "ch1"))
        .await
        .expect("select appears_in for extracted IDs");
    let record_apps: Vec<Value> = record_res.take(0).expect("take record apps");
    assert_eq!(record_apps.len(), 2, "Оба персонажа (Артур и Мерлин) найдены по Record ID, несмотря на отображаемые имена 'Лёша' и 'Колдун'");
}

/// ТЕСТ 7: Гранулярные сцены с block_id и жизненный цикл обещаний (planted -> resolved)
#[tokio::test]
async fn test_granular_scenes_and_promise_lifecycle() {
    let db = create_test_db().await;
    let proj_key = "proj_scenes";
    seed_project(&db, proj_key, "Проект сцен и обещаний").await;

    let _ch1 = create_test_chapter(&db, proj_key, "ch1", "Глава 1: Завязка", 1).await;
    let _ch5 = create_test_chapter(&db, proj_key, "ch5", "Глава 5: Развязка", 5).await;

    let _hero = create_test_entity(&db, proj_key, "hero", "Герой", "character").await;
    let _castle = create_test_entity(&db, proj_key, "castle", "Темный Замок", "location").await;
    let _ev = create_timeline_event(&db, proj_key, "ev_duel", "Дуэль в тронном зале", 1).await;

    // 1. Создаем сцену, привязанную к абзацу block_id='para_042'
    let prom_sql = r#"
        LET $p_rec = type::record('projects', $p);
        LET $c_rec = type::record('chapters', $ch);
        LET $prom_rec = type::record('plot_promises', 'scene_duel');
        LET $tb_rec = type::record('text_blocks', 'para_042');

        UPSERT $prom_rec SET
            project_id = $p_rec,
            title = 'Герой обнажил клинок перед троном',
            kind = 'scene',
            status = 'planted',
            timeline_event_id = type::record('timeline_events', 'ev_duel');

        UPSERT $tb_rec SET
            project_id = $p_rec,
            chapter_id = $c_rec,
            order_index = 42,
            content = 'Герой обнажил клинок перед троном';

        RELATE $prom_rec -> promise_milestones -> $tb_rec SET
            project_id = $p_rec,
            stage = 'plant',
            quote = 'Герой обнажил клинок перед троном';

        RELATE $prom_rec -> occurs_at -> (type::record('timeline_events', 'ev_duel')) SET
            project_id = $p_rec,
            time_nature = 'present';
    "#;
    let mut res = db.query(prom_sql)
        .bind(("p", proj_key))
        .bind(("ch", "ch1"))
        .await
        .expect("upsert scene promise");
    assert!(res.take_errors().is_empty());

    // 2. Переводим сцену/обещание в статус 'resolved' в Главе 5
    let resolve_sql = r#"
        LET $p_rec = type::record('projects', $p);
        LET $c_rec = type::record('chapters', $ch_res);
        LET $prom_rec = type::record('plot_promises', 'scene_duel');
        LET $tb_rec = type::record('text_blocks', 'para_100');

        UPSERT $tb_rec SET
            project_id = $p_rec,
            chapter_id = $c_rec,
            order_index = 100,
            content = 'Победа над тираном';

        RELATE $prom_rec -> promise_milestones -> $tb_rec SET
            project_id = $p_rec,
            stage = 'resolution',
            quote = 'Победа над тираном';

        UPDATE $prom_rec SET status = 'resolved';
    "#;
    let mut res2 = db.query(resolve_sql)
        .bind(("p", proj_key))
        .bind(("ch_res", "ch5"))
        .await
        .expect("resolve scene promise");
    assert!(res2.take_errors().is_empty());

    // 3. Проверяем состояние в БД
    let mut fetch = db.query(r#"
        SELECT 
            *, 
            (->promise_milestones.out.id) AS milestones 
        FROM type::record('plot_promises', 'scene_duel')
    "#)
        .await
        .expect("fetch promise");
    let items: Vec<Value> = fetch.take(0).expect("take promise");
    assert_eq!(items.len(), 1);
    let item = &items[0];
    assert_eq!(item["status"], "resolved");
    assert_eq!(item["kind"], "scene");
    assert_eq!(item["milestones"].as_array().unwrap().len(), 2);
}

/// ТЕСТ 8: Статистика и метрики рукописи (ManuscriptAnalyticsService)
#[tokio::test]
async fn test_manuscript_statistics_service() {
    let db = create_test_db().await;
    let proj_key = "proj_stats";
    seed_project(&db, proj_key, "Проект статистики").await;

    let services = create_test_services(Arc::new(db.clone()));

    // 1. Создаем главы с разным объемом слов
    let _ch1 = create_test_chapter(&db, proj_key, "ch1", "Глава 1", 1).await;
    let _ch2 = create_test_chapter(&db, proj_key, "ch2", "Глава 2", 2).await;
    let _ch3 = create_test_chapter(&db, proj_key, "ch3", "Глава 3", 3).await;

    // 2. Создаем сущности лора
    let _e1 = create_test_entity(&db, proj_key, "e1", "Сущность 1", "character").await;
    let _e2 = create_test_entity(&db, proj_key, "e2", "Сущность 2", "location").await;

    // 3. Получаем статистику через сервис
    let stats = services.manuscript_stats_service.get_statistics(proj_key).await.expect("get stats");
    assert_eq!(stats.total_chapters, 3, "Должно быть 3 главы");
    assert_eq!(stats.total_entities, 2, "Должно быть 2 сущности");
    assert_eq!(stats.total_words, 4500, "Суммарно 3 * 1500 = 4500 слов");
}

/// ТЕСТ 9: Каскадная целостность событий DDL (03_events.surql)
#[tokio::test]
async fn test_cascade_delete_integrity_for_arcs_and_chapters() {
    let db = create_test_db().await;
    let proj_key = "proj_cascade";
    seed_project(&db, proj_key, "Проект каскада").await;

    let _ch = create_test_chapter(&db, proj_key, "ch_del", "Удаляемая глава", 1).await;
    let _ent = create_test_entity(&db, proj_key, "ent_del", "Персонаж", "character").await;

    // Создаем арку, обещание и ребра advances_arc / participant_of
    let arc_sql = "UPSERT type::record('story_arcs', 'arc_del') SET project_id = type::record('projects', $p), title = 'Арка на удаление', arc_type = 'character', status = 'planned'";
    let _ = db.query(arc_sql).bind(("p", proj_key)).await.expect("create arc");

    let prom_sql = "UPSERT type::record('plot_promises', 'prom_del') SET project_id = type::record('projects', $p), title = 'Обещание', kind = 'gun', status = 'planted'";
    let _ = db.query(prom_sql).bind(("p", proj_key)).await.expect("create promise");

    let _ = db.query("RELATE (type::record('plot_promises', 'prom_del')) -> advances_arc -> (type::record('story_arcs', 'arc_del')) SET project_id = type::record('projects', $p), phase = 'setup'")
        .bind(("p", proj_key))
        .await
        .expect("relate advances_arc");

    let _ = db.query("RELATE (type::record('entities', 'ent_del')) -> participant_of -> (type::record('plot_promises', 'prom_del')) SET project_id = type::record('projects', $p)")
        .bind(("p", proj_key))
        .await
        .expect("relate participant_of");

    let _ = db.query("RELATE (type::record('entities', 'ent_del')) -> appears_in -> (type::record('chapters', 'ch_del')) SET project_id = type::record('projects', $p), source = 'manual'")
        .bind(("p", proj_key))
        .await
        .expect("relate appears_in");

    // Удаляем сюжетную арку story_arcs:arc_del
    let mut del_arc = db.query("DELETE type::record('story_arcs', 'arc_del');").await.expect("delete arc");
    assert!(del_arc.take_errors().is_empty());

    // Проверяем, что ребро advances_arc удалилось каскадно по DDL EVENT
    let mut check_arcs = db.query("SELECT * FROM advances_arc WHERE out = type::record('story_arcs', 'arc_del');").await.expect("check advances_arc");
    let adv_arcs: Vec<Value> = check_arcs.take(0).expect("take advances_arc");
    assert_eq!(adv_arcs.len(), 0, "Ребра advances_arc должны удалиться каскадно при удалении арки");

    // Удаляем обещание plot_promises:prom_del
    let mut del_prom = db.query("DELETE type::record('plot_promises', 'prom_del');").await.expect("delete promise");
    assert!(del_prom.take_errors().is_empty());

    let mut check_parts = db.query("SELECT * FROM participant_of WHERE out = type::record('plot_promises', 'prom_del');").await.expect("check participant_of");
    let parts: Vec<Value> = check_parts.take(0).expect("take participant_of");
    assert_eq!(parts.len(), 0, "Ребра participant_of должны удалиться каскадно при удалении обещания");

    // Удаляем главу chapters:ch_del
    let mut del_chap = db.query("DELETE type::record('chapters', 'ch_del');").await.expect("delete chapter");
    assert!(del_chap.take_errors().is_empty());

    // Проверяем каскадное удаление appears_in
    let mut check_apps = db.query("SELECT * FROM appears_in WHERE out = type::record('chapters', 'ch_del');").await.expect("check appears_in");
    let apps: Vec<Value> = check_apps.take(0).expect("take apps");
    assert_eq!(apps.len(), 0, "Ребра appears_in должны удалиться каскадно при удалении главы");
}

/// ТЕСТ 10: Негативные пути валидации и ограничения схемы (ASSERT, валидация полей)
#[tokio::test]
async fn test_negative_validation_and_schema_constraints() {
    let db = create_test_db().await;
    let proj_key = "proj_neg";
    seed_project(&db, proj_key, "Проект негативных тестов").await;

    let services = create_test_services(Arc::new(db.clone()));

    // 1. Попытка создать арку с пустым заголовком через сервис -> DomainError::Validation
    let invalid_arc = StoryArc::new(proj_key, "   ", ArcType::Character);
    let save_res = services.story_arcs.save_arc(&invalid_arc).await;
    assert!(save_res.is_err(), "Создание арки с пустым заголовком должно возвращать ошибку");

    // 2. Попытка получить несуществующую арку -> ApplicationError::NotFound
    let get_res = services.story_arcs.get_arc("story_arcs:non_existent_arc").await;
    assert!(get_res.is_err(), "Получение несуществующей арки должно возвращать NotFound");

    // 3. Попытка вставить недопустимую фазу в plot_promises (ASSERT violation)
    let _ch = create_test_chapter(&db, proj_key, "ch_neg", "Глава", 1).await;
    let invalid_phase_sql = r#"
        UPSERT type::record('plot_promises', 'invalid_phase_promise') SET
            project_id = type::record('projects', $p),
            chapter_id = type::record('chapters', 'ch_neg'),
            kind = 'scene',
            quote = 'Невалидная фаза',
            arc_phase = 'invalid_phase_name'
    "#;
    let mut res = db.query(invalid_phase_sql).bind(("p", proj_key)).await.expect("query runs");
    let errs = res.take_errors();
    assert!(!errs.is_empty(), "Вставка недопустимой arc_phase должна блокироваться схемой (ASSERT)");

    // 4. Статистика для несуществующего проекта возвращает нули
    let non_existent_stats = services.manuscript_stats_service.get_statistics("projects:non_existent_proj").await.expect("stats runs");
    assert_eq!(non_existent_stats.total_chapters, 0);
    assert_eq!(non_existent_stats.total_words, 0);
    assert_eq!(non_existent_stats.total_entities, 0);
}

/// ТЕСТ 11: Граничные случаи и пустые данные (Empty Project & Missing References)
#[tokio::test]
async fn test_empty_project_and_unbound_edge_cases() {
    let db = create_test_db().await;
    let proj_empty = "proj_empty_test";
    seed_project(&db, proj_empty, "Абсолютно пустой проект").await;

    // 1. Timeline Inspector для пустого проекта -> пустые массивы
    let mut insp_res = db.query("RETURN fn::get_timeline_inspector_data(type::record('projects', $p));")
        .bind(("p", proj_empty))
        .await
        .expect("call empty inspector");
    let insp_data: Option<Value> = insp_res.take(0).expect("take empty inspector");
    let data = insp_data.expect("data not null");
    assert_eq!(data["events"].as_array().unwrap().len(), 0);
    assert_eq!(data["chapters"].as_array().unwrap().len(), 0);

    // 2. Graph Time Slice для пустого проекта -> пустые nodes и edges
    let mut graph_res = db.query("RETURN fn::get_graph_time_slice(type::record('projects', $p));")
        .bind(("p", proj_empty))
        .await
        .expect("call empty graph slice");
    let graph_data: Option<Value> = graph_res.take(0).expect("take empty graph");
    let g = graph_data.expect("graph not null");
    assert_eq!(g["nodes"].as_array().unwrap().len(), 0);
    assert_eq!(g["edges"].as_array().unwrap().len(), 0);

    // 3. Cross Reference Matrix для пустого проекта -> пустые chapters и entities
    let mut mat_res = db.query("RETURN fn::get_cross_reference_matrix(type::record('projects', $p));")
        .bind(("p", proj_empty))
        .await
        .expect("call empty matrix");
    let mat_data: Option<Value> = mat_res.take(0).expect("take empty matrix");
    let m = mat_data.expect("matrix not null");
    assert_eq!(m["chapters"].as_array().unwrap().len(), 0);
    assert_eq!(m["entities"].as_array().unwrap().len(), 0);

    // 4. Ребро entity_rel БЕЗ дат и БЕЗ start_chapter -> inferred_start_m_abs = NONE (⚠️ случай)
    let _e1 = create_test_entity(&db, proj_empty, "e_a", "Персонаж А", "character").await;
    let _e2 = create_test_entity(&db, proj_empty, "e_b", "Персонаж Б", "character").await;
    let rel_sql = "RELATE (type::record('entities', 'e_a')) -> entity_rel -> (type::record('entities', 'e_b')) SET project_id = type::record('projects', $p), rel_type = 'friend'";
    let _ = db.query(rel_sql).bind(("p", proj_empty)).await.expect("create unbound rel");

    let mut slice_res = db.query("RETURN fn::get_graph_time_slice(type::record('projects', $p));")
        .bind(("p", proj_empty))
        .await
        .expect("query slice for unbound");
    let slice_val: Option<Value> = slice_res.take(0).expect("take slice");
    let slice = slice_val.expect("slice not null");
    let edges = slice["edges"].as_array().expect("edges array");
    assert_eq!(edges.len(), 1);
    assert!(edges[0]["inferred_start_m_abs"].is_null(), "Связь без временных отметок должна иметь null в inferred_start_m_abs");
}

/// ТЕСТ 12: Межпроектная изоляция и безопасность синка упоминаний
#[tokio::test]
async fn test_mentions_cross_project_isolation() {
    let db = create_test_db().await;
    let proj_a = "proj_isolate_a";
    let proj_b = "proj_isolate_b";
    seed_project(&db, proj_a, "Проект А (Фэнтези)").await;
    seed_project(&db, proj_b, "Проект Б (Киберпанк)").await;

    // Персонажи в Проекте А и Проекте Б с одинаковыми/разными именами
    let _hero_a = create_test_entity(&db, proj_a, "char_a", "Рудеус", "character").await;
    let _hero_b = create_test_entity(&db, proj_b, "char_b", "Виктор", "character").await;

    let _ch_a = create_test_chapter(&db, proj_a, "ch_a", "Глава в Проекте А", 1).await;

    // Пытаемся синкать в главе Проекта А персонажа из Проекта Б ("Виктор") и несуществующего ("Чужой")
    let names = vec!["Виктор".to_string(), "Чужой".to_string()];
    let _ = db.query("RETURN fn::sync_chapter_mentions(type::record('chapters', $ch), $names);")
        .bind(("ch", "ch_a"))
        .bind(("names", names))
        .await
        .expect("sync cross project");

    // Проверяем, что в Проекте А НЕ создалось ребер появления
    let mut check_apps = db.query("SELECT * FROM appears_in WHERE out = type::record('chapters', 'ch_a');").await.expect("check apps");
    let apps: Vec<Value> = check_apps.take(0).expect("take apps");
    assert_eq!(apps.len(), 0, "Персонажи чужого проекта или несуществующие сущности не должны привязываться");
}

/// ТЕСТ 13: Граничные случаи аудита противоречий (Consistency Audit Edge Cases)
#[tokio::test]
async fn test_consistency_audit_clean_and_edge_cases() {
    let db = create_test_db().await;
    let proj_key = "proj_clean_audit";
    seed_project(&db, proj_key, "Чистый проект без ошибок").await;

    let services = create_test_services(Arc::new(db.clone()));

    // 1. Создаем нормального живого персонажа и событие
    let _ch1 = create_test_chapter(&db, proj_key, "ch1", "Глава 1", 1).await;
    let _hero = create_test_entity(&db, proj_key, "hero", "Живой", "character").await;
    let _ev = create_timeline_event(&db, proj_key, "ev1", "Обычное событие", 1).await;

    let _ = db.query("RELATE (type::record('entities', 'hero')) -> participates_in -> (type::record('timeline_events', 'ev1')) SET project_id = type::record('projects', $p), role = 'actor'")
        .bind(("p", proj_key))
        .await
        .expect("relate normal");

    // 2. Создаем сущность с is_deceased=true, но death_m_abs = None (не указана точная дата)
    let _ = create_test_entity_with_attrs(
        &db,
        proj_key,
        "dead_nodate",
        "Призрак",
        "character",
        json!({ "is_deceased": true }),
    ).await;

    // 3. Запуск аудита на чистом проекте
    let report = services.consistency_workflow.execute(proj_key).await.expect("run audit");
    assert_eq!(report.anomalies.len(), 0, "В чистом проекте не должно быть ложных срабатываний");
    assert_eq!(report.summary.healthy_percent, 100);
}

/// ТЕСТ 9: Высокопроизводительный Мульти-персонажный путь (fn::get_multi_character_journey)
#[tokio::test]
async fn test_multi_character_journey_union_and_intersection() {
    let db = create_test_db().await;
    let proj_key = "proj_multi_journey";
    seed_project(&db, proj_key, "Проект для Мульти-Пути Персонажей").await;

    let services = create_test_services(Arc::new(db.clone()));

    // 1. Создаем главы: Глава 1 (order=1), Глава 2 (order=2), Глава 5 (order=5)
    let _ch1 = create_test_chapter(&db, proj_key, "ch1", "Глава 1. Первая встреча", 1).await;
    let _ch2 = create_test_chapter(&db, proj_key, "ch2", "Глава 2. Одиночный путь", 2).await;
    let _ch5 = create_test_chapter(&db, proj_key, "ch5", "Глава 5. Воссоединение", 5).await;

    // 2. Создаем персонажей: Владимир (20 лет в гл.1) и Соня (15 лет в гл.1)
    let _ = create_test_entity_with_attrs(
        &db,
        proj_key,
        "hero_a",
        "Владимир",
        "character",
        json!({ "роль_в_истории": "Главный герой", "статус_категория": "Жив", "дата_рождения": { "absolute_minute": 0 } }),
    ).await;

    let _ = create_test_entity_with_attrs(
        &db,
        proj_key,
        "hero_b",
        "Соня",
        "character",
        json!({ "роль_в_истории": "Второстепенный", "статус_категория": "Жив", "дата_рождения": { "absolute_minute": 2628000 } }),
    ).await;

    // 3. Создаем появления:
    // hero_a появляется в ch1, ch2, ch5
    // hero_b появляется в ch1, ch5 (пропускает ch2, ch3, ch4)
    let _ = db.query("RELATE (type::record('entities', 'hero_a')) -> appears_in -> (type::record('chapters', 'ch1')) SET project_id = type::record('projects', $p), source = 'manual'")
        .bind(("p", proj_key)).await.expect("a in ch1");
    let _ = db.query("RELATE (type::record('entities', 'hero_a')) -> appears_in -> (type::record('chapters', 'ch2')) SET project_id = type::record('projects', $p), source = 'manual'")
        .bind(("p", proj_key)).await.expect("a in ch2");
    let _ = db.query("RELATE (type::record('entities', 'hero_a')) -> appears_in -> (type::record('chapters', 'ch5')) SET project_id = type::record('projects', $p), source = 'manual'")
        .bind(("p", proj_key)).await.expect("a in ch5");

    let _ = db.query("RELATE (type::record('entities', 'hero_b')) -> appears_in -> (type::record('chapters', 'ch1')) SET project_id = type::record('projects', $p), source = 'manual'")
        .bind(("p", proj_key)).await.expect("b in ch1");
    let _ = db.query("RELATE (type::record('entities', 'hero_b')) -> appears_in -> (type::record('chapters', 'ch5')) SET project_id = type::record('projects', $p), source = 'manual'")
        .bind(("p", proj_key)).await.expect("b in ch5");

    // Создаем событие для сцены с датой m_abs = 10_512_000 (20 лет от нуля)
    let ev_sql = "UPSERT type::record('timeline_events', 'ev_ch1') SET project_id = type::record('projects', $p), calendar_id = type::record('calendars', 'default'), title = 'Событие 1', m_abs = 10512000";
    let _ = db.query(ev_sql).bind(("p", proj_key)).await;

    // Создаем сцену-обещание в ch1
    let _ = create_scene_promise(
        &db,
        proj_key,
        "sc_ch1",
        "ch1",
        "Привет!",
        Some("ev_ch1"),
        None,
        Some(vec!["hero_a", "hero_b"]),
        1,
    ).await;

    let entity_ids = vec!["entities:hero_a".to_string(), "entities:hero_b".to_string()];

    // 4. ТЕСТИРУЕМ РЕЖИМ UNION (Все сцены группы)
    let union_resp = services
        .character_journey_service
        .get_multi_journey(proj_key, &entity_ids, worldwiki_domain::analytics::JourneyFilterMode::Union)
        .await
        .expect("get multi journey union");

    assert_eq!(union_resp.scenes.len(), 3, "Union должен вернуть 3 сцены (ch1, ch2, ch5)");
    assert_eq!(union_resp.scenes[0].present_entities.len(), 2, "В ch1 присутствуют оба персонажа");
    assert_eq!(union_resp.scenes[1].present_entities.len(), 1, "В ch2 присутствует только hero_a");
    assert_eq!(union_resp.scenes[2].present_entities.len(), 2, "В ch5 присутствуют оба персонажа");

    // Проверка динамического возраста в ch1
    let vladimir_in_ch1 = union_resp.scenes[0].present_entities.iter().find(|p| p.entity_name == "Владимир").unwrap();
    assert_eq!(vladimir_in_ch1.age_label.as_deref(), Some("20 лет"));
    assert_eq!(vladimir_in_ch1.role_in_story.as_deref(), Some("Главный герой"));

    // 5. ТЕСТИРУЕМ РЕЖИМ INTERSECTION (Только совместные сцены)
    let inter_resp = services
        .character_journey_service
        .get_multi_journey(proj_key, &entity_ids, worldwiki_domain::analytics::JourneyFilterMode::Intersection)
        .await
        .expect("get multi journey intersection");

    assert_eq!(inter_resp.scenes.len(), 2, "Intersection должен вернуть строго 2 совместные сцены (ch1 и ch5)");
    assert_eq!(inter_resp.scenes[0].chapter_id.as_deref(), Some("chapters:ch1"));
    assert_eq!(inter_resp.scenes[1].chapter_id.as_deref(), Some("chapters:ch5"));

    // Проверка разрыва (Meeting Gap) между сценой в гл.1 и сценой в гл.5:
    // gap = 5 - 1 - 1 = 3 главы
    let ch5_gap = inter_resp.scenes[1].meeting_gap.as_ref().expect("ch5 should have meeting gap");
    assert_eq!(ch5_gap.chapters_count, 3, "Между гл.1 и гл.5 разрыв 3 главы (ch2, ch3, ch4)");
    assert_eq!(ch5_gap.formatted_label, "⏳ Не виделись 3 глав");
}



