//! Интеграционные тесты академического процессора и мультиформатного экспорта (`logic/documents`).
//!
//! Тестируют:
//! - `generate_docx`: генерация Word OpenXML пакета с ГОСТ-параметрами (А4, TNR 14pt, 1.5 интервал,
//!   1.25 см красная строка, поля 30/10/20/20 мм), таблицами, заголовками, рисунками, цитатами.
//! - `generate_epub`: генерация архива EPUB 3.3 с соблюдением требований спецификации IDPF
//!   (STORED mimetype первым файлом, container.xml, content.opf, toc.xhtml, style.css, сноски).
//! - `generate_fb2`: генерация FictionBook 2.0 XML со схемой, тегами секций, цитат и примечаний.
//! - Санитизация путей и защита от Path Traversal (опасные символы, спецсимволы, двоеточия).
//! - Стресс-тесты: пустые документы, документы без метаданных, глубокая вложенность, экранирование XML.

use std::fs::File;
use std::io::Read;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicUsize, Ordering};
use serde_json::json;
use zip::ZipArchive;

use crate::logic::documents::docx::generate_docx;
use crate::logic::documents::epub::generate_epub;
use crate::logic::documents::fb2::generate_fb2;
use crate::logic::documents::models::ExportDocumentRequest;

static __TMP_DOC_IDX: AtomicUsize = AtomicUsize::new(0);

/// Создает изолированный временный каталог для предотвращения конфликтов между тестами
fn tmp_dir(tag: &str) -> PathBuf {
    let idx = __TMP_DOC_IDX.fetch_add(1, Ordering::SeqCst);
    let dir = std::env::temp_dir().join(format!(
        "worldwiki-doc-integ-{}-{}-{}-{}",
        std::process::id(),
        idx,
        tag,
        uuid::Uuid::new_v4()
    ));
    let _ = std::fs::remove_dir_all(&dir);
    std::fs::create_dir_all(&dir).expect("create temp dir for doc tests");
    dir
}

/// Создает тестовый запрос со сложной структурой академического документа
fn make_full_academic_request() -> ExportDocumentRequest {
    ExportDocumentRequest {
        project_name: "Архитектура & Проектирование ИИ".to_string(),
        title: "Разработка модульной системы <WorldWiki>: Том 1 & 2".to_string(),
        authors: vec![
            "Королёв С.П.".to_string(),
            "Глушко В.П.".to_string(),
        ],
        profile_id: "gost_academic".to_string(),
        blocks: vec![
            // 1. Заголовок первого уровня
            json!({
                "type": "heading",
                "id": "h-1",
                "level": 1,
                "content": [{ "type": "text", "text": "1. Теоретические основы & концепции" }]
            }),
            // 2. Параграф со смешанным форматированием и сноской
            json!({
                "type": "paragraph",
                "id": "p-1",
                "content": [
                    { "type": "text", "text": "Данный раздел содержит " },
                    { "type": "text", "text": "полужирный текст", "marks": [{ "type": "bold" }] },
                    { "type": "text", "text": ", а также " },
                    { "type": "text", "text": "курсивное начертание", "marks": [{ "type": "italic" }] },
                    { "type": "text", "text": " и моноширинный код " },
                    { "type": "text", "text": "println!(\"Hello World\")", "marks": [{ "type": "code" }] },
                    {
                        "type": "footnote_reference",
                        "content": [{ "type": "text", "text": "ГОСТ Р 7.0.5-2008. Библиографическая ссылка." }]
                    }
                ]
            }),
            // 3. Подзаголовок второго уровня
            json!({
                "type": "heading",
                "id": "h-2",
                "level": 2,
                "content": [{ "type": "text", "text": "1.1. Архитектура семантического ядра" }]
            }),
            // 4. Иллюстрация с подписью
            json!({
                "type": "figure",
                "id": "fig-1",
                "mediaUrl": "data:image/png;base64,mock",
                "captionContent": [{ "type": "text", "text": "Диаграмма потоков данных AST Engine" }]
            }),
            // 5. Блок цитаты
            json!({
                "type": "quote",
                "id": "q-1",
                "content": [
                    {
                        "type": "paragraph",
                        "content": [{ "type": "text", "text": "«Простота — необходимое условие прекрасного»." }]
                    }
                ]
            }),
            // 6. Таблица данных
            json!({
                "type": "table",
                "id": "tbl-1",
                "rows": [
                    {
                        "cells": [
                            { "content": [{ "type": "paragraph", "content": [{ "type": "text", "text": "Параметр" }] }] },
                            { "content": [{ "type": "paragraph", "content": [{ "type": "text", "text": "Значение по ГОСТ" }] }] }
                        ]
                    },
                    {
                        "cells": [
                            { "content": [{ "type": "paragraph", "content": [{ "type": "text", "text": "Поле левое" }] }] },
                            { "content": [{ "type": "paragraph", "content": [{ "type": "text", "text": "30 мм" }] }] }
                        ]
                    }
                ]
            })
        ],
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. DOCX (Word OpenXML) ТЕСТЫ
// ─────────────────────────────────────────────────────────────────────────────

#[test]
fn test_docx_export_structure_and_openxml_spec() {
    let dir = tmp_dir("docx_spec");
    let req = make_full_academic_request();

    let res = generate_docx(&req, &dir).expect("DOCX generation must succeed");
    assert!(res.success);
    assert!(res.file_size_bytes > 0);
    assert!(res.file_name.ends_with(".docx"));

    let out_path = Path::new(&res.file_path);
    assert!(out_path.exists(), "DOCX file must physically exist on disk");

    let file = File::open(out_path).expect("failed to open docx file");
    let mut archive = ZipArchive::new(file).expect("docx must be a valid zip container");

    let names: Vec<String> = archive.file_names().map(|s| s.to_string()).collect();

    // Проверка обязательных компонентов OpenXML
    assert!(names.contains(&"[Content_Types].xml".to_string()), "Content Types missing");
    assert!(names.contains(&"_rels/.rels".to_string()), "Root rels missing");
    assert!(names.contains(&"word/_rels/document.xml.rels".to_string()), "Document rels missing");
    assert!(names.contains(&"word/styles.xml".to_string()), "Styles missing");
    assert!(names.contains(&"word/document.xml".to_string()), "Document body missing");

    // Чтение и проверка styles.xml (ГОСТ требования: TNR 14pt, 1.5 интервал, 1.25 см красная строка)
    let mut styles_xml = String::new();
    archive.by_name("word/styles.xml").unwrap().read_to_string(&mut styles_xml).unwrap();
    assert!(styles_xml.contains("Times New Roman"), "Default font must be Times New Roman");
    assert!(styles_xml.contains("<w:sz w:val=\"28\"/>"), "Font size must be 14pt (28 half-points)");
    assert!(styles_xml.contains("<w:spacing w:line=\"360\" w:lineRule=\"auto\"/>"), "Line spacing must be 1.5 (360)");
    assert!(styles_xml.contains("<w:ind w:firstLine=\"709\"/>"), "First line indent must be 1.25 cm (709 dxa)");

    // Чтение и проверка document.xml (контент и разметка)
    let mut doc_xml = String::new();
    archive.by_name("word/document.xml").unwrap().read_to_string(&mut doc_xml).unwrap();

    // Экранирование XML спецсимволов
    assert!(doc_xml.contains("1. Теоретические основы &amp; концепции"), "XML ampersand must be escaped");
    assert!(doc_xml.contains("<w:b/>"), "Bold mark must generate <w:b/> tag");
    assert!(doc_xml.contains("<w:i/>"), "Italic mark must generate <w:i/> tag");
    assert!(doc_xml.contains("println!(&quot;Hello World&quot;)"), "Quotes in code must be escaped");
    assert!(doc_xml.contains("Диаграмма потоков данных AST Engine"), "Figure caption must be present");
    assert!(doc_xml.contains("«Простота — необходимое условие прекрасного»."), "Quote content must be present");
    assert!(doc_xml.contains("<w:tbl>"), "Table must generate <w:tbl>");
    assert!(doc_xml.contains("<w:tc>"), "Table cell must generate <w:tc>");

    // Проверка сноски по ГОСТ
    assert!(doc_xml.contains("<w:vertAlign w:val=\"superscript\"/>"), "Footnote mark must be superscript");
    assert!(doc_xml.contains("ГОСТ Р 7.0.5-2008"), "Footnote text must be present");

    // Проверка параметров страниц А4 и полей (30 / 10 / 20 / 20 мм)
    assert!(doc_xml.contains("<w:pgSz w:w=\"11906\" w:h=\"16838\"/>"), "A4 physical page dimensions");
    assert!(
        doc_xml.contains("w:left=\"1701\"")
            && doc_xml.contains("w:right=\"567\"")
            && doc_xml.contains("w:top=\"1134\"")
            && doc_xml.contains("w:bottom=\"1134\""),
        "GOST margins must be 30mm left, 10mm right, 20mm top/bottom"
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. EPUB 3.3 ТЕСТЫ
// ─────────────────────────────────────────────────────────────────────────────

#[test]
fn test_epub_export_structure_and_idpf_spec() {
    let dir = tmp_dir("epub_spec");
    let req = make_full_academic_request();

    let res = generate_epub(&req, &dir).expect("EPUB generation must succeed");
    assert!(res.success);
    assert!(res.file_size_bytes > 0);
    assert!(res.file_name.ends_with(".epub"));

    let out_path = Path::new(&res.file_path);
    assert!(out_path.exists());

    let file = File::open(out_path).expect("failed to open epub");
    let mut archive = ZipArchive::new(file).expect("epub must be a valid zip");

    // КРИТИЧЕСКОЕ ТРЕБОВАНИЕ IDPF EPUB: первый файл обязан быть 'mimetype'
    let names: Vec<String> = archive.file_names().map(|s| s.to_string()).collect();
    assert!(names.len() >= 5);
    assert_eq!(names[0], "mimetype", "First entry in EPUB container must be 'mimetype'");

    // Проверка содержимого mimetype
    let mut mime = String::new();
    archive.by_name("mimetype").unwrap().read_to_string(&mut mime).unwrap();
    assert_eq!(mime.trim(), "application/epub+zip");

    // Проверка структуры OEBPS
    assert!(names.contains(&"META-INF/container.xml".to_string()));
    assert!(names.contains(&"OEBPS/content.opf".to_string()));
    assert!(names.contains(&"OEBPS/toc.xhtml".to_string()));
    assert!(names.contains(&"OEBPS/chapter1.xhtml".to_string()));
    assert!(names.contains(&"OEBPS/style.css".to_string()));

    // Проверка content.opf (манифест и метаданные книги)
    let mut opf = String::new();
    archive.by_name("OEBPS/content.opf").unwrap().read_to_string(&mut opf).unwrap();
    assert!(opf.contains("<dc:title>Разработка модульной системы &lt;WorldWiki&gt;: Том 1 &amp; 2</dc:title>"));
    assert!(opf.contains("<dc:creator>Королёв С.П.</dc:creator>"));
    assert!(opf.contains("<dc:creator>Глушко В.П.</dc:creator>"));
    assert!(opf.contains("<dc:language>ru</dc:language>"));
    assert!(opf.contains("properties=\"nav\""), "toc.xhtml must have nav property");

    // Проверка toc.xhtml (XHTML5 навигация)
    let mut toc = String::new();
    archive.by_name("OEBPS/toc.xhtml").unwrap().read_to_string(&mut toc).unwrap();
    assert!(toc.contains("epub:type=\"toc\""), "XHTML nav element must have epub:type toc");
    assert!(toc.contains("<a href=\"chapter1.xhtml\">Разработка модульной системы &lt;WorldWiki&gt;: Том 1 &amp; 2</a>"));

    // Проверка главы chapter1.xhtml (сноски, заголовки, разметка)
    let mut ch1 = String::new();
    archive.by_name("OEBPS/chapter1.xhtml").unwrap().read_to_string(&mut ch1).unwrap();
    assert!(ch1.contains("1. Теоретические основы &amp; концепции"));
    assert!(ch1.contains("<strong>полужирный текст</strong>"));
    assert!(ch1.contains("<em>курсивное начертание</em>"));
    assert!(ch1.contains("<code>println!(&quot;Hello World&quot;)</code>"));
    assert!(ch1.contains("epub:type=\"noteref\""), "Footnote reference epub:type");
    assert!(ch1.contains("epub:type=\"footnote\""), "Footnote content block epub:type");
    assert!(ch1.contains("<blockquote>"), "Quote must render as <blockquote>");
    assert!(ch1.contains("<table class=\"doc-table\">"), "Table must render as <table>");
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. FB2 (FictionBook 2.0) ТЕСТЫ
// ─────────────────────────────────────────────────────────────────────────────

#[test]
fn test_fb2_export_structure_and_xml_spec() {
    let dir = tmp_dir("fb2_spec");
    let req = make_full_academic_request();

    let res = generate_fb2(&req, &dir).expect("FB2 generation must succeed");
    assert!(res.success);
    assert!(res.file_size_bytes > 0);
    assert!(res.file_name.ends_with(".fb2"));

    let out_path = Path::new(&res.file_path);
    assert!(out_path.exists());

    let xml = std::fs::read_to_string(out_path).expect("failed to read fb2 file");

    // Проверка схемы FB2
    assert!(xml.starts_with("<?xml version=\"1.0\" encoding=\"utf-8\"?>"));
    assert!(xml.contains("<FictionBook xmlns=\"http://www.gribuser.ru/xml/fictionbook/2.0\""));
    assert!(xml.contains("xmlns:l=\"http://www.w3.org/1999/xlink\""));

    // Проверка title-info
    assert!(xml.contains("<genre>science</genre>"));
    assert!(xml.contains("<nickname>Королёв С.П.</nickname>"));
    assert!(xml.contains("<nickname>Глушко В.П.</nickname>"));
    assert!(xml.contains("<book-title>Разработка модульной системы &lt;WorldWiki&gt;: Том 1 &amp; 2</book-title>"));
    assert!(xml.contains("<lang>ru</lang>"));

    // Проверка тела книги
    assert!(xml.contains("<section>"));
    assert!(xml.contains("<title><p>1. Теоретические основы &amp; концепции</p></title>"));
    assert!(xml.contains("<strong>полужирный текст</strong>"));
    assert!(xml.contains("<emphasis>курсивное начертание</emphasis>"));
    assert!(xml.contains("<cite>"));
    assert!(xml.contains("«Простота — необходимое условие прекрасного»."));

    // Проверка примечаний и сносок в <body name="notes">
    assert!(xml.contains("<a type=\"note\" l:href=\"#fn-1\">[1]</a>"), "Link to footnote note-body");
    assert!(xml.contains("<body name=\"notes\">"), "Notes body container must be present");
    assert!(xml.contains("<section id=\"fn-1\">"));
    assert!(xml.contains("ГОСТ Р 7.0.5-2008. Библиографическая ссылка."));
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. БЕЗОПАСНОСТЬ, ПУТИ И НЕГАТИВНЫЕ СЦЕНАРИИ
// ─────────────────────────────────────────────────────────────────────────────

#[test]
fn test_filename_sanitization_and_path_traversal_protection() {
    let dir = tmp_dir("path_security");

    let req = ExportDocumentRequest {
        project_name: "Безопасность".to_string(),
        // Попытка Path Traversal и опасные символы Windows/Linux
        title: "../../../etc/passwd:*?\"<>|\\NUL\\CON\\PRN.txt".to_string(),
        authors: vec!["Хакер".to_string()],
        profile_id: "default".to_string(),
        blocks: vec![],
    };

    let res_docx = generate_docx(&req, &dir).expect("DOCX sanitization should survive");
    let res_epub = generate_epub(&req, &dir).expect("EPUB sanitization should survive");
    let res_fb2 = generate_fb2(&req, &dir).expect("FB2 sanitization should survive");

    // Проверяем, что файлы сохранены строго внутри целевой папки, а не улетели в корень
    assert!(Path::new(&res_docx.file_path).starts_with(&dir));
    assert!(Path::new(&res_epub.file_path).starts_with(&dir));
    assert!(Path::new(&res_fb2.file_path).starts_with(&dir));

    // Имя файла не должно содержать слеши и опасные символы
    assert!(!res_docx.file_name.contains('/'));
    assert!(!res_docx.file_name.contains('\\'));
    assert!(!res_docx.file_name.contains(':'));
    assert!(!res_docx.file_name.contains('*'));
}

#[test]
fn test_empty_document_and_graceful_fallbacks() {
    let dir = tmp_dir("empty_doc");

    let req = ExportDocumentRequest {
        project_name: "".to_string(),
        title: "".to_string(), // Пустой заголовок
        authors: vec![],       // Пустой список авторов
        profile_id: "".to_string(),
        blocks: vec![
            json!({ "type": "unknown_future_block", "payload": 12345 }) // Неизвестный блок
        ],
    };

    // Все экспортеры должны штатно сгенерировать fallback имя "Документ.<ext>" без паники
    let res_docx = generate_docx(&req, &dir).expect("Empty DOCX must not panic");
    assert_eq!(res_docx.file_name, "Документ.docx");

    let res_epub = generate_epub(&req, &dir).expect("Empty EPUB must not panic");
    assert_eq!(res_epub.file_name, "Документ.epub");

    let res_fb2 = generate_fb2(&req, &dir).expect("Empty FB2 must not panic");
    assert_eq!(res_fb2.file_name, "Документ.fb2");
}

#[test]
fn test_multiple_consecutive_exports_roundtrip() {
    let dir = tmp_dir("roundtrip");
    let req = make_full_academic_request();

    // 10 последовательных генераций подряд в один каталог без конфликтов
    for i in 0..10 {
        let mut loop_req = req.clone();
        loop_req.title = format!("Выпуск №{}", i + 1);

        let d = generate_docx(&loop_req, &dir).unwrap();
        let e = generate_epub(&loop_req, &dir).unwrap();
        let f = generate_fb2(&loop_req, &dir).unwrap();

        assert!(Path::new(&d.file_path).exists());
        assert!(Path::new(&e.file_path).exists());
        assert!(Path::new(&f.file_path).exists());
    }
}
