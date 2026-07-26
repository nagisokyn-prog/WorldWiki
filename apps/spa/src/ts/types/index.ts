/**
 * @file index.ts
 * @description Экспорт всех типов
 */

export type { Entity as BaseEntity } from './generated/Entity';
export type { EntityRel as Connection } from './generated/EntityRel';
export type { Chapter } from './generated/Chapter';
export type {
  AppSettings,
  ColorSettings,
  GlassSettings,
  RadiiSettings,
  ShadowSettings,
  AnimationSettings,
  FontSettings,
  SpacingSettings,
  LayoutSettings,
  InputSettings,
  ButtonSettings,
  TabSettings,
  DropdownSettings,
  CardSettings,
  EditorSettings,
  NotificationSettings,
  PerfSettings,
  LoadMeterResult,
  AutoFPSResult
} from './settings';