import { StyleSheet } from 'react-native';

export const tiny = 3;
export const small = 6;
export const medium = 10;
export const large = 16;
export const xlarge = 20;

const styles = StyleSheet.create({
    // FLEX
    flex: {
        display: 'flex',
    },
    flexRow: {
        display: 'flex',
        flexDirection: 'row',
    },
    flexWrap: {
        flexWrap: 'wrap',
    },
    flexOne: {
        flex: 1,
    },
    flexShrinkOne: {
        flexShrink: 1,
    },
    alignStart: {
        alignItems: 'flex-start',
    },
    alignCenter: {
        alignItems: 'center',
    },
    alignSelfStart: {
        alignSelf: 'flex-start',
    },
    justifyAround: {
        justifyContent: 'space-around',
    },
    justifyBetween: {
        justifyContent: 'space-between',
    },
    justifyStart: {
        justifyContent: 'flex-start',
    },
    justifyCenter: {
        justifyContent: 'center',
    },

    // HEIGHT/WIDTH
    fullWidth: {
        width: '100%',
    },
    heightSm: {
        height: 20,
    },
    heightMd: {
        height: 38,
        lineHeight: 38,
    },
    heightLg: {
        height: 100,
    },
    minWidthMd: {
        minWidth: 60,
    },

    // PADDING
    padRtTiny: {
        paddingRight: tiny,
    },
    padRtSm: {
        paddingRight: small,
    },
    padRtMd: {
        paddingRight: medium,
    },
    padRtLg: {
        paddingRight: large,
    },
    padLtTiny: {
        paddingLeft: tiny,
    },
    padLtSm: {
        paddingLeft: small,
    },
    padLtMd: {
        paddingLeft: medium,
    },
    padLtLg: {
        paddingLeft: large,
    },
    padTopSm: {
        paddingTop: small,
    },
    padTopMd: {
        paddingTop: medium,
    },
    padTopLg: {
        paddingTop: large,
    },
    padBotSm: {
        paddingBottom: small,
    },
    padBotMd: {
        paddingBottom: medium,
    },
    padBotLg: {
        paddingBottom: large,
    },
    padBotXlg: {
        paddingBottom: xlarge,
    },
    padSm: {
        padding: small,
    },
    padMd: {
        padding: medium,
    },
    padLg: {
        padding: large,
    },
    padHorizSm: {
        paddingHorizontal: small,
    },
    padHorizMd: {
        paddingHorizontal: medium,
    },
    padHorizLg: {
        paddingHorizontal: large,
    },
    padVertSm: {
        paddingVertical: small,
    },
    padVertMd: {
        paddingVertical: medium,
    },
    padVertLg: {
        paddingVertical: large,
    },

    // MARGIN
    marginRtSm: {
        marginRight: small,
    },
    marginRtMd: {
        marginRight: medium,
    },
    marginRtLg: {
        marginRight: large,
    },
    marginRtXLg: {
        marginRight: xlarge,
    },
    marginLtNone: {
        marginLeft: 0,
    },
    marginLtSm: {
        marginLeft: small,
    },
    marginLtMd: {
        marginLeft: medium,
    },
    marginLtLg: {
        marginLeft: large,
    },
    marginTopSm: {
        marginTop: small,
    },
    marginTopMd: {
        marginTop: medium,
    },
    marginTopLg: {
        marginTop: large,
    },
    marginTopXLg: {
        marginTop: xlarge,
    },
    marginBotNone: {
        marginBottom: 0,
    },
    marginBotSm: {
        marginBottom: small,
    },
    marginBotMd: {
        marginBottom: medium,
    },
    marginBotLg: {
        marginBottom: large,
    },
    marginBotXl: {
        marginBottom: xlarge,
    },
    marginSm: {
        margin: small,
    },
    marginMd: {
        margin: medium,
    },
    marginLg: {
        margin: large,
    },
    marginHorizSm: {
        marginHorizontal: small,
    },
    marginHorizMd: {
        marginHorizontal: medium,
    },
    marginHorizLg: {
        marginHorizontal: large,
    },
    marginVertSm: {
        marginVertical: small,
    },
    marginVertMd: {
        marginVertical: medium,
    },
    marginVertLg: {
        marginVertical: large,
    },
    marginVertXLg: {
        marginVertical: xlarge,
    },

    // TEXT
    textCenter: {
        textAlign: 'center',
    },
});

export default styles;
