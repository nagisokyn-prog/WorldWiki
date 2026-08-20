import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const migrations = [
  // AI
  {
    from: 'apps/spa/src/ts/features/ai/WowilonPanel.vue.css',
    to: 'packages/resources/src/styles/features/ai/WowilonPanel.css',
    vue: 'apps/spa/src/ts/features/ai/WowilonPanel.vue',
    oldSrc: './WowilonPanel.vue.css',
    newSrc: '@worldwiki/resources/styles/features/ai/WowilonPanel.css'
  },
  // Chapters
  {
    from: 'apps/spa/src/ts/features/chapters/ChaptersMain/ChaptersMain.vue.css',
    to: 'packages/resources/src/styles/features/chapters/ChaptersMain.css',
    vue: 'apps/spa/src/ts/features/chapters/ChaptersMain/ChaptersMain.vue',
    oldSrc: './ChaptersMain.vue.css',
    newSrc: '@worldwiki/resources/styles/features/chapters/ChaptersMain.css'
  },
  {
    from: 'apps/spa/src/ts/features/chapters/ChapterTree/ChapterTree.style.css',
    to: 'packages/resources/src/styles/features/chapters/ChapterTree.css',
    vue: 'apps/spa/src/ts/features/chapters/ChapterTree/ChapterTree.vue',
    oldSrc: './ChapterTree.style.css',
    newSrc: '@worldwiki/resources/styles/features/chapters/ChapterTree.css'
  },
  {
    from: 'apps/spa/src/ts/features/chapters/EditorCoreTiptap/EditorCoreTiptap.style.css',
    to: 'packages/resources/src/styles/features/chapters/EditorCoreTiptap.css',
    vue: 'apps/spa/src/ts/features/chapters/EditorCoreTiptap/EditorCoreTiptap.vue',
    oldSrc: './EditorCoreTiptap.style.css',
    newSrc: '@worldwiki/resources/styles/features/chapters/EditorCoreTiptap.css'
  },
  {
    from: 'apps/spa/src/ts/features/chapters/Export/ExportModal.vue.css',
    to: 'packages/resources/src/styles/features/chapters/ExportModal.css',
    vue: 'apps/spa/src/ts/features/chapters/Export/ExportModal.vue',
    oldSrc: './ExportModal.vue.css',
    newSrc: '@worldwiki/resources/styles/features/chapters/ExportModal.css'
  },
  {
    from: 'apps/spa/src/ts/features/chapters/ParticipantsPanel/ParticipantsPanel.vue.css',
    to: 'packages/resources/src/styles/features/chapters/ParticipantsPanel.css',
    vue: 'apps/spa/src/ts/features/chapters/ParticipantsPanel/ParticipantsPanel.vue',
    oldSrc: './ParticipantsPanel.vue.css',
    newSrc: '@worldwiki/resources/styles/features/chapters/ParticipantsPanel.css'
  },
  {
    from: 'apps/spa/src/ts/features/chapters/PlanningPanel/PlanningPanel.vue.css',
    to: 'packages/resources/src/styles/features/chapters/PlanningPanel.css',
    vue: 'apps/spa/src/ts/features/chapters/PlanningPanel/PlanningPanel.vue',
    oldSrc: './PlanningPanel.vue.css',
    newSrc: '@worldwiki/resources/styles/features/chapters/PlanningPanel.css'
  },
  {
    from: 'apps/spa/src/ts/features/chapters/Semantic/SemanticParagraph.vue.css',
    to: 'packages/resources/src/styles/features/chapters/SemanticParagraph.css',
    vue: 'apps/spa/src/ts/features/chapters/Semantic/SemanticParagraph.vue',
    oldSrc: './SemanticParagraph.vue.css',
    newSrc: '@worldwiki/resources/styles/features/chapters/SemanticParagraph.css'
  },
  {
    from: 'apps/spa/src/ts/features/chapters/Semantic/SemanticParagraphNode.vue.css',
    to: 'packages/resources/src/styles/features/chapters/SemanticParagraphNode.css',
    vue: 'apps/spa/src/ts/features/chapters/Semantic/SemanticParagraphNode.vue',
    oldSrc: './SemanticParagraphNode.vue.css',
    newSrc: '@worldwiki/resources/styles/features/chapters/SemanticParagraphNode.css'
  },
  // Entities
  {
    from: 'apps/spa/src/ts/features/entities/EntityEditor/EntityEditor.style.css',
    to: 'packages/resources/src/styles/features/entities/EntityEditor.css',
    vue: 'apps/spa/src/ts/features/entities/EntityEditor/EntityEditor.vue',
    oldSrc: './EntityEditor.style.css',
    newSrc: '@worldwiki/resources/styles/features/entities/EntityEditor.css'
  },
  {
    from: 'apps/spa/src/ts/features/entities/TagsManagerModal.vue.css',
    to: 'packages/resources/src/styles/features/entities/TagsManagerModal.css',
    vue: 'apps/spa/src/ts/features/entities/TagsManagerModal.vue',
    oldSrc: './TagsManagerModal.vue.css',
    newSrc: '@worldwiki/resources/styles/features/entities/TagsManagerModal.css'
  },
  // Schemas
  {
    from: 'apps/spa/src/ts/features/schemas/SchemaEditor/SchemaContainer.vue.css',
    to: 'packages/resources/src/styles/features/schemas/SchemaContainer.css',
    vue: 'apps/spa/src/ts/features/schemas/SchemaEditor/SchemaContainer.vue',
    oldSrc: './SchemaContainer.vue.css',
    newSrc: '@worldwiki/resources/styles/features/schemas/SchemaContainer.css'
  },
  {
    from: 'apps/spa/src/ts/features/schemas/SchemaEditor/SchemaEditorMain.vue.css',
    to: 'packages/resources/src/styles/features/schemas/SchemaEditorMain.css',
    vue: 'apps/spa/src/ts/features/schemas/SchemaEditor/SchemaEditorMain.vue',
    oldSrc: './SchemaEditorMain.vue.css',
    newSrc: '@worldwiki/resources/styles/features/schemas/SchemaEditorMain.css'
  },
  // Shell
  {
    from: 'apps/spa/src/ts/features/shell/Splash.vue.css',
    to: 'packages/resources/src/styles/features/shell/Splash.css',
    vue: 'apps/spa/src/ts/features/shell/Splash.vue',
    oldSrc: './Splash.vue.css',
    newSrc: '@worldwiki/resources/styles/features/shell/Splash.css'
  },
  {
    from: 'apps/spa/src/ts/features/sync/CloudSyncModal.vue.css',
    to: 'packages/resources/src/styles/features/shell/CloudSyncModal.css',
    vue: 'apps/spa/src/ts/features/sync/CloudSyncModal.vue',
    oldSrc: './CloudSyncModal.vue.css',
    newSrc: '@worldwiki/resources/styles/features/shell/CloudSyncModal.css'
  },
  // Timeline
  {
    from: 'apps/spa/src/ts/features/timeline/Calendars/CalendarMoons/CalendarMoons.vue.css',
    to: 'packages/resources/src/styles/features/timeline/CalendarMoons.css',
    vue: 'apps/spa/src/ts/features/timeline/Calendars/CalendarMoons/CalendarMoons.vue',
    oldSrc: './CalendarMoons.vue.css',
    newSrc: '@worldwiki/resources/styles/features/timeline/CalendarMoons.css'
  },
  {
    from: 'apps/spa/src/ts/features/timeline/Calendars/CalendarPlayground/CalendarPlayground.vue.css',
    to: 'packages/resources/src/styles/features/timeline/CalendarPlayground.css',
    vue: 'apps/spa/src/ts/features/timeline/Calendars/CalendarPlayground/CalendarPlayground.vue',
    oldSrc: './CalendarPlayground.vue.css',
    newSrc: '@worldwiki/resources/styles/features/timeline/CalendarPlayground.css'
  },
  {
    from: 'apps/spa/src/ts/features/timeline/Calendars/CalendarSettings/CalendarSettings.vue.css',
    to: 'packages/resources/src/styles/features/timeline/CalendarSettings.css',
    vue: 'apps/spa/src/ts/features/timeline/Calendars/CalendarSettings/CalendarSettings.vue',
    oldSrc: './CalendarSettings.vue.css',
    newSrc: '@worldwiki/resources/styles/features/timeline/CalendarSettings.css'
  },
  {
    from: 'apps/spa/src/ts/features/timeline/Calendars/GlobalCalendarWidget/GlobalCalendarWidget.vue.css',
    to: 'packages/resources/src/styles/features/timeline/GlobalCalendarWidget.css',
    vue: 'apps/spa/src/ts/features/timeline/Calendars/GlobalCalendarWidget/GlobalCalendarWidget.vue',
    oldSrc: './GlobalCalendarWidget.vue.css',
    newSrc: '@worldwiki/resources/styles/features/timeline/GlobalCalendarWidget.css'
  },
  {
    from: 'apps/spa/src/ts/features/timeline/Calendars/GlobalTimeViewer/GlobalTimeViewer.vue.css',
    to: 'packages/resources/src/styles/features/timeline/GlobalTimeViewer.css',
    vue: 'apps/spa/src/ts/features/timeline/Calendars/GlobalTimeViewer/GlobalTimeViewer.vue',
    oldSrc: './GlobalTimeViewer.vue.css',
    newSrc: '@worldwiki/resources/styles/features/timeline/GlobalTimeViewer.css'
  },
  {
    from: 'apps/spa/src/ts/features/timeline/CalendarsPanel/CalendarsPanel.vue.css',
    to: 'packages/resources/src/styles/features/timeline/CalendarsPanel.css',
    vue: 'apps/spa/src/ts/features/timeline/CalendarsPanel/CalendarsPanel.vue',
    oldSrc: './CalendarsPanel.vue.css',
    newSrc: '@worldwiki/resources/styles/features/timeline/CalendarsPanel.css'
  },
  {
    from: 'apps/spa/src/ts/features/timeline/CalendarsPanel/DateWheels.vue.css',
    to: 'packages/resources/src/styles/features/timeline/DateWheels.css',
    vue: 'apps/spa/src/ts/features/timeline/CalendarsPanel/DateWheels.vue',
    oldSrc: './DateWheels.vue.css',
    newSrc: '@worldwiki/resources/styles/features/timeline/DateWheels.css'
  },
  {
    from: 'apps/spa/src/ts/features/timeline/UniversalDatePicker/UniversalDatePicker.vue.css',
    to: 'packages/resources/src/styles/features/timeline/UniversalDatePicker.css',
    vue: 'apps/spa/src/ts/features/timeline/UniversalDatePicker/UniversalDatePicker.vue',
    oldSrc: './UniversalDatePicker.vue.css',
    newSrc: '@worldwiki/resources/styles/features/timeline/UniversalDatePicker.css'
  }
];

// Также компоненты из packages/resources/src/styles/
const resourceMoves = [
  {
    from: 'packages/resources/src/styles/project_launcher.css',
    to: 'packages/resources/src/styles/features/shell/ProjectLauncher.css',
    vue: 'apps/spa/src/ts/features/shell/ProjectLauncher.vue',
    newSrc: '@worldwiki/resources/styles/features/shell/ProjectLauncher.css'
  },
  {
    from: 'packages/resources/src/styles/explorer-tree.css',
    to: 'packages/resources/src/styles/components/ExplorerTree.css',
    vue: 'packages/components/src/components/Vue/ExplorerTree.vue',
    newSrc: '@worldwiki/resources/styles/components/ExplorerTree.css'
  },
  {
    from: 'packages/resources/src/styles/modules/settings.css',
    to: 'packages/resources/src/styles/components/Settings.css',
    vue: 'packages/components/src/components/Vue/Settings.vue',
    newSrc: '@worldwiki/resources/styles/components/Settings.css'
  },
  {
    from: 'packages/resources/src/styles/modules/timeline-panel.css',
    to: 'packages/resources/src/styles/features/timeline/TimelinePanel.css',
    vue: 'apps/spa/src/ts/features/timeline/Calendars/TimelinePanel/TimelinePanel.vue',
    newSrc: '@worldwiki/resources/styles/features/timeline/TimelinePanel.css'
  },
  {
    from: 'packages/resources/src/styles/modules/relationship-block.css',
    to: 'packages/resources/src/styles/features/schemas/RelationshipBlock.css',
    vue: 'apps/spa/src/ts/features/schemas/SchemaEditor/RelationshipBlock.vue',
    newSrc: '@worldwiki/resources/styles/features/schemas/RelationshipBlock.css'
  }
];

// 1. Выполняем миграцию .vue.css
for (const m of migrations) {
  const fromPath = path.join(__dirname, m.from);
  const toPath = path.join(__dirname, m.to);
  const vuePath = path.join(__dirname, m.vue);

  if (fs.existsSync(fromPath)) {
    fs.mkdirSync(path.dirname(toPath), { recursive: true });
    fs.copyFileSync(fromPath, toPath);
    console.log(`Copied: ${m.from} -> ${m.to}`);
    fs.unlinkSync(fromPath);
  }

  if (fs.existsSync(vuePath)) {
    let vueContent = fs.readFileSync(vuePath, 'utf8');
    if (vueContent.includes(m.oldSrc)) {
      vueContent = vueContent.replace(m.oldSrc, m.newSrc);
      fs.writeFileSync(vuePath, vueContent, 'utf8');
      console.log(`Updated vue import: ${m.vue}`);
    }
  }
}

// 2. Выполняем миграцию ресурсов
for (const m of resourceMoves) {
  const fromPath = path.join(__dirname, m.from);
  const toPath = path.join(__dirname, m.to);
  const vuePath = path.join(__dirname, m.vue);

  if (fs.existsSync(fromPath)) {
    fs.mkdirSync(path.dirname(toPath), { recursive: true });
    fs.copyFileSync(fromPath, toPath);
    console.log(`Moved resource: ${m.from} -> ${m.to}`);
    fs.unlinkSync(fromPath);
  }

  if (fs.existsSync(vuePath)) {
    let vueContent = fs.readFileSync(vuePath, 'utf8');
    // Заменяем любые вариации старых импортов
    vueContent = vueContent.replace(/src="[^"]*styles\/[^"]*"/g, `src="${m.newSrc}"`);
    vueContent = vueContent.replace(/src="\.\.\/\.\.\/\.\.\/[^"]*"/g, `src="${m.newSrc}"`);
    fs.writeFileSync(vuePath, vueContent, 'utf8');
    console.log(`Updated vue import: ${m.vue}`);
  }
}

console.log('Migration Phase 2 complete!');
