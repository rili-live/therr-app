import React, { useMemo } from 'react';
import { PixelRatio, StyleProp, ViewStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { buildSpritePaths, SPRITE_SIZE } from './sprites';

/**
 * The size of one sprite pixel, in dp, for a requested sprite edge length: rounded down so a
 * sprite pixel covers a whole number of device pixels. react-native-svg has no
 * `shapeRendering="crispEdges"`, so this snapping is what keeps the art sharp and free of
 * anti-aliased seams between neighbouring pixels.
 */
export const getSnappedPixelSize = (size: number): number => {
    const deviceScale = PixelRatio.get() || 1;
    const devicePixelsPerSpritePixel = Math.max(1, Math.floor((size * deviceScale) / SPRITE_SIZE));
    return devicePixelsPerSpritePixel / deviceScale;
};

interface ISpriteLayerProps {
    rows: ReadonlyArray<string>;
    palette: { [key: string]: string };
    /** Rendered edge length in dp — pass `getSnappedPixelSize(size) * SPRITE_SIZE`. */
    renderSize: number;
    style?: StyleProp<ViewStyle>;
}

/** One sprite grid drawn as an SVG, one merged path per color. */
const SpriteLayer = ({ rows, palette, renderSize, style }: ISpriteLayerProps) => {
    const paths = useMemo(() => buildSpritePaths(rows, palette), [rows, palette]);

    return (
        <Svg
            width={renderSize}
            height={renderSize}
            viewBox={`0 0 ${SPRITE_SIZE} ${SPRITE_SIZE}`}
            style={style}
        >
            {paths.map(({ color, d }) => <Path key={color} d={d} fill={color} />)}
        </Svg>
    );
};

export default SpriteLayer;
