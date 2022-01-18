import { StyleSheet } from 'react-native';

const SMALL = 10;
const MEDIUM = 30;
const LARGE = 55;

export default StyleSheet.create({
    flexCenter: {
        display: 'flex',
        flexDirection: 'row',
        justifyContent: 'center',
        width: '100%',
    },
    marginSmallBot: {
        marginBottom: SMALL,
    },
    marginMediumBot: {
        marginBottom: MEDIUM,
    },
    marginLargeBot: {
        marginBottom: LARGE,
    },
    marginSmallTop: {
        marginTop: SMALL,
    },
    marginMediumTop: {
        marginTop: MEDIUM,
    },
    marginLargeTop: {
        marginTop: LARGE,
    },
});
