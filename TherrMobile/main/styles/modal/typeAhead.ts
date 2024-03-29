import { StyleSheet } from 'react-native';
import { IMobileThemeName } from 'therr-react/types';
import { getTheme } from '../themes';

interface IGetTypeAheadStyles {
    viewPortHeight: number;
}

const buildStyles = ({
    viewPortHeight,
}: IGetTypeAheadStyles, themeName?: IMobileThemeName) => {
    const therrTheme = getTheme(themeName);

    const styles = StyleSheet.create({
        container: {
            position: 'absolute',
            backgroundColor: therrTheme.colors.brandingWhite,
            zIndex: 1000,
            width: '100%',
            top: 0,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'flex-start',
            maxHeight: viewPortHeight - 400,
        },
        separator: {
            width: '100%',
            height: 1,
            backgroundColor: therrTheme.colors.backgroundNeutral,
        },
        itemContainer: {
            paddingHorizontal: 9,
            paddingVertical: 9,
        },
        itemText: {
            color: therrTheme.colors.brandingBlack,
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
