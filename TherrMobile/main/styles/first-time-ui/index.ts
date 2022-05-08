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

const createProfileGraphicStyles: any = {
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
            fontSize: 18,
            fontWeight: '600',
            fontFamily: therrFontFamily,
            color: therrTheme.colors.textGray,
            paddingBottom: 20,
            marginBottom: 4,
            textAlign: 'left',
            letterSpacing: 1,
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
    });

    return ({
        ...therrTheme,
        styles,
    });
};

export {
    buildStyles,
};
