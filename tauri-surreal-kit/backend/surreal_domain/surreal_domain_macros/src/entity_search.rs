use proc_macro2::TokenStream as TokenStream2;
use quote::quote;
use syn::Ident;

/// Generates fulltext and vector search methods for an entity.
pub(crate) fn build_search_methods(
    _name: &Ident,
    table_name: &str,
    fulltext_fields: &[&Ident],
    vector_fields: &[&Ident],
) -> TokenStream2 {
    if fulltext_fields.is_empty() && vector_fields.is_empty() {
        return quote! {};
    }

    let ft_query = if !fulltext_fields.is_empty() {
        let matches: Vec<String> = fulltext_fields
            .iter()
            .enumerate()
            .map(|(i, f)| format!("{} @{}@ $q", f, i + 1))
            .collect();
        let match_clause = matches.join(" OR ");
        let q = format!(
            "SELECT *, search::score(1) AS _score FROM {} WHERE (project_id = $proj OR project_id = type::record($proj)) AND ({})",
            table_name, match_clause
        );

        quote! {
            pub async fn search_fulltext<Db: surrealdb::Connection>(
                db: &surrealdb::Surreal<Db>,
                project_id: &str,
                query: &str,
            ) -> Result<Vec<surreal_domain::SearchResult<Self>>, surreal_domain::SurrealDomainError> {
                let mut res = db
                    .query(#q)
                    .bind(("proj", project_id.to_string()))
                    .bind(("q", query))
                    .await?;
                let items: Vec<serde_json::Value> = res.take(0)?;
                let mapped = items
                    .into_iter()
                    .filter_map(|v| serde_json::from_value::<Self>(v).ok())
                    .map(|e| surreal_domain::SearchResult {
                        entity: e,
                        score: 1.0,
                        kind: surreal_domain::SearchKind::Fulltext,
                    })
                    .collect();
                Ok(mapped)
            }
        }
    } else {
        quote! {}
    };

    let vec_query = if let Some(v_field) = vector_fields.first() {
        let v_field_str = v_field.to_string();
        let q_str = format!(
            "SELECT *, vector::distance::knn() AS _sim FROM {} WHERE {} <|$k, COSINE|> $emb ORDER BY _sim",
            table_name, v_field_str
        );

        quote! {
            pub async fn search_similar<Db: surrealdb::Connection>(
                db: &surrealdb::Surreal<Db>,
                embedding: Vec<f32>,
                k: i64,
            ) -> Result<Vec<surreal_domain::SimilarResult<Self>>, surreal_domain::SurrealDomainError> {
                let mut res = db
                    .query(#q_str)
                    .bind(("emb", embedding))
                    .bind(("k", k))
                    .await?;
                let items: Vec<serde_json::Value> = res.take(0)?;
                let mapped = items
                    .into_iter()
                    .filter_map(|v| serde_json::from_value::<Self>(v).ok())
                    .map(|e| surreal_domain::SimilarResult {
                        entity: e,
                        similarity: 1.0,
                    })
                    .collect();
                Ok(mapped)
            }
        }
    } else {
        quote! {}
    };

    quote! {
        #ft_query
        #vec_query
    }
}
