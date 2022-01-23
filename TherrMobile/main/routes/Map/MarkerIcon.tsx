import React from 'react';
import { ITherrTheme } from '../../styles/themes';
import MarkerIconGeocache from './MarkerIconGeocache';
import MarkerIconCamera from './MarkerIconCamera';
import MarkerIconDiscount from './MarkerIconDiscount';
import MarkerIconFood from './MarkerIconFood';
import MarkerIconMusic from './MarkerIconMusic';
import MarkerIconStorefront from './MarkerIconStorefront';
import MarkerIconThinking from './MarkerIconThinking';

const getMarkerConfigs = (theme: ITherrTheme) => ({
    deals: {
        fill: theme.colors.textBlack,
    },
    geocache: {
        fill: theme.colors.accentRed,
    },
    thought: {
        fill: theme.colors.brandingMapYellow,
    },
    food: {
        fill: theme.colors.textBlack,
    },
    music: {
        fill: theme.colors.accentTextBlack,
    },
    storefront: {
        fill: theme.colors.accentBlue,
        fillAlt: theme.colorVariations.primary2Darken,
    },
    area: {
        fill: theme.colors.accentBlue,
        fillAlt: theme.colorVariations.primary2Darken,
    },
});

export default function MarkerIcon({
    areaType,
    area,
    themeColors,
}) {
    // TODO: Add all categories
    if (area.category === 'deals') {
        return (
            <MarkerIconDiscount {...getMarkerConfigs(themeColors).deals} />
        );
    }
    if (area.category === 'food') {
        return (
            <MarkerIconFood {...getMarkerConfigs(themeColors).food} />
        );
    }
    if (area.category === 'music') {
        return (
            <MarkerIconMusic {...getMarkerConfigs(themeColors).music} />
        );
    }
    if (area.category === 'storefront') {
        return (
            <MarkerIconStorefront {...getMarkerConfigs(themeColors).storefront} />
        );
    }
    if (area.category === 'idea') {
        return (
            <MarkerIconThinking {...getMarkerConfigs(themeColors).thought} />
        );
    }
    if (area.category === 'geocache') {
        return (
            <MarkerIconGeocache {...getMarkerConfigs(themeColors).geocache} />
        );
    }

    // No category
    if (areaType === 'moments') {
        if (!area.mediaIds) {
            return (
                <MarkerIconThinking {...getMarkerConfigs(themeColors).thought} />
            );
        }

        return (
            <MarkerIconCamera {...getMarkerConfigs(themeColors).area} />
        );
    }

    return (
        <MarkerIconStorefront {...getMarkerConfigs(themeColors).area} />
    );
}
