import { StyleSheet } from 'react-native';

export default StyleSheet.create({
    mapView: {
        flex: 1,
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        justifyContent: 'center',
        alignItems: 'center',
    },
    momentAlertOverlayContainer: {
        display: 'flex',
        flexDirection: 'column',
        borderRadius: 0,
        padding: 0,
        zIndex: 10000,
    },
});
