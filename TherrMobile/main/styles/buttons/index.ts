import { StyleSheet } from 'react-native';
import { IMobileThemeName } from 'therr-react/types';
import { therrFontFamily } from '../font';
import { buttonMenuHeight } from '../navigation/buttonMenu';
import { getTheme, ITherrTheme } from '../themes';

const collapseOffset = 20;

const btnStyles: any = {
    borderRadius: 100,
    padding: 1,
    borderWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
    display: 'flex',
    boxSizing: 'border-box',
};

const btnLargeWidth = 42;
const btnXLargeWidth = 52;

const btnContainerStyles: any = {
    borderRadius: 100,
};

const floatingButtonContainerZIndex = 10;

const btnContainerTopHeight = 50;

const getBtnIconStyle = (theme: ITherrTheme) => ({
    color: theme.colors.ternary,
    padding: 0,
});

const getBtnGroupBtnStyles = (theme: ITherrTheme): any => ({
    padding: 4,
    borderWidth: 0,
    backgroundColor: theme.colors.accent1,
    borderRadius: 0,
    height: 32,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
});

const getBottomLeftBtnViewStyles = (theme: ITherrTheme): any => ({
    ...getFloatingBtnContainer(theme),
    left: 18,
    bottom: 60 + buttonMenuHeight - collapseOffset,
});

const getLeftSmallButton1ViewStyles = (theme: ITherrTheme): any => ({
    ...getFloatingBtnContainer(theme),
    left: 18,
    bottom: 60 + buttonMenuHeight - collapseOffset,
});

const getLeftSmallButton2ViewStyles = (theme: ITherrTheme): any => ({
    ...getFloatingBtnContainer(theme),
    left: 80,
    bottom: 60 + buttonMenuHeight - collapseOffset,
});

const getCenterActionButtonViewStyles = (theme: ITherrTheme): any => ({
    ...getFloatingBtnContainer(theme),
    bottom: 45 + buttonMenuHeight - collapseOffset,
});

const getLeftMiniButton1ViewStyles = (theme: ITherrTheme): any => ({
    ...getFloatingBtnContainer(theme),
    left: 18,
    bottom: 120 + buttonMenuHeight - collapseOffset,
});

const getFloatingBtnContainer = (theme: ITherrTheme): any => ({
    position: 'absolute',
    shadowColor: theme.colors.brandingBlack,
    shadowOffset: {
        height: 1,
        width: 1,
    },
    shadowRadius: 4,
    borderRadius: 100,
    padding: 0,
    alignItems: 'center',
    justifyContent: 'center',
    display: 'flex',
    zIndex: floatingButtonContainerZIndex,
});

const buttonGroupStyles: any = {
    width: '100%',
    position: 'absolute',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    paddingVertical: 4,
};

const getQuickFiltersButtonTiny = (theme: ITherrTheme): any => ({
    backgroundColor: theme.colors.brandingWhite,
    // borderColor: therrTheme.colors.primary3,
    display: 'flex',
    alignItems: 'center',
    borderRadius: 8,
    height: 28,
    paddingVertical: 2,
});
const getQuickFiltersButtonTitle = (theme: ITherrTheme): any => ({
    fontWeight: '500',
    fontFamily: therrFontFamily,
    color: theme.colors.primary3,
    paddingLeft: 4,
    fontSize: 14,
});

const buildStyles = (themeName?: IMobileThemeName) => {
    const therrTheme = getTheme(themeName);

    const styles = StyleSheet.create({
        buttonGroup: {
            ...buttonGroupStyles,
            bottom: 40 + buttonMenuHeight - collapseOffset,
        },
        buttonListTopContainer: {
            position: 'absolute',
            width: '100%',
            display: 'flex',
            flexDirection: 'row',
            paddingVertical: 4,
            top: 5,
            height: btnContainerTopHeight,
        },
        buttonListTopContent: {
            // justifyContent: 'center',
            // alignItems: 'center',
            // flexDirection: 'row',
            paddingVertical: 4,
            zIndex: 100,
        },
        buttonGroupTop: {
            ...buttonGroupStyles,
            top: 10 + btnContainerTopHeight,
            zIndex: 100,
        },
        buttonGroupFilterList: {
            ...buttonGroupStyles,
            justifyContent: 'space-around',
            bottom: 100 + buttonMenuHeight - collapseOffset,
            zIndex: 100,
        },
        buttonGroupContainer: {
            display: 'flex',
            flexDirection: 'row',
            justifyContent: 'center',
            alignItems: 'center',
            shadowColor: therrTheme.colors.textBlack,
            shadowOffset: {
                height: 1,
                width: 1,
            },
            shadowRadius: 4,
            elevation: 2,
            borderRadius: 50,
            shadowOpacity: 0.5,
        },
        buttonFloatBottomRightContainer: {
            position: 'absolute',
            right: 20,
            bottom: buttonMenuHeight + 20,
            borderRadius: 100,
        },
        leftBtnGroupButtonContainer: {
            borderTopLeftRadius: 50,
            borderBottomLeftRadius: 50,
            borderTopRightRadius: 0,
            borderBottomRightRadius: 0,
        },
        rightBtnGroupButtonContainer: {
            borderTopLeftRadius: 0,
            borderBottomLeftRadius: 0,
            borderTopRightRadius: 50,
            borderBottomRightRadius: 50,
        },
        btnGroupButtonContainer: {
            borderRadius: 50,
            minWidth: 100,
        },
        mapViewToggleButton: {
            ...getBtnGroupBtnStyles(therrTheme),
        },
        searchFiltersButton: {
            ...getBtnGroupBtnStyles(therrTheme),
        },
        searchThisAreaButton: {
            ...getBtnGroupBtnStyles(therrTheme),
            paddingHorizontal: 15,
            backgroundColor: therrTheme.colors.brandingBlueGreen,
            borderRadius: 50,
        },
        searchFiltersTitle: {
            color: therrTheme.colors.accentTextWhite,
            paddingLeft: 5,
            fontSize: 14,
            lineHeight: 18,
        },
        quickFiltersButtonTiny: {
            ...getQuickFiltersButtonTiny(therrTheme),
        },
        quickFiltersButtonTinyActive: {
            ...getQuickFiltersButtonTiny(therrTheme),
            backgroundColor: therrTheme.colors.primary3,
        },
        quickFiltersButtonTitle: {
            ...getQuickFiltersButtonTitle(therrTheme),
        },
        quickFiltersButtonTitleActive: {
            ...getQuickFiltersButtonTitle(therrTheme),
            color: therrTheme.colors.brandingWhite,
        },
        quickFiltersButtonIcon: {
            color: therrTheme.colors.primary3,
        },
        quickFiltersButtonIconActive: {
            color: therrTheme.colors.brandingWhite,
        },
        searchThisAreaTitle: {
            color: therrTheme.colors.brandingWhite,
            fontSize: 12,
            lineHeight: 13,
            fontWeight: '500',
        },
        addACheckIn: {
            ...getFloatingBtnContainer(therrTheme),
            right: 20,
            bottom: 300 + buttonMenuHeight - collapseOffset,
        },
        addACheckInBadge: {
            ...getFloatingBtnContainer(therrTheme),
            right: 20 + (btnLargeWidth - 10),
            bottom: 300 + buttonMenuHeight + (btnLargeWidth - 10) - collapseOffset,
            zIndex: 20,
        },
        addACheckInFeatured: {
            ...getFloatingBtnContainer(therrTheme),
            right: 80,
            bottom: 60 + buttonMenuHeight - collapseOffset,
        },
        addACheckInBadgeFeatured: {
            ...getFloatingBtnContainer(therrTheme),
            right: 80 + (btnLargeWidth - 10),
            bottom: 60 + buttonMenuHeight + (btnLargeWidth - 10) - collapseOffset,
            zIndex: 20,
        },
        checkInRewardsBadgeContainer: {
            position: 'absolute',
            right: 0,
        },
        checkInRewardsBadge: {
            backgroundColor: therrTheme.colors.tertiary,
        },
        claimASpace: {
            ...getFloatingBtnContainer(therrTheme),
            right: 20,
            bottom: 180 + buttonMenuHeight - collapseOffset,
        },
        createEvent: {
            ...getFloatingBtnContainer(therrTheme),
            right: 20,
            bottom: 120 + buttonMenuHeight - collapseOffset,
        },
        uploadMoment: {
            ...getFloatingBtnContainer(therrTheme),
            right: 20,
            bottom: 240 + buttonMenuHeight - collapseOffset,
        },
        uploadMomentBadge: {
            ...getFloatingBtnContainer(therrTheme),
            right: 20 + (btnLargeWidth - 10),
            bottom: 240 + buttonMenuHeight + (btnLargeWidth - 10) - collapseOffset,
            zIndex: 20,
        },
        uploadMomentFeatured: {
            ...getFloatingBtnContainer(therrTheme),
            right: 80,
            bottom: 60 + buttonMenuHeight - collapseOffset,
        },
        uploadMomentBadgeFeatured: {
            ...getFloatingBtnContainer(therrTheme),
            right: 80 + (btnLargeWidth - 10),
            bottom: 60 + buttonMenuHeight + (btnLargeWidth - 10) - collapseOffset,
            zIndex: 20,
        },
        momentRewardsBadgeContainer: {
            position: 'absolute',
            right: 0,
        },
        momentRewardsBadge: {
            backgroundColor: therrTheme.colors.tertiary,
        },
        addAMoment: {
            ...getFloatingBtnContainer(therrTheme),
            right: 20,
            bottom: 60 + buttonMenuHeight - collapseOffset,
        },
        addAThought: {
            ...getFloatingBtnContainer(therrTheme),
            right: 20,
            bottom: 20 + buttonMenuHeight,
        },
        addAThoughtDiscovered: {
            ...getFloatingBtnContainer(therrTheme),
            right: 20,
            bottom: 20 + 60 + 60 + buttonMenuHeight,
        },
        addAMomentDiscovered: {
            ...getFloatingBtnContainer(therrTheme),
            right: 20,
            bottom: 20 + 60 + buttonMenuHeight,
        },
        applyFilters: {
            ...getFloatingBtnContainer(therrTheme),
            right: 20,
            bottom: 40 + buttonMenuHeight - collapseOffset,
        },
        resetFilters: {
            ...getFloatingBtnContainer(therrTheme),
            left: 20,
            bottom: 40 + buttonMenuHeight - collapseOffset,
        },
        // collapse: {
        //     position: 'absolute',
        //     right: 18,
        //     bottom: collapseOffset + buttonMenuHeight,
        //     shadowColor: therrTheme.colors.textBlack,
        //     shadowOffset: {
        //         height: 1,
        //         width: 1,
        //     },
        //     shadowRadius: 4,
        //     borderRadius: 100,
        //     padding: 0,
        //     width: 96,
        //     height: 20,
        // },
        compass: {
            position: 'absolute',
            right: 84,
            bottom: 60 + buttonMenuHeight - collapseOffset,
            shadowColor: therrTheme.colors.textBlack,
            shadowOffset: {
                height: 1,
                width: 1,
            },
            shadowRadius: 4,
            borderRadius: 100,
            padding: 0,
        },
        toggleFollow: {
            ...getLeftMiniButton1ViewStyles(therrTheme),
        },
        locationEnable: {
            ...getLeftSmallButton1ViewStyles(therrTheme),
        },
        mapFilters: {
            ...getLeftSmallButton2ViewStyles(therrTheme),
        },
        matchUp: {
            ...getCenterActionButtonViewStyles(therrTheme),
            left: 0,
            right: 0,
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: floatingButtonContainerZIndex - 1,
        },
        mapFiltersCount: {
            ...getLeftSmallButton2ViewStyles(therrTheme),
            left: getLeftSmallButton2ViewStyles(therrTheme).left + btnLargeWidth,
            bottom: getLeftSmallButton2ViewStyles(therrTheme).bottom + btnLargeWidth,
        },
        mapFiltersBadgeContainer: {
            position: 'absolute',
            right: 0,
        },
        mapFiltersBadge: {
            backgroundColor: therrTheme.colors.tertiary,
        },
        recenter: {
            position: 'absolute',
            right: 18,
            bottom: 126 + buttonMenuHeight - collapseOffset,
            shadowColor: therrTheme.colors.textBlack,
            shadowOffset: {
                height: 1,
                width: 1,
            },
            shadowRadius: 4,
            borderRadius: 100,
            padding: 0,
        },
        momentLayers: {
            position: 'absolute',
            left: 90,
            bottom: 60 + buttonMenuHeight - collapseOffset,
            shadowColor: therrTheme.colors.textBlack,
            shadowOffset: {
                height: 1,
                width: 1,
            },
            shadowRadius: 4,
            borderRadius: 100,
            padding: 0,
        },
        momentLayerOption1: {
            position: 'absolute',
            left: 96,
            bottom: 100 + buttonMenuHeight - collapseOffset,
            shadowColor: therrTheme.colors.textBlack,
            shadowOffset: {
                height: 1,
                width: 1,
            },
            shadowRadius: 4,
            borderRadius: 100,
            padding: 0,
            height: 32,
            width: 32,
        },
        momentLayerOption2: {
            position: 'absolute',
            left: 96,
            bottom: 160 + buttonMenuHeight - collapseOffset,
            shadowColor: therrTheme.colors.textBlack,
            shadowOffset: {
                height: 1,
                width: 1,
            },
            shadowRadius: 4,
            borderRadius: 100,
            padding: 0,
            height: 32,
            width: 32,
        },
        momentLayerOption3: {
            shadowColor: therrTheme.colors.textBlack,
            shadowOffset: {
                height: 1,
                width: 1,
            },
            shadowRadius: 4,
            borderRadius: 100,
            padding: 0,
            height: 34,
            width: 34,
            alignItems: 'center',
            justifyContent: 'center',
            display: 'flex',
        },
        momentLayerOption4: {
            shadowColor: therrTheme.colors.textBlack,
            shadowOffset: {
                height: 1,
                width: 1,
            },
            shadowRadius: 4,
            borderRadius: 100,
            padding: 0,
            height: 34,
            width: 34,
        },
        notifications: {
            ...getBottomLeftBtnViewStyles(therrTheme),
            zIndex: 10,
        },
        refreshMoments: {
            ...getBottomLeftBtnViewStyles(therrTheme),
        },
        btnContainer: {
            ...btnContainerStyles,
        },
        btn: {
            ...btnStyles,
            backgroundColor: therrTheme.colors.accent1,
        },
        btnSmall: {
            ...btnStyles,
            backgroundColor: therrTheme.colors.accent2,
            height: 24,
            width: 24,
        },
        btnSmallTitle: {
            paddingRight: 10,
            fontFamily: therrFontFamily,
        },
        btnMedium: {
            ...btnStyles,
            backgroundColor: therrTheme.colors.accent1,
            height: 34,
            width: 34,
        },
        btnMediumSecondary: {
            ...btnStyles,
            backgroundColor: therrTheme.colors.secondary,
            height: 36,
            width: 36,
        },
        btnMediumWithText: {
            ...btnStyles,
            backgroundColor: therrTheme.colors.accent1,
            height: 34,
            paddingHorizontal: 15,
        },
        btnMediumTitle: {
            paddingRight: 12,
            fontFamily: therrFontFamily,
            fontSize: 14,
        },
        btnMediumTitleRight: {
            paddingLeft: 12,
            fontFamily: therrFontFamily,
            fontSize: 14,
        },
        btnLarge: {
            ...btnStyles,
            backgroundColor: therrTheme.colors.secondary,
            height: btnLargeWidth,
            width: btnLargeWidth,
        },
        btnXLarge: {
            ...btnStyles,
            backgroundColor: therrTheme.colors.secondary,
            height: btnXLargeWidth,
            width: btnXLargeWidth,
        },
        btnLargeWithText: {
            ...btnStyles,
            backgroundColor: therrTheme.colors.secondary,
            height: btnLargeWidth,
            paddingHorizontal: 14,
        },
        btnLargeTitle: {
            paddingLeft: 7,
            fontFamily: therrFontFamily,
            fontSize: 15,
        },
        btnLargeTitleLeft: {
            paddingRight: 6,
            fontFamily: therrFontFamily,
            fontSize: 15,
        },
        btnClear: {
            ...btnStyles,
            backgroundColor: 'transparent',
        },
        btnTextWhite: {
            color: therrTheme.colorVariations.backgroundCreamLighten,
        },
        btnIcon: {
            ...getBtnIconStyle(therrTheme),
        },
        btnIconBright: {
            ...getBtnIconStyle(therrTheme),
            color: therrTheme.colors.brandingMapYellow,
        },
        btnIconWhite: {
            color: therrTheme.colors.accentTextWhite,
            padding: 0,
        },
        btnIconBlack: {
            color: therrTheme.colors.accentTextBlack,
            padding: 0,
        },
        btnIconRed: {
            color: therrTheme.colors.accentRed,
            padding: 0,
        },
        btnIconInactive: {
            color: therrTheme.colors.primary3,
            padding: 0,
        },
        btnTitleBlack: {
            color: therrTheme.colors.accentTextBlack,
            fontFamily: therrFontFamily,
        },
        btnTitleRed: {
            color: therrTheme.colors.accentRed,
            fontFamily: therrFontFamily,
        },
        labelLeft: {
            marginRight: 8,
            backgroundColor: therrTheme.colorVariations.primaryFadeMore,
            borderRadius: 12,
            padding: 3,
            paddingHorizontal: 10,
            overflow: 'hidden',
        },
        mapView: {
            flex: 1,
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            justifyContent: 'flex-end',
            alignItems: 'center',
        },
        momentAlertOverlayContainer: {
            display: 'flex',
            flexDirection: 'column',
            borderRadius: 0,
            padding: 0,
            zIndex: 10000,
        },
        buttonPill: {
            backgroundColor: therrTheme.colors.primary3,
            paddingHorizontal: 15,
            paddingVertical: 6,
        },
        buttonPillContainerRound: {
            borderRadius: 50,
        },
        buttonPillContainerSquare: {
            borderRadius: 8,
        },
        buttonPillTitle: {
            fontSize: 15,
            fontFamily: therrFontFamily,
        },
    });

    return ({
        ...therrTheme,
        styles,
    });
};

export {
    buildStyles,
};
