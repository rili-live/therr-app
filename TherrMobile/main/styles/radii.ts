// Mobile-tuned border-radius scale. Use these tokens in new code instead of
// the magic numbers (4, 5, 6, 7, 8, 10, 12, 14, 15, 18, 20, 50, 100) sprinkled
// across the codebase today.
//
// none — flat surfaces (e.g. full-bleed media, inline tags)
// sm   — small chips, badges, dense list items
// md   — buttons, inputs, cards (default rounded surface)
// lg   — modal containers, large cards, sheets
// xl   — feature cards, hero surfaces
// pill — fully-rounded horizontal rails (segment toggles, capsule buttons)
// circle — square avatars, FABs, dots (apply to a square element)
//
// `pill` and `circle` are intentionally large numbers (not exactly 50% / 100%)
// because StyleSheet doesn't accept percentage values for `borderRadius` cross-
// platform. A 999/9999 value is treated as "fully round" by both iOS and
// Android as long as the element's smallest dimension is < 999.
export const radius = {
    none: 0,
    sm: 4,
    md: 8,
    lg: 12,
    xl: 16,
    pill: 999,
    circle: 9999,
} as const;
