use crate::macro_helpers::{get_path_first_ident, get_str_attr, parse_field_flags};
use proc_macro2::TokenStream as TokenStream2;
use quote::quote;
use syn::{Data, DeriveInput, Fields};

pub(crate) struct RelationConfig {
    pub edge_name: String,
    pub from_table: String,
    pub to_table: String,
    pub generate_commands: bool,
    pub struct_fields: Vec<TokenStream2>,
}

pub(crate) fn parse_relation_config(ast: &DeriveInput) -> RelationConfig {
    let name_str = ast.ident.to_string().to_lowercase();
    let (edge_name, from_table, to_table, generate_commands) =
        parse_relation_attributes(&ast.attrs, name_str);
    let struct_fields = parse_relation_fields(&ast.data);

    RelationConfig {
        edge_name,
        from_table,
        to_table,
        generate_commands,
        struct_fields,
    }
}

fn parse_relation_attributes(
    attrs: &[syn::Attribute],
    default_name: String,
) -> (String, String, String, bool) {
    let mut edge_name = default_name;
    let mut from_type = String::new();
    let mut to_type = String::new();
    let mut generate_commands = false;

    for attr in attrs {
        if let Some(edge) = get_str_attr(attr, "edge") {
            edge_name = edge;
        }
        if let Some(from) = get_path_first_ident(attr, "from") {
            from_type = from;
        }
        if let Some(to) = get_path_first_ident(attr, "to") {
            to_type = to;
        }
        if attr.path().is_ident("tauri_commands") {
            generate_commands = true;
        }
    }

    let from_table = match from_type.is_empty() {
        true => "entities".to_string(),
        false => from_type.to_lowercase(),
    };
    let to_table = match to_type.is_empty() {
        true => "entities".to_string(),
        false => to_type.to_lowercase(),
    };

    (edge_name, from_table, to_table, generate_commands)
}

fn parse_relation_fields(data: &Data) -> Vec<TokenStream2> {
    let mut struct_fields = Vec::new();
    let fields_named = match data {
        Data::Struct(data_struct) => match &data_struct.fields {
            Fields::Named(named) => named,
            _ => return struct_fields,
        },
        _ => return struct_fields,
    };

    for field in &fields_named.named {
        let f_ident = match &field.ident {
            Some(i) => i,
            None => continue,
        };
        let f_vis = &field.vis;
        let f_ty = &field.ty;

        let (filtered_attrs, _, _, is_flexible) = parse_field_flags(&field.attrs);

        if is_flexible {
            struct_fields.push(quote! {
                #(#filtered_attrs)*
                #[ts(type = "Record<string, unknown> | null")]
                #f_vis #f_ident: #f_ty
            });
        } else {
            struct_fields.push(quote! {
                #(#filtered_attrs)*
                #f_vis #f_ident: #f_ty
            });
        }
    }

    struct_fields
}

#[cfg(test)]
mod tests {
    use super::*;
    use syn::parse_quote;

    #[test]
    fn test_parse_relation_config_enum_and_tuple_struct_fallback() {
        // Data::Enum -> returns empty struct_fields (line 72)
        let enum_input: DeriveInput = parse_quote!(pub enum MyRelationEnum { A, B });
        let config_enum = parse_relation_config(&enum_input);
        assert!(config_enum.struct_fields.is_empty());

        // Data::Struct with Fields::Unnamed -> returns empty struct_fields (line 70)
        let tuple_input: DeriveInput = parse_quote!(pub struct MyRelationTuple(u32););
        let config_tuple = parse_relation_config(&tuple_input);
        assert!(config_tuple.struct_fields.is_empty());

        // Data::Struct with Fields::Unit -> returns empty struct_fields (line 70)
        let unit_input: DeriveInput = parse_quote!(pub struct MyRelationUnit;);
        let config_unit = parse_relation_config(&unit_input);
        assert!(config_unit.struct_fields.is_empty());

        // Struct with #[flexible] field (line 85-90)
        let flex_input: DeriveInput = parse_quote! {
            pub struct MyRelationWithFlex {
                #[flexible]
                pub data: Option<serde_json::Value>,
            }
        };
        let config_flex = parse_relation_config(&flex_input);
        assert_eq!(config_flex.struct_fields.len(), 1);
    }
}
