import React from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

interface ITabViewLoadingOverlayProps {
    color?: string;
    backgroundColor?: string;
}

const TabViewLoadingOverlay = ({ color, backgroundColor }: ITabViewLoadingOverlayProps) => (
    <View
        pointerEvents="none"
        style={[
            styles.overlay,
            backgroundColor ? { backgroundColor } : null,
        ]}
    >
        <ActivityIndicator size="large" color={color} />
    </View>
);

const styles = StyleSheet.create({
    overlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        alignItems: 'center',
        justifyContent: 'center',
    },
});

export default TabViewLoadingOverlay;
