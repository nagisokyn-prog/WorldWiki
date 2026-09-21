extern crate proc_macro;

use proc_macro::TokenStream;
use syn::{parse_macro_input, DeriveInput};

mod entity;
mod entity_commands;
mod entity_parser;
mod entity_search;
mod entity_tauri;
mod macro_helpers;
mod relation;
mod relation_parser;
mod relation_tauri;
mod schema;

#[proc_macro]
pub fn surreal_entity(input: TokenStream) -> TokenStream {
    let ast = parse_macro_input!(input as DeriveInput);
    entity::impl_surreal_entity(&ast)
}

#[proc_macro]
pub fn surreal_relation(input: TokenStream) -> TokenStream {
    let ast = parse_macro_input!(input as DeriveInput);
    relation::impl_surreal_relation(&ast)
}

#[proc_macro]
pub fn surreal_schema(input: TokenStream) -> TokenStream {
    schema::impl_surreal_schema(input)
}

#[proc_macro]
pub fn entity_commands(input: TokenStream) -> TokenStream {
    entity_commands::impl_entity_commands(input)
}
