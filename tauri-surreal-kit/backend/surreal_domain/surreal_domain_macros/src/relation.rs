use crate::relation_parser::parse_relation_config;
use crate::relation_tauri::build_relation_commands_module;
use proc_macro::TokenStream;
use quote::quote;
use syn::DeriveInput;

pub(crate) fn impl_surreal_relation(ast: &DeriveInput) -> TokenStream {
    let name = &ast.ident;
    let config = parse_relation_config(ast);
    let edge_name = &config.edge_name;
    let from_table = &config.from_table;
    let to_table = &config.to_table;
    let struct_fields = &config.struct_fields;

    let (impl_generics, ty_generics, where_clause) = ast.generics.split_for_impl();

    let crud_methods = quote! {
        pub async fn relate<Db: surrealdb::Connection>(
            db: &surrealdb::Surreal<Db>,
            from_id: &str,
            to_id: &str,
            data: Self
        ) -> Result<String, surreal_domain::SurrealDomainError> {
            let actual_from = from_id.split_once(':').map(|(_, id)| id).unwrap_or(from_id);
            let actual_to = to_id.split_once(':').map(|(_, id)| id).unwrap_or(to_id);

            let val = serde_json::to_value(&data)?;
            let mut map = match val {
                serde_json::Value::Object(m) => m,
                _ => serde_json::Map::new(),
            };
            map.remove("id");
            map.remove("in");
            map.remove("out");
            map.retain(|_, v| !v.is_null());

            let from_rec = surrealdb::types::RecordId::new(#from_table, actual_from);
            let to_rec = surrealdb::types::RecordId::new(#to_table, actual_to);

            let query = format!("RELATE $from_rec->{}->$to_rec CONTENT $data", Self::TABLE);
            let mut res = db.query(query)
                .bind(("from_rec", from_rec))
                .bind(("to_rec", to_rec))
                .bind(("data", serde_json::Value::Object(map)))
                .await?;
            let created: Vec<serde_json::Value> = res.take(0)?;
            if let Some(val) = created.into_iter().next() {
                if let Some(id_str) = val.get("id").and_then(|v| v.as_str()) {
                    Ok(id_str.to_string())
                } else if let Some(id_val) = val.get("id") {
                    Ok(id_val.to_string().trim_matches('"').to_string())
                } else {
                    Ok(String::new())
                }
            } else {
                Err(surreal_domain::SurrealDomainError::constraint_violation("Failed to create relation"))
            }
        }

        pub async fn find_between<Db: surrealdb::Connection>(
            db: &surrealdb::Surreal<Db>,
            from_id: &str,
            to_id: &str
        ) -> Result<Vec<Self>, surreal_domain::SurrealDomainError> {
            let actual_from = from_id.split_once(':').map(|(_, id)| id).unwrap_or(from_id);
            let actual_to = to_id.split_once(':').map(|(_, id)| id).unwrap_or(to_id);

            let from_rec = surrealdb::types::RecordId::new(#from_table, actual_from);
            let to_rec = surrealdb::types::RecordId::new(#to_table, actual_to);

            let query = format!("SELECT * FROM {} WHERE in = $from_rec AND out = $to_rec", Self::TABLE);
            let mut res = db.query(query)
                .bind(("from_rec", from_rec))
                .bind(("to_rec", to_rec))
                .await?;
            let list: Vec<serde_json::Value> = res.take(0)?;
            let mapped = list.into_iter()
                .filter_map(|v| serde_json::from_value(v).ok())
                .collect();
            Ok(mapped)
        }

        pub async fn find_all<Db: surrealdb::Connection>(db: &surrealdb::Surreal<Db>, project_id: &str) -> Result<Vec<Self>, surreal_domain::SurrealDomainError> {
            let pid_raw = match project_id.split_once(':') {
                Some((_, id)) => id,
                None => project_id,
            };
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

        pub async fn delete<Db: surrealdb::Connection>(db: &surrealdb::Surreal<Db>, edge_id: &str) -> Result<(), surreal_domain::SurrealDomainError> {
            let actual_id = edge_id.split_once(':').map(|(_, id)| id).unwrap_or(edge_id);
            let _: Option<serde_json::Value> = db.delete((Self::TABLE, actual_id)).await?;
            Ok(())
        }
    };

    let tauri_commands_module = if config.generate_commands {
        build_relation_commands_module(name)
    } else {
        quote! {}
    };

    let expanded = quote! {
        #[derive(Debug, Clone, serde::Serialize, serde::Deserialize, ts_rs::TS)]
        #[ts(export, export_to = "../../apps/spa/src/ts/types/generated/")]
        pub struct #name {
            pub id: Option<String>,
            pub r#in: Option<String>,
            pub out: Option<String>,
            #[serde(skip_serializing_if = "Option::is_none")]
            #[ts(type = "string | null")]
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
