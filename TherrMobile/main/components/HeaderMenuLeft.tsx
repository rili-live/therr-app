import React from 'react';
import {
    Modal, Pressable, StyleSheet, Text, View,
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { NetworkActionTypes } from 'therr-react/types';
import 'react-native-gesture-handler';
import TherrIcon from '../components/TherrIcon';
import getConfig from '../utilities/getConfig';
import { checkIsConnected } from '../utilities/networkService';
import translator from '../utilities/translator';

export interface IHeaderMenuLeftProps {
    isAuthenticated: boolean;
    isEmailVerifed: boolean;
    styleName: 'light' | 'dark' | 'accent';
    navigation: any;
    theme: {
        styles: any;
    };
}

const HeaderMenuLeft = ({
    isAuthenticated,
    isEmailVerifed,
    styleName,
    navigation,
    theme,
}: IHeaderMenuLeftProps) => {
    const dispatch = useDispatch();
    const isConnected = useSelector((state: any) => state.network?.isConnected);
    const locale = useSelector((state: any) => state?.user?.settings?.locale || 'en-us');
    const isOffline = isConnected === false;
    const [isOfflineModalOpen, setOfflineModalOpen] = React.useState(false);
    const [isRefreshing, setIsRefreshing] = React.useState(false);

    React.useEffect(() => {
        if (!isOffline && isOfflineModalOpen) {
            setOfflineModalOpen(false);
        }
    }, [isOffline, isOfflineModalOpen]);

    const handlePress = () => {
        if (isOffline) {
            setOfflineModalOpen(true);
            return;
        }
        const isMapEnabled = getConfig()?.featureFlags?.ENABLE_MAP === true;
        if (isAuthenticated && !isEmailVerifed) {
            navigation.navigate('CreateProfile');
            return;
        }
        if (isMapEnabled) {
            navigation.navigate('Map', isAuthenticated ? { shouldShowPreview: false } : undefined);
            return;
        }
        navigation.navigate('Home');
    };

    const handleRefresh = async () => {
        if (isRefreshing) return;
        setIsRefreshing(true);
        try {
            const connected = await checkIsConnected();
            dispatch({
                type: NetworkActionTypes.SET_NETWORK_STATUS,
                data: { isConnected: connected },
            });
            if (connected) {
                setOfflineModalOpen(false);
            }
        } finally {
            setIsRefreshing(false);
        }
    };

    let logoStyle = theme.styles.logoIcon;
    if (styleName === 'dark') {
        logoStyle = theme.styles.logoIconDark;
    } else if (styleName === 'accent') {
        logoStyle = theme.styles.logoIconBlack;
    }

    const badgeAria = translator(locale, 'components.offlineIndicator.badgeAria');
    const modalTitle = translator(locale, 'components.offlineIndicator.modal.title');
    const modalBody = translator(locale, 'components.offlineIndicator.modal.body');
    const refreshLabel = translator(locale, 'components.offlineIndicator.modal.refresh');
    const dismissLabel = translator(locale, 'components.offlineIndicator.modal.dismiss');

    return (
        <>
            <View style={styles.wrapper}>
                {/*
                  Render TherrIcon directly (not wrapped in BaseButton) — its
                  built-in onPress handling already provides press feedback.
                  The former BaseButton wrapper had `contentRow: flex:1`
                  inside this `position:relative` View with no flex context,
                  which collapsed the icon to 0×0 and made it invisible.
                */}
                <TherrIcon
                    name="therr-logo"
                    size={26}
                    style={[logoStyle]}
                    onPress={handlePress}
                />
                {isOffline && (
                    <View
                        pointerEvents="none"
                        style={styles.badge}
                        accessible
                        accessibilityLabel={badgeAria}
                    >
                        <Text style={styles.badgeText}>!</Text>
                    </View>
                )}
            </View>
            {isOfflineModalOpen && (
                <Modal
                    animationType="fade"
                    transparent
                    visible
                    onRequestClose={() => setOfflineModalOpen(false)}
                >
                    <Pressable
                        style={styles.modalOverlay}
                        onPress={() => setOfflineModalOpen(false)}
                    >
                        <Pressable style={styles.modalCard} onPress={() => undefined}>
                            <View style={styles.modalHeaderRow}>
                                <Icon name="warning" size={22} color="#F59E0B" />
                                <Text style={styles.modalTitle}>{modalTitle}</Text>
                            </View>
                            <Text style={styles.modalBody}>{modalBody}</Text>
                            <View style={styles.modalActions}>
                                <Pressable
                                    style={[styles.modalButton, styles.modalButtonSecondary]}
                                    onPress={() => setOfflineModalOpen(false)}
                                    accessibilityRole="button"
                                    accessibilityLabel={dismissLabel}
                                >
                                    <Text style={styles.modalButtonSecondaryText}>{dismissLabel}</Text>
                                </Pressable>
                                <Pressable
                                    style={[
                                        styles.modalButton,
                                        styles.modalButtonPrimary,
                                        isRefreshing && styles.modalButtonDisabled,
                                    ]}
                                    onPress={handleRefresh}
                                    disabled={isRefreshing}
                                    accessibilityRole="button"
                                    accessibilityLabel={refreshLabel}
                                >
                                    <Text style={styles.modalButtonPrimaryText}>{refreshLabel}</Text>
                                </Pressable>
                            </View>
                        </Pressable>
                    </Pressable>
                </Modal>
            )}
        </>
    );
};

const styles = StyleSheet.create({
    wrapper: {
        position: 'relative',
        // Hug the icon's intrinsic size (so the badge's absolute corner lands
        // on the icon, not the header slot edge) without overriding the
        // parent header's vertical centering.
        flexDirection: 'row',
        alignItems: 'center',
    },
    badge: {
        position: 'absolute',
        top: 2,
        right: 2,
        minWidth: 14,
        height: 14,
        paddingHorizontal: 3,
        borderRadius: 7,
        backgroundColor: '#F59E0B',
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.3,
        shadowRadius: 1.5,
        elevation: 3,
    },
    badgeText: {
        color: '#1A1A1A',
        fontSize: 10,
        fontWeight: '700',
        lineHeight: 12,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 24,
    },
    modalCard: {
        width: '100%',
        maxWidth: 360,
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        padding: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 8,
        elevation: 6,
    },
    modalHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    modalTitle: {
        marginLeft: 8,
        fontSize: 17,
        fontWeight: '700',
        color: '#1A1A1A',
        flexShrink: 1,
    },
    modalBody: {
        fontSize: 14,
        lineHeight: 20,
        color: '#3A3A3A',
        marginBottom: 20,
    },
    modalActions: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
    },
    modalButton: {
        paddingVertical: 8,
        paddingHorizontal: 14,
        borderRadius: 6,
        marginLeft: 8,
    },
    modalButtonSecondary: {
        backgroundColor: 'transparent',
    },
    modalButtonSecondaryText: {
        color: '#3A3A3A',
        fontSize: 14,
        fontWeight: '600',
    },
    modalButtonPrimary: {
        backgroundColor: '#0F766E',
    },
    modalButtonPrimaryText: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '600',
    },
    modalButtonDisabled: {
        opacity: 0.6,
    },
});

export default React.memo(HeaderMenuLeft);
