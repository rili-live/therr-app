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
import formStyles, { accentEditForm as accentFormStyles } from '../styles/forms';
import accentLayoutStyles from '../styles/layouts/accent';
import userContentStyles from '../styles/user-content';
import { viewing as viewMomentStyles } from '../styles/user-content/moments';
import { youtubeLinkRegex } from '../constants';
import AreaDisplay from '../components/UserContent/AreaDisplay';
import formatDate from '../utilities/formatDate';
import BaseStatusBar from '../components/BaseStatusBar';
import { isMyArea as checkIsMyMoment } from '../utilities/content';
import AreaOptionsModal, { ISelectionType } from '../components/Modals/AreaOptionsModal';
import { getReactionUpdateArgs } from '../utilities/reactions';
// import * as therrTheme from '../styles/themes';
// import formStyles, { settingsForm as settingsFormStyles } from '../styles/forms';
// import AccentInput from '../components/Input/Accent';

interface IMomentDetails {
    userDetails?: any;
}

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
    private themeReactionsModal = buildReactionsModalStyles();

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
            previewStyleState: {},
            previewLinkId: youtubeMatches && youtubeMatches[1],
            selectedMoment: {},
        };

        this.theme = buildStyles(props.user.settings.mobileThemeName);
        this.themeReactionsModal = buildReactionsModalStyles(props.user.settings.mobileThemeName);
        this.translate = (key: string, params: any) => translator('en-us', key, params);

        this.notificationMsg = (moment.notificationMsg || '').replace(/\r?\n+|\r+/gm, ' ');
        this.hashtags = moment.hashTags ? moment.hashTags.split(',') : [];

        this.date = formatDate(moment.updatedAt);

        // changeNavigationBarColor(therrTheme.colors.accent1, false, true);
    }

    componentDidMount() {
        const { content, getMomentDetails, navigation, route, user } = this.props;
        const { isMyArea, moment } = route.params;

        const momentUserName = isMyArea ? user.details.userName : moment.fromUserName;
        const mediaId = (moment.media && moment.media[0]?.id) || (moment.mediaIds?.length && moment.mediaIds?.split(',')[0]);
        const momentMedia = content?.media[mediaId];

        // Move moment details out of route params and into redux
        getMomentDetails(moment.id, {
            withMedia: !momentMedia,
            withUser: !momentUserName,
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
                buttonStyle={formStyles.buttonPill}
                containerStyle={formStyles.buttonPillContainer}
                titleStyle={formStyles.buttonPillTitle}
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
    }

    onDelete = () => {
        this.setState({
            isVerifyingDelete: true,
        });
    }

    onDeleteCancel = () => {
        this.setState({
            isVerifyingDelete: false,
        });
    }

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
    }

    onMomentOptionSelect = (type: ISelectionType) => {
        const { selectedMoment } = this.state;
        const { createOrUpdateMomentReaction, user } = this.props;
        const requestArgs: any = getReactionUpdateArgs(type);

        createOrUpdateMomentReaction(selectedMoment.id, requestArgs, selectedMoment.fromUserId, user.details.userName).finally(() => {
            this.toggleAreaOptions(selectedMoment);
        });
    }

    goBack = () => {
        const { navigation, route } = this.props;
        const { previousView } = route.params;
        if (previousView && previousView === 'Areas') {
            navigation.goBack();
        } else {
            navigation.navigate('Map');
        }
    }

    goToViewUser = (userId) => {
        const { navigation } = this.props;

        navigation.navigate('ViewUser', {
            userInView: {
                id: userId,
            },
        });
    }

    onUpdateMomentReaction = (momentId, data) => {
        const { createOrUpdateMomentReaction, navigation, route, user } = this.props;
        const { moment } = route.params;
        navigation.setParams({
            moment: {
                ...moment,
                reaction: {
                    ...moment.reaction,
                    userBookmarkCategory: !!moment.reaction?.userBookmarkCategory ? null : 'Uncategorized',
                },
            },
        });
        return createOrUpdateMomentReaction(momentId, data, moment.fromUserId, user.details.userName);
    }

    toggleAreaOptions = (area) => {
        const { areAreaOptionsVisible } = this.state;

        this.setState({
            areAreaOptionsVisible: !areAreaOptionsVisible,
            selectedMoment: areAreaOptionsVisible ? {} : area,
        });
    }

    render() {
        const { areAreaOptionsVisible, isDeleting, isVerifyingDelete, previewLinkId, previewStyleState, selectedMoment } = this.state;
        const { content, route, user } = this.props;
        const { moment, isMyArea } = route.params;
        // TODO: Fetch moment media
        const mediaId = (moment.media && moment.media[0]?.id) || (moment.mediaIds?.length && moment.mediaIds?.split(',')[0]);
        const momentMedia = content?.media[mediaId];
        const momentUserName = isMyArea ? user.details.userName : moment.fromUserName;

        return (
            <>
                <BaseStatusBar />
                <SafeAreaView  style={this.theme.styles.safeAreaView}>
                    <KeyboardAwareScrollView
                        contentInsetAdjustmentBehavior="automatic"
                        ref={(component) => (this.scrollViewRef = component)}
                        style={[this.theme.styles.bodyFlex, accentLayoutStyles.bodyView]}
                        contentContainerStyle={[this.theme.styles.bodyScroll, accentLayoutStyles.bodyViewScroll]}
                    >
                        <View style={[accentLayoutStyles.container, viewMomentStyles.areaContainer]}>
                            <AreaDisplay
                                translate={this.translate}
                                date={this.date}
                                toggleAreaOptions={() => this.toggleAreaOptions(moment)}
                                hashtags={this.hashtags}
                                isDarkMode={true}
                                isExpanded={true}
                                area={moment}
                                goToViewUser={this.goToViewUser}
                                updateAreaReaction={(momentId, data) => this.onUpdateMomentReaction(momentId, data)}
                                // TODO: User Username from response
                                user={user}
                                userDetails={{
                                    userName: momentUserName || moment.fromUserId,
                                }}
                                areaMedia={momentMedia}
                                theme={this.theme}
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
                        <View style={[accentLayoutStyles.footer, viewMomentStyles.footer]}>
                            <Button
                                containerStyle={accentFormStyles.backButtonContainer}
                                buttonStyle={accentFormStyles.backButton}
                                onPress={() => this.goBack()}
                                icon={
                                    <FontAwesome5Icon
                                        name="arrow-left"
                                        size={25}
                                        color={'black'}
                                    />
                                }
                                type="clear"
                            />
                            {
                                isMyArea &&
                                <>
                                    {
                                        !isVerifyingDelete &&
                                            <Button
                                                buttonStyle={accentFormStyles.submitDeleteButton}
                                                disabledStyle={accentFormStyles.submitButtonDisabled}
                                                disabledTitleStyle={accentFormStyles.submitDisabledButtonTitle}
                                                titleStyle={accentFormStyles.submitButtonTitle}
                                                containerStyle={accentFormStyles.submitButtonContainer}
                                                title={this.translate(
                                                    'forms.editMoment.buttons.delete'
                                                )}
                                                icon={
                                                    <FontAwesome5Icon
                                                        name="trash-alt"
                                                        size={25}
                                                        color={'black'}
                                                        style={accentFormStyles.submitButtonIcon}
                                                    />
                                                }
                                                onPress={this.onDelete}
                                                raised={true}
                                            />
                                    }
                                    {
                                        isVerifyingDelete &&
                                        <View style={accentFormStyles.submitConfirmContainer}>
                                            <Button
                                                buttonStyle={accentFormStyles.submitCancelButton}
                                                disabledStyle={accentFormStyles.submitButtonDisabled}
                                                disabledTitleStyle={accentFormStyles.submitDisabledButtonTitle}
                                                titleStyle={accentFormStyles.submitButtonTitle}
                                                containerStyle={accentFormStyles.submitCancelButtonContainer}
                                                title={this.translate(
                                                    'forms.editMoment.buttons.cancel'
                                                )}
                                                onPress={this.onDeleteCancel}
                                                disabled={isDeleting}
                                                raised={true}
                                            />
                                            <Button
                                                buttonStyle={accentFormStyles.submitConfirmButton}
                                                disabledStyle={accentFormStyles.submitButtonDisabled}
                                                disabledTitleStyle={accentFormStyles.submitDisabledButtonTitle}
                                                titleStyle={accentFormStyles.submitButtonTitleLight}
                                                containerStyle={accentFormStyles.submitButtonContainer}
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
                    onRequestClose={() => this.toggleAreaOptions(selectedMoment)}
                    translate={this.translate}
                    onSelect={this.onMomentOptionSelect}
                    themeReactionsModal={this.themeReactionsModal}
                />
            </>
        );
    }
}

export default connect(mapStateToProps, mapDispatchToProps)(ViewMoment);
