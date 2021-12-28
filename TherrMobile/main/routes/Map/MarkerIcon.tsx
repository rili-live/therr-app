import React from 'react';
import * as therrTheme from '../../styles/themes';
import MarkerIconGeocache from './MarkerIconGeocache';
import MarkerIconCamera from './MarkerIconCamera';
import MarkerIconDiscount from './MarkerIconDiscount';
import MarkerIconFood from './MarkerIconFood';
import MarkerIconMusic from './MarkerIconMusic';
import MarkerIconStorefront from './MarkerIconStorefront';
import MarkerIconThinking from './MarkerIconThinking';

const markerConfigs = {
    deals: {
        fill: therrTheme.colors.textBlack,
    },
    geocache: {
        fill: therrTheme.colors.beemoRed,
    },
    thought: {
        fill: therrTheme.colors.brandingMapYellow,
    },
    food: {
        fill: therrTheme.colors.textBlack,
    },
    music: {
        fill: therrTheme.colors.beemoTextBlack,
    },
    storefront: {
        fill: therrTheme.colors.beemoBlue,
        fillAlt: therrTheme.colorVariations.primary2Darken,
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
    if (area.category === 'deals') {
        return (
            <MarkerIconDiscount {...markerConfigs.deals} />
        );
    }
    if (area.category === 'food') {
        return (
            <MarkerIconFood {...markerConfigs.food} />
        );
    }
    if (area.category === 'music') {
        return (
            <MarkerIconMusic {...markerConfigs.music} />
        );
    }
    if (area.category === 'storefront') {
        return (
            <MarkerIconStorefront {...markerConfigs.storefront} />
        );
    }
    if (area.category === 'idea') {
        return (
            <MarkerIconThinking {...markerConfigs.thought} />
        );
    }
    if (area.category === 'geocache') {
        return (
            <MarkerIconGeocache {...markerConfigs.geocache} />
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
