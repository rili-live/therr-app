import React from 'react';
import { StyleSheet, View } from 'react-native';
import MaterialIcon from 'react-native-vector-icons/MaterialIcons';
import { ITherrThemeColors } from '../../styles/themes';

/**
 * The hero art at the top of a celebration screen.
 *
 * Deliberately built from the app's own icon set and theme colours rather than an illustration
 * or a mascot: it has to work for every brand variation that ever renders these screens, and a
 * third-party mascot is both a licensing problem and the wrong identity. The "sunburst" on a
 * milestone is a ring of plain Views — no new dependency, and it scales with the hero size.
 */

export const MEDAL_TIER_COLORS: Record<number, string> = {
    1: '#D6AF36',
    2: '#A7A7AD',
    3: '#A77044',
};

const SUNBURST_RAY_COUNT = 12;

interface ISunburstProps {
    size: number;
    color: string;
}

const Sunburst: React.FC<ISunburstProps> = ({ size, color }) => (
    <View style={[styles.sunburst, { width: size, height: size }]} pointerEvents="none">
        {Array.from({ length: SUNBURST_RAY_COUNT }, (_, index) => (
            <View
                key={`ray-${index}`}
                style={[
                    styles.ray,
                    {
                        height: size,
                        backgroundColor: color,
                        transform: [{ rotate: `${(180 / SUNBURST_RAY_COUNT) * index}deg` }],
                    },
                ]}
            />
        ))}
    </View>
);

interface IStreakHeroProps {
    size?: number;
    /** Milestone days get the sunburst behind the flame. */
    burst?: boolean;
    colors: ITherrThemeColors;
}

export const StreakHero: React.FC<IStreakHeroProps> = ({ size = 160, burst = false, colors }) => (
    <View style={[styles.heroContainer, { width: size, height: size }]}>
        {burst ? <Sunburst size={size} color={colors.brandFaded} /> : null}
        <View
            style={[
                styles.heroDisc,
                {
                    width: size * 0.72,
                    height: size * 0.72,
                    borderRadius: (size * 0.72) / 2,
                    backgroundColor: colors.brandFaded,
                },
            ]}
        >
            <MaterialIcon
                name="local-fire-department"
                size={size * 0.44}
                color={colors.brandingOrange}
            />
        </View>
    </View>
);

interface IPlacementHeroProps {
    size?: number;
    /** 1, 2 or 3 — anything else falls back to bronze rather than rendering nothing. */
    tier: number;
    colors: ITherrThemeColors;
}

export const PlacementHero: React.FC<IPlacementHeroProps> = ({ size = 180, tier, colors }) => {
    const tierColor = MEDAL_TIER_COLORS[tier] || MEDAL_TIER_COLORS[3];

    return (
        <View style={[styles.heroContainer, { width: size, height: size }]}>
            <Sunburst size={size} color={colors.brandFaded} />
            <View
                style={[
                    styles.heroDisc,
                    {
                        width: size * 0.72,
                        height: size * 0.72,
                        borderRadius: (size * 0.72) / 2,
                        backgroundColor: colors.backgroundNeutral,
                        borderWidth: 3,
                        borderColor: tierColor,
                    },
                ]}
            >
                <MaterialIcon name="emoji-events" size={size * 0.44} color={tierColor} />
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    heroContainer: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    sunburst: {
        position: 'absolute',
        alignItems: 'center',
        justifyContent: 'center',
    },
    ray: {
        position: 'absolute',
        width: 4,
        borderRadius: 2,
        opacity: 0.5,
    },
    heroDisc: {
        alignItems: 'center',
        justifyContent: 'center',
    },
});
