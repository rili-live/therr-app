import { Platform, StyleSheet } from 'react-native';
import * as therrTheme from '../../themes';
import editing from './editing';
import viewing, { getViewingMomentStyles } from './viewing';

const dividerHeight = 10;

const momentTextStyles: any = {
    color: therrTheme.colors.textBlack,
};

const androidMomentContainerStyles: any = {

};

const iosMomentContainerStyles: any = {

};

export default StyleSheet.create({
    divider: {
        backgroundColor: therrTheme.colorVariations.primary2Darken,
        height: dividerHeight * 2,
        width: '100%',
    },
    momentCarousel: {
        backgroundColor: therrTheme.colorVariations.backgroundNeutral,
    },
    momentCarouselHeader: {
        marginBottom: dividerHeight / 2,
    },
    momentCarouselFooter: {
        marginTop: dividerHeight / 2,
    },
    momentContainer: {
        flex: 1,
        overflow: 'hidden',
        paddingBottom: 10,
        backgroundColor: therrTheme.colorVariations.backgroundNeutralLighter,
        marginVertical: dividerHeight / 2,
        marginHorizontal: dividerHeight,
        borderRadius: 2,
        ...(Platform.OS === 'ios' ? iosMomentContainerStyles : androidMomentContainerStyles),

        // shadow
        shadowColor: therrTheme.colors.tertiary,
        shadowOffset: {
            height: 2,
            width: 2,
        },
        shadowRadius: 4,
        elevation: 1,
        shadowOpacity: 0.5,
    },
    momentTitle: {
        ...momentTextStyles,
        fontSize: 30,
    },
    momentMessageText: {
        ...momentTextStyles,
        fontSize: 20,
        overflow: 'hidden',
    },
    momentDetailsText: {
        ...momentTextStyles,
        fontSize: 14,
    },
    noMomentsFoundText: {
        ...momentTextStyles,
        marginVertical: 50,
        paddingHorizontal: 10,
        fontSize: 20,
        textAlign: 'center',
        color: therrTheme.colors.textBlack,
    },
    loadingGraphic: {
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        flex: 1,
        padding: 8,
        zIndex: -1,
    },
});

export {
    editing,
    viewing,
    getViewingMomentStyles,
};
