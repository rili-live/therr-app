import { StyleSheet } from 'react-native';
import { IMobileThemeName } from 'therr-react/types';
import { bottomSafeAreaInset } from '../../navigation/buttonMenu';
import { getTheme } from '../../themes';

const buildStyles = (themeName?: IMobileThemeName) => {
    const therrTheme = getTheme(themeName);
    const styles = StyleSheet.create({
        container: {
            marginTop: 0,
            flex: 1,
        },
        sendBtnContainer: {
            marginHorizontal: 4,
        },
        messageContainer: {
            display: 'flex',
            flexDirection: 'row',
            marginVertical: 3,
            backgroundColor: therrTheme.colors.backgroundWhite,
            paddingHorizontal: 4,
            paddingVertical: 10,
            borderRadius: 4,
            elevation: 3,
            paddingLeft: 10,
            borderWidth: 1,
        },
        messageContentContainer: {
            flex: 1,
        },
        messageHeader: {
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'flex-end',
            paddingBottom: 3,
        },
        senderTitleText: {
            color: therrTheme.colors.accentTextBlack,
            fontSize: 15,
            fontWeight: 'bold',
            paddingRight: 4,
        },
        messageTime: {
            fontSize: 12,
        },
        messageText: {
            color: therrTheme.colors.accentTextBlack,
            fontSize: 15,
            flex: 1,
        },
        footer: {
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 10,
            paddingTop: 8,
            paddingBottom: 8 + bottomSafeAreaInset,
            backgroundColor: therrTheme.colors.backgroundWhite,
            borderTopWidth: 1,
            borderTopColor: therrTheme.colors.accentDivider,
        },
    });

    return ({
        ...therrTheme,
        styles,
    });
};

export  {
    buildStyles,
};
