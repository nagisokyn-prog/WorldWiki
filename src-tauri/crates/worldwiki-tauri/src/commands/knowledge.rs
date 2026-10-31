use worldwiki_domain::knowledge::{Entity, EntityRelation};
use worldwiki_application::knowledge::EntityCardDto;
use crate::error::IpcError;
use crate::bridge_command;

bridge_command!(
    get_entity(entity_id: String) -> Result<Entity, IpcError>
        => knowledge.get_entity(&entity_id)
);

bridge_command!(
    get_entity_full_card(entity_id: String) -> Result<EntityCardDto, IpcError>
        => knowledge.get_full_card(&entity_id)
);

bridge_command!(
    save_entity(entity: Entity) -> Result<(), IpcError>
        => knowledge.save_entity(&entity)
);

bridge_command!(
    add_entity_relation(relation: EntityRelation) -> Result<(), IpcError>
        => knowledge.add_relation(&relation)
);
