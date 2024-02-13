import { StyleSheet } from 'react-native';
import { IMobileThemeName } from 'therr-react/types';
import { getTheme } from '../../themes';

const buildStyles = (themeName?: IMobileThemeName) => {
    const therrTheme = getTheme(themeName);

    const styles = StyleSheet.create({
        buttons: {
            backgroundColor: 'transparent',
            height: 50,
        },
        buttonsActive: {
            backgroundColor: 'transparent',
            height: 50,
        },
        buttonsTitle: {
            backgroundColor: 'transparent',
            color: therrTheme.colors.secondary,
            paddingRight: 10,
            paddingLeft: 10,
        },
        buttonsTitleActive: {
            backgroundColor: 'transparent',
            color: therrTheme.colors.secondary,
            paddingRight: 10,
            paddingLeft: 10,
        },
        iconStyle: {
            color: therrTheme.colors.secondary,
            // position: 'absolute',
            // left: 20
        },
        footer: {
            display: 'flex',
            height: 80,
            flex: 1,
            paddingRight: 30,
            position: 'absolute',
            bottom: 0,
            alignItems: 'flex-end',
            justifyContent: 'center',
            width: '100%',
        },
        toggleIcon: {
            color: therrTheme.colors.textWhite,
        },
        mediaContainer: {
            // marginTop: -10,
            // marginLeft: -20,
            // marginRight: -20,
            marginBottom: 30,
            marginLeft: 0,
            marginRight: 0,
            padding: 0,
            backgroundColor: therrTheme.colors.accent2,
            // borderColor: therrTheme.colors.accentTextBlack,
            // borderWidth: 1,
            borderRadius: 16,
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
        },
        mediaImage: {
            width: '100%',
            height: '100%',
            aspectRatio: 4 / 3,
            borderRadius: 16,
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
