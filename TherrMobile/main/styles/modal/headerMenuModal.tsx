import { StyleSheet } from 'react-native';

const containerBackgroundColor = '#fcfeff';
// const brandingYellow = '#ebc300';

export default StyleSheet.create({
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
        color: '#388254',
        paddingRight: 10,
        paddingLeft: 10,
    },
    buttonsTitleActive: {
        backgroundColor: 'transparent',
        color: '#388254',
        paddingRight: 10,
        paddingLeft: 10,
    },
    iconStyle: {
        // position: 'absolute',
        // left: 20
    },
    container: {
        backgroundColor: containerBackgroundColor,
        display: 'flex',
        height: '100%',
        width: '90%',
        alignSelf: 'flex-end',
        flexDirection: 'column',
        borderRadius: 0,
        padding: 0,
    },
    header: {
        paddingTop: 4,
        display: 'flex',
        flexDirection: 'row',
        color: '#388254',
    },
    headerTitle: {
        color: '#388254',
        display: 'flex',
        flex: 1,
        justifyContent: 'center',
        alignContent: 'center',
        fontSize: 18,
    },
    body: {
        position: 'relative',
        width: '100%',
        flex: 1,
    },
    footer: {
        display: 'flex',
        paddingBottom: 8,
        position: 'absolute',
        bottom: 0,
        alignItems: 'center',
        width: '100%',
    },
});
