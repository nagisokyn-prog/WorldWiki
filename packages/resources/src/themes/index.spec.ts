import { describe, it, expect } from 'vitest';
import { BUILTIN_THEMES, darkTheme, lightTheme } from './index';

describe('themes/index', () => {
  it('exports darkTheme, lightTheme, and BUILTIN_THEMES', () => {
    expect(darkTheme).toBeDefined();
    expect(lightTheme).toBeDefined();
    expect(BUILTIN_THEMES).toEqual({
      dark: darkTheme,
      light: lightTheme
    });
  });
});

