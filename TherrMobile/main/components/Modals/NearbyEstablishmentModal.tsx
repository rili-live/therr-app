import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSelector } from 'react-redux';
import { getTheme } from '../../styles/themes';
import { fontSizes, fontWeights } from '../../styles/text';
import { therrFontFamily } from '../../styles/font';
import { space } from '../../styles/layouts/spacing';
import { radius } from '../../styles/radii';
import { INearbyEstablishment } from '../../utilities/buildSpaceFromPlace';
import BaseModal from './BaseModal';
import ModalButton from './ModalButton';

interface INearbyEstablishmentModal {
    isVisible: boolean;
    establishments: INearbyEstablishment[];
    confirmingPlaceId?: string;
    isConfirming?: boolean;
    onSelect: (placeId: string) => void;
    onDismiss: () => void;
    translate: Function;
    themeButtons: {
        colors: any;
        styles: any;
    };
}

export default ({
    isVisible,
    establishments,
    confirmingPlaceId,
    isConfirming,
    onSelect,
    onDismiss,
    translate,
    themeButtons,
}: INearbyEstablishmentModal) => {
    const themeName = useSelector((state: any) => state?.user?.settings?.mobileThemeName);
    const therrTheme = getTheme(themeName);

    return (
        <BaseModal
            isVisible={isVisible}
            onDismiss={onDismiss}
            dismissable={!isConfirming}
            headerText={translate('modals.nearbyEstablishment.header')}
            actions={
                <ModalButton
                    iconName="close"
                    title={translate('modals.nearbyEstablishment.none')}
                    onPress={onDismiss}
                    disabled={isConfirming}
                    iconRight={false}
                    themeButtons={themeButtons}
                />
            }
        >
            <Text style={[localStyles.description, { color: therrTheme.colors.onSurface }]}>
                {translate('modals.nearbyEstablishment.description')}
            </Text>
            {establishments.map((establishment) => {
                const isRowConfirming = isConfirming && confirmingPlaceId === establishment.placeId;

                return (
                    <Pressable
                        key={establishment.placeId}
                        onPress={() => !isConfirming && onSelect(establishment.placeId)}
                        disabled={isConfirming}
                        style={[
                            localStyles.row,
                            {
                                borderColor: therrTheme.colors.borderLight || therrTheme.colors.onSurface,
                                backgroundColor: therrTheme.colors.surface,
                            },
                        ]}
                    >
                        <View style={localStyles.rowText}>
                            <Text style={[localStyles.name, { color: therrTheme.colors.onSurface }]} numberOfLines={1}>
                                {establishment.name}
                            </Text>
                            {establishment.vicinity ? (
                                <Text
                                    style={[localStyles.vicinity, { color: therrTheme.colors.textGray || therrTheme.colors.onSurface }]}
                                    numberOfLines={1}
                                >
                                    {establishment.vicinity}
                                </Text>
                            ) : null}
                            <Text style={[localStyles.distance, { color: therrTheme.colors.textGray || therrTheme.colors.onSurface }]}>
                                {translate('modals.nearbyEstablishment.distanceAway', {
                                    distance: Math.round(establishment.distanceMeters),
                                })}
                            </Text>
                        </View>
                        {isRowConfirming ? (
                            <ActivityIndicator size="small" color={therrTheme.colors.accentTeal || therrTheme.colors.onSurface} />
                        ) : null}
                    </Pressable>
                );
            })}
        </BaseModal>
    );
};

const localStyles = StyleSheet.create({
    description: {
        fontFamily: therrFontFamily,
        fontSize: fontSizes.md,
        fontWeight: fontWeights.regular,
        textAlign: 'center',
        paddingBottom: space.md,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderWidth: 1,
        borderRadius: radius.md,
        paddingVertical: space.sm,
        paddingHorizontal: space.md,
        marginBottom: space.sm,
    },
    rowText: {
        flex: 1,
        paddingRight: space.sm,
    },
    name: {
        fontFamily: therrFontFamily,
        fontSize: fontSizes.md,
        fontWeight: fontWeights.semibold,
    },
    vicinity: {
        fontFamily: therrFontFamily,
        fontSize: fontSizes.sm,
        fontWeight: fontWeights.regular,
        paddingTop: 2,
    },
    distance: {
        fontFamily: therrFontFamily,
        fontSize: fontSizes.xs,
        fontWeight: fontWeights.regular,
        paddingTop: 2,
    },
});
