use worldwiki_domain::ai::{Chat, ChatMessage};
use crate::error::IpcError;
use crate::bridge_command;

bridge_command!(
    get_chat_tree(project_id: String) -> Result<Vec<Chat>, IpcError>
        => chat.get_chat_tree(&project_id)
);

bridge_command!(
    get_chat_messages(chat_id: String) -> Result<Vec<ChatMessage>, IpcError>
        => chat.get_messages(&chat_id)
);

bridge_command!(
    get_message_branch(chat_id: String) -> Result<Vec<ChatMessage>, IpcError>
        => chat.get_messages(&chat_id)
);

bridge_command!(
    fork_chat(
        project_id: String,
        message_id: String,
        new_title: String,
    ) -> Result<Chat, IpcError>
        => chat.fork_chat(&project_id, &message_id, &new_title)
);

bridge_command!(
    save_chat(data: Chat) -> Result<Chat, IpcError>
        => chat.save_chat(&data)
);

bridge_command!(
    update_chat_parent(
        chat_id: String,
        new_parent_id: Option<String>,
    ) -> Result<(), IpcError>
        => chat.update_chat_parent(&chat_id, new_parent_id.as_deref())
);

bridge_command!(
    delete_ai_chat(
        _project: String,
        id: String,
    ) -> Result<(), IpcError>
        => chat.delete_chat(&id)
);
