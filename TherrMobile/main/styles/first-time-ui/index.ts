import { StyleSheet } from 'react-native';
import { IMobileThemeName } from 'therr-react/types';
import { therrFontFamily } from '../font';
import { getTheme, ITherrTheme } from '../themes';

const getTitleStyles = (theme: ITherrTheme): any => ({
    fontFamily: therrFontFamily,
    color: theme.colors.textWhite,
    fontSize: 28,
    marginTop: 6,
    marginBottom: 18,
    fontWeight: '500',
    textAlign: 'center',
    letterSpacing: 2,
});

const getSubTitleStyles = (theme: ITherrTheme): any => ({
    fontSize: 18,
    fontWeight: '600',
    fontFamily: therrFontFamily,
    color: theme.colors.textGray,
    paddingBottom: 20,
    marginBottom: 4,
    textAlign: 'left',
    letterSpacing: 1,
});

const createProfileGraphicStyles: any = {
    position: 'absolute',
    width: '100%',
    height: '100%',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    flex: 1,
    padding: 8,
    zIndex: -1,
};

const buildStyles = (themeName?: IMobileThemeName) => {
    const therrTheme = getTheme(themeName);

    const styles = StyleSheet.create({
        title: {
            ...getTitleStyles(therrTheme),
        },
        titleWithSpacing: {
            ...getTitleStyles(therrTheme),
            fontWeight: '800',
            fontFamily: therrFontFamily,
            paddingBottom: 20,
            textAlign: 'left',
            letterSpacing: 1,
        },
        titleWithNoSpacing: {
            ...getTitleStyles(therrTheme),
            fontWeight: '800',
            fontFamily: therrFontFamily,
            paddingBottom: 0,
            marginBottom: 16,
            textAlign: 'left',
            letterSpacing: 1,
        },
        subtitle: {
            ...getSubTitleStyles(therrTheme),
        },
        subtitleCenter: {
            ...getSubTitleStyles(therrTheme),
            textAlign: 'center',
        },
        formAGraphic: {
            ...createProfileGraphicStyles,
        },
        formBGraphic: {
            ...createProfileGraphicStyles,
        },
        graphicImgContainer: {
            display: 'flex',
            width: '100%',
            alignItems: 'center',
        },
        slideContainer: {
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
        },
        sliderDot: {
            width: 16,
            height: 16,
            borderRadius: 8,
            marginHorizontal: 3,
            backgroundColor: therrTheme.colors.controlButtons,
        },
        landingBackgroundOverlay: {
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
        },
        landingContentOverlay: {
            position: 'absolute',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-around',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
        },
        landingContentTitle: {
            color: 'white',
            fontSize: 42,
            lineHeight: 52,
            fontWeight: '600',
            textAlign: 'center',
            fontFamily: 'Lexend-Regular',
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
