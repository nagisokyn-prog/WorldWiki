import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as api from '../api.client';
import { invoke } from '@tauri-apps/api/core';

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

describe('api.client (Tauri invoke contract tests)', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('Project endpoints', () => {
    it('getProjects invokes get_projects', async () => {
      vi.mocked(invoke).mockResolvedValue(['p1']);
      const res = await api.getProjects();
      expect(invoke).toHaveBeenCalledWith('get_projects');
      expect(res).toEqual(['p1']);
    });

    it('createProject invokes create_project with payload', async () => {
      vi.mocked(invoke).mockResolvedValue('proj_id');
      const res = await api.createProject({ name: 'World' });
      expect(invoke).toHaveBeenCalledWith('create_project', { projectData: { name: 'World' } });
      expect(res).toBe('proj_id');
    });

    it('getProjectConfig invokes get_project_config', async () => {
      vi.mocked(invoke).mockResolvedValue({ type: 'novel' });
      const res = await api.getProjectConfig('my_project');
      expect(invoke).toHaveBeenCalledWith('get_project_config', { name: 'my_project' });
      expect(res).toEqual({ type: 'novel' });
    });

    it('saveProjectConfig invokes save_project_config', async () => {
      vi.mocked(invoke).mockResolvedValue({ saved: true });
      const res = await api.saveProjectConfig('my_project', { custom: 123 });
      expect(invoke).toHaveBeenCalledWith('save_project_config', { name: 'my_project', config: { custom: 123 } });
      expect(res).toEqual({ saved: true });
    });

    it('deleteProject invokes delete_project', async () => {
      vi.mocked(invoke).mockResolvedValue('ok');
      const res = await api.deleteProject('my_project');
      expect(invoke).toHaveBeenCalledWith('delete_project', { name: 'my_project' });
      expect(res).toBe('ok');
    });

    it('handles Tauri invoke rejection', async () => {
      vi.mocked(invoke).mockRejectedValue(new Error('Project not found'));
      await expect(api.getProjectConfig('unknown')).rejects.toThrow('Project not found');
    });
  });

  describe('Entity endpoints', () => {
    it('getEntities invokes get_entities with project and entityType', async () => {
      vi.mocked(invoke).mockResolvedValue([]);
      await api.getEntities('proj_1', 'character');
      expect(invoke).toHaveBeenCalledWith('get_entities', { project: 'proj_1', entityType: 'character' });
    });

    it('getEntitiesBatch invokes get_entities_batch', async () => {
      vi.mocked(invoke).mockResolvedValue({ char: [] });
      const res = await api.getEntitiesBatch('proj_1', ['char', 'loc']);
      expect(invoke).toHaveBeenCalledWith('get_entities_batch', { project: 'proj_1', entityTypes: ['char', 'loc'] });
      expect(res).toEqual({ char: [] });
    });

    it('getEntity invokes get_entity with id', async () => {
      vi.mocked(invoke).mockResolvedValue({ id: 'char_1' });
      const res = await api.getEntity('char_1');
      expect(invoke).toHaveBeenCalledWith('get_entity', { id: 'char_1' });
      expect(res).toEqual({ id: 'char_1' });
    });

    it('saveEntity invokes save_entity', async () => {
      const entity: any = { id: 'e1', name: 'Hero' };
      vi.mocked(invoke).mockResolvedValue(entity);
      await api.saveEntity('proj_1', entity);
      expect(invoke).toHaveBeenCalledWith('save_entity', { project: 'proj_1', entity });
    });

    it('saveEntityWithRelations invokes save_entity_with_relations', async () => {
      const entity: any = { id: 'e1' };
      const fUpdates: any = [{ id: 'e2' }];
      vi.mocked(invoke).mockResolvedValue(entity);
      const res = await api.saveEntityWithRelations('proj_1', entity, fUpdates);
      expect(invoke).toHaveBeenCalledWith('save_entity_with_relations', { project: 'proj_1', entity, foreignUpdates: fUpdates });
      expect(res).toEqual(entity);
    });

    it('deleteEntity invokes delete_entity', async () => {
      await api.deleteEntity('e1');
      expect(invoke).toHaveBeenCalledWith('delete_entity', { id: 'e1' });
    });

    it('searchEntities invokes search_entities', async () => {
      vi.mocked(invoke).mockResolvedValue([]);
      await api.searchEntities('proj_1', 'query', 'location');
      expect(invoke).toHaveBeenCalledWith('search_entities', { project: 'proj_1', query: 'query', entityType: 'location' });
    });
  });

  describe('Schema & History endpoints', () => {
    it('getEntitySchemas invokes get_entity_schemas', async () => {
      vi.mocked(invoke).mockResolvedValue([]);
      await api.getEntitySchemas('proj_1');
      expect(invoke).toHaveBeenCalledWith('get_entity_schemas', { project: 'proj_1' });
    });

    it('saveEntitySchema invokes save_entity_schema', async () => {
      const schema: any = { key: 'char' };
      vi.mocked(invoke).mockResolvedValue(schema);
      const res = await api.saveEntitySchema('proj_1', schema, 10);
      expect(invoke).toHaveBeenCalledWith('save_entity_schema', { project: 'proj_1', schema, maxSaves: 10 });
      expect(res).toEqual(schema);
    });

    it('deleteEntitySchema invokes delete_entity_schema', async () => {
      await api.deleteEntitySchema('proj_1', 'char');
      expect(invoke).toHaveBeenCalledWith('delete_entity_schema', { project: 'proj_1', typeKey: 'char' });
    });

    it('getSchemaHistory invokes get_schema_history', async () => {
      vi.mocked(invoke).mockResolvedValue(['hist1']);
      const res = await api.getSchemaHistory('proj_1', 'char');
      expect(invoke).toHaveBeenCalledWith('get_schema_history', { project: 'proj_1', typeKey: 'char' });
      expect(res).toEqual(['hist1']);
    });

    it('toggleSchemaHistoryPin invokes toggle_schema_history_pin', async () => {
      await api.toggleSchemaHistoryPin('hist_1', true);
      expect(invoke).toHaveBeenCalledWith('toggle_schema_history_pin', { historyId: 'hist_1', isPinned: true });
    });

    it('toggleEntityHistoryPin invokes toggle_entity_history_pin', async () => {
      await api.toggleEntityHistoryPin('ehist_1', false);
      expect(invoke).toHaveBeenCalledWith('toggle_entity_history_pin', { historyId: 'ehist_1', isPinned: false });
    });

    it('toggleChapterHistoryPin invokes toggle_chapter_history_pin', async () => {
      await api.toggleChapterHistoryPin('chist_1', true);
      expect(invoke).toHaveBeenCalledWith('toggle_chapter_history_pin', { historyId: 'chist_1', isPinned: true });
    });
  });

  describe('Entity Relations & Relation Schemas', () => {
    it('getEntityRelations invokes get_entity_relations', async () => {
      vi.mocked(invoke).mockResolvedValue([]);
      await api.getEntityRelations('proj_1', 'e1');
      expect(invoke).toHaveBeenCalledWith('get_entity_relations', { project: 'proj_1', entityId: 'e1' });
    });

    it('createEntityRelation invokes create_entity_relation', async () => {
      const rel: any = { type: 'friend' };
      vi.mocked(invoke).mockResolvedValue(rel);
      const res = await api.createEntityRelation('proj_1', 'e1', 'e2', rel);
      expect(invoke).toHaveBeenCalledWith('create_entity_relation', { project: 'proj_1', fromId: 'e1', toId: 'e2', rel });
      expect(res).toEqual(rel);
    });

    it('deleteEntityRelation invokes delete_entity_relation', async () => {
      await api.deleteEntityRelation('rel_1');
      expect(invoke).toHaveBeenCalledWith('delete_entity_relation', { id: 'rel_1' });
    });

    it('getRelationSchemas invokes get_relation_schemas', async () => {
      vi.mocked(invoke).mockResolvedValue([]);
      await api.getRelationSchemas('proj_1');
      expect(invoke).toHaveBeenCalledWith('get_relation_schemas', { project: 'proj_1' });
    });

    it('saveRelationSchema invokes save_relation_schema', async () => {
      const schema: any = { key: 'friend' };
      vi.mocked(invoke).mockResolvedValue(schema);
      const res = await api.saveRelationSchema('proj_1', schema);
      expect(invoke).toHaveBeenCalledWith('save_relation_schema', { project: 'proj_1', schema });
      expect(res).toEqual(schema);
    });

    it('deleteRelationSchema invokes delete_relation_schema', async () => {
      await api.deleteRelationSchema('proj_1', 'friend');
      expect(invoke).toHaveBeenCalledWith('delete_relation_schema', { project: 'proj_1', relKey: 'friend' });
    });
  });

  describe('File, Photo, & System endpoints', () => {
    it('uploadPhoto invokes upload_photo', async () => {
      vi.mocked(invoke).mockResolvedValue('path/to/img.png');
      const res = await api.uploadPhoto([1, 2, 3], 'img.png');
      expect(invoke).toHaveBeenCalledWith('upload_photo', { bytes: [1, 2, 3], filename: 'img.png' });
      expect(res).toBe('path/to/img.png');
    });

    it('copyBackgroundFile invokes copy_background_file', async () => {
      vi.mocked(invoke).mockResolvedValue('bg/path.png');
      const res = await api.copyBackgroundFile('src/path.png');
      expect(invoke).toHaveBeenCalledWith('copy_background_file', { sourcePath: 'src/path.png' });
      expect(res).toBe('bg/path.png');
    });

    it('getLocalFile invokes get_local_file', async () => {
      vi.mocked(invoke).mockResolvedValue([255, 216]);
      const res = await api.getLocalFile('assets/file.bin');
      expect(invoke).toHaveBeenCalledWith('get_local_file', { path: 'assets/file.bin' });
      expect(res).toEqual([255, 216]);
    });

    it('runPerformanceBenchmark invokes run_performance_benchmark', async () => {
      vi.mocked(invoke).mockResolvedValue({ score: 100 });
      const res = await api.runPerformanceBenchmark();
      expect(invoke).toHaveBeenCalledWith('run_performance_benchmark');
      expect(res).toEqual({ score: 100 });
    });

    it('getPerformanceStyles invokes get_performance_styles', async () => {
      vi.mocked(invoke).mockResolvedValue('body { filter: none; }');
      const res = await api.getPerformanceStyles('high');
      expect(invoke).toHaveBeenCalledWith('get_performance_styles', { level: 'high' });
      expect(res).toBe('body { filter: none; }');
    });

    it('saveSettings and loadSettings invoke corresponding commands', async () => {
      vi.mocked(invoke).mockResolvedValue({ theme: 'dark' });
      await api.saveSettings({ theme: 'dark' });
      expect(invoke).toHaveBeenCalledWith('save_settings', { settings: { theme: 'dark' } });

      const loaded = await api.loadSettings();
      expect(invoke).toHaveBeenCalledWith('load_settings');
      expect(loaded).toEqual({ theme: 'dark' });
    });

    it('toggleFullscreen invokes toggle_fullscreen', async () => {
      await api.toggleFullscreen();
      expect(invoke).toHaveBeenCalledWith('toggle_fullscreen');
    });

    it('getCustomThemes, loadTheme, saveCustomTheme invoke correctly', async () => {
      vi.mocked(invoke).mockResolvedValue(['t1']);
      const themes = await api.getCustomThemes();
      expect(invoke).toHaveBeenCalledWith('get_custom_themes');
      expect(themes).toEqual(['t1']);

      vi.mocked(invoke).mockResolvedValue({ color: 'red' });
      const theme = await api.loadTheme('t1');
      expect(invoke).toHaveBeenCalledWith('load_theme', { theme: 't1' });
      expect(theme).toEqual({ color: 'red' });

      await api.saveCustomTheme('t1', { color: 'blue' });
      expect(invoke).toHaveBeenCalledWith('save_custom_theme', { name: 't1', settings: { color: 'blue' } });
    });
  });

  describe('Hierarchy, Chapters, Volumes', () => {
    it('getChapterHierarchy invokes get_chapter_hierarchy', async () => {
      vi.mocked(invoke).mockResolvedValue({ volumes: [], chapters: [] });
      await api.getChapterHierarchy('proj_1');
      expect(invoke).toHaveBeenCalledWith('get_chapter_hierarchy', { project: 'proj_1' });
    });

    it('createVolume and updateVolume invoke correctly', async () => {
      vi.mocked(invoke).mockResolvedValue({ id: 'vol_1' });
      const res = await api.createVolume('proj_1', 'Volume 1');
      expect(invoke).toHaveBeenCalledWith('create_volume', { project: 'proj_1', title: 'Volume 1' });
      expect(res).toEqual({ id: 'vol_1' });

      await api.updateVolume('proj_1', 'vol_1', 'Volume 1 Updated');
      expect(invoke).toHaveBeenCalledWith('update_volume', { project: 'proj_1', id: 'vol_1', title: 'Volume 1 Updated' });
    });

    it('assignChapter invokes assign_chapter', async () => {
      await api.assignChapter('proj_1', 'ch1', 'vol1');
      expect(invoke).toHaveBeenCalledWith('assign_chapter', {
        project: 'proj_1',
        chapterId: 'ch1',
        volumeId: 'vol1',
      });
    });

    it('reorderNode invokes reorder_node', async () => {
      await api.reorderNode('proj_1', 'chapter', 'ch_1', 2);
      expect(invoke).toHaveBeenCalledWith('reorder_node', { project: 'proj_1', nodeType: 'chapter', id: 'ch_1', sortOrder: 2 });
    });

    it('healDeletedChapter invokes heal_deleted_chapter', async () => {
      await api.healDeletedChapter('proj_1', 'ch_1', null);
      expect(invoke).toHaveBeenCalledWith('heal_deleted_chapter', {
        project: 'proj_1',
        deletedChapterId: 'ch_1',
        fallbackPoint: null,
      });
    });
  });

  describe('Connections & Timeline', () => {
    it('getConnections and saveConnections invoke correctly', async () => {
      vi.mocked(invoke).mockResolvedValue([]);
      await api.getConnections('proj_1', 'ch_1');
      expect(invoke).toHaveBeenCalledWith('get_connections', { project: 'proj_1', chapter: 'ch_1' });

      await api.saveConnections('proj_1', 'src_1', { nodes: [] });
      expect(invoke).toHaveBeenCalledWith('save_connections', { project: 'proj_1', sourceId: 'src_1', data: { nodes: [] } });
    });

    it('upsertConnectionsBatch and removeConnectionsBySource invoke correctly', async () => {
      const conns: any = [{ from: '1', to: '2' }];
      await api.upsertConnectionsBatch('proj_1', 'chapter', 'src_1', conns);
      expect(invoke).toHaveBeenCalledWith('upsert_connections_batch', { project: 'proj_1', sourceType: 'chapter', sourceId: 'src_1', connections: conns });

      vi.mocked(invoke).mockResolvedValue(3);
      const count = await api.removeConnectionsBySource('proj_1', 'chapter', 'src_1');
      expect(invoke).toHaveBeenCalledWith('remove_connections_by_source', { project: 'proj_1', eType: 'chapter', eId: 'src_1' });
      expect(count).toBe(3);
    });

    it('getGlobalTimeline and exportChapters invoke correctly', async () => {
      vi.mocked(invoke).mockResolvedValue({ events: [] });
      const timeline = await api.getGlobalTimeline('proj_1');
      expect(invoke).toHaveBeenCalledWith('get_global_timeline', { project: 'proj_1' });
      expect(timeline).toEqual({ events: [] });

      vi.mocked(invoke).mockResolvedValue('export_output.epub');
      const exported = await api.exportChapters('proj_1', [{ id: 'ch_1' }], 'epub');
      expect(invoke).toHaveBeenCalledWith('export_chapters', { project: 'proj_1', chapters: [{ id: 'ch_1' }], format: 'epub' });
      expect(exported).toBe('export_output.epub');
    });
  });

  describe('Cloud & Backup Sync', () => {
    it('createCloudBackup invokes create_cloud_backup', async () => {
      vi.mocked(invoke).mockResolvedValue('backup.zip');
      const res = await api.createCloudBackup();
      expect(invoke).toHaveBeenCalledWith('create_cloud_backup');
      expect(res).toBe('backup.zip');
    });

    it('exchangeYandexToken invokes exchange_yandex_token', async () => {
      vi.mocked(invoke).mockResolvedValue('token_123');
      const res = await api.exchangeYandexToken('code_abc');
      expect(invoke).toHaveBeenCalledWith('exchange_yandex_token', { code: 'code_abc' });
      expect(res).toBe('token_123');
    });

    it('uploadToYandexDisk invokes upload_to_yandex_disk', async () => {
      await api.uploadToYandexDisk('tok', '/path/backup.zip');
      expect(invoke).toHaveBeenCalledWith('upload_to_yandex_disk', { token: 'tok', filePath: '/path/backup.zip' });
    });

    it('listYandexDiskBackups invokes list_yandex_disk_backups', async () => {
      vi.mocked(invoke).mockResolvedValue(['b1', 'b2']);
      const res = await api.listYandexDiskBackups('tok');
      expect(invoke).toHaveBeenCalledWith('list_yandex_disk_backups', { token: 'tok' });
      expect(res).toEqual(['b1', 'b2']);
    });

    it('downloadAndRestoreYandex invokes download_and_restore_yandex', async () => {
      await api.downloadAndRestoreYandex('tok', 'backup.zip');
      expect(invoke).toHaveBeenCalledWith('download_and_restore_yandex', { token: 'tok', fileName: 'backup.zip' });
    });

    it('getLaunchArgs and restoreFromBackup invoke correctly', async () => {
      vi.mocked(invoke).mockResolvedValue('arg_path');
      const args = await api.getLaunchArgs();
      expect(invoke).toHaveBeenCalledWith('get_launch_args');
      expect(args).toBe('arg_path');

      await api.restoreFromBackup('/backup.zip');
      expect(invoke).toHaveBeenCalledWith('restore_from_backup', { backupPath: '/backup.zip' });
    });
  });

  describe('Revisions, Cal Conversion, TextBlocks', () => {
    it('getChapterRevisions and getEntityRevisions invoke correctly', async () => {
      vi.mocked(invoke).mockResolvedValue(['rev1']);
      const chRev = await api.getChapterRevisions('proj_1', 'ch_1');
      expect(invoke).toHaveBeenCalledWith('get_chapter_revisions', { project: 'proj_1', chapterId: 'ch_1' });
      expect(chRev).toEqual(['rev1']);

      const entRev = await api.getEntityRevisions('proj_1', 'e_1');
      expect(invoke).toHaveBeenCalledWith('get_entity_revisions', { project: 'proj_1', entityId: 'e_1' });
      expect(entRev).toEqual(['rev1']);
    });

    it('convertAbsoluteToLocal and saveTextBlocks invoke correctly', async () => {
      vi.mocked(invoke).mockResolvedValue({ day: 1, month: 1 });
      const local = await api.convertAbsoluteToLocal(1440, {}, 0);
      expect(invoke).toHaveBeenCalledWith('convert_absolute_to_local', { absoluteMinute: 1440, calendar: {}, eraIndex: 0 });
      expect(local).toEqual({ day: 1, month: 1 });

      await api.saveTextBlocks('proj_1', 'ch_1', '<p>Test</p>');
      expect(invoke).toHaveBeenCalledWith('save_text_blocks', { project: 'proj_1', chapterId: 'ch_1', html: '<p>Test</p>' });
    });
  });

  describe('Entities CRUD Operations', () => {
    it('Chapters CRUD', async () => {
      const ch: any = { id: 'ch1', title: 'Chapter 1' };
      vi.mocked(invoke).mockResolvedValueOnce([ch]).mockResolvedValueOnce(ch).mockResolvedValueOnce(ch);

      expect(await api.getChapters('proj_1')).toEqual([ch]);
      expect(invoke).toHaveBeenCalledWith('get_chapters', { project: 'proj_1' });

      expect(await api.getChapter('ch1')).toEqual(ch);
      expect(invoke).toHaveBeenCalledWith('get_chapter', { id: 'ch1' });

      expect(await api.saveChapter(ch)).toEqual(ch);
      expect(invoke).toHaveBeenCalledWith('save_chapter', { chapter: ch });

      await api.deleteChapter('ch1');
      expect(invoke).toHaveBeenCalledWith('delete_chapter', { id: 'ch1' });
    });

    it('Volumes CRUD', async () => {
      const vol: any = { id: 'vol1' };
      vi.mocked(invoke).mockResolvedValueOnce([vol]).mockResolvedValueOnce(vol).mockResolvedValueOnce(vol);

      expect(await api.getVolumes('proj_1')).toEqual([vol]);
      expect(invoke).toHaveBeenCalledWith('get_volumes', { project: 'proj_1' });

      expect(await api.getVolume('vol1')).toEqual(vol);
      expect(invoke).toHaveBeenCalledWith('get_volume', { id: 'vol1' });

      expect(await api.saveVolume('proj_1', vol)).toEqual(vol);
      expect(invoke).toHaveBeenCalledWith('save_volume', { project: 'proj_1', data: vol });

      await api.deleteVolume('vol1');
      expect(invoke).toHaveBeenCalledWith('delete_volume', { id: 'vol1' });
    });


    it('Todos CRUD', async () => {
      const todo: any = { id: 'p1' };
      vi.mocked(invoke).mockResolvedValueOnce([todo]).mockResolvedValueOnce(todo).mockResolvedValueOnce(todo);

      expect(await api.getTodos('proj_1')).toEqual([todo]);
      expect(invoke).toHaveBeenCalledWith('get_todos', { ownerId: 'proj_1' });

      expect(await api.getTodo('p1')).toEqual(todo);
      expect(invoke).toHaveBeenCalledWith('get_todo', { id: 'p1' });

      expect(await api.saveTodo('proj_1', todo)).toEqual(todo);
      expect(invoke).toHaveBeenCalledWith('save_todo', { project: 'proj_1', data: todo });

      await api.deleteTodo('p1');
      expect(invoke).toHaveBeenCalledWith('delete_todo', { id: 'p1' });
    });

    it('DictionaryWords CRUD', async () => {
      const word: any = { id: 't1' };
      vi.mocked(invoke).mockResolvedValueOnce([word]).mockResolvedValueOnce(word).mockResolvedValueOnce(word);

      expect(await api.getDictionaryWords('proj_1')).toEqual([word]);
      expect(invoke).toHaveBeenCalledWith('get_dictionary_words', { project: 'proj_1' });

      expect(await api.getDictionaryWord('t1')).toEqual(word);
      expect(invoke).toHaveBeenCalledWith('get_dictionary_word', { id: 't1' });

      expect(await api.saveDictionaryWord('proj_1', word)).toEqual(word);
      expect(invoke).toHaveBeenCalledWith('save_dictionary_word', { project: 'proj_1', data: word });

      await api.deleteDictionaryWord('t1');
      expect(invoke).toHaveBeenCalledWith('delete_dictionary_word', { id: 't1' });
    });

    it('Calendars CRUD', async () => {
      const cal: any = { id: 'c1' };
      vi.mocked(invoke).mockResolvedValueOnce([cal]).mockResolvedValueOnce(cal).mockResolvedValueOnce(cal);

      expect(await api.getCalendars('proj_1')).toEqual([cal]);
      expect(invoke).toHaveBeenCalledWith('get_calendars', { project: 'proj_1' });

      expect(await api.getCalendar('c1')).toEqual(cal);
      expect(invoke).toHaveBeenCalledWith('get_calendar', { id: 'c1' });

      expect(await api.saveCalendar('proj_1', cal)).toEqual(cal);
      expect(invoke).toHaveBeenCalledWith('save_calendar', { project: 'proj_1', data: cal });

      await api.deleteCalendar('c1');
      expect(invoke).toHaveBeenCalledWith('delete_calendar', { id: 'c1' });
    });

    it('TextBlocks CRUD and Search', async () => {
      const tb: any = { id: 'tb1' };
      vi.mocked(invoke)
        .mockResolvedValueOnce([tb])
        .mockResolvedValueOnce(tb)
        .mockResolvedValueOnce(tb)
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce([{ entity: tb, score: 1, kind: 'tb' }]);

      expect(await api.getTextBlocks('proj_1')).toEqual([tb]);
      expect(invoke).toHaveBeenCalledWith('get_text_blocks', { project: 'proj_1' });

      expect(await api.getTextBlock('tb1')).toEqual(tb);
      expect(invoke).toHaveBeenCalledWith('get_text_block', { id: 'tb1' });

      expect(await api.saveTextBlock('proj_1', tb)).toEqual(tb);
      expect(invoke).toHaveBeenCalledWith('save_text_block', { project: 'proj_1', data: tb });

      await api.deleteTextBlock('tb1');
      expect(invoke).toHaveBeenCalledWith('delete_text_block', { id: 'tb1' });

      const searchRes = await api.searchTextBlocks('proj_1', 'findme');
      expect(invoke).toHaveBeenCalledWith('search_text_blocks', { project: 'proj_1', query: 'findme' });
      expect(searchRes).toHaveLength(1);
    });

    it('ChatMessages CRUD and Search', async () => {
      const msg: any = { id: 'm1' };
      vi.mocked(invoke)
        .mockResolvedValueOnce([msg])
        .mockResolvedValueOnce(msg)
        .mockResolvedValueOnce(msg)
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce([{ entity: msg, score: 1, kind: 'msg' }]);

      expect(await api.getChatMessages('c_1')).toEqual([msg]);
      expect(invoke).toHaveBeenCalledWith('get_chat_messages', { chatId: 'c_1' });

      expect(await api.getChatMessage('m1')).toEqual(msg);
      expect(invoke).toHaveBeenCalledWith('get_chat_message', { id: 'm1' });

      expect(await api.saveChatMessage('proj_1', msg)).toEqual(msg);
      expect(invoke).toHaveBeenCalledWith('save_chat_message', { project: 'proj_1', data: msg });

      await api.deleteChatMessage('m1');
      expect(invoke).toHaveBeenCalledWith('delete_chat_message', { msgId: 'm1' });

      const searchRes = await api.searchChatMessages('proj_1', 'query');
      expect(invoke).toHaveBeenCalledWith('search_chat_messages', { project: 'proj_1', query: 'query' });
      expect(searchRes).toHaveLength(1);
    });

    it('AgentMemory CRUD and Search', async () => {
      const mem: any = { id: 'mem1' };
      vi.mocked(invoke)
        .mockResolvedValueOnce([mem])
        .mockResolvedValueOnce(mem)
        .mockResolvedValueOnce(mem)
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce([{ entity: mem, score: 1, kind: 'mem' }]);

      expect(await api.getAgentMemorys('proj_1')).toEqual([mem]);
      expect(invoke).toHaveBeenCalledWith('get_agent_memorys', { project: 'proj_1' });

      expect(await api.getAgentMemory('mem1')).toEqual(mem);
      expect(invoke).toHaveBeenCalledWith('get_agent_memory', { id: 'mem1' });

      expect(await api.saveAgentMemory('proj_1', mem)).toEqual(mem);
      expect(invoke).toHaveBeenCalledWith('save_agent_memory', { project: 'proj_1', data: mem });

      await api.deleteAgentMemory('mem1');
      expect(invoke).toHaveBeenCalledWith('delete_agent_memory', { id: 'mem1' });

      const searchRes = await api.searchAgentMemorys('proj_1', 'query');
      expect(invoke).toHaveBeenCalledWith('search_agent_memorys', { project: 'proj_1', query: 'query' });
      expect(searchRes).toHaveLength(1);
    });

    it('WebCaches CRUD and Search', async () => {
      const cache: any = { id: 'c1' };
      vi.mocked(invoke)
        .mockResolvedValueOnce([cache])
        .mockResolvedValueOnce(cache)
        .mockResolvedValueOnce(cache)
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce([{ entity: cache, score: 1, kind: 'cache' }]);

      expect(await api.getWebCaches('proj_1')).toEqual([cache]);
      expect(invoke).toHaveBeenCalledWith('get_web_caches', { project: 'proj_1' });

      expect(await api.getWebCache('c1')).toEqual(cache);
      expect(invoke).toHaveBeenCalledWith('get_web_cache', { id: 'c1' });

      expect(await api.saveWebCache('proj_1', cache)).toEqual(cache);
      expect(invoke).toHaveBeenCalledWith('save_web_cache', { project: 'proj_1', data: cache });

      await api.deleteWebCache('c1');
      expect(invoke).toHaveBeenCalledWith('delete_web_cache', { id: 'c1' });

      const searchRes = await api.searchWebCaches('proj_1', 'query');
      expect(invoke).toHaveBeenCalledWith('search_web_caches', { project: 'proj_1', query: 'query' });
      expect(searchRes).toHaveLength(1);
    });

    it('Cites CRUD', async () => {
      const cite: any = { id: 'cite1' };
      vi.mocked(invoke).mockResolvedValueOnce([cite]).mockResolvedValueOnce(cite);

      expect(await api.getCites('f1', 't1')).toEqual([cite]);
      expect(invoke).toHaveBeenCalledWith('get_cites', { fromId: 'f1', toId: 't1' });

      expect(await api.createCite('f1', 't1', cite)).toEqual(cite);
      expect(invoke).toHaveBeenCalledWith('create_cite', { fromId: 'f1', toId: 't1', data: cite });

      await api.deleteCite('cite1');
      expect(invoke).toHaveBeenCalledWith('delete_cite', { id: 'cite1' });
    });

    it('Plot Promises CRUD', async () => {
      const promise: any = { id: 'prom1', quote: 'Test' };
      vi.mocked(invoke).mockResolvedValueOnce([promise]).mockResolvedValueOnce(promise).mockResolvedValueOnce(promise);

      expect(await api.getPlotPromises('proj_1')).toEqual([promise]);
      expect(invoke).toHaveBeenCalledWith('get_plot_promises', { project: 'proj_1' });

      expect(await api.getPlotPromise('prom1')).toEqual(promise);
      expect(invoke).toHaveBeenCalledWith('get_plot_promise', { id: 'prom1' });

      expect(await api.savePlotPromise('proj_1', promise)).toEqual(promise);
      expect(invoke).toHaveBeenCalledWith('save_plot_promise', { project: 'proj_1', data: promise });

      await api.deletePlotPromise('prom1');
      expect(invoke).toHaveBeenCalledWith('delete_plot_promise', { id: 'prom1' });
    });
  });
});
