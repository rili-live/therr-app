import React from 'react';
import {
    Dimensions,
    SafeAreaView,
    Share,
    View,
} from 'react-native';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import { Button, Text } from 'react-native-elements';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
// import { Button }  from 'react-native-elements';
// import changeNavigationBarColor from 'react-native-navigation-bar-color';
import { IContentState, IUserState } from 'therr-react/types';
import { ContentActions, MapActions } from 'therr-react/redux/actions';
import { ReactionsService } from 'therr-react/services';
import { Content } from 'therr-js-utilities/constants';
import FontAwesome5Icon from 'react-native-vector-icons/FontAwesome5';
import YoutubePlayer from 'react-native-youtube-iframe';
// import Alert from '../components/Alert';
import translator from '../services/translator';
import { buildStyles } from '../styles';
import { buildStyles as buildReactionsModalStyles } from '../styles/modal/areaReactionsModal';
import { buildStyles as buildFormStyles } from '../styles/forms';
import { buildStyles as buildAccentFormStyles } from '../styles/forms/accentEditForm';
import { buildStyles as buildModalStyles } from '../styles/modal';
import { buildStyles as buildAccentStyles } from '../styles/layouts/accent';
import { buildStyles as buildButtonsStyles } from '../styles/buttons';
import { buildStyles as buildEventStyles } from '../styles/user-content/areas/viewing';
import spacingStyles from '../styles/layouts/spacing';
import userContentStyles from '../styles/user-content';
import { youtubeLinkRegex } from '../constants';
import AreaDisplay from '../components/UserContent/AreaDisplay';
import formatDate from '../utilities/formatDate';
import BaseStatusBar from '../components/BaseStatusBar';
import { isMyContent as checkIsMyEvent, getUserContentUri } from '../utilities/content';
import AreaOptionsModal, { ISelectionType } from '../components/Modals/AreaOptionsModal';
import { getReactionUpdateArgs } from '../utilities/reactions';
import getDirections from '../utilities/getDirections';
import TherrIcon from '../components/TherrIcon';
import WrapperModal from '../components/Modals/WrapperModal';
import { Switch } from 'react-native';
import RoundInput from '../components/Input/Round';
// import AccentInput from '../components/Input/Accent';

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

// Regular component props
export interface IViewEventProps extends IStoreProps {
    navigation: any;
    route: any;
}

interface IViewEventState {
    areAreaOptionsVisible: boolean;
    errorMsg: string;
    guestCount: string;
    successMsg: string;
    isDeleting: boolean;
    isAttendingModalVisible: boolean;
    isVerifyingDelete: boolean;
    myReaction: any;
    fetchedEvent: any;
    previewLinkId?: string;
    previewStyleState: any;
    selectedEvent: any;
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

export class ViewEvent extends React.Component<IViewEventProps, IViewEventState> {
    private date;
    private notificationMsg;
    private hashtags;
    private scrollViewRef;
    private translate: Function;
    private unsubscribeNavListener;
    private theme = buildStyles();
    private themeAccentLayout = buildAccentStyles();
    private themeButtons = buildButtonsStyles();
    private themeArea = buildEventStyles();
    private themeReactionsModal = buildReactionsModalStyles();
    private themeForms = buildFormStyles();
    private themeAccentForms = buildAccentFormStyles();
    private themeModal = buildModalStyles();

    constructor(props) {
        super(props);

        const { route } = props;
        const { event } = route.params;

        const youtubeMatches = (event.message || '').match(youtubeLinkRegex);

        this.state = {
            areAreaOptionsVisible: false,
            errorMsg: '',
            guestCount: '',
            successMsg: '',
            isDeleting: false,
            isAttendingModalVisible: false,
            isVerifyingDelete: false,
            myReaction: {},
            fetchedEvent: {},
            previewStyleState: {},
            previewLinkId: youtubeMatches && youtubeMatches[1],
            selectedEvent: {},
        };

        this.theme = buildStyles(props.user.settings?.mobileThemeName);
        this.themeButtons = buildButtonsStyles(props.user.settings?.mobileThemeName);
        this.themeAccentLayout = buildAccentStyles(props.user.settings?.mobileThemeName);
        this.themeArea = buildEventStyles(props.user.settings?.mobileThemeName, true);
        this.themeReactionsModal = buildReactionsModalStyles(props.user.settings?.mobileThemeName);
        this.themeForms = buildFormStyles(props.user.settings?.mobileThemeName);
        this.themeAccentForms = buildAccentFormStyles(props.user.settings?.mobileThemeName);
        this.themeModal = buildModalStyles(props.user.settings?.mobileThemeName);
        this.translate = (key: string, params: any) => translator('en-us', key, params);

        this.notificationMsg = (event.notificationMsg || '').replace(/\r?\n+|\r+/gm, ' ');
        this.hashtags = event.hashTags ? event.hashTags.split(',') : [];

        const dateTime = formatDate(event.updatedAt);
        this.date = !dateTime.date ? '' : `${dateTime.date} | ${dateTime.time}`;

        // changeNavigationBarColor(therrTheme.colors.accent1, false, true);
    }

    componentDidMount() {
        const { content, getEventDetails, navigation, route } = this.props;
        const { event } = route.params;

        const shouldFetchUser = !event?.fromUserMedia || !event.fromUserName;
        const mediaPath = event.medias?.[0]?.path;
        const eventMedia = content?.media[mediaPath];

        // Move event details out of route params and into redux
        getEventDetails(event.id, {
            withMedia: !eventMedia,
            withUser: shouldFetchUser,
        }).then((data) => {
            if (data?.event?.notificationMsg) {
                this.notificationMsg = (data?.event?.notificationMsg || '').replace(/\r?\n+|\r+/gm, ' ');
                navigation.setOptions({
                    title: this.notificationMsg,
                });
            }
            this.setState({
                fetchedEvent: data?.event,
            });
        });

        ReactionsService.getEventReactions({
            eventId: event.id,
        }).then((response) => {
            const attendingCount = response.data?.attendingCount || 0;
            const reaction = {
                ...response.data,
                attendingCount,
            };
            this.setState({
                myReaction: reaction,
                guestCount: (attendingCount < 1)
                    ? '0'
                    : `${attendingCount - 1}`,
            });
        });

        navigation.setOptions({
            title: this.notificationMsg,
        });

        this.unsubscribeNavListener = navigation.addListener('beforeRemove', () => {
            // changeNavigationBarColor(therrTheme.colors.primary, false, true);
        });
    }

    componentWillUnmount() {
        this.unsubscribeNavListener();
    }

    renderHashtagPill = (tag, key) => {
        return (
            <Button
                key={key}
                buttonStyle={this.themeForms.styles.buttonPill}
                containerStyle={this.themeForms.styles.buttonPillContainer}
                titleStyle={this.themeForms.styles.buttonPillTitle}
                title={`#${tag}`}
            />
        );
    };

    handlePreviewFullScreen = (isFullScreen) => {
        const previewStyleState = isFullScreen ? {
            top: 0,
            left: 0,
            padding: 0,
            margin: 0,
            position: 'absolute',
            zIndex: 20,
        } : {};
        this.setState({
            previewStyleState,
        });
    };

    onCloseAttendingModal = () => {
        this.setState({
            isAttendingModalVisible: false,
        });
    };

    onDelete = () => {
        this.setState({
            isVerifyingDelete: true,
        });
    };

    onDeleteCancel = () => {
        this.setState({
            isVerifyingDelete: false,
        });
    };

    onDeleteConfirm = () => {
        const { deleteEvent, navigation, route, user } = this.props;
        const { event } = route.params;

        this.setState({
            isDeleting: true,
        });
        if (checkIsMyEvent(event, user)) {
            deleteEvent({ ids: [event.id] })
                .then(() => {
                    navigation.navigate('Map', {
                        shouldShowPreview: false,
                    });
                })
                .catch((err) => {
                    console.log('Error deleting event', err);
                    this.setState({
                        isDeleting: true,
                        isVerifyingDelete: false,
                    });
                });
        }
    };

    onEventOptionSelect = (type: ISelectionType) => {
        const { selectedEvent } = this.state;

        if (type === 'getDirections') {
            getDirections({
                latitude: selectedEvent.latitude,
                longitude: selectedEvent.longitude,
                title: selectedEvent.notificationMsg,
            });
        } else if (type === 'shareALink') {
            Share.share({
                message: this.translate('modals.contentOptions.shareLink.messageEvent', {
                    eventId: selectedEvent.id,
                }),
                url: `https://www.therr.com/events/${selectedEvent.id}`,
                title: this.translate('modals.contentOptions.shareLink.titleEvent', {
                    eventTitle: selectedEvent.notificationMsg,
                }),
            }).then((response) => {
                if (response.action === Share.sharedAction) {
                    if (response.activityType) {
                        // shared with activity type of response.activityType
                    } else {
                        // shared
                    }
                } else if (response.action === Share.dismissedAction) {
                    // dismissed
                }
            }).catch((err) => {
                console.error(err);
            });
        } else {
            const requestArgs: any = getReactionUpdateArgs(type);

            this.onUpdateEventReaction(selectedEvent.id, requestArgs).finally(() => {
                this.toggleAreaOptions();
            });
        }
    };

    goBack = () => {
        const { navigation, route } = this.props;
        const { previousView } = route.params;
        if (previousView && (previousView === 'Areas' || previousView === 'Notifications')) {
            if (previousView === 'Areas') {
                navigation.goBack();
            } else if (previousView === 'Notifications') {
                navigation.navigate('Notifications');
            }
        } else {
            navigation.navigate('Map', {
                shouldShowPreview: false,
            });
        }
    };

    goToViewMap = (lat, long) => {
        const { navigation } = this.props;

        navigation.replace('Map', {
            latitude: lat,
            longitude: long,
        });
    };

    goToViewSpace = (event) => {
        const { navigation, user } = this.props;

        if (event.spaceId) {
            navigation.navigate('ViewSpace', {
                isMyContent: event.space?.fromUserId === user.details.id,
                previousView: 'Areas',
                space: {
                    id: event.spaceId,
                },
                spaceDetails: {},
            });
        }
    };

    goToViewUser = (userId) => {
        const { navigation } = this.props;

        navigation.navigate('ViewUser', {
            userInView: {
                id: userId,
            },
        });
    };

    onUpdateEventReaction = (eventId, data) => {
        const { createOrUpdateEventReaction, navigation, route, user } = this.props;
        const { event } = route.params;
        navigation.setParams({
            event: {
                ...event,
                reaction: {
                    ...event.reaction,
                    ...data,
                },
            },
        });
        return createOrUpdateEventReaction(eventId, data, event.fromUserId, user.details.userName);
    };

    toggleAreaOptions = (displayArea?: any) => {
        const { areAreaOptionsVisible, fetchedEvent } = this.state;
        const { event } = this.props.route.params;
        const area = {
            ...event,
            ...fetchedEvent,
        };

        this.setState({
            areAreaOptionsVisible: !areAreaOptionsVisible,
            selectedEvent: areAreaOptionsVisible ? {} : (area || displayArea),
        });
    };

    onAttendingChange = (isAttending: boolean) => {
        const { guestCount } = this.state;
        const attendingCount = isAttending ? 1 : 0;

        this.setState({
            guestCount: !isAttending ? '0' : guestCount,
            myReaction: {
                ...this.state.myReaction,
                attendingCount,
            },
        });
    };

    onAttendingGuestsInputChange = (count: string) => {
        const { myReaction } = this.state;
        const currentAttendingCount = myReaction.attendingCount;
        if (!count || count === '0' || count[0] === '0') {
            this.setState({
                guestCount: '',
            });
            if (currentAttendingCount > 1) {
                this.setState({
                    myReaction: {
                        ...this.state.myReaction,
                        attendingCount: 1,
                    },
                });
            }
            return;
        }
        if (!/^\d+$/.test(count)) {
            return;
        }
        const guests = parseInt(count, 10);
        const sanitizedGuests = guests > 20 ? 20 : guests;
        this.setState({
            guestCount: sanitizedGuests.toString(),
            myReaction: {
                ...this.state.myReaction,
                attendingCount: 1 + sanitizedGuests,
            },
        });
    };

    onAttendingSave = () => {
        const { fetchedEvent, myReaction } = this.state;
        const { event } = this.props.route.params;
        const area = {
            ...event,
            ...fetchedEvent,
        };
        const attendingCount = myReaction.attendingCount;
        this.onUpdateEventReaction(area.id, {
            attendingCount,
        });
        this.setState({
            isAttendingModalVisible: false,
        });
    };

    toggleAttendingModal = () => {
        const { isAttendingModalVisible } = this.state;

        this.setState({
            isAttendingModalVisible: !isAttendingModalVisible,
        });
    };

    render() {
        const {
            areAreaOptionsVisible,
            fetchedEvent,
            guestCount,
            isAttendingModalVisible,
            isDeleting,
            isVerifyingDelete,
            myReaction,
            previewLinkId,
            previewStyleState,
        } = this.state;
        const { content, route, user } = this.props;
        const { event, isMyContent } = route.params;
        const eventInView = {
            ...event,
            ...fetchedEvent,
        };
        const eventUserName = isMyContent ? user.details.userName : eventInView.fromUserName;
        const eventUserMedia = isMyContent ? user.details.media : (eventInView.fromUserMedia || {});
        const eventUserIsSuperUser = isMyContent ? user.details.isSuperUser : (eventInView.fromUserIsSuperUser || {});
        // Use the cacheable api-gateway media endpoint when image is public otherwise fallback to signed url
        const mediaPath = eventInView.medias?.[0]?.path;
        const mediaType = eventInView.medias?.[0]?.type;
        const eventMedia = mediaPath && mediaType === Content.mediaTypes.USER_IMAGE_PUBLIC
            ? getUserContentUri(eventInView.medias?.[0], screenWidth, screenWidth)
            : content?.media[mediaPath];

        return (
            <>
                <BaseStatusBar therrThemeName={this.props.user.settings?.mobileThemeName}/>
                <SafeAreaView  style={this.theme.styles.safeAreaView}>
                    <KeyboardAwareScrollView
                        contentInsetAdjustmentBehavior="automatic"
                        ref={(component) => (this.scrollViewRef = component)}
                        style={[this.theme.styles.bodyFlex, this.themeAccentLayout.styles.bodyView]}
                        contentContainerStyle={[this.theme.styles.bodyScroll, this.themeAccentLayout.styles.bodyViewScroll]}
                    >
                        <View style={[this.themeAccentLayout.styles.container, this.themeArea.styles.areaContainer]}>
                            <AreaDisplay
                                translate={this.translate}
                                toggleAreaOptions={this.toggleAreaOptions}
                                toggleAttendingModal={this.toggleAttendingModal}
                                hashtags={this.hashtags}
                                isDarkMode={user.settings?.mobileThemeName === 'retro'}
                                isExpanded={true}
                                inspectContent={() => null}
                                myReaction={myReaction}
                                area={eventInView}
                                goToViewMap={this.goToViewMap}
                                goToViewSpace={this.goToViewSpace}
                                goToViewUser={this.goToViewUser}
                                updateAreaReaction={this.onUpdateEventReaction}
                                // TODO: User Username from response
                                user={user}
                                areaUserDetails={{
                                    media: eventUserMedia,
                                    userName: eventUserName || this.translate('alertTitles.nameUnknown') || '',
                                    isSuperUser: eventUserIsSuperUser,
                                }}
                                areaMedia={eventMedia}
                                theme={this.theme}
                                themeForms={this.themeForms}
                                themeViewArea={this.themeArea}
                            />
                        </View>
                        {
                            previewLinkId
                            && <View style={[userContentStyles.preview, previewStyleState]}>
                                <YoutubePlayer
                                    height={260}
                                    play={false}
                                    videoId={previewLinkId}
                                    onFullScreenChange={this.handlePreviewFullScreen}
                                />
                            </View>
                        }
                    </KeyboardAwareScrollView>
                    {
                        <View style={[this.themeAccentLayout.styles.footer, this.themeArea.styles.footer]}>
                            <Button
                                containerStyle={this.themeAccentForms.styles.backButtonContainer}
                                buttonStyle={this.themeAccentForms.styles.backButton}
                                onPress={() => this.goBack()}
                                icon={
                                    <TherrIcon
                                        name="go-back"
                                        size={25}
                                        color={'black'}
                                    />
                                }
                                type="clear"
                            />
                            {
                                isMyContent &&
                                <>
                                    {
                                        !isVerifyingDelete &&
                                            <Button
                                                buttonStyle={this.themeAccentForms.styles.submitDeleteButton}
                                                disabledStyle={this.themeAccentForms.styles.submitButtonDisabled}
                                                disabledTitleStyle={this.themeAccentForms.styles.submitDisabledButtonTitle}
                                                titleStyle={this.themeAccentForms.styles.submitButtonTitle}
                                                containerStyle={this.themeAccentForms.styles.submitButtonContainer}
                                                title={this.translate(
                                                    'forms.editEvent.buttons.delete'
                                                )}
                                                icon={
                                                    <FontAwesome5Icon
                                                        name="trash-alt"
                                                        size={25}
                                                        color={'black'}
                                                        style={this.themeAccentForms.styles.submitButtonIcon}
                                                    />
                                                }
                                                onPress={this.onDelete}
                                                raised={true}
                                            />
                                    }
                                    {
                                        isVerifyingDelete &&
                                        <View style={this.themeAccentForms.styles.submitConfirmContainer}>
                                            <Button
                                                buttonStyle={this.themeAccentForms.styles.submitCancelButton}
                                                disabledStyle={this.themeAccentForms.styles.submitButtonDisabled}
                                                disabledTitleStyle={this.themeAccentForms.styles.submitDisabledButtonTitle}
                                                titleStyle={this.themeAccentForms.styles.submitButtonTitle}
                                                containerStyle={this.themeAccentForms.styles.submitCancelButtonContainer}
                                                title={this.translate(
                                                    'forms.editEvent.buttons.cancel'
                                                )}
                                                onPress={this.onDeleteCancel}
                                                disabled={isDeleting}
                                                raised={true}
                                            />
                                            <Button
                                                buttonStyle={this.themeAccentForms.styles.submitConfirmButton}
                                                disabledStyle={this.themeAccentForms.styles.submitButtonDisabled}
                                                disabledTitleStyle={this.themeAccentForms.styles.submitDisabledButtonTitle}
                                                titleStyle={this.themeAccentForms.styles.submitButtonTitleLight}
                                                containerStyle={this.themeAccentForms.styles.submitButtonContainer}
                                                title={this.translate(
                                                    'forms.editEvent.buttons.confirm'
                                                )}
                                                onPress={this.onDeleteConfirm}
                                                disabled={isDeleting}
                                                raised={true}
                                            />
                                        </View>
                                    }
                                </>
                            }
                        </View>
                    }
                </SafeAreaView>
                <AreaOptionsModal
                    isVisible={areAreaOptionsVisible}
                    onRequestClose={this.toggleAreaOptions}
                    translate={this.translate}
                    onSelect={this.onEventOptionSelect}
                    themeButtons={this.themeButtons}
                    themeReactionsModal={this.themeReactionsModal}
                    shouldIncludeShareButton={true}
                />
                <WrapperModal
                    isVisible={isAttendingModalVisible}
                    onRequestClose={this.onCloseAttendingModal}
                    themeModal={this.themeModal}
                >
                    <View style={this.themeModal.styles.header}>
                        <Text style={this.themeModal.styles.headerText}>{this.translate('forms.editEvent.modal.attendingModal.title')}</Text>
                    </View>
                    <View style={this.themeModal.styles.buttonsWrapper}>
                        <View
                            style={[
                                this.themeForms.styles.switchSubContainer,
                                spacingStyles.fullWidth,
                                spacingStyles.flex,
                                spacingStyles.justifyCenter,
                                spacingStyles.padBotXlg,
                            ]}
                        >
                            <Text
                                style={[
                                    this.themeModal.styles.label,
                                    {
                                        fontWeight: myReaction?.attendingCount < 1 ? '800' : '400',
                                    },
                                ]}
                            >
                                {this.translate('forms.editEvent.modal.attendingModal.labels.no')}
                            </Text>
                            <Switch
                                style={[
                                    this.themeForms.styles.switchButton,
                                    spacingStyles.marginLtLg,
                                    spacingStyles.marginRtLg,
                                ]}
                                trackColor={{ false: this.theme.colors.primary2, true: this.theme.colors.primary4 }}
                                thumbColor={myReaction?.attendingCount > 0 ? this.theme.colors.primary3 : this.theme.colorVariations.primary3Fade}
                                ios_backgroundColor={this.theme.colors.primary4}
                                onValueChange={this.onAttendingChange}
                                value={myReaction?.attendingCount > 0}
                            />
                            <Text
                                style={[
                                    this.themeModal.styles.label,
                                    {
                                        fontWeight: myReaction?.attendingCount > 0 ? '800' : '400',
                                    },
                                ]}
                            >
                                {this.translate('forms.editEvent.modal.attendingModal.labels.yes')}
                            </Text>
                        </View>
                        <Text
                            style={[
                                this.themeModal.styles.label,
                                spacingStyles.padBotMd,
                            ]}
                        >
                            {this.translate('forms.editEvent.modal.attendingModal.labels.bringingGuests')}
                        </Text>
                        <RoundInput
                            maxLength={100}
                            placeholder={this.translate(
                                'forms.editEvent.modal.attendingModal.labels.guests'
                            )}
                            value={guestCount}
                            onChangeText={this.onAttendingGuestsInputChange}
                            themeForms={this.themeForms}
                        />
                        <Button
                            containerStyle={[this.themeForms.styles.buttonContainer, spacingStyles.fullWidth]}
                            buttonStyle={[
                                this.themeForms.styles.button,
                                {
                                    backgroundColor: this.themeForms.colors.accent3,
                                },
                            ]}
                            titleStyle={this.themeForms.styles.buttonTitle}
                            title={this.translate(
                                'forms.editEvent.modal.attendingModal.buttons.save'
                            )}
                            // icon={<FontAwesome5Icon
                            //     name="check"
                            //     size={22}
                            //     style={this.themeForms.styles.buttonIcon}
                            // />}
                            onPress={this.onAttendingSave}
                            raised={true}
                        />
                    </View>
                </WrapperModal>
            </>
        );
    }
}

export default connect(mapStateToProps, mapDispatchToProps)(ViewEvent);
