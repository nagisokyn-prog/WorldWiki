import { describe, it, expect, vi, beforeEach } from 'vitest';
import { entityApi } from '../entity.api';
import * as components from '@worldwiki/components';

vi.mock('@worldwiki/components', () => {
    return {
        invoke: vi.fn(),
        processIds: vi.fn((item) => item),
    };
});

describe('Entity API - Data extraction and saving', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('getEntity', () => {
        it('should properly extract attributes to the root level while preserving system fields', async () => {
            // Mock backend response for get_entity
            const mockBackendResponse = {
                id: 'char_123',
                project_id: 'proj_1',
                entity_type: 'character',
                name: 'Test Character',
                description: 'A test character',
                tags: ['test'],
                attributes: {
                    age: 25,
                    bio: 'Very interesting bio',
                    stats: { str: 10, dex: 15 }
                }
            };
            
            vi.mocked(components.invoke).mockResolvedValueOnce(mockBackendResponse);

            const result = await entityApi.getEntity('proj_1', 'character', 'char_123');

            expect(components.invoke).toHaveBeenCalledWith('get_entity', { id: 'char_123' });
            
            // Should contain system fields
            expect(result.id).toBe('char_123');
            expect(result.project_id).toBe('proj_1');
            expect(result.entity_type).toBe('character');
            expect(result.name).toBe('Test Character');
            expect(result.description).toBe('A test character');
            
            // Should extract attributes to root
            expect(result.age).toBe(25);
            expect(result.bio).toBe('Very interesting bio');
            expect((result.stats as any).str).toBe(10);
            
            // Should NOT have the nested attributes or data objects
            expect(result.attributes).toBeUndefined();
            expect(result.data).toBeUndefined();
        });

        it('should handle entities without attributes safely', async () => {
            const mockBackendResponse = {
                id: 'char_456',
                entity_type: 'location',
                name: 'Empty Location'
                // no attributes
            };
            vi.mocked(components.invoke).mockResolvedValueOnce(mockBackendResponse);

            const result = await entityApi.getEntity('proj_1', 'location', 'char_456');

            expect(result.id).toBe('char_456');
            expect(result.name).toBe('Empty Location');
            expect(result.attributes).toBeUndefined();
        });
        
        it('should return null if backend returns null', async () => {
            vi.mocked(components.invoke).mockResolvedValueOnce(null);
            const result = await entityApi.getEntity('proj_1', 'character', 'not_found');
            expect(result).toBeNull();
        });
    });

    describe('getEntityList', () => {
        it('should extract attributes to root for each item in the list', async () => {
            const mockBackendList = [
                { id: 'item1', name: 'Item 1', attributes: { color: 'red' } },
                { id: 'item2', name: 'Item 2', attributes: { color: 'blue' } },
                { id: 'item3', name: 'Item 3' } // No attributes
            ];
            vi.mocked(components.invoke).mockResolvedValueOnce(mockBackendList);

            const result = await entityApi.getEntityList('proj_1', 'item');

            expect(result).toHaveLength(3);
            expect(result[0].name).toBe('Item 1');
            expect(result[0].color).toBe('red');
            expect(result[0].attributes).toBeUndefined();

            expect(result[1].name).toBe('Item 2');
            expect(result[1].color).toBe('blue');

            expect(result[2].name).toBe('Item 3');
            expect(result[2].color).toBeUndefined();
        });
    });

    describe('formatEntityPayload and saveEntity', () => {
        it('should correctly format payload separating system fields and attributes', async () => {
            // Frontend passes flat data to saveEntity
            const flatDataFromUI = {
                name: 'New Character',
                description: 'Description here',
                tags: ['hero'],
                age: 30,
                bio: 'Bio text',
                custom_field: true
            };

            const mockSaveResult = { id: 'new_123', entity_type: 'character', name: 'New Character', attributes: { age: 30, bio: 'Bio text', custom_field: true } };
            vi.mocked(components.invoke).mockResolvedValueOnce(mockSaveResult);

            const result = await entityApi.saveEntity('proj_1', 'character', flatDataFromUI, undefined, 'New Character');

            // Verify what was sent to Rust backend
            expect(components.invoke).toHaveBeenCalledWith('save_entity', {
                project: 'proj_1',
                entity: expect.objectContaining({
                    project_id: 'proj_1',
                    entity_type: 'character',
                    name: 'New Character',
                    description: 'Description here',
                    tags: ['hero'],
                    attributes: expect.objectContaining({
                        age: 30,
                        bio: 'Bio text',
                        custom_field: true
                    })
                })
            });

            // The attributes should NOT contain the system fields
            const callArgs = vi.mocked(components.invoke).mock.calls[0][1] as any;
            expect(callArgs.entity.attributes.name).toBeUndefined();
            expect(callArgs.entity.attributes.description).toBeUndefined();
            expect(callArgs.entity.attributes.tags).toBeUndefined();
            
            // Should return whatever Rust returns (as per actual current implementation)
            expect(result).toEqual(mockSaveResult);
        });
    });
});
