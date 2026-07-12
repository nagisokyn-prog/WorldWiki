use proc_macro::TokenStream;
use quote::quote;
use syn::{DeriveInput, Data, Fields, Meta};

pub fn impl_surreal_entity(ast: &DeriveInput) -> TokenStream {
    let name = &ast.ident;
    
    // Parse #[table = "name"]
    let mut table_name = name.to_string().to_lowercase();
    let mut _is_project_scoped = false;
    let mut generate_commands = false;

    for attr in &ast.attrs {
        if attr.path().is_ident("table") {
            if let Meta::NameValue(nv) = &attr.meta {
                if let syn::Expr::Lit(expr_lit) = &nv.value {
                    if let syn::Lit::Str(lit_str) = &expr_lit.lit {
                        table_name = lit_str.value();
                    }
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
    
    let mut field_idents: Vec<proc_macro2::TokenStream> = Vec::new();
    let mut struct_fields = Vec::new();

    if let Data::Struct(data_struct) = &ast.data {
        if let Fields::Named(fields_named) = &data_struct.fields {
            for field in &fields_named.named {
                let _f_name = field.ident.as_ref().unwrap();
                let _f_type = &field.ty;
                
                let mut is_fulltext = false;
                let mut is_hnsw = false;
                let mut is_flexible = false;
                
                let mut clean_field = field.clone();
                clean_field.attrs.retain(|attr| {
                    if let Some(ident) = attr.path().get_ident() {
                        let i = ident.to_string();
                        if i == "fulltext" { is_fulltext = true; return false; }
                        if i == "hnsw" { is_hnsw = true; return false; }
                        if i == "flexible" { is_flexible = true; return false; }
                    }
                    true
                });
                
                let f_ident = field.ident.as_ref().unwrap();
                field_idents.push(quote! { stringify!(#f_ident) });
                struct_fields.push(quote! { #clean_field });
            }
        }
    }

    let mut fulltext_fields = Vec::new();
    let mut vector_fields = Vec::new();

    if let Data::Struct(data_struct) = &ast.data {
        if let Fields::Named(fields_named) = &data_struct.fields {
            for field in &fields_named.named {
                let f_name = field.ident.as_ref().unwrap().to_string();
                for attr in &field.attrs {
                    if attr.path().is_ident("fulltext") { fulltext_fields.push(f_name.clone()); }
                    if attr.path().is_ident("hnsw") { vector_fields.push(f_name.clone()); }
                }
            }
        }
    }

    let search_methods = if !fulltext_fields.is_empty() || !vector_fields.is_empty() {
        let ft_query = if !fulltext_fields.is_empty() {
            let matches: Vec<String> = fulltext_fields.iter().map(|f| format!("{} @@@ $q", f)).collect();
            let match_clause = matches.join(" OR ");
            let q = format!("SELECT *, search::score(1) AS _score FROM {} WHERE (project_id = $proj OR project_id = type::record($proj)) AND ({})", table_name, match_clause);
            
            quote! {
                pub async fn search_fulltext<Db: surrealdb::Connection>(db: &surrealdb::Surreal<Db>, project_id: &str, query: &str) -> Result<Vec<surreal_domain::SearchResult<Self>>, surrealdb::Error> {
                    let mut res = db.query(#q).bind(("proj", project_id.to_string())).bind(("q", query)).await?;
                    let items: Vec<serde_json::Value> = res.take(0)?;
                    let mapped = items.into_iter()
                        .filter_map(|v| serde_json::from_value::<Self>(v).ok())
                        .map(|e| surreal_domain::SearchResult {
                            entity: e,
                            score: 1.0, // stub
                            kind: surreal_domain::SearchKind::Fulltext,
                        }).collect();
                    Ok(mapped)
                }
            }
        } else { quote! {} };

        let vec_query = if !vector_fields.is_empty() {
            let v_field = &vector_fields[0]; // Take first embedding field
            let q = format!("SELECT *, vector::similarity::cosine({}, $emb) AS _sim FROM {} WHERE {} != NONE AND {} <|$k, COSINE|> $emb ORDER BY _sim ASC LIMIT $k", v_field, table_name, v_field, v_field);
            
            quote! {
                pub async fn search_similar<Db: surrealdb::Connection>(db: &surrealdb::Surreal<Db>, embedding: Vec<f32>, k: i64) -> Result<Vec<surreal_domain::SimilarResult<Self>>, surrealdb::Error> {
                    let mut res = db.query(#q)
                        .bind(("emb", embedding))
                        .bind(("k", k))
                        .await?;
                    let items: Vec<serde_json::Value> = res.take(0)?;
                    let mapped = items.into_iter()
                        .filter_map(|v| serde_json::from_value::<Self>(v).ok())
                        .map(|e| surreal_domain::SimilarResult {
                            entity: e,
                            similarity: 1.0, // stub
                        }).collect();
                    Ok(mapped)
                }
            }
        } else { quote! {} };

        quote! {
            #ft_query
            #vec_query
        }
    } else {
        quote! {}
    };

    // Implement SurrealRepository Trait
    let crud_methods = quote! {
        impl surreal_domain::SurrealRepository for #name {
            const TABLE: &'static str = #table_name;
            fn get_id(&self) -> Option<String> { self.id.clone() }
            fn set_id(&mut self, id: String) { self.id = Some(id); }
        }
    };

    let struct_name = name.to_string();
    let tauri_commands_module = if generate_commands {
        let mod_name_str = format!("{}_commands", struct_name);
        let mod_name = syn::Ident::new(&mod_name_str, proc_macro2::Span::call_site());
        let get_all_fn = syn::Ident::new(&format!("get_{}s", struct_name.to_lowercase().trim_end_matches('s')), proc_macro2::Span::call_site());
        let get_one_fn = syn::Ident::new(&format!("get_{}", struct_name.to_lowercase().trim_end_matches('s')), proc_macro2::Span::call_site());
        let save_fn = syn::Ident::new(&format!("save_{}", struct_name.to_lowercase().trim_end_matches('s')), proc_macro2::Span::call_site());
        let delete_fn = syn::Ident::new(&format!("delete_{}", struct_name.to_lowercase().trim_end_matches('s')), proc_macro2::Span::call_site());
        
        let search_fn_code = if !fulltext_fields.is_empty() {
            let search_fn = syn::Ident::new(&format!("search_{}s", struct_name.to_lowercase().trim_end_matches('s')), proc_macro2::Span::call_site());
            quote! {
                #[tauri::command]
                pub async fn #search_fn(
                    project: String,
                    query: String,
                    state: tauri::State<'_, crate::AppState>
                ) -> Result<serde_json::Value, String> {
                    use surreal_domain::SurrealDb;
                    let results = #name::search_fulltext(state.surreal_db(), &project, &query)
                        .await.map_err(|e| e.to_string())?;
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
                ) -> Result<serde_json::Value, String> {
                    println!("[DEBUG] -> {}: project='{}'", stringify!(#get_all_fn), project);
                    let items = #name::find_all(state.surreal_db(), &project)
                        .await.map_err(|e| {
                            println!("[ERROR] {}: {:?}", stringify!(#get_all_fn), e);
                            e.to_string()
                        })?;
                    println!("[DEBUG] <- {}: returned {} items", stringify!(#get_all_fn), items.len());
                    Ok(serde_json::json!(items))
                }

                #[tauri::command]
                pub async fn #get_one_fn(
                    id: String,
                    state: tauri::State<'_, crate::AppState>
                ) -> Result<serde_json::Value, String> {
                    println!("[DEBUG] -> {}: id='{}'", stringify!(#get_one_fn), id);
                    let item = #name::find_by_id(state.surreal_db(), &id)
                        .await.map_err(|e| {
                            println!("[ERROR] {}: {:?}", stringify!(#get_one_fn), e);
                            e.to_string()
                        })?;
                    println!("[DEBUG] <- {}: returned {:?}", stringify!(#get_one_fn), item);
                    Ok(serde_json::json!(item))
                }

                #[tauri::command]
                pub async fn #save_fn(
                    data: serde_json::Value,
                    state: tauri::State<'_, crate::AppState>
                ) -> Result<serde_json::Value, String> {
                    println!("[DEBUG] -> {}: data={}", stringify!(#save_fn), data);
                    let mut data = data.clone();
                    if let Some(obj) = data.as_object_mut() {
                        for key_ref in [#(#field_idents,)* "project_id", "volume_id", "arc_id", "parent_ref"].iter() {
                            let key: &str = key_ref;
                            if let Some(val) = obj.get(key) {
                                if val.is_string() {
                                    let s = val.as_str().unwrap();
                                    let parts: Vec<&str> = s.splitn(2, ':').collect();
                                    if parts.len() == 2 {
                                        obj.insert(key.to_string(), serde_json::json!({ "tb": parts[0], "id": parts[1] }));
                                    }
                                }
                            }
                        }
                    }
                    let entity: #name = serde_json::from_value(data.clone()).map_err(|e| {
                        println!("[ERROR] {}: failed to parse data: {:?}", stringify!(#save_fn), e);
                        e.to_string()
                    })?;
                    let saved = #name::save(state.surreal_db(), &entity)
                        .await.map_err(|e| {
                            println!("[ERROR] {}: failed to save: {:?}", stringify!(#save_fn), e);
                            e.to_string()
                        })?;
                    println!("[DEBUG] <- {}: saved {:?}", stringify!(#save_fn), saved);
                    Ok(serde_json::json!(saved))
                }

                #[tauri::command]
                pub async fn #delete_fn(
                    id: String,
                    state: tauri::State<'_, crate::AppState>
                ) -> Result<serde_json::Value, String> {
                    println!("[DEBUG] -> {}: id='{}'", stringify!(#delete_fn), id);
                    #name::delete(state.surreal_db(), &id)
                        .await.map_err(|e| {
                            println!("[ERROR] {}: {:?}", stringify!(#delete_fn), e);
                            e.to_string()
                        })?;
                    println!("[DEBUG] <- {}: deleted successfully", stringify!(#delete_fn));
                    Ok(serde_json::json!({"success": true}))
                }

                #search_fn_code
            }
        }
    } else {
        quote! {}
    };

    let expanded = quote! {
        #[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
        pub struct #name {
            #[serde(skip_serializing_if = "Option::is_none")]
            pub id: Option<String>,
            #[serde(skip_serializing_if = "Option::is_none")]
            pub project_id: Option<serde_json::Value>,
            #(#struct_fields,)*
        }

        impl #impl_generics #name #ty_generics #where_clause {
            pub const TABLE: &'static str = #table_name;
            #search_methods
        }

        #crud_methods

        #tauri_commands_module
    };

    expanded.into()
}
