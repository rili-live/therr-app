import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSelector } from 'react-redux';

const styles = StyleSheet.create({
    container: {
        backgroundColor: '#F59E0B',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 6,
        paddingHorizontal: 12,
    },
    text: {
        color: '#1A1A1A',
        fontSize: 13,
        fontWeight: '600',
        fontFamily: 'Lexend-Regular',
        flex: 1,
        textAlign: 'center',
    },
    dismiss: {
        paddingLeft: 8,
    },
    dismissText: {
        color: '#1A1A1A',
        fontSize: 16,
        fontWeight: '700',
    },
});

const OfflineBanner = () => {
    const isConnected = useSelector((state: any) => state.network?.isConnected);
    const [dismissed, setDismissed] = React.useState(false);

    // Reset dismissed state when connectivity changes
    React.useEffect(() => {
        if (isConnected) {
            setDismissed(false);
        }
    }, [isConnected]);

    if (isConnected !== false || dismissed) {
        return null;
    }

    return (
        <View style={styles.container}>
            <Text style={styles.text}>You are offline. Showing cached data.</Text>
            <TouchableOpacity style={styles.dismiss} onPress={() => setDismissed(true)}>
                <Text style={styles.dismissText}>&times;</Text>
            </TouchableOpacity>
        </View>
    );
};

export default OfflineBanner;
