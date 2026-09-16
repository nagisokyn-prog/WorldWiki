use syn::ItemFn;

pub struct TaintSourceFinder;

impl TaintSourceFinder {
    pub fn is_taint_source(item_fn: &ItemFn) -> bool {
        // Check for #[tauri::command] attribute
        for attr in &item_fn.attrs {
            let attr_str = quote::quote!(#attr).to_string();
            if attr_str.contains("tauri :: command") || attr_str.contains("command") {
                return true;
            }
        }
        false
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_taint_source_finder() {
        let code_tauri = r#"
            #[tauri::command]
            fn save_item(path: String) {}
        "#;
        let item_tauri: syn::ItemFn = syn::parse_str(code_tauri).unwrap();
        assert!(TaintSourceFinder::is_taint_source(&item_tauri));

        let code_regular = "fn internal_fn() {}";
        let item_reg: syn::ItemFn = syn::parse_str(code_regular).unwrap();
        assert!(!TaintSourceFinder::is_taint_source(&item_reg));
    }
}

