#[macro_use]
pub mod macros;
pub mod errors;
pub mod surrealdb;
pub mod ai;
pub mod events;
pub mod documents;
pub mod storage;
pub mod web;
pub mod paths;

pub use errors::InfrastructureError;

