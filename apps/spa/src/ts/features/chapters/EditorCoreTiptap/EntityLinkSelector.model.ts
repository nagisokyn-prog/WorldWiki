export interface EntityTypeItem {
  id: string;
  name: string;
  icon: string;
}

export interface EntitySelectorItem {
  id: string;
  name: string;
  entity_type: string;
  type_name?: string;
  type_icon?: string;
  tags?: string[];
  cleanTags?: string[];
  shortId?: string;
  [key: string]: unknown;
}

export interface InsertEntityPayload {
  type: string;
  id: string;
  name?: string;
}

export interface EntityLinkSelectorProps {
  project: string;
  isOpen?: boolean;
}

export interface EntityLinkSelectorEmits {
  (e: 'close'): void;
  (e: 'insert', payload: InsertEntityPayload): void;
}
