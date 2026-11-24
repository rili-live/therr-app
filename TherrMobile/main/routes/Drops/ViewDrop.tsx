import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Image,
    Pressable,
    ScrollView,
    Text,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { connect } from 'react-redux';
import MaterialIcon from 'react-native-vector-icons/MaterialIcons';
import Geolocation from 'react-native-geolocation-service';
import { DropsService, IDrop } from 'therr-react/services';
import { IUserState } from 'therr-react/types';
import BaseStatusBar from '../../components/BaseStatusBar';
import { Button } from '../../components/BaseButton';
import translator from '../../utilities/translator';
import { showToast } from '../../utilities/toasts';
import getDirections from '../../utilities/getDirections';
import { buildStyles } from '../../styles';
import { buildStyles as buildDropsStyles } from '../../styles/drops';
import {
    formatDropDay,
    formatDropDistance,
    getDistanceToDropMeters,
    getDropUserName,
} from './dropDisplay';

interface IViewDropProps {
    navigation: any;
    route: any;
    user: IUserState;
    location: any;
}

const mapStateToProps = (state: any) => ({
    user: state.user,
    location: state.location,
});

const getFreshPosition = (): Promise<{ latitude: number; longitude: number; accuracy?: number }> => new Promise(
    (resolve, reject) => {
        Geolocation.getCurrentPosition(
            (position) => resolve({
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
                accuracy: position.coords.accuracy,
            }),
            (error) => reject(error),
            { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 },
        );
    },
);

/**
 * One drop (docs/DROPS.md). The recipient sees who left it and where, and opens it by going
 * there: the server checks the distance, so this screen only asks the device where it is and
 * reports the answer. Once opened — or for the sender — it shows the message and photo.
 * Opened with `route.params.dropId`.
 */
export const ViewDrop = ({ navigation, route, user, location }: IViewDropProps) => {
    const dropId: string | undefined = route?.params?.dropId;
    const [drop, setDrop] = useState<IDrop | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isOpening, setIsOpening] = useState(false);
    const [shouldNotifySender, setShouldNotifySender] = useState(true);
    const [currentPosition, setCurrentPosition] = useState<{ latitude: number; longitude: number } | null>(
        location?.user?.latitude && location?.user?.longitude
            ? { latitude: location.user.latitude, longitude: location.user.longitude }
            : null,
    );
    const isMountedRef = useRef(true);

    useEffect(() => () => {
        isMountedRef.current = false;
    }, []);

    const theme = useMemo(() => buildStyles(user.settings?.mobileThemeName), [user.settings?.mobileThemeName]);
    const themeDrops = useMemo(() => buildDropsStyles(user.settings?.mobileThemeName), [user.settings?.mobileThemeName]);
    const locale = user.settings?.locale || 'en-us';
    const translate = useCallback(
        (key: string, params?: any) => translator(locale, key, params),
        [locale],
    );

    useEffect(() => {
        navigation.setOptions({
            title: translate('pages.viewDrop.headerTitle'),
        });
    }, [navigation, translate]);

    const fetchDrop = useCallback(() => {
        if (!dropId) {
            setIsLoading(false);
            return Promise.resolve();
        }
        return DropsService.getById(dropId).then((response: any) => {
            if (isMountedRef.current && response?.data?.drop) {
                setDrop(response.data.drop);
            }
        }).catch(() => {
            // A 404 (deleted, dismissed, or never ours) renders the not-found state below.
        }).finally(() => {
            if (isMountedRef.current) {
                setIsLoading(false);
            }
        });
    }, [dropId]);

    useEffect(() => {
        fetchDrop();
    }, [fetchDrop]);

    // A best-effort live distance for a locked drop. Not authoritative: the server decides.
    useEffect(() => {
        if (!drop || drop.isSender || drop.status !== 'locked') {
            return;
        }
        getFreshPosition()
            .then((position) => {
                if (isMountedRef.current) {
                    setCurrentPosition(position);
                }
            })
            .catch(() => {});
    }, [drop]);

    const onOpen = () => {
        if (!drop) {
            return;
        }
        setIsOpening(true);
        getFreshPosition()
            .catch(() => {
                // Fall back to the last known point; the server will say if it is too far.
                if (currentPosition) {
                    return currentPosition;
                }
                throw new Error('noLocation');
            })
            .then((position: any) => {
                if (isMountedRef.current) {
                    setCurrentPosition({ latitude: position.latitude, longitude: position.longitude });
                }
                return DropsService.open(drop.id, {
                    latitude: position.latitude,
                    longitude: position.longitude,
                    accuracy: position.accuracy,
                    shouldNotifySender,
                });
            })
            .then((response: any) => {
                if (isMountedRef.current && response?.data?.drop) {
                    setDrop(response.data.drop);
                }
            })
            .catch((err: any) => {
                if (!isMountedRef.current) {
                    return;
                }
                const errorCode = err?.response?.data?.errorCode;
                const distanceMeters = err?.response?.data?.distanceMeters;
                if (errorCode === 'tooFar' && Number.isFinite(distanceMeters)) {
                    showToast.warn({
                        text1: translate('pages.viewDrop.alerts.tooFarTitle'),
                        text2: translate('pages.viewDrop.alerts.tooFarBody', { distance: formatDropDistance(distanceMeters) }),
                    });
                } else if (err?.message === 'noLocation') {
                    showToast.error({
                        text1: translate('pages.viewDrop.alerts.noLocationTitle'),
                        text2: translate('pages.viewDrop.alerts.noLocationBody'),
                    });
                } else {
                    showToast.error({
                        text1: translate('pages.viewDrop.alerts.openFailedTitle'),
                        text2: err?.response?.data?.message || translate('alertMessages.backendErrorMessage'),
                    });
                }
                if (errorCode === 'expired') {
                    fetchDrop();
                }
            })
            .finally(() => {
                if (isMountedRef.current) {
                    setIsOpening(false);
                }
            });
    };

    const onRemove = () => {
        if (!drop) {
            return;
        }
        Alert.alert(
            translate(drop.isSender ? 'pages.viewDrop.confirm.deleteTitle' : 'pages.viewDrop.confirm.dismissTitle'),
            translate(drop.isSender ? 'pages.viewDrop.confirm.deleteBody' : 'pages.viewDrop.confirm.dismissBody'),
            [
                { text: translate('pages.viewDrop.confirm.cancel'), style: 'cancel' },
                {
                    text: translate(drop.isSender ? 'pages.viewDrop.confirm.delete' : 'pages.viewDrop.confirm.dismiss'),
                    style: 'destructive',
                    onPress: () => {
                        DropsService.remove(drop.id)
                            .then(() => navigation.goBack())
                            .catch(() => {
                                showToast.error({
                                    text1: translate('alertTitles.backendErrorMessage'),
                                    text2: translate('alertMessages.backendErrorMessage'),
                                });
                            });
                    },
                },
            ],
        );
    };

    const onDropOneBack = () => {
        if (drop?.fromUser?.id) {
            navigation.navigate('CreateDrop', {
                recipient: { id: drop.fromUser.id, userName: drop.fromUser.userName },
            });
        }
    };

    const onDirections = () => {
        if (drop) {
            getDirections({
                latitude: drop.latitude,
                longitude: drop.longitude,
                title: drop.placeName || undefined,
            });
        }
    };

    const renderHero = (iconName: string, title: string, subtitle?: string | null) => (
        <>
            <View style={themeDrops.styles.heroIcon}>
                <MaterialIcon name={iconName} size={40} color={themeDrops.colors.brand} />
            </View>
            <Text style={themeDrops.styles.heroTitle}>{title}</Text>
            {!!subtitle && <Text style={themeDrops.styles.heroSubtitle}>{subtitle}</Text>}
        </>
    );

    const renderContent = (currentDrop: IDrop) => (
        <>
            {!!currentDrop.message && <Text style={themeDrops.styles.messageText}>{currentDrop.message}</Text>}
            {
                !!currentDrop.mediaUrl
                && <Image source={{ uri: currentDrop.mediaUrl }} style={themeDrops.styles.photoFull} resizeMode="cover" />
            }
        </>
    );

    const renderSenderView = (currentDrop: IDrop) => {
        let statusText = translate('pages.viewDrop.labels.notOpenedYet');
        if (currentDrop.status === 'opened') {
            statusText = currentDrop.openedOn
                ? translate('pages.viewDrop.labels.openedOn', { date: formatDropDay(currentDrop.openedOn, locale) })
                : translate('pages.drops.status.opened');
        } else if (currentDrop.status === 'expired') {
            statusText = translate('pages.viewDrop.labels.expiredUnopened');
        }

        return (
            <View style={themeDrops.styles.hero}>
                {renderHero(
                    currentDrop.status === 'opened' ? 'lock-open' : 'lock',
                    translate('pages.viewDrop.labels.youLeftThisFor', { userName: getDropUserName(currentDrop.toUser) }),
                    `${currentDrop.placeName || translate('pages.drops.labels.aSpotYouPicked')} · ${statusText}`,
                )}
                {renderContent(currentDrop)}
                <View style={themeDrops.styles.actionsColumn}>
                    <Button
                        title={translate('pages.viewDrop.buttons.directions')}
                        variant="secondary"
                        size="md"
                        shape="pill"
                        onPress={onDirections}
                    />
                </View>
                <Pressable onPress={onRemove} style={themeDrops.styles.footerLink}>
                    <Text style={themeDrops.styles.footerLinkText}>{translate('pages.viewDrop.buttons.delete')}</Text>
                </Pressable>
            </View>
        );
    };

    const renderLockedView = (currentDrop: IDrop) => {
        const senderName = getDropUserName(currentDrop.fromUser);
        const distance = getDistanceToDropMeters(currentPosition, currentDrop);

        return (
            <View style={themeDrops.styles.hero}>
                {renderHero(
                    'lock',
                    translate('pages.viewDrop.labels.leftYouADrop', { userName: senderName }),
                    currentDrop.placeName
                        ? translate('pages.viewDrop.labels.waitingAt', { placeName: currentDrop.placeName })
                        : translate('pages.viewDrop.labels.waitingAtUnnamed'),
                )}
                {
                    distance !== null
                    && <Text style={themeDrops.styles.distanceText}>
                        {translate('pages.viewDrop.labels.distanceAway', { distance: formatDropDistance(distance) })}
                    </Text>
                }
                <Text style={themeDrops.styles.heroSubtitle}>
                    {translate(currentDrop.hasMedia ? 'pages.viewDrop.info.lockedWithPhoto' : 'pages.viewDrop.info.locked')}
                </Text>
                <Pressable
                    onPress={() => setShouldNotifySender((prev) => !prev)}
                    style={themeDrops.styles.checkboxRow}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: shouldNotifySender }}
                >
                    <MaterialIcon
                        name={shouldNotifySender ? 'check-box' : 'check-box-outline-blank'}
                        size={22}
                        color={themeDrops.colors.brand}
                    />
                    <Text style={themeDrops.styles.checkboxLabel}>
                        {translate('pages.viewDrop.labels.letThemKnow', { userName: senderName })}
                    </Text>
                </Pressable>
                <View style={themeDrops.styles.actionsColumn}>
                    <Button
                        title={translate('pages.viewDrop.buttons.open')}
                        variant="primary"
                        size="lg"
                        shape="pill"
                        onPress={onOpen}
                        loading={isOpening}
                        disabled={isOpening}
                    />
                    <View style={themeDrops.styles.actionSpacer} />
                    <Button
                        title={translate('pages.viewDrop.buttons.directions')}
                        variant="secondary"
                        size="md"
                        shape="pill"
                        onPress={onDirections}
                    />
                </View>
            </View>
        );
    };

    const renderOpenedView = (currentDrop: IDrop) => (
        <View style={themeDrops.styles.hero}>
            {renderHero(
                'lock-open',
                translate('pages.viewDrop.labels.fromUser', { userName: getDropUserName(currentDrop.fromUser) }),
                currentDrop.placeName || null,
            )}
            {renderContent(currentDrop)}
            <View style={themeDrops.styles.actionsColumn}>
                <Button
                    title={translate('pages.viewDrop.buttons.dropOneBack')}
                    variant="primary"
                    size="lg"
                    shape="pill"
                    onPress={onDropOneBack}
                />
            </View>
            <Pressable onPress={onRemove} style={themeDrops.styles.footerLink}>
                <Text style={themeDrops.styles.footerLinkText}>{translate('pages.viewDrop.buttons.dismiss')}</Text>
            </Pressable>
        </View>
    );

    const renderExpiredView = (currentDrop: IDrop) => (
        <View style={themeDrops.styles.hero}>
            {renderHero(
                'hourglass-empty',
                translate('pages.viewDrop.labels.expiredTitle'),
                translate('pages.viewDrop.labels.expiredBody', { userName: getDropUserName(currentDrop.fromUser) }),
            )}
            <Pressable onPress={onRemove} style={themeDrops.styles.footerLink}>
                <Text style={themeDrops.styles.footerLinkText}>{translate('pages.viewDrop.buttons.dismiss')}</Text>
            </Pressable>
        </View>
    );

    const renderBody = () => {
        if (isLoading) {
            return (
                <View style={themeDrops.styles.emptyContainer}>
                    <ActivityIndicator size="large" color={themeDrops.colors.brand} />
                </View>
            );
        }
        if (!drop) {
            return (
                <View style={themeDrops.styles.emptyContainer}>
                    <MaterialIcon name="search-off" size={48} color={themeDrops.colors.onSurfaceMuted} />
                    <Text style={themeDrops.styles.emptyTitle}>{translate('pages.viewDrop.info.notFoundTitle')}</Text>
                    <Text style={themeDrops.styles.emptyText}>{translate('pages.viewDrop.info.notFoundBody')}</Text>
                </View>
            );
        }
        if (drop.isSender) {
            return renderSenderView(drop);
        }
        if (drop.status === 'opened') {
            return renderOpenedView(drop);
        }
        if (drop.status === 'expired') {
            return renderExpiredView(drop);
        }
        return renderLockedView(drop);
    };

    return (
        <>
            <BaseStatusBar therrThemeName={user.settings?.mobileThemeName} />
            <SafeAreaView edges={[]} style={[theme.styles.safeAreaView, themeDrops.styles.body]}>
                <ScrollView contentContainerStyle={themeDrops.styles.scrollContent}>
                    {renderBody()}
                </ScrollView>
            </SafeAreaView>
        </>
    );
};

export default connect(mapStateToProps)(ViewDrop);
