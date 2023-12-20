import { StyleSheet } from 'react-native';
import { IMobileThemeName } from 'therr-react/types';
import { getTheme } from '../../themes';


const buildStyles = (themeName?: IMobileThemeName) => {
    const therrTheme = getTheme(themeName);
    const styles = StyleSheet.create({
        container: {
            backgroundColor: therrTheme.colors.backgroundGray,
            display: 'flex',
            flexDirection: 'row',
            width: '100%',
            height: 100,
            borderRadius: 15,
            marginBottom: 12,
            elevation: 1,
            borderWidth: 1,
            borderColor: therrTheme.colors.accent1,
        },
        avatarContainer: {
            display: 'flex',
            width: 100,
            justifyContent: 'center',
            alignItems: 'center',
        },
        avatarStyle: {
            height: 80,
            width: 80,
            borderRadius: 40,
        },
        contentContainer: {
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
        },
        header: {
            display: 'flex',
            flexDirection: 'row',
            paddingHorizontal: 10,
            paddingVertical: 4,
        },
        headerTitle: {
            maxHeight: 22,
            flex: 1,
            fontWeight: '800',
            fontSize: 16,
            color: therrTheme.colors.accentTextBlack,
            overflow: 'hidden',
        },
        body: {
            paddingHorizontal: 10,
            paddingVertical: 4,
            flex: 1,
        },
        bodyText: {
            maxHeight: 30,
            fontSize: 12,
            color: therrTheme.colors.accentTextBlack,
            overflow: 'hidden',
        },
        footer: {
            display: 'flex',
            flexDirection: 'row',
            justifyContent: 'center',
            paddingHorizontal: 10,
            paddingTop: 10,
        },
        footerIconsContainer: {
            minWidth: 50,
            display: 'flex',
            flexDirection: 'row',
            justifyContent: 'flex-end',
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
