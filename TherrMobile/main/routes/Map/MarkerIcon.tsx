import React from 'react';
import * as therrTheme from '../../styles/themes';
import MarkerIconCamera from './MarkerIconCamera';
import MarkerIconThinking from './MarkerIconThinking';

const markerConfigs = {
    thought: {
        fill: therrTheme.colors.brandingMapYellow,
    },
    moment: {
        fill: therrTheme.colors.beemoBlue,
        fillAlt: therrTheme.colorVariations.primary2Darken,
    },
};

export default function MarkerIcon({
    moment,
}) {
    if (!moment.mediaIds) {
        return (
            <MarkerIconThinking {...markerConfigs.thought} />
        );
    }
    return (
        <MarkerIconCamera {...markerConfigs.moment} />
    );
}
