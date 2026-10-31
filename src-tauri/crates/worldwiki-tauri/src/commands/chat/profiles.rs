use worldwiki_domain::ai::{AiModelInfo, AiProfile};
use crate::error::IpcError;
use crate::bridge_command;

bridge_command!(
    fetch_ai_models(
        provider: String,
        api_key: Option<String>,
    ) -> Result<Vec<AiModelInfo>, IpcError>
        => chat.fetch_models(&provider, api_key.as_deref())
);

bridge_command!(
    get_aiprofiles(project: String) -> Result<Vec<AiProfile>, IpcError>
        => chat.get_profiles(&project)
);

bridge_command!(
    save_aiprofile(data: AiProfile) -> Result<AiProfile, IpcError>
        => chat.save_profile(&data)
);

bridge_command!(
    delete_aiprofile(
        _project: String,
        id: String,
    ) -> Result<(), IpcError>
        => chat.delete_profile(&id)
);
