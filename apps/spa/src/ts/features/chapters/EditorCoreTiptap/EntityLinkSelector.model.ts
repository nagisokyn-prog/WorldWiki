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
  aliases?: string[];
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
  initialQuery?: string;
}

export interface EntityLinkSelectorEmits {
  (e: 'close'): void;
  (e: 'insert', payload: InsertEntityPayload): void;
}
