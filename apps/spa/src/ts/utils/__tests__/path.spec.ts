import { describe, it, expect } from 'vitest';
import { getValueByPath, setValueByPath } from '../path';

describe('path utils', () => {
  describe('getValueByPath', () => {
    it('returns top-level property value', () => {
      const obj = { name: 'Alice', age: 30 };
      expect(getValueByPath(obj, 'name')).toBe('Alice');
      expect(getValueByPath(obj, 'age')).toBe(30);
    });

    it('returns nested property value', () => {
      const obj = { user: { profile: { address: { city: 'Tokyo' } } } };
      expect(getValueByPath(obj, 'user.profile.address.city')).toBe('Tokyo');
    });

    it('returns undefined for non-existent path', () => {
      const obj = { user: { name: 'Bob' } };
      expect(getValueByPath(obj, 'user.age')).toBeUndefined();
      expect(getValueByPath(obj, 'user.profile.address')).toBeUndefined();
    });

    it('handles null and undefined parent gracefully', () => {
      expect(getValueByPath(null, 'user.name')).toBeUndefined();
      expect(getValueByPath(undefined, 'user.name')).toBeUndefined();
      expect(getValueByPath({ user: null }, 'user.name')).toBeUndefined();
    });

    it('handles empty path or single key', () => {
      const obj = { '': 'empty', test: 'val' };
      expect(getValueByPath(obj, '')).toBe('empty');
      expect(getValueByPath(obj, 'test')).toBe('val');
    });
  });

  describe('setValueByPath', () => {
    it('sets top-level property value', () => {
      const obj: any = {};
      setValueByPath(obj, 'name', 'Bob');
      expect(obj.name).toBe('Bob');
    });

    it('sets nested property creating missing objects', () => {
      const obj: any = {};
      setValueByPath(obj, 'user.profile.age', 25);
      expect(obj.user.profile.age).toBe(25);
    });

    it('overwrites existing primitive value when creating path', () => {
      const obj: any = { user: 'not-an-object' };
      setValueByPath(obj, 'user.name', 'Charlie');
      expect(obj.user.name).toBe('Charlie');
    });

    it('preserves existing sibling keys in nested objects', () => {
      const obj: any = { user: { name: 'Alice', role: 'admin' } };
      setValueByPath(obj, 'user.age', 30);
      expect(obj.user.name).toBe('Alice');
      expect(obj.user.role).toBe('admin');
      expect(obj.user.age).toBe(30);
    });
  });
});
