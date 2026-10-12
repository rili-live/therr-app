import React from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
    SharedValue,
    useAnimatedProps,
    useAnimatedStyle,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import {
    GEM_FACET_OPACITY,
    GEM_FACET_PATH,
    GEM_PATH,
    GEM_SCALE,
    GEM_SIZE,
    GEM_STROKE,
} from './geometry';
import { gemAt, IGemFlight } from './rig';

const AnimatedPath = Animated.createAnimatedComponent(Path);
const GEM_VIEW_BOX = `${-GEM_SIZE / 2} ${-GEM_SIZE / 2} ${GEM_SIZE} ${GEM_SIZE}`;
const GEM_BOX = GEM_SIZE * GEM_SCALE;
/** How much of the twinkle sweep one gem lights for. */
const TWINKLE_WIDTH = 0.25;

interface IGemProps {
    flight: IGemFlight;
    color: string;
    highlight: string;
    /** Seconds since the burst: every gem reads its place off this one clock. */
    clock: SharedValue<number>;
    /** Fades the whole set in on the reduced-motion path. */
    opacity: SharedValue<number>;
    /** 0..1, a sweep of light across the settled pile (epic and jackpot). */
    twinkle: SharedValue<number>;
    /** Where this gem sits in the twinkle sweep, 0..1. */
    twinkleAt: number;
}

const Gem = ({
    flight, color, highlight, clock, opacity, twinkle, twinkleAt,
}: IGemProps) => {
    const style = useAnimatedStyle(() => {
        const at = gemAt(flight, clock.value);
        return {
            opacity: at.launched ? opacity.value : 0,
            transform: [{ translateX: at.x }, { translateY: at.y }, { rotate: `${at.rotate}deg` }],
        };
    });
    const facetProps = useAnimatedProps(() => {
        const lit = Math.max(0, 1 - Math.abs(twinkle.value - twinkleAt) / TWINKLE_WIDTH);
        return { opacity: GEM_FACET_OPACITY + (1 - GEM_FACET_OPACITY) * lit };
    });

    return (
        <Animated.View
            style={[styles.gem, style]}
            pointerEvents="none"
        >
            <Svg width={GEM_BOX} height={GEM_BOX} viewBox={GEM_VIEW_BOX}>
                <Path d={GEM_PATH} fill={color} stroke={color} strokeWidth={GEM_STROKE} strokeLinejoin="round" />
                <AnimatedPath animatedProps={facetProps} d={GEM_FACET_PATH} fill={highlight} />
            </Svg>
        </Animated.View>
    );
};

interface IGemsProps {
    flights: IGemFlight[];
    colors: string[];
    highlight: string;
    clock: SharedValue<number>;
    opacity: SharedValue<number>;
    twinkle: SharedValue<number>;
}

/** The bonus, as gems: out of the rock, up, and down into a pile. */
const Gems = ({
    flights, colors, highlight, clock, opacity, twinkle,
}: IGemsProps) => {
    // The twinkle sweeps left to right across the pile.
    const xs = flights.map(({ slot }) => slot.x);
    const left = Math.min(...xs);
    const span = Math.max(...xs) - left || 1;

    return (
        <>
            {flights.map((flight, index) => (
                <Gem
                // A fixed set per bonus; the index is the identity.
                    key={`gem-${index}`}
                    flight={flight}
                    color={colors[index % colors.length]}
                    highlight={highlight}
                    clock={clock}
                    opacity={opacity}
                    twinkle={twinkle}
                    twinkleAt={(flight.slot.x - left) / span}
                />
            ))}
        </>
    );
};

const styles = StyleSheet.create({
    // Centred on the scene's origin; each gem's transform moves it to its place.
    gem: {
        position: 'absolute',
        left: -GEM_BOX / 2,
        top: -GEM_BOX / 2,
        width: GEM_BOX,
        height: GEM_BOX,
    },
});

export default React.memo(Gems);
