// Theme-agnostic brand colors. Identical across all themes.
// Use these in module-level StyleSheets or in components that render outside
// the theme tree (toasts, OfflineBanner, BaseButton's solid title color).
// Components inside the theme tree should prefer `theme.colors.branding*`.

export const BRAND_WHITE = '#fcfeff';
export const BRAND_BLACK = '#001226';
export const BRAND_BLUE_GREEN = '#1C7F8A';
export const BRAND_MAP_YELLOW = '#ebc300';
export const BRAND_ORANGE = '#DE6E07';
export const BRAND_RED = '#FF3041';
export const BRAND_LIGHT_BLUE = '#d8f0f2';

// Theme-agnostic alert colors used by surfaces that render outside the theme
// tree (e.g. toast borders, OfflineBanner). Per-theme alert colors live on
// `theme.colors.alert*` for surfaces that DO have theme access.
export const ALERT_INFO = '#1C7F8A';
export const ALERT_SUCCESS = '#00A624';
export const ALERT_WARNING = '#FDBD2E';
export const ALERT_ERROR = '#D70000';

// Translucent surfaces used by overlays that need to dim the screen behind a
// loader or banner. Theme-agnostic on purpose so the loader looks the same
// regardless of the host screen.
export const OVERLAY_LIGHT = 'rgba(255,255,255,0.75)';
export const OVERLAY_DARK = 'rgba(26, 26, 26, 0.92)';
export const OVERLAY_PANEL_LIGHT = 'rgba(255, 255, 255, 0.92)';
