import React from 'react';
import {
    SafeAreaView,
    View,
    StatusBar,
} from 'react-native';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import { Button } from 'react-native-elements';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
// import { Button }  from 'react-native-elements';
import { IContentState, IUserState } from 'therr-react/types';
import { MapActions } from 'therr-react/redux/actions';
import FontAwesome5Icon from 'react-native-vector-icons/FontAwesome5';
import YoutubePlayer from 'react-native-youtube-iframe';
// import Alert from '../components/Alert';
import translator from '../services/translator';
import styles from '../styles';
import formStyles, { beemoEditForm as beemoFormStyles } from '../styles/forms';
import beemoLayoutStyles from '../styles/layouts/beemo';
import userContentStyles from '../styles/user-content';
import { viewing as viewMomentStyles } from '../styles/user-content/moments';
import { youtubeLinkRegex } from '../constants';
import MomentDisplay from '../components/UserContent/MomentDisplay';
import formatDate from '../utilities/formatDate';
// import * as therrTheme from '../styles/themes';
// import formStyles, { settingsForm as settingsFormStyles } from '../styles/forms';
// import BeemoInput from '../components/Input/Beemo';

export const DEFAULT_RADIUS = 10;

interface IMomentDetails {
    userDetails?: any;
}

interface IViewMomentDispatchProps {
    deleteMoment: Function;
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
    errorMsg: string;
    successMsg: string;
    isDeleting: boolean;
    isVerifyingDelete: boolean;
    previewLinkId?: string;
    previewStyleState: any;
}

const mapStateToProps = (state) => ({
    content: state.content,
    user: state.user,
});

const mapDispatchToProps = (dispatch: any) => bindActionCreators({
    deleteMoment: MapActions.deleteMoment,
}, dispatch);

export class ViewMoment extends React.Component<IViewMomentProps, IViewMomentState> {
    private date;
    private notificationMsg;
    private hashtags;
    private scrollViewRef;
    private translate: Function;

    constructor(props) {
        super(props);

        const { route } = props;
        const { moment } = route.params;

        const youtubeMatches = (moment.message || '').match(youtubeLinkRegex);

        this.state = {
            errorMsg: '',
            successMsg: '',
            isDeleting: false,
            isVerifyingDelete: false,
            previewStyleState: {},
            previewLinkId: youtubeMatches && youtubeMatches[1],
        };

        this.translate = (key: string, params: any) => translator('en-us', key, params);

        this.notificationMsg = (moment.notificationMsg || '').replace(/\r?\n+|\r+/gm, ' ');
        this.hashtags = moment.hashTags ? moment.hashTags.split(',') : [];

        this.date = formatDate(moment.updatedAt);
    }

    componentDidMount() {
        const { navigation} = this.props;

        navigation.setOptions({
            title: this.notificationMsg,
        });
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
        if (moment.fromUserId === user.details.id) {
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

    render() {
        const { isDeleting, isVerifyingDelete, previewLinkId, previewStyleState } = this.state;
        const { content, navigation, route } = this.props;
        const { moment, isMyMoment } = route.params;
        // TODO: Fetch moment media
        const mediaId = (moment.media && moment.media[0]?.id) || (moment.mediaIds?.length && moment.mediaIds?.split(',')[0]);
        const momentMedia = content?.media[mediaId];

        return (
            <>
                <StatusBar barStyle="light-content" animated={true} translucent={true} backgroundColor="transparent"  />
                <SafeAreaView  style={styles.safeAreaView}>
                    <KeyboardAwareScrollView
                        contentInsetAdjustmentBehavior="automatic"
                        ref={(component) => (this.scrollViewRef = component)}
                        style={[styles.bodyFlex, beemoLayoutStyles.bodyView]}
                        contentContainerStyle={[styles.bodyScroll, beemoLayoutStyles.bodyViewScroll]}
                    >
                        <View style={[beemoLayoutStyles.container, viewMomentStyles.momentContainer]}>
                            <MomentDisplay
                                translate={this.translate}
                                date={this.date}
                                hashtags={this.hashtags}
                                isDarkMode={false}
                                isExpanded={true}
                                moment={moment}
                                // TODO: User Username from response
                                userDetails={{
                                    userName: moment.fromUserId,
                                }}
                                momentMedia={momentMedia}
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
                        <View style={[beemoLayoutStyles.footer, viewMomentStyles.footer]}>
                            <Button
                                containerStyle={beemoFormStyles.backButtonContainer}
                                buttonStyle={beemoFormStyles.backButton}
                                onPress={() => navigation.navigate('Map')}
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
                                isMyMoment &&
                                <>
                                    {
                                        !isVerifyingDelete &&
                                            <Button
                                                buttonStyle={beemoFormStyles.submitDeleteButton}
                                                disabledStyle={beemoFormStyles.submitButtonDisabled}
                                                disabledTitleStyle={beemoFormStyles.submitDisabledButtonTitle}
                                                titleStyle={beemoFormStyles.submitButtonTitle}
                                                containerStyle={beemoFormStyles.submitButtonContainer}
                                                title={this.translate(
                                                    'forms.editMoment.buttons.delete'
                                                )}
                                                icon={
                                                    <FontAwesome5Icon
                                                        name="trash-alt"
                                                        size={25}
                                                        color={'black'}
                                                        style={beemoFormStyles.submitButtonIcon}
                                                    />
                                                }
                                                onPress={this.onDelete}
                                                raised={true}
                                            />
                                    }
                                    {
                                        isVerifyingDelete &&
                                        <View style={beemoFormStyles.submitConfirmContainer}>
                                            <Button
                                                buttonStyle={beemoFormStyles.submitCancelButton}
                                                disabledStyle={beemoFormStyles.submitButtonDisabled}
                                                disabledTitleStyle={beemoFormStyles.submitDisabledButtonTitle}
                                                titleStyle={beemoFormStyles.submitButtonTitle}
                                                containerStyle={beemoFormStyles.submitCancelButtonContainer}
                                                title={this.translate(
                                                    'forms.editMoment.buttons.cancel'
                                                )}
                                                onPress={this.onDeleteCancel}
                                                disabled={isDeleting}
                                                raised={true}
                                            />
                                            <Button
                                                buttonStyle={beemoFormStyles.submitConfirmButton}
                                                disabledStyle={beemoFormStyles.submitButtonDisabled}
                                                disabledTitleStyle={beemoFormStyles.submitDisabledButtonTitle}
                                                titleStyle={beemoFormStyles.submitButtonTitleLight}
                                                containerStyle={beemoFormStyles.submitButtonContainer}
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
            </>
        );
    }
}

export default connect(mapStateToProps, mapDispatchToProps)(ViewMoment);
