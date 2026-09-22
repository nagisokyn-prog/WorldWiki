pub struct RetrievalCandidate {
    pub source_type: String,
    pub title: String,
    pub snippet: String,
    pub score: f32,
    pub entity_id: Option<String>,
}

pub(crate) fn build_context_xml(
    candidates: &[RetrievalCandidate],
    relations_xml: &str,
) -> String {
    let mut ctx = String::from("<world_context>\n");
    for c in candidates {
        if c.snippet.trim().is_empty() {
            continue;
        }
        ctx.push_str(&format!(
            "  <{type_name} title=\"{title}\">\n    {snippet}\n  </{type_name}>\n",
            type_name = c.source_type.replace(' ', "_"),
            title = c.title,
            snippet = c.snippet.trim()
        ));
    }

    if !relations_xml.is_empty() {
        ctx.push_str("  <Relationships>\n");
        ctx.push_str(relations_xml);
        ctx.push_str("  </Relationships>\n");
    }
    ctx.push_str("</world_context>");

    ctx
}
