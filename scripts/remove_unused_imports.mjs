import fs from 'node:fs';
import path from 'node:path';

// Список файлов и неиспользуемых идентификаторов из отчета ESLint
const unusedMap = {
  'apps/spa/src/ts/features/ai/settings/AiSettingsSkillsTab.vue': ['AiSkillItem'],
  'apps/spa/src/ts/features/ai/settings/components/AiSkillEditModal.vue': ['AiSkillItem'],
  'apps/spa/src/ts/features/ai/settings/tabs/AiSettingsLocalTab.vue': ['AiProfile', 'AiProfileSettings'],
  'apps/spa/src/ts/features/ai/settings/tabs/AiSettingsModelsTab.vue': ['AiProfileSettings'],
  'apps/spa/src/ts/features/ai/settings/tabs/HardwareMonitorChart.vue': ['HardwareMonitorChartEmits', 'HardwareInfo'],
  'apps/spa/src/ts/features/ai/settings/tabs/components/AiInferenceParamsCard.vue': ['AiProfileSettings'],
  'apps/spa/src/ts/features/ai/settings/tabs/components/AiPrimaryModelCard.vue': ['AiProfile', 'AiProfileSettings'],
  'apps/spa/src/ts/features/ai/settings/tabs/components/AiRagConfigCard.vue': ['AiProfileSettings', 'InstalledModelInfo'],
  'apps/spa/src/ts/features/ai/settings/tabs/local/LocalAiExplore.vue': ['HfModelItem'],
  'apps/spa/src/ts/features/ai/settings/tabs/local/LocalAiLibrary.vue': ['InstalledModelInfo', 'AiProfileSettings', 'ModelLifecycleState'],
  'apps/spa/src/ts/features/ai/settings/tabs/local/LocalAiRecommended.vue': ['RecommendedModelCard'],
  'apps/spa/src/ts/features/analytics/ConsistencyChecker/ConsistencyChecker.model.ts': ['ConsistencyAuditSummaryData'],
  'apps/spa/src/ts/features/analytics/ConsistencyChecker/components/AuditAnomalyCard.vue': ['ContradictionAnomalyDto'],
  'apps/spa/src/ts/features/analytics/ConsistencyChecker/components/AuditSummaryHeader.vue': ['AuditSummaryStats'],
  'apps/spa/src/ts/features/analytics/CrossReferenceMatrix/CrossReferenceMatrix.vue': ['CrossReferenceMatrixEmits'],
  'apps/spa/src/ts/features/chapters/ChaptersMain/ChaptersMain.vue': ['ActiveTreeNode', 'ChapterTreeNode'],
  'apps/spa/src/ts/features/chapters/ChaptersMain/components/ChaptersHistoryDrawer.vue': ['ChapterRevision'],
  'apps/spa/src/ts/features/chapters/ChaptersMain/components/tabs/PlanningMatrixTab.vue': ['ChapterWithHierarchy', 'HierarchyVolume', 'StoryArc', 'PlanScopeType'],
  'apps/spa/src/ts/features/chapters/ChaptersMain/components/tabs/SceneInspectorTab.vue': ['ChapterWithHierarchy', 'TimelineEvent', 'ParticipantItem', 'PanelResizeType'],
  'apps/spa/src/ts/features/chapters/ChaptersView.vue': ['ChaptersViewEmits'],
  'apps/spa/src/ts/features/chapters/EditorCoreTiptap/components/EditorBody.vue': ['Editor', 'PageSize', 'WordDocumentDTO', 'SemanticDocument', 'DocumentBlock'],
  'apps/spa/src/ts/features/chapters/EditorCoreTiptap/components/EditorModals.vue': ['ParagraphFormatData', 'SemanticDocument', 'PlotPromise', 'RichPlotPromise', 'PromiseTypeOption', 'InsertEntityPayload'],
  'apps/spa/src/ts/features/chapters/EditorCoreTiptap/components/EditorSplitView.vue': ['Editor'],
  'apps/spa/src/ts/features/chapters/EditorCoreTiptap/components/EditorStatusBar.vue': ['EditorStatusBarEmits'],
  'apps/spa/src/ts/features/chapters/EditorCoreTiptap/useEntityLinkSelector.ts': ['invalidateCache'],
  'apps/spa/src/ts/features/chapters/Export/ExportModal.vue': ['ExportChapterItem', 'ExportPayload'],
  'apps/spa/src/ts/features/chapters/ParticipantsPanel/ParticipantsPanel.vue': ['ParticipantItem'],
  'apps/spa/src/ts/features/chapters/PlanningPanel/PlanningPanel.vue': ['PlanningPanelEmits'],
  'apps/spa/src/ts/features/chapters/PromisesPanel/components/PromiseCardParticipants.vue': ['ProjectEntityOption'],
  'apps/spa/src/ts/features/chapters/PromisesPanel/components/PromiseCardTimeline.vue': ['DiegeticDateBadgeInfo', 'CalendarRecord'],
  'apps/spa/src/ts/features/devtools/SurrealConsole/SurrealConsole.vue': ['navigateHistory'],
  'apps/spa/src/ts/features/devtools/SurrealConsole/components/SurrealConsoleOutput.vue': ['SurrealConsoleOutputEmits', 'QueryHistoryItem'],
  'apps/spa/src/ts/features/devtools/SurrealConsole/components/SurrealConsolePresets.vue': ['PresetQuery'],
  'apps/spa/src/ts/features/entities/CharacterJourney/CharacterJourney.vue': ['JourneyTimelineItem'],
  'apps/spa/src/ts/features/entities/CharacterJourney/components/JourneyArcGroups.vue': ['Entity', 'ArcGroup', 'JourneyTimelineItem'],
  'apps/spa/src/ts/features/entities/CharacterJourney/components/JourneyMeetingGapDivider.vue': ['JourneyMeetingGapDividerEmits', 'JourneyMeetingGap'],
  'apps/spa/src/ts/features/entities/CharacterJourney/components/JourneyModeToggle.vue': ['JourneyFilterMode'],
  'apps/spa/src/ts/features/entities/CharacterJourney/components/JourneyMultiSelector.vue': ['Entity'],
  'apps/spa/src/ts/features/entities/CharacterJourney/components/JourneyTimelineList.vue': ['JourneyTimelineItem'],
  'apps/spa/src/ts/features/entities/GraphWeb/GraphWebView.vue': ['GraphWebViewEmits'],
  'apps/spa/src/ts/features/entities/TagsManagerModal.vue': ['TagsManagerModalEmits'],
  'apps/spa/src/ts/features/schemas/SchemaEditor/SchemaContainer.vue': ['SchemaContainerItem'],
  'apps/spa/src/ts/features/schemas/SchemaEditor/SchemaEditorMain.vue': ['SchemaEditorMainEmits'],
  'apps/spa/src/ts/features/schemas/SchemaEditor/SchemaFieldEditor.vue': ['SchemaFieldItem'],
  'apps/spa/src/ts/features/schemas/SchemaEditor/components/ModuleHelpBidiCard.vue': ['ModuleHelpBidiCardEmits', 'SchemaFieldDef', 'ModuleExample'],
  'apps/spa/src/ts/features/schemas/SchemaEditor/components/ModuleHelpDynamicCard.vue': ['ModuleHelpDynamicCardEmits', 'SchemaFieldDef', 'ModuleExample'],
  'apps/spa/src/ts/features/schemas/SchemaEditor/components/SchemaCatalogSidebar.vue': ['SchemaTemplateItem'],
  'apps/spa/src/ts/features/timeline/CalendarEditor/Tab1Structure/components/Tab1DialSection.vue': ['DialUnit', 'DialPreset'],
  'apps/spa/src/ts/features/timeline/CalendarEditor/Tab1Structure/components/Tab1ExtraDaysTape.vue': ['CalendarMonth', 'YearTapeItem'],
  'apps/spa/src/ts/features/timeline/CalendarEditor/Tab1Structure/components/Tab1LeapPresets.vue': ['LeapRuleType', 'SystemPresetType', 'LeapSuggestionDto'],
  'apps/spa/src/ts/features/timeline/CalendarEditor/Tab1Structure/components/Tab1LeapRulesInspector.vue': ['CalendarMonth', 'HarmonicRule', 'LeapRuleType', 'UpcomingYearDto'],
  'apps/spa/src/ts/features/timeline/CalendarEditor/Tab1Structure/components/Tab1LeapSection.vue': ['CalendarMonth', 'HarmonicRule', 'LeapRuleType', 'LeapSuggestionDto', 'SystemPresetType', 'UpcomingYearDto', 'YearTapeItem'],
  'apps/spa/src/ts/features/timeline/CalendarEditor/Tab1Structure/components/Tab1MonthsSection.vue': ['CalendarMonth'],
  'apps/spa/src/ts/features/timeline/CalendarEditor/Tab1Structure/components/Tab1WeekdaysSection.vue': ['CalendarWeekday', 'WeekPreset'],
  'apps/spa/src/ts/features/timeline/CalendarEditor/Tab2ErasSync/components/Tab2AnchorEventsSection.vue': ['AnchorEventDto'],
  'apps/spa/src/ts/features/timeline/CalendarEditor/Tab2ErasSync/components/Tab2ErasSection.vue': ['CalendarMonth', 'ExtendedEraDto'],
  'apps/spa/src/ts/features/timeline/CalendarEditor/Tab2ErasSync/components/Tab2SyncEraForm.vue': ['CalendarEra', 'SyncDirection'],
  'apps/spa/src/ts/features/timeline/CalendarEditor/Tab2ErasSync/components/Tab2SyncEventForm.vue': ['AnchorEventDto', 'SyncDirection'],
  'apps/spa/src/ts/features/timeline/CalendarEditor/Tab2ErasSync/components/Tab2SyncSection.vue': ['CalendarEra', 'CalendarMonth', 'AnchorEventDto', 'SyncDirection', 'SyncTargetType'],
  'apps/spa/src/ts/features/timeline/CalendarEditor/Tab3CultureLore/components/Tab3AgeTimezoneSection.vue': ['CharacterAgeRuleDto'],
  'apps/spa/src/ts/features/timeline/CalendarEditor/Tab3CultureLore/components/Tab3HolidaysSection.vue': ['CalendarMonth', 'CultureHolidayDto'],
  'apps/spa/src/ts/features/timeline/CalendarEditor/Tab3CultureLore/components/Tab3MoonPhasesSection.vue': ['MoonPhaseNames'],
  'apps/spa/src/ts/features/timeline/CalendarEditor/Tab3CultureLore/components/Tab3SeasonsSection.vue': ['CalendarMonth', 'CultureSeasonDto'],
  'apps/spa/src/ts/features/timeline/CalendarEditor/Tab4Playground/components/Tab4MatrixSection.vue': ['MonthMatrixDayDto'],
  'apps/spa/src/ts/features/timeline/CalendarEditor/Tab5ReformsDst/components/Tab5DstSection.vue': ['DstPolicyConfig', 'DstPolicyType', 'DstPresetKey', 'DstTransitionRule'],
  'apps/spa/src/ts/features/timeline/CalendarEditor/Tab5ReformsDst/components/Tab5DstTransitionRules.model.ts': ['WeekdayOccurrence'],
  'apps/spa/src/ts/features/timeline/CalendarEditor/Tab5ReformsDst/components/Tab5DstTransitionRules.vue': ['DstPolicyConfig', 'DstTransitionRule'],
  'apps/spa/src/ts/features/timeline/CalendarEditor/Tab5ReformsDst/components/Tab5DualDatingCard.vue': ['DualDatingInput', 'DualDatingResult'],
  'apps/spa/src/ts/features/timeline/CalendarEditor/Tab5ReformsDst/components/Tab5ReformsSection.vue': ['DualDatingInput', 'DualDatingResult', 'GapReformParams', 'ReformPresetKey', 'ResetReformParams', 'TransitionalReformParams'],
  'apps/spa/src/ts/features/timeline/Calendars/GlobalTimeViewer/GlobalTimeViewer.vue': ['GlobalTimeViewerEmits', 'stepMinute', 'setMinute'],
  'apps/spa/src/ts/features/timeline/Calendars/TimeAtlas/tabs/TimeAtlasMatrixTab.vue': ['CalendarRecord', 'CalendarData'],
  'apps/spa/src/ts/features/timeline/Calendars/TimeAtlas/tabs/TimeAtlasSnippetsTab.vue': ['TimeAtlasSnippetsTabEmits'],
  'apps/spa/src/ts/features/timeline/Calendars/TimeAtlas/tabs/TimeAtlasWorldTab.vue': ['WorldRegion', 'WorldTimezone', 'RegionSunStatus'],
  'apps/spa/src/ts/features/timeline/PlanetEditor/components/PlanetAstrophysicsTab.vue': ['PlanetDto'],
  'apps/spa/src/ts/features/timeline/PlanetEditor/components/PlanetMoonsTab.vue': ['PlanetDto'],
  'apps/spa/src/ts/features/timeline/PlanetEditor/components/PlanetTimezonesTab.vue': ['PlanetDto'],
  'apps/spa/src/ts/features/timeline/TimelinePanel/TimelinePanel.vue': ['TimelineEvent'],
  'apps/spa/src/ts/shared/ui/UniversalDatePicker/UniversalDatePicker.vue': ['DatePickerModelValue']
};

let cleanedFilesCount = 0;
let removedItemsCount = 0;

for (const [relPath, identifiers] of Object.entries(unusedMap)) {
  const fullPath = path.resolve(process.cwd(), relPath);
  if (!fs.existsSync(fullPath)) {
    console.warn(`[SKIP] File not found: ${relPath}`);
    continue;
  }

  let content = fs.readFileSync(fullPath, 'utf8');
  let modified = false;

  for (const id of identifiers) {
    // 1. Попытка удалить из импорта: import { ..., id, ... } from '...'
    // Варианты:
    // a) `type id` или `id`
    // б) строка импорта только с этим идентификатором: import type { id } from '...';
    const singleImportRegex = new RegExp(`^[ \\t]*import\\s+(?:type\\s+)?\\{\\s*(?:type\\s+)?${id}\\s*\\}\\s+from\\s+['"][^'"]+['"];?[ \\t]*\\r?\\n?`, 'gm');
    if (singleImportRegex.test(content)) {
      content = content.replace(singleImportRegex, '');
      modified = true;
      removedItemsCount++;
      continue;
    }

    // б) средний / краевой элемент в { A, B, C }:
    // id с запятой после: `id,\s*` или `type id,\s*`
    const leadingRegex = new RegExp(`(?:type\\s+)?\\b${id}\\b\\s*,\\s*`, 'g');
    if (leadingRegex.test(content)) {
      content = content.replace(leadingRegex, '');
      modified = true;
      removedItemsCount++;
      continue;
    }

    // trailing с запятой перед: `,\s*id` или `,\s*type id`
    const trailingRegex = new RegExp(`\\s*,\\s*(?:type\\s+)?\\b${id}\\b`, 'g');
    if (trailingRegex.test(content)) {
      content = content.replace(trailingRegex, '');
      modified = true;
      removedItemsCount++;
      continue;
    }

    // 2. Деструктуризация const { a, id, b } = useHook(...)
    const leadingDestruct = new RegExp(`\\b${id}\\b\\s*,\\s*`, 'g');
    if (leadingDestruct.test(content)) {
      content = content.replace(leadingDestruct, '');
      modified = true;
      removedItemsCount++;
      continue;
    }
    const trailingDestruct = new RegExp(`\\s*,\\s*\\b${id}\\b`, 'g');
    if (trailingDestruct.test(content)) {
      content = content.replace(trailingDestruct, '');
      modified = true;
      removedItemsCount++;
      continue;
    }
  }

  // Очистка пустых импортов типа import { } from '...'
  content = content.replace(/^[ \t]*import\s+(?:type\s+)?\{\s*\}\s+from\s+['"][^'"]+['"];?[ \t]*\r?\n?/gm, '');

  if (modified) {
    fs.writeFileSync(fullPath, content, 'utf8');
    cleanedFilesCount++;
    console.log(`[CLEANED] ${relPath}`);
  }
}

console.log('====================================');
console.log(`Успешно обработано файлов: ${cleanedFilesCount}`);
console.log(`Удалено неиспользуемых элементов: ${removedItemsCount}`);
console.log('====================================');

