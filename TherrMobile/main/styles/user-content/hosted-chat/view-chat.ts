import { StyleSheet } from 'react-native';
import { IMobileThemeName } from 'therr-react/types';
import { getTheme } from '../../themes';

const buildStyles = (themeName?: IMobileThemeName) => {
    const therrTheme = getTheme(themeName);
    const styles = StyleSheet.create({
        container: {
            marginTop: 0,
            marginBottom: 80,
        },
        sendBtnContainer: {
            marginHorizontal: 0,
        },
        messageContainer: {
            display: 'flex',
            flexDirection: 'row',
            marginVertical: 3,
            backgroundColor: therrTheme.colorVariations.accentTextWhiteFade,
            paddingHorizontal: 4,
            paddingVertical: 10,
            borderRadius: 4,
            elevation: 3,
            borderLeftWidth: 5,
            paddingLeft: 10,
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
            paddingHorizontal: 10,
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
