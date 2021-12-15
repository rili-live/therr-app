import React from 'react';
import * as therrTheme from '../../styles/themes';
import MarkerIconCamera from './MarkerIconCamera';
import MarkerIconStorefront from './MarkerIconStorefront';
import MarkerIconThinking from './MarkerIconThinking';

const markerConfigs = {
    thought: {
        fill: therrTheme.colors.brandingMapYellow,
    },
    music: {
        fill: therrTheme.colors.tertiary,
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
    // TODO: Add all categories
    if (area.category === 'music') {
        return (
            <MarkerIconThinking {...markerConfigs.music} />
        );
    }
    if (area.category === 'idea') {
        return (
            <MarkerIconThinking {...markerConfigs.thought} />
        );
    }

    // No category
    if (areaType === 'moments') {
        if (!area.mediaIds) {
            return (
                <MarkerIconThinking {...markerConfigs.thought} />
            );
        }

        return (
            <MarkerIconCamera {...markerConfigs.area} />
        );
    }

    return (
        <MarkerIconStorefront {...markerConfigs.area} />
    );
}
