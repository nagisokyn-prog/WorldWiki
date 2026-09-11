use proc_macro::TokenStream;
use quote::{quote, ToTokens};
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
    let mut flexible_field_idents: Vec<proc_macro2::TokenStream> = Vec::new();
    let mut option_field_idents: Vec<proc_macro2::TokenStream> = Vec::new();
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
                
                if is_flexible {
                    flexible_field_idents.push(quote! { stringify!(#f_ident) });
                    let ts_attr: syn::Attribute = syn::parse_quote!(#[ts(type = "any")]);
                    clean_field.attrs.push(ts_attr);

                    // Добавляем serde skip для null/None значений flexible полей,
                    // но только если пользователь не указал свой skip_serializing_if
                    let has_skip = clean_field.attrs.iter().any(|attr| {
                        attr.path().is_ident("serde") && 
                        attr.to_token_stream().to_string().contains("skip_serializing_if")
                    });
                    
                    if !has_skip {
                        if let syn::Type::Path(type_path) = &field.ty {
                            // Правильная инспекция пути типа через syn, а не через строку
                            if let Some(last_seg) = type_path.path.segments.last() {
                                // Option<T> -> skip_serializing_if = "Option::is_none"
                                if last_seg.ident == "Option" {
                                    option_field_idents.push(quote! { stringify!(#f_ident) });
                                    let skip_attr: syn::Attribute = syn::parse_quote!(#[serde(skip_serializing_if = "Option::is_none")]);
                                    clean_field.attrs.push(skip_attr);
                                }
                                // serde_json::Value (проверяем что это serde_json::Value, а не просто Value)
                                else if last_seg.ident == "Value" && type_path.path.segments.len() >= 2 {
                                    let prev_seg = &type_path.path.segments[type_path.path.segments.len() - 2];
                                    if prev_seg.ident == "serde_json" {
                                        let skip_attr: syn::Attribute = syn::parse_quote!(#[serde(skip_serializing_if = "serde_json::Value::is_null")]);
                                        clean_field.attrs.push(skip_attr);
                                    }
                                }
                            }
                        }
                    }
                }
                
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
                                    let matches: Vec<String> = fulltext_fields.iter().enumerate().map(|(i, f)| format!("{} @{}@ $q", f, i + 1)).collect();
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
                                    // KNN operator requires literal K, so we format query at runtime
            
            
            quote! {
                pub async fn search_similar<Db: surrealdb::Connection>(db: &surrealdb::Surreal<Db>, embedding: Vec<f32>, k: i64) -> Result<Vec<surreal_domain::SimilarResult<Self>>, surrealdb::Error> {
                    // KNN operator requires literal K, so we format query at runtime
                    let q = format!("SELECT *, vector::distance::knn() AS _sim FROM {} WHERE {} <|{}, COSINE|> $emb ORDER BY _sim", #table_name, #v_field, k);
                    let mut res = db.query(q)
                        .bind(("emb", embedding))
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
            fn get_fields() -> &'static [&'static str] {
                &[#(#field_idents,)*]
            }
            fn get_option_fields() -> &'static [&'static str] {
                &[#(#option_field_idents,)*]
            }
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
                    if let Some(ref val) = item {
                        let mut dbg_val = serde_json::to_value(val).unwrap_or_default();
                        if let Some(obj) = dbg_val.as_object_mut() {
                            if let Some(c) = obj.get_mut("content") {
                                if let Some(s) = c.as_str() {
                                    *c = serde_json::json!(format!("[{} chars]", s.len()));
                                }
                            }
                        }
                        println!("[DEBUG] <- {}: returned Some({})", stringify!(#get_one_fn), dbg_val);
                    } else {
                        println!("[DEBUG] <- {}: returned None", stringify!(#get_one_fn));
                    }
                    Ok(serde_json::json!(item))
                }

                #[tauri::command]
                pub async fn #save_fn(
                    data: serde_json::Value,
                    state: tauri::State<'_, crate::AppState>
                ) -> Result<serde_json::Value, String> {
                    let mut dbg_in = data.clone();
                    if let Some(obj) = dbg_in.as_object_mut() {
                        if let Some(c) = obj.get_mut("content") {
                            if let Some(s) = c.as_str() {
                                *c = serde_json::json!(format!("[{} chars]", s.len()));
                            }
                        }
                    }
                    println!("[DEBUG] -> {}: data={}", stringify!(#save_fn), dbg_in);
                    let mut data = data.clone();
                    if let Some(obj) = data.as_object_mut() {
                        // Helper to normalize a value to a record-reference STRING "table:id".
                        // SurrealDB coerces "table:id" strings into record<...> automatically,
                        // but it CANNOT coerce a JSON object {"tb","id"} into a record.
                        // So: keep strings as-is, convert objects {"tb","id"} back to strings.
                        let normalize_thing = |val: &serde_json::Value| -> serde_json::Value {
                            match val {
                                // Already a string reference -> keep unchanged
                                serde_json::Value::String(s) => val.clone(),
                                // Object {tb, id} -> convert to "tb:id" string
                                serde_json::Value::Object(map) => {
                                    let tb = map.get("tb").and_then(|v| v.as_str());
                                    let id = map.get("id").and_then(|v| v.as_str());
                                    match (tb, id) {
                                        (Some(tb), Some(id)) => serde_json::json!(format!("{}:{}", tb, id)),
                                        _ => val.clone(),
                                    }
                                }
                                // Anything else (null, number) -> keep unchanged
                                _ => val.clone(),
                            }
                        };

                        // Helper to normalize an array of record references
                        let normalize_thing_array = |arr: &serde_json::Value| -> serde_json::Value {
                            if let Some(items) = arr.as_array() {
                                serde_json::json!(items.iter().map(normalize_thing).collect::<Vec<_>>())
                            } else {
                                arr.clone()
                            }
                        };

                        for key_ref in [#(#field_idents,)* "project_id", "volume_id", "parent_ref", "participants"].iter() {
                            let key: &str = key_ref;
                            if let Some(val) = obj.get(key) {
                                // Handle both single values and arrays
                                let converted = if val.is_array() {
                                    normalize_thing_array(val)
                                } else {
                                    normalize_thing(val)
                                };
                                obj.insert(key.to_string(), converted);
                            }
                        }

                        // Для flexible полей, отсутствующих в JSON (skip_serializing_if),
                        // явно добавляем null, чтобы при десериализации они стали None
                        // и затем корректно сохранялись в БД как explicit null
                        let _flex_keys: &[&str] = &[#(#flexible_field_idents,)*];
                        for flex_key in _flex_keys.iter() {
                            if !obj.contains_key(*flex_key) {
                                obj.insert(flex_key.to_string(), serde_json::Value::Null);
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
                    let mut dbg_saved = serde_json::to_value(&saved).unwrap_or_default();
                    if let Some(obj) = dbg_saved.as_object_mut() {
                        if let Some(c) = obj.get_mut("content") {
                            if let Some(s) = c.as_str() {
                                *c = serde_json::json!(format!("[{} chars]", s.len()));
                            }
                        }
                    }
                    println!("[DEBUG] <- {}: saved {}", stringify!(#save_fn), dbg_saved);
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
        #[derive(Debug, Clone, serde::Serialize, serde::Deserialize, ts_rs::TS)]
        #[ts(export, export_to = "../../apps/spa/src/ts/types/generated/")]
        pub struct #name {
            #[serde(skip_serializing_if = "Option::is_none")]
            pub id: Option<String>,
            #[serde(skip_serializing_if = "Option::is_none")]
            #[ts(type = "string | null")]
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
