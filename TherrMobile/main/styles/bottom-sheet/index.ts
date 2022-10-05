import { StyleSheet } from 'react-native';
import { IMobileThemeName } from 'therr-react/types';
// import { therrFontFamily } from '../font';
import { getTheme } from '../themes';

const containerStyles: any = {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'center',
};

const buildStyles = (themeName?: IMobileThemeName) => {
    const therrTheme = getTheme(themeName);

    const styles = StyleSheet.create({
        // overlay: {
        //     ...containerStyles,
        //     justifyContent: 'center',
        //     backgroundColor: therrTheme.colors.textGray,
        // },
        backgroundStyle: {
            borderRadius: 9,
        },
        contentContainer: {
            flex: 1,
            alignItems: 'center',
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
