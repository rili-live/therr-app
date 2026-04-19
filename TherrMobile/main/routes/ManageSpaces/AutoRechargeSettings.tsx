import React, { useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Switch } from 'react-native-paper';
import { COIN_PACKAGES, ICoinPackage } from '../../constants/coinPackages';

interface IAutoRechargeSettingsProps {
    theme: any;
    translate: (key: string, params?: any) => string;
    initialEnabled: boolean;
    initialThreshold?: number | null;
    initialPackageId?: string | null;
    isSubmitting: boolean;
    onSave: (payload: {
        autoRechargeEnabled: boolean;
        autoRechargeThresholdCoins: number | null;
        autoRechargePackageId: string | null;
    }) => void;
}

const staticStyles = StyleSheet.create({
    container: {
        paddingHorizontal: 16,
        paddingVertical: 14,
        borderTopWidth: 1,
        marginTop: 4,
    },
    title: {
        fontSize: 15,
        fontWeight: '700',
        marginBottom: 4,
    },
    description: {
        fontSize: 12,
        marginBottom: 12,
    },
    toggleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 12,
    },
    toggleLabel: {
        fontSize: 14,
        fontWeight: '600',
    },
    inputRow: {
        marginBottom: 10,
    },
    inputLabel: {
        fontSize: 12,
        marginBottom: 4,
    },
    input: {
        borderWidth: 1,
        borderRadius: 6,
        paddingHorizontal: 10,
        paddingVertical: 8,
        fontSize: 14,
    },
    packageRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
    },
    packageChip: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
        borderWidth: 1,
        marginRight: 8,
        marginBottom: 8,
    },
    packageChipText: {
        fontSize: 12,
        fontWeight: '600',
    },
    saveButton: {
        marginTop: 6,
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 6,
        alignSelf: 'flex-start',
    },
    saveButtonText: {
        color: '#fff',
        fontSize: 13,
        fontWeight: '600',
    },
});

const AutoRechargeSettings = ({
    theme,
    translate,
    initialEnabled,
    initialThreshold,
    initialPackageId,
    isSubmitting,
    onSave,
}: IAutoRechargeSettingsProps) => {
    const [enabled, setEnabled] = useState<boolean>(initialEnabled);
    const [threshold, setThreshold] = useState<string>(
        initialThreshold != null ? String(initialThreshold) : ''
    );
    const [packageId, setPackageId] = useState<string | null>(initialPackageId || null);

    const handleSave = () => {
        const parsedThreshold = parseInt(threshold, 10);
        onSave({
            autoRechargeEnabled: enabled,
            autoRechargeThresholdCoins: Number.isFinite(parsedThreshold) && parsedThreshold >= 0
                ? parsedThreshold
                : null,
            autoRechargePackageId: packageId,
        });
    };

    const primaryColor = theme.colors?.primary3 || '#007bff';
    const dividerColor = theme.colors?.accentDivider || '#ddd';
    const textColor = theme.colors?.textBlack || '#000';
    const grayColor = theme.colors?.textGray || '#555';

    return (
        <View style={[staticStyles.container, { borderTopColor: dividerColor }]}>
            <Text style={[staticStyles.title, { color: textColor }]}>
                {translate('pages.manageSpaces.recharge.autoRecharge.title')}
            </Text>
            <Text style={[staticStyles.description, { color: grayColor }]}>
                {translate('pages.manageSpaces.recharge.autoRecharge.description')}
            </Text>
            <View style={staticStyles.toggleRow}>
                <Text style={[staticStyles.toggleLabel, { color: textColor }]}>
                    {translate('pages.manageSpaces.recharge.autoRecharge.enableToggle')}
                </Text>
                <Switch
                    value={enabled}
                    onValueChange={setEnabled}
                    color={primaryColor}
                />
            </View>
            <View style={staticStyles.inputRow}>
                <Text style={[staticStyles.inputLabel, { color: grayColor }]}>
                    {translate('pages.manageSpaces.recharge.autoRecharge.thresholdLabel')}
                </Text>
                <TextInput
                    keyboardType="number-pad"
                    value={threshold}
                    onChangeText={setThreshold}
                    editable={enabled}
                    style={[
                        staticStyles.input,
                        {
                            borderColor: dividerColor,
                            color: textColor,
                            opacity: enabled ? 1 : 0.5,
                        },
                    ]}
                />
            </View>
            <View style={staticStyles.inputRow}>
                <Text style={[staticStyles.inputLabel, { color: grayColor }]}>
                    {translate('pages.manageSpaces.recharge.autoRecharge.amountLabel')}
                </Text>
                <View style={[staticStyles.packageRow, { opacity: enabled ? 1 : 0.5 }]}>
                    {COIN_PACKAGES.map((pkg: ICoinPackage) => {
                        const isSelected = packageId === pkg.id;
                        return (
                            <TouchableOpacity
                                key={pkg.id}
                                disabled={!enabled}
                                onPress={() => setPackageId(pkg.id)}
                                style={[
                                    staticStyles.packageChip,
                                    {
                                        borderColor: primaryColor,
                                        backgroundColor: isSelected ? primaryColor : 'transparent',
                                    },
                                ]}
                            >
                                <Text
                                    style={[
                                        staticStyles.packageChipText,
                                        { color: isSelected ? '#fff' : primaryColor },
                                    ]}
                                >
                                    ${(pkg.usdCents / 100).toFixed(0)}
                                </Text>
                            </TouchableOpacity>
                        );
                    })}
                </View>
            </View>
            <TouchableOpacity
                onPress={handleSave}
                disabled={isSubmitting}
                style={[
                    staticStyles.saveButton,
                    { backgroundColor: primaryColor, opacity: isSubmitting ? 0.6 : 1 },
                ]}
            >
                <Text style={staticStyles.saveButtonText}>
                    {translate('pages.manageSpaces.recharge.autoRecharge.saveButton')}
                </Text>
            </TouchableOpacity>
        </View>
    );
};

export default AutoRechargeSettings;
