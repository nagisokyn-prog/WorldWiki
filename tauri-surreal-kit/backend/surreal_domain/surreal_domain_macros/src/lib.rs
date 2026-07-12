extern crate proc_macro;

use proc_macro::TokenStream;
use syn::{parse_macro_input, DeriveInput};

mod entity;
mod relation;
mod schema;
mod entity_commands;

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
