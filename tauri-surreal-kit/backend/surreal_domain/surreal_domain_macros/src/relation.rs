use proc_macro::TokenStream;
use quote::quote;
use syn::{DeriveInput, Data, Fields, Meta};

pub fn impl_surreal_relation(ast: &DeriveInput) -> TokenStream {
    let name = &ast.ident;
    
    let mut edge_name = name.to_string().to_lowercase();
    let mut from_type = String::new();
    let mut to_type = String::new();
    let mut _is_project_scoped = false;
    let mut generate_commands = false;

    for attr in &ast.attrs {
        if attr.path().is_ident("edge") {
            if let Meta::NameValue(nv) = &attr.meta {
                if let syn::Expr::Lit(expr_lit) = &nv.value {
                    if let syn::Lit::Str(lit_str) = &expr_lit.lit {
                        edge_name = lit_str.value();
                    }
                }
            }
        }
        if attr.path().is_ident("from") {
            if let Meta::NameValue(nv) = &attr.meta {
                 if let syn::Expr::Path(expr_path) = &nv.value {
                     from_type = expr_path.path.segments.first().unwrap().ident.to_string();
                 }
            }
        }
        if attr.path().is_ident("to") {
            if let Meta::NameValue(nv) = &attr.meta {
                 if let syn::Expr::Path(expr_path) = &nv.value {
                     to_type = expr_path.path.segments.first().unwrap().ident.to_string();
                 }
            }
        }
        if attr.path().is_ident("project_scoped") {
            _is_project_scoped = true;
        }
        if attr.path().is_ident("tauri_commands") {
            generate_commands = true;
        }
    }

    let (impl_generics, ty_generics, where_clause) = ast.generics.split_for_impl();
    
    let mut struct_fields = Vec::new();
    // Defaulting to "entities" for MVP if from/to are empty
    let from_table = if from_type.is_empty() { "entities".to_string() } else { from_type.to_lowercase() };
    let to_table = if to_type.is_empty() { "entities".to_string() } else { to_type.to_lowercase() };

    if let Data::Struct(data_struct) = &ast.data {
        if let Fields::Named(fields_named) = &data_struct.fields {
            for field in &fields_named.named {
                let _f_name = field.ident.as_ref().unwrap();
                let _f_type = &field.ty;
                
                let mut is_flexible = false;
                
                let mut clean_field = field.clone();
                clean_field.attrs.retain(|attr| {
                    if let Some(ident) = attr.path().get_ident() {
                        let i = ident.to_string();
                        if i == "flexible" { is_flexible = true; return false; }
                        if i == "fulltext" { return false; }
                        if i == "hnsw" { return false; }
                    }
                    true
                });
                
                struct_fields.push(quote! { #clean_field });
            }
        }
    }

    let crud_methods = quote! {
        pub async fn relate<Db: surrealdb::Connection>(
            db: &surrealdb::Surreal<Db>, 
            from_id: &str, 
            to_id: &str, 
            data: Self
        ) -> Result<String, surrealdb::Error> {
            let from_parts: Vec<&str> = from_id.split(':').collect();
            let to_parts: Vec<&str> = to_id.split(':').collect();
            let actual_from = if from_parts.len() == 2 { from_parts[1] } else { from_id };
            let actual_to = if to_parts.len() == 2 { to_parts[1] } else { to_id };
            
            // Build raw query for RELATE
            let query = format!("RELATE {}:{}->{}->{}:{} CONTENT $data RETURN id", 
                #from_table, actual_from, Self::TABLE, #to_table, actual_to);
                
            let mut res = db.query(query).bind(("data", serde_json::to_value(&data).unwrap())).await?;
            let created: Option<serde_json::Value> = res.take(0)?;
            if let Some(val) = created {
                Ok(val.get("id").unwrap_or(&serde_json::Value::Null).to_string())
            } else {
                Err(surrealdb::Error::thrown("Failed to create relation".to_string()))
            }
        }

        pub async fn find_between<Db: surrealdb::Connection>(
            db: &surrealdb::Surreal<Db>, 
            from_id: &str, 
            to_id: &str
        ) -> Result<Vec<Self>, surrealdb::Error> {
            let from_parts: Vec<&str> = from_id.split(':').collect();
            let to_parts: Vec<&str> = to_id.split(':').collect();
            let actual_from = if from_parts.len() == 2 { from_parts[1] } else { from_id };
            let actual_to = if to_parts.len() == 2 { to_parts[1] } else { to_id };
            
            let query = format!("SELECT * FROM {} WHERE in = {}:{} AND out = {}:{}", 
                Self::TABLE, #from_table, actual_from, #to_table, actual_to);
            let mut res = db.query(query).await?;
            let list: Vec<serde_json::Value> = res.take(0)?;
            let mapped = list.into_iter()
                .filter_map(|v| serde_json::from_value(v).ok())
                .collect();
            Ok(mapped)
        }
        
        pub async fn find_all<Db: surrealdb::Connection>(db: &surrealdb::Surreal<Db>, project_id: &str) -> Result<Vec<Self>, surrealdb::Error> {
            let pid_raw = project_id.split(':').last().unwrap_or(project_id);
            let mut res = db.query(format!("SELECT * FROM {} WHERE project_id = $pid OR project_id = type::record('projects', $pid_raw)", Self::TABLE))
                .bind(("pid", project_id.to_string()))
                .bind(("pid_raw", pid_raw.to_string()))
                .await?;
            let list: Vec<serde_json::Value> = res.take(0)?;
            let mapped = list.into_iter()
                .filter_map(|v| serde_json::from_value(v).ok())
                .collect();
            Ok(mapped)
        }
        
        pub async fn delete<Db: surrealdb::Connection>(db: &surrealdb::Surreal<Db>, edge_id: &str) -> Result<(), surrealdb::Error> {
            let parts: Vec<&str> = edge_id.split(':').collect();
            let actual_id = if parts.len() == 2 { parts[1] } else { edge_id };
            let _: Option<serde_json::Value> = db.delete((Self::TABLE, actual_id)).await?;
            Ok(())
        }
    };

    let _edge_name_str = edge_name.to_string();
    let tauri_commands_module = if generate_commands {
        let struct_name = name.to_string();
        let mod_name_str = format!("{}_commands", struct_name);
        let mod_name = syn::Ident::new(&mod_name_str, proc_macro2::Span::call_site());
        let get_all_fn = syn::Ident::new(&format!("get_{}s", struct_name.to_lowercase().trim_end_matches('s')), proc_macro2::Span::call_site());
        let create_fn = syn::Ident::new(&format!("create_{}", struct_name.to_lowercase().trim_end_matches('s')), proc_macro2::Span::call_site());
        let delete_fn = syn::Ident::new(&format!("delete_{}", struct_name.to_lowercase().trim_end_matches('s')), proc_macro2::Span::call_site());

        quote! {
            pub mod #mod_name {
                use super::*;
                use surreal_domain::SurrealDb;

                #[tauri::command]
                pub async fn #get_all_fn(
                    from_id: String,
                    to_id: String,
                    state: tauri::State<'_, crate::AppState>
                ) -> Result<serde_json::Value, String> {
                    let items = #name::find_between(state.surreal_db(), &from_id, &to_id)
                        .await.map_err(|e| e.to_string())?;
                    Ok(serde_json::json!(items))
                }

                #[tauri::command]
                pub async fn #create_fn(
                    from_id: String,
                    to_id: String,
                    data: serde_json::Value,
                    state: tauri::State<'_, crate::AppState>
                ) -> Result<serde_json::Value, String> {
                    let rel: #name = serde_json::from_value(data).map_err(|e| e.to_string())?;
                    let saved_id = #name::relate(state.surreal_db(), &from_id, &to_id, rel)
                        .await.map_err(|e| e.to_string())?;
                    Ok(serde_json::json!({"success": true, "id": saved_id}))
                }

                #[tauri::command]
                pub async fn #delete_fn(
                    id: String,
                    state: tauri::State<'_, crate::AppState>
                ) -> Result<serde_json::Value, String> {
                    #name::delete(state.surreal_db(), &id)
                        .await.map_err(|e| e.to_string())?;
                    Ok(serde_json::json!({"success": true}))
                }
            }
        }
    } else {
        quote! {}
    };

    let expanded = quote! {
        #[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
        pub struct #name {
            pub id: Option<String>,
            pub r#in: Option<String>, // IN is keyword in rust
            pub out: Option<String>,
            #[serde(skip_serializing_if = "Option::is_none")]
            pub project_id: Option<String>,
            #(#struct_fields,)*
        }

        impl #impl_generics #name #ty_generics #where_clause {
            pub const TABLE: &'static str = #edge_name;
            pub const FROM: &'static str = #from_table;
            pub const TO: &'static str = #to_table;

            #crud_methods
        }

        #tauri_commands_module
    };

    expanded.into()
}
