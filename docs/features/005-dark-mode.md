# Feature: Dark Mode

**Priority**: Medium
**Effort**: Medium (6-8 hours)
**Impact**: Comfort in dimly-lit gyms, modern UX expectation, battery saving on OLED

## Problem

The app has a white-only theme. Many users work out early morning or in dimly-lit gyms where a bright white screen is harsh. Dark mode is a baseline expectation for mobile apps in 2026.

## Solution

System-aware dark mode that follows the device preference, with a manual toggle in Settings for override.

## User Experience

1. On first use, app follows system preference (dark/light)
2. User can override in Settings: System / Light / Dark
3. Theme switch is instant, no page reload
4. All pages and components adapt

## Technical Design

### CSS Custom Properties (already in use)

The app already uses CSS custom properties for colors. Dark mode is a matter of redefining these variables under a `[data-theme="dark"]` or `prefers-color-scheme` media query.

### Color Tokens

```css
/* Light theme (existing, becomes explicit) */
:root, [data-theme="light"] {
  --color-bg: #ffffff;
  --color-bg-secondary: #f5f5f5;
  --color-bg-card: #ffffff;
  --color-text: #1a1a1a;
  --color-text-secondary: #666666;
  --color-border: #e0e0e0;
  --color-primary: #4169e1;
  --color-success: #22c55e;
  --color-danger: #ef4444;
  --color-set-completed: #f0fdf4;
}

/* Dark theme */
[data-theme="dark"] {
  --color-bg: #121212;
  --color-bg-secondary: #1e1e1e;
  --color-bg-card: #1e1e1e;
  --color-text: #e0e0e0;
  --color-text-secondary: #a0a0a0;
  --color-border: #333333;
  --color-primary: #5b8af5;
  --color-success: #34d369;
  --color-danger: #ff6b6b;
  --color-set-completed: #1a2e1a;
}

/* System preference (default) */
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    /* same as dark theme vars */
  }
}
```

### Theme Management

```typescript
// useTheme.ts hook
type ThemePreference = 'system' | 'light' | 'dark';

function useTheme(): {
  theme: 'light' | 'dark';       // resolved actual theme
  preference: ThemePreference;    // user's setting
  setPreference: (pref: ThemePreference) => void;
}
```

- Store preference in `localStorage` key `theme`
- Apply `data-theme` attribute on `<html>` element
- Listen to `matchMedia('(prefers-color-scheme: dark)')` for system changes

### Settings UI

```
Appearance
  ○ System (default)
  ○ Light
  ○ Dark
```

### What Needs Updating

Audit all CSS files to ensure they use custom properties for:
- Background colors (page, cards, modals)
- Text colors (primary, secondary, muted)
- Border colors
- Input field backgrounds and text
- Button variants
- Calendar day backgrounds
- Set row backgrounds (completed/uncompleted)

## Edge Cases

- PWA meta theme-color should update with theme
- Modals/overlays need appropriate backdrop colors
- Charts (if implemented) need dark-mode-aware color schemes
- Images/icons that don't adapt: use `filter: invert()` or provide dark variants

## Testing

- E2E: Toggle dark mode in settings, verify background changes
- E2E: System preference respected on first load
- E2E: Theme persists across page reload
- Visual regression: screenshot tests for both themes
