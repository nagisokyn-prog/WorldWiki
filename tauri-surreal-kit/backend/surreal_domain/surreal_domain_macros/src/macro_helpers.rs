use syn::Meta;

/// Extract string value from a name-value attribute e.g. #[table = "name"] or #[edge = "name"]
pub(crate) fn get_str_attr(attr: &syn::Attribute, name: &str) -> Option<String> {
    if !attr.path().is_ident(name) {
        return None;
    }
    match &attr.meta {
        Meta::NameValue(nv) => match &nv.value {
            syn::Expr::Lit(syn::ExprLit { lit: syn::Lit::Str(s), .. }) => Some(s.value()),
            _ => None,
        },
        _ => None,
    }
}

/// Extract first path segment ident string e.g. #[from = Character] -> "Character"
pub(crate) fn get_path_first_ident(attr: &syn::Attribute, name: &str) -> Option<String> {
    if !attr.path().is_ident(name) {
        return None;
    }
    match &attr.meta {
        Meta::NameValue(nv) => match &nv.value {
            syn::Expr::Path(p) => p.path.segments.first().map(|s| s.ident.to_string()),
            _ => None,
        },
        _ => None,
    }
}

/// Check and filter special macro flags on fields: fulltext, hnsw, flexible.
pub(crate) fn parse_field_flags(attrs: &[syn::Attribute]) -> (Vec<&syn::Attribute>, bool, bool, bool) {
    let mut is_fulltext = false;
    let mut is_hnsw = false;
    let mut is_flexible = false;

    let filtered = attrs
        .iter()
        .filter(|attr| match attr.path().get_ident() {
            Some(i) if i == "fulltext" => {
                is_fulltext = true;
                false
            }
            Some(i) if i == "hnsw" => {
                is_hnsw = true;
                false
            }
            Some(i) if i == "flexible" => {
                is_flexible = true;
                false
            }
            _ => true,
        })
        .collect();

    (filtered, is_fulltext, is_hnsw, is_flexible)
}
