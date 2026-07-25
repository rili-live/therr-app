import React from 'react';
import {
    Pressable,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { useSelector } from 'react-redux';
import MaterialIcon from 'react-native-vector-icons/MaterialIcons';
import BaseModal from './BaseModal';
import { Image } from '../BaseImage';
import { getTheme } from '../../styles/themes';
import { getUserImageUri } from '../../utilities/content';
import { maskIdentifier } from '../../utilities/authIdentifier';
import { radius } from '../../styles/radii';
import { space } from '../../styles/layouts/spacing';
import { fontSizes, fontWeights } from '../../styles/text';
import { therrFontFamily } from '../../styles/font';

export interface IPickableAccount {
    id: string;
    /** Identifier to pre-fill on selection. Absent for accounts returned by the server. */
    identifier?: string;
    userName?: string;
    firstName?: string;
    lastName?: string;
    media?: any;
    isBusinessAccount?: boolean;
    isCreatorAccount?: boolean;
}

interface IAccountPickerModalProps {
    isVisible: boolean;
    accounts: IPickableAccount[];
    /** Highlights the row that is currently in play. */
    selectedAccountId?: string;
    headerText: string;
    onSelect: (account: IPickableAccount) => void;
    onClose: () => void;
    /** Omit to hide the per-row remove control (e.g. the post-SMS account picker). */
    onForget?: (account: IPickableAccount) => void;
    /** Omit to hide the "use another account" row. */
    onUseAnotherAccount?: () => void;
    translate: Function;
}

const getDisplayName = (account: IPickableAccount) => {
    const fullName = [account.firstName, account.lastName].filter(Boolean).join(' ');

    return fullName || account.userName || account.identifier || '';
};

/**
 * Account switcher shown from the chevron on the sign-in field, and reused as the picker when
 * a phone number turns out to be attached to more than one account.
 *
 * Both cases are the same interaction — "which of these is you?" — so they share one surface
 * rather than two near-identical sheets. The only difference is which optional affordances
 * the caller passes (`onForget` / `onUseAnotherAccount`).
 */
const AccountPickerModal = ({
    isVisible,
    accounts,
    selectedAccountId,
    headerText,
    onSelect,
    onClose,
    onForget,
    onUseAnotherAccount,
    translate,
}: IAccountPickerModalProps) => {
    const themeName = useSelector((state: any) => state?.user?.settings?.mobileThemeName);
    const therrTheme = getTheme(themeName);

    return (
        <BaseModal
            isVisible={isVisible}
            onDismiss={onClose}
            headerText={headerText}
            width="88%"
        >
            <View>
                {accounts.map((account) => {
                    const isSelected = !!selectedAccountId && selectedAccountId === account.id;

                    return (
                        <View key={account.id} style={localStyles.row}>
                            <Pressable
                                accessibilityRole="button"
                                accessibilityLabel={getDisplayName(account)}
                                onPress={() => onSelect(account)}
                                style={({ pressed }) => [
                                    localStyles.accountButton,
                                    {
                                        backgroundColor: isSelected || pressed
                                            ? therrTheme.colors.surfaceAlt
                                            : 'transparent',
                                        borderColor: isSelected ? therrTheme.colors.brand : 'transparent',
                                    },
                                ]}
                            >
                                <Image
                                    source={{ uri: getUserImageUri({ details: account }, 100) }}
                                    style={localStyles.avatar}
                                />
                                <View style={localStyles.accountText}>
                                    <Text
                                        numberOfLines={1}
                                        style={[localStyles.accountName, { color: therrTheme.colors.onSurface }]}
                                    >
                                        {getDisplayName(account)}
                                    </Text>
                                    {
                                        account.identifier
                                            ? (
                                                <Text
                                                    numberOfLines={1}
                                                    style={[localStyles.accountIdentifier, { color: therrTheme.colors.onSurfaceMuted }]}
                                                >
                                                    {maskIdentifier(account.identifier)}
                                                </Text>
                                            )
                                            : null
                                    }
                                </View>
                                {
                                    isSelected
                                        ? <MaterialIcon name="check-circle" size={20} color={therrTheme.colors.brand} />
                                        : null
                                }
                            </Pressable>
                            {
                                onForget
                                    ? (
                                        <Pressable
                                            accessibilityRole="button"
                                            accessibilityLabel={translate('modals.accountPicker.removeAccount')}
                                            hitSlop={8}
                                            onPress={() => onForget(account)}
                                            style={localStyles.forgetButton}
                                        >
                                            <MaterialIcon name="close" size={18} color={therrTheme.colors.onSurfaceMuted} />
                                        </Pressable>
                                    )
                                    : null
                            }
                        </View>
                    );
                })}
                {
                    onUseAnotherAccount
                        ? (
                            <Pressable
                                accessibilityRole="button"
                                onPress={onUseAnotherAccount}
                                style={({ pressed }) => [
                                    localStyles.accountButton,
                                    localStyles.useAnotherRow,
                                    {
                                        borderTopColor: therrTheme.colors.border,
                                        backgroundColor: pressed ? therrTheme.colors.surfaceAlt : 'transparent',
                                    },
                                ]}
                            >
                                <View style={[localStyles.addIconCircle, { borderColor: therrTheme.colors.brand }]}>
                                    <MaterialIcon name="add" size={20} color={therrTheme.colors.brand} />
                                </View>
                                <Text style={[localStyles.accountName, { color: therrTheme.colors.brand }]}>
                                    {translate('modals.accountPicker.useAnotherAccount')}
                                </Text>
                            </Pressable>
                        )
                        : null
                }
            </View>
        </BaseModal>
    );
};

const localStyles = StyleSheet.create({
    row: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    accountButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: space.md,
        paddingHorizontal: space.sm,
        borderRadius: radius.lg,
        borderWidth: 1,
        gap: space.md,
    },
    avatar: {
        width: 40,
        height: 40,
        borderRadius: radius.circle,
    },
    accountText: {
        flex: 1,
    },
    accountName: {
        fontFamily: therrFontFamily,
        fontSize: fontSizes.md,
        fontWeight: fontWeights.semibold,
    },
    accountIdentifier: {
        fontFamily: therrFontFamily,
        fontSize: fontSizes.sm,
        marginTop: 2,
    },
    forgetButton: {
        paddingHorizontal: space.sm,
        paddingVertical: space.sm,
    },
    useAnotherRow: {
        marginTop: space.xs,
        paddingTop: space.md,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderRadius: 0,
        borderWidth: 0,
    },
    addIconCircle: {
        width: 40,
        height: 40,
        borderRadius: radius.circle,
        borderWidth: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
});

export default AccountPickerModal;
