use proc_macro2::TokenStream as TokenStream2;
use quote::quote;
use syn::Ident;

/// Generates Tauri command handlers module for an entity.
pub(crate) fn build_tauri_commands_module(
    name: &Ident,
    field_idents: &[TokenStream2],
    flexible_field_idents: &[TokenStream2],
    fulltext_fields: &[&Ident],
) -> TokenStream2 {
    let struct_name = name.to_string();
    let mod_name_str = format!("{}_commands", struct_name);
    let mod_name = syn::Ident::new(&mod_name_str, proc_macro2::Span::call_site());
    let get_all_fn = syn::Ident::new(
        &format!("get_{}s", struct_name.to_lowercase().trim_end_matches('s')),
        proc_macro2::Span::call_site(),
    );
    let get_one_fn = syn::Ident::new(
        &format!("get_{}", struct_name.to_lowercase().trim_end_matches('s')),
        proc_macro2::Span::call_site(),
    );
    let save_fn = syn::Ident::new(
        &format!("save_{}", struct_name.to_lowercase().trim_end_matches('s')),
        proc_macro2::Span::call_site(),
    );
    let delete_fn = syn::Ident::new(
        &format!("delete_{}", struct_name.to_lowercase().trim_end_matches('s')),
        proc_macro2::Span::call_site(),
    );

    let search_fn_code = if !fulltext_fields.is_empty() {
        let search_fn = syn::Ident::new(
            &format!("search_{}s", struct_name.to_lowercase().trim_end_matches('s')),
            proc_macro2::Span::call_site(),
        );
        quote! {
            #[tauri::command]
            pub async fn #search_fn(
                project: String,
                query: String,
                state: tauri::State<'_, crate::AppState>
            ) -> Result<serde_json::Value, surreal_domain::SurrealDomainError> {
                use surreal_domain::SurrealDb;
                let results = #name::search_fulltext(state.surreal_db(), &project, &query).await?;
                Ok(serde_json::json!(results))
            }
        }
    } else {
        quote! {}
    };

    quote! {
        pub mod #mod_name {
            use super::*;
            use surreal_domain::SurrealRepository;

            #[tauri::command]
            pub async fn #get_all_fn(
                project: String,
                state: tauri::State<'_, crate::AppState>
            ) -> Result<serde_json::Value, surreal_domain::SurrealDomainError> {
                let items = #name::find_all(state.surreal_db(), &project).await?;
                Ok(serde_json::json!(items))
            }

            #[tauri::command]
            pub async fn #get_one_fn(
                id: String,
                state: tauri::State<'_, crate::AppState>
            ) -> Result<serde_json::Value, surreal_domain::SurrealDomainError> {
                let item = #name::find_by_id(state.surreal_db(), &id).await?;
                Ok(serde_json::json!(item))
            }

            #[tauri::command]
            pub async fn #save_fn(
                data: serde_json::Value,
                state: tauri::State<'_, crate::AppState>
            ) -> Result<serde_json::Value, surreal_domain::SurrealDomainError> {
                let mut data = data;
                if let Some(obj) = data.as_object_mut() {
                    let normalize_thing_mut = |val: &mut serde_json::Value| {
                        if let serde_json::Value::Object(map) = val {
                            let tb = map.get("tb").and_then(|v| v.as_str());
                            let id = map.get("id").and_then(|v| v.as_str());
                            if let (Some(tb), Some(id)) = (tb, id) {
                                *val = serde_json::Value::String(format!("{}:{}", tb, id));
                            }
                        }
                    };

                    for key_ref in [#(#field_idents,)* "project_id", "volume_id", "parent_ref", "participants"].iter() {
                        let key: &str = key_ref;
                        if let Some(val) = obj.get_mut(key) {
                            if let Some(items) = val.as_array_mut() {
                                for item in items {
                                    normalize_thing_mut(item);
                                }
                            } else {
                                normalize_thing_mut(val);
                            }
                        }
                    }

                    let _flex_keys: &[&str] = &[#(#flexible_field_idents,)*];
                    for flex_key in _flex_keys.iter() {
                        if !obj.contains_key(*flex_key) {
                            obj.insert(flex_key.to_string(), serde_json::Value::Null);
                        }
                    }
                }
                let entity: #name = serde_json::from_value(data)?;
                let saved = #name::save(state.surreal_db(), &entity).await?;
                Ok(serde_json::json!(saved))
            }

            #[tauri::command]
            pub async fn #delete_fn(
                id: String,
                state: tauri::State<'_, crate::AppState>
            ) -> Result<serde_json::Value, surreal_domain::SurrealDomainError> {
                #name::delete(state.surreal_db(), &id).await?;
                Ok(serde_json::json!({"success": true}))
            }

            #search_fn_code
        }
    }
}
