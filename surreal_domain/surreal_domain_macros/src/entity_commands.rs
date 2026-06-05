use proc_macro::TokenStream;
use quote::quote;
use syn::parse::{Parse, ParseStream, Result};
use syn::{Ident, Token, punctuated::Punctuated};

struct CommandList {
    normal_commands: Vec<Ident>,
    entities: Vec<Ident>,
    searchable: Vec<Ident>,
    relations: Vec<Ident>,
}

impl Parse for CommandList {
    fn parse(input: ParseStream) -> Result<Self> {
        let mut normal_commands = Vec::new();
        let mut entities = Vec::new();
        let mut searchable = Vec::new();
        let mut relations = Vec::new();

        while !input.is_empty() {
            if input.peek(Token![@]) {
                input.parse::<Token![@]>()?;
                let key: Ident = input.parse()?;
                input.parse::<Token![:]>()?;
                let content;
                syn::bracketed!(content in input);
                let parsed: Punctuated<Ident, Token![,]> = content.parse_terminated(Ident::parse, Token![,])?;
                
                let idents: Vec<Ident> = parsed.into_iter().collect();
                if key == "entities" {
                    entities.extend(idents);
                } else if key == "searchable" {
                    searchable.extend(idents);
                } else if key == "relations" {
                    relations.extend(idents);
                }
            } else {
                let cmd: Ident = input.parse()?;
                normal_commands.push(cmd);
            }
            if input.peek(Token![,]) {
                input.parse::<Token![,]>()?;
            }
        }

        Ok(CommandList { normal_commands, entities, searchable, relations })
    }
}

pub fn impl_entity_commands(input: TokenStream) -> TokenStream {
    let CommandList { normal_commands, entities, searchable, relations } = syn::parse_macro_input!(input as CommandList);

    let mut generated_calls = Vec::new();

    for entity in entities {
        let name_str = entity.to_string().to_lowercase();
        let plural = format!("{}s", name_str);
        
        let get_all = syn::Ident::new(&format!("get_{}", plural), proc_macro2::Span::call_site());
        let get_one = syn::Ident::new(&format!("get_{}", name_str), proc_macro2::Span::call_site());
        let save = syn::Ident::new(&format!("save_{}", name_str), proc_macro2::Span::call_site());
        let delete = syn::Ident::new(&format!("delete_{}", name_str), proc_macro2::Span::call_site());

        let mod_name_str = format!("{}_commands", entity);
        let mod_name = syn::Ident::new(&mod_name_str, proc_macro2::Span::call_site());
        generated_calls.push(quote! { #mod_name::#get_all });
        generated_calls.push(quote! { #mod_name::#get_one });
        generated_calls.push(quote! { #mod_name::#save });
        generated_calls.push(quote! { #mod_name::#delete });
    }

    for entity in searchable {
        let name_str = entity.to_string().to_lowercase();
        let plural = format!("{}s", name_str);
        
        let get_all = syn::Ident::new(&format!("get_{}", plural), proc_macro2::Span::call_site());
        let get_one = syn::Ident::new(&format!("get_{}", name_str), proc_macro2::Span::call_site());
        let save = syn::Ident::new(&format!("save_{}", name_str), proc_macro2::Span::call_site());
        let delete = syn::Ident::new(&format!("delete_{}", name_str), proc_macro2::Span::call_site());
        let search = syn::Ident::new(&format!("search_{}", plural), proc_macro2::Span::call_site());

        let mod_name_str = format!("{}_commands", entity);
        let mod_name = syn::Ident::new(&mod_name_str, proc_macro2::Span::call_site());
        generated_calls.push(quote! { #mod_name::#get_all });
        generated_calls.push(quote! { #mod_name::#get_one });
        generated_calls.push(quote! { #mod_name::#save });
        generated_calls.push(quote! { #mod_name::#delete });
        generated_calls.push(quote! { #mod_name::#search });
    }

    for rel in relations {
        let name_str = rel.to_string().to_lowercase();
        let singular = name_str.trim_end_matches('s');
        let plural = format!("{}s", singular);
        
        let get_all = syn::Ident::new(&format!("get_{}", plural), proc_macro2::Span::call_site());
        let create = syn::Ident::new(&format!("create_{}", singular), proc_macro2::Span::call_site());
        let delete = syn::Ident::new(&format!("delete_{}", singular), proc_macro2::Span::call_site());

        let mod_name_str = format!("{}_commands", rel);
        let mod_name = syn::Ident::new(&mod_name_str, proc_macro2::Span::call_site());
        generated_calls.push(quote! { #mod_name::#get_all });
        generated_calls.push(quote! { #mod_name::#create });
        generated_calls.push(quote! { #mod_name::#delete });
    }

    let expanded = quote! {
        tauri::generate_handler![
            #(#normal_commands),*,
            #(#generated_calls),*
        ]
    };

    expanded.into()
}
