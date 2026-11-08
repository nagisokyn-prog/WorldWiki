#[macro_use]
pub mod macros;
pub mod errors;
pub mod surrealdb;
pub mod mock_ai;
pub mod model_discovery;
pub mod events;
pub mod documents;
pub mod storage;
pub mod web;
pub mod paths;

pub use errors::InfrastructureError;

