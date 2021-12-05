import React from 'react';
import * as therrTheme from '../../styles/themes';
import MarkerIconCamera from './MarkerIconCamera';
import MarkerIconStorefront from './MarkerIconStorefront';
import MarkerIconThinking from './MarkerIconThinking';

const markerConfigs = {
    thought: {
        fill: therrTheme.colors.brandingMapYellow,
    },
    area: {
        fill: therrTheme.colors.beemoBlue,
        fillAlt: therrTheme.colorVariations.primary2Darken,
    },
};

export default function MarkerIcon({
    areaType,
    area,
}) {
    if (!area.mediaIds) {
        if (areaType === 'moments') {
            return (
                <MarkerIconThinking {...markerConfigs.thought} />
            );
        }

        return (
            <MarkerIconStorefront {...markerConfigs.thought} />
        );
    }

    if (areaType === 'moments') {
        return (
            <MarkerIconCamera {...markerConfigs.area} />
        );
    }

    return (
        <MarkerIconStorefront {...markerConfigs.area} />
    );
}
