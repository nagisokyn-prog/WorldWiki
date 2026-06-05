use proc_macro::TokenStream;
use quote::quote;

pub fn impl_surreal_schema(_input: TokenStream) -> TokenStream {
    let expanded = quote! {
        pub struct DomainSchema;

        impl DomainSchema {
            // DDL is now managed via external surreal_schema.surql
            pub async fn apply<Db: surrealdb::Connection>(_db: &surrealdb::Surreal<Db>) -> Result<(), surrealdb::Error> {
                Ok(())
            }
        }
    };

    expanded.into()
}
