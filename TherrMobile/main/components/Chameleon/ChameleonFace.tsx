import React from 'react';
import Svg, { Circle, Path } from 'react-native-svg';
import { ITherrThemeColors } from '../../styles/themes';
import {
    EYE_SOCKET_RADIUS,
    EYE_WHITE_RADIUS,
    FACE_VIEW_BOX,
    HEAD_PATH,
    HIGHLIGHT_OFFSET,
    HIGHLIGHT_RADIUS,
    LEFT_EYE,
    LEFT_PUPIL,
    NOSTRIL_OPACITY,
    NOSTRIL_RADIUS,
    NOSTRILS,
    PUPIL_RADIUS,
    RIGHT_EYE,
    RIGHT_PUPIL,
    SMILE_PATH,
    SMILE_STROKE_WIDTH,
    STRIPE_PATH,
} from './geometry';

/**
 * The chameleon's face, still. The animated version lives in
 * `components/Loaders/ChameleonLoader`; this one is for surfaces where the mascot
 * is a mark rather than a loader — achievement badges, empty states, headers.
 *
 * Every colour comes from the theme it is handed, so a brand palette change moves
 * the mascot with it and no asset has to be re-exported.
 */
export interface IChameleonFaceProps {
    /** Skin colour for the head and eye sockets. Defaults to the brand colour. */
    skin?: string;
    /**
     * A sticker outline drawn behind the head, for placing the face on a coloured
     * ground that may be close to its own skin. Omit for none.
     */
    outline?: string;
    /** Logo-unit width of that outline. */
    outlineWidth?: number;
    theme: {
        colors: ITherrThemeColors;
    };
    testID?: string;
}

const ChameleonFace = ({
    skin,
    outline,
    outlineWidth = 36,
    theme,
    testID = 'chameleon-face',
}: IChameleonFaceProps) => {
    const { colors } = theme;
    const skinColor = skin || colors.brand;

    return (
        <Svg width="100%" height="100%" viewBox={FACE_VIEW_BOX} testID={testID}>
            {outline ? (
                <>
                    <Path d={HEAD_PATH} fill={outline} stroke={outline} strokeWidth={outlineWidth} strokeLinejoin="round" />
                    <Circle cx={LEFT_EYE.cx} cy={LEFT_EYE.cy} r={EYE_SOCKET_RADIUS + outlineWidth / 2} fill={outline} />
                    <Circle cx={RIGHT_EYE.cx} cy={RIGHT_EYE.cy} r={EYE_SOCKET_RADIUS + outlineWidth / 2} fill={outline} />
                </>
            ) : null}
            <Path d={HEAD_PATH} fill={skinColor} />
            <Path d={STRIPE_PATH} fill={colors.accent} />
            <Circle cx={LEFT_EYE.cx} cy={LEFT_EYE.cy} r={EYE_SOCKET_RADIUS} fill={skinColor} />
            <Circle cx={LEFT_EYE.cx} cy={LEFT_EYE.cy} r={EYE_WHITE_RADIUS} fill={colors.brandingWhite} />
            <Circle cx={LEFT_PUPIL.cx} cy={LEFT_PUPIL.cy} r={PUPIL_RADIUS} fill={colors.brandingBlack} />
            <Circle
                cx={LEFT_PUPIL.cx + HIGHLIGHT_OFFSET.dx}
                cy={LEFT_PUPIL.cy + HIGHLIGHT_OFFSET.dy}
                r={HIGHLIGHT_RADIUS}
                fill={colors.brandingWhite}
            />
            <Circle cx={RIGHT_EYE.cx} cy={RIGHT_EYE.cy} r={EYE_SOCKET_RADIUS} fill={skinColor} />
            <Circle cx={RIGHT_EYE.cx} cy={RIGHT_EYE.cy} r={EYE_WHITE_RADIUS} fill={colors.brandingWhite} />
            <Circle cx={RIGHT_PUPIL.cx} cy={RIGHT_PUPIL.cy} r={PUPIL_RADIUS} fill={colors.brandingBlack} />
            <Circle
                cx={RIGHT_PUPIL.cx + HIGHLIGHT_OFFSET.dx}
                cy={RIGHT_PUPIL.cy + HIGHLIGHT_OFFSET.dy}
                r={HIGHLIGHT_RADIUS}
                fill={colors.brandingWhite}
            />
            {NOSTRILS.map((nostril) => (
                <Circle
                    key={nostril.cx}
                    cx={nostril.cx}
                    cy={nostril.cy}
                    r={NOSTRIL_RADIUS}
                    fill={colors.brandingBlack}
                    opacity={NOSTRIL_OPACITY}
                />
            ))}
            <Path
                d={SMILE_PATH}
                stroke={colors.brandingBlack}
                strokeWidth={SMILE_STROKE_WIDTH}
                strokeLinecap="round"
                fill="none"
            />
        </Svg>
    );
};

export default ChameleonFace;
