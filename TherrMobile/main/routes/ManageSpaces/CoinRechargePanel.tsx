import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { showToast } from '../../utilities/toasts';
import MarketingBlurb from './MarketingBlurb';
import CoinPackageGrid from './CoinPackageGrid';
import AutoRechargeSettings from './AutoRechargeSettings';

interface ICoinRechargePanelProps {
    theme: any;
    translate: (key: string, params?: any) => string;
    userId: string;
    userDetails: any;
    updateUser: (id: string, data: any) => Promise<any>;
}

const staticStyles = StyleSheet.create({
    container: {
        borderBottomWidth: 1,
    },
    headerRow: {
        paddingHorizontal: 16,
        paddingTop: 14,
        paddingBottom: 2,
    },
    title: {
        fontSize: 16,
        fontWeight: '700',
    },
});

const CoinRechargePanel = ({
    theme,
    translate,
    userId,
    userDetails,
    updateUser,
}: ICoinRechargePanelProps) => {
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSaveAutoRecharge = (payload: {
        autoRechargeEnabled: boolean;
        autoRechargeThresholdCoins: number | null;
        autoRechargePackageId: string | null;
    }) => {
        setIsSubmitting(true);
        updateUser(userId, payload)
            .then(() => {
                showToast.success({
                    text1: translate('pages.manageSpaces.recharge.autoRecharge.savedConfirmation'),
                });
            })
            .catch(() => {
                showToast.error({
                    text1: translate('alertTitles.backendErrorMessage'),
                });
            })
            .finally(() => {
                setIsSubmitting(false);
            });
    };

    return (
        <View style={[
            staticStyles.container,
            { borderBottomColor: theme.colors?.accentDivider || '#ddd' },
        ]}>
            <View style={staticStyles.headerRow}>
                <Text style={[staticStyles.title, { color: theme.colors?.textBlack || '#000' }]}>
                    {translate('pages.manageSpaces.recharge.title')}
                </Text>
            </View>
            <MarketingBlurb theme={theme} translate={translate} />
            <CoinPackageGrid theme={theme} translate={translate} />
            <AutoRechargeSettings
                theme={theme}
                translate={translate}
                initialEnabled={!!userDetails?.autoRechargeEnabled}
                initialThreshold={userDetails?.autoRechargeThresholdCoins}
                initialPackageId={userDetails?.autoRechargePackageId}
                isSubmitting={isSubmitting}
                onSave={handleSaveAutoRecharge}
            />
        </View>
    );
};

export default CoinRechargePanel;
