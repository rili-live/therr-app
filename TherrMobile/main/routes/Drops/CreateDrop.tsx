import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Image,
    Pressable,
    ScrollView,
    Text,
    TextInput,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { connect } from 'react-redux';
import MaterialIcon from 'react-native-vector-icons/MaterialIcons';
import ImageCropPicker from 'react-native-image-crop-picker';
import Geolocation from 'react-native-geolocation-service';
import RNFB from 'react-native-blob-util';
import { Content } from 'therr-js-utilities/constants';
import { DropsService, IDropMedia, UserConnectionsService } from 'therr-react/services';
import { IUserState } from 'therr-react/types';
import BaseStatusBar from '../../components/BaseStatusBar';
import { Button } from '../../components/BaseButton';
import translator from '../../utilities/translator';
import { showToast } from '../../utilities/toasts';
import { signImageUrl } from '../../utilities/content';
import { buildStyles } from '../../styles';
import { buildStyles as buildDropsStyles } from '../../styles/drops';

// Mirrors the server's limits (users-service utilities/drops.ts). The server is the authority.
const MAX_MESSAGE_LENGTH = 500;
const MAX_PLACE_NAME_LENGTH = 120;
const MAX_RECIPIENTS = 10;
const MAX_PICKED_IMAGE_DIMENSION = 1600;
const CONNECTIONS_PAGE_SIZE = 100;

interface IFriend {
    id: string;
    userName: string;
}

interface ICreateDropProps {
    navigation: any;
    route: any;
    user: IUserState;
    location: any;
}

const mapStateToProps = (state: any) => ({
    user: state.user,
    location: state.location,
});

/**
 * Leave a drop (docs/DROPS.md): pick friends, write something and/or add a photo, and pin it
 * where you are standing. Opened with `route.params.recipient` ({ id, userName }) from a profile
 * or a "drop one back", which preselects that friend.
 */
export const CreateDrop = ({ navigation, route, user, location }: ICreateDropProps) => {
    const presetRecipient: IFriend | undefined = route?.params?.recipient?.id ? route.params.recipient : undefined;
    const [friends, setFriends] = useState<IFriend[]>(presetRecipient ? [presetRecipient] : []);
    const [isLoadingFriends, setIsLoadingFriends] = useState(true);
    const [selectedIds, setSelectedIds] = useState<string[]>(presetRecipient ? [presetRecipient.id] : []);
    const [message, setMessage] = useState('');
    const [placeName, setPlaceName] = useState('');
    const [photo, setPhoto] = useState<any>(null);
    const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(
        location?.user?.latitude && location?.user?.longitude
            ? { latitude: location.user.latitude, longitude: location.user.longitude }
            : null,
    );
    const [isLocating, setIsLocating] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const isMountedRef = useRef(true);

    useEffect(() => () => {
        isMountedRef.current = false;
    }, []);

    const theme = useMemo(() => buildStyles(user.settings?.mobileThemeName), [user.settings?.mobileThemeName]);
    const themeDrops = useMemo(() => buildDropsStyles(user.settings?.mobileThemeName), [user.settings?.mobileThemeName]);
    const translate = useCallback(
        (key: string, params?: any) => translator(user.settings?.locale || 'en-us', key, params),
        [user.settings?.locale],
    );

    useEffect(() => {
        navigation.setOptions({
            title: translate('pages.createDrop.headerTitle'),
        });
    }, [navigation, translate]);

    // Friends: accepted connections, most-interacted first.
    useEffect(() => {
        const myId = user.details?.id;
        if (!myId) {
            setIsLoadingFriends(false);
            return;
        }
        UserConnectionsService.search({
            filterBy: 'acceptingUserId',
            query: myId,
            itemsPerPage: CONNECTIONS_PAGE_SIZE,
            pageNumber: 1,
            orderBy: 'interactionCount',
            order: 'desc',
            shouldCheckReverse: true,
        } as any).then((response: any) => {
            if (!isMountedRef.current) {
                return;
            }
            const loaded: IFriend[] = (response?.data?.results || [])
                .map((connection: any) => (connection.users || []).find((u: any) => u.id !== myId))
                .filter((u: any) => u?.id && u?.userName)
                .map((u: any) => ({ id: u.id, userName: u.userName }));
            setFriends((prev) => {
                const byId = new Map<string, IFriend>();
                [...prev, ...loaded].forEach((friend) => byId.set(friend.id, friend));
                return Array.from(byId.values());
            });
        }).catch(() => {
            // The preset recipient (if any) still works; an empty list explains itself below.
        }).finally(() => {
            if (isMountedRef.current) {
                setIsLoadingFriends(false);
            }
        });
    }, [user.details?.id]);

    const refreshLocation = useCallback(() => {
        setIsLocating(true);
        Geolocation.getCurrentPosition(
            (position) => {
                if (isMountedRef.current) {
                    setCoords({
                        latitude: position.coords.latitude,
                        longitude: position.coords.longitude,
                    });
                    setIsLocating(false);
                }
            },
            () => {
                if (isMountedRef.current) {
                    setIsLocating(false);
                }
            },
            { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 },
        );
    }, []);

    // A drop is pinned where the sender is standing, so take a fresh fix rather than trusting a
    // stale cached point from the last time the map was open.
    useEffect(() => {
        refreshLocation();
    }, [refreshLocation]);

    const toggleRecipient = (friendId: string) => {
        setSelectedIds((prev) => {
            if (prev.includes(friendId)) {
                return prev.filter((id) => id !== friendId);
            }
            if (prev.length >= MAX_RECIPIENTS) {
                showToast.warn({
                    text1: translate('pages.createDrop.alerts.tooManyRecipients', { count: MAX_RECIPIENTS }),
                });
                return prev;
            }
            return [...prev, friendId];
        });
    };

    const pickPhoto = () => {
        ImageCropPicker.openPicker({
            mediaType: 'photo',
            includeBase64: false,
            multiple: false,
            cropping: false,
            compressImageMaxWidth: MAX_PICKED_IMAGE_DIMENSION,
            compressImageMaxHeight: MAX_PICKED_IMAGE_DIMENSION,
            compressImageQuality: 0.85,
        }).then((picked: any) => {
            if (isMountedRef.current && picked?.path) {
                setPhoto(picked);
            }
        }).catch(() => {
            // Cancelled or unreadable: leave the drop without a photo.
        });
    };

    // Private bucket: a drop's photo is only ever shown to its sender and recipients.
    const uploadPhoto = (): Promise<IDropMedia | null> => {
        if (!photo?.path) {
            return Promise.resolve(null);
        }
        const pathParts = photo.path.split('.');
        const extension = pathParts.length > 1 ? pathParts[pathParts.length - 1] : 'jpg';

        return signImageUrl(false, {
            action: 'write',
            filename: `drops/drop.${extension}`,
        }).then((response: any) => {
            const signedUrl = response?.data?.url && response.data.url[0];
            const path = response?.data?.path;
            if (!signedUrl || !path) {
                throw new Error('No signed upload URL');
            }
            return RNFB.fetch(
                'PUT',
                signedUrl,
                {
                    'Content-Type': photo.mime || 'image/jpeg',
                    'Content-Length': String(photo.size || ''),
                    'Content-Disposition': 'inline',
                },
                RNFB.wrap(photo.path),
            ).then(() => ({
                path,
                type: Content.mediaTypes.USER_IMAGE_PRIVATE,
            }));
        });
    };

    const trimmedMessage = message.trim();
    const canSubmit = !!selectedIds.length && !!coords && (!!trimmedMessage || !!photo) && !isSubmitting;

    const onSubmit = () => {
        if (!canSubmit || !coords) {
            return;
        }
        setIsSubmitting(true);

        uploadPhoto()
            .then((media) => DropsService.create({
                recipientIds: selectedIds,
                message: trimmedMessage || undefined,
                media,
                latitude: coords.latitude,
                longitude: coords.longitude,
                placeName: placeName.trim() || undefined,
            }))
            .then(() => {
                const names = friends
                    .filter((friend) => selectedIds.includes(friend.id))
                    .map((friend) => friend.userName);
                showToast.success({
                    text1: translate('pages.createDrop.alerts.successTitle'),
                    text2: names.length === 1
                        ? translate('pages.createDrop.alerts.successBodyOne', { userName: names[0] })
                        : translate('pages.createDrop.alerts.successBodyMany', { count: selectedIds.length }),
                });
                navigation.replace('Drops', { activeTab: 'sent' });
            })
            .catch((err: any) => {
                if (!isMountedRef.current) {
                    return;
                }
                setIsSubmitting(false);
                showToast.error({
                    text1: translate('pages.createDrop.alerts.errorTitle'),
                    text2: err?.response?.data?.message || translate('alertMessages.backendErrorMessage'),
                });
            });
    };

    const renderFriends = () => {
        if (isLoadingFriends && !friends.length) {
            return <ActivityIndicator color={themeDrops.colors.brand} />;
        }
        if (!friends.length) {
            return (
                <Text style={themeDrops.styles.helperText}>
                    {translate('pages.createDrop.info.noFriends')}
                </Text>
            );
        }
        return (
            <View style={themeDrops.styles.chipsContainer}>
                {friends.map((friend) => {
                    const isSelected = selectedIds.includes(friend.id);
                    return (
                        <Pressable
                            key={friend.id}
                            onPress={() => toggleRecipient(friend.id)}
                            style={[themeDrops.styles.chip, isSelected ? themeDrops.styles.chipSelected : null]}
                            accessibilityRole="checkbox"
                            accessibilityState={{ checked: isSelected }}
                        >
                            {
                                isSelected
                                && <MaterialIcon name="check" size={16} color={themeDrops.colors.onBrand} style={themeDrops.styles.chipCheckIcon} />
                            }
                            <Text style={[themeDrops.styles.chipText, isSelected ? themeDrops.styles.chipTextSelected : null]}>
                                {friend.userName}
                            </Text>
                        </Pressable>
                    );
                })}
            </View>
        );
    };

    const renderLocation = () => {
        let label = translate('pages.createDrop.labels.locationReady');
        let iconName = 'my-location';
        if (isLocating && !coords) {
            label = translate('pages.createDrop.labels.locating');
            iconName = 'location-searching';
        } else if (!coords) {
            label = translate('pages.createDrop.labels.locationUnavailable');
            iconName = 'location-disabled';
        }

        return (
            <Pressable onPress={refreshLocation} style={themeDrops.styles.locationRow} accessibilityRole="button">
                <MaterialIcon name={iconName} size={22} color={themeDrops.colors.brand} />
                <Text style={themeDrops.styles.locationText}>{label}</Text>
                {isLocating
                    ? <ActivityIndicator size="small" color={themeDrops.colors.brand} />
                    : <MaterialIcon name="refresh" size={20} color={themeDrops.colors.onSurfaceMuted} />}
            </Pressable>
        );
    };

    return (
        <>
            <BaseStatusBar therrThemeName={user.settings?.mobileThemeName} />
            <SafeAreaView edges={[]} style={[theme.styles.safeAreaView, themeDrops.styles.body]}>
                <KeyboardAvoidingView behavior="padding" style={themeDrops.styles.flexOne}>
                    <ScrollView
                        contentContainerStyle={themeDrops.styles.scrollContent}
                        keyboardShouldPersistTaps="handled"
                    >
                        <Text style={themeDrops.styles.helperText}>
                            {translate('pages.createDrop.info.intro')}
                        </Text>

                        <Text style={themeDrops.styles.sectionLabel}>{translate('pages.createDrop.labels.forWho')}</Text>
                        {renderFriends()}

                        <Text style={themeDrops.styles.sectionLabel}>{translate('pages.createDrop.labels.message')}</Text>
                        <TextInput
                            style={[themeDrops.styles.textInput, themeDrops.styles.textInputMultiline]}
                            value={message}
                            onChangeText={setMessage}
                            placeholder={translate('pages.createDrop.placeholders.message')}
                            placeholderTextColor={themeDrops.colors.onSurfaceMuted}
                            maxLength={MAX_MESSAGE_LENGTH}
                            multiline
                        />

                        <Text style={themeDrops.styles.sectionLabel}>{translate('pages.createDrop.labels.photo')}</Text>
                        <Pressable onPress={pickPhoto} style={themeDrops.styles.photoPicker} accessibilityRole="button">
                            {
                                photo?.path
                                    ? <Image source={{ uri: photo.path }} style={themeDrops.styles.photo} resizeMode="cover" />
                                    : <>
                                        <MaterialIcon name="add-a-photo" size={32} color={themeDrops.colors.brand} />
                                        <Text style={themeDrops.styles.helperText}>{translate('pages.createDrop.labels.addPhoto')}</Text>
                                    </>
                            }
                        </Pressable>
                        {
                            !!photo?.path
                            && <Pressable onPress={() => setPhoto(null)} style={themeDrops.styles.footerLink}>
                                <Text style={themeDrops.styles.footerLinkText}>{translate('pages.createDrop.buttons.removePhoto')}</Text>
                            </Pressable>
                        }

                        <Text style={themeDrops.styles.sectionLabel}>{translate('pages.createDrop.labels.where')}</Text>
                        {renderLocation()}
                        <Text style={themeDrops.styles.helperText}>{translate('pages.createDrop.info.whereHelp')}</Text>
                        <TextInput
                            style={[themeDrops.styles.textInput, themeDrops.styles.textInputSpaced]}
                            value={placeName}
                            onChangeText={setPlaceName}
                            placeholder={translate('pages.createDrop.placeholders.placeName')}
                            placeholderTextColor={themeDrops.colors.onSurfaceMuted}
                            maxLength={MAX_PLACE_NAME_LENGTH}
                        />

                        <View style={themeDrops.styles.submitContainer}>
                            <Button
                                title={translate('pages.createDrop.buttons.submit')}
                                variant="primary"
                                size="lg"
                                shape="pill"
                                onPress={onSubmit}
                                disabled={!canSubmit}
                                loading={isSubmitting}
                            />
                            {
                                !canSubmit && !isSubmitting
                                && <Text style={themeDrops.styles.helperText}>
                                    {translate(!selectedIds.length
                                        ? 'pages.createDrop.info.needsRecipient'
                                        : !coords
                                            ? 'pages.createDrop.info.needsLocation'
                                            : 'pages.createDrop.info.needsContent')}
                                </Text>
                            }
                        </View>
                    </ScrollView>
                </KeyboardAvoidingView>
            </SafeAreaView>
        </>
    );
};

export default connect(mapStateToProps)(CreateDrop);
