use regex::Regex;
use std::sync::LazyLock;

static SCRIPT_RE: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"(?s)<script([^>]*)>(.*?)</script>").unwrap());
static TEMPLATE_RE: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"(?s)<template[^>]*>(.*?)</template>").unwrap());
static STYLE_RE: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"(?s)<style([^>]*)>(.*?)</style>").unwrap());
static SRC_ATTR_RE: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r#"src\s*=\s*["']([^"']+)["']"#).unwrap());

#[derive(Debug, Clone, Default)]
pub struct VueStyleBlock {
    pub content: String,
    pub src: Option<String>,
    pub scoped: bool,
    pub start_line: usize,
}

#[derive(Debug, Clone, Default)]
pub struct VueSfc {
    pub script_setup: Option<String>,
    pub script_setup_start_line: usize,
    pub script: Option<String>,
    pub template: Option<String>,
    pub styles: Vec<VueStyleBlock>,
}

pub struct VueSfcParser;

impl VueSfcParser {
    pub fn parse(content: &str) -> VueSfc {
        let mut sfc = VueSfc::default();

        // 1 & 2. Extract <script ...>...</script> blocks
        for caps in SCRIPT_RE.captures_iter(content) {
            let attrs = caps.get(1).map_or("", |m| m.as_str());
            if let Some(m) = caps.get(2) {
                let body = m.as_str().to_string();
                if attrs.contains("setup") {
                    sfc.script_setup_start_line = line_number_at_offset(content, m.start());
                    sfc.script_setup = Some(body);
                } else {
                    sfc.script = Some(body);
                }
            }
        }

        // 3. Extract <template>...</template>
        if let Some(caps) = TEMPLATE_RE.captures(content) {
            if let Some(m) = caps.get(1) {
                sfc.template = Some(m.as_str().to_string());
            }
        }

        // 4. Extract all <style ...>...</style> blocks
        for caps in STYLE_RE.captures_iter(content) {
            let attrs = caps.get(1).map_or("", |m| m.as_str());
            let body = caps.get(2).map_or("", |m| m.as_str());
            let start_line = caps.get(2).map_or(1, |m| line_number_at_offset(content, m.start()));

            let scoped = attrs.contains("scoped");
            let src = extract_attr(attrs, "src");

            sfc.styles.push(VueStyleBlock {
                content: body.to_string(),
                src,
                scoped,
                start_line,
            });
        }

        sfc
    }
}

fn line_number_at_offset(content: &str, offset: usize) -> usize {
    content.get(..offset).unwrap_or(content).chars().filter(|&c| c == '\n').count() + 1
}

fn extract_attr(attrs: &str, attr_name: &str) -> Option<String> {
    if attr_name == "src" {
        SRC_ATTR_RE.captures(attrs).and_then(|caps| caps.get(1).map(|m| m.as_str().to_string()))
    } else {
        let pattern = format!(r#"{}\s*=\s*["']([^"']+)["']"#, attr_name);
        Regex::new(&pattern).ok().and_then(|re| {
            re.captures(attrs).and_then(|caps| caps.get(1).map(|m| m.as_str().to_string()))
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_sfc_parser_comprehensive() {
        let content = r#"
<template>
    <div>Hello World</div>
</template>

<script setup lang="ts">
const x = 1;
</script>

<script lang="ts">
export default {};
</script>

<style scoped>
.hello { color: red; }
</style>

<style src="./external.css">
</style>
        "#;

        let sfc = VueSfcParser::parse(content);
        assert!(sfc.template.is_some());
        assert!(sfc.template.as_ref().unwrap().contains("<div>Hello World</div>"));
        assert!(sfc.script_setup.is_some());
        assert!(sfc.script.is_some());
        assert_eq!(sfc.styles.len(), 2);
        assert!(sfc.styles[0].scoped);
        assert_eq!(sfc.styles[1].src, Some("./external.css".to_string()));

        // Single quote src and empty SFC
        let single_quote_sfc = VueSfcParser::parse("<style src='./single.css'></style>");
        assert_eq!(single_quote_sfc.styles[0].src, Some("./single.css".to_string()));

        let empty_sfc = VueSfcParser::parse("");
        assert!(empty_sfc.template.is_none());
        assert!(empty_sfc.script.is_none());
        assert!(empty_sfc.script_setup.is_none());
        assert!(empty_sfc.styles.is_empty());
    }
}

