use crate::error::SurrealDomainError;
use crate::read_ops::{repo_find_all, repo_find_by_id};
use crate::write_ops::{repo_create, repo_delete, repo_save};
use serde::Serialize;

pub use crate::id_helpers::is_not_found as is_record_not_found;

/// Trait that an application state or connection provider must implement.
pub trait SurrealDb: Send + Sync + 'static {
    type Connection: surrealdb::Connection;
    fn surreal_db(&self) -> &surrealdb::Surreal<Self::Connection>;
}

pub trait SurrealRepository:
    Serialize + serde::de::DeserializeOwned + Clone + Send + Sync + 'static
{
    const TABLE: &'static str;
    fn get_fields() -> &'static [&'static str];
    fn get_option_fields() -> &'static [&'static str];
    fn get_id(&self) -> Option<&str>;
    fn set_id(&mut self, id: String);

    #[allow(async_fn_in_trait)]
    async fn create<Db: surrealdb::Connection>(
        db: &surrealdb::Surreal<Db>,
        entity: Self,
    ) -> Result<Self, SurrealDomainError> {
        repo_create(db, Self::TABLE, entity).await
    }

    #[allow(async_fn_in_trait)]
    async fn find_by_id<Db: surrealdb::Connection>(
        db: &surrealdb::Surreal<Db>,
        id: &str,
    ) -> Result<Option<Self>, SurrealDomainError> {
        repo_find_by_id(db, Self::TABLE, id).await
    }

    #[allow(async_fn_in_trait)]
    async fn find_all<Db: surrealdb::Connection>(
        db: &surrealdb::Surreal<Db>,
        project_id: &str,
    ) -> Result<Vec<Self>, SurrealDomainError> {
        repo_find_all(db, Self::TABLE, project_id).await
    }

    #[allow(async_fn_in_trait)]
    async fn save<Db: surrealdb::Connection>(
        db: &surrealdb::Surreal<Db>,
        entity: &Self,
    ) -> Result<Self, SurrealDomainError> {
        repo_save(db, Self::TABLE, Self::get_fields(), Self::get_option_fields(), entity).await
    }

    #[allow(async_fn_in_trait)]
    async fn delete<Db: surrealdb::Connection>(
        db: &surrealdb::Surreal<Db>,
        id: &str,
    ) -> Result<(), SurrealDomainError> {
        repo_delete(db, Self::TABLE, id).await
    }
}
