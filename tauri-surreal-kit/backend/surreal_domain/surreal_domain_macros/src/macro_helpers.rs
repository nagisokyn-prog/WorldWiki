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

#[cfg(test)]
mod tests {
    use super::*;
    use syn::parse_quote;

    #[test]
    fn test_macro_helpers_attribute_branches() {
        // 1. get_str_attr: non-string literal value (line 11)
        let attr_non_str: syn::Attribute = parse_quote!(#[table = 123]);
        assert_eq!(get_str_attr(&attr_non_str, "table"), None);

        // 2. get_str_attr: Meta::List instead of NameValue (line 13)
        let attr_list: syn::Attribute = parse_quote!(#[table(something)]);
        assert_eq!(get_str_attr(&attr_list, "table"), None);

        // 3. get_str_attr: valid string
        let attr_valid: syn::Attribute = parse_quote!(#[table = "my_table"]);
        assert_eq!(get_str_attr(&attr_valid, "table"), Some("my_table".to_string()));

        // 4. get_path_first_ident: Meta::List instead of NameValue (line 27)
        let attr_path_list: syn::Attribute = parse_quote!(#[from(Author)]);
        assert_eq!(get_path_first_ident(&attr_path_list, "from"), None);

        // 5. get_path_first_ident: non-path literal
        let attr_path_lit: syn::Attribute = parse_quote!(#[from = 456]);
        assert_eq!(get_path_first_ident(&attr_path_lit, "from"), None);

        // 6. get_path_first_ident: valid path
        let attr_path_valid: syn::Attribute = parse_quote!(#[from = Author]);
        assert_eq!(get_path_first_ident(&attr_path_valid, "from"), Some("Author".to_string()));
    }
}
