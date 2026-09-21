use crate::entity_parser::parse_entity_config;
use crate::entity_search::build_search_methods;
use crate::entity_tauri::build_tauri_commands_module;
use proc_macro::TokenStream;
use quote::quote;
use syn::DeriveInput;

pub(crate) fn impl_surreal_entity(ast: &DeriveInput) -> TokenStream {
    let name = &ast.ident;
    let config = parse_entity_config(ast);
    let table_name = &config.table_name;
    let field_idents = &config.field_idents;
    let flexible_field_idents = &config.flexible_field_idents;
    let option_field_idents = &config.option_field_idents;
    let struct_fields = &config.struct_fields;
    let fulltext_fields = &config.fulltext_fields;
    let vector_fields = &config.vector_fields;

    let (impl_generics, ty_generics, where_clause) = ast.generics.split_for_impl();
    let search_methods = build_search_methods(name, table_name, fulltext_fields, vector_fields);

    let crud_methods = quote! {
        impl surreal_domain::SurrealRepository for #name {
            const TABLE: &'static str = #table_name;
            fn get_fields() -> &'static [&'static str] {
                &[#(#field_idents,)*]
            }
            fn get_option_fields() -> &'static [&'static str] {
                &[#(#option_field_idents,)*]
            }
            fn get_id(&self) -> Option<&str> { self.id.as_deref() }
            fn set_id(&mut self, id: String) { self.id = Some(id); }
        }
    };

    let tauri_commands_module = if config.generate_commands {
        build_tauri_commands_module(name, field_idents, flexible_field_idents, fulltext_fields)
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
