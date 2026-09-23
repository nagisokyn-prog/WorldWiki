import darkTheme from './dark.theme.json';
import lightTheme from './light.theme.json';

export { darkTheme, lightTheme };
export const BUILTIN_THEMES = {
  dark: darkTheme,
  light: lightTheme,
} as const;
