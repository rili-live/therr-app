import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

interface IMarketingBlurbProps {
    theme: any;
    translate: (key: string, params?: any) => string;
}

const staticStyles = StyleSheet.create({
    container: {
        paddingHorizontal: 16,
        paddingTop: 14,
        paddingBottom: 10,
    },
    subtitle: {
        fontSize: 13,
        fontWeight: '700',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        marginBottom: 6,
    },
    blurb: {
        fontSize: 13,
        lineHeight: 19,
    },
});

const MarketingBlurb = ({ theme, translate }: IMarketingBlurbProps) => (
    <View style={staticStyles.container}>
        <Text style={[staticStyles.subtitle, { color: theme.colors?.primary3 || '#007bff' }]}>
            {translate('pages.manageSpaces.recharge.subtitle')}
        </Text>
        <Text style={[staticStyles.blurb, { color: theme.colors?.textGray || '#555' }]}>
            {translate('pages.manageSpaces.recharge.marketingBlurb')}
        </Text>
    </View>
);

export default MarketingBlurb;
