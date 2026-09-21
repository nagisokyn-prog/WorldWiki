use proc_macro2::TokenStream as TokenStream2;
use quote::quote;
use syn::Ident;

/// Generates Tauri command handlers module for a relation.
pub(crate) fn build_relation_commands_module(name: &Ident) -> TokenStream2 {
    let struct_name = name.to_string();
    let mod_name_str = format!("{}_commands", struct_name);
    let mod_name = syn::Ident::new(&mod_name_str, proc_macro2::Span::call_site());
    let get_all_fn = syn::Ident::new(
        &format!("get_{}s", struct_name.to_lowercase().trim_end_matches('s')),
        proc_macro2::Span::call_site(),
    );
    let create_fn = syn::Ident::new(
        &format!("create_{}", struct_name.to_lowercase().trim_end_matches('s')),
        proc_macro2::Span::call_site(),
    );
    let delete_fn = syn::Ident::new(
        &format!("delete_{}", struct_name.to_lowercase().trim_end_matches('s')),
        proc_macro2::Span::call_site(),
    );

    quote! {
        pub mod #mod_name {
            use super::*;
            use surreal_domain::SurrealDb;

            #[tauri::command]
            pub async fn #get_all_fn(
                from_id: String,
                to_id: String,
                state: tauri::State<'_, crate::AppState>
            ) -> Result<serde_json::Value, surreal_domain::SurrealDomainError> {
                let items = #name::find_between(state.surreal_db(), &from_id, &to_id).await?;
                Ok(serde_json::json!(items))
            }

            #[tauri::command]
            pub async fn #create_fn(
                from_id: String,
                to_id: String,
                data: serde_json::Value,
                state: tauri::State<'_, crate::AppState>
            ) -> Result<serde_json::Value, surreal_domain::SurrealDomainError> {
                let rel: #name = serde_json::from_value(data)?;
                let saved_id = #name::relate(state.surreal_db(), &from_id, &to_id, rel).await?;
                Ok(serde_json::json!({"success": true, "id": saved_id}))
            }

            #[tauri::command]
            pub async fn #delete_fn(
                id: String,
                state: tauri::State<'_, crate::AppState>
            ) -> Result<serde_json::Value, surreal_domain::SurrealDomainError> {
                #name::delete(state.surreal_db(), &id).await?;
                Ok(serde_json::json!({"success": true}))
            }
        }
    }
}
