import { StyleSheet } from 'react-native';
import { IMobileThemeName } from 'therr-react/types';
import { getTheme } from '../themes';

const buildStyles = (themeName?: IMobileThemeName) => {
    const therrTheme = getTheme(themeName);

    const styles = StyleSheet.create({
        overlay: {
            flex: 1,
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'flex-end',
            // backgroundColor: 'rgba(0,0,0,0.25)',
        },
        container: {
            display: 'flex',
            justifyContent: 'flex-start',
            alignItems: 'center',
            width: '100%',
            padding: 10,
            paddingBottom: 40,
            backgroundColor: therrTheme.colors.backgroundGray,
            borderTopWidth: 2,
            borderTopColor: therrTheme.colors.primary,
            // borderTopRightRadius: 15,
            // borderTopLeftRadius: 15,
            elevation: 5,
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
