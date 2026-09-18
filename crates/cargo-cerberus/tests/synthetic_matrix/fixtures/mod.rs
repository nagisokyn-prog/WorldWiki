#![allow(unused_imports, dead_code)]

pub mod hexagonal_fixture;
pub mod layered_fixture;
pub mod clean_arch_fixture;
pub mod microservices_fixture;
pub mod modular_monolith_fixture;
pub mod cqrs_es_fixture;
pub mod onion_fixture;
pub mod microkernel_fixture;
pub mod actor_system_fixture;
pub mod serverless_fixture;
pub mod vue_fsd_fixture;
pub mod vue_legacy_fixture;
pub mod bff_fixture;
pub mod event_driven_fixture;
pub mod final_boss_composite_fixture;

pub use hexagonal_fixture::HexagonalCleanFixture;
pub use layered_fixture::LayeredNTierFixture;
pub use clean_arch_fixture::CleanArchFixture;
pub use microservices_fixture::MicroservicesFixture;
pub use modular_monolith_fixture::ModularMonolithFixture;
pub use cqrs_es_fixture::CqrsEsFixture;
pub use onion_fixture::OnionFixture;
pub use microkernel_fixture::MicrokernelFixture;
pub use actor_system_fixture::ActorSystemFixture;
pub use serverless_fixture::ServerlessFixture;
pub use vue_fsd_fixture::VueFsdFixture;
pub use vue_legacy_fixture::VueLegacyFixture;
pub use bff_fixture::BffFixture;
pub use event_driven_fixture::EventDrivenFixture;
pub use final_boss_composite_fixture::FinalBossCompositeFixture;
