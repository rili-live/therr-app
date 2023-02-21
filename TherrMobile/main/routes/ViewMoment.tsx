import React from 'react';
import {
    SafeAreaView,
    View,
} from 'react-native';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import { Button } from 'react-native-elements';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
// import { Button }  from 'react-native-elements';
// import changeNavigationBarColor from 'react-native-navigation-bar-color';
import { IContentState, IUserState } from 'therr-react/types';
import { ContentActions, MapActions } from 'therr-react/redux/actions';
import FontAwesome5Icon from 'react-native-vector-icons/FontAwesome5';
import YoutubePlayer from 'react-native-youtube-iframe';
// import Alert from '../components/Alert';
import translator from '../services/translator';
import { buildStyles } from '../styles';
import { buildStyles as buildReactionsModalStyles } from '../styles/modal/areaReactionsModal';
import { buildStyles as buildFormStyles } from '../styles/forms';
import { buildStyles as buildAccentFormStyles } from '../styles/forms/accentEditForm';
import { buildStyles as buildAccentStyles } from '../styles/layouts/accent';
import { buildStyles as buildButtonsStyles } from '../styles/buttons';
import { buildStyles as buildMomentStyles } from '../styles/user-content/areas/viewing';
import userContentStyles from '../styles/user-content';
import { youtubeLinkRegex } from '../constants';
import AreaDisplay from '../components/UserContent/AreaDisplay';
import formatDate from '../utilities/formatDate';
import BaseStatusBar from '../components/BaseStatusBar';
import { isMyContent as checkIsMyMoment } from '../utilities/content';
import AreaOptionsModal, { ISelectionType } from '../components/Modals/AreaOptionsModal';
import { getReactionUpdateArgs } from '../utilities/reactions';
import getDirections from '../utilities/getDirections';
import TherrIcon from '../components/TherrIcon';
// import AccentInput from '../components/Input/Accent';

interface IViewMomentDispatchProps {
    getMomentDetails: Function;
    deleteMoment: Function;
    createOrUpdateMomentReaction: Function;
}

interface IStoreProps extends IViewMomentDispatchProps {
    content: IContentState;
    user: IUserState;
}

// Regular component props
export interface IViewMomentProps extends IStoreProps {
    navigation: any;
    route: any;
}

interface IViewMomentState {
    areAreaOptionsVisible: boolean;
    errorMsg: string;
    successMsg: string;
    isDeleting: boolean;
    isVerifyingDelete: boolean;
    fetchedMoment: any;
    previewLinkId?: string;
    previewStyleState: any;
    selectedMoment: any;
}

const mapStateToProps = (state) => ({
    content: state.content,
    user: state.user,
});

const mapDispatchToProps = (dispatch: any) => bindActionCreators({
    getMomentDetails: MapActions.getMomentDetails,
    deleteMoment: MapActions.deleteMoment,
    createOrUpdateMomentReaction: ContentActions.createOrUpdateMomentReaction,
}, dispatch);

export class ViewMoment extends React.Component<IViewMomentProps, IViewMomentState> {
    private date;
    private notificationMsg;
    private hashtags;
    private scrollViewRef;
    private translate: Function;
    private unsubscribeNavListener;
    private theme = buildStyles();
    private themeAccentLayout = buildAccentStyles();
    private themeButtons = buildButtonsStyles();
    private themeArea = buildMomentStyles();
    private themeReactionsModal = buildReactionsModalStyles();
    private themeForms = buildFormStyles();
    private themeAccentForms = buildAccentFormStyles();

    constructor(props) {
        super(props);

        const { route } = props;
        const { moment } = route.params;

        const youtubeMatches = (moment.message || '').match(youtubeLinkRegex);

        this.state = {
            areAreaOptionsVisible: false,
            errorMsg: '',
            successMsg: '',
            isDeleting: false,
            isVerifyingDelete: false,
            fetchedMoment: {},
            previewStyleState: {},
            previewLinkId: youtubeMatches && youtubeMatches[1],
            selectedMoment: {},
        };

        this.theme = buildStyles(props.user.settings?.mobileThemeName);
        this.themeButtons = buildButtonsStyles(props.user.settings?.mobileThemeName);
        this.themeAccentLayout = buildAccentStyles(props.user.settings?.mobileThemeName);
        this.themeArea = buildMomentStyles(props.user.settings?.mobileThemeName, true);
        this.themeReactionsModal = buildReactionsModalStyles(props.user.settings?.mobileThemeName);
        this.themeForms = buildFormStyles(props.user.settings?.mobileThemeName);
        this.themeAccentForms = buildAccentFormStyles(props.user.settings?.mobileThemeName);
        this.translate = (key: string, params: any) => translator('en-us', key, params);

        this.notificationMsg = (moment.notificationMsg || '').replace(/\r?\n+|\r+/gm, ' ');
        this.hashtags = moment.hashTags ? moment.hashTags.split(',') : [];

        this.date = formatDate(moment.updatedAt);

        // changeNavigationBarColor(therrTheme.colors.accent1, false, true);
    }

    componentDidMount() {
        const { content, getMomentDetails, navigation, route, user } = this.props;
        const { isMyContent, moment } = route.params;

        const momentUserName = isMyContent ? user.details.userName : moment.fromUserName;
        const mediaId = (moment.media && moment.media[0]?.id) || (moment.mediaIds?.length && moment.mediaIds?.split(',')[0]);
        const momentMedia = content?.media[mediaId];

        // Move moment details out of route params and into redux
        getMomentDetails(moment.id, {
            withMedia: !momentMedia,
            withUser: !momentUserName,
        }).then((data) => {
            this.setState({
                fetchedMoment: data?.moment,
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
        const { deleteMoment, navigation, route, user } = this.props;
        const { moment } = route.params;

        this.setState({
            isDeleting: true,
        });
        if (checkIsMyMoment(moment, user)) {
            deleteMoment({ ids: [moment.id] })
                .then(() => {
                    navigation.navigate('Map');
                })
                .catch((err) => {
                    console.log('Error deleting moment', err);
                    this.setState({
                        isDeleting: true,
                        isVerifyingDelete: false,
                    });
                });
        }
    };

    onMomentOptionSelect = (type: ISelectionType) => {
        const { selectedMoment } = this.state;

        if (type === 'getDirections') {
            getDirections({
                latitude: selectedMoment.latitude,
                longitude: selectedMoment.longitude,
                title: selectedMoment.notificationMsg,
            });
        } else {
            const requestArgs: any = getReactionUpdateArgs(type);

            this.onUpdateMomentReaction(selectedMoment.id, requestArgs).finally(() => {
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
            navigation.navigate('Map');
        }
    };

    goToViewMap = (lat, long) => {
        const { navigation } = this.props;

        navigation.replace('Map', {
            latitude: lat,
            longitude: long,
        });
    };

    goToViewUser = (userId) => {
        const { navigation } = this.props;

        navigation.navigate('ViewUser', {
            userInView: {
                id: userId,
            },
        });
    };

    onUpdateMomentReaction = (momentId, data) => {
        const { createOrUpdateMomentReaction, navigation, route, user } = this.props;
        const { moment } = route.params;
        navigation.setParams({
            moment: {
                ...moment,
                reaction: {
                    ...moment.reaction,
                    ...data,
                },
            },
        });
        return createOrUpdateMomentReaction(momentId, data, moment.fromUserId, user.details.userName);
    };

    toggleAreaOptions = () => {
        const { areAreaOptionsVisible, fetchedMoment } = this.state;
        const { moment } = this.props.route.params;
        const area = {
            ...moment,
            ...fetchedMoment,
        };

        this.setState({
            areAreaOptionsVisible: !areAreaOptionsVisible,
            selectedMoment: areAreaOptionsVisible ? {} : area,
        });
    };

    render() {
        const {
            areAreaOptionsVisible,
            fetchedMoment,
            isDeleting,
            isVerifyingDelete,
            previewLinkId,
            previewStyleState,
        } = this.state;
        const { content, route, user } = this.props;
        const { moment, isMyContent } = route.params;
        // TODO: Fetch moment media
        const mediaId = (moment.media && moment.media[0]?.id) || (moment.mediaIds?.length && moment.mediaIds?.split(',')[0]);
        const momentMedia = content?.media[mediaId];
        const momentInView = {
            ...moment,
            ...fetchedMoment,
        };
        const momentUserName = isMyContent ? user.details.userName : momentInView.fromUserName;

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
                                date={this.date}
                                toggleAreaOptions={this.toggleAreaOptions}
                                hashtags={this.hashtags}
                                isDarkMode={true}
                                isExpanded={true}
                                inspectContent={() => null}
                                area={momentInView}
                                goToViewMap={this.goToViewMap}
                                goToViewUser={this.goToViewUser}
                                updateAreaReaction={this.onUpdateMomentReaction}
                                // TODO: User Username from response
                                user={user}
                                areaUserDetails={{
                                    userName: momentUserName || momentInView.fromUserId,
                                }}
                                areaMedia={momentMedia}
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
                                                    'forms.editMoment.buttons.delete'
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
                                                    'forms.editMoment.buttons.cancel'
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
                                                    'forms.editMoment.buttons.confirm'
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
                    onSelect={this.onMomentOptionSelect}
                    themeButtons={this.themeButtons}
                    themeReactionsModal={this.themeReactionsModal}
                />
            </>
        );
    }
}

export default connect(mapStateToProps, mapDispatchToProps)(ViewMoment);
