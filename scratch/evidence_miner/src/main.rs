use regex::{Regex, RegexSet};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::{HashMap, HashSet};
use std::fs;
use std::path::Path;
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Duration;

#[derive(Debug, Clone, Serialize, Deserialize)]
struct EvidenceItem {
    platform: String,
    source_context: String,
    author: String,
    score: i64,
    url: String,
    title: String,
    excerpt: String,
    matched_clusters: Vec<String>,
    matched_tools: Vec<String>,
    matched_pains: Vec<String>,
    relevance_score: f64,
}

struct ClusterDef {
    id: &'static str,
    name: &'static str,
    ww_feature: &'static str,
    pattern: &'static str,
}

const CLUSTERS: &[ClusterDef] = &[
    ClusterDef {
        id: "C1",
        name: "Кастомные календари, негригорианское летоисчисление и шкала времени",
        ww_feature: "Шкала абсолютной минуты (M_abs), проекционные мультикалендари, мгновенный пересчёт дат, XboxWheel",
        pattern: r"(?i)\b(custom\s+calendar\w*|fantasy\s+calendar\w*|fictional\s+calendar\w*|in-?universe\s+calendar\w*|non-?gregorian|calendarium|aeon\s+timeline|lunar\s+cycle\w*|two\s+moons|multiple\s+moons|own\s+calendar|timekeeping|custom\s+months|leap\s+year\w*|calendar\s+system\w*|календар\w*|летоисчислени\w*|фаз\w*\s+лун\w*)\b",
    },
    ClusterDef {
        id: "C2",
        name: "Нелинейное время (Время мира vs Время чтения), флешбэки и контроль спойлеров",
        ww_feature: "Разделение Diegetic Time (M_abs) и Narrative Time (revealed_in), TimelineInspector с «Режимом читателя»",
        pattern: r"(?i)\b(non-?linear\s+(timeline|story|narrative|plot|structure)|chronological\s+order|narrative\s+order|reading\s+order|flashback\w*|what\s+the\s+reader\s+knows|reader\s+knows|out\s+of\s+order|multiple\s+pov\w*|pov\s+timeline|нелинейн\w*|порядок\s+глав|флешбэк\w*|спойлер\w*)\b",
    },
    ClusterDef {
        id: "C3",
        name: "Отслеживание «чеховских ружей», сюжетных линий и цепочки владения предметами",
        ww_feature: "ChekhovGunTracker (Active / Sleeping 5+ / Forgotten 10+ / DestroyedOrLost), Item Journey, AuditServices::audit_volume",
        pattern: r"(?i)\b(chekhov'?s?\s+gun\w*|plot\s+thread\w*|subplot\w*|unresolved\s+(plot|thread|arc)\w*|dropped\s+(plot|thread)\w*|foreshadow\w*|loose\s+end\w*|plot\s+hole\w*|continuity\s+(error|issue|problem|track)\w*|track\w*\s+inventory|item\s+ownership|character\s+inventory|who\s+has\s+(the|what)|чеховск\w*\s+руж\w*|сюжетн\w*\s+(лини\w*|хвост\w*|дыр\w*|арк\w*)|забыт\w*\s+(руж\w*|лини\w*|предмет\w*)|инвентар\w*)\b",
    },
    ClusterDef {
        id: "C4",
        name: "Присутствие по главам, гибель/билокация и эволюция отношений во времени",
        ww_feature: "CrossReferenceMatrix (is_deceased, hasGapWarning), CharacterJourney, check_bilocation / check_death_violation, привязка entity_rel к главам (start_at..end_at)",
        pattern: r"(?i)\b(two\s+places\s+at\s+once|bilocation|already\s+dead|forgot\s+(about\s+)?a?\s*character|disappeared\s+for\s+\d+|character\s+matrix|scene\s+tracker|which\s+chapter\s+a\s+character|relationship\w*\s+(over\s+time|by\s+chapter|change\w*|evolv\w*|evolution|dynamic\w*|track\w*|chart\w*|map\w*)|track\w*\s+relationship\w*|character\s+presence|эволюци\w*\s+отношени\w*|меняются\s+отношени\w*|в\s+двух\s+местах|уже\s+мертв\w*|уже\s+погиб\w*|матриц\w*\s+персонаж\w*)\b",
    },
    ClusterDef {
        id: "C5",
        name: "Разрыв между рукописью и базой лора («Франкенштейн из 3 программ» и плагинный ад)",
        ww_feature: "Синтаксис ((Имя)) + Ctrl+Q в тексте, автосканирование участников главы при Ctrl+S, мультисплит и плавающие окна",
        pattern: r"(?i)\b((scrivener|word|docs)\s+(and|with|\+|plus|vs|to)\s+(obsidian|world\s*anvil|notion|aeon)|switch\w*\s+between\s+(apps|programs|tools)|keep\s+(track\s+of\s+)?lore|too\s+many\s+plugins|dataview|longform\s+plugin|multiple\s+apps|separate\s+app\w*|two\s+different\s+apps|story\s+bible\s+(in|app|software|template)|между\s+программами|текст\s+отдельно|лор\s+отдельно|куч\w*\s+плагинов|зоопарк\w*)\b",
    },
    ClusterDef {
        id: "C6",
        name: "Тормоза облачных редакторов на больших книгах, зависимость от сети и хрупкость схем",
        ww_feature: "Local-First (встроенная SurrealDB / SurrealKV без сети), архивы .wwiki, защищённые системные поля + динамические entity_schemas",
        pattern: r"(?i)\b((notion|world\s*anvil|worldanvil|google\s*docs|word|logseq|aeon\s+timeline|scrivener)\s+.{0,70}\b(lag\w*|slow\w*|crash\w*|freez\w*|clunky|offline|50k|100k|large\s+doc\w*|paywall\w*)|offline\s+mode|yaml\s+frontmatter|тормоз\w*|лага\w*|без\s+интернета|офлайн)\b",
    },
];

const REGEX_TOOLS: &str = r"(?i)\b(obsidian|scrivener|world\s*anvil|worldanvil|notion|logseq|ms\s+word|microsoft\s+word|google\s+docs|google\s+sheets|excel|aeon\s+timeline|campfire|fantasia\s+archive|legendkeeper|onenote)\b";
const REGEX_WRITING_CTX: &str = r"(?i)\b(novel|manuscript|chapter|scene|story\s+bible|worldbuilding|world\s+building|lore|writing|author|writer|book|draft|timeline|calendar|wiki|plugin|app|software|tool|spreadsheet|excel|роман|книг|глав|сцен|лор|рукопис|программ)\b";
const REGEX_PAIN: &str = r"(?i)\b(wish\w*|hate\w*|annoy\w*|frustrat\w*|nightmare\w*|pain\w*|headache\w*|struggl\w*|hard\s+to|difficult\s+to|lose\s+track|lost\s+track|losing\s+track|spreadsheet\w*|excel|workaround\w*|clunky|overwhelm\w*|doesn'?t\s+support|can'?t\s+handle|broken|messy|tedious|cumbersome|limitation\w*|lag\w*|slow\w*|forgot\w*|forget\w*|sync\s+issue\w*|issue\w*\s+with|не\s+хватает|бесит|неудобн\w*|костыл\w*|приходится|пута\w*|теря\w*|проблем\w*|сложн\w*|баг\w*)\b";

struct Analyzer {
    cluster_set: RegexSet,
    cluster_regexes: Vec<Regex>,
    tool_regex: Regex,
    ctx_regex: Regex,
    pain_regex: Regex,
    html_tag_regex: Regex,
}

impl Analyzer {
    fn new() -> Self {
        let patterns: Vec<&str> = CLUSTERS.iter().map(|c| c.pattern).collect();
        let cluster_set = RegexSet::new(&patterns).expect("valid cluster regex set");
        let cluster_regexes = patterns
            .iter()
            .map(|p| Regex::new(p).expect("valid regex"))
            .collect();
        Self {
            cluster_set,
            cluster_regexes,
            tool_regex: Regex::new(REGEX_TOOLS).unwrap(),
            ctx_regex: Regex::new(REGEX_WRITING_CTX).unwrap(),
            pain_regex: Regex::new(REGEX_PAIN).unwrap(),
            html_tag_regex: Regex::new(r"<[^>]+>").unwrap(),
        }
    }

    fn clean_text(&self, raw: &str) -> String {
        let no_html = self.html_tag_regex.replace_all(raw, " ");
        no_html
            .replace("&quot;", "\"")
            .replace("&#39;", "'")
            .replace("&amp;", "&")
            .replace("&gt;", ">")
            .replace("&lt;", "<")
            .replace("&#x27;", "'")
            .split_whitespace()
            .collect::<Vec<_>>()
            .join(" ")
    }

    fn evaluate(
        &self,
        platform: &str,
        source_context: &str,
        author: &str,
        score: i64,
        url: &str,
        title: &str,
        raw_body: &str,
    ) -> Option<EvidenceItem> {
        let clean_body = self.clean_text(raw_body);
        if clean_body.len() < 90 || clean_body == "[deleted]" || clean_body == "[removed]" {
            return None;
        }
        let full_text = format!("{} — {}", self.clean_text(title), clean_body);

        // Обязательно должен быть писательский/софтовый контекст
        if !self.ctx_regex.is_match(&full_text) {
            return None;
        }

        let matches: Vec<usize> = self.cluster_set.matches(&full_text).into_iter().collect();
        if matches.is_empty() {
            return None;
        }

        let mut matched_tools: Vec<String> = self
            .tool_regex
            .find_iter(&full_text)
            .map(|m| m.as_str().to_lowercase())
            .collect();
        matched_tools.sort();
        matched_tools.dedup();

        let mut matched_pains: Vec<String> = self
            .pain_regex
            .find_iter(&full_text)
            .map(|m| m.as_str().to_lowercase())
            .collect();
        matched_pains.sort();
        matched_pains.dedup();

        // Требуем либо явный маркер боли, либо упоминание конкретного инструмента-аналога
        if matched_pains.is_empty() && matched_tools.is_empty() {
            return None;
        }

        let matched_clusters: Vec<String> = matches
            .iter()
            .map(|&idx| CLUSTERS[idx].id.to_string())
            .collect();

        let first_idx = matches[0];
        let excerpt = if let Some(m) = self.cluster_regexes[first_idx].find(&full_text) {
            let start_byte = full_text
                .char_indices()
                .rev()
                .find(|&(i, _)| i <= m.start().saturating_sub(240))
                .map(|(i, _)| i)
                .unwrap_or(0);
            let end_byte = full_text
                .char_indices()
                .find(|&(i, _)| i >= (m.end() + 380).min(full_text.len()))
                .map(|(i, _)| i)
                .unwrap_or(full_text.len());
            let mut slice = full_text[start_byte..end_byte].trim().to_string();
            if start_byte > 0 {
                slice = format!("…{}", slice);
            }
            if end_byte < full_text.len() {
                slice.push('…');
            }
            slice
        } else {
            full_text.chars().take(500).collect()
        };

        let relevance_score = (matched_clusters.len() as f64) * 10.0
            + (matched_tools.len().min(3) as f64) * 7.0
            + (matched_pains.len().min(4) as f64) * 5.0
            + (score.clamp(0, 100) as f64) * 0.2;

        Some(EvidenceItem {
            platform: platform.to_string(),
            source_context: source_context.to_string(),
            author: author.to_string(),
            score,
            url: url.to_string(),
            title: self.clean_text(title),
            excerpt,
            matched_clusters,
            matched_tools,
            matched_pains,
            relevance_score,
        })
    }
}

fn build_agent() -> ureq::Agent {
    let tls = native_tls::TlsConnector::new().expect("native tls connector");
    ureq::AgentBuilder::new()
        .tls_connector(Arc::new(tls))
        .timeout(Duration::from_secs(12))
        .build()
}

fn http_get_json(url: &str) -> Option<Value> {
    let agent = build_agent();
    let mut backoff_ms = 2000u64;

    for attempt in 0..4 {
        let resp = agent
            .get(url)
            .set(
                "User-Agent",
                "windows:worldwiki.evidence.miner:v3.1 (by /u/worldwiki_research)",
            )
            .set("Accept", "application/json")
            .call();

        match resp {
            Ok(r) => return r.into_json::<Value>().ok(),
            Err(ureq::Error::Status(429, r)) => {
                let wait_secs = r
                    .header("retry-after")
                    .and_then(|v| v.parse::<u64>().ok())
                    .unwrap_or(backoff_ms / 1000)
                    .clamp(1, 15);
                if attempt < 3 {
                    println!(
                        "[429 RateLimit] Sleeping {}s before retry ({})...",
                        wait_secs, url
                    );
                    thread::sleep(Duration::from_secs(wait_secs));
                    backoff_ms *= 2;
                    continue;
                }
                eprintln!("[WARN] Failed GET {} after retries: 429", url);
                return None;
            }
            Err(e) => {
                eprintln!("[WARN] Failed GET {}: {}", url, e);
                return None;
            }
        }
    }
    None
}

fn push_item(
    shared_out: &Mutex<Vec<EvidenceItem>>,
    seen_urls: &Mutex<HashSet<String>>,
    item: EvidenceItem,
) {
    let mut seen = seen_urls.lock().unwrap();
    if seen.insert(item.url.clone()) {
        drop(seen);
        shared_out.lock().unwrap().push(item);
    }
}

/// Двухшаговый глубокий сбор с Reddit через Arctic Shift API:
/// Шаг 1: Ищем релевантные треды по title= и selftext= в 13 писательских сабреддитах
/// Шаг 2: Для каждого найденного треда выкачиваем ветку комментариев по link_id= (до 100 шт.)
/// Шаг 3: Добираем точечные комментарии по body=
fn mine_reddit_deep(
    analyzer: &Analyzer,
    seen_urls: &Mutex<HashSet<String>>,
    shared_out: &Mutex<Vec<EvidenceItem>>,
) {
    // (subreddit, title_or_selftext_keyword)
    let thread_searches: &[(&str, &str)] = &[
        // C1: Кастомные календари
        ("worldbuilding", "calendar"),
        ("worldbuilding", "Aeon Timeline"),
        ("fantasywriters", "calendar"),
        ("scifiwriting", "calendar"),
        ("ObsidianMD", "Calendarium"),
        ("ObsidianMD", "fantasy calendar"),
        // C2: Нелинейное время и спойлеры
        ("writing", "non-linear"),
        ("writing", "chronological"),
        ("writers", "flashbacks"),
        ("fantasywriters", "timeline"),
        // C3: Чеховские ружья, сюжетные линии, инвентарь
        ("writing", "plot threads"),
        ("writing", "Chekhov"),
        ("writers", "plot holes"),
        ("litrpg", "inventory"),
        ("ProgressionFantasy", "tracking"),
        ("fantasywriters", "foreshadowing"),
        // C4: Присутствие, гибель, эволюция отношений
        ("writing", "relationships"),
        ("writing", "continuity"),
        ("writers", "character arc"),
        ("FanFiction", "timeline"),
        // C5: Зоопарк софта и плагинов
        ("ObsidianMD", "Scrivener"),
        ("ObsidianMD", "Longform"),
        ("ObsidianMD", "worldbuilding"),
        ("scrivener", "Obsidian"),
        ("scrivener", "timeline"),
        ("writing", "story bible"),
        // C6: Тормоза World Anvil, Notion, Logseq
        ("WorldAnvil", "slow"),
        ("WorldAnvil", "Obsidian"),
        ("Notion", "novel"),
        ("logseq", "writing"),
    ];

    // post_id -> (subreddit, post_title)
    let discovered_posts: Mutex<HashMap<String, (String, String)>> = Mutex::new(HashMap::new());

    // Шаг 1: ищем посты по title= (Arctic Shift держит ~1-2 req/sec, поэтому идём ровно с паузой 650ms и limit=100)
    for &(sub, q) in thread_searches {
        let enc = urlencoding::encode(q);
        let url = format!(
            "https://arctic-shift.photon-reddit.com/api/posts/search?subreddit={}&title={}&limit=100&sort=desc",
            sub, enc
        );
        println!("[Reddit Posts] r/{} title='{}'", sub, q);
        if let Some(json) = http_get_json(&url) {
            if let Some(arr) = json["data"].as_array() {
                for data in arr {
                    let id = data["id"].as_str().unwrap_or("");
                    let title = data["title"].as_str().unwrap_or("");
                    let selftext = data["selftext"].as_str().unwrap_or("");
                    let author = data["author"].as_str().unwrap_or("redditor");
                    let score = data["score"].as_i64().unwrap_or(1);
                    let permalink = data["permalink"].as_str().unwrap_or("");
                    if id.is_empty() {
                        continue;
                    }

                    {
                        let mut map = discovered_posts.lock().unwrap();
                        if map.len() < 25 && !map.contains_key(id) {
                            map.insert(id.to_string(), (sub.to_string(), title.to_string()));
                        }
                    }

                    let full_url = if !permalink.is_empty() {
                        format!("https://www.reddit.com{}", permalink)
                    } else {
                        format!("https://www.reddit.com/r/{}/comments/{}", sub, id)
                    };
                    if let Some(item) = analyzer.evaluate(
                        "Reddit (Post)",
                        &format!("r/{}", sub),
                        author,
                        score,
                        &full_url,
                        title,
                        selftext,
                    ) {
                        push_item(shared_out, seen_urls, item);
                    }
                }
            }
        }
        thread::sleep(Duration::from_millis(650));
    }

    // Шаг 2: выкачиваем комментарии ВНУТРИ найденных тредов (t3_ + limit=100)
    let posts_vec: Vec<(String, String, String)> = discovered_posts
        .into_inner()
        .unwrap()
        .into_iter()
        .map(|(id, (sub, title))| (id, sub, title))
        .collect();

    println!(
        "[Reddit Deep] Fetching comment trees for {} discovered threads...",
        posts_vec.len()
    );

    for (post_id, sub, post_title) in &posts_vec {
        let url = format!(
            "https://arctic-shift.photon-reddit.com/api/comments/search?link_id=t3_{}&limit=100&sort=desc",
            post_id
        );
        if let Some(json) = http_get_json(&url) {
            if let Some(arr) = json["data"].as_array() {
                for data in arr {
                    let body = data["body"].as_str().unwrap_or("");
                    let author = data["author"].as_str().unwrap_or("redditor");
                    let score = data["score"].as_i64().unwrap_or(1);
                    let permalink = data["permalink"].as_str().unwrap_or("");
                    let cid = data["id"].as_str().unwrap_or("");
                    let full_url = if !permalink.is_empty() {
                        format!("https://www.reddit.com{}", permalink)
                    } else if !cid.is_empty() {
                        format!(
                            "https://www.reddit.com/r/{}/comments/{}/_/{}",
                            sub, post_id, cid
                        )
                    } else {
                        continue;
                    };
                    if let Some(item) = analyzer.evaluate(
                        "Reddit (Comment)",
                        &format!("r/{}", sub),
                        author,
                        score,
                        &full_url,
                        post_title,
                        body,
                    ) {
                        push_item(shared_out, seen_urls, item);
                    }
                }
            }
        }
        thread::sleep(Duration::from_millis(650));
    }

    // Шаг 3: прямой поиск по комментариям (body=) по самым узким фразам (limit=100)
    let comment_phrases: &[(&str, &str)] = &[
        ("worldbuilding", "custom calendar"),
        ("worldbuilding", "Aeon Timeline"),
        ("writing", "story bible"),
        ("writing", "plot threads"),
        ("writing", "Chekhov"),
        ("writing", "chronological order"),
        ("fantasywriters", "track"),
        ("ObsidianMD", "Scrivener"),
        ("ObsidianMD", "Dataview"),
        ("WorldAnvil", "clunky"),
        ("Notion", "lag"),
    ];

    for &(sub, q) in comment_phrases {
        let enc = urlencoding::encode(q);
        let url = format!(
            "https://arctic-shift.photon-reddit.com/api/comments/search?subreddit={}&body={}&limit=100&sort=desc",
            sub, enc
        );
        println!("[Reddit Comments] r/{} body='{}'", sub, q);
        if let Some(json) = http_get_json(&url) {
            if let Some(arr) = json["data"].as_array() {
                for data in arr {
                    let body = data["body"].as_str().unwrap_or("");
                    let author = data["author"].as_str().unwrap_or("redditor");
                    let score = data["score"].as_i64().unwrap_or(1);
                    let permalink = data["permalink"].as_str().unwrap_or("");
                    let link_id = data["link_id"]
                        .as_str()
                        .unwrap_or("")
                        .trim_start_matches("t3_");
                    let cid = data["id"].as_str().unwrap_or("");
                    let full_url = if !permalink.is_empty() {
                        format!("https://www.reddit.com{}", permalink)
                    } else if !link_id.is_empty() && !cid.is_empty() {
                        format!(
                            "https://www.reddit.com/r/{}/comments/{}/_/{}",
                            sub, link_id, cid
                        )
                    } else {
                        continue;
                    };
                    if let Some(item) = analyzer.evaluate(
                        "Reddit (Comment)",
                        &format!("r/{}", sub),
                        author,
                        score,
                        &full_url,
                        &format!("r/{} ('{}')", sub, q),
                        body,
                    ) {
                        push_item(shared_out, seen_urls, item);
                    }
                }
            }
        }
        thread::sleep(Duration::from_millis(650));
    }
}

/// Двухшаговый сбор со StackExchange (writing + worldbuilding): вопросы + все ответы к ним
fn mine_stackexchange(
    analyzer: &Analyzer,
    seen_urls: &Mutex<HashSet<String>>,
    shared_out: &Mutex<Vec<EvidenceItem>>,
) {
    let queries: &[(&str, &str)] = &[
        ("writing", "timeline software"),
        ("writing", "plot threads"),
        ("writing", "non-linear"),
        ("writing", "character relationships"),
        ("writing", "scrivener"),
        ("writing", "story bible"),
        ("worldbuilding", "custom calendar"),
        ("worldbuilding", "timeline software"),
        ("worldbuilding", "wiki software"),
    ];

    // site -> Vec<(question_id, question_title, question_link)>
    let q_map: Mutex<HashMap<String, Vec<(i64, String, String)>>> = Mutex::new(HashMap::new());

    thread::scope(|s| {
        for chunk in queries.chunks(3) {
            let q_map_ref = &q_map;
            s.spawn(move || {
                for &(site, q) in chunk {
                    let enc = urlencoding::encode(q);
                    let url = format!(
                        "https://api.stackexchange.com/2.3/search/advanced?order=desc&sort=votes&q={}&site={}&filter=withbody&pagesize=20",
                        enc, site
                    );
                    println!("[StackExchange Questions] {} -> '{}'", site, q);
                    if let Some(json) = http_get_json(&url) {
                        if let Some(items) = json["items"].as_array() {
                            for it in items {
                                let qid = it["question_id"].as_i64().unwrap_or(0);
                                let title = it["title"].as_str().unwrap_or("");
                                let body = it["body"].as_str().unwrap_or("");
                                let score = it["score"].as_i64().unwrap_or(0);
                                let link = it["link"].as_str().unwrap_or("");
                                let author = it
                                    .pointer("/owner/display_name")
                                    .and_then(|v| v.as_str())
                                    .unwrap_or("writer");

                                if qid > 0 && !link.is_empty() {
                                    let mut map = q_map_ref.lock().unwrap();
                                    let entry = map.entry(site.to_string()).or_default();
                                    if !entry.iter().any(|(id, _, _)| *id == qid) {
                                        entry.push((qid, title.to_string(), link.to_string()));
                                    }
                                }

                                if !link.is_empty() {
                                    if let Some(item) = analyzer.evaluate(
                                        "StackExchange (Question)",
                                        &format!("{}.stackexchange.com", site),
                                        author,
                                        score,
                                        link,
                                        title,
                                        body,
                                    ) {
                                        push_item(shared_out, seen_urls, item);
                                    }
                                }
                            }
                        }
                    }
                }
            });
        }
    });

    // Шаг 2: пакетно забираем ответы на найденные вопросы
    let site_questions = q_map.into_inner().unwrap();
    for (site, qs) in site_questions {
        let meta: HashMap<i64, (String, String)> = qs
            .iter()
            .map(|(id, title, link)| (*id, (title.clone(), link.clone())))
            .collect();

        for chunk in qs.chunks(25) {
            let ids_str = chunk
                .iter()
                .map(|(id, _, _)| id.to_string())
                .collect::<Vec<_>>()
                .join(";");
            let url = format!(
                "https://api.stackexchange.com/2.3/questions/{}/answers?order=desc&sort=votes&site={}&filter=withbody&pagesize=100",
                ids_str, site
            );
            println!(
                "[StackExchange Answers] {} ({} questions)",
                site,
                chunk.len()
            );
            if let Some(json) = http_get_json(&url) {
                if let Some(items) = json["items"].as_array() {
                    for it in items {
                        let qid = it["question_id"].as_i64().unwrap_or(0);
                        let aid = it["answer_id"].as_i64().unwrap_or(0);
                        let body = it["body"].as_str().unwrap_or("");
                        let score = it["score"].as_i64().unwrap_or(0);
                        let author = it
                            .pointer("/owner/display_name")
                            .and_then(|v| v.as_str())
                            .unwrap_or("writer");
                        let (q_title, q_link) = meta
                            .get(&qid)
                            .cloned()
                            .unwrap_or_else(|| ("StackExchange Q".to_string(), "".to_string()));
                        let ans_link = if !q_link.is_empty() && aid > 0 {
                            format!("{}#{}", q_link, aid)
                        } else {
                            format!("https://{}.stackexchange.com/a/{}", site, aid)
                        };
                        if let Some(item) = analyzer.evaluate(
                            "StackExchange (Answer)",
                            &format!("{}.stackexchange.com", site),
                            author,
                            score,
                            &ans_link,
                            &q_title,
                            body,
                        ) {
                            push_item(shared_out, seen_urls, item);
                        }
                    }
                }
            }
        }
    }
}

fn mine_hn(
    analyzer: &Analyzer,
    seen_urls: &Mutex<HashSet<String>>,
    shared_out: &Mutex<Vec<EvidenceItem>>,
) {
    let queries: &[&str] = &[
        "scrivener obsidian",
        "world anvil",
        "notion lag slow",
        "novel writing timeline",
        "scrivener worldbuilding",
        "chekhov gun plot",
        "story bible software",
        "aeon timeline",
    ];

    thread::scope(|s| {
        for chunk in queries.chunks(2) {
            s.spawn(move || {
                for &q in chunk {
                    let enc = urlencoding::encode(q);
                    let url = format!(
                        "https://hn.algolia.com/api/v1/search?query={}&tags=comment&hitsPerPage=40",
                        enc
                    );
                    println!("[HackerNews] Searching '{}'", q);
                    if let Some(json) = http_get_json(&url) {
                        if let Some(hits) = json["hits"].as_array() {
                            for h in hits {
                                let comment_text = h["comment_text"].as_str().unwrap_or("");
                                let story_title =
                                    h["story_title"].as_str().unwrap_or("HN Discussion");
                                let author = h["author"].as_str().unwrap_or("hn_user");
                                let object_id = h["objectID"].as_str().unwrap_or("");
                                let points = h["points"].as_i64().unwrap_or(1);
                                if object_id.is_empty() {
                                    continue;
                                }
                                let link =
                                    format!("https://news.ycombinator.com/item?id={}", object_id);
                                if let Some(item) = analyzer.evaluate(
                                    "Hacker News",
                                    "news.ycombinator.com",
                                    author,
                                    points,
                                    &link,
                                    story_title,
                                    comment_text,
                                ) {
                                    push_item(shared_out, seen_urls, item);
                                }
                            }
                        }
                    }
                }
            });
        }
    });
}

fn mine_habr(
    analyzer: &Analyzer,
    seen_urls: &Mutex<HashSet<String>>,
    shared_out: &Mutex<Vec<EvidenceItem>>,
) {
    let article_ids: Mutex<Vec<(String, String)>> = Mutex::new(vec![(
        "1107932".to_string(),
        "Роман как сложная система: применяем стиль разработки ПО к написанию художественного произведения".to_string(),
    )]);

    let search_queries: &[&str] = &[
        "scrivener obsidian книга",
        "obsidian для писателя",
        "чеховские ружья роман",
        "world anvil лор",
        "программы для написания книг",
    ];

    thread::scope(|s| {
        for &q in search_queries {
            let article_ids_ref = &article_ids;
            s.spawn(move || {
                let enc = urlencoding::encode(q);
                let url = format!("https://habr.com/kek/v2/articles/?query={}&fl=ru", enc);
                println!("[Habr] Searching '{}'", q);
                if let Some(json) = http_get_json(&url) {
                    if let Some(refs) = json["articleRefs"].as_object() {
                        for (id, art) in refs.iter().take(6) {
                            let title = art["titleHtml"].as_str().unwrap_or("Статья на Хабре");
                            let clean_title = analyzer.clean_text(title);
                            let mut lock = article_ids_ref.lock().unwrap();
                            if !lock.iter().any(|(x, _)| x == id) {
                                lock.push((id.clone(), clean_title));
                            }
                        }
                    }
                }
            });
        }
    });

    let articles = article_ids.into_inner().unwrap();
    thread::scope(|s| {
        for chunk in articles.chunks(5) {
            s.spawn(move || {
                for (art_id, art_title) in chunk {
                    let comm_url = format!("https://habr.com/kek/v2/articles/{}/comments/", art_id);
                    println!("[Habr Comments] Fetching article {} ({})", art_id, art_title);
                    if let Some(json) = http_get_json(&comm_url) {
                        if let Some(comments) = json["comments"].as_object() {
                            for (cid, c) in comments {
                                let msg = c["message"].as_str().unwrap_or("");
                                let score = c["score"].as_i64().unwrap_or(0);
                                let author = c
                                    .pointer("/author/alias")
                                    .and_then(|v| v.as_str())
                                    .unwrap_or("habr_user");
                                let link = format!(
                                    "https://habr.com/ru/articles/{}/comments/#comment_{}",
                                    art_id, cid
                                );
                                if let Some(item) = analyzer.evaluate(
                                    "Habr (Comment)",
                                    &format!("habr.com/ru/articles/{}", art_id),
                                    author,
                                    score,
                                    &link,
                                    art_title,
                                    msg,
                                ) {
                                    push_item(shared_out, seen_urls, item);
                                }
                            }
                        }
                    }
                }
            });
        }
    });
}

fn generate_markdown_report(items: &[EvidenceItem], out_dir: &Path) {
    let mut md = String::new();
    md.push_str("# Эмпирическая база пользовательских болей писателей (Reddit, StackExchange, Habr, HN)\n\n");
    md.push_str("> **Назначение документа:** Сборник реальных цитат, тредов и комментариев писателей и ворлдбилдеров с прямыми ссылками для аргументации актуальности и анализа аналогов (`2.5_Анализ_аналогов.md`) на защите курсового проекта.\n");
    md.push_str("> Все цитаты автоматически отобраны двухконтурным Regex-фильтром строго под **реализованные функции WorldWiki** (без фич из бэклога).\n\n");
    md.push_str(&format!(
        "**Всего отобрано уникальных релевантных свидетельств:** `{}`\n\n---\n\n",
        items.len()
    ));

    for cluster in CLUSTERS {
        let mut cluster_items: Vec<&EvidenceItem> = items
            .iter()
            .filter(|i| i.matched_clusters.iter().any(|c| c == cluster.id))
            .collect();
        cluster_items.sort_by(|a, b| {
            b.relevance_score
                .partial_cmp(&a.relevance_score)
                .unwrap_or(std::cmp::Ordering::Equal)
        });

        md.push_str(&format!("## {}. {}\n\n", cluster.id, cluster.name));
        md.push_str(&format!(
            "- **Чем закрыто в WorldWiki:** {}\n",
            cluster.ww_feature
        ));
        md.push_str(&format!(
            "- **Найдено обсуждений/комментариев:** `{}` (показаны топ-25 по релевантности)\n\n",
            cluster_items.len()
        ));

        for (idx, item) in cluster_items.iter().take(25).enumerate() {
            let tools_badge = if item.matched_tools.is_empty() {
                "обсуждение процесса".to_string()
            } else {
                item.matched_tools.join(", ")
            };
            md.push_str(&format!(
                "### {}.{} [{}] {} — *{}* (👍 {}, автор: `{}`)\n",
                cluster.id,
                idx + 1,
                item.platform,
                item.title,
                item.source_context,
                item.score,
                item.author
            ));
            md.push_str(&format!("- **Прямая ссылка:** {}\n", item.url));
            md.push_str(&format!(
                "- **Упомянутые аналоги:** `{}` | **Маркеры боли:** `{}`\n",
                tools_badge,
                if item.matched_pains.is_empty() {
                    "—".to_string()
                } else {
                    item.matched_pains.join(", ")
                }
            ));
            md.push_str(&format!("> «{}»\n\n", item.excerpt));
        }

        md.push_str("---\n\n");
    }

    let md_path = out_dir.join("reddit_evidence_report.md");
    fs::write(&md_path, md).expect("write markdown report");
    println!("[DONE] Markdown report written to: {}", md_path.display());

    let json_path = out_dir.join("raw_matches.json");
    let json_str = serde_json::to_string_pretty(items).expect("serialize json");
    fs::write(&json_path, json_str).expect("write json report");
    println!("[DONE] Raw JSON written to: {}", json_path.display());
}

fn main() {
    let analyzer = Analyzer::new();
    let seen_urls = Mutex::new(HashSet::new());
    let results = Mutex::new(Vec::new());

    thread::scope(|s| {
        s.spawn(|| mine_reddit_deep(&analyzer, &seen_urls, &results));
        s.spawn(|| mine_stackexchange(&analyzer, &seen_urls, &results));
        s.spawn(|| mine_hn(&analyzer, &seen_urls, &results));
        s.spawn(|| mine_habr(&analyzer, &seen_urls, &results));
    });

    let mut final_results = results.into_inner().unwrap();
    final_results.sort_by(|a, b| {
        b.relevance_score
            .partial_cmp(&a.relevance_score)
            .unwrap_or(std::cmp::Ordering::Equal)
    });

    let out_dir = Path::new(r"c:\Users\Kuzma\Desktop\WorldWiki\docs\coursework\evidence");
    fs::create_dir_all(out_dir).expect("create output directory");
    generate_markdown_report(&final_results, out_dir);
}
