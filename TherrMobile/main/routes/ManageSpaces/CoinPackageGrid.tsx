import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { showToast } from '../../utilities/toasts';
import { COIN_PACKAGES, ICoinPackage } from '../../constants/coinPackages';

interface ICoinPackageGridProps {
    theme: any;
    translate: (key: string, params?: any) => string;
}

const staticStyles = StyleSheet.create({
    grid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
    },
    tile: {
        width: '48%',
        borderWidth: 1,
        borderRadius: 10,
        padding: 12,
        marginBottom: 10,
        alignItems: 'center',
    },
    tileCoins: {
        fontSize: 18,
        fontWeight: '700',
        marginBottom: 2,
    },
    tileBonus: {
        fontSize: 11,
        fontWeight: '600',
        marginBottom: 6,
    },
    tilePrice: {
        fontSize: 15,
        fontWeight: '600',
        marginBottom: 8,
    },
    buyButton: {
        paddingHorizontal: 14,
        paddingVertical: 6,
        borderRadius: 6,
    },
    buyButtonText: {
        color: '#fff',
        fontSize: 12,
        fontWeight: '600',
    },
});

const formatUsd = (usdCents: number): string => `$${(usdCents / 100).toFixed(0)}`;

const renderTile = (pkg: ICoinPackage, theme: any, translate: ICoinPackageGridProps['translate']) => {
    const onPress = () => {
        showToast.info({
            text1: translate('pages.manageSpaces.recharge.comingSoon'),
        });
    };

    return (
        <View
            key={pkg.id}
            style={[
                staticStyles.tile,
                {
                    borderColor: theme.colors?.accentDivider || '#ddd',
                    backgroundColor: theme.colors?.backgroundWhite || '#fff',
                },
            ]}
        >
            <Text style={[staticStyles.tileCoins, { color: theme.colors?.textBlack || '#000' }]}>
                {translate('pages.manageSpaces.recharge.packages.coinsLabel', { count: pkg.coins })}
            </Text>
            {pkg.bonusCoins > 0 && (
                <Text style={[staticStyles.tileBonus, { color: '#28a745' }]}>
                    {translate('pages.manageSpaces.recharge.packages.bonusLabel', { count: pkg.bonusCoins })}
                </Text>
            )}
            <Text style={[staticStyles.tilePrice, { color: theme.colors?.textGray || '#555' }]}>
                {formatUsd(pkg.usdCents)}
            </Text>
            <TouchableOpacity
                onPress={onPress}
                style={[
                    staticStyles.buyButton,
                    { backgroundColor: theme.colors?.primary3 || '#007bff' },
                ]}
            >
                <Text style={staticStyles.buyButtonText}>
                    {translate('pages.manageSpaces.recharge.packages.buyButton')}
                </Text>
            </TouchableOpacity>
        </View>
    );
};

const CoinPackageGrid = ({ theme, translate }: ICoinPackageGridProps) => (
    <View style={staticStyles.grid}>
        {COIN_PACKAGES.map((pkg) => renderTile(pkg, theme, translate))}
    </View>
);

export default CoinPackageGrid;
