import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    Dimensions,
    SafeAreaView,
    Share,
    StyleSheet,
    View,
} from 'react-native';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import { Button as PaperButton, Dialog, Portal, Switch, Text as PaperText, TextInput as PaperTextInput } from 'react-native-paper';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { IContentState, IUserState } from 'therr-react/types';
import { ContentActions, MapActions } from 'therr-react/redux/actions';
import { ReactionsService } from 'therr-react/services';
import { Content } from 'therr-js-utilities/constants';
import YoutubePlayer from 'react-native-youtube-iframe';
import translator from '../services/translator';
import { buildEventUrl } from '../utilities/shareUrls';
import { isDarkTheme } from '../styles/themes';
import { buildStyles } from '../styles';
import { buildStyles as buildFormStyles } from '../styles/forms';
import { buildStyles as buildAccentStyles } from '../styles/layouts/accent';
import { buildStyles as buildMomentStyles } from '../styles/user-content/areas/viewing';
import { buildStyles as buildConfirmModalStyles } from '../styles/modal/confirmModal';
import { buildStyles as buildButtonsStyles } from '../styles/buttons';
import userContentStyles from '../styles/user-content';
import { youtubeLinkRegex } from '../constants';
import AreaDisplay from '../components/UserContent/AreaDisplay';
import ConfirmModal from '../components/Modals/ConfirmModal';
import BaseStatusBar from '../components/BaseStatusBar';
import { isMyContent as checkIsMyEvent, getUserContentUri } from '../utilities/content';
import { SheetManager } from 'react-native-actions-sheet';
import { IContentSelectionType } from '../components/ActionSheet/ContentOptionsSheet';
import { getReactionUpdateArgs } from '../utilities/reactions';
import getDirections from '../utilities/getDirections';

const { width: screenWidth } = Dimensions.get('window');

interface IViewEventDispatchProps {
    getEventDetails: Function;
    deleteEvent: Function;
    createOrUpdateEventReaction: Function;
}

interface IStoreProps extends IViewEventDispatchProps {
    content: IContentState;
    user: IUserState;
}

export interface IViewEventProps extends IStoreProps {
    navigation: any;
    route: any;
}

const mapStateToProps = (state) => ({
    content: state.content,
    user: state.user,
});

const mapDispatchToProps = (dispatch: any) => bindActionCreators({
    getEventDetails: MapActions.getEventDetails,
    deleteEvent: MapActions.deleteEvent,
    createOrUpdateEventReaction: ContentActions.createOrUpdateEventReaction,
}, dispatch);

const ViewEvent = ({
    content,
    user,
    navigation,
    route,
    getEventDetails,
    deleteEvent,
    createOrUpdateEventReaction,
}: IViewEventProps) => {
    const translate = useCallback(
        (key: string, params?: any) => translator(user.settings?.locale || 'en-us', key, params),
        [user.settings?.locale]
    );

    // State
    const [guestCount, setGuestCount] = useState('');
    const [isDeleting, setIsDeleting] = useState(false);
    const [isAttendingModalVisible, setIsAttendingModalVisible] = useState(false);
    const [isDeleteDialogVisible, setIsDeleteDialogVisible] = useState(false);
    const [myReaction, setMyReaction] = useState<any>({});
    const [fetchedEvent, setFetchedEvent] = useState<any>({});
    const [previewStyleState, setPreviewStyleState] = useState<any>({});

    // Refs
    const scrollViewRef = useRef<any>(null);

    // Themes
    const theme = buildStyles(user.settings?.mobileThemeName);
    const themeAccentLayout = buildAccentStyles(user.settings?.mobileThemeName);
    const themeArea = buildMomentStyles(user.settings?.mobileThemeName, true);
    const themeForms = buildFormStyles(user.settings?.mobileThemeName);
    const themeConfirmModal = buildConfirmModalStyles(user.settings?.mobileThemeName);
    const themeButtons = buildButtonsStyles(user.settings?.mobileThemeName);
    const isDarkMode = isDarkTheme(user.settings?.mobileThemeName);
    const brandColor = isDarkMode ? theme.colors.textWhite : theme.colors.brandingBlueGreen;

    // Derived values
    const { event, isMyContent, previousView, previewScrollIndex } = route.params;
    const eventInView = useMemo(() => ({
        ...event,
        ...fetchedEvent,
    }), [event, fetchedEvent]);

    const hashtags = useMemo(
        () => (event.hashTags ? event.hashTags.split(',') : []),
        [event.hashTags]
    );

    const notificationMsg = useMemo(
        () => (event.notificationMsg || '').replace(/\r?\n+|\r+/gm, ' '),
        [event.notificationMsg]
    );

    const previewLinkId = useMemo(() => {
        const youtubeMatches = (event.message || '').match(youtubeLinkRegex);
        return youtubeMatches && youtubeMatches[1];
    }, [event.message]);

    const eventUserName = isMyContent ? user.details.userName : eventInView.fromUserName;
    const eventUserMedia = isMyContent ? user.details.media : (eventInView.fromUserMedia || {});
    const eventUserIsSuperUser = isMyContent ? user.details.isSuperUser : (eventInView.fromUserIsSuperUser || {});

    const mediaPath = eventInView.medias?.[0]?.path;
    const mediaType = eventInView.medias?.[0]?.type;
    const eventMedia = mediaPath && mediaType === Content.mediaTypes.USER_IMAGE_PUBLIC
        ? getUserContentUri(eventInView.medias?.[0], screenWidth, screenWidth)
        : content?.media[mediaPath];

    useEffect(() => {
        const shouldFetchUser = !event?.fromUserMedia || !event.fromUserName;
        const mPath = event.medias?.[0]?.path;
        const eMedia = content?.media[mPath];

        getEventDetails(event.id, {
            withMedia: !eMedia,
            withUser: shouldFetchUser,
        }).then((data) => {
            if (data?.event?.notificationMsg) {
                navigation.setOptions({
                    title: (data.event.notificationMsg || '').replace(/\r?\n+|\r+/gm, ' '),
                });
            }
            setFetchedEvent(data?.event || {});
        });

        ReactionsService.getEventReactions({
            eventId: event.id,
        }).then((response) => {
            const attendingCount = response.data?.attendingCount || 0;
            const reaction = {
                ...response.data,
                attendingCount,
            };
            setMyReaction(reaction);
            setGuestCount((attendingCount < 1) ? '0' : `${attendingCount - 1}`);
        });

        navigation.setOptions({ title: notificationMsg });

        const unsubscribeNavListener = navigation.addListener('beforeRemove', () => {
            // placeholder
        });

        return () => {
            unsubscribeNavListener();
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleGoBack = useCallback(() => {
        if (previousView && (previousView === 'Areas' || previousView === 'Notifications')) {
            if (previousView === 'Areas') {
                navigation.goBack();
            } else if (previousView === 'Notifications') {
                navigation.navigate('Notifications');
            }
        } else {
            navigation.navigate('Map', { shouldShowPreview: true, previewScrollIndex });
        }
    }, [previousView, previewScrollIndex, navigation]);

    const handleGoToViewMap = useCallback((lat, long) => {
        navigation.replace('Map', { latitude: lat, longitude: long });
    }, [navigation]);

    const handleGoToViewSpace = useCallback((evt) => {
        if (evt.spaceId) {
            navigation.navigate('ViewSpace', {
                isMyContent: evt.space?.fromUserId === user.details.id,
                previousView: 'Areas',
                space: { id: evt.spaceId },
                spaceDetails: {},
            });
        }
    }, [navigation, user.details.id]);

    const handleGoToViewUser = useCallback((userId) => {
        navigation.navigate('ViewUser', { userInView: { id: userId } });
    }, [navigation]);

    const handleUpdateEventReaction = useCallback((eventId, data) => {
        navigation.setParams({
            event: {
                ...event,
                reaction: { ...event.reaction, ...data },
            },
        });
        return createOrUpdateEventReaction(eventId, data, event.fromUserId, user.details.userName);
    }, [event, navigation, createOrUpdateEventReaction, user.details.userName]);

    const handleToggleAreaOptions = useCallback((displayArea?: any) => {
        const area = displayArea || { ...event, ...fetchedEvent };

        SheetManager.show('content-options-sheet', {
            payload: {
                contentType: 'area',
                shouldIncludeShareButton: true,
                translate,
                themeForms,
                onSelect: (type: IContentSelectionType) => {
                    if (type === 'getDirections') {
                        getDirections({
                            latitude: area.latitude,
                            longitude: area.longitude,
                            title: area.notificationMsg,
                        });
                    } else if (type === 'shareALink') {
                        const shareUrl = buildEventUrl(user.settings?.locale || 'en-us', area.id);
                        Share.share({
                            message: translate('modals.contentOptions.shareLink.messageEvent', { eventId: area.id, shareUrl }),
                            url: shareUrl,
                            title: translate('modals.contentOptions.shareLink.titleEvent', { eventTitle: area.notificationMsg }),
                        }).catch((err) => console.error(err));
                    } else {
                        const requestArgs: any = getReactionUpdateArgs(type);
                        handleUpdateEventReaction(area.id, requestArgs);
                    }
                },
            },
        });
    }, [event, fetchedEvent, translate, themeForms, handleUpdateEventReaction, user.settings?.locale]);

    const handleEdit = useCallback(() => {
        navigation.navigate('EditEvent', {
            area: eventInView,
            imageDetails: {},
        });
    }, [navigation, eventInView]);

    const handleDeleteConfirm = useCallback(() => {
        setIsDeleting(true);
        if (checkIsMyEvent(event, user)) {
            deleteEvent({ ids: [event.id] })
                .then(() => {
                    navigation.navigate('Map', { shouldShowPreview: false });
                })
                .catch((err) => {
                    console.log('Error deleting event', err);
                    setIsDeleting(false);
                    setIsDeleteDialogVisible(false);
                });
        }
    }, [event, user, deleteEvent, navigation]);

    const handlePreviewFullScreen = useCallback((isFullScreen) => {
        setPreviewStyleState(isFullScreen ? {
            top: 0,
            left: 0,
            padding: 0,
            margin: 0,
            position: 'absolute',
            zIndex: 20,
        } : {});
    }, []);

    const handleAttendingChange = useCallback((isAttending: boolean) => {
        const attendingCount = isAttending ? 1 : 0;
        setGuestCount(!isAttending ? '0' : guestCount);
        setMyReaction((prev) => ({ ...prev, attendingCount }));
    }, [guestCount]);

    const handleAttendingGuestsInputChange = useCallback((count: string) => {
        if (!count || count === '0' || count[0] === '0') {
            setGuestCount('');
            setMyReaction((prev) => ({
                ...prev,
                attendingCount: prev.attendingCount > 1 ? 1 : prev.attendingCount,
            }));
            return;
        }
        if (!/^\d+$/.test(count)) {
            return;
        }
        const guests = parseInt(count, 10);
        const sanitizedGuests = guests > 20 ? 20 : guests;
        setGuestCount(sanitizedGuests.toString());
        setMyReaction((prev) => ({ ...prev, attendingCount: 1 + sanitizedGuests }));
    }, []);

    const handleAttendingSave = useCallback(() => {
        const area = { ...event, ...fetchedEvent };
        handleUpdateEventReaction(area.id, { attendingCount: myReaction.attendingCount });
        setIsAttendingModalVisible(false);
    }, [event, fetchedEvent, myReaction, handleUpdateEventReaction]);

    return (
        <>
            <BaseStatusBar therrThemeName={user.settings?.mobileThemeName} />
            <SafeAreaView style={theme.styles.safeAreaView}>
                <KeyboardAwareScrollView
                    contentInsetAdjustmentBehavior="automatic"
                    ref={scrollViewRef}
                    style={[theme.styles.bodyFlex, themeAccentLayout.styles.bodyView]}
                    contentContainerStyle={[theme.styles.bodyScroll, themeAccentLayout.styles.bodyViewScroll]}
                >
                    <View style={[themeAccentLayout.styles.container, themeArea.styles.areaContainer]}>
                        <AreaDisplay
                            translate={translate}
                            toggleAreaOptions={handleToggleAreaOptions}
                            toggleAttendingModal={() => setIsAttendingModalVisible(true)}
                            hashtags={hashtags}
                            isDarkMode={isDarkMode}
                            isExpanded={true}
                            inspectContent={() => null}
                            myReaction={myReaction}
                            area={eventInView}
                            goToViewMap={handleGoToViewMap}
                            goToViewSpace={handleGoToViewSpace}
                            goToViewUser={handleGoToViewUser}
                            updateAreaReaction={handleUpdateEventReaction}
                            user={user}
                            areaUserDetails={{
                                media: eventUserMedia,
                                userName: eventUserName || translate('alertTitles.nameUnknown') || '',
                                isSuperUser: eventUserIsSuperUser,
                            }}
                            areaMedia={eventMedia}
                            theme={theme}
                            themeForms={themeForms}
                            themeViewArea={themeArea}
                        />
                    </View>
                    {previewLinkId && (
                        <View style={[userContentStyles.preview, previewStyleState]}>
                            <YoutubePlayer
                                height={260}
                                play={false}
                                videoId={previewLinkId}
                                onFullScreenChange={handlePreviewFullScreen}
                            />
                        </View>
                    )}
                </KeyboardAwareScrollView>

                {/* Footer */}
                <View style={[themeAccentLayout.styles.footer, localStyles.footer]}>
                    <PaperButton
                        mode="outlined"
                        onPress={handleGoBack}
                        icon="arrow-left"
                        textColor={brandColor}
                        style={localStyles.footerButton}
                    >
                        {translate('forms.editEvent.buttons.back')}
                    </PaperButton>
                    {isMyContent && (
                        <>
                            <PaperButton
                                mode="outlined"
                                onPress={handleEdit}
                                icon="pencil"
                                textColor={brandColor}
                                style={localStyles.footerButton}
                            >
                                {translate('forms.editEvent.buttons.edit')}
                            </PaperButton>
                            <PaperButton
                                mode="contained"
                                onPress={() => setIsDeleteDialogVisible(true)}
                                icon="trash-can-outline"
                                buttonColor={theme.colors.accentRed}
                                textColor={theme.colors.brandingWhite}
                                style={localStyles.footerButton}
                                disabled={isDeleting}
                                loading={isDeleting}
                            >
                                {translate('forms.editEvent.buttons.delete')}
                            </PaperButton>
                        </>
                    )}
                </View>
            </SafeAreaView>

            {/* RSVP Modal */}
            <Portal>
                <Dialog
                    visible={isAttendingModalVisible}
                    onDismiss={() => setIsAttendingModalVisible(false)}
                    style={localStyles.rsvpDialog}
                >
                    <Dialog.Title>
                        {translate('forms.editEvent.modal.attendingModal.title')}
                    </Dialog.Title>
                    <Dialog.Content>
                        <View style={localStyles.switchRow}>
                            <PaperText
                                style={myReaction?.attendingCount < 1 ? localStyles.switchLabelActive : localStyles.switchLabel}
                            >
                                {translate('forms.editEvent.modal.attendingModal.labels.no')}
                            </PaperText>
                            <Switch
                                style={localStyles.switchControl}
                                color={theme.colors.primary3}
                                onValueChange={handleAttendingChange}
                                value={myReaction?.attendingCount > 0}
                            />
                            <PaperText
                                style={myReaction?.attendingCount > 0 ? localStyles.switchLabelActive : localStyles.switchLabel}
                            >
                                {translate('forms.editEvent.modal.attendingModal.labels.yes')}
                            </PaperText>
                        </View>
                        <PaperText style={localStyles.guestLabel}>
                            {translate('forms.editEvent.modal.attendingModal.labels.bringingGuests')}
                        </PaperText>
                        <PaperTextInput
                            mode="outlined"
                            keyboardType="numeric"
                            maxLength={2}
                            placeholder={translate('forms.editEvent.modal.attendingModal.labels.guests')}
                            value={guestCount}
                            onChangeText={handleAttendingGuestsInputChange}
                            outlineColor={theme.colors.primary3}
                            activeOutlineColor={theme.colors.primary3}
                        />
                    </Dialog.Content>
                    <Dialog.Actions>
                        <PaperButton
                            onPress={() => setIsAttendingModalVisible(false)}
                            textColor={theme.colors.textGray}
                        >
                            {translate('forms.editEvent.buttons.cancel')}
                        </PaperButton>
                        <PaperButton
                            mode="contained"
                            onPress={handleAttendingSave}
                            buttonColor={theme.colors.brandingBlueGreen}
                            textColor={theme.colors.brandingWhite}
                        >
                            {translate('forms.editEvent.modal.attendingModal.buttons.save')}
                        </PaperButton>
                    </Dialog.Actions>
                </Dialog>
            </Portal>

            {/* Delete confirmation modal */}
            <ConfirmModal
                isConfirming={isDeleting}
                isVisible={isDeleteDialogVisible}
                onCancel={() => setIsDeleteDialogVisible(false)}
                onConfirm={handleDeleteConfirm}
                text={translate('forms.editEvent.deleteConfirmation')}
                textConfirm={translate('forms.editEvent.buttons.confirm')}
                textCancel={translate('forms.editEvent.buttons.cancel')}
                translate={translate}
                theme={theme}
                themeModal={themeConfirmModal}
                themeButtons={themeButtons}
            />
        </>
    );
};

const localStyles = StyleSheet.create({
    footer: {
        justifyContent: 'space-between',
        paddingHorizontal: 10,
    },
    footerButton: {
        flex: 1,
        marginHorizontal: 4,
    },
    rsvpDialog: {
        borderRadius: 12,
    },
    switchRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingBottom: 16,
        paddingTop: 4,
    },
    switchControl: {
        marginHorizontal: 12,
    },
    switchLabel: {
        fontSize: 16,
        fontWeight: '400',
    },
    switchLabelActive: {
        fontSize: 16,
        fontWeight: '800',
    },
    guestLabel: {
        marginBottom: 8,
    },
});

export default connect(mapStateToProps, mapDispatchToProps)(ViewEvent);
