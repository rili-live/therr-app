import React from 'react';
import { ITherrTheme } from '../../styles/themes';
import MarkerIconArt from './MarkerIconArt';
import MarkerIconGeocache from './MarkerIconGeocache';
import MarkerIconCamera from './MarkerIconCamera';
import MarkerIconDiscount from './MarkerIconDiscount';
import MarkerIconFood from './MarkerIconFood';
import MarkerIconMusic from './MarkerIconMusic';
import MarkerIconNature from './MarkerIconNature';
import MarkerIconStorefront from './MarkerIconStorefront';
import MarkerIconThinking from './MarkerIconThinking';

const getMarkerConfigs = (theme: ITherrTheme) => ({
    art: {
        fill: theme.colors.ternary2,
    },
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
    nature: {
        fill: theme.colors.accent3,
    },
});

export default function MarkerIcon({
    areaType,
    area,
    theme,
}) {
    // TODO: Add all categories
    if (area.category === 'art') {
        return (
            <MarkerIconArt {...getMarkerConfigs(theme).art} />
        );
    }
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
    if (area.category === 'nature') {
        return (
            <MarkerIconNature {...getMarkerConfigs(theme).nature} />
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
