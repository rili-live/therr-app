import React from 'react';
import { ITherrTheme } from '../../styles/themes';
import MarkerIconArt from './MarkerIconArt';
import MarkerIconGeocache from './MarkerIconGeocache';
import MarkerIconCamera from './MarkerIconCamera';
import MarkerIconDiscount from './MarkerIconDiscount';
import MarkerIconDrinks from './MarkerIconDrinks';
import MarkerIconEvent from './MarkerIconEvent';
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
    event: {
        fill: theme.colors.brandingBlueGreen,
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
    // Normalize category by stripping 'categories.' prefix from CategoriesMap values
    const category = area.category?.replace(/^categories\./, '');

    if (areaType === 'events' || category === 'event/space') {
        return (
            <MarkerIconEvent {...getMarkerConfigs(theme).event} />
        );
    }

    if (category === 'art' || category === 'artwork/expression' || category?.includes('artwork')) {
        return (
            <MarkerIconArt {...getMarkerConfigs(theme).art} />
        );
    }
    if (category === 'deals') {
        return (
            <MarkerIconDiscount {...getMarkerConfigs(theme).deals} />
        );
    }
    if (category === 'drinks' || category === 'bar/drinks') {
        return (
            <MarkerIconDrinks {...getMarkerConfigs(theme).drinks} />
        );
    }
    if (category === 'fitness' || category === 'fitness/sports' || category === 'sports') {
        return (
            <MarkerIconFitness {...getMarkerConfigs(theme).fitness} />
        );
    }
    if (category === 'food' || category === 'restaurant/food' || category === 'menu') {
        return (
            <MarkerIconFood {...getMarkerConfigs(theme).food} />
        );
    }
    if (category === 'music' || category === 'music/concerts') {
        return (
            <MarkerIconMusic {...getMarkerConfigs(theme).music} />
        );
    }
    if (category === 'seasonal') {
        return (
            <MarkerIconSeasonal {...getMarkerConfigs(theme).seasonal} />
        );
    }
    if (category === 'storefront' || category === 'storefront/shop'
        || category === 'marketplace/festival') {
        return (
            <MarkerIconStorefront {...getMarkerConfigs(theme).storefront} />
        );
    }
    if (category === 'hotels/lodging') {
        return (
            <MarkerIconHotel {...getMarkerConfigs(theme).hotel} />
        );
    }
    if (category === 'idea') {
        return (
            <MarkerIconThinking {...getMarkerConfigs(theme).thought} />
        );
    }
    if (category === 'geocache') {
        return (
            <MarkerIconGeocache {...getMarkerConfigs(theme).geocache} />
        );
    }
    if (category === 'nature' || category === 'nature/parks') {
        return (
            <MarkerIconNature {...getMarkerConfigs(theme).nature} />
        );
    }
    if (category === 'nightLife') {
        return (
            <MarkerIconNightLife {...getMarkerConfigs(theme).nightLife} />
        );
    }
    if (category === 'museum/academia') {
        return (
            <MarkerIconArt {...getMarkerConfigs(theme).art} />
        );
    }
    if (category === 'warning') {
        return (
            <MarkerIconWarning {...getMarkerConfigs(theme).warning} />
        );
    }

    // No category
    if (areaType === 'moments') {
        if (!area.medias?.length) {
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
