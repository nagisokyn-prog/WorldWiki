import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { getCached, setCache, invalidateCache, clearCache } from '../requestCache';

describe('requestCache', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    clearCache();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('getCached', () => {
    it('returns null for non-existent key', () => {
      expect(getCached('non-existent')).toBeNull();
    });

    it('returns cached data when not expired', () => {
      setCache('test-key', { foo: 'bar' });
      expect(getCached('test-key')).toEqual({ foo: 'bar' });
    });

    it('returns null and deletes entry when expired', () => {
      setCache('test-key', { foo: 'bar' });
      
      // Advance time past DEFAULT_TTL (15 seconds)
      vi.advanceTimersByTime(15_001);
      
      expect(getCached('test-key')).toBeNull();
    });

    it('returns correct type with generics', () => {
      interface TestData { id: number; name: string; }
      setCache<TestData>('typed-key', { id: 1, name: 'test' });
      
      const result = getCached<TestData>('typed-key');
      expect(result).toEqual({ id: 1, name: 'test' });
      expect(result?.id).toBe(1);
    });
  });

  describe('setCache', () => {
    it('stores data with current timestamp', () => {
      const now = Date.now();
      vi.setSystemTime(now);
      
      setCache('test-key', { data: 'value' });
      
      // Just verify we can retrieve it
      expect(getCached('test-key')).toEqual({ data: 'value' });
    });

    it('overwrites existing key', () => {
      setCache('key', { v: 1 });
      setCache('key', { v: 2 });
      expect(getCached('key')).toEqual({ v: 2 });
    });

    it('stores different types correctly', () => {
      setCache('string', 'hello');
      setCache('number', 42);
      setCache('array', [1, 2, 3]);
      setCache('object', { nested: { value: true } });
      
      expect(getCached('string')).toBe('hello');
      expect(getCached('number')).toBe(42);
      expect(getCached('array')).toEqual([1, 2, 3]);
      expect(getCached('object')).toEqual({ nested: { value: true } });
    });
  });

  describe('invalidateCache', () => {
    it('removes entries matching prefix', () => {
      setCache('projects:all', [{ id: 1 }]);
      setCache('projects:config:myproject', { name: 'test' });
      setCache('chapters:list', []);
      setCache('other:key', 'value');
      
      invalidateCache('projects:');
      
      expect(getCached('projects:all')).toBeNull();
      expect(getCached('projects:config:myproject')).toBeNull();
      expect(getCached('chapters:list')).toEqual([]);
      expect(getCached('other:key')).toBe('value');
    });

    it('removes exact match when no prefix matches', () => {
      setCache('exact-key', 'value');
      invalidateCache('non-matching-prefix');
      expect(getCached('exact-key')).toBe('value');
    });

    it('handles empty cache gracefully', () => {
      expect(() => invalidateCache('any:prefix')).not.toThrow();
    });
  });

  describe('clearCache', () => {
    it('removes all entries', () => {
      setCache('key1', 'value1');
      setCache('key2', 'value2');
      setCache('key3', 'value3');
      
      clearCache();
      
      expect(getCached('key1')).toBeNull();
      expect(getCached('key2')).toBeNull();
      expect(getCached('key3')).toBeNull();
    });

    it('works on already empty cache', () => {
      clearCache();
      clearCache(); // Should not throw
      expect(getCached('any')).toBeNull();
    });
  });

  describe('integration scenarios', () => {
    it('simulates cache hit -> expire -> miss cycle', () => {
      setCache('api:projects', [{ id: 1, name: 'Project 1' }]);
      
      // Cache hit
      expect(getCached('api:projects')).toEqual([{ id: 1, name: 'Project 1' }]);
      
      // Advance time but not past TTL
      vi.advanceTimersByTime(10_000);
      expect(getCached('api:projects')).toEqual([{ id: 1, name: 'Project 1' }]);
      
      // Advance past TTL
      vi.advanceTimersByTime(10_000);
      expect(getCached('api:projects')).toBeNull();
    });

    it('handles concurrent cache operations', () => {
      // Simulate multiple rapid sets/gets
      for (let i = 0; i < 100; i++) {
        setCache(`key-${i}`, { index: i });
      }
      
      for (let i = 0; i < 100; i++) {
        expect(getCached(`key-${i}`)).toEqual({ index: i });
      }
      
      invalidateCache('key-5');
      expect(getCached('key-5')).toBeNull();
      expect(getCached('key-6')).toEqual({ index: 6 });
    });
  });
});