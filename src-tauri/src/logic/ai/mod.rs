pub mod chat;
pub mod agent;
pub mod tools;
pub mod providers;
pub mod model_hub;
pub mod chunker;
pub mod retrieval;
pub mod types;
pub mod hardware;
pub mod manager;
pub mod permissions;

#[cfg(feature = "ai-local")]
pub mod local_llm;

#[cfg(feature = "ai-local")]
pub mod agent_runtime;

pub use chat::tree::get_chat_tree;
pub use chat::tree::get_chat_messages;
pub use chat::tree::get_message_branch;
pub use chat::operations::fork_chat;
pub use chat::operations::update_chat_parent;
pub use chat::operations::send_chat_message;
pub use chat::operations::cancel_generation;
pub use chat::operations::delete_chat_message;
pub use chat::operations::edit_chat_message;
pub use chat::operations::regenerate_chat_message;
pub use chat::operations::switch_message_variant;

pub use agent::runner::get_ai_completion;
pub use agent::runner::generate_chat_title;

pub use providers::fetch::fetch_ai_models;
pub use chat::operations::delete_ai_chat;
pub use model_hub::fetch_hf_models;
pub use model_hub::download_hf_model;

pub use hardware::get_hardware_info;
pub use hardware::calculate_quantization_estimates;
pub use hardware::get_recommended_local_models;

pub use manager::list_installed_models;
pub use manager::load_local_model;
pub use manager::unload_local_model;
pub use manager::delete_local_model;

pub use permissions::get_tool_permissions_catalog;
