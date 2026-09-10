import React, { useMemo } from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import TherrIcon from '../TherrIcon';
import { ITherrThemeColors } from '../../styles/themes';

/**
 * Branded stand-in for content that has no media.
 *
 * Two properties matter here:
 *
 * 1. **Every color comes from the active theme**, never from a baked asset. A
 *    `niche/<TAG>-general` branch that fills in its entry in `brandColorOverrides`
 *    gets a placeholder in its own palette for free — no second image to ship,
 *    no per-brand asset to keep in sync.
 * 2. **The composition is seeded off the content id**, so a row of media-less
 *    cards reads as distinct tiles rather than a wall of identical grey boxes,
 *    while the same content always renders the same tile across sessions.
 */

interface IBrandedMediaPlaceholderProps {
    /** Stable per-content string (usually the area id) that seeds the composition. */
    seed?: string;
    /** Space/moment category, e.g. `categories.restaurant`. Picks the glyph. */
    category?: string;
    /** `spaces` | `events` | `moments`. Picks the glyph when there is no category. */
    areaType?: string;
    /** Accepts a percentage string so the placeholder can also fill a sized parent. */
    width?: number | string;
    height?: number | string;
    borderRadius?: number;
    iconSize?: number;
    theme: {
        styles: any;
        colors: ITherrThemeColors;
    };
}

/**
 * djb2. Deterministic across platforms and cheap enough to run inline while
 * rendering a list — we only need a stable spread, not cryptographic quality.
 */
const hashSeed = (seed: string): number => {
    let hash = 5381;
    for (let i = 0; i < seed.length; i += 1) {
        // eslint-disable-next-line no-bitwise
        hash = ((hash * 33) ^ seed.charCodeAt(i)) >>> 0;
    }
    return hash;
};

const CATEGORY_ICONS: { match: string[]; icon: string }[] = [
    { match: ['food', 'menu', 'restaurant', 'cafe', 'coffee', 'dining'], icon: 'utensils' },
    { match: ['drink', 'bar', 'nightlife', 'brewery', 'cocktail'], icon: 'cocktail' },
    { match: ['deals', 'discount', 'coupon'], icon: 'gift' },
    { match: ['storefront', 'artwork', 'shop', 'retail'], icon: 'storefront' },
    { match: ['idea'], icon: 'idea' },
    { match: ['music', 'concert'], icon: 'music' },
    {
        match: ['nature', 'outdoor', 'park', 'fitness', 'wellness', 'yoga', 'health', 'sport'],
        icon: 'walking',
    },
    { match: ['event'], icon: 'calendar' },
];

const AREA_TYPE_ICONS: { [key: string]: string } = {
    events: 'calendar',
    moments: 'camera',
    spaces: 'storefront',
};

/**
 * Deliberately avoids the `therr-logo` glyph. This component renders on every
 * brand variant, and the logo mark is the one piece of identity that must not
 * ride along on `general`.
 */
export const getPlaceholderIconName = (category?: string, areaType?: string): string => {
    if (category) {
        const match = CATEGORY_ICONS.find(({ match: keywords }) => keywords.some((k) => category.includes(k)));
        if (match) {
            return match.icon;
        }
    }

    return (areaType && AREA_TYPE_ICONS[areaType]) || 'map';
};

/**
 * Blob palettes, ordered so adjacent cards in a scroller rarely repeat. Each
 * entry is [primary blob, secondary blob, accent blob].
 */
const buildPalettes = (colors: ITherrThemeColors): string[][] => [
    [colors.brand, colors.accentTeal, colors.accentLime],
    [colors.accentBlue, colors.brand, colors.accentTeal],
    [colors.accent, colors.accentYellow, colors.brand],
    [colors.accentLime, colors.brand, colors.accentTeal],
    [colors.brandDark, colors.accentTeal, colors.accent],
];

const BrandedMediaPlaceholder = ({
    seed,
    category,
    areaType,
    width = '100%',
    height = '100%',
    borderRadius = 0,
    iconSize,
    theme,
}: IBrandedMediaPlaceholderProps) => {
    const composition = useMemo(() => {
        const hash = hashSeed(seed || category || areaType || 'therr');
        const palettes = buildPalettes(theme.colors);
        const palette = palettes[hash % palettes.length];

        // Spread the derived values across different bit ranges of the hash so
        // the blob positions vary independently of the palette choice.
        // eslint-disable-next-line no-bitwise
        const a = (hash >>> 3) % 100;
        // eslint-disable-next-line no-bitwise
        const b = (hash >>> 9) % 100;
        // eslint-disable-next-line no-bitwise
        const c = (hash >>> 15) % 100;

        return {
            gradientId: `bmp-${hash.toString(16)}`,
            palette,
            blobs: [
                { cx: 16 + (a * 0.24), cy: 20 + (b * 0.2), r: 30 + (a % 14), fill: palette[0], opacity: 0.55 },
                { cx: 58 + (b * 0.3), cy: 66 + (c * 0.2), r: 34 + (b % 16), fill: palette[1], opacity: 0.45 },
                { cx: 26 + (c * 0.4), cy: 82 + (a * 0.1), r: 22 + (c % 12), fill: palette[2], opacity: 0.32 },
            ],
        };
    }, [seed, category, areaType, theme.colors]);

    const iconName = getPlaceholderIconName(category, areaType);
    // A percentage size can't be measured during render, so fall back to a fixed
    // glyph size rather than laying out and re-rendering just to scale an icon.
    const resolvedIconSize = iconSize
        || (typeof width === 'number' && typeof height === 'number'
            ? Math.max(24, Math.round(Math.min(width, height) * 0.26))
            : 48);

    // RN types `width`/`height` as `DimensionValue`, which is a narrower union
    // than the `number | string` this component accepts so it can also forward
    // the same value to `Svg` (whose `NumberProp` is exactly `number | string`).
    // One cast here beats duplicating the size prop for the two consumers.
    const sizeStyle = { width, height, borderRadius } as ViewStyle;

    return (
        <View style={[localStyles.container, sizeStyle, { backgroundColor: theme.colors.surfaceAlt }]}>
            <Svg width={width} height={height} viewBox="0 0 100 100" preserveAspectRatio="none">
                <Defs>
                    <LinearGradient id={composition.gradientId} x1="0" y1="0" x2="1" y2="1">
                        <Stop offset="0" stopColor={theme.colors.surfaceAlt} />
                        <Stop offset="1" stopColor={theme.colors.surface} />
                    </LinearGradient>
                </Defs>
                <Rect x="0" y="0" width="100" height="100" fill={`url(#${composition.gradientId})`} />
                {composition.blobs.map((blob, index) => (
                    <Circle
                        key={`${composition.gradientId}-${index}`}
                        cx={blob.cx}
                        cy={blob.cy}
                        r={blob.r}
                        fill={blob.fill}
                        opacity={blob.opacity}
                    />
                ))}
            </Svg>
            <View style={[StyleSheet.absoluteFill, localStyles.iconContainer]} pointerEvents="none">
                <TherrIcon
                    name={iconName}
                    size={resolvedIconSize}
                    color={theme.colors.brandingWhite}
                    style={localStyles.icon}
                />
            </View>
        </View>
    );
};

const localStyles = StyleSheet.create({
    container: {
        overflow: 'hidden',
    },
    iconContainer: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    icon: {
        opacity: 0.9,
        textShadowColor: 'rgba(0,0,0,0.25)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 3,
    },
});

export default BrandedMediaPlaceholder;
