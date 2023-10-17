import { Platform, StyleSheet } from 'react-native';
import { IMobileThemeName } from 'therr-react/types';
import { therrFontFamily } from '../../../styles/font';
import { getTheme, ITherrTheme } from '../../themes';


const dividerHeight = 2;

const getMomentTextStyles = (theme: ITherrTheme) => ({
    color: theme.colors.textBlack,
    fontFamily: therrFontFamily,
});

const androidMomentContainerStyles: any = {

};

const iosMomentContainerStyles: any = {

};

const buildStyles = (themeName?: IMobileThemeName) => {
    const therrTheme = getTheme(themeName);

    const styles = StyleSheet.create({
        divider: {
            backgroundColor: therrTheme.colorVariations.primary2Darken,
            height: dividerHeight * 2,
            width: '100%',
        },
        areaCarousel: {
            width: '100%',
        },
        areaCarouselHeader: {
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-around',
            marginTop: dividerHeight * 2,
            marginBottom: dividerHeight * 2,
        },
        areaCarouselHeaderSliders: {
            borderRadius: 2,
            paddingVertical: 10,
            marginBottom: dividerHeight / 2,
        },
        areaCarouselTab: {

        },
        areaCarouselTabTitle: {
            fontFamily: therrFontFamily,
        },
        areaCarouselFooter: {
            marginTop: dividerHeight / 2,
        },
        areaCarouselFooterWrapped: {
            marginTop: dividerHeight / 2,
        },
        areaContainer: {
            flex: 1,
            overflow: 'hidden',
            paddingBottom: 10,
            backgroundColor: therrTheme.colors.brandingWhite,
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
        areaTitle: {
            ...getMomentTextStyles(therrTheme),
            fontSize: 30,
        },
        areaMessageText: {
            ...getMomentTextStyles(therrTheme),
            fontSize: 20,
            overflow: 'hidden',
        },
        areaDetailsText: {
            ...getMomentTextStyles(therrTheme),
            fontSize: 14,
        },
        noAreasFoundText: {
            ...getMomentTextStyles(therrTheme),
            marginVertical: 50,
            paddingHorizontal: 10,
            fontSize: 20,
            textAlign: 'center',
            color: therrTheme.colors.brandingBlueGreen,
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

    return ({
        ...therrTheme,
        styles,
    });
};

export {
    buildStyles,
};
