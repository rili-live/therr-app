import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Categories } from 'therr-js-utilities/constants';
import { ITherrTheme } from '../../styles/themes';
import MarkerIconArt from './MarkerIconArt';
import MarkerIconGeocache from './MarkerIconGeocache';
import MarkerIconCamera from './MarkerIconCamera';
import MarkerIconCrowd from './MarkerIconCrowd';
import MarkerIconDiscount from './MarkerIconDiscount';
import MarkerIconDrinks from './MarkerIconDrinks';
import MarkerIconEvent from './MarkerIconEvent';
import MarkerIconFire from './MarkerIconFire';
import MarkerIconFitness from './MarkerIconFitness';
import MarkerIconFood from './MarkerIconFood';
import MarkerIconGem from './MarkerIconGem';
import MarkerIconHotel from './MarkerIconHotel';
import MarkerIconHourglass from './MarkerIconHourglass';
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
    fire: {
        fill: theme.colors.brandingOrange,
    },
    hourglass: {
        fill: theme.colors.brandingOrange,
    },
    crowd: {
        fill: theme.colors.brandingOrange,
    },
    gem: {
        fill: theme.colors.brandingOrange,
    },
});

const quickReportIconSize = 36;

const localStyles = StyleSheet.create({
    quickReportRing: {
        width: quickReportIconSize + 12,
        height: quickReportIconSize + 12,
        borderRadius: (quickReportIconSize + 12) / 2,
        borderWidth: 3,
        alignItems: 'center',
        justifyContent: 'center',
    },
});

const getIconForCategory = (category, areaType, area, theme) => {
    const configs = getMarkerConfigs(theme);

    if (areaType === 'events' || category === 'event/space') {
        return <MarkerIconEvent {...configs.event} />;
    }
    if (category === 'art' || category === 'artwork/expression' || category?.includes('artwork')) {
        return <MarkerIconArt {...configs.art} />;
    }
    if (category === 'deals' || category === 'localDeal') {
        return <MarkerIconDiscount {...configs.deals} />;
    }
    if (category === 'drinks' || category === 'bar/drinks') {
        return <MarkerIconDrinks {...configs.drinks} />;
    }
    if (category === 'fitness' || category === 'fitness/sports' || category === 'sports') {
        return <MarkerIconFitness {...configs.fitness} />;
    }
    if (category === 'food' || category === 'restaurant/food' || category === 'menu') {
        return <MarkerIconFood {...configs.food} />;
    }
    if (category === 'music' || category === 'music/concerts' || category === 'liveEntertainment') {
        return <MarkerIconMusic {...configs.music} />;
    }
    if (category === 'seasonal') {
        return <MarkerIconSeasonal {...configs.seasonal} />;
    }
    if (category === 'storefront' || category === 'storefront/shop'
        || category === 'marketplace/festival') {
        return <MarkerIconStorefront {...configs.storefront} />;
    }
    if (category === 'hotels/lodging') {
        return <MarkerIconHotel {...configs.hotel} />;
    }
    if (category === 'idea') {
        return <MarkerIconThinking {...configs.thought} />;
    }
    if (category === 'geocache') {
        return <MarkerIconGeocache {...configs.geocache} />;
    }
    if (category === 'nature' || category === 'nature/parks') {
        return <MarkerIconNature {...configs.nature} />;
    }
    if (category === 'nightLife') {
        return <MarkerIconNightLife {...configs.nightLife} />;
    }
    if (category === 'museum/academia') {
        return <MarkerIconArt {...configs.art} />;
    }
    if (category === 'warning') {
        return <MarkerIconWarning {...configs.warning} />;
    }
    if (category === 'happeningNow') {
        return <MarkerIconFire {...configs.fire} />;
    }
    if (category === 'longWait') {
        return <MarkerIconHourglass {...configs.hourglass} />;
    }
    if (category === 'crowdAlert') {
        return <MarkerIconCrowd {...configs.crowd} />;
    }
    if (category === 'hiddenGem') {
        return <MarkerIconGem {...configs.gem} />;
    }

    // No category
    if (areaType === 'moments') {
        if (!area.medias?.length) {
            return <MarkerIconThinking {...configs.thought} />;
        }
        return <MarkerIconCamera {...configs.area} />;
    }

    return <MarkerIconStorefront {...configs.area} />;
};

const MarkerIcon = function MarkerIcon({
    areaType,
    area,
    theme,
}) {
    // Normalize category by stripping 'categories.' prefix from CategoriesMap values
    const category = area.category?.replace(/^categories\./, '');
    const isQuickReport = Categories.QuickReportCategories.includes(area.category);

    const iconSize = isQuickReport ? quickReportIconSize : undefined;
    const icon = getIconForCategory(category, areaType, area, theme);
    const sizedIcon = isQuickReport ? React.cloneElement(icon, { width: iconSize, height: iconSize }) : icon;

    if (isQuickReport) {
        return (
            <View style={[
                localStyles.quickReportRing,
                {
                    borderColor: theme.colors.brandingOrange,
                    backgroundColor: theme.colors.backgroundWhite,
                },
            ]}>
                {sizedIcon}
            </View>
        );
    }

    return sizedIcon;
};

export default React.memo(MarkerIcon);
