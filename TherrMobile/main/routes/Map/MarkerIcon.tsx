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
        fill: theme.colors.brandingBlack,
    },
    geocache: {
        fill: theme.colors.accentRed,
    },
    thought: {
        fill: theme.colors.brandingMapYellow,
    },
    food: {
        fill: theme.colors.brandingBlack,
    },
    music: {
        fill: theme.colors.brandingBlack,
    },
    storefront: {
        fill: theme.colors.accentBlue,
        fillAlt: theme.colorVariations.primary3Darken,
    },
    area: {
        fill: theme.colors.accentBlue,
        fillAlt: theme.colorVariations.primary3Darken,
    },
});

export default function MarkerIcon({
    areaType,
    area,
    theme,
}) {
    // TODO: Add all categories
    if (area.category === 'deals') {
        return (
            <MarkerIconDiscount {...getMarkerConfigs(theme).deals} />
        );
    }
    if (area.category === 'food') {
        return (
            <MarkerIconFood {...getMarkerConfigs(theme).food} />
        );
    }
    if (area.category === 'music') {
        return (
            <MarkerIconMusic {...getMarkerConfigs(theme).music} />
        );
    }
    if (area.category === 'storefront') {
        return (
            <MarkerIconStorefront {...getMarkerConfigs(theme).storefront} />
        );
    }
    if (area.category === 'idea') {
        return (
            <MarkerIconThinking {...getMarkerConfigs(theme).thought} />
        );
    }
    if (area.category === 'geocache') {
        return (
            <MarkerIconGeocache {...getMarkerConfigs(theme).geocache} />
        );
    }

    // No category
    if (areaType === 'moments') {
        if (!area.mediaIds) {
            return (
                <MarkerIconThinking {...getMarkerConfigs(theme).thought} />
            );
        }

        return (
            <MarkerIconCamera {...getMarkerConfigs(theme).area} />
        );
    }

    return (
        <MarkerIconStorefront {...getMarkerConfigs(theme).area} />
    );
}
