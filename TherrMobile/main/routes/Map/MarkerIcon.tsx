import React from 'react';
import { ITherrTheme } from '../../styles/themes';
import MarkerIconArt from './MarkerIconArt';
import MarkerIconGeocache from './MarkerIconGeocache';
import MarkerIconCamera from './MarkerIconCamera';
import MarkerIconDiscount from './MarkerIconDiscount';
import MarkerIconDrinks from './MarkerIconDrinks';
import MarkerIconFitness from './MarkerIconFitness';
import MarkerIconFood from './MarkerIconFood';
import MarkerIconHotel from './MarkerIconHotel';
import MarkerIconMusic from './MarkerIconMusic';
import MarkerIconNature from './MarkerIconNature';
import MarkerIconStorefront from './MarkerIconStorefront';
import MarkerIconThinking from './MarkerIconThinking';
import MarkerIconNightLife from './MarkerIconNightLife';
import MarkerIconSeasonal from './MarkerIconSeasonal';
import MarkerIconWarning from './MarkerIconWarning';

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
    drinks: {
        fill: theme.colors.brandingBlack,
    },
    fitness: {
        fill: theme.colors.brandingBlack,
    },
    nightLife: {
        fill: theme.colors.brandingBlack,
    },
    food: {
        fill: theme.colors.brandingBlack,
    },
    hotel: {
        fill: theme.colors.accentBlue,
        fillAlt: theme.colorVariations.primary3Darken,
    },
    music: {
        fill: theme.colors.brandingBlack,
    },
    seasonal: {
        fill: theme.colors.accentTeal,
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
    warning: {
        fill: theme.colors.brandingRed,
    },
});

const MarkerIcon = function MarkerIcon({
    areaType,
    area,
    theme,
}) {
    // TODO: Add all categories
    if (area.category === 'art' || area.category === 'artwork/idea') {
        return (
            <MarkerIconArt {...getMarkerConfigs(theme).art} />
        );
    }
    if (area.category === 'deals') {
        return (
            <MarkerIconDiscount {...getMarkerConfigs(theme).deals} />
        );
    }
    if (area.category === 'drinks' || area.category === 'bar/drinks') {
        return (
            <MarkerIconDrinks {...getMarkerConfigs(theme).drinks} />
        );
    }
    if (area.category === 'fitness') {
        return (
            <MarkerIconFitness {...getMarkerConfigs(theme).fitness} />
        );
    }
    if (area.category === 'food' || area.category === 'restaurant/food') {
        return (
            <MarkerIconFood {...getMarkerConfigs(theme).food} />
        );
    }
    if (area.category === 'music' || area.category === 'music/concerts') {
        return (
            <MarkerIconMusic {...getMarkerConfigs(theme).music} />
        );
    }
    if (area.category === 'seasonal') {
        return (
            <MarkerIconSeasonal {...getMarkerConfigs(theme).seasonal} />
        );
    }
    if (area.category === 'storefront' || area.category === 'storefront/shop'
        || area.category === 'marketplace/festival') {
        return (
            <MarkerIconStorefront {...getMarkerConfigs(theme).storefront} />
        );
    }
    if (area.category === 'hotels/lodging') {
        return (
            <MarkerIconHotel {...getMarkerConfigs(theme).hotel} />
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
    if (area.category === 'nature' || area.category === 'nature/parks') {
        return (
            <MarkerIconNature {...getMarkerConfigs(theme).nature} />
        );
    }
    if (area.category === 'nightLife') {
        return (
            <MarkerIconNightLife {...getMarkerConfigs(theme).nightLife} />
        );
    }
    if (area.category === 'warning') {
        return (
            <MarkerIconWarning {...getMarkerConfigs(theme).warning} />
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
};

export default React.memo(MarkerIcon);
