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
