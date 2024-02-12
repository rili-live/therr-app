import { StyleSheet } from 'react-native';

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
    flexOne: {
        flex: 1,
    },
    alignCenter: {
        alignItems: 'center',
    },
    justifyAround: {
        justifyContent: 'space-around',
    },
    justifyBetween: {
        justifyContent: 'space-between',
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
    padRtSm: {
        paddingRight: small,
    },
    padRtMd: {
        paddingRight: medium,
    },
    padRtLg: {
        paddingRight: large,
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
});

export default styles;
