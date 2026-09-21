use crate::macro_helpers::{get_str_attr, parse_field_flags};
use proc_macro2::TokenStream as TokenStream2;
use quote::{quote, ToTokens};
use syn::{Data, DeriveInput, Fields, Ident};

pub(crate) struct EntityConfig<'a> {
    pub table_name: String,
    pub generate_commands: bool,
    pub field_idents: Vec<TokenStream2>,
    pub flexible_field_idents: Vec<TokenStream2>,
    pub option_field_idents: Vec<TokenStream2>,
    pub struct_fields: Vec<TokenStream2>,
    pub fulltext_fields: Vec<&'a Ident>,
    pub vector_fields: Vec<&'a Ident>,
}

#[derive(Default)]
pub(crate) struct EntityFieldCollections<'a> {
    pub field_idents: Vec<TokenStream2>,
    pub flexible_field_idents: Vec<TokenStream2>,
    pub option_field_idents: Vec<TokenStream2>,
    pub struct_fields: Vec<TokenStream2>,
    pub fulltext_fields: Vec<&'a Ident>,
    pub vector_fields: Vec<&'a Ident>,
}

pub(crate) fn parse_entity_config<'a>(ast: &'a DeriveInput) -> EntityConfig<'a> {
    let default_name = ast.ident.to_string().to_lowercase();
    let (table_name, generate_commands) = parse_entity_attributes(&ast.attrs, default_name);
    let collections = parse_entity_fields(&ast.data);

    EntityConfig {
        table_name,
        generate_commands,
        field_idents: collections.field_idents,
        flexible_field_idents: collections.flexible_field_idents,
        option_field_idents: collections.option_field_idents,
        struct_fields: collections.struct_fields,
        fulltext_fields: collections.fulltext_fields,
        vector_fields: collections.vector_fields,
    }
}

fn parse_entity_attributes(attrs: &[syn::Attribute], default_name: String) -> (String, bool) {
    let mut table_name = default_name;
    let mut generate_commands = false;

    for attr in attrs {
        if let Some(tbl) = get_str_attr(attr, "table") {
            table_name = tbl;
        }
        if attr.path().is_ident("tauri_commands") {
            generate_commands = true;
        }
    }

    (table_name, generate_commands)
}

fn parse_entity_fields<'a>(data: &'a Data) -> EntityFieldCollections<'a> {
    let mut cols = EntityFieldCollections::default();
    let fields_named = match data {
        Data::Struct(data_struct) => match &data_struct.fields {
            Fields::Named(named) => named,
            _ => return cols,
        },
        _ => return cols,
    };

    for field in &fields_named.named {
        let f_ident = match &field.ident {
            Some(i) => i,
            None => continue,
        };
        let f_vis = &field.vis;
        let f_ty = &field.ty;

        let (filtered_attrs, is_fulltext, is_hnsw, is_flexible) =
            parse_field_flags(&field.attrs);

        if is_fulltext {
            cols.fulltext_fields.push(f_ident);
        }
        if is_hnsw {
            cols.vector_fields.push(f_ident);
        }

        cols.field_idents.push(quote! { stringify!(#f_ident) });

        if is_flexible {
            cols.flexible_field_idents.push(quote! { stringify!(#f_ident) });
            let extra_skip_attr = resolve_skip_attr(&filtered_attrs, f_ty, f_ident, &mut cols.option_field_idents);
            cols.struct_fields.push(quote! {
                #(#filtered_attrs)*
                #[ts(type = "Record<string, unknown> | null")]
                #extra_skip_attr
                #f_vis #f_ident: #f_ty
            });
        } else {
            cols.struct_fields.push(quote! {
                #(#filtered_attrs)*
                #f_vis #f_ident: #f_ty
            });
        }
    }

    cols
}

fn resolve_skip_attr(
    filtered_attrs: &[&syn::Attribute],
    f_ty: &syn::Type,
    f_ident: &Ident,
    option_field_idents: &mut Vec<TokenStream2>,
) -> Option<syn::Attribute> {
    let has_skip = filtered_attrs
        .iter()
        .any(|attr| attr.path().is_ident("serde") && attr.to_token_stream().to_string().contains("skip_serializing_if"));
    if has_skip {
        return None;
    }

    let ty_str = quote!(#f_ty).to_string();
    if ty_str.starts_with("Option <") || ty_str.starts_with("std :: option :: Option <") {
        option_field_idents.push(quote! { stringify!(#f_ident) });
        Some(syn::parse_quote!(#[serde(skip_serializing_if = "Option::is_none")]))
    } else if (ty_str == "Value" || ty_str.ends_with(":: Value")) && !ty_str.contains('<') {
        Some(syn::parse_quote!(#[serde(skip_serializing_if = "serde_json::Value::is_null")]))
    } else {
        None
    }
}
